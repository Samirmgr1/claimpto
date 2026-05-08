<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

function generate_2fa_secret($length = 16) {
    $b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $s = '';
    for ($i = 0; $i < $length; $i++) $s .= $b32[mt_rand(0, 31)];
    return $s;
}

function verify_2fa_code($secret, $code) {
    if (empty($secret) || empty($code)) return false;
    $b32 = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));
    $secret = strtoupper($secret);
    $decoded = '';
    $l = strlen($secret);
    $n = 0; $j = 0;
    for ($i = 0; $i < $l; $i++) {
        if (!isset($b32[$secret[$i]])) continue;
        $n = $n << 5;
        $n = $n + $b32[$secret[$i]];
        $j = $j + 5;
        if ($j >= 8) {
            $j = $j - 8;
            $decoded .= chr(($n & (0xFF << $j)) >> $j);
        }
    }
    $time = floor(time() / 30);
    for ($i = -1; $i <= 1; $i++) {
        $t = pack('N*', 0) . pack('N*', $time + $i);
        $hash = hash_hmac('sha1', $t, $decoded, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $calc = (
            ((ord($hash[$offset+0]) & 0x7F) << 24) |
            ((ord($hash[$offset+1]) & 0xFF) << 16) |
            ((ord($hash[$offset+2]) & 0xFF) << 8) |
            (ord($hash[$offset+3]) & 0xFF)
        ) % pow(10, 6);
        if (str_pad($calc, 6, '0', STR_PAD_LEFT) === $code) return true;
    }
    return false;
}

if (isset($_POST['init_2fa'])) {
    $_SESSION['admin_temp_2fa'] = generate_2fa_secret();
}

if (isset($_POST['cancel_2fa_setup'])) {
    unset($_SESSION['admin_temp_2fa']);
}

if (isset($_POST['confirm_enable_2fa'])) {
    $temp_secret = $_SESSION['admin_temp_2fa'] ?? '';
    $code = $_POST['2fa_code'] ?? '';
    if (verify_2fa_code($temp_secret, $code)) {
        updateSetting('admin_2fa_secret', $temp_secret);
        unset($_SESSION['admin_temp_2fa']);
        $success = "2FA Authentication activated successfully.";
    } else {
        $addon_error = "Invalid verification code. Please try again.";
    }
}

if (isset($_POST['confirm_disable_2fa'])) {
    $saved_secret = getSetting('admin_2fa_secret');
    $code = $_POST['2fa_code'] ?? '';
    if (verify_2fa_code($saved_secret, $code)) {
        updateSetting('admin_2fa_secret', '');
        $success = "2FA Authentication disabled successfully.";
    } else {
        $addon_error = "Invalid verification code. Cannot disable 2FA.";
    }
}

if (isset($_POST['set_webhook'])) {
    foreach ($_POST['settings'] as $key => $value) {
        updateSetting($key, $value);
    }
    $token = trim($_POST['settings']['telegram_bot_token']);
    
    if (!empty($token)) {
        $webhookUrl = "https://" . $_SERVER['HTTP_HOST'] . "/bot_webhook.php";
        $apiUrl = "https://api.telegram.org/bot{$token}/setWebhook?url={$webhookUrl}";
        
        $ch = curl_init($apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $res = curl_exec($ch);
        curl_close($ch);
        $resData = json_decode($res, true);
        
        if (isset($resData['ok']) && $resData['ok']) {
            $success = "Webhook set successfully! Your bot is now active and ready to reply.";
        } else {
            $addon_error = "Failed to set Webhook: " . ($resData['description'] ?? 'Check your bot token.');
        }
    } else {
        $addon_error = "Please enter your Telegram Bot Token first.";
    }
}

if (isset($_POST['save_settings'])) {
    if (!empty($_POST['settings']['telegram_bot_token'])) {
        $token = trim($_POST['settings']['telegram_bot_token']);
        $ch = curl_init("https://api.telegram.org/bot" . $token . "/getMe");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $res = curl_exec($ch);
        curl_close($ch);
        $tg = json_decode($res, true);
        if (isset($tg['ok']) && $tg['ok']) {
            $_POST['settings']['telegram_bot_username'] = $tg['result']['username'];
        }
    }
    foreach ($_POST['settings'] as $key => $value) {
        updateSetting($key, $value);
    }
    if (!isset($success)) {
        $success = "Settings updated successfully!";
    }
}

if (isset($_POST['upload_logo']) && isset($_FILES['site_logo'])) {
    $file = $_FILES['site_logo'];
    $allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if ($file['error'] === UPLOAD_ERR_OK && in_array($file['type'], $allowed)) {
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'site_logo_' . time() . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $oldLogo = getSetting('site_logo');
        if ($oldLogo && file_exists(__DIR__ . '/../' . $oldLogo)) {
            @unlink(__DIR__ . '/../' . $oldLogo);
        }
        if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            updateSetting('site_logo', 'uploads/' . $filename);
            $success = "Logo uploaded successfully!";
        } else {
            $addon_error = "Failed to move uploaded file. Check folder permissions.";
        }
    } else {
        $addon_error = "Invalid file. Allowed: PNG, JPG, GIF, WEBP, SVG.";
    }
}

