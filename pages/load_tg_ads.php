<?php
session_start();
require_once '../core/db.php';

if (!isset($_SESSION['user_id'])) {
    echo '<div class="p-4 bg-red-100 text-red-600 rounded-xl font-bold">Please login first.</div>';
    exit;
}
$user_id = $_SESSION['user_id'];

if (isset($_GET['reward_ad'])) {
    header('Content-Type: application/json');
    $ad_type = isset($_GET['type']) ? trim($_GET['type']) : '';
    $allowed_types = ['monetag', 'adsgram', 'adexora', 'gigapub'];
    if (!in_array($ad_type, $allowed_types)) {
        echo json_encode(['status' => 'error', 'msg' => 'Invalid ad type']);
        exit;
    }
    $reward = (int)(getSetting('ad_' . $ad_type . '_reward') ?: 0);
    if ($reward <= 0) {
        echo json_encode(['status' => 'error', 'msg' => 'No reward configured']);
        exit;
    }
    $daily_limit = (int)(getSetting('ad_' . $ad_type . '_daily_limit') ?: 0);
    if ($daily_limit > 0) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS user_ad_daily (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, ad_type VARCHAR(32), claim_date DATE, claims INT DEFAULT 1, UNIQUE KEY udx (user_id, ad_type, claim_date))");
            $today = date('Y-m-d');
            $cStmt = $pdo->prepare("SELECT claims FROM user_ad_daily WHERE user_id = ? AND ad_type = ? AND claim_date = ?");
            $cStmt->execute([$user_id, $ad_type, $today]);
            $used = (int)$cStmt->fetchColumn();
            if ($used >= $daily_limit) {
                echo json_encode(['status' => 'error', 'msg' => 'Daily limit reached (' . $daily_limit . '/' . $daily_limit . ')']);
                exit;
            }
        } catch(Exception $e) {}
    }
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
        $stmt->execute([$reward, $user_id]);
        if ($daily_limit > 0) {
            $today = date('Y-m-d');
            $pdo->prepare("INSERT INTO user_ad_daily (user_id, ad_type, claim_date, claims) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE claims = claims + 1")->execute([$user_id, $ad_type, $today]);
        }

        $trans_id = $ad_type . '_' . $user_id . '_' . time();
        $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, status) VALUES (?, ?, ?, 'WatchAd', ?, 'completed')");
        $adNames = ['monetag' => 'Monetag Ads', 'adsgram' => 'Adsgram Ads', 'adexora' => 'Adexora Ads', 'gigapub' => 'GigaPub Ads'];
        $offerName = isset($adNames[$ad_type]) ? $adNames[$ad_type] : 'Ad Reward';
        $stmt->execute([$user_id, $trans_id, $offerName, $reward]);

        $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
        $refStmt->execute([$user_id]);
        $refData = $refStmt->fetch();
        if ($refData && !empty($refData['referred_by'])) {
            $commissionRate = (float)(getSetting('referral_commission') ?: 10);
            $commission = round((float)$reward * ($commissionRate / 100), 8);
            if ($commission > 0) {
                $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
                $stmt->execute([$commission, $refData['referred_by']]);
                $stmt = $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$refData['referred_by'], $user_id, $ad_type, $reward, $commission]);
            }
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'reward' => $reward]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'msg' => 'Database error']);
    }
    exit;
}

$bannerTop = getSetting('banner_top');
$bannerBottom = getSetting('banner_bottom');

$ads = [];
$today = date('Y-m-d');
try { $pdo->exec("CREATE TABLE IF NOT EXISTS user_ad_daily (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, ad_type VARCHAR(32), claim_date DATE, claims INT DEFAULT 1, UNIQUE KEY udx (user_id, ad_type, claim_date))"); } catch(Exception $e) {}

function getAdDailyClaims($pdo, $user_id, $ad_type, $today) {
    try {
        $s = $pdo->prepare("SELECT claims FROM user_ad_daily WHERE user_id = ? AND ad_type = ? AND claim_date = ?");
        $s->execute([$user_id, $ad_type, $today]);
        return (int)$s->fetchColumn();
    } catch(Exception $e) { return 0; }
}

$monetag_zone = getSetting('ad_monetag_zone_id');
$monetag_script = getSetting('ad_monetag_script_url');
if (getSetting('ad_monetag_status') == '1' && !empty($monetag_zone) && !empty($monetag_script)) {
    $dl = (int)(getSetting('ad_monetag_daily_limit') ?: 0);
    $used = $dl > 0 ? getAdDailyClaims($pdo, $user_id, 'monetag', $today) : 0;
    $ads[] = [
        'type' => 'monetag',
        'reward' => (int)(getSetting('ad_monetag_reward') ?: 20),
        'zone_id' => $monetag_zone,
        'script_url' => $monetag_script,
        'daily_limit' => $dl,
        'daily_used' => $used,
    ];
}

