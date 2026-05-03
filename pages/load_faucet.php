<?php
session_start();
require_once '../core/db.php';

if (!isset($_SESSION['user_id'])) {
    echo '<div class="p-4 bg-red-100 text-red-600 rounded-xl font-bold">Please login first.</div>';
    exit;
}
$user_id = $_SESSION['user_id'];

if (isset($_GET['claim_faucet'])) {
    header('Content-Type: application/json');
    $faucet_min = (int)(getSetting('faucet_reward_min') ?: 1);
    $faucet_max = (int)(getSetting('faucet_reward_max') ?: 50);
    if ($faucet_max < $faucet_min) $faucet_max = $faucet_min;
    $faucet_reward = random_int($faucet_min, $faucet_max);
    $faucet_cooldown = (int)(getSetting('faucet_cooldown') ?: 60);
    
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_faucet_claims (user_id INT PRIMARY KEY, last_claim INT)");
        $fStmt = $pdo->prepare("SELECT last_claim FROM user_faucet_claims WHERE user_id = ?");
        $fStmt->execute([$user_id]);
        $last_claim = $fStmt->fetchColumn() ?: 0;
        $remaining = ($faucet_cooldown * 60) - (time() - $last_claim);
        
        if ($remaining > 0) {
            echo json_encode(['status' => 'error', 'msg' => 'Cooldown active. Wait ' . gmdate('H:i:s', $remaining)]);
            exit;
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
        $stmt->execute([$faucet_reward, $user_id]);

        $trans_id = 'faucet_' . $user_id . '_' . time();
        $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, status) VALUES (?, ?, 'Hourly Faucet', 'Faucet', ?, 'completed')");
        $stmt->execute([$user_id, $trans_id, $faucet_reward]);

        $now = time();
        $stmt = $pdo->prepare("INSERT INTO user_faucet_claims (user_id, last_claim) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_claim = ?");
        $stmt->execute([$user_id, $now, $now]);

        $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
        $refStmt->execute([$user_id]);
        $refData = $refStmt->fetch();
        if ($refData && !empty($refData['referred_by'])) {
            $commissionRate = (float)(getSetting('referral_commission') ?: 10);
            $commission = round((float)$faucet_reward * ($commissionRate / 100), 8);
            if ($commission > 0) {
                $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
                $stmt->execute([$commission, $refData['referred_by']]);
                $stmt = $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, 'faucet', ?, ?)");
                $stmt->execute([$refData['referred_by'], $user_id, $faucet_reward, $commission]);
            }
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'reward' => $faucet_reward]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'msg' => 'Database error']);
    }
    exit;
}

$faucet_min = (int)(getSetting('faucet_reward_min') ?: 1);
$faucet_max = (int)(getSetting('faucet_reward_max') ?: 50);
if ($faucet_max < $faucet_min) $faucet_max = $faucet_min;
$faucet_reward_label = $faucet_min . '-' . $faucet_max;

$faucet_ads = [];
$networks = ['monetag', 'adsgram', 'adexora', 'gigapub'];
foreach ($networks as $net) {
    if (getSetting('ad_' . $net . '_status') != '1') continue;
    if (getSetting('ad_' . $net . '_faucet') != '1') continue;
    
    $ad = ['type' => $net, 'reward' => (int)(getSetting('ad_' . $net . '_reward') ?: 0)];
    
    if ($net === 'monetag') {
        $zone = getSetting('ad_monetag_zone_id');
        $script = getSetting('ad_monetag_script_url');
        if (empty($zone) || empty($script)) continue;
        $ad['zone_id'] = $zone;
        $ad['script_url'] = $script;
    } elseif ($net === 'adsgram') {
        $block = getSetting('ad_adsgram_block_id');
        if (empty($block)) continue;
        $ad['block_id'] = $block;
    } elseif ($net === 'adexora') {
        $app = getSetting('ad_adexora_app_id');
        if (empty($app)) continue;
        $ad['app_id'] = $app;
    } elseif ($net === 'gigapub') {
        $proj = getSetting('ad_gigapub_project_id');
        if (empty($proj)) continue;
        $ad['project_id'] = $proj;
    }
    
    $faucet_ads[] = $ad;
    if (count($faucet_ads) >= 3) break;
}

