<?php
session_start();
$step = isset($_GET['step']) ? (int)$_GET['step'] : 1;
$error = '';
$success = '';
$is_update_mode = file_exists('core/db.php');
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['install']) && !$is_update_mode) {
    $db_host = trim($_POST['db_host']);
    $db_name = trim($_POST['db_name']);
    $db_user = trim($_POST['db_user']);
    $db_pass = trim($_POST['db_pass']);
    $admin_pass = trim($_POST['admin_pass']);
    try {
        $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $sql = "
        CREATE TABLE IF NOT EXISTS `users` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `username` varchar(255) DEFAULT NULL,
          `wallet` varchar(255) DEFAULT NULL,
          `balance` decimal(16,8) DEFAULT '0.00000000',
          `ip_address` varchar(50) DEFAULT NULL,
          `is_admin` tinyint(1) DEFAULT '0',
          `is_banned` tinyint(1) DEFAULT '0',
          `ban_reason` varchar(255) DEFAULT NULL,
          `referred_by` int(11) DEFAULT NULL,
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `settings` (
          `key` varchar(50) NOT NULL,
          `value` text,
          PRIMARY KEY (`key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `completed_offers` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `trans_id` varchar(100) NOT NULL,
          `offer_name` varchar(255) NOT NULL,
          `offer_type` varchar(50) NOT NULL,
          `reward` decimal(16,8) NOT NULL,
          `payout` decimal(16,8) NOT NULL DEFAULT '0.00000000',
          `status` tinyint(4) NOT NULL DEFAULT '0',
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `trans_id` (`trans_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `price_cache` (
          `coin` varchar(20) NOT NULL,
          `price` decimal(20,8) NOT NULL,
          `updated_at` int(11) NOT NULL,
          PRIMARY KEY (`coin`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `referral_earnings` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `referred_id` int(11) NOT NULL,
          `source_type` varchar(50) NOT NULL,
          `source_reward` decimal(16,8) NOT NULL,
          `commission` decimal(16,8) NOT NULL,
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
        ('site_name', 'Telegram Mini-App'),
        ('site_subtitle', 'Complete PTC ads and earn crypto instantly.'),
        ('currency_name', 'Coins'),
        ('payment_gateway', 'faucetpay'),
        ('telegram_only_mode', '1'),
        ('bitcotask_api_key', ''),
        ('bitcotask_api_token', ''),
        ('admin_password', :admin_pass),
        ('min_withdrawal', '100'),
        ('exchange_rate', '1000'),
        ('faucetpay_currency', 'USDT'),
        ('allowed_coins', 'USDT,BTC,LTC'),
        ('custom_head_code', ''),
        ('custom_footer_code', ''),
        ('banner_top', ''),
        ('banner_bottom', ''),
        ('site_logo', ''),
        ('referral_commission', '10'),
        ('ban_mode', 'manual'),
        ('offer_approval_enabled', '0'),
        ('offer_approval_threshold', '0.1');
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['admin_pass' => $admin_pass]);
        $db_file_content = "<?php\n"
            . "\$db_host = '" . addslashes($db_host) . "';\n"
            . "\$db_name = '" . addslashes($db_name) . "';\n"
            . "\$db_user = '" . addslashes($db_user) . "';\n"
            . "\$db_pass = '" . addslashes($db_pass) . "';\n\n"
            . "try {\n"
            . "    \$pdo = new PDO(\"mysql:host=\$db_host;dbname=\$db_name;charset=utf8mb4\", \$db_user, \$db_pass);\n"
            . "    \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n"
            . "    \$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);\n"
            . "} catch (PDOException \$e) {\n"
            . "    die(\"Connection failed: \" . \$e->getMessage());\n"
            . "}\n\n"
            . "function getSetting(\$key) {\n"
            . "    global \$pdo;\n"
            . "    \$stmt = \$pdo->prepare(\"SELECT value FROM settings WHERE `key` = ?\");\n"
            . "    \$stmt->execute([\$key]);\n"
            . "    \$result = \$stmt->fetch();\n"
            . "    return \$result ? \$result['value'] : null;\n"
            . "}\n\n"
            . "function updateSetting(\$key, \$value) {\n"
            . "    global \$pdo;\n"
            . "    \$stmt = \$pdo->prepare(\"REPLACE INTO settings (`key`, `value`) VALUES (?, ?)\");\n"
            . "    \$stmt->execute([\$key, \$value]);\n"
            . "}\n"
            . "?>";
        if (file_put_contents('core/db.php', $db_file_content)) {
            $step = 2;
        } else {
            $error = "Failed to write to db.php. Please ensure your folder has write permissions (CHMOD 777 for db.php) or manually copy the code below.";
        }
    } catch (PDOException $e) {
        $error = "Database Error: " . $e->getMessage();
    }
}
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['update']) && $is_update_mode) {
    require_once 'core/db.php';
    try {
        $sql = "
        CREATE TABLE IF NOT EXISTS `users` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `username` varchar(255) DEFAULT NULL,
          `wallet` varchar(255) DEFAULT NULL,
          `balance` decimal(16,8) DEFAULT '0.00000000',
          `ip_address` varchar(50) DEFAULT NULL,
          `is_admin` tinyint(1) DEFAULT '0',
          `is_banned` tinyint(1) DEFAULT '0',
          `ban_reason` varchar(255) DEFAULT NULL,
          `referred_by` int(11) DEFAULT NULL,
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `settings` (
          `key` varchar(50) NOT NULL,
          `value` text,
          PRIMARY KEY (`key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `completed_offers` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `trans_id` varchar(100) NOT NULL,
          `offer_name` varchar(255) NOT NULL,
          `offer_type` varchar(50) NOT NULL,
          `reward` decimal(16,8) NOT NULL,
          `payout` decimal(16,8) NOT NULL DEFAULT '0.00000000',
          `status` tinyint(4) NOT NULL DEFAULT '0',
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `trans_id` (`trans_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `price_cache` (
          `coin` varchar(20) NOT NULL,
          `price` decimal(20,8) NOT NULL,
          `updated_at` int(11) NOT NULL,
          PRIMARY KEY (`coin`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `referral_earnings` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `referred_id` int(11) NOT NULL,
          `source_type` varchar(50) NOT NULL,
          `source_reward` decimal(16,8) NOT NULL,
          `commission` decimal(16,8) NOT NULL,
          `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
        ('site_name', 'Telegram Mini-App'),
        ('site_subtitle', 'Complete PTC ads and earn crypto instantly.'),
        ('currency_name', 'Coins'),
        ('payment_gateway', 'faucetpay'),
        ('telegram_only_mode', '1'),
        ('bitcotask_api_key', ''),
        ('bitcotask_api_token', ''),
        ('min_withdrawal', '100'),
        ('exchange_rate', '1000'),
        ('faucetpay_currency', 'USDT'),
        ('allowed_coins', 'USDT,BTC,LTC'),
        ('custom_head_code', ''),
        ('custom_footer_code', ''),
        ('banner_top', ''),
        ('banner_bottom', ''),
        ('site_logo', ''),
        ('referral_commission', '10'),
        ('telegram_bot_url', 'https://t.me/YourBotUser/app'),
        ('auto_coupon_enabled', '0'),
        ('auto_coupon_channel', ''),
        ('auto_coupon_prefix', 'DROP'),
        ('auto_coupon_reward', '10'),
        ('auto_coupon_max_uses', '50'),
        ('auto_coupon_expire_hours', '24'),
        ('auto_coupon_interval_minutes', '1440'),
        ('auto_coupon_req_offer_type', 'none'),
        ('auto_coupon_req_offer_amount', '0'),
        ('auto_coupon_req_timeframe', 'all_time'),
        ('auto_coupon_secret', ''),
        ('auto_coupon_channel', ''),
        ('auto_coupon_max_uses', '100'),
        ('auto_coupon_prefix', 'DAILY'),
        ('ban_mode', 'manual'),
        ('offer_approval_enabled', '0'),
        ('offer_approval_threshold', '0.1');
        ";
        // Force telegram-only mode and fresh bitcotasks defaults on every update too.
        $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES ('telegram_only_mode', '1')")->execute();
        $pdo->exec($sql);
        $checkRef = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'referred_by'");
        if ($checkRef->rowCount() == 0) {
            $pdo->exec("ALTER TABLE `users` ADD `referred_by` int(11) DEFAULT NULL AFTER `is_admin`");
        }
        $checkTg = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'telegram_id'");
        if ($checkTg->rowCount() == 0) {
            $pdo->exec("ALTER TABLE `users` ADD `telegram_id` varchar(100) DEFAULT NULL AFTER `referred_by`");
        }
        $checkBan = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'is_banned'");
        if ($checkBan->rowCount() == 0) {
            $pdo->exec("ALTER TABLE `users` ADD `is_banned` tinyint(1) DEFAULT '0' AFTER `is_admin`");
            $pdo->exec("ALTER TABLE `users` ADD `ban_reason` varchar(255) DEFAULT NULL AFTER `is_banned`");
        }
        $step = 2;
        $success = "Database updated successfully to the latest version. Your existing data was preserved.";
    } catch (Exception $e) {
        $error = "Update Error: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Installer - Faucet Script</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0f172a; color: #f8fafc; }
        .bg-grid {
            background-size: 40px 40px; position: fixed; inset: 0; z-index: -1; pointer-events: none;
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="bg-grid"></div>
    <div class="w-full max-w-xl animate-[fadeIn_0.5s_ease-out]">
        <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 mb-4 border border-indigo-500/30">
                <i class="fas fa-rocket text-2xl"></i>
            </div>
            <h1 class="text-3xl font-extrabold text-white mb-2">Weadev Installer</h1>
            <p class="text-slate-400">Setup your Weadev script in 1 minute.</p>
        </div>
        <div class="glass rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <?php if ($step === 1 && !$is_update_mode): ?>
                <?php if ($error): ?>
                    <div class="bg-red-500/10 border-l-4 border-red-500 text-red-400 p-4 rounded-r-xl mb-6 text-sm font-bold flex items-start gap-3">
                        <i class="fas fa-triangle-exclamation mt-0.5"></i> <span><?php echo $error; ?></span>
                    </div>
                <?php endif; ?>
                <form method="POST" class="space-y-5">
                    <div class="grid grid-cols-2 gap-5">
                        <div class="col-span-2">
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Database Host</label>
                            <input type="text" name="db_host" value="localhost" required class="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white outline-none font-mono text-sm">
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Database Name</label>
                            <input type="text" name="db_name" required placeholder="e.g. u123_faucet" class="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white outline-none font-mono text-sm">
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Database User</label>
                            <input type="text" name="db_user" required placeholder="e.g. u123_user" class="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white outline-none font-mono text-sm">
                        </div>
                        <div class="col-span-2">
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Database Password</label>
                            <input type="password" name="db_pass" required class="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white outline-none font-mono text-sm">
                        </div>
                    </div>
                    <hr class="border-slate-700 my-6">
                    <div>
                        <label class="block text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide"><i class="fas fa-shield-halved"></i> Create Admin Password</label>
                        <input type="text" name="admin_pass" required placeholder="Set a strong password" class="w-full px-4 py-3 bg-emerald-900/10 border border-emerald-500/30 rounded-xl focus:ring-2 focus:ring-emerald-500 text-white outline-none font-mono text-sm">
                        <p class="text-[11px] text-slate-500 mt-2">You will use this to login to the Admin Panel (yoursite.com/admin.php)</p>
                    </div>
                    <button type="submit" name="install" value="1" class="w-full mt-6 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-extrabold text-lg transition-all shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2">
                        <i class="fas fa-download"></i> Install Database
                    </button>
                </form>
            <?php elseif ($step === 1 && $is_update_mode): ?>
                <?php if ($error): ?>
                    <div class="bg-red-500/10 border-l-4 border-red-500 text-red-400 p-4 rounded-r-xl mb-6 text-sm font-bold flex items-start gap-3">
                        <i class="fas fa-triangle-exclamation mt-0.5"></i> <span><?php echo $error; ?></span>
                    </div>
                <?php endif; ?>
                <div class="text-center py-4">
                    <div class="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        <i class="fas fa-arrows-rotate"></i>
                    </div>
                    <h2 class="text-xl font-extrabold text-white mb-2">Update Available</h2>
                    <p class="text-slate-400 text-sm mb-6">Safe update mode is active. Your existing database connection works. Click the button below to update your database schema to the latest version without losing data.</p>
                    <form method="POST">
                        <button type="submit" name="update" value="1" class="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-extrabold text-lg transition-all shadow-lg flex justify-center items-center gap-2">
                            <i class="fas fa-cloud-arrow-up"></i> Safely Update Database
                        </button>
                    </form>
                </div>
            <?php elseif ($step === 2): ?>
                <div class="text-center py-8">
                    <div class="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-emerald-500/20 animate-bounce">
                        <i class="fas fa-check"></i>
                    </div>
                    <h2 class="text-2xl font-extrabold text-white mb-3">Complete!</h2>
                    <p class="text-slate-400 mb-8 text-sm">
                        <?php echo !empty($success) ? htmlspecialchars($success) : "The database has been imported and <strong>core/db.php</strong> has been successfully configured."; ?>
                    </p>
                    <div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-left mb-8">
                        <h4 class="text-rose-400 font-bold text-sm mb-2"><i class="fas fa-triangle-exclamation"></i> Security Warning</h4>
                        <p class="text-rose-300/80 text-xs leading-relaxed">
                            For security reasons, you <strong>MUST DELETE</strong> this <code>install.php</code> file from your server immediately. Leaving it may allow attackers to overwrite your database.
                        </p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <a href="index.php" class="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-colors">
                            View Website
                        </a>
                        <a href="admin.php" class="py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/30">
                            Go to Admin Panel
                        </a>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <div class="text-center mt-6 text-xs text-slate-600 font-medium">
            &copy; <?php echo date('Y'); ?> Telegram Mini-App. All rights reserved.
        </div>
    </div>
</body>
</html>