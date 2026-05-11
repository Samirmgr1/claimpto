<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['user_id'])) {
    return;
}
$user_id = $_SESSION['user_id'];
$currency = getSetting('currency_name') ?: 'Coins';

function ensureCouponTables($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS addon_coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        reward DECIMAL(20,8) NOT NULL DEFAULT 0,
        max_uses INT NOT NULL DEFAULT 1,
        used_count INT NOT NULL DEFAULT 0,
        req_offer_type VARCHAR(20) NOT NULL DEFAULT 'none',
        req_offer_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
        req_timeframe VARCHAR(20) NOT NULL DEFAULT 'all_time',
        expires_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS addon_coupon_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        coupon_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_coupon (user_id, coupon_id),
        KEY idx_coupon_id (coupon_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

if (isset($_GET['redeem_home_coupon'])) {
    header('Content-Type: application/json');
    try {
        ensureCouponTables($pdo);

        if (isset($_SESSION['coupon_fails']) && $_SESSION['coupon_fails'] >= 5) {
            $timePassed = time() - ($_SESSION['last_fail_time'] ?? 0);
            if ($timePassed < 300) {
                $timeLeft = ceil((300 - $timePassed) / 60);
                echo json_encode(['success' => false, 'message' => "Too many failed attempts. Try again in $timeLeft minutes.", 'shake' => true]);
                exit;
            }
            $_SESSION['coupon_fails'] = 0;
        }

        $code = strtoupper(trim($_POST['code'] ?? ''));
        if ($code === '') {
            echo json_encode(['success' => false, 'message' => 'Please enter a coupon code.', 'shake' => true]);
            exit;
        }

        $coupon_ad_nets = ['monetag', 'adsgram', 'adexora', 'gigapub'];
        $has_coupon_ads = false;
        foreach ($coupon_ad_nets as $net) {
            if (getSetting('coupon_ad_' . $net) == '1' && getSetting('ad_' . $net . '_status') == '1') {
                $has_coupon_ads = true;
                break;
            }
        }
        if ($has_coupon_ads) {
            $posted_coupon_token = $_POST['coupon_ad_token'] ?? '';
            if (empty($_SESSION['home_coupon_ad_token']) || !hash_equals($_SESSION['home_coupon_ad_token'], $posted_coupon_token)) {
                echo json_encode(['success' => false, 'message' => 'Please watch the ad first before claiming.', 'shake' => true]);
                exit;
            }
        }

        $stmt = $pdo->prepare("SELECT * FROM addon_coupons WHERE code = ? LIMIT 1");
        $stmt->execute([$code]);
        $coupon = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$coupon) {
            $_SESSION['coupon_fails'] = ($_SESSION['coupon_fails'] ?? 0) + 1;
            $_SESSION['last_fail_time'] = time();
            echo json_encode(['success' => false, 'message' => 'Invalid or expired coupon code.', 'shake' => true]);
            exit;
        }

        if (!empty($coupon['expires_at']) && strtotime($coupon['expires_at']) < time()) {
            echo json_encode(['success' => false, 'message' => 'This coupon has expired.', 'shake' => true]);
            exit;
        }

        if ((int)$coupon['used_count'] >= (int)$coupon['max_uses']) {
            echo json_encode(['success' => false, 'message' => 'This coupon has reached its claim limit.', 'shake' => true]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM addon_coupon_logs WHERE user_id = ? AND coupon_id = ?");
        $stmt->execute([$user_id, $coupon['id']]);
        if ((int)$stmt->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'You already claimed this coupon.', 'shake' => true]);
            exit;
        }

        if (($coupon['req_offer_type'] ?? 'none') !== 'none' && (float)($coupon['req_offer_amount'] ?? 0) > 0) {
            $hasCompletedOffers = $pdo->query("SHOW TABLES LIKE 'completed_offers'")->rowCount() > 0;
            if (!$hasCompletedOffers) {
                echo json_encode(['success' => false, 'message' => 'Coupon requirement cannot be checked yet.']);
                exit;
            }
            $timeCondition = '';
            $timeMsg = '';
            if (($coupon['req_timeframe'] ?? '') === '24_hours') {
                $timeCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)";
                $timeMsg = " in the last 24 hours";
            }
            if ($coupon['req_offer_type'] === 'count') {
                $stmt = $pdo->prepare("SELECT COUNT(id) FROM completed_offers WHERE user_id = ? AND status = 1 AND offer_type != 'addon'" . $timeCondition);
                $stmt->execute([$user_id]);
                $done = (int)$stmt->fetchColumn();
                $need = (int)$coupon['req_offer_amount'];
                if ($done < $need) {
                    echo json_encode(['success' => false, 'message' => "Requirement not met. Complete {$need} offers{$timeMsg}. Completed: {$done}", 'shake' => true]);
                    exit;
                }
            } elseif ($coupon['req_offer_type'] === 'value') {
                $stmt = $pdo->prepare("SELECT SUM(reward) FROM completed_offers WHERE user_id = ? AND status = 1 AND offer_type != 'addon'" . $timeCondition);
                $stmt->execute([$user_id]);
                $earned = (float)$stmt->fetchColumn();
                $need = (float)$coupon['req_offer_amount'];
                if ($earned < $need) {
                    echo json_encode(['success' => false, 'message' => 'Requirement not met. Earn at least ' . number_format($need, 2) . " {$currency} from offers{$timeMsg}.", 'shake' => true]);
                    exit;
                }
            }
        }

        $reward = (float)$coupon['reward'];
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE addon_coupons SET used_count = used_count + 1 WHERE id = ?")->execute([$coupon['id']]);
        $pdo->prepare("INSERT INTO addon_coupon_logs (user_id, coupon_id) VALUES (?, ?)")->execute([$user_id, $coupon['id']]);
        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$reward, $user_id]);

        $transId = uniqid('coup_') . '_' . $coupon['id'];
        $offerName = 'Coupon Code: ' . $coupon['code'];
        $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$user_id, $transId, $offerName, 'addon', $reward, 0]);

        $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $newBalance = (float)$stmt->fetchColumn();
        $pdo->commit();

        $_SESSION['coupon_fails'] = 0;
        unset($_SESSION['home_coupon_ad_token']);
        echo json_encode(['success' => true, 'reward' => $reward, 'new_balance' => $newBalance, 'message' => '+' . number_format($reward, 2) . ' ' . $currency . ' added!']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Could not claim coupon. Please try again.']);
    }
    exit;
}

