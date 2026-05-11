<?php
session_start();
require_once '../core/db.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

try {
    $pdo->query("SELECT is_banned FROM users LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("ALTER TABLE `users` ADD `is_banned` tinyint(1) DEFAULT '0' AFTER `is_admin`");
    $pdo->exec("ALTER TABLE `users` ADD `ban_reason` varchar(255) DEFAULT NULL AFTER `is_banned`");
}

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['ban_user'])) {
        $userId = (int)$_POST['user_id'];
        $reason = trim($_POST['ban_reason'] ?? '');
        $stmt = $pdo->prepare("UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ? AND is_admin = 0");
        $stmt->execute([$reason, $userId]);
        $success = "User #$userId has been banned.";
    }

    if (isset($_POST['unban_user'])) {
        $userId = (int)$_POST['user_id'];
        $stmt = $pdo->prepare("UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?");
        $stmt->execute([$userId]);
        $success = "User #$userId has been unbanned.";
    }

    if (isset($_POST['save_ban_settings'])) {
        $banMode = $_POST['ban_mode'] === 'auto' ? 'auto' : 'manual';
        $stmt = $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES ('ban_mode', ?)");
        $stmt->execute([$banMode]);
        $success = "Ban settings saved successfully!";
    }
}

$search = trim($_GET['search'] ?? '');
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$offset = ($page - 1) * $perPage;

$whereClause = "WHERE is_admin = 0";
$params = [];
if ($search !== '') {
    $whereClause .= " AND (username LIKE ? OR wallet LIKE ? OR ip_address LIKE ?)";
    $params = ["%$search%", "%$search%", "%$search%"];
}

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM users $whereClause");
$countStmt->execute($params);
$totalUsers = $countStmt->fetchColumn();
$totalPages = max(1, ceil($totalUsers / $perPage));

$stmt = $pdo->prepare("SELECT id, username, wallet, balance, ip_address, is_banned, ban_reason, created_at FROM users $whereClause ORDER BY id DESC LIMIT $perPage OFFSET $offset");
$stmt->execute($params);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

$bannedCount = $pdo->query("SELECT COUNT(*) FROM users WHERE is_banned = 1")->fetchColumn();