$adsgram_block = getSetting('ad_adsgram_block_id');
if (getSetting('ad_adsgram_status') == '1' && !empty($adsgram_block)) {
    $dl = (int)(getSetting('ad_adsgram_daily_limit') ?: 0);
    $used = $dl > 0 ? getAdDailyClaims($pdo, $user_id, 'adsgram', $today) : 0;
    $ads[] = [
        'type' => 'adsgram',
        'reward' => (int)(getSetting('ad_adsgram_reward') ?: 15),
        'block_id' => $adsgram_block,
        'daily_limit' => $dl,
        'daily_used' => $used,
    ];
}

$adexora_app = getSetting('ad_adexora_app_id');
if (getSetting('ad_adexora_status') == '1' && !empty($adexora_app)) {
    $dl = (int)(getSetting('ad_adexora_daily_limit') ?: 0);
    $used = $dl > 0 ? getAdDailyClaims($pdo, $user_id, 'adexora', $today) : 0;
    $ads[] = [
        'type' => 'adexora',
        'reward' => (int)(getSetting('ad_adexora_reward') ?: 15),
        'app_id' => $adexora_app,
        'daily_limit' => $dl,
        'daily_used' => $used,
    ];
}

$gigapub_project = getSetting('ad_gigapub_project_id');
if (getSetting('ad_gigapub_status') == '1' && !empty($gigapub_project)) {
    $dl = (int)(getSetting('ad_gigapub_daily_limit') ?: 0);
    $used = $dl > 0 ? getAdDailyClaims($pdo, $user_id, 'gigapub', $today) : 0;
    $ads[] = [
        'type' => 'gigapub',
        'reward' => (int)(getSetting('ad_gigapub_reward') ?: 20),
        'project_id' => $gigapub_project,
        'daily_limit' => $dl,
        'daily_used' => $used,
    ];
}

$totalAds = count($ads);

$adMeta = [
    'monetag'  => ['label' => 'Monetag Ads',  'desc' => 'Rewarded video ad',    'icon' => 'fas fa-play-circle',      'iconBg' => 'bg-gradient-to-br from-orange-400 to-red-500',    'border' => 'border-orange-200 dark:border-orange-500/20'],
    'adsgram'  => ['label' => 'Adsgram Ads',  'desc' => 'Rewarded video ad',    'icon' => 'fas fa-play-circle',      'iconBg' => 'bg-gradient-to-br from-violet-400 to-purple-600', 'border' => 'border-violet-200 dark:border-violet-500/20'],
    'adexora'  => ['label' => 'Adexora Ads',  'desc' => 'Quick view ad',        'icon' => 'fas fa-tv',               'iconBg' => 'bg-gradient-to-br from-emerald-400 to-teal-500',  'border' => 'border-emerald-200 dark:border-emerald-500/20'],
    'gigapub'  => ['label' => 'GigaPub Ads',  'desc' => 'Sponsor content',      'icon' => 'fas fa-external-link-alt','iconBg' => 'bg-gradient-to-br from-blue-400 to-cyan-500',     'border' => 'border-blue-200 dark:border-blue-500/20'],
];
?>
<div class="px-4 py-2">
    <?php if(!empty($bannerTop)): ?>
        <div class="mb-6 w-full overflow-hidden flex justify-center rounded-2xl"><?php echo $bannerTop; ?></div>
    <?php endif; ?>

    <?php if($totalAds === 0): ?>
        <div class="p-8 bg-gray-100 dark:bg-dark-800 text-gray-500 rounded-[2rem] text-center font-bold mt-4 shadow-sm">
            <div class="w-20 h-20 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-video-slash text-3xl"></i>
            </div>
            <span class="text-lg">No ads available at the moment.</span><br>
            <span class="text-xs font-medium opacity-70 mt-2 block">Please check back later.</span>
        </div>
    <?php else: ?>
        <!-- Header -->
        <div class="mt-2 mb-5">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <i class="fas fa-play-circle text-brand-primary"></i> Watch Ads
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Earn 15–40 pts per ad</p>
                </div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> <?php echo $totalAds; ?>/<?php echo $totalAds; ?> ready
                </span>
            </div>
        </div>

        <!-- Ad Cards -->
        <div class="space-y-3 mb-6">
            <?php foreach($ads as $ad): 
                $meta = $adMeta[$ad['type']];
                $limit_reached = ($ad['daily_limit'] > 0 && $ad['daily_used'] >= $ad['daily_limit']);
                $cardBorder = $limit_reached ? 'border-gray-300 dark:border-white/10' : $meta['border'];
            ?>
            <button <?php echo $limit_reached ? 'disabled' : 'onclick="watchAd_' . $ad['type'] . '(this)"'; ?> class="ad-card-<?php echo $ad['type']; ?> w-full flex items-center gap-4 p-4 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border <?php echo $cardBorder; ?> rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left group <?php echo $limit_reached ? 'opacity-50 cursor-not-allowed' : ''; ?>">
                <div class="w-11 h-11 <?php echo $limit_reached ? 'bg-gray-400' : $meta['iconBg']; ?> rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <i class="<?php echo $meta['icon']; ?> text-white text-base"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-extrabold text-gray-900 dark:text-white text-sm truncate"><?php echo htmlspecialchars($meta['label']); ?></h4>
                    <div class="flex items-center gap-2 mt-0.5">
                        <p class="text-[11px] text-gray-400 truncate"><?php echo htmlspecialchars($meta['desc']); ?></p>
                        <?php if($ad['daily_limit'] > 0): ?>
                        <span class="text-[10px] px-1.5 py-0.5 rounded-md <?php echo $limit_reached ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'; ?> font-bold"><?php echo $ad['daily_used']; ?>/<?php echo $ad['daily_limit']; ?></span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="flex-shrink-0">
                    <?php if($limit_reached): ?>
                    <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-xs font-bold"><i class="fas fa-ban text-[10px]"></i> Done</span>
                    <?php else: ?>
                    <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-extrabold">+<?php echo $ad['reward']; ?></span>
                    <?php endif; ?>
                </div>
            </button>
            <?php endforeach; ?>
        </div>

        <!-- Info Notice -->
        <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-white/5 rounded-2xl">
            <i class="fas fa-circle-info text-gray-400 mt-0.5"></i>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Watch ads completely to earn full rewards. Ads rotate between networks for best availability.
            </p>
        </div>
    <?php endif; ?>

    <?php if(!empty($bannerBottom)): ?>
        <div class="mt-6 mb-4 w-full overflow-hidden flex justify-center rounded-2xl"><?php echo $bannerBottom; ?></div>
    <?php endif; ?>