if (isset($_GET['claim_home_faucet'])) {
    header('Content-Type: application/json');
    try {
        $faucet_status_val = getSetting('faucet_status');
        $faucet_enabled = ($faucet_status_val === '0') ? false : true;
        if (!$faucet_enabled) {
            echo json_encode(['status' => 'error', 'msg' => 'Hourly faucet is disabled.']);
            exit;
        }

        $faucet_cooldown = (int)(getSetting('faucet_cooldown') ?: 60);
        $posted_token = $_POST['faucet_token'] ?? '';
        if (empty($_SESSION['home_faucet_token']) || !hash_equals($_SESSION['home_faucet_token'], $posted_token)) {
            $faucetReqAds = max(1, (int)(getSetting('faucet_required_ads') ?: 2));
            echo json_encode(['status' => 'error', 'msg' => 'Please watch the ' . $faucetReqAds . ' video ad(s) first.']);
            exit;
        }
        $faucet_min = (int)(getSetting('faucet_reward_min') ?: 1);
        $faucet_max = (int)(getSetting('faucet_reward_max') ?: 50);
        if ($faucet_min < 1) $faucet_min = 1;
        if ($faucet_max < $faucet_min) $faucet_max = $faucet_min;
        $fallback_reward = isset($_POST['fallback_reward']) && $_POST['fallback_reward'] === '1';
        if ($fallback_reward) {
            $half_max = max($faucet_min, (int)floor($faucet_max / 2));
            $faucet_max = $half_max;
        }
        $faucet_reward = random_int($faucet_min, $faucet_max);

        $pdo->exec("CREATE TABLE IF NOT EXISTS user_faucet_claims (user_id INT PRIMARY KEY, last_claim INT)");
        $fStmt = $pdo->prepare("SELECT last_claim FROM user_faucet_claims WHERE user_id = ?");
        $fStmt->execute([$user_id]);
        $last_claim = $fStmt->fetchColumn() ?: 0;
        $remaining = ($faucet_cooldown * 60) - (time() - $last_claim);
        if ($remaining > 0) {
            echo json_encode(['status' => 'error', 'msg' => 'Cooldown active. Wait ' . gmdate('H:i:s', $remaining), 'remaining' => $remaining]);
            exit;
        }

        $pdo->beginTransaction();
        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$faucet_reward, $user_id]);
        $trans_id = 'faucet_' . $user_id . '_' . time() . '_' . random_int(1000, 9999);
        $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, status) VALUES (?, ?, 'Hourly Faucet', 'Faucet', ?, 'completed')")->execute([$user_id, $trans_id, $faucet_reward]);
        $now = time();
        $pdo->prepare("INSERT INTO user_faucet_claims (user_id, last_claim) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_claim = ?")->execute([$user_id, $now, $now]);

        $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
        $refStmt->execute([$user_id]);
        $refData = $refStmt->fetch();
        if ($refData && !empty($refData['referred_by'])) {
            $commissionRate = (float)(getSetting('referral_commission') ?: 10);
            $commission = round((float)$faucet_reward * ($commissionRate / 100), 8);
            if ($commission > 0) {
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$commission, $refData['referred_by']]);
                $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, 'faucet', ?, ?)")->execute([$refData['referred_by'], $user_id, $faucet_reward, $commission]);
            }
        }
        $pdo->commit();
        unset($_SESSION['home_faucet_token']);
        echo json_encode(['status' => 'success', 'reward' => $faucet_reward, 'msg' => '+' . $faucet_reward . ' claimed from hourly faucet!']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'msg' => 'Faucet claim failed. Please try again.']);
    }
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();
$balance = $user['balance'] ?? 0;

$stmt = $pdo->prepare("SELECT COALESCE(SUM(reward), 0) FROM completed_offers WHERE user_id = ? AND reward > 0 AND (status = 'completed' OR status IS NULL)");
$stmt->execute([$user_id]);
$total_earned = $stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE referred_by = ?");
$stmt->execute([$user_id]);
$total_referrals = $stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COALESCE(SUM(commission), 0) FROM referral_earnings WHERE user_id = ?");
$stmt->execute([$user_id]);
$total_ref_earnings = $stmt->fetchColumn();

$installedAddons = [];

$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$allowed_limits = [10, 20, 50, 100];
$limit = isset($_GET['limit']) && in_array((int)$_GET['limit'], $allowed_limits) ? (int)$_GET['limit'] : 10;
$offset = ($page - 1) * $limit;