$totalFaucetAds = count($faucet_ads);
?>
<div class="px-4 py-2 animate-[fadeIn_0.4s_ease-out]">

    <?php if($totalFaucetAds === 0): ?>
        <div id="faucet-main" class="text-center">
            <div class="relative inline-block mb-5">
                <div id="faucet-icon-main" class="w-24 h-24 bg-gradient-to-br from-violet-500 via-purple-600 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-violet-500/30 ring-2 ring-white/10">
                    <i class="fas fa-droplet text-5xl text-white"></i>
                </div>
            </div>
            <h2 class="text-xl font-extrabold text-gray-900 dark:text-white mb-1">Hourly Faucet</h2>
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-6" id="faucet-subtitle">Claim free points every hour &mdash; earn random <span class="text-brand-primary font-extrabold">+<?php echo $faucet_reward_label; ?></span></p>
            <button id="faucet-btn" onclick="window.claimFaucetReward()" class="w-full py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg shadow-violet-500/30 active:scale-95 transition-all">
                <i class="fas fa-gift"></i> Claim Hourly Faucet
            </button>
            <div id="faucet-msg" class="mt-4 text-sm font-bold min-h-[24px]"></div>
        </div>
    <?php else: ?>
        <!-- Faucet main area -->
        <div id="faucet-main" class="text-center">
            <div class="relative inline-block mb-5">
                <div id="faucet-icon-main" class="w-24 h-24 bg-gradient-to-br from-violet-500 via-purple-600 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-violet-500/30 ring-2 ring-white/10">
                    <i class="fas fa-droplet text-5xl text-white"></i>
                </div>
            </div>
            <h2 class="text-xl font-extrabold text-gray-900 dark:text-white mb-1">Hourly Faucet</h2>
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-6" id="faucet-subtitle">Tap to claim &mdash; earn random <span class="text-brand-primary font-extrabold">+<?php echo $faucet_reward_label; ?></span></p>
            
            <button id="faucet-btn" onclick="window.claimFaucetReward()" class="w-full py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg shadow-violet-500/30 active:scale-95 transition-all">
                <i class="fas fa-play"></i> Start
            </button>
        </div>

        <div id="faucet-msg" class="hidden mt-5 text-sm font-bold text-center p-4 rounded-2xl"></div>
    <?php endif; ?>
</div>

<?php if($totalFaucetAds > 0): ?>
<script>
var faucetAds = <?php echo json_encode($faucet_ads); ?>;
var faucetTotal = faucetAds.length;
var faucetUserId = <?php echo $user_id; ?>;
var faucetReward = "<?php echo $faucet_reward_label; ?>";

function setFaucetState(icon, text, btnHtml, btnDisabled) {
    var iconEl = document.getElementById('faucet-icon-main');
    var subEl = document.getElementById('faucet-subtitle');
    var btnEl = document.getElementById('faucet-btn');
    if (icon) iconEl.innerHTML = icon;
    if (text) subEl.innerHTML = text;
    if (btnHtml !== null && btnEl) btnEl.innerHTML = btnHtml;
    if (btnEl) btnEl.disabled = !!btnDisabled;
}