$banMode = 'manual';
try {
    $bmStmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = 'ban_mode'");
    $bmStmt->execute();
    $bmResult = $bmStmt->fetch();
    if ($bmResult) $banMode = $bmResult['value'];
} catch (Exception $e) {}

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
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management - Admin Panel</title>
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
                    <i class="fas fa-users-gear"></i> <span class="truncate">Users</span>
                </div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">User Management</h1>
                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg"><?php echo number_format($totalUsers); ?> Users</span>
            </div>
            <div class="flex items-center gap-3 md:gap-4 ml-auto">
                <div class="hidden sm:flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs">
                    <i class="fas fa-ban"></i> <?php echo number_format($bannedCount); ?> Banned
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
            <div class="w-full max-w-6xl mx-auto space-y-6">

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

                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                    <h3 class="text-lg font-extrabold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2"><i class="fas fa-gavel"></i> Ban Settings</h3>
                    <form method="POST" class="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                        <div class="flex-1 w-full">
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Ban Mode</label>
                            <select name="ban_mode" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-bold">
                                <option value="manual" <?php echo $banMode === 'manual' ? 'selected' : ''; ?>>🔒 Manual — Admin bans users manually</option>
                                <option value="auto" <?php echo $banMode === 'auto' ? 'selected' : ''; ?>>⚡ Auto — System bans suspicious users automatically</option>
                            </select>
                            <p class="text-[10px] text-gray-400 mt-2"><strong>Manual:</strong> Admin bans/unbans users. <strong>Auto:</strong> Multi-account / VPN users are auto-banned on login.</p>
                        </div>
                        <button type="submit" name="save_ban_settings" value="1" class="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/30 whitespace-nowrap">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </form>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div class="absolute -right-4 -top-4 text-blue-500/10 text-7xl"><i class="fas fa-users"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-users text-blue-500"></i> Total Users</div>
                        <div class="text-2xl font-extrabold text-gray-900 dark:text-white"><?php echo number_format($totalUsers); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div class="absolute -right-4 -top-4 text-red-500/10 text-7xl"><i class="fas fa-ban"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-ban text-red-500"></i> Banned Users</div>
                        <div class="text-2xl font-extrabold text-red-500"><?php echo number_format($bannedCount); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden group shadow-sm">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-7xl"><i class="fas fa-user-check"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-user-check text-emerald-500"></i> Active Users</div>
                        <div class="text-2xl font-extrabold text-emerald-500"><?php echo number_format($totalUsers - $bannedCount); ?></div>
                    </div>
                </div>

                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>

                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <h3 class="text-lg font-extrabold text-brand-primary flex items-center gap-2"><i class="fas fa-users-gear"></i> All Users</h3>
                        <form method="GET" class="flex gap-2 w-full sm:w-auto">
                            <div class="relative flex-1 sm:flex-initial">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <i class="fas fa-search text-sm"></i>
                                </div>
                                <input type="text" name="search" value="<?php echo htmlspecialchars($search); ?>" placeholder="Search user..." class="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none text-sm font-medium">
                            </div>
                            <button type="submit" class="px-4 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-colors">
                                <i class="fas fa-search"></i>
                            </button>
                        </form>
                    </div>

                    <?php if (empty($users)): ?>
                        <div class="text-center py-12">
                            <i class="fas fa-users-slash text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                            <p class="text-gray-500 dark:text-gray-400 font-bold">No users found.</p>
                        </div>
                    <?php else: ?>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-left border-b border-gray-200 dark:border-white/10">
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">IP</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Joined</th>
                                        <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                    <?php foreach ($users as $u): ?>
                                    <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors <?php echo $u['is_banned'] ? 'bg-red-50/50 dark:bg-red-500/5' : ''; ?>">
                                        <td class="py-3 pr-2">
                                            <span class="text-xs font-mono bg-gray-100 dark:bg-dark-900 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400">#<?php echo $u['id']; ?></span>
                                        </td>
                                        <td class="py-3 pr-2">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                    <?php echo strtoupper(substr($u['username'] ?: 'U', 0, 1)); ?>
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="font-bold text-gray-900 dark:text-white truncate max-w-[150px]"><?php echo htmlspecialchars($u['username'] ?: '-'); ?></div>
                                                    <?php if ($u['is_banned'] && $u['ban_reason']): ?>
                                                        <div class="text-[10px] text-red-500 font-medium truncate max-w-[150px]"><i class="fas fa-info-circle"></i> <?php echo htmlspecialchars($u['ban_reason']); ?></div>
                                                    <?php endif; ?>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="py-3 pr-2">
                                            <span class="font-extrabold text-emerald-600 dark:text-emerald-400"><?php echo number_format($u['balance'], 2); ?></span>
                                            <span class="text-[10px] text-gray-400 ml-0.5"><?php echo htmlspecialchars($currencyName); ?></span>
                                        </td>
                                        <td class="py-3 pr-2 hidden sm:table-cell">
                                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400"><?php echo htmlspecialchars($u['ip_address'] ?: '-'); ?></span>
                                        </td>
                                        <td class="py-3 pr-2">
                                            <?php if ($u['is_banned']): ?>
                                                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold">
                                                    <i class="fas fa-ban"></i> Banned
                                                </span>
                                            <?php else: ?>
                                                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold">
                                                    <i class="fas fa-check-circle"></i> Active
                                                </span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="py-3 pr-2 hidden md:table-cell">
                                            <span class="text-xs text-gray-500 dark:text-gray-400"><?php echo date('M d, Y', strtotime($u['created_at'])); ?></span>
                                        </td>
                                        <td class="py-3 text-right">
                                            <?php if ($u['is_banned']): ?>
                                                <form method="POST" class="inline" onsubmit="return confirm('Unban this user?')">
                                                    <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                                                    <button type="submit" name="unban_user" value="1" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                        <i class="fas fa-unlock"></i> Unban
                                                    </button>
                                                </form>
                                            <?php else: ?>
                                                <button onclick="openBanModal(<?php echo $u['id']; ?>, '<?php echo addslashes(htmlspecialchars($u['username'])); ?>')" class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                    <i class="fas fa-ban"></i> Ban
                                                </button>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>

                        <?php if ($totalPages > 1): ?>
                        <div class="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                            <?php if ($page > 1): ?>
                                <a href="?page=<?php echo $page - 1; ?>&search=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-sm transition-colors">
                                    <i class="fas fa-chevron-left"></i> Prev
                                </a>
                            <?php endif; ?>
                            <span class="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-xl font-bold text-sm">
                                Page <?php echo $page; ?> / <?php echo $totalPages; ?>
                            </span>
                            <?php if ($page < $totalPages): ?>
                                <a href="?page=<?php echo $page + 1; ?>&search=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-sm transition-colors">
                                    Next <i class="fas fa-chevron-right"></i>
                                </a>
                            <?php endif; ?>
                        </div>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>

                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — User Management
                </div>
            </div>
        </main>
    </div>

    <div id="banModal" class="fixed inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4">
        <div class="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 animate-[fadeInUp_0.3s_ease-out]">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center text-red-500">
                    <i class="fas fa-ban text-xl"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-gray-900 dark:text-white text-lg">Ban User</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400" id="banModalUsername">-</p>
                </div>
            </div>
            <form method="POST">
                <input type="hidden" name="user_id" id="banModalUserId" value="">
                <div class="mb-4">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Reason (Optional)</label>
                    <input type="text" name="ban_reason" placeholder="e.g. Multiple accounts, Fraud, Abuse..." class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm">
                </div>
                <div class="flex gap-3">
                    <button type="submit" name="ban_user" value="1" class="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                        <i class="fas fa-ban"></i> Confirm Ban
                    </button>
                    <button type="button" onclick="closeBanModal()" class="px-6 py-3 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
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

        function openBanModal(userId, username) {
            document.getElementById('banModalUserId').value = userId;
            document.getElementById('banModalUsername').textContent = 'User: ' + username;
            document.getElementById('banModal').classList.remove('hidden');
        }
        function closeBanModal() {
            document.getElementById('banModal').classList.add('hidden');
        }
        document.getElementById('banModal').addEventListener('click', function(e) {
            if (e.target === this) closeBanModal();
        });
    </script>
</body>
</html>
