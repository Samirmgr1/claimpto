<?php
session_start();
require_once '../core/db.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

$success = '';
$error = '';
$uid = (int)($_GET['id'] ?? 0);
if ($uid <= 0) {
    header("Location: users.php");
    exit();
}

$currencyName = 'Coins';
try {
    $cnStmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = 'currency_name'");
    $cnStmt->execute();
    $cnResult = $cnStmt->fetch();
    if ($cnResult) $currencyName = $cnResult['value'];
} catch (Exception $e) {}

$site_logo = '';
try {
    $slStmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = 'site_logo'");
    $slStmt->execute();
    $slResult = $slStmt->fetch();
    if ($slResult) $site_logo = $slResult['value'];
} catch (Exception $e) {}

// Handle POST actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['update_profile'])) {
        $newWallet = trim($_POST['wallet'] ?? '');
        $newBalance = $_POST['balance'];
        $newBanned = isset($_POST['is_banned']) ? 1 : 0;
        $newBanReason = trim($_POST['ban_reason'] ?? '');

        // Fetch current balance to preserve if not changed
        $curStmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
        $curStmt->execute([$uid]);
        $curBalance = $curStmt->fetchColumn();
        $finalBalance = ($newBalance !== '' && $newBalance !== null) ? (float)$newBalance : (float)$curBalance;

        try {
            $stmt = $pdo->prepare("UPDATE users SET wallet = ?, balance = ?, is_banned = ?, ban_reason = ? WHERE id = ? AND is_admin = 0");
            $stmt->execute([$newWallet ?: null, $finalBalance, $newBanned, $newBanReason ?: null, $uid]);
            $success = "User profile updated successfully!";
        } catch (Exception $e) {
            $error = "Failed to update user profile.";
        }
    }
    if (isset($_POST['reset_balance'])) {
        try {
            $pdo->prepare("UPDATE users SET balance = 0 WHERE id = ? AND is_admin = 0")->execute([$uid]);
            $success = "Balance reset to 0.";
        } catch (Exception $e) {
            $error = "Failed to reset balance.";
        }
    }
}

// Fetch user data
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$uid]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user) {
    header("Location: users.php");
    exit();
}

// Fetch stats
$totalEarned = 0;
try {
    $s = $pdo->prepare("SELECT COALESCE(SUM(reward), 0) FROM completed_offers WHERE user_id = ? AND reward > 0 AND (status = 'completed' OR status = '1' OR status IS NULL OR offer_type = 'WatchAd')");
    $s->execute([$uid]);
    $totalEarned = (float)$s->fetchColumn();
} catch (Exception $e) {}

$totalWithdrawn = 0;
try {
    $s = $pdo->prepare("SELECT COALESCE(SUM(ABS(reward)), 0) FROM completed_offers WHERE user_id = ? AND reward < 0 AND status IN ('1', 'approved')");
    $s->execute([$uid]);
    $totalWithdrawn = (float)$s->fetchColumn();
} catch (Exception $e) {}

$totalReferrals = 0;
try {
    $s = $pdo->prepare("SELECT COUNT(*) FROM users WHERE referred_by = ?");
    $s->execute([$uid]);
    $totalReferrals = (int)$s->fetchColumn();
} catch (Exception $e) {}

$refEarnings = 0;
try {
    $s = $pdo->prepare("SELECT COALESCE(SUM(commission), 0) FROM referral_earnings WHERE user_id = ?");
    $s->execute([$uid]);
    $refEarnings = (float)$s->fetchColumn();
} catch (Exception $e) {}

$referredByUser = null;
if (!empty($user['referred_by'])) {
    try {
        $s = $pdo->prepare("SELECT id, username FROM users WHERE id = ?");
        $s->execute([$user['referred_by']]);
        $referredByUser = $s->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}
}