$stmtCount = $pdo->prepare("
    SELECT sum(c) FROM (
        SELECT COUNT(*) as c FROM completed_offers WHERE user_id = :uid
        UNION ALL
        SELECT COUNT(*) as c FROM referral_earnings WHERE user_id = :uid
    ) as t
");
$stmtCount->execute(['uid' => $user_id]);
$total_records = $stmtCount->fetchColumn();
$total_pages = ceil($total_records / $limit);

$offerNameCol = "'Activity Reward'";
$statusCol = "'completed'";
try {
    $rs = $pdo->query("SELECT * FROM completed_offers LIMIT 0");
    $cols = [];
    for ($i = 0; $i < $rs->columnCount(); $i++) {
        $col = $rs->getColumnMeta($i);
        $cols[] = $col['name'];
    }
    if (in_array('offer_name', $cols)) $offerNameCol = "offer_name";
    elseif (in_array('source', $cols)) $offerNameCol = "source";
    elseif (in_array('provider', $cols)) $offerNameCol = "provider";
    
    if (in_array('status', $cols)) $statusCol = "status";
} catch (Exception $e) {}

$stmt = $pdo->prepare("
    (SELECT 'offer' as type, reward as amount, created_at, COALESCE($offerNameCol, 'Activity Reward') as details, $statusCol as status 
     FROM completed_offers WHERE user_id = :uid)
    UNION ALL
    (SELECT 'referral' as type, commission as amount, created_at, 'Referral Commission' as details, 'completed' as status 
     FROM referral_earnings WHERE user_id = :uid)
    ORDER BY created_at DESC 
    LIMIT $limit OFFSET $offset
");
$stmt->execute(['uid' => $user_id]);
$history = $stmt->fetchAll(PDO::FETCH_ASSOC);

$coupon_ads = [];
$coupon_ad_networks = ['monetag', 'adsgram', 'adexora', 'gigapub'];
foreach ($coupon_ad_networks as $net) {
    if (getSetting('coupon_ad_' . $net) != '1') continue;
    if (getSetting('ad_' . $net . '_status') != '1') continue;
    $ad = ['type' => $net];
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
    $coupon_ads[] = $ad;
}
shuffle($coupon_ads);
$coupon_ads_count = count($coupon_ads);
$coupon_required_ads = max(1, (int)(getSetting('coupon_required_ads') ?: 1));
if ($coupon_ads_count > 0) {
    $_SESSION['home_coupon_ad_token'] = bin2hex(random_bytes(16));
}
$home_coupon_ad_token = $_SESSION['home_coupon_ad_token'] ?? '';
?>
<div class="animate-[fadeIn_0.4s_ease-out]">
    <div class="mb-6">
        <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">
            Welcome back, <span class="text-brand-primary"><?php echo htmlspecialchars($user['username']); ?></span>! 👋
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Here's an overview of your account statistics.</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/30 relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div class="relative z-10 flex flex-col h-full justify-between">
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 ring-1 ring-white/10">
                    <i class="fas fa-wallet text-xl"></i>
                </div>
                <div>
                    <p class="text-violet-100 text-xs font-bold uppercase tracking-wider mb-1">Current Balance</p>
                    <h3 class="text-2xl font-black tracking-tight">
                        <?php echo number_format($balance, 2); ?> <span class="text-sm font-normal opacity-80"><?php echo htmlspecialchars($currency); ?></span>
                    </h3>
                </div>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
            <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
                <i class="fas fa-arrow-trend-up text-xl"></i>
            </div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Earned</p>
                <h3 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    <?php echo number_format($total_earned, 2); ?>
                </h3>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
            <div class="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mb-3">
                <i class="fas fa-users text-xl"></i>
            </div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Referrals</p>
                <h3 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    <?php echo number_format($total_referrals); ?>
                </h3>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
            <div class="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center mb-3">
                <i class="fas fa-hand-holding-dollar text-xl"></i>
            </div>
            <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Ref Earnings</p>
                <h3 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    <?php echo number_format($total_ref_earnings, 2); ?>
                </h3>
            </div>
        </div>
    </div>

    <?php
    $faucet_status_val = getSetting('faucet_status');
    $faucet_enabled = ($faucet_status_val === '0') ? false : true;
    $faucet_cooldown = (int)(getSetting('faucet_cooldown') ?: 60);
    $faucet_min = (int)(getSetting('faucet_reward_min') ?: 1);
    $faucet_max = (int)(getSetting('faucet_reward_max') ?: 50);
    if ($faucet_max < $faucet_min) $faucet_max = $faucet_min;
    $faucet_reward_label = $faucet_min . '-' . $faucet_max;
    $faucet_remaining = 0;
    if ($faucet_enabled) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS user_faucet_claims (user_id INT PRIMARY KEY, last_claim INT)");
            $fStmt = $pdo->prepare("SELECT last_claim FROM user_faucet_claims WHERE user_id = ?");
            $fStmt->execute([$user_id]);
            $last_claim = $fStmt->fetchColumn() ?: 0;
            $faucet_remaining = ($faucet_cooldown * 60) - (time() - $last_claim);
        } catch(Exception $e) {}
    }
    $faucet_ready = $faucet_remaining <= 0;

    $home_faucet_ads = [];
    if ($faucet_enabled && $faucet_ready) {
        $networks = ['monetag', 'adsgram', 'adexora', 'gigapub'];
        foreach ($networks as $net) {
            if (getSetting('ad_' . $net . '_status') != '1') continue;
            if (getSetting('ad_' . $net . '_faucet') != '1') continue;
            $ad = ['type' => $net];
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
            $home_faucet_ads[] = $ad;
        }
        shuffle($home_faucet_ads);
        $_SESSION['home_faucet_token'] = bin2hex(random_bytes(16));
    }
    $home_faucet_token = $_SESSION['home_faucet_token'] ?? '';
    $home_faucet_ads_count = count($home_faucet_ads);
    $faucet_required_ads = max(1, (int)(getSetting('faucet_required_ads') ?: 2));
    ?>

    <?php if($faucet_enabled): ?>
    <div class="mb-6">
        <?php if($faucet_ready): ?>
        <div class="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-violet-500 via-purple-500 to-cyan-400 p-[1px] shadow-xl shadow-violet-500/25">
            <div class="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-5 sm:p-6">
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-12 -left-12 w-36 h-36 bg-violet-400/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                    <div class="w-14 h-14 bg-white/10 border border-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
                        <i class="fas fa-droplet text-3xl text-cyan-200"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-black text-white text-xl tracking-tight">Hourly Faucet</h3>
                        <p class="text-indigo-100 text-sm font-semibold mt-1">Claim free points every hour</p>
                    </div>
                    <?php if($home_faucet_ads_count >= $faucet_required_ads): ?>
                    <button id="home-faucet-btn" type="button" onclick="window.claimHomeFaucet(event)" class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white text-indigo-700 font-black text-sm shadow-lg shadow-black/20 active:scale-95 hover:bg-cyan-50 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-video"></i>
                        <span>Claim Now (<?php echo $faucet_reward_label; ?> pts)</span>
                    </button>
                    <?php else: ?>
                    <button id="home-faucet-btn" type="button" disabled class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/20 text-white/60 font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-not-allowed">
                        <i class="fas fa-circle-exclamation"></i>
                        <span>Need <?php echo $faucet_required_ads; ?> Ads ON</span>
                    </button>
                    <?php endif; ?>
                </div>
                <div id="home-faucet-msg" class="relative mt-3 text-xs font-bold text-cyan-100 min-h-[18px]"><?php echo $home_faucet_ads_count >= $faucet_required_ads ? '' : 'Turn ON at least ' . $faucet_required_ads . ' faucet video ads in Ad Setup.'; ?></div>
            </div>
        </div>
        <?php else: ?>
        <div class="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gray-100 dark:bg-dark-700 rounded-xl flex items-center justify-center">
                    <i class="fas fa-droplet text-2xl text-gray-400"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-700 dark:text-gray-300 text-base">Hourly Faucet</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm font-semibold mt-1">Claim free points every hour</p>
                </div>
                <div class="bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-300 px-4 py-2.5 rounded-xl font-extrabold text-xs text-center">
                    Next claim in <span id="faucet-timer" class="text-brand-primary font-black"><?php echo gmdate($faucet_remaining >= 3600 ? 'H:i:s' : 'i:s', max(0, $faucet_remaining)); ?></span>
                </div>
            </div>
        </div>
        <script>
        (function(){
            var rem = <?php echo max(0, $faucet_remaining); ?>;
            var el = document.getElementById('faucet-timer');
            if(el && rem > 0) {
                var iv = setInterval(function(){
                    rem--;
                    if(rem <= 0){ clearInterval(iv); location.reload(); return; }
                    var h = Math.floor(rem/3600), m = Math.floor((rem%3600)/60), s = rem%60;
                    el.textContent = h > 0 ? String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0') : String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
                }, 1000);
            }
        })();
        </script>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <div class="mb-8">
        <div class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-[1px] shadow-xl shadow-orange-500/20">
            <div class="relative overflow-hidden rounded-[calc(2rem-1px)] bg-white dark:bg-dark-800 p-5 md:p-6">
                <div class="absolute -top-16 -right-12 w-44 h-44 bg-amber-400/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-20 -left-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div class="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr,1.3fr] gap-5 items-center">
                    <div class="flex items-start gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                            <i class="fas fa-ticket text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Coupon Reward</p>
                            <h3 class="text-2xl font-black text-gray-900 dark:text-white leading-tight">Have a code?</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 font-semibold mt-1">Enter your coupon and claim bonus <?php echo htmlspecialchars($currency); ?> instantly.</p>
                        </div>
                    </div>
                    <form id="home-coupon-form" onsubmit="return window.claimHomeCoupon(event)" class="relative">
                        <div id="home-coupon-card" class="flex flex-col sm:flex-row gap-3 rounded-3xl bg-gray-50 dark:bg-dark-900/80 border border-gray-200 dark:border-white/10 p-3 shadow-inner">
                            <div class="relative flex-1">
                                <i class="fas fa-gift absolute left-4 top-1/2 -translate-y-1/2 text-orange-400"></i>
                                <input id="home_coupon_code" type="text" autocomplete="off" placeholder="ENTER COUPON CODE" class="w-full h-14 pl-11 pr-4 rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all">
                            </div>
                            <?php if ($coupon_ads_count > 0): ?>
                            <button id="home_coupon_btn" type="submit" class="h-14 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-black shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                <i class="fas fa-video"></i>
                                <span>Redeem Code</span>
                            </button>
                            <?php else: ?>
                            <button id="home_coupon_btn" type="submit" class="h-14 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-black shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                <i class="fas fa-bolt"></i>
                                <span>Redeem Code</span>
                            </button>
                            <?php endif; ?>
                        </div>
                        <div id="home_coupon_msg" class="min-h-[22px] mt-3 text-xs font-black"></div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 class="text-lg font-extrabold text-gray-900 dark:text-white">Recent Activity</h3>
            
            <div class="flex items-center gap-2 bg-white dark:bg-dark-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Show:</span>
                <select onchange="window.changeHistoryLimit(this.value)" class="bg-transparent text-sm font-bold text-brand-primary outline-none cursor-pointer">
                    <option value="10" <?php echo $limit == 10 ? 'selected' : ''; ?>>10</option>
                    <option value="20" <?php echo $limit == 20 ? 'selected' : ''; ?>>20</option>
                    <option value="50" <?php echo $limit == 50 ? 'selected' : ''; ?>>50</option>
                    <option value="100" <?php echo $limit == 100 ? 'selected' : ''; ?>>100</option>
                </select>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
            
            <div class="flex-1">
                <?php if (empty($history)): ?>
                    <div class="p-8 text-center">
                        <div class="w-16 h-16 bg-gray-100 dark:bg-dark-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-clock-rotate-left text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-gray-500 dark:text-gray-400 font-medium">No recent activity found.</p>
                    </div>
                <?php else: ?>
                    <div class="divide-y divide-gray-100 dark:divide-white/5">
                        <?php foreach ($history as $act): 
                            $is_negative = $act['amount'] < 0;
                            $colorClass = $is_negative ? 'text-red-500' : 'text-emerald-500';
                            $sign = $is_negative ? '' : '+'; 
                            $icon = 'fa-coins';
                            
                            if ($act['type'] == 'offer') {
                                $icon = $is_negative ? 'fa-arrow-right-from-bracket' : 'fa-mouse-pointer';
                                if($is_negative) $act['details'] = 'Withdrawal Processed';
                            } else if ($act['type'] == 'referral') {
                                $icon = 'fa-user-plus';
                            }

                            $raw_status = strtolower($act['status'] ?? 'completed');
                            if ($raw_status === 'pending') {
                                $statusHtml = '<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 uppercase tracking-wider">Pending</span>';
                            } elseif ($raw_status === 'rejected') {
                                $statusHtml = '<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 uppercase tracking-wider">Rejected</span>';
                            } else {
                                $statusHtml = '<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 uppercase tracking-wider">Completed</span>';
                            }
                        ?>
                        <div class="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-900 flex-shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                    <i class="fas <?php echo $icon; ?>"></i>
                                </div>
                                <div>
                                    <div class="flex items-center mb-0.5">
                                        <p class="text-sm font-bold text-gray-900 dark:text-white capitalize"><?php echo htmlspecialchars($act['details']); ?></p>
                                        <?php echo $statusHtml; ?>
                                    </div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400"><?php echo date('M j, Y H:i', strtotime($act['created_at'])); ?></p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-bold <?php echo $colorClass; ?>">
                                    <?php echo $sign . number_format($act['amount'], 2); ?>
                                </p>
                                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest"><?php echo htmlspecialchars($currency); ?></p>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>

            <?php if ($total_pages > 1): ?>
            <div class="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark-900/50">
                
                <button onclick="window.goToPage(<?php echo $page - 1; ?>)" <?php echo $page <= 1 ? 'disabled' : ''; ?> 
                        class="px-3 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page <= 1 ? 'text-gray-400 bg-gray-100 dark:bg-dark-800 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                    <i class="fas fa-chevron-left"></i> Prev
                </button>

                <div class="flex items-center gap-1 hidden sm:flex">
                    <?php 
                    $start_page = max(1, $page - 2);
                    $end_page = min($total_pages, $page + 2);

                    if ($start_page > 1) {
                        echo '<button onclick="window.goToPage(1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">1</button>';
                        if ($start_page > 2) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                    }

                    for ($i = $start_page; $i <= $end_page; $i++) {
                        if ($i == $page) {
                            echo '<button class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-brand-primary text-white shadow-md shadow-brand-primary/30">'.$i.'</button>';
                        } else {
                            echo '<button onclick="window.goToPage('.$i.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">'.$i.'</button>';
                        }
                    }

                    if ($end_page < $total_pages) {
                        if ($end_page < $total_pages - 1) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                        echo '<button onclick="window.goToPage('.$total_pages.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">'.$total_pages.'</button>';
                    }
                    ?>
                </div>
                
                <div class="sm:hidden text-xs font-bold text-gray-500">
                    Page <?php echo $page; ?> of <?php echo $total_pages; ?>
                </div>

                <button onclick="window.goToPage(<?php echo $page + 1; ?>)" <?php echo $page >= $total_pages ? 'disabled' : ''; ?> 
                        class="px-3 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page >= $total_pages ? 'text-gray-400 bg-gray-100 dark:bg-dark-800 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
                
            </div>
            <?php endif; ?>

        </div>
    </div>