</div>

<div id="ad-status-msg" class="hidden mx-4 mt-4 text-sm font-bold text-center transition-all duration-300"></div>

<script>
function showAdStatus(type, message) {
    const msg = document.getElementById('ad-status-msg');
    if (!msg) return;
    if (type === 'success') {
        msg.innerHTML = '<i class="fas fa-gift text-lg mb-1 block"></i> <b>Success!</b><br><span class="opacity-90 font-medium text-xs">' + message + '</span>';
        msg.className = "mx-4 mt-4 text-sm text-center text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 p-5 rounded-[2rem] border border-emerald-200 dark:border-emerald-800/50 shadow-sm";
    } else {
        msg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + message;
        msg.className = "mx-4 mt-4 text-sm text-center text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 p-4 rounded-2xl border border-red-200 dark:border-red-800/50 shadow-sm";
    }
    msg.classList.remove('hidden');
}

function creditReward(adType, btnElement, originalHtml) {
    fetch('pages/load_tg_ads.php?reward_ad=1&type=' + adType)
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showAdStatus('success', '+' + data.reward + ' points added to your balance!');
                if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
                setTimeout(() => {
                    if (typeof tgLoadContent === 'function') {
                        tgLoadContent('pages/load_tg_ads.php', document.querySelector('.nav-item.active'));
                    }
                }, 3000);
            } else {
                showAdStatus('error', data.msg || 'Failed to credit reward.');
                btnElement.disabled = false;
                btnElement.innerHTML = originalHtml;
            }
        })
        .catch(() => {
            showAdStatus('error', 'Network error. Please try again.');
            btnElement.disabled = false;
            btnElement.innerHTML = originalHtml;
        });
}

