<?php
define('AOY_APP', true);
session_start();
require_once '../core/db.php';
require_once '../core/coupon_auto.php';

if (!function_exists('getSetting')) {
    function getSetting($key) {
        global $pdo;
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = ?");
        $stmt->execute([$key]);
        return $stmt->fetchColumn();
    }
}
if (!function_exists('updateSetting')) {
    function updateSetting($key, $value) {
        global $pdo;
        $stmt = $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");
        $stmt->execute([$key, $value]);
    }
}
$currency = getSetting('currency_name') ?? 'Coins';

if (!isset($_SESSION['admin_logged_in'])) {
    header("Location: ../admin.php");
    exit();
}

try {
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
} catch (Exception $e) {}

if (!getSetting('auto_coupon_secret')) {
    updateSetting('auto_coupon_secret', bin2hex(random_bytes(16)));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'save_auto_coupon_settings') {
        $autoFields = [
            'auto_coupon_enabled',
            'auto_coupon_channel',
            'auto_coupon_prefix',
            'auto_coupon_reward',
            'auto_coupon_max_uses',
            'auto_coupon_expire_hours',
            'auto_coupon_interval_minutes',
            'auto_coupon_req_offer_type',
            'auto_coupon_req_offer_amount',
            'auto_coupon_req_timeframe',
            'auto_coupon_message',
            'auto_coupon_secret'
        ];
        foreach ($autoFields as $field) {
            $value = $_POST[$field] ?? '';
            if ($field === 'auto_coupon_enabled') $value = isset($_POST[$field]) ? '1' : '0';
            updateSetting($field, $value);
        }
        $success = "Auto coupon settings saved successfully!";
    } elseif ($_POST['action'] === 'send_auto_coupon_now') {
        $result = couponCreateAutoCoupon(true);
        if (!empty($result['success'])) {
            $success = "Auto coupon sent successfully! Code: " . htmlspecialchars($result['code']);
        } else {
            $error = $result['message'] ?? "Could not send auto coupon.";
        }
    } elseif ($_POST['action'] === 'add_coupon') {
        $code = strtoupper(trim($_POST['code']));
        $reward = (float)$_POST['reward'];
        $max_uses = (int)$_POST['max_uses'];
        $req_offer_type = $_POST['req_offer_type'];
        $req_offer_amount = (float)$_POST['req_offer_amount'];
        $req_timeframe = $_POST['req_timeframe'];
        $expires_at = !empty($_POST['expires_at']) ? date('Y-m-d H:i:s', strtotime($_POST['expires_at'])) : null;

        if (!empty($code) && $reward > 0) {
            try {
                $stmt = $pdo->prepare("INSERT INTO addon_coupons (code, reward, max_uses, req_offer_type, req_offer_amount, req_timeframe, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$code, $reward, $max_uses, $req_offer_type, $req_offer_amount, $req_timeframe, $expires_at]);
                $success = "Promo code '$code' created successfully!";
            } catch (PDOException $e) {
                $error = "Code already exists or database error.";
            }
        } else {
            $error = "Code and Reward are required.";
        }
    } elseif ($_POST['action'] === 'delete_coupon') {
        $id = (int)$_POST['coupon_id'];
        $pdo->prepare("DELETE FROM addon_coupons WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM addon_coupon_logs WHERE coupon_id = ?")->execute([$id]);
        $success = "Coupon deleted successfully!";
    }
}

$stmt = $pdo->query("SELECT * FROM addon_coupons ORDER BY id DESC");
$coupons = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coupon System - Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = { darkMode: 'class', theme: { extend: { fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] } } } }
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
        
        function toggleReqFields(val) {
            const displayStyle = val === 'none' ? 'none' : 'block';
            document.getElementById('req_amt_div').style.display = displayStyle;
            document.getElementById('req_time_div').style.display = displayStyle;
        }
    </script>
