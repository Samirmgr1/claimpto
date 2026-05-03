<?php
session_start();
require_once 'core/db.php';
require_once 'core/functions.php';

if (!isset($_SESSION['admin_logged_in']) && isset($_COOKIE['remember_admin'])) {
    $adminToken = $_COOKIE['remember_admin'];
    $adminPass = getSetting('admin_password');
    if ($adminPass && hash_equals($adminToken, md5($adminPass . 'admin_token'))) {
        $_SESSION['admin_logged_in'] = true;
    }
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

$admin_pass = getSetting('admin_password');

if (isset($_GET['cancel_2fa'])) {
    unset($_SESSION['admin_pending_2fa']);
    header("Location: admin.php");
    exit();
}

if (isset($_POST['login'])) {
    if ($_POST['password'] === $admin_pass) {
        $admin_2fa_secret = getSetting('admin_2fa_secret');
        if (isset($_POST['remember_admin']) && $_POST['remember_admin'] == '1') {
            $adminToken = md5($admin_pass . 'admin_token');
            setcookie('remember_admin', $adminToken, time() + (30 * 24 * 60 * 60), '/', '', false, true);
        }
        if (!empty($admin_2fa_secret)) {
            $_SESSION['admin_pending_2fa'] = true;
        } else {
            $_SESSION['admin_logged_in'] = true;
            header("Location: admin.php");
            exit();
        }
    } else {
        $error = "Incorrect password";
    }
} elseif (isset($_POST['verify_2fa'])) {
    $secret = getSetting('admin_2fa_secret');
    if (verify_2fa_code($secret, $_POST['2fa_code'])) {
        $_SESSION['admin_logged_in'] = true;
        unset($_SESSION['admin_pending_2fa']);
        setcookie('remember_admin', '', time() - 3600, '/');
        header("Location: admin.php");
        exit();
    } else {
        $error = "Invalid 2FA code. Please try again.";
        $_SESSION['admin_pending_2fa'] = true;
    }
}

if (isset($_GET['logout'])) {
    setcookie('remember_admin', '', time() - 3600, '/', '', false, true);
    unset($_SESSION['admin_logged_in']);
    unset($_SESSION['admin_pending_2fa']);
    unset($_SESSION['admin_temp_2fa']);
    session_destroy();
    header("Location: admin.php");
    exit();
}

$site_logo = getSetting('site_logo') ?: '';
$currencyName = getSetting('currency_name') ?: 'Coins';

$totalUsers = 0;
$totalEarned = 0;
$totalPaid = 0;
$activeBalance = 0;
$pendingCount = 0;
$days = [];
$usersData = [];
$rewardsData = [];

if (isset($_SESSION['admin_logged_in'])) {
    $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $totalEarned = $pdo->query("SELECT SUM(reward) FROM completed_offers WHERE reward > 0 AND status IN ('1', 'approved')")->fetchColumn() ?: 0;
    $totalPaid = $pdo->query("SELECT ABS(SUM(reward)) FROM completed_offers WHERE reward < 0 AND status = '1'")->fetchColumn() ?: 0;
    $activeBalance = $pdo->query("SELECT SUM(balance) FROM users")->fetchColumn() ?: 0;
    $pendingCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE status = '0' AND offer_type != 'WatchAd'")->fetchColumn();
    
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-$i days"));
        $days[] = date('M d', strtotime($date));
        $uStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?");
        $uStmt->execute([$date]);
        $usersData[] = (int)$uStmt->fetchColumn();
        $rStmt = $pdo->prepare("SELECT SUM(reward) FROM completed_offers WHERE DATE(created_at) = ? AND reward > 0 AND status IN ('1', 'approved', 'completed')");
        $rStmt->execute([$date]);
        $rewardsData[] = round((float)$rStmt->fetchColumn(), 2);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Weadev v1.7</title>
    <?php if (!empty($site_logo) && file_exists($site_logo)): ?>
    <link rel="icon" type="image/png" href="<?php echo htmlspecialchars($site_logo); ?>" />
    <?php else: ?>
    <link rel="icon" type="image/png" href="data:," />
    <?php endif; ?>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#060913', 800: '#0F1320', 700: '#1A1F30' },
                        brand: { primary: '#8B5CF6', accent: '#22D3EE', glow: '#A78BFA' }
                    }
                }
            }
        }
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        }
    </script>
    <style>
        .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 211, 238, 0.08)); color: #A78BFA; font-weight: 700; border-right: 3px solid #8B5CF6; }
        .dark .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(34, 211, 238, 0.1)); }
        .bg-grid { background-size: 50px 50px; position: fixed; inset: 0; z-index: -2; pointer-events: none; background-image: linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px); mask-image: radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%); }
        .dark .bg-grid { background-image: linear-gradient(to right, rgba(139, 92, 246, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 211, 238, 0.03) 1px, transparent 1px); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .glass-card { background: rgba(255,255,255,0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.3); }
        .dark .glass-card { background: rgba(15,19,32,0.7); border: 1px solid rgba(139,92,246,0.1); }
        .sidebar-glow::before { content: ''; position: absolute; top: 20%; right: 0; width: 1px; height: 60%; background: linear-gradient(to bottom, transparent, rgba(139, 92, 246, 0.5), transparent); }
    </style>
</head>
<body class="bg-gray-50 dark:bg-dark-900 text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-500 font-sans flex overflow-x-hidden">
    <div class="fixed top-0 left-1/4 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/2 dark:bg-brand-primary/5"></div>
    <div class="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none translate-y-1/2 dark:bg-brand-accent/5"></div>
    <div class="bg-grid"></div>

    <?php if (!isset($_SESSION['admin_logged_in'])): ?>
    <div class="w-full min-h-screen flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md animate-[fadeInUp_0.5s_ease-out]">
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-brand-primary/20 shadow-lg shadow-brand-primary/10">
                    <i class="fas fa-shield-halved text-3xl text-brand-primary"></i>
                </div>
                <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Weadev</h1>
                <div class="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-xs font-bold mb-3">
                    <i class="fas fa-tag"></i> Version 1.7
                </div>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Admin authentication required</p>
            </div>
            
            <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>
                <?php if (isset($error) && !empty($error)) echo "<div class='bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 text-red-700 dark:text-red-400 p-4 rounded-r-xl mb-6 flex items-start gap-3 shadow-sm'><i class='fas fa-triangle-exclamation mt-0.5 text-lg'></i><span class='text-sm font-bold'>$error</span></div>"; ?>
                
                <?php if (isset($_SESSION['admin_pending_2fa'])): ?>
                    <form method="POST" class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide text-center">Enter 2FA Code</label>
                            <div class="relative group">
                                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors">
                                    <i class="fas fa-mobile-screen-button"></i>
                                </div>
                                <input type="text" name="2fa_code" required placeholder="123456" pattern="\d*" maxlength="6" autocomplete="off" class="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none transition-all font-mono text-center tracking-[1em] text-2xl font-bold">
                            </div>
                            <p class="text-center text-xs text-gray-400 mt-2">Open your Google Authenticator or Authy app</p>
                        </div>
                        <button type="submit" name="verify_2fa" value="1" class="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-teal-600 hover:to-emerald-500 text-white rounded-xl font-extrabold text-lg transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transform hover:-translate-y-1 active:scale-95">
                            <i class="fas fa-shield-check"></i> Verify & Login
                        </button>
                        <div class="text-center mt-4">
                            <a href="?cancel_2fa=1" class="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"><i class="fas fa-arrow-left"></i> Cancel and go back</a>
                        </div>
                    </form>
                <?php else: ?>
                    <form method="POST" class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">ADMIN PASSWORD</label>
                            <div class="relative group">
                                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors">
                                    <i class="fas fa-lock"></i>
                                </div>
                                <input type="password" name="password" required placeholder="Enter admin password" class="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none transition-all font-medium">
                            </div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" name="remember_admin" value="1" class="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-2 focus:ring-brand-primary/50">
                            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">Remember this browser for 30 days</span>
                        </label>
                        <button type="submit" name="login" value="1" class="w-full py-4 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-brand-primary text-white rounded-xl font-extrabold text-lg transition-all shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2 transform hover:-translate-y-1 active:scale-95">
                            <i class="fas fa-right-to-bracket"></i> Unlock Panel
                        </button>
                    </form>
                <?php endif; ?>
            </div>
            
            <div class="flex items-center justify-center gap-4 mt-6">
                <button id="theme-toggle-login" class="w-10 h-10 rounded-full bg-white/80 dark:bg-dark-800/80 backdrop-blur border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-700 transition-all shadow-sm">
                    <i id="theme-icon-login" class="fa-solid fa-moon"></i>
                </button>
                <a href="index.php" class="text-gray-500 dark:text-gray-400 hover:text-brand-primary font-bold text-sm flex items-center gap-2 transition-colors">
                    <i class="fas fa-arrow-left"></i> Back to Site
                </a>
            </div>
        </div>
    </div>
    <script>
        const themeToggleLogin = document.getElementById('theme-toggle-login');
        const themeIconLogin = document.getElementById('theme-icon-login');
        if (themeIconLogin) {
            themeIconLogin.className = document.documentElement.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (themeToggleLogin) {
            themeToggleLogin.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark');
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
                themeIconLogin.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            });
        }
    </script>
    <?php else: ?>
    
    <div id="sidebar-overlay" class="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-300 md:hidden"></div>
    <aside id="sidebar" class="w-64 bg-white/95 dark:bg-dark-800/95 backdrop-blur-md border-r border-gray-200 dark:border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl md:shadow-lg transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
        <div class="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5">
            <div class="flex items-center gap-3">
                <i class="fas fa-shield-halved text-2xl text-brand-primary"></i>
                <div>
                    <span class="font-extrabold text-lg tracking-tight text-gray-900 dark:text-white block leading-tight">Weadev</span>
                    <span class="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">Admin</span>
                </div>
            </div>
            <button id="close-sidebar-btn" class="md:hidden text-gray-400 hover:text-red-500 transition-colors"><i class="fas fa-times text-xl"></i></button>
        </div>
        <nav class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Overview</p>
            <a href="admin.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-chart-line w-5 text-center"></i> Dashboard
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Management</p>
            <a href="admin/users.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-users-gear w-5 text-center"></i> User Management
            </a>
            <a href="admin/offers.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-clipboard-check w-5 text-center"></i> Offer Approval
            </a>
            <a href="admin/withdrawals.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="admin/lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>
            <a href="admin/admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="admin/settings.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-gear w-5 text-center"></i> Settings
            </a>
            <a href="admin/ad_setup.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-rectangle-ad w-5 text-center"></i> Ad Setup
            </a>
        </nav>
        <div class="p-4 border-t border-gray-100 dark:border-white/5 space-y-2">
            <a href="index.php" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary dark:hover:bg-brand-primary/20 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400"><i class="fas fa-eye"></i> View Site</a>
            <a href="admin.php?logout=1" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400"><i class="fas fa-right-from-bracket"></i> Logout</a>
        </div>
    </aside>

    <div class="flex-1 md:ml-64 flex flex-col min-h-screen relative z-10 w-full animate-[fadeInUp_0.4s_ease-out]">
        <header class="h-20 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
            <div class="md:hidden flex items-center gap-3">
                <button id="mobile-menu-btn" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400"><i class="fas fa-bars text-lg"></i></button>
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2"><i class="fas fa-chart-line"></i> <span class="truncate">Dashboard</span></div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <?php if ($pendingCount > 0): ?>
                <a href="admin/offers.php" class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg animate-pulse transition-colors"><?php echo $pendingCount; ?> Pending Offers</a>
                <?php endif; ?>
            </div>
            <div class="flex items-center gap-3 md:gap-4 ml-auto">
                <button id="theme-toggle" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-700 transition-all">
                    <i id="theme-toggle-dark-icon" class="fa-solid fa-moon hidden"></i>
                    <i id="theme-toggle-light-icon" class="fa-solid fa-sun hidden"></i>
                </button>
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-dark-800"><i class="fas fa-crown text-sm"></i></div>
            </div>
        </header>

        <main class="flex-1 p-4 sm:p-6 md:p-8">
            <div class="w-full max-w-7xl mx-auto space-y-6">

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 flex-wrap">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform min-w-[200px]">
                        <div class="absolute -right-4 -top-4 text-blue-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-users"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-users text-blue-500"></i> Total Users</div>
                        <div class="text-3xl font-extrabold text-gray-900 dark:text-white"><?php echo number_format($totalUsers); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform min-w-[200px]">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-chart-pie"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-chart-pie text-emerald-500"></i> Total Earned</div>
                        <div class="text-3xl font-extrabold text-emerald-500"><?php echo number_format($totalEarned, 2); ?> <span class="text-sm font-medium opacity-70"><?php echo htmlspecialchars($currencyName); ?></span></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform min-w-[200px]">
                        <div class="absolute -right-4 -top-4 text-amber-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-hand-holding-dollar"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-hand-holding-dollar text-amber-500"></i> Total Paid</div>
                        <div class="text-3xl font-extrabold text-amber-500"><?php echo number_format($totalPaid, 2); ?> <span class="text-sm font-medium opacity-70"><?php echo htmlspecialchars($currencyName); ?></span></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform min-w-[200px]">
                        <div class="absolute -right-4 -top-4 text-purple-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-wallet"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-wallet text-purple-500"></i> Pending Balance</div>
                        <div class="text-3xl font-extrabold text-purple-500"><?php echo number_format($activeBalance, 2); ?> <span class="text-sm font-medium opacity-70"><?php echo htmlspecialchars($currencyName); ?></span></div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm overflow-hidden hidden sm:block">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><i class="fas fa-coins text-emerald-500"></i> Rewards (Last 7 Days)</h3>
                        </div>
                        <div class="relative h-64 w-full">
                            <canvas id="rewardsChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm overflow-hidden sm:hidden w-full max-w-[100vw]">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><i class="fas fa-coins text-emerald-500"></i> Rewards (Last 7 Days)</h3>
                        </div>
                        <div class="relative h-64 w-[calc(100vw-3rem)]">
                            <canvas id="rewardsChartMob"></canvas>
                        </div>
                    </div>

                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm overflow-hidden hidden sm:block">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><i class="fas fa-user-plus text-brand-primary"></i> New Users (Last 7 Days)</h3>
                        </div>
                        <div class="relative h-64 w-full">
                            <canvas id="usersChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm overflow-hidden sm:hidden w-full max-w-[100vw]">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><i class="fas fa-user-plus text-brand-primary"></i> New Users (Last 7 Days)</h3>
                        </div>
                        <div class="relative h-64 w-[calc(100vw-3rem)]">
                            <canvas id="usersChartMob"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — Dashboard
                </div>
            </div>
        </main>
    </div>

    <script>
        const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
        const themeToggleBtn = document.getElementById('theme-toggle');
        
        function updateChartsTheme(isDark) {
            const textColor = isDark ? '#9ca3af' : '#6b7280';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
            if (window.myRewardsChart) {
                window.myRewardsChart.options.scales.x.ticks.color = textColor;
                window.myRewardsChart.options.scales.y.ticks.color = textColor;
                window.myRewardsChart.options.scales.x.grid.color = gridColor;
                window.myRewardsChart.options.scales.y.grid.color = gridColor;
                window.myRewardsChart.update();
            }
            if (window.myUsersChart) {
                window.myUsersChart.options.scales.x.ticks.color = textColor;
                window.myUsersChart.options.scales.y.ticks.color = textColor;
                window.myUsersChart.options.scales.x.grid.color = gridColor;
                window.myUsersChart.options.scales.y.grid.color = gridColor;
                window.myUsersChart.update();
            }
            if (window.myRewardsChartMob) {
                window.myRewardsChartMob.options.scales.x.ticks.color = textColor;
                window.myRewardsChartMob.options.scales.y.ticks.color = textColor;
                window.myRewardsChartMob.options.scales.x.grid.color = gridColor;
                window.myRewardsChartMob.options.scales.y.grid.color = gridColor;
                window.myRewardsChartMob.update();
            }
            if (window.myUsersChartMob) {
                window.myUsersChartMob.options.scales.x.ticks.color = textColor;
                window.myUsersChartMob.options.scales.y.ticks.color = textColor;
                window.myUsersChartMob.options.scales.x.grid.color = gridColor;
                window.myUsersChartMob.options.scales.y.grid.color = gridColor;
                window.myUsersChartMob.update();
            }
        }

        if (themeToggleDarkIcon) {
            if (document.documentElement.classList.contains('dark')) themeToggleLightIcon.classList.remove('hidden');
            else themeToggleDarkIcon.classList.remove('hidden');
        }
        
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', function() {
                themeToggleDarkIcon.classList.toggle('hidden');
                themeToggleLightIcon.classList.toggle('hidden');
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
                updateChartsTheme(isDark);
            });
        }
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        function toggleSidebar() {
            if (!sidebar) return;
            sidebar.classList.toggle('-translate-x-full');
            if (sidebar.classList.contains('-translate-x-full')) { overlay.classList.remove('opacity-100'); setTimeout(() => overlay.classList.add('hidden'), 300); }
            else { overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.add('opacity-100'), 10); }
        }
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);

        const labels = <?php echo json_encode($days); ?>;
        const rewardsData = <?php echo json_encode($rewardsData); ?>;
        const usersData = <?php echo json_encode($usersData); ?>;
        const isDarkInit = document.documentElement.classList.contains('dark');
        const initTextColor = isDarkInit ? '#9ca3af' : '#6b7280';
        const initGridColor = isDarkInit ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

        const getChartOptions = () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDarkInit ? '#1f2937' : '#ffffff',
                    titleColor: isDarkInit ? '#f3f4f6' : '#111827',
                    bodyColor: isDarkInit ? '#d1d5db' : '#4b5563',
                    borderColor: isDarkInit ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4,
                    usePointStyle: true
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: initTextColor, font: { family: '"Plus Jakarta Sans", sans-serif', size: 10 } }
                },
                y: {
                    border: { display: false },
                    grid: { color: initGridColor, drawBorder: false },
                    ticks: { color: initTextColor, font: { family: '"Plus Jakarta Sans", sans-serif', size: 10 }, maxTicksLimit: 5 }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        });

        window.addEventListener('load', function() {
            const ctxRewards = document.getElementById('rewardsChart').getContext('2d');
            const rewardsGrad = ctxRewards.createLinearGradient(0, 0, 0, 300);
            rewardsGrad.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
            rewardsGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

            window.myRewardsChart = new Chart(ctxRewards, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Earned (<?php echo htmlspecialchars($currencyName); ?>)',
                        data: rewardsData,
                        borderColor: '#10b981',
                        backgroundColor: rewardsGrad,
                        borderWidth: 2,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: getChartOptions()
            });

            const ctxUsers = document.getElementById('usersChart').getContext('2d');
            const usersGrad = ctxUsers.createLinearGradient(0, 0, 0, 300);
            usersGrad.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
            usersGrad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

            window.myUsersChart = new Chart(ctxUsers, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'New Users',
                        data: usersData,
                        borderColor: '#8B5CF6',
                        backgroundColor: usersGrad,
                        borderWidth: 2,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#8B5CF6',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: getChartOptions()
            });

            if(document.getElementById('rewardsChartMob')) {
                const ctxRMob = document.getElementById('rewardsChartMob').getContext('2d');
                window.myRewardsChartMob = new Chart(ctxRMob, {
                    type: 'line', data: { labels: labels, datasets: [{
                        label: 'Earned', data: rewardsData, borderColor: '#10b981', backgroundColor: rewardsGrad,
                        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
                    }] }, options: getChartOptions()
                });
            }
            if(document.getElementById('usersChartMob')) {
                const ctxUMob = document.getElementById('usersChartMob').getContext('2d');
                window.myUsersChartMob = new Chart(ctxUMob, {
                    type: 'line', data: { labels: labels, datasets: [{
                        label: 'New Users', data: usersData, borderColor: '#8B5CF6', backgroundColor: usersGrad,
                        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
                    }] }, options: getChartOptions()
                });
            }
        });
    </script>
    <?php endif; ?>
</body>
</html>