<?php foreach($ads as $ad): ?>
<?php if($ad['type'] === 'monetag'): ?>
// ===== MONETAG SDK =====
(function() {
    var zoneId = '<?php echo htmlspecialchars($ad['zone_id']); ?>';
    var scriptUrl = '<?php echo htmlspecialchars($ad['script_url']); ?>';
    
    if (!document.getElementById('monetag-sdk')) {
        var s = document.createElement('script');
        s.id = 'monetag-sdk';
        s.src = scriptUrl;
        s.setAttribute('data-zone', zoneId);
        s.setAttribute('data-sdk', 'show_' + zoneId);
        document.head.appendChild(s);
    }

    window.watchAd_monetag = function(btn) {
        var originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"><i class="fas fa-circle-notch fa-spin text-white text-lg"></i></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-900 dark:text-white text-sm">Loading Ad...</h4><p class="text-xs text-gray-500">Please wait</p></div>';

        var showFn = window['show_' + zoneId];
        if (typeof showFn !== 'function') {
            setTimeout(function() {
                showFn = window['show_' + zoneId];
                if (typeof showFn !== 'function') {
                    showAdStatus('error', 'Monetag SDK not ready. Please try again.');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }
                runMonetagAd(showFn, btn, originalHtml);
            }, 2000);
            return;
        }
        runMonetagAd(showFn, btn, originalHtml);
    };

    function runMonetagAd(showFn, btn, originalHtml) {
        showFn({ ymid: 'user_<?php echo $user_id; ?>_' + Date.now() }).then(function() {
            creditReward('monetag', btn, originalHtml);
        }).catch(function() {
            showAdStatus('error', 'Ad was skipped or blocked.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
    }
})();
<?php endif; ?>

<?php if($ad['type'] === 'adsgram'): ?>
// ===== ADSGRAM SDK =====
(function() {
    var blockId = '<?php echo htmlspecialchars($ad['block_id']); ?>';
    
    if (!document.getElementById('adsgram-sdk')) {
        var s = document.createElement('script');
        s.id = 'adsgram-sdk';
        s.src = 'https://sad.adsgram.ai/js/sad.min.js';
        document.head.appendChild(s);
    }

    window.watchAd_adsgram = function(btn) {
        var originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"><i class="fas fa-circle-notch fa-spin text-white text-lg"></i></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-900 dark:text-white text-sm">Loading Ad...</h4><p class="text-xs text-gray-500">Please wait</p></div>';

        if (typeof window.Adsgram === 'undefined') {
            setTimeout(function() {
                if (typeof window.Adsgram === 'undefined') {
                    showAdStatus('error', 'Adsgram SDK not ready. Please try again.');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }
                runAdsgramAd(btn, originalHtml);
            }, 2000);
            return;
        }
        runAdsgramAd(btn, originalHtml);
    };

    function runAdsgramAd(btn, originalHtml) {
        var AdController = window.Adsgram.init({ blockId: blockId });
        AdController.show().then(function(result) {
            if (result.done) {
                creditReward('adsgram', btn, originalHtml);
            } else {
                showAdStatus('error', 'Ad was not completed.');
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }).catch(function(result) {
            showAdStatus('error', result.description || 'Ad failed or was skipped.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
    }
})();
<?php endif; ?>

<?php if($ad['type'] === 'adexora'): ?>
// ===== ADEXORA SDK =====
(function() {
    var appId = '<?php echo htmlspecialchars($ad['app_id']); ?>';
    
    if (!document.getElementById('adexora-sdk')) {
        var s = document.createElement('script');
        s.id = 'adexora-sdk';
        s.src = 'https://adexora.com/cdn/ads.js?id=' + appId;
        document.head.appendChild(s);
    }

    window.watchAd_adexora = function(btn) {
        var originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"><i class="fas fa-circle-notch fa-spin text-white text-lg"></i></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-900 dark:text-white text-sm">Loading Ad...</h4><p class="text-xs text-gray-500">Please wait</p></div>';

        if (typeof window.showAdexora !== 'function') {
            setTimeout(function() {
                if (typeof window.showAdexora !== 'function') {
                    showAdStatus('error', 'Adexora SDK not ready. Please try again.');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }
                runAdexoraAd(btn, originalHtml);
            }, 2000);
            return;
        }
        runAdexoraAd(btn, originalHtml);
    };

    function runAdexoraAd(btn, originalHtml) {
        window.showAdexora().then(function() {
            creditReward('adexora', btn, originalHtml);
        }).catch(function(e) {
            showAdStatus('error', 'Ad failed or was skipped.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
    }
})();
<?php endif; ?>

<?php if($ad['type'] === 'gigapub'): ?>
// ===== GIGAPUB SDK =====
(function() {
    var projectId = '<?php echo htmlspecialchars($ad['project_id']); ?>';
    
    if (!document.getElementById('gigapub-sdk')) {
        var s = document.createElement('script');
        s.id = 'gigapub-sdk';
        s.src = 'https://ad.gigapub.tech/script?id=' + projectId;
        document.head.appendChild(s);
    }

    window.watchAd_gigapub = function(btn) {
        var originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"><i class="fas fa-circle-notch fa-spin text-white text-lg"></i></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-900 dark:text-white text-sm">Loading Ad...</h4><p class="text-xs text-gray-500">Please wait</p></div>';

        if (typeof window.showGiga !== 'function') {
            setTimeout(function() {
                if (typeof window.showGiga !== 'function') {
                    showAdStatus('error', 'GigaPub SDK not ready. Please try again.');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }
                runGigapubAd(btn, originalHtml);
            }, 2000);
            return;
        }
        runGigapubAd(btn, originalHtml);
    };

    function runGigapubAd(btn, originalHtml) {
        window.showGiga().then(function() {
            creditReward('gigapub', btn, originalHtml);
        }).catch(function(e) {
            showAdStatus('error', 'Ad failed or was skipped.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
    }
})();
<?php endif; ?>

<?php endforeach; ?>
</script>