if (isset($_POST['remove_logo'])) {
    $oldLogo = getSetting('site_logo');
    if ($oldLogo && file_exists(__DIR__ . '/../' . $oldLogo)) {
        @unlink(__DIR__ . '/../' . $oldLogo);
    }
    updateSetting('site_logo', '');
    $success = "Logo removed.";
}
$site_logo = getSetting('site_logo') ?: '';
$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Admin Panel</title>
    <?php if (!empty($site_logo) && file_exists('../' . $site_logo)): ?>
    <link rel="icon" type="image/png" href="../<?php echo htmlspecialchars($site_logo); ?>" />
    <?php else: ?>
    <link rel="icon" type="image/png" href="data:," />
    <?php endif; ?>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#060913', 800: '#0F1320', 700: '#1A1F30' },
                        brand: { primary: '#8B5CF6', accent: '#22D3EE' }
                    }
                }
            }
        }
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    </script>
    <style>
        .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 211, 238, 0.08)); color: #A78BFA; font-weight: 700; border-right: 3px solid #8B5CF6; }
        .dark .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(34, 211, 238, 0.1)); }
        .bg-grid {
            background-size: 50px 50px;
            position: fixed; inset: 0; z-index: -2; pointer-events: none;
            background-image: linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
            mask-image: radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%);
        }
        .dark .bg-grid {
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        }
        html { scroll-behavior: smooth; }
        input, select, textarea { transition: all 0.3s ease; }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-dark-900 text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-300 font-sans flex overflow-x-hidden">
    <div class="bg-grid"></div>
    
    <div id="sidebar-overlay" class="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-300 md:hidden"></div>
    <aside id="sidebar" class="w-64 bg-white/95 dark:bg-dark-800/95 backdrop-blur-md border-r border-gray-200 dark:border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl md:shadow-lg transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
        <div class="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5">
            <div class="flex items-center gap-3">
                <i class="fas fa-shield-halved text-2xl text-brand-primary"></i>
                <div>
                    <span class="font-extrabold text-lg tracking-tight text-gray-900 dark:text-white block leading-tight">Weadev</span>
                    <span class="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">v1.7 Admin</span>
                </div>
            </div>
            <button id="close-sidebar-btn" class="md:hidden text-gray-400 hover:text-red-500 transition-colors">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <nav class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Overview</p>
            <a href="../admin.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-chart-line w-5 text-center"></i> Dashboard
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Management</p>
            <a href="users.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-users-gear w-5 text-center"></i> User Management
            </a>
            <a href="offers.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-clipboard-check w-5 text-center"></i> Offer Approval
            </a>
            <a href="withdrawals.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>
            <a href="admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="settings.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-gear w-5 text-center"></i> Settings
            </a>
            <a href="ad_setup.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-rectangle-ad w-5 text-center"></i> Ad Setup
            </a>
        </nav>
        <div class="p-4 border-t border-gray-100 dark:border-white/5 space-y-2">
            <a href="../index.php" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary dark:hover:bg-brand-primary/20 dark:hover:text-brand-primary rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400">
                <i class="fas fa-eye"></i> View Site
            </a>
            <a href="../admin.php?logout=1" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400">
                <i class="fas fa-right-from-bracket"></i> Logout
            </a>
        </div>
    </aside>
    <div class="flex-1 md:ml-64 flex flex-col min-h-screen relative z-10 w-full animate-[fadeInUp_0.4s_ease-out]">
        <header class="h-20 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
            <div class="md:hidden flex items-center gap-3">
                <button id="mobile-menu-btn" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">
                    <i class="fas fa-bars text-lg"></i>
                </button>
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2">
                    <i class="fas fa-shield-halved"></i> <span class="truncate max-w-[120px]">Weadev</span>
                </div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">System Settings</h1>
                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg">v1.7</span>
            </div>
            <div class="flex items-center gap-3 md:gap-4 ml-auto">
                <div class="hidden sm:flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <i class="fas fa-users"></i> <?php echo number_format($totalUsers); ?> Users
                </div>
                <button id="theme-toggle" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-700 transition-all">
                    <i id="theme-toggle-dark-icon" class="fa-solid fa-moon hidden"></i>
                    <i id="theme-toggle-light-icon" class="fa-solid fa-sun hidden"></i>
                </button>
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-dark-800">
                    <i class="fas fa-crown text-sm"></i>
                </div>
            </div>
        </header>
        <main class="flex-1 p-4 sm:p-6 md:p-8">
            <div class="w-full max-w-6xl mx-auto space-y-8">
                <?php if (isset($addon_success)): ?>
                    <div class="bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold text-lg">
                        <i class="fas fa-cloud-arrow-down text-2xl"></i> <?php echo $addon_success; ?>
                    </div>
                <?php endif; ?>
                <?php if (isset($addon_error)): ?>
                    <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold text-lg">
                        <i class="fas fa-circle-exclamation text-2xl"></i> <?php echo $addon_error; ?>
                    </div>
                <?php endif; ?>
                <?php if (isset($success)): ?>
                    <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold text-lg">
                        <i class="fas fa-check-circle text-2xl"></i> <?php echo $success; ?>
                    </div>
                <?php endif; ?>
                
                <form method="POST" enctype="multipart/form-data">
                    <div class="space-y-8">
                        <section id="branding">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-6 flex items-center gap-2"><i class="fas fa-palette"></i> Branding & Appearance</h3>
                                <div class="mb-6 p-5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide"><i class="fas fa-image text-brand-primary"></i> SITE LOGO</label>
                                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <?php $currentLogo = getSetting('site_logo'); ?>
                                        <div class="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center overflow-hidden bg-white dark:bg-dark-800 flex-shrink-0">
                                            <?php if (!empty($currentLogo) && file_exists('../' . $currentLogo)): ?>
                                                <img src="../<?php echo htmlspecialchars($currentLogo); ?>" alt="Logo" class="w-full h-full object-contain p-1">
                                            <?php else: ?>
                                                <i class="fas fa-image text-2xl text-gray-300 dark:text-gray-600"></i>
                                            <?php endif; ?>
                                        </div>
                                        <div class="flex-1 w-full">
                                            <div class="flex flex-col sm:flex-row gap-2">
                                                <input type="file" name="site_logo" accept="image/*" class="flex-1 text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer">
                                                <button type="submit" name="upload_logo" value="1" formnovalidate class="px-4 py-2 bg-brand-primary hover:bg-indigo-600 text-white rounded-lg font-bold text-sm transition-colors whitespace-nowrap">
                                                    <i class="fas fa-upload"></i> Upload
                                                </button>
                                            </div>
                                            <?php if (!empty($currentLogo) && file_exists('../' . $currentLogo)): ?>
                                            <div class="mt-2">
                                                <button type="submit" name="remove_logo" value="1" formnovalidate class="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1 transition-colors">
                                                    <i class="fas fa-trash-can"></i> Remove current logo
                                                </button>
                                            </div>
                                            <?php endif; ?>
                                            <p class="text-[10px] text-gray-400 mt-1">Recommended: 200x200px or larger. PNG, JPG, GIF, WEBP, SVG.</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">SITE NAME</label>
                                        <input type="text" name="settings[site_name]" value="<?php echo htmlspecialchars(getSetting('site_name')); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">CURRENCY NAME</label>
                                        <input type="text" name="settings[currency_name]" value="<?php echo htmlspecialchars(getSetting('currency_name')); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">SITE SUBTITLE (LANDING PAGE)</label>
                                        <textarea name="settings[site_subtitle]" rows="2" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium"><?php echo htmlspecialchars(getSetting('site_subtitle')); ?></textarea>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="telegram_bot">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                                <h3 class="text-lg font-extrabold text-blue-500 mb-6 flex items-center gap-2"><i class="fab fa-telegram"></i> Telegram Bot Management</h3>
                                
                                <div class="mb-6 p-5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                                    <h4 class="text-sm font-extrabold text-blue-700 dark:text-blue-400 mb-3"><i class="fas fa-book-open"></i> How to Create and Connect Your Bot</h4>
                                    <ol class="list-decimal list-inside text-xs text-blue-600 dark:text-blue-300 space-y-2 font-medium">
                                        <li>Open Telegram and search for <strong>@BotFather</strong>.</li>
                                        <li>Send <code>/newbot</code> to create your bot and copy the <strong>HTTP API Token</strong>.</li>
                                        <li>Paste the Token below, customize your <strong>Welcome Message</strong>, and click <strong class="text-emerald-500">Set Webhook & Save</strong>.</li>
                                        <li>In @BotFather, send <code>/mybots</code> -> select your bot -> <strong>Bot Settings -> Menu Button -> Configure Menu Button</strong>.</li>
                                        <li>Send the Web App URL below and name it "Open App" (or anything you like).</li>
                                    </ol>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">TELEGRAM BOT API TOKEN</label>
                                        <input type="text" name="settings[telegram_bot_token]" value="<?php echo htmlspecialchars(getSetting('telegram_bot_token')); ?>" placeholder="1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                    </div>
                                    <?php $tgUsername = getSetting('telegram_bot_username'); ?>
                                    <div class="md:col-span-1">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">BOT USERNAME</label>
                                        <input type="text" readonly value="<?php echo htmlspecialchars($tgUsername ? '@' . $tgUsername : 'Not Connected'); ?>" class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 font-bold outline-none cursor-not-allowed">
                                    </div>
                                    <div class="md:col-span-1">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">WEB APP URL (FOR BOTFATHER MENU)</label>
                                        <input type="text" readonly value="<?php echo 'https://' . $_SERVER['HTTP_HOST'] . '/telegram.php'; ?>" class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 font-bold outline-none cursor-all-scroll select-all">
                                    </div>
                                </div>

                                <div class="border-t border-gray-200 dark:border-white/10 pt-6 mt-6">
                                    <h4 class="text-md font-extrabold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                        <i class="fas fa-message text-blue-500"></i> Bot Start Message (Welcome Message)
                                    </h4>
                                    <div class="grid grid-cols-1 gap-5">
                                        <div>
                                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">MESSAGE TEXT (Supports HTML like &lt;b&gt; &lt;i&gt;)</label>
                                            <textarea name="settings[tg_welcome_message]" rows="7" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none font-medium"><?php 
                                                $defaultMsg = "👋 <b>Hello, {name}!</b>\n\nWelcome to <b>{site_name} App</b> — earn Coins by completing simple tasks!\n\n⚡️ <b>What you can do:</b>\n• Complete PTC ads to earn Coins\n• Withdraw earnings via FaucetPay\n• Invite friends and earn referral bonus\n\nMinimum withdraw: <b>100 Coins</b>\n\nTap the button below to get started 👇";
                                                echo htmlspecialchars(getSetting('tg_welcome_message') ?: $defaultMsg); 
                                            ?></textarea>
                                            <p class="text-[10px] text-gray-500 mt-1">Variables available: <code>{name}</code> = User's name, <code>{site_name}</code> = Your site name.</p>
                                        </div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">APP BUTTON TEXT</label>
                                                <input type="text" name="settings[tg_btn_app_text]" value="<?php echo htmlspecialchars(getSetting('tg_btn_app_text') ?: '🚀 Open App'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none font-medium">
                                            </div>
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">SUPPORT / HELP LINK</label>
                                                <input type="text" name="settings[tg_btn_help_url]" value="<?php echo htmlspecialchars(getSetting('tg_btn_help_url') ?: 'https://t.me/your_support'); ?>" placeholder="https://t.me/..." class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none font-medium">
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">TELEGRAM CHANNEL URL</label>
                                                <input type="text" name="settings[tg_channel_url]" value="<?php echo htmlspecialchars(getSetting('tg_channel_url') ?: ''); ?>" placeholder="https://t.me/yourchannel" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none font-medium">
                                                <p class="text-xs text-gray-400 mt-1">Replaces "Website" button with "Join Channel" in bot welcome message</p>
                                            </div>
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">MINI APP SHORT NAME</label>
                                                <input type="text" name="settings[telegram_app_shortname]" value="<?php echo htmlspecialchars(getSetting('telegram_app_shortname') ?: ''); ?>" placeholder="e.g. myapp" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none font-medium">
                                                <p class="text-xs text-gray-400 mt-1">Used for t.me/botname/appname links in coupon & lottery broadcasts</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-6 flex justify-end">
                                        <button type="submit" name="set_webhook" value="1" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30">
                                            <i class="fas fa-plug-circle-check"></i> Set Webhook & Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>




                        <section id="gateway">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-6 flex items-center gap-2"><i class="fas fa-money-bill-transfer"></i> Payment Gateway Setup</h3>
                                <div class="mb-6 bg-brand-primary/5 border border-brand-primary/20 p-5 rounded-xl">
                                    <label class="block text-sm font-extrabold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">ACTIVE WITHDRAWAL METHOD</label>
                                    <input type="hidden" name="settings[payment_gateway]" value="faucetpay">
                                    <div class="w-full px-4 py-3 bg-white dark:bg-dark-900 border border-brand-primary/30 rounded-xl text-brand-primary font-bold shadow-sm">
                                        FaucetPay (Requires Proxycheck API)
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div class="md:col-span-2 bg-amber-500/10 border border-amber-500/30 p-5 rounded-xl transition-all duration-300">
                                        <label class="block text-xs font-bold text-amber-700 dark:text-amber-500 mb-2 uppercase tracking-wide"><i class="fas fa-shield-halved"></i> Proxycheck.io API Key</label>
                                        <input type="text" name="settings[proxycheck_api_key]" value="<?php echo htmlspecialchars(getSetting('proxycheck_api_key')); ?>" placeholder="Enter Proxycheck API Key" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-amber-500/30 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                        <p class="text-xs text-amber-700/80 dark:text-amber-500/80 mt-2 font-medium">Required for FaucetPay to detect VPNs and prevent multi-accounting effectively.</p>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">FaucetPay API KEY</label>
                                        <input type="text" name="settings[faucetpay_api_key]" value="<?php echo htmlspecialchars(getSetting('faucetpay_api_key')); ?>" placeholder="Paste your FaucetPay API Key here" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">CURRENCY (e.g. USDT, BTC)</label>
                                        <input type="text" name="settings[faucetpay_currency]" value="<?php echo htmlspecialchars(getSetting('faucetpay_currency') ?: 'USDT'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">RATE (Coins per 1 USD)</label>
                                        <input type="number" name="settings[exchange_rate]" value="<?php echo htmlspecialchars(getSetting('exchange_rate') ?: '1000'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">MINIMUM WITHDRAWAL (In Coins)</label>
                                        <input type="number" step="0.01" name="settings[min_withdrawal]" value="<?php echo htmlspecialchars(getSetting('min_withdrawal') ?: '100'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">ALLOWED COINS (Comma separated)</label>
                                        <input type="text" name="settings[allowed_coins]" value="<?php echo htmlspecialchars(getSetting('allowed_coins') ?: 'USDT'); ?>" placeholder="e.g. BTC,USDT,LTC" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="api">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                                
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h3 class="text-lg font-extrabold text-brand-primary flex items-center gap-2">
                                        <i class="fas fa-network-wired"></i> Bitcotasks PTC API
                                    </h3>
                                    <a href="https://bitcotasks.com/documentations" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl text-xs font-bold transition-colors border border-blue-200 dark:border-blue-500/20">
                                        Get Credentials <i class="fas fa-external-link-alt text-[10px]"></i>
                                    </a>
                                </div>

                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                                    <i class="fas fa-info-circle text-blue-500 mr-1"></i> These settings connect your Telegram Mini-App with the <b>Bitcotasks PTC API</b> to fetch ads for your users. Postback / reward verification is handled by Bitcotasks on the ad page itself.
                                </p>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">BITCOTASKS API KEY</label>
                                        <input type="text" name="settings[bitcotask_api_key]" value="<?php echo htmlspecialchars(getSetting('bitcotask_api_key')); ?>" placeholder="Your Bitcotasks publisher API key" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                        <p class="text-[10px] text-gray-400 mt-1">Used in the request URL: /api/[API_KEY]/[USER_ID]/[USER_IP]</p>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">BEARER TOKEN</label>
                                        <input type="text" name="settings[bitcotask_api_token]" value="<?php echo htmlspecialchars(getSetting('bitcotask_api_token')); ?>" placeholder="Your Bitcotasks Bearer token" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                        <p class="text-[10px] text-amber-600 dark:text-amber-500 mt-1"><i class="fas fa-shield-alt"></i> Sent as the Authorization: Bearer header on every PTC request.</p>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">BITCOTASKS SECRET KEY</label>
                                        <input type="text" name="settings[bitcotask_secret_key]" value="<?php echo htmlspecialchars(getSetting('bitcotask_secret_key')); ?>" placeholder="Your Bitcotasks Secret Key (for postback signature verification)" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm">
                                        <p class="text-[10px] text-red-500 dark:text-red-400 mt-1"><i class="fas fa-key"></i> Required for postback signature verification. Find it in Bitcotasks → My Apps → Edit.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="security">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-500"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-6 flex items-center gap-2"><i class="fas fa-user-shield"></i> Admin Security</h3>
                                <div class="max-w-md mb-8">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">CHANGE ADMIN PASSWORD</label>
                                    <input type="password" name="settings[admin_password]" value="<?php echo htmlspecialchars(getSetting('admin_password')); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                </div>
                                <div class="border-t border-gray-200 dark:border-white/10 pt-6">
                                    <h4 class="text-md font-extrabold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                        <i class="fas fa-mobile-screen-button text-red-500"></i> Two-Factor Authentication (2FA)
                                    </h4>
                                    <?php 
                                    $admin_2fa_secret = getSetting('admin_2fa_secret'); 
                                    $temp_secret = $_SESSION['admin_temp_2fa'] ?? '';
                                    ?>
                                    
                                    <?php if(empty($admin_2fa_secret) && empty($temp_secret)): ?>
                                        <div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-5 max-w-2xl">
                                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">2FA is currently <b>DISABLED</b>. It is highly recommended to enable it.</p>
                                            <button type="submit" name="init_2fa" value="1" class="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                                                <i class="fas fa-qrcode"></i> Setup 2FA
                                            </button>
                                        </div>
                                        
                                    <?php elseif(!empty($temp_secret) && empty($admin_2fa_secret)): ?>
                                        <div class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-5 text-center sm:text-left flex flex-col sm:flex-row gap-6 max-w-2xl">
                                            <?php
                                            $sitename = rawurlencode(getSetting('site_name') ?: 'Admin_Panel');
                                            $otpauth_url = "otpauth://totp/{$sitename}?secret={$temp_secret}&issuer={$sitename}";
                                            $qr_url = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" . rawurlencode($otpauth_url);
                                            ?>
                                            <div class="flex-shrink-0">
                                                <img src="<?php echo $qr_url; ?>" alt="2FA QR Code" class="rounded-xl border border-gray-200 dark:border-white/10 p-2 bg-white inline-block">
                                            </div>
                                            <div class="flex flex-col justify-center w-full">
                                                <p class="text-sm font-extrabold text-blue-600 dark:text-blue-400 mb-2">
                                                    <i class="fas fa-spinner fa-spin"></i> 2FA Setup in Progress
                                                </p>
                                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Scan the QR code, then enter the 6-digit code below to verify and activate.</p>
                                                <div class="mb-4">
                                                    <input type="text" readonly value="<?php echo htmlspecialchars($temp_secret); ?>" class="w-full px-4 py-2 bg-white dark:bg-dark-800 border border-blue-200 dark:border-blue-500/20 rounded-lg text-blue-700 font-mono text-xs font-bold cursor-all-scroll select-all focus:outline-none mb-3">
                                                    <input type="text" name="2fa_code" placeholder="Enter 6-digit code" pattern="\d*" maxlength="6" autocomplete="off" class="w-full px-4 py-3 bg-white dark:bg-dark-900 border border-blue-200 dark:border-blue-500/30 rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-white outline-none transition-all font-mono text-center tracking-[0.5em] text-lg font-bold">
                                                </div>
                                                <div class="flex items-center gap-3">
                                                    <button type="submit" name="confirm_enable_2fa" value="1" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors">
                                                        <i class="fas fa-check"></i> Verify & Activate
                                                    </button>
                                                    <button type="submit" name="cancel_2fa_setup" value="1" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm transition-colors formnovalidate">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                    <?php elseif(!empty($admin_2fa_secret)): ?>
                                        <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-5 max-w-2xl">
                                            <p class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mb-4">
                                                <i class="fas fa-check-circle"></i> 2FA is <b>ENABLED</b> and protecting your account.
                                            </p>
                                            <div class="p-4 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl">
                                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide text-red-500">Disable 2FA</label>
                                                <p class="text-[10px] text-gray-500 mb-3">Enter your current 6-digit code to confirm deactivation.</p>
                                                <div class="flex flex-col sm:flex-row gap-3">
                                                    <input type="text" name="2fa_code" placeholder="123456" pattern="\d*" maxlength="6" autocomplete="off" class="flex-1 px-4 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-red-500/50 text-gray-900 dark:text-white outline-none transition-all font-mono text-center tracking-[0.5em] font-bold">
                                                    <button type="submit" name="confirm_disable_2fa" value="1" class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors whitespace-nowrap">
                                                        <i class="fas fa-lock-open"></i> Confirm Disable
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </section>

                        <section id="referral">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-fuchsia-500"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-2 flex items-center gap-2"><i class="fas fa-user-group"></i> Referral System</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure the referral commission percentage. When a referred user earns a reward, the referrer receives this percentage as a bonus.</p>
                                <?php
                                $totalRefEarnings = 0;
                                $totalRefUsers = 0;
                                try {
                                    $totalRefEarnings = $pdo->query("SELECT COALESCE(SUM(commission), 0) FROM referral_earnings")->fetchColumn();
                                    $totalRefUsers = $pdo->query("SELECT COUNT(DISTINCT referred_by) FROM users WHERE referred_by IS NOT NULL")->fetchColumn();
                                } catch (Exception $e) {}
                                ?>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div class="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl p-4">
                                        <div class="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">Active Referrers</div>
                                        <div class="text-2xl font-extrabold text-violet-700 dark:text-violet-300"><?php echo number_format($totalRefUsers); ?></div>
                                    </div>
                                    <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                                        <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Total Commission Paid</div>
                                        <div class="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300"><?php echo number_format($totalRefEarnings, 2); ?> <span class="text-sm font-medium opacity-70"><?php echo htmlspecialchars(getSetting('currency_name')); ?></span></div>
                                    </div>
                                </div>
                                <div class="max-w-md">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"><i class="fas fa-percent text-violet-500"></i> REFERRAL COMMISSION RATE (%)</label>
                                    <input type="number" step="0.1" min="0" max="100" name="settings[referral_commission]" value="<?php echo htmlspecialchars(getSetting('referral_commission') ?: '10'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium">
                                    <p class="text-[10px] text-gray-400 mt-2">Set to 0 to disable referral commissions. Example: 10 = referrer earns 10% of referred user's reward.</p>
                                </div>
                            </div>
                        </section>

                        <section id="customcode">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-2 flex items-center gap-2"><i class="fas fa-file-code"></i> Custom Code Injection</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Inject custom HTML, CSS, or JavaScript into the user-facing pages. Useful for analytics, tracking pixels, meta tags, or ad scripts.</p>
                                <div class="space-y-5">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"><i class="fas fa-arrow-up text-emerald-500"></i> HEAD CODE (Inside &lt;head&gt;)</label>
                                        <textarea name="settings[custom_head_code]" rows="5" placeholder="" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm leading-relaxed"><?php echo htmlspecialchars(getSetting('custom_head_code')); ?></textarea>
                                        <p class="text-[10px] text-gray-400 mt-1">This code will be inserted right before the closing <code class="bg-gray-200 dark:bg-dark-700 px-1 rounded">&lt;/head&gt;</code> tag.</p>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"><i class="fas fa-arrow-down text-teal-500"></i> FOOTER CODE (Before &lt;/body&gt;)</label>
                                        <textarea name="settings[custom_footer_code]" rows="5" placeholder="" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm leading-relaxed"><?php echo htmlspecialchars(getSetting('custom_footer_code')); ?></textarea>
                                        <p class="text-[10px] text-gray-400 mt-1">This code will be inserted right before the closing <code class="bg-gray-200 dark:bg-dark-700 px-1 rounded">&lt;/body&gt;</code> tag.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="banners">
                            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-pink-500"></div>
                                <h3 class="text-lg font-extrabold text-brand-primary mb-2 flex items-center gap-2"><i class="fas fa-rectangle-ad"></i> Banner Management</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Add advertisement banners or custom HTML that will display on the user-facing pages. Supports raw HTML, ad network scripts (e.g. Google AdSense), or image banners.</p>
                                <div class="space-y-5">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"><i class="fas fa-arrow-up text-orange-500"></i> TOP BANNER (Above Content)</label>
                                        <textarea name="settings[banner_top]" rows="4" placeholder='<a href="https://example.com"><img src="banner.jpg" style="width:100%"></a>' class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm leading-relaxed"><?php echo htmlspecialchars(getSetting('banner_top')); ?></textarea>
                                        <p class="text-[10px] text-gray-400 mt-1">Displayed at the top of the main content area, visible to logged-in users.</p>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"><i class="fas fa-arrow-down text-pink-500"></i> BOTTOM BANNER (Below Content)</label>
                                        <textarea name="settings[banner_bottom]" rows="4" placeholder='<a href="https://example.com"><img src="banner.jpg" style="width:100%"></a>' class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-mono text-sm leading-relaxed"><?php echo htmlspecialchars(getSetting('banner_bottom')); ?></textarea>
                                        <p class="text-[10px] text-gray-400 mt-1">Displayed at the bottom of the main content area, visible to logged-in users.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div class="sticky bottom-6 z-50">
                            <button type="submit" name="save_settings" value="1" class="w-full py-5 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-brand-primary text-white rounded-2xl font-extrabold text-xl transition-all shadow-xl shadow-brand-primary/40 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                                <i class="fas fa-save"></i> Save Configuration
                            </button>
                        </div>
                    </div>
                </form>

                
                <section id="dev">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 to-gray-600"></div>
                        <h3 class="text-lg font-extrabold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><i class="fas fa-code"></i> Developer Resources</h3>
                        <div class="space-y-3">
                            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-gray-50 dark:bg-dark-900 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                                <span class="text-sm font-bold text-gray-600 dark:text-gray-400">Postback URL</span>
                                <span class="text-xs bg-gray-200 dark:bg-black/50 text-brand-primary px-3 py-1.5 rounded-lg font-mono break-all">.../postback.php</span>
                            </div>
                            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-gray-50 dark:bg-dark-900 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                                <span class="text-sm font-bold text-gray-600 dark:text-gray-400">Bitcotasks PTC</span>
                                <span class="text-xs bg-gray-200 dark:bg-black/50 text-brand-primary px-3 py-1.5 rounded-lg font-mono break-all">https://bitcotasks.com/api/[KEY]/[USER_ID]/[IP]</span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                            <i class="fas fa-circle-exclamation text-amber-500"></i> Bitcotasks handles ad reward verification on its own pages, no postback URL is required for PTC.
                        </p>
                    </div>
                </section>
                
                <div class="text-center py-6 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev v1.7 &mdash; Admin Panel
                </div>
            </div>
        </main>
    </div>
    <script>
        const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
        const themeToggleBtn = document.getElementById('theme-toggle');
        
        if (themeToggleDarkIcon) {
            if (document.documentElement.classList.contains('dark')) {
                themeToggleLightIcon.classList.remove('hidden');
            } else {
                themeToggleDarkIcon.classList.remove('hidden');
            }
        }
        
        function doToggleTheme() {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            }
            if (themeToggleDarkIcon) {
                themeToggleDarkIcon.classList.toggle('hidden');
                themeToggleLightIcon.classList.toggle('hidden');
            }
        }
        
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', doToggleTheme);
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        
        function toggleSidebar() {
            if (!sidebar) return;
            sidebar.classList.toggle('-translate-x-full');
            if (sidebar.classList.contains('-translate-x-full')) {
                overlay.classList.remove('opacity-100');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            } else {
                overlay.classList.remove('hidden');
                setTimeout(() => overlay.classList.add('opacity-100'), 10);
            }
        }
        
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);
    </script>
</body>
</html>