function showFaucetMsg(type, msg) {
    var el = document.getElementById('faucet-msg');
    el.classList.remove('hidden');
    el.className = 'mt-5 text-sm font-bold text-center p-4 rounded-2xl ' + 
        (type === 'success' 
            ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
            : 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50');
    el.innerHTML = msg;
}

window.startFaucet = function() {
    setFaucetState(
        '<i class="fas fa-circle-notch fa-spin text-5xl text-white"></i>',
        'Loading ads... please wait',
        '<i class="fas fa-circle-notch fa-spin"></i> Playing ads...', true
    );
    playNextFaucetAd(0);
}

function playNextFaucetAd(idx) {
    if (idx >= faucetTotal) {
        claimFaucetReward();
        return;
    }
    var ad = faucetAds[idx];
    if (ad.type === 'monetag') playMonetag(ad, idx);
    else if (ad.type === 'adsgram') playAdsgram(ad, idx);
    else if (ad.type === 'adexora') playAdexora(ad, idx);
    else if (ad.type === 'gigapub') playGigapub(ad, idx);
    else playNextFaucetAd(idx + 1);
}

window.onAdDone = function(idx) { setTimeout(function(){ playNextFaucetAd(idx + 1); }, 500); }
window.onAdFail = function(idx) { setTimeout(function(){ playNextFaucetAd(idx + 1); }, 300); }

// MONETAG
function playMonetag(ad, idx) {
    if (!document.getElementById('monetag-sdk')) {
        var s = document.createElement('script');
        s.id = 'monetag-sdk';
        s.src = ad.script_url;
        s.setAttribute('data-zone', ad.zone_id);
        s.setAttribute('data-sdk', 'show_' + ad.zone_id);
        s.onload = function(){ doMonetag(ad, idx); };
        s.onerror = function(){ onAdFail(idx); };
        document.head.appendChild(s);
    } else { doMonetag(ad, idx); }
}
function doMonetag(ad, idx) {
    var fn = window['show_' + ad.zone_id];
    if (typeof fn !== 'function') {
        setTimeout(function(){
            fn = window['show_' + ad.zone_id];
            if (typeof fn !== 'function') { onAdFail(idx); return; }
            fn({ ymid: 'faucet_' + faucetUserId }).then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
        }, 2500);
        return;
    }
    fn({ ymid: 'faucet_' + faucetUserId }).then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
}

// ADSGRAM
function playAdsgram(ad, idx) {
    if (!document.getElementById('adsgram-sdk')) {
        var s = document.createElement('script');
        s.id = 'adsgram-sdk';
        s.src = 'https://sad.adsgram.ai/js/sad.min.js';
        s.onload = function(){ doAdsgram(ad, idx); };
        s.onerror = function(){ onAdFail(idx); };
        document.head.appendChild(s);
    } else { doAdsgram(ad, idx); }
}
function doAdsgram(ad, idx) {
    if (typeof window.Adsgram === 'undefined') {
        setTimeout(function(){
            if (typeof window.Adsgram === 'undefined') { onAdFail(idx); return; }
            runAdsgram(ad, idx);
        }, 2000);
        return;
    }
    runAdsgram(ad, idx);
}
function runAdsgram(ad, idx) {
    var ctrl = window.Adsgram.init({ blockId: ad.block_id });
    ctrl.show().then(function(r){ if(r.done) onAdDone(idx); else onAdFail(idx); }).catch(function(){ onAdFail(idx); });
}

// ADEXORA
function playAdexora(ad, idx) {
    if (!document.getElementById('adexora-sdk')) {
        var s = document.createElement('script');
        s.id = 'adexora-sdk';
        s.src = 'https://adexora.com/cdn/ads.js?id=' + ad.app_id;
        s.onload = function(){ doAdexora(ad, idx); };
        s.onerror = function(){ onAdFail(idx); };
        document.head.appendChild(s);
    } else { doAdexora(ad, idx); }
}
function doAdexora(ad, idx) {
    if (typeof window.showAdexora !== 'function') {
        setTimeout(function(){
            if (typeof window.showAdexora !== 'function') { onAdFail(idx); return; }
            window.showAdexora().then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
        }, 2000);
        return;
    }
    window.showAdexora().then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
}

// GIGAPUB
function playGigapub(ad, idx) {
    if (!document.getElementById('gigapub-sdk')) {
        var s = document.createElement('script');
        s.id = 'gigapub-sdk';
        s.src = 'https://ad.gigapub.tech/script?id=' + ad.project_id;
        s.onload = function(){ doGigapub(ad, idx); };
        s.onerror = function(){ onAdFail(idx); };
        document.head.appendChild(s);
    } else { doGigapub(ad, idx); }
};
window.doGigapub = function(ad, idx) {
    if (typeof window.showGiga !== 'function') {
        setTimeout(function(){
            if (typeof window.showGiga !== 'function') { onAdFail(idx); return; }
            window.showGiga().then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
        }, 2000);
        return;
    }
    window.showGiga().then(function(){ onAdDone(idx); }).catch(function(){ onAdFail(idx); });
}

window.claimFaucetReward = function() {
    setFaucetState(
        '<i class="fas fa-gift text-5xl text-white animate-bounce"></i>',
        'Claiming your reward...',
        '<i class="fas fa-circle-notch fa-spin"></i> Claiming...', true
    );
    
    fetch('./pages/load_faucet.php?claim_faucet=1', { credentials: 'same-origin' })
        .then(function(r){ return r.json(); })
        .then(function(data){
            if (data.status === 'success') {
                setFaucetState(
                    '<i class="fas fa-check text-5xl text-white"></i>',
                    '<span class="text-emerald-500 font-extrabold text-lg">+' + data.reward + ' points earned!</span>',
                    null, true
                );
                var btn = document.getElementById('faucet-btn');
                if (btn) btn.classList.add('hidden');
                showFaucetMsg('success', '<i class="fas fa-check-circle"></i> Reward claimed! Redirecting...');
                document.getElementById('faucet-icon-main').className = 'w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30';
                if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
                setTimeout(function(){
                    if (typeof tgLoadContent === 'function') {
                        tgLoadContent('pages/load_dashboard.php', document.querySelectorAll('.nav-item')[0]);
                    } else if (typeof loadContent === 'function') {
                        loadContent('pages/load_dashboard.php');
                    } else {
                        location.reload();
                    }
                }, 2000);
            } else {
                showFaucetMsg('error', data.msg || 'Failed to claim.');
                setFaucetState(null, null, '<i class="fas fa-redo"></i> Retry', false);
                document.getElementById('faucet-btn').onclick = function(){ window.claimFaucetReward(); };
            }
        })
        .catch(function(){
            showFaucetMsg('error', 'Network error. Please try again.');
            setFaucetState(null, null, '<i class="fas fa-redo"></i> Retry', false);
            document.getElementById('faucet-btn').onclick = function(){ window.claimFaucetReward(); };
        });
};
</script>
<?php endif; ?>