</div>

<script>
    window.currentHistoryLimit = <?php echo $limit ?? 10; ?>;
    
    window.navigateFromDashboard = function(url, tgNavIndex) {
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            let navItems = document.querySelectorAll('.nav-item');
            let targetNav = (tgNavIndex >= 0 && navItems.length > tgNavIndex) ? navItems[tgNavIndex] : null;
            tgLoadContent(url, targetNav);
        } else if (typeof loadContent === 'function') {
            loadContent(url);
        } else {
            console.error("Navigation functions not found");
        }
    };

    window.couponAds = <?php echo json_encode($coupon_ads ?? []); ?>;
    window.couponAdToken = <?php echo json_encode($home_coupon_ad_token ?? ''); ?>;
    window.couponAdWatched = 0;
    window.couponRequiredAds = <?php echo (int)($coupon_required_ads ?? 1); ?>;

    window.couponAdLoadScript = function(id, src, attrs) {
        return new Promise(function(resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) { resolve(); return; }
            var s = document.createElement('script');
            s.id = id;
            s.src = src;
            if (attrs) {
                Object.keys(attrs).forEach(function(k){ s.setAttribute(k, attrs[k]); });
            }
            s.onload = function(){ setTimeout(resolve, 900); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    };

    window.couponAdPrepare = function() {
        if (!window.couponAds) return;
        window.couponAds.forEach(function(ad) {
            try {
                if (ad.type === 'monetag') {
                    window.couponAdLoadScript('coupon-monetag-sdk-' + ad.zone_id, ad.script_url, {
                        'data-zone': ad.zone_id,
                        'data-sdk': 'show_' + ad.zone_id
                    }).catch(function(){});
                } else if (ad.type === 'adsgram') {
                    window.couponAdLoadScript('coupon-adsgram-sdk', 'https://sad.adsgram.ai/js/sad.min.js').catch(function(){});
                } else if (ad.type === 'adexora') {
                    window.couponAdLoadScript('coupon-adexora-sdk', 'https://adexora.com/cdn/ads.js?id=' + ad.app_id).catch(function(){});
                } else if (ad.type === 'gigapub') {
                    window.couponAdLoadScript('coupon-gigapub-sdk', 'https://ad.gigapub.tech/script?id=' + ad.project_id).catch(function(){});
                }
            } catch(e) {}
        });
    };
    window.couponAdPrepare();

    window.couponAdPlay = function(ad) {
        return new Promise(function(resolve, reject) {
            var settled = false;
            var failTimer = setTimeout(function(){ bad('timeout'); }, 60000);
            function ok(){ if (settled) return; settled = true; clearTimeout(failTimer); resolve(); }
            function bad(reason){ if (settled) return; settled = true; clearTimeout(failTimer); reject(new Error(reason || 'failed')); }

            try {
                if (ad.type === 'monetag') {
                    var runMonetag = function() {
                        var fn = window['show_' + ad.zone_id];
                        if (typeof fn !== 'function') { bad('monetag_not_ready'); return; }
                        Promise.resolve(fn({ ymid: 'coupon_' + Date.now() })).then(ok).catch(function(){ bad('monetag_closed'); });
                    };
                    window.couponAdLoadScript('coupon-monetag-sdk-' + ad.zone_id, ad.script_url, {
                        'data-zone': ad.zone_id,
                        'data-sdk': 'show_' + ad.zone_id
                    }).then(runMonetag).catch(function(){ bad('monetag_script'); });
                } else if (ad.type === 'adsgram') {
                    var runAdsgram = function() {
                        if (typeof window.Adsgram === 'undefined') { bad('adsgram_not_ready'); return; }
                        var ctrl = window.Adsgram.init({ blockId: ad.block_id });
                        ctrl.show().then(function(r){ if (r && r.done) ok(); else bad('adsgram_closed'); }).catch(function(){ bad('adsgram_closed'); });
                    };
                    window.couponAdLoadScript('coupon-adsgram-sdk', 'https://sad.adsgram.ai/js/sad.min.js').then(runAdsgram).catch(function(){ bad('adsgram_script'); });
                } else if (ad.type === 'adexora') {
                    var runAdexora = function() {
                        if (typeof window.showAdexora !== 'function') { bad('adexora_not_ready'); return; }
                        Promise.resolve(window.showAdexora()).then(ok).catch(function(){ bad('adexora_closed'); });
                    };
                    window.couponAdLoadScript('coupon-adexora-sdk', 'https://adexora.com/cdn/ads.js?id=' + ad.app_id).then(runAdexora).catch(function(){ bad('adexora_script'); });
                } else if (ad.type === 'gigapub') {
                    var runGiga = function() {
                        if (typeof window.showGiga !== 'function') { bad('gigapub_not_ready'); return; }
                        Promise.resolve(window.showGiga()).then(ok).catch(function(){ bad('gigapub_closed'); });
                    };
                    window.couponAdLoadScript('coupon-gigapub-sdk', 'https://ad.gigapub.tech/script?id=' + ad.project_id).then(runGiga).catch(function(){ bad('gigapub_script'); });
                } else {
                    bad('unknown_network');
                }
            } catch(e) {
                bad('exception');
            }
        });
    };

    window.couponAdShowAll = function() {
        return new Promise(function(resolve) {
            if (!window.couponAds || window.couponAds.length === 0) { resolve(); return; }
            var required = window.couponRequiredAds || 1;
            var completed = 0;
            var attempted = 0;
            var shuffled = window.couponAds.slice().sort(function(){ return Math.random() - 0.5; });

            var tryNext = function() {
                if (completed >= required) {
                    window.couponAdWatched = completed;
                    resolve();
                    return;
                }
                if (attempted >= shuffled.length) {
                    window.couponAdWatched = completed;
                    resolve();
                    return;
                }
                var ad = shuffled[attempted];
                attempted++;
                var msgEl = document.getElementById('home_coupon_msg');
                if (msgEl) msgEl.innerHTML = '<span class="text-orange-400"><i class="fas fa-video"></i> Watching ad ' + (completed + 1) + ' of ' + required + '...</span>';
                window.couponAdPlay(ad).then(function(){
                    completed++;
                    setTimeout(tryNext, 650);
                }).catch(function(){
                    setTimeout(tryNext, 500);
                });
            };
            tryNext();
        });
    };

    window.claimHomeCoupon = function(evt) {
        evt.preventDefault();
        const input = document.getElementById('home_coupon_code');
        const btn = document.getElementById('home_coupon_btn');
        const msg = document.getElementById('home_coupon_msg');
        const card = document.getElementById('home-coupon-card');
        if (!input || !btn) return false;
        const code = input.value.trim().toUpperCase();
        if (!code) {
            if (msg) msg.innerHTML = '<span class="text-rose-500"><i class="fas fa-circle-exclamation"></i> Please enter a coupon code.</span>';
            if (card) { card.classList.add('animate-pulse'); setTimeout(() => card.classList.remove('animate-pulse'), 600); }
            return false;
        }
        const original = btn.innerHTML;
        btn.disabled = true;

        var doRedeem = function() {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Claiming...</span>';
            if (msg) msg.innerHTML = '';
            const formData = new FormData();
            formData.append('code', code);
            if (window.couponAdToken) {
                formData.append('coupon_ad_token', window.couponAdToken);
            }
            fetch('./pages/load_dashboard.php?redeem_home_coupon=1', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Claimed</span>';
                    if (msg) msg.innerHTML = '<span class="text-emerald-500"><i class="fas fa-circle-check"></i> ' + (data.message || 'Coupon claimed successfully!') + '</span>';
                    input.value = '';
                    setTimeout(function(){
                        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
                            tgLoadContent('pages/load_dashboard.php', document.querySelectorAll('.nav-item')[0]);
                        } else if (typeof loadContent === 'function') {
                            loadContent('pages/load_dashboard.php');
                        } else {
                            location.reload();
                        }
                    }, 1200);
                } else {
                    throw new Error(data.message || 'Invalid coupon code.');
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.innerHTML = original;
                if (msg) msg.innerHTML = '<span class="text-rose-500"><i class="fas fa-circle-xmark"></i> ' + err.message + '</span>';
                if (card) { card.classList.add('ring-2','ring-rose-400'); setTimeout(() => card.classList.remove('ring-2','ring-rose-400'), 900); }
            });
        };

        var couponReq = window.couponRequiredAds || 1;
        if (window.couponAds && window.couponAds.length > 0 && window.couponAdWatched < couponReq) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading Ad...</span>';
            if (msg) msg.innerHTML = '<span class="text-orange-400"><i class="fas fa-video"></i> Watch ' + couponReq + ' ad(s) to claim your coupon...</span>';
            window.couponAdShowAll().then(function(){
                if (msg) msg.innerHTML = '';
                doRedeem();
            });
        } else {
            doRedeem();
        }
        return false;
    };

    window.changeHistoryLimit = function(newLimit) {
        let targetUrl = 'pages/load_dashboard.php?page=1&limit=' + newLimit;
        window.callDashboardLoader(targetUrl);
    };

    window.goToPage = function(pageNumber) {
        let targetUrl = 'pages/load_dashboard.php?page=' + pageNumber + '&limit=' + window.currentHistoryLimit;
        window.callDashboardLoader(targetUrl);
    };

    window.callDashboardLoader = function(url) {
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            let activeMenu = document.querySelector('.nav-item.active');
            tgLoadContent(url, activeMenu);
        } else if (typeof loadContent === 'function') {
            loadContent(url);
        } else {
            console.error("Loader function not found.");
        }
    };

    window.homeFaucetAds = <?php echo json_encode($home_faucet_ads ?? []); ?>;
    window.homeFaucetToken = <?php echo json_encode($home_faucet_token ?? ''); ?>;
    window.homeFaucetUserId = <?php echo (int)$user_id; ?>;

    window.homeFaucetSetMsg = function(html) {
        var msg = document.getElementById('home-faucet-msg');
        if (msg) msg.innerHTML = html;
    };

    window.homeFaucetLoadScript = function(id, src, attrs) {
        return new Promise(function(resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) { resolve(); return; }
            var s = document.createElement('script');
            s.id = id;
            s.src = src;
            if (attrs) {
                Object.keys(attrs).forEach(function(k){ s.setAttribute(k, attrs[k]); });
            }
            s.onload = function(){ setTimeout(resolve, 900); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    };

    window.homeFaucetPrepareAds = function() {
        if (!window.homeFaucetAds) return;
        window.homeFaucetAds.forEach(function(ad) {
            try {
                if (ad.type === 'monetag') {
                    window.homeFaucetLoadScript('home-monetag-sdk-' + ad.zone_id, ad.script_url, {
                        'data-zone': ad.zone_id,
                        'data-sdk': 'show_' + ad.zone_id
                    }).catch(function(){});
                } else if (ad.type === 'adsgram') {
                    window.homeFaucetLoadScript('home-adsgram-sdk', 'https://sad.adsgram.ai/js/sad.min.js').catch(function(){});
                } else if (ad.type === 'adexora') {
                    window.homeFaucetLoadScript('home-adexora-sdk', 'https://adexora.com/cdn/ads.js?id=' + ad.app_id).catch(function(){});
                } else if (ad.type === 'gigapub') {
                    window.homeFaucetLoadScript('home-gigapub-sdk', 'https://ad.gigapub.tech/script?id=' + ad.project_id).catch(function(){});
                }
            } catch(e) {}
        });
    };
    window.homeFaucetPrepareAds();

    window.homeFaucetPlayAd = function(ad, idx) {
        return new Promise(function(resolve, reject) {
            var settled = false;
            var failTimer = setTimeout(function(){ bad('timeout'); }, 60000);
            function ok(){ if (settled) return; settled = true; clearTimeout(failTimer); resolve(); }
            function bad(reason){ if (settled) return; settled = true; clearTimeout(failTimer); reject(new Error(reason || 'failed')); }

            try {
                if (ad.type === 'monetag') {
                    var runMonetag = function() {
                        var fn = window['show_' + ad.zone_id];
                        if (typeof fn !== 'function') { bad('monetag_not_ready'); return; }
                        Promise.resolve(fn({ ymid: 'home_faucet_' + window.homeFaucetUserId + '_' + Date.now() })).then(ok).catch(function(){ bad('monetag_closed'); });
                    };
                    window.homeFaucetLoadScript('home-monetag-sdk-' + ad.zone_id, ad.script_url, {
                        'data-zone': ad.zone_id,
                        'data-sdk': 'show_' + ad.zone_id
                    }).then(runMonetag).catch(function(){ bad('monetag_script'); });
                } else if (ad.type === 'adsgram') {
                    var runAdsgram = function() {
                        if (typeof window.Adsgram === 'undefined') { bad('adsgram_not_ready'); return; }
                        var ctrl = window.Adsgram.init({ blockId: ad.block_id });
                        ctrl.show().then(function(r){ if (r && r.done) ok(); else bad('adsgram_closed'); }).catch(function(){ bad('adsgram_closed'); });
                    };
                    window.homeFaucetLoadScript('home-adsgram-sdk', 'https://sad.adsgram.ai/js/sad.min.js').then(runAdsgram).catch(function(){ bad('adsgram_script'); });
                } else if (ad.type === 'adexora') {
                    var runAdexora = function() {
                        if (typeof window.showAdexora !== 'function') { bad('adexora_not_ready'); return; }
                        Promise.resolve(window.showAdexora()).then(ok).catch(function(){ bad('adexora_closed'); });
                    };
                    window.homeFaucetLoadScript('home-adexora-sdk', 'https://adexora.com/cdn/ads.js?id=' + ad.app_id).then(runAdexora).catch(function(){ bad('adexora_script'); });
                } else if (ad.type === 'gigapub') {
                    var runGiga = function() {
                        if (typeof window.showGiga !== 'function') { bad('gigapub_not_ready'); return; }
                        Promise.resolve(window.showGiga()).then(ok).catch(function(){ bad('gigapub_closed'); });
                    };
                    window.homeFaucetLoadScript('home-gigapub-sdk', 'https://ad.gigapub.tech/script?id=' + ad.project_id).then(runGiga).catch(function(){ bad('gigapub_script'); });
                } else {
                    bad('unknown_network');
                }
            } catch(e) {
                bad('exception');
            }
        });
    };

    window.claimHomeFaucet = function(evt) {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        var btn = document.getElementById('home-faucet-btn');
        if (!btn || btn.disabled) return false;
        var faucetRequiredAds = <?php echo (int)($faucet_required_ads ?? 2); ?>;
        if (!window.homeFaucetAds || window.homeFaucetAds.length < faucetRequiredAds) {
            window.homeFaucetSetMsg('');
            return false;
        }

        btn.disabled = true;
        var originalHtml = btn.innerHTML;
        var completed = 0;
        var attempted = 0;
        var shuffledAds = window.homeFaucetAds.slice().sort(function(){ return Math.random() - 0.5; });

        var creditReward = function(fallbackMode) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Crediting...</span>';
            var formData = new FormData();
            formData.append('faucet_token', window.homeFaucetToken || '');
                if (fallbackMode) formData.append('fallback_reward', '1');
            fetch('./pages/load_dashboard.php?claim_home_faucet=1', { method: 'POST', body: formData, credentials: 'same-origin' })
                .then(function(r){ return r.json(); })
                .then(function(data){
                    if (data.status === 'success') {
                        btn.innerHTML = '<i class="fas fa-check"></i><span>Claimed +' + data.reward + '</span>';
                        btn.className = 'w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-400 text-white font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2';
                        window.homeFaucetSetMsg('<span class="text-emerald-200">+' + data.reward + ' points added!</span>');
                        setTimeout(function(){
                            if (typeof tgLoadContent === 'function') {
                                tgLoadContent('pages/load_dashboard.php', document.querySelectorAll('.nav-item')[0]);
                            } else if (typeof loadContent === 'function') {
                                loadContent('pages/load_dashboard.php');
                            } else {
                                location.reload();
                            }
                        }, 1300);
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                        window.homeFaucetSetMsg('<span class="text-rose-200">' + (data.msg || 'Please try again') + '</span>');
                    }
                })
                .catch(function(){
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    window.homeFaucetSetMsg('<span class="text-rose-200">Network error. Try again.</span>');
                });
        };

        var tryNextAd = function() {
            if (completed >= faucetRequiredAds) { creditReward(false); return; }
            if (attempted >= shuffledAds.length) {
                creditReward(true);
                return;
            }
            var ad = shuffledAds[attempted];
            attempted++;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing...</span>';
            window.homeFaucetSetMsg('');
            window.homeFaucetPlayAd(ad, attempted).then(function(){
                completed++;
                window.homeFaucetSetMsg('');
                setTimeout(tryNextAd, 650);
            }).catch(function(){
                window.homeFaucetSetMsg('');
                setTimeout(tryNextAd, 700);
            });
        };

        tryNextAd();
        return false;
    };
</script>