</head>
<body class="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-300 font-sans">
    <div class="max-w-7xl mx-auto p-4 md:p-8">
        
        <div class="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-4 px-6 flex justify-between items-center mb-8 shadow-sm border border-gray-200 dark:border-white/5">
            <div class="font-extrabold text-xl text-indigo-500 flex items-center gap-3">
                <i class="fas fa-ticket-alt text-2xl"></i> Promo Code Management
            </div>
            <a href="../admin.php" class="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-2">
                <i class="fas fa-arrow-left"></i> Back to Core
            </a>
        </div>

        <?php if (isset($success)): ?>
            <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl mb-8 font-bold flex items-center gap-3"><i class="fas fa-check-circle text-2xl"></i> <?php echo $success; ?></div>
        <?php endif; ?>
        <?php if (isset($error)): ?>
            <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl mb-8 font-bold flex items-center gap-3"><i class="fas fa-exclamation-triangle text-2xl"></i> <?php echo $error; ?></div>
        <?php endif; ?>

        <?php
            $autoEnabled = getSetting('auto_coupon_enabled') === '1';
            $autoSecret = getSetting('auto_coupon_secret') ?: '';
            $cronUrl = 'https://' . $_SERVER['HTTP_HOST'] . '/auto_coupon_cron.php?secret=' . urlencode($autoSecret);
            $lastSent = (int)(getSetting('auto_coupon_last_sent') ?: 0);
            $lastCode = getSetting('auto_coupon_last_code') ?: 'None yet';
        ?>
        <div class="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 mb-8 shadow-xl border border-gray-200 dark:border-white/5">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Telegram Automation</p>
                    <h3 class="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><i class="fab fa-telegram text-blue-500"></i> Auto Daily Coupon</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Automatically create one fixed-reward coupon and post it to your Telegram channel using your bot.</p>
                </div>
                <form method="POST">
                    <input type="hidden" name="action" value="send_auto_coupon_now">
                    <button type="submit" class="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-500/20 transition-all" onclick="return confirm('Create and send a coupon to Telegram now?');">
                        <i class="fas fa-paper-plane mr-2"></i> Generate & Send Now
                    </button>
                </form>
            </div>

            <form method="POST" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <input type="hidden" name="action" value="save_auto_coupon_settings">

                <label class="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10">
                    <input type="checkbox" name="auto_coupon_enabled" value="1" <?php echo $autoEnabled ? 'checked' : ''; ?> class="w-5 h-5 accent-orange-500">
                    <span class="font-bold">Enable Auto Drops</span>
                </label>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Telegram Channel ID / @username</label>
                    <input type="text" name="auto_coupon_channel" value="<?php echo htmlspecialchars(getSetting('auto_coupon_channel') ?: ''); ?>" placeholder="@yourchannel or -1001234567890" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Code Prefix</label>
                    <input type="text" name="auto_coupon_prefix" value="<?php echo htmlspecialchars(getSetting('auto_coupon_prefix') ?: 'DROP'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold uppercase">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Fixed Reward</label>
                    <input type="number" step="0.00000001" name="auto_coupon_reward" value="<?php echo htmlspecialchars(getSetting('auto_coupon_reward') ?: '10'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Max Claims</label>
                    <input type="number" min="1" name="auto_coupon_max_uses" value="<?php echo htmlspecialchars(getSetting('auto_coupon_max_uses') ?: '50'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Expire After Hours</label>
                    <input type="number" min="0" name="auto_coupon_expire_hours" value="<?php echo htmlspecialchars(getSetting('auto_coupon_expire_hours') ?: '24'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                    <p class="text-[10px] text-gray-400 mt-1">Use 0 for no expiry.</p>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Auto Interval Minutes</label>
                    <input type="number" min="1" name="auto_coupon_interval_minutes" value="<?php echo htmlspecialchars(getSetting('auto_coupon_interval_minutes') ?: '60'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Requirement</label>
                    <?php $autoReq = getSetting('auto_coupon_req_offer_type') ?: 'none'; ?>
                    <select name="auto_coupon_req_offer_type" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                        <option value="none" <?php echo $autoReq === 'none' ? 'selected' : ''; ?>>No Requirement</option>
                        <option value="count" <?php echo $autoReq === 'count' ? 'selected' : ''; ?>>Offers Completed</option>
                        <option value="value" <?php echo $autoReq === 'value' ? 'selected' : ''; ?>>Coins Earned</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Requirement Amount</label>
                    <input type="number" step="0.00000001" name="auto_coupon_req_offer_amount" value="<?php echo htmlspecialchars(getSetting('auto_coupon_req_offer_amount') ?: '0'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Requirement Timeframe</label>
                    <?php $autoTime = getSetting('auto_coupon_req_timeframe') ?: 'all_time'; ?>
                    <select name="auto_coupon_req_timeframe" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold">
                        <option value="all_time" <?php echo $autoTime === 'all_time' ? 'selected' : ''; ?>>All Time</option>
                        <option value="24_hours" <?php echo $autoTime === '24_hours' ? 'selected' : ''; ?>>Last 24 Hours</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Cron Secret</label>
                    <input type="text" name="auto_coupon_secret" value="<?php echo htmlspecialchars($autoSecret); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-xs font-bold">
                </div>

                <div class="md:col-span-2 xl:col-span-4">
                    <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Telegram Message Template</label>
                    <textarea name="auto_coupon_message" rows="4" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-sm"><?php echo htmlspecialchars(getSetting('auto_coupon_message') ?: "🎁 <b>{site_name} Coupon Drop!</b>\n\nCode: <code>{code}</code>\nReward: <b>{reward} {currency}</b>\nClaims: <b>{max_uses}</b> users\nExpires: <b>{expires}</b>\n\nOpen the app and claim it from the Home page!"); ?></textarea>
                    <p class="text-[11px] text-gray-500 mt-2 font-semibold">Available tags: {site_name}, {code}, {reward}, {currency}, {max_uses}, {expires}</p>
                </div>

                <div class="md:col-span-2 xl:col-span-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                    <p class="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2"><i class="fas fa-clock mr-1"></i> Cron URL</p>
                    <input type="text" readonly value="<?php echo htmlspecialchars($cronUrl); ?>" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-500/20 text-xs font-mono text-gray-600 dark:text-gray-300 select-all">
                    <p class="text-[11px] text-blue-600 dark:text-blue-300 mt-2">Set your hosting cron to hit this URL every 5 or 10 minutes. The script only posts when the interval has passed. Telegram posts include a Claim Now button.</p>
                    <p class="text-[11px] text-gray-500 mt-1">Last sent: <b><?php echo $lastSent ? date('Y-m-d H:i:s', $lastSent) : 'Never'; ?></b> | Last code: <b><?php echo htmlspecialchars($lastCode); ?></b></p>
                </div>

                <div class="md:col-span-2 xl:col-span-4 flex justify-end">
                    <button type="submit" class="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold shadow-lg shadow-orange-500/20 transition-all">
                        <i class="fas fa-save mr-2"></i> Save Auto Coupon Settings
                    </button>
                </div>
            </form>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-1">
                <form method="POST" class="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-xl border-t-4 border-t-indigo-500 border border-gray-200 dark:border-white/5">
                    <input type="hidden" name="action" value="add_coupon">
                    <h3 class="text-lg font-bold mb-6 flex items-center gap-2"><i class="fas fa-plus-circle text-indigo-500"></i> Create New Coupon</h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Coupon Code</label>
                            <input type="text" name="code" required placeholder="e.g. OFFER2026" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold uppercase">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Reward Amount (Balance)</label>
                            <input type="number" step="0.0001" name="reward" required placeholder="10.00" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Max Uses (Capacity)</label>
                            <input type="number" name="max_uses" required value="100" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold">
                        </div>
                        
                        <div class="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                            <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wide"><i class="fas fa-shield-alt"></i> Offerwall Requirement Type</label>
                            <select name="req_offer_type" onchange="toggleReqFields(this.value);" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-500/30 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-sm">
                                <option value="none">No Requirement (Free for all)</option>
                                <option value="count">Number of Offers Completed</option>
                                <option value="value">Total <?php echo $currency; ?> Earned</option>
                            </select>

                            <div id="req_amt_div" style="display:none;" class="mt-3">
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Required Amount / Count</label>
                                <input type="number" step="0.0001" name="req_offer_amount" value="0" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold">
                            </div>
                            <div id="req_time_div" style="display:none;" class="mt-3">
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Requirement Timeframe</label>
                                <select name="req_timeframe" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-sm">
                                    <option value="all_time">All Time (Lifetime)</option>
                                    <option value="24_hours">Last 24 Hours Only</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Expiry Date (Optional)</label>
                            <input type="datetime-local" name="expires_at" class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-sm">
                        </div>
                    </div>

                    <button type="submit" class="w-full mt-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2">
                        <i class="fas fa-magic"></i> Generate Code
                    </button>
                </form>
            </div>

            <div class="lg:col-span-2">
                <div class="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 dark:border-white/5 overflow-hidden">
                    <div class="p-6 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                        <h3 class="text-lg font-bold"><i class="fas fa-list text-gray-400 mr-2"></i> Active & Past Coupons</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm whitespace-nowrap">
                            <thead class="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th class="px-6 py-4">Code</th>
                                    <th class="px-6 py-4">Reward</th>
                                    <th class="px-6 py-4">Usage</th>
                                    <th class="px-6 py-4">Requirement</th>
                                    <th class="px-6 py-4">Status</th>
                                    <th class="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-white/5">
                                <?php if (count($coupons) > 0): ?>
                                    <?php foreach ($coupons as $c): 
                                        $isExpired = ($c['expires_at'] && strtotime($c['expires_at']) < time());
                                        $isFull = ($c['used_count'] >= $c['max_uses']);
                                        $statusClass = "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
                                        $statusText = "Active";
                                        if ($isFull) { $statusClass = "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"; $statusText = "Fully Claimed"; }
                                        if ($isExpired) { $statusClass = "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"; $statusText = "Expired"; }
                                        $timeBadge = ($c['req_timeframe'] === '24_hours' && $c['req_offer_type'] !== 'none') ? ' <span class="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[9px] ml-1">24H</span>' : '';
                                    ?>
                                    <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td class="px-6 py-4 font-black text-indigo-500 dark:text-indigo-400 tracking-wider"><?php echo htmlspecialchars($c['code']); ?></td>
                                        <td class="px-6 py-4 font-bold text-gray-900 dark:text-white"><?php echo rtrim(rtrim(sprintf('%.4f', $c['reward']), '0'), '.'); ?></td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-2">
                                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[50px]">
                                                    <div class="bg-indigo-500 h-1.5 rounded-full" style="width: <?php echo min(100, ($c['used_count'] / $c['max_uses']) * 100); ?>%"></div>
                                                </div>
                                                <span class="text-xs font-medium"><?php echo $c['used_count']; ?>/<?php echo $c['max_uses']; ?></span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-xs font-bold">
                                            <?php 
                                            if ($c['req_offer_type'] === 'count') {
                                                echo "<i class='fas fa-tasks text-amber-500'></i> " . round($c['req_offer_amount']) . " Offers" . $timeBadge;
                                            } elseif ($c['req_offer_type'] === 'value') {
                                                echo "<i class='fas fa-coins text-emerald-500'></i> " . number_format($c['req_offer_amount'], 4) . $timeBadge;
                                            } else {
                                                echo "<span class='text-gray-400'>None</span>";
                                            }
                                            ?>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider <?php echo $statusClass; ?>"><?php echo $statusText; ?></span>
                                        </td>
                                        <td class="px-6 py-4 text-right">
                                            <form method="POST" onsubmit="return confirm('Are you sure you want to delete this coupon? All claim history for this code will also be deleted.');">
                                                <input type="hidden" name="action" value="delete_coupon">
                                                <input type="hidden" name="coupon_id" value="<?php echo $c['id']; ?>">
                                                <button type="submit" class="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
                                                    <i class="fas fa-trash-alt"></i>
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php else: ?>
                                    <tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400 font-medium">No coupons created yet.</td></tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
</body>
</html>