// Recent activity
$recentActivity = [];
try {
    $s = $pdo->prepare("SELECT offer_name, offer_type, reward, status, created_at FROM completed_offers WHERE user_id = ? ORDER BY id DESC LIMIT 15");
    $s->execute([$uid]);
    $recentActivity = $s->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

// Referred users list
$referredUsers = [];
try {
    $s = $pdo->prepare("SELECT id, username, balance, created_at FROM users WHERE referred_by = ? ORDER BY id DESC LIMIT 20");
    $s->execute([$uid]);
    $referredUsers = $s->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User #<?php echo $uid; ?> - Admin Panel</title>
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
            <a href="users.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
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
            <a href="broadcast.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-bullhorn w-5 text-center"></i> Broadcast
            </a>
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="settings.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
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

    <div class="flex-1 md:ml-64 flex flex-col min-h-screen relative z-10 w-full">
        <header class="h-20 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
            <div class="md:hidden flex items-center gap-3">
                <button id="mobile-menu-btn" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">
                    <i class="fas fa-bars text-lg"></i>
                </button>
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2">
                    <i class="fas fa-user"></i> <span class="truncate">Profile</span>
                </div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <a href="users.php" class="text-gray-400 hover:text-brand-primary transition-colors"><i class="fas fa-arrow-left"></i></a>
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">User Profile</h1>
                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg">#<?php echo $uid; ?></span>
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
            <div class="w-full max-w-5xl mx-auto space-y-6">

                <?php if ($success): ?>
                <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold">
                    <i class="fas fa-check-circle text-xl"></i> <?php echo htmlspecialchars($success); ?>
                </div>
                <?php endif; ?>
                <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold">
                    <i class="fas fa-circle-exclamation text-xl"></i> <?php echo htmlspecialchars($error); ?>
                </div>
                <?php endif; ?>

                <!-- User Header Card -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>
                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                        <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-brand-primary/30 flex-shrink-0">
                            <?php echo strtoupper(substr($user['username'] ?: 'U', 0, 1)); ?>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h2 class="text-2xl font-black text-gray-900 dark:text-white truncate"><?php echo htmlspecialchars($user['username'] ?: 'Unknown'); ?></h2>
                            <div class="flex flex-wrap items-center gap-2 mt-2">
                                <span class="text-xs font-mono bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg text-gray-500">ID: #<?php echo $user['id']; ?></span>
                                <?php if ($user['is_banned']): ?>
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold"><i class="fas fa-ban"></i> Banned</span>
                                <?php else: ?>
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold"><i class="fas fa-check-circle"></i> Active</span>
                                <?php endif; ?>
                                <span class="text-xs text-gray-400"><i class="fas fa-clock"></i> Joined <?php echo date('M d, Y', strtotime($user['created_at'])); ?></span>
                            </div>
                        </div>
                        <a href="users.php" class="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                            <i class="fas fa-arrow-left"></i> Back
                        </a>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-6xl"><i class="fas fa-wallet"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-wallet text-emerald-500"></i> Balance</div>
                        <div class="text-xl font-black text-emerald-500"><?php echo number_format($user['balance'], 2); ?></div>
                        <div class="text-[10px] text-gray-400"><?php echo htmlspecialchars($currencyName); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-blue-500/10 text-6xl"><i class="fas fa-coins"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-coins text-blue-500"></i> Total Earned</div>
                        <div class="text-xl font-black text-blue-500"><?php echo number_format($totalEarned, 2); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-orange-500/10 text-6xl"><i class="fas fa-arrow-up"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-arrow-up text-orange-500"></i> Withdrawn</div>
                        <div class="text-xl font-black text-orange-500"><?php echo number_format($totalWithdrawn, 2); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-purple-500/10 text-6xl"><i class="fas fa-users"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-users text-purple-500"></i> Referrals</div>
                        <div class="text-xl font-black text-purple-500"><?php echo number_format($totalReferrals); ?></div>
                        <div class="text-[10px] text-gray-400">+<?php echo number_format($refEarnings, 2); ?> earned</div>
                    </div>
                </div>

                <!-- Edit Profile Form -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    <h3 class="text-lg font-extrabold text-blue-500 flex items-center gap-2 mb-6"><i class="fas fa-pen-to-square"></i> Edit Profile</h3>
                    <form method="POST">
                        <input type="hidden" name="update_profile" value="1">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Username</label>
                                <input type="text" value="<?php echo htmlspecialchars($user['username'] ?? ''); ?>" disabled class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm text-gray-500 cursor-not-allowed">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Balance (<?php echo htmlspecialchars($currencyName); ?>)</label>
                                <input type="number" step="0.00000001" name="balance" value="<?php echo $user['balance']; ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-500/50 transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">FaucetPay Email (Wallet)</label>
                                <input type="text" name="wallet" value="<?php echo htmlspecialchars($user['wallet'] ?? ''); ?>" placeholder="Not linked" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-500/50 transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Telegram ID</label>
                                <input type="text" value="<?php echo htmlspecialchars($user['telegram_id'] ?? ''); ?>" placeholder="Not linked" disabled class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm text-gray-500 cursor-not-allowed">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">IP Address</label>
                                <input type="text" value="<?php echo htmlspecialchars($user['ip_address'] ?? '-'); ?>" disabled class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm text-gray-500 cursor-not-allowed">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Referred By</label>
                                <?php if ($referredByUser): ?>
                                <a href="user_profile.php?id=<?php echo $referredByUser['id']; ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl font-medium text-sm text-brand-primary hover:underline flex items-center gap-2">
                                    <i class="fas fa-user"></i> <?php echo htmlspecialchars($referredByUser['username'] ?: 'User #' . $referredByUser['id']); ?>
                                </a>
                                <?php else: ?>
                                <input type="text" value="None" disabled class="w-full px-4 py-3 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm text-gray-500 cursor-not-allowed">
                                <?php endif; ?>
                            </div>
                            <div class="md:col-span-2">
                                <div class="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" name="is_banned" value="1" <?php echo $user['is_banned'] ? 'checked' : ''; ?> class="w-5 h-5 accent-red-500">
                                        <span class="font-bold text-sm text-red-600 dark:text-red-400"><i class="fas fa-ban"></i> Banned</span>
                                    </label>
                                    <input type="text" name="ban_reason" value="<?php echo htmlspecialchars($user['ban_reason'] ?? ''); ?>" placeholder="Ban reason (optional)" class="flex-1 px-4 py-2 bg-white dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg outline-none text-sm font-medium">
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-3 mt-6">
                            <button type="submit" class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                        </div>
                    </form>
                    <form method="POST" class="mt-3" onsubmit="return confirm('Reset balance to 0?')">
                        <input type="hidden" name="reset_balance" value="1">
                        <button type="submit" class="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25">
                            <i class="fas fa-rotate-left"></i> Reset Balance
                        </button>
                    </form>
                </div>

                <!-- Linked Accounts Summary -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                    <h3 class="text-lg font-extrabold text-cyan-500 flex items-center gap-2 mb-5"><i class="fas fa-link"></i> Linked Accounts</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-white/10">
                            <div class="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center"><i class="fab fa-telegram text-xl"></i></div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Telegram</p>
                                <?php if (!empty($user['telegram_id'])): ?>
                                <p class="text-sm font-bold text-gray-900 dark:text-white truncate"><?php echo htmlspecialchars($user['telegram_id']); ?></p>
                                <?php else: ?>
                                <p class="text-sm font-bold text-gray-400">Not linked</p>
                                <?php endif; ?>
                            </div>
                            <?php if (!empty($user['telegram_id'])): ?>
                            <span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-bold">Connected</span>
                            <?php else: ?>
                            <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-lg text-[10px] font-bold">Not Set</span>
                            <?php endif; ?>
                        </div>
                        <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-white/10">
                            <div class="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center"><i class="fas fa-wallet text-xl"></i></div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">FaucetPay</p>
                                <?php if (!empty($user['wallet'])): ?>
                                <p class="text-sm font-bold text-gray-900 dark:text-white truncate"><?php echo htmlspecialchars($user['wallet']); ?></p>
                                <?php else: ?>
                                <p class="text-sm font-bold text-gray-400">Not linked</p>
                                <?php endif; ?>
                            </div>
                            <?php if (!empty($user['wallet'])): ?>
                            <span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-bold">Connected</span>
                            <?php else: ?>
                            <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-lg text-[10px] font-bold">Not Set</span>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    <h3 class="text-lg font-extrabold text-emerald-500 flex items-center gap-2 mb-5"><i class="fas fa-clock-rotate-left"></i> Recent Activity</h3>
                    <?php if (empty($recentActivity)): ?>
                    <div class="text-center py-8 text-gray-400">
                        <i class="fas fa-inbox text-4xl mb-3 block"></i>
                        <p class="font-bold">No activity yet.</p>
                    </div>
                    <?php else: ?>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-white/10">
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Activity</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                <?php foreach ($recentActivity as $act): ?>
                                <tr class="hover:bg-gray-50 dark:hover:bg-white/5">
                                    <td class="py-3 pr-2 font-medium text-gray-900 dark:text-white"><?php echo htmlspecialchars($act['offer_name']); ?></td>
                                    <td class="py-3 pr-2">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-dark-900 text-gray-500"><?php echo htmlspecialchars($act['offer_type']); ?></span>
                                    </td>
                                    <td class="py-3 pr-2 font-extrabold <?php echo $act['reward'] >= 0 ? 'text-emerald-500' : 'text-red-500'; ?>">
                                        <?php echo $act['reward'] >= 0 ? '+' : ''; ?><?php echo number_format($act['reward'], 2); ?>
                                    </td>
                                    <td class="py-3 hidden sm:table-cell text-xs text-gray-400"><?php echo date('M d, Y H:i', strtotime($act['created_at'])); ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <?php endif; ?>
                </div>

                <!-- Referred Users -->
                <?php if ($totalReferrals > 0): ?>
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500"></div>
                    <h3 class="text-lg font-extrabold text-purple-500 flex items-center gap-2 mb-5"><i class="fas fa-user-group"></i> Referred Users <span class="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-dark-900 px-2 py-0.5 rounded-lg ml-2"><?php echo $totalReferrals; ?></span></h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-white/10">
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Joined</th>
                                    <th class="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">View</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                <?php foreach ($referredUsers as $ru): ?>
                                <tr class="hover:bg-gray-50 dark:hover:bg-white/5">
                                    <td class="py-3 pr-2">
                                        <div class="flex items-center gap-2">
                                            <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[10px]"><?php echo strtoupper(substr($ru['username'] ?: 'U', 0, 1)); ?></div>
                                            <span class="font-bold text-gray-900 dark:text-white"><?php echo htmlspecialchars($ru['username'] ?: 'User #' . $ru['id']); ?></span>
                                        </div>
                                    </td>
                                    <td class="py-3 pr-2 font-bold text-emerald-500"><?php echo number_format($ru['balance'], 2); ?></td>
                                    <td class="py-3 hidden sm:table-cell text-xs text-gray-400"><?php echo date('M d, Y', strtotime($ru['created_at'])); ?></td>
                                    <td class="py-3 text-right">
                                        <a href="user_profile.php?id=<?php echo $ru['id']; ?>" class="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-lg text-xs font-bold transition-colors">
                                            <i class="fas fa-eye"></i> View
                                        </a>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <?php endif; ?>

                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — User Profile
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
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', function() {
            themeToggleDarkIcon.classList.toggle('hidden');
            themeToggleLightIcon.classList.toggle('hidden');
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            }
        });

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
