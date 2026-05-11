<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['approve_offer'])) {
        $offerId = (int)$_POST['offer_id'];
        $stmt = $pdo->prepare("SELECT * FROM completed_offers WHERE id = ? AND status = '0'");
        $stmt->execute([$offerId]);
        $offer = $stmt->fetch();
        if ($offer) {
            try {
                $pdo->beginTransaction();
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$offer['reward'], $offer['user_id']]);
                $pdo->prepare("UPDATE completed_offers SET status = '1' WHERE id = ?")->execute([$offerId]);
                $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
                $refStmt->execute([$offer['user_id']]);
                $refData = $refStmt->fetch();
                if ($refData && !empty($refData['referred_by'])) {
                    $commissionRate = (float)(getSetting('referral_commission') ?: 10);
                    $commission = round((float)$offer['reward'] * ($commissionRate / 100), 8);
                    if ($commission > 0) {
                        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$commission, $refData['referred_by']]);
                        $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, ?, ?, ?)")
                            ->execute([$refData['referred_by'], $offer['user_id'], $offer['offer_type'], $offer['reward'], $commission]);
                    }
                }
                $pdo->commit();
                $success = "Offer #$offerId approved and reward credited.";
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                $error = "Failed to approve: " . $e->getMessage();
            }
        }
    }

    if (isset($_POST['reject_offer'])) {
        $offerId = (int)$_POST['offer_id'];
        $pdo->prepare("UPDATE completed_offers SET status = '2' WHERE id = ? AND status = '0'")->execute([$offerId]);
        $success = "Offer #$offerId rejected.";
    }

    if (isset($_POST['approve_all'])) {
        $pendingStmt = $pdo->query("SELECT * FROM completed_offers WHERE status = '0' AND offer_type != 'WatchAd'");
        $pendingOffers = $pendingStmt->fetchAll(PDO::FETCH_ASSOC);
        $count = 0;
        foreach ($pendingOffers as $offer) {
            try {
                $pdo->beginTransaction();
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$offer['reward'], $offer['user_id']]);
                $pdo->prepare("UPDATE completed_offers SET status = '1' WHERE id = ?")->execute([$offer['id']]);
                $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
                $refStmt->execute([$offer['user_id']]);
                $refData = $refStmt->fetch();
                if ($refData && !empty($refData['referred_by'])) {
                    $commissionRate = (float)(getSetting('referral_commission') ?: 10);
                    $commission = round((float)$offer['reward'] * ($commissionRate / 100), 8);
                    if ($commission > 0) {
                        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$commission, $refData['referred_by']]);
                        $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, ?, ?, ?)")
                            ->execute([$refData['referred_by'], $offer['user_id'], $offer['offer_type'], $offer['reward'], $commission]);
                    }
                }
                $pdo->commit();
                $count++;
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
            }
        }
        $success = "$count pending offers approved and credited.";
    }

    if (isset($_POST['save_approval_settings'])) {
        $enabled = isset($_POST['offer_approval_enabled']) ? '1' : '0';
        $threshold = max(0, (float)$_POST['offer_approval_threshold']);
        $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES ('offer_approval_enabled', ?)")->execute([$enabled]);
        $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES ('offer_approval_threshold', ?)")->execute([$threshold]);
        $success = "Approval settings saved!";
    }
}

$tab = $_GET['tab'] ?? 'pending';
if (!in_array($tab, ['pending', 'approved', 'rejected'])) $tab = 'pending';
$search = trim($_GET['search'] ?? '');
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$offset = ($page - 1) * $perPage;

$params = [];
if ($tab === 'pending') {
    $whereClause = "WHERE co.status = '0' AND co.offer_type != 'WatchAd'";
} elseif ($tab === 'approved') {
    $whereClause = "WHERE (co.status = '1' OR co.offer_type = 'WatchAd')";
} else {
    $whereClause = "WHERE co.status = '2' AND co.offer_type != 'WatchAd'";
}

if ($search !== '') {
    $whereClause .= " AND (u.username LIKE ? OR co.offer_name LIKE ? OR co.trans_id LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM completed_offers co LEFT JOIN users u ON co.user_id = u.id $whereClause");
$countStmt->execute($params);
$totalOffers = $countStmt->fetchColumn();
$totalPages = max(1, ceil($totalOffers / $perPage));

$stmt = $pdo->prepare("SELECT co.*, u.username FROM completed_offers co LEFT JOIN users u ON co.user_id = u.id $whereClause ORDER BY co.id DESC LIMIT $perPage OFFSET $offset");
$stmt->execute($params);
$offers = $stmt->fetchAll(PDO::FETCH_ASSOC);

$pendingCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE status = '0' AND offer_type != 'WatchAd'")->fetchColumn();
$approvedCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE (status = '1' OR offer_type = 'WatchAd')")->fetchColumn();
$rejectedCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE status = '2' AND offer_type != 'WatchAd'")->fetchColumn();

$approvalEnabled = getSetting('offer_approval_enabled') === '1';
$approvalThreshold = (float)(getSetting('offer_approval_threshold') ?: 0.1);
$exchangeRate = (float)(getSetting('exchange_rate') ?: 1000);
$currencyName = getSetting('currency_name') ?: 'Coins';

$site_logo = getSetting('site_logo') ?: '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offer Approval - Admin Panel</title>
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
        }
    </script>
    <style>
        .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 211, 238, 0.08)); color: #A78BFA; font-weight: 700; border-right: 3px solid #8B5CF6; }
        .dark .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(34, 211, 238, 0.1)); }
        .bg-grid { background-size: 50px 50px; position: fixed; inset: 0; z-index: -2; pointer-events: none; background-image: linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px); mask-image: radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%); }
        .dark .bg-grid { background-image: linear-gradient(to right, rgba(139, 92, 246, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 211, 238, 0.03) 1px, transparent 1px); }
        .tab-btn.active { border-color: #A78BFA; color: #A78BFA; background: rgba(99,102,241,0.05); }
        .dark .tab-btn.active { background: rgba(99,102,241,0.1); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
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
            <button id="close-sidebar-btn" class="md:hidden text-gray-400 hover:text-red-500 transition-colors"><i class="fas fa-times text-xl"></i></button>
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
            <a href="offers.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-clipboard-check w-5 text-center"></i> Offer Approval
            </a>
            <a href="withdrawals.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>

            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
            </a>
            <a href="broadcast.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-bullhorn w-5 text-center"></i> Broadcast
            </a>
            <a href="settings.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-gear w-5 text-center"></i> Settings
            </a>
            <a href="ad_setup.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-rectangle-ad w-5 text-center"></i> Ad Setup
            </a>
        </nav>
        <div class="p-4 border-t border-gray-100 dark:border-white/5 space-y-2">
            <a href="../index.php" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary dark:hover:bg-brand-primary/20 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400"><i class="fas fa-eye"></i> View Site</a>
            <a href="../admin.php?logout=1" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400"><i class="fas fa-right-from-bracket"></i> Logout</a>
        </div>
    </aside>

    <div class="flex-1 md:ml-64 flex flex-col min-h-screen relative z-10 w-full">
        <header class="h-20 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
            <div class="md:hidden flex items-center gap-3">
                <button id="mobile-menu-btn" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400"><i class="fas fa-bars text-lg"></i></button>
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2"><i class="fas fa-clipboard-check"></i> <span class="truncate">Offers</span></div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Offer Approval</h1>
                <?php if ($pendingCount > 0): ?>
                <span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg animate-pulse"><?php echo $pendingCount; ?> Pending</span>
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
            <div class="w-full max-w-6xl mx-auto space-y-6">

                <?php if ($success): ?>
                <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-check-circle text-xl"></i> <?php echo htmlspecialchars($success); ?></div>
                <?php endif; ?>
                <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-circle-exclamation text-xl"></i> <?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>

                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                    <h3 class="text-lg font-extrabold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2"><i class="fas fa-sliders"></i> Approval Settings</h3>
                    <form method="POST" class="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                        <div class="flex items-center gap-3">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="offer_approval_enabled" value="1" class="sr-only peer" <?php echo $approvalEnabled ? 'checked' : ''; ?>>
                                <div class="w-11 h-6 bg-gray-200 dark:bg-dark-700 peer-focus:ring-2 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                            <span class="text-sm font-bold text-gray-700 dark:text-gray-300">Enable Approval</span>
                        </div>
                        <div class="flex-1 w-full sm:w-auto">
                            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Threshold (USD)</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 font-bold">$</span>
                                <input type="number" step="0.01" min="0" name="offer_approval_threshold" value="<?php echo $approvalThreshold; ?>" class="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-bold">
                            </div>
                            <p class="text-[10px] text-gray-400 mt-1">Offers with reward ≥ this USD value will require approval (1 USD = <?php echo number_format($exchangeRate); ?> <?php echo htmlspecialchars($currencyName); ?>)</p>
                        </div>
                        <button type="submit" name="save_approval_settings" value="1" class="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/30 whitespace-nowrap"><i class="fas fa-save"></i> Save</button>
                    </form>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-amber-500/10 text-7xl"><i class="fas fa-clock"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-clock text-amber-500"></i> Pending</div>
                        <div class="text-2xl font-extrabold text-amber-500"><?php echo number_format($pendingCount); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-7xl"><i class="fas fa-check-double"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-check-double text-emerald-500"></i> Approved</div>
                        <div class="text-2xl font-extrabold text-emerald-500"><?php echo number_format($approvedCount); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-red-500/10 text-7xl"><i class="fas fa-times-circle"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-times-circle text-red-500"></i> Rejected</div>
                        <div class="text-2xl font-extrabold text-red-500"><?php echo number_format($rejectedCount); ?></div>
                    </div>
                </div>

                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>

                    <div class="flex flex-col gap-4 mb-6">
                        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div class="flex gap-2 border-b border-gray-200 dark:border-white/10 w-full sm:w-auto">
                                <a href="?tab=pending&search=<?php echo urlencode($search); ?>" class="tab-btn px-4 py-3 font-bold text-sm border-b-2 transition-all <?php echo $tab === 'pending' ? 'active border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'; ?>">
                                    <i class="fas fa-clock mr-1"></i> Pending <?php if ($pendingCount): ?><span class="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-md text-[10px]"><?php echo $pendingCount; ?></span><?php endif; ?>
                                </a>
                                <a href="?tab=approved&search=<?php echo urlencode($search); ?>" class="tab-btn px-4 py-3 font-bold text-sm border-b-2 transition-all <?php echo $tab === 'approved' ? 'active border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'; ?>">
                                    <i class="fas fa-check-double mr-1"></i> Approved
                                </a>
                                <a href="?tab=rejected&search=<?php echo urlencode($search); ?>" class="tab-btn px-4 py-3 font-bold text-sm border-b-2 transition-all <?php echo $tab === 'rejected' ? 'active border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'; ?>">
                                    <i class="fas fa-times-circle mr-1"></i> Rejected
                                </a>
                            </div>
                            <div class="flex gap-2 w-full sm:w-auto">
                                <form method="GET" class="flex gap-2 flex-1 sm:flex-initial">
                                    <input type="hidden" name="tab" value="<?php echo $tab; ?>">
                                    <div class="relative flex-1">
                                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-search text-sm"></i></div>
                                        <input type="text" name="search" value="<?php echo htmlspecialchars($search); ?>" placeholder="Search..." class="w-full sm:w-52 pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none text-sm font-medium">
                                    </div>
                                    <button type="submit" class="px-4 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-colors"><i class="fas fa-search"></i></button>
                                </form>
                                <?php if ($tab === 'pending' && $pendingCount > 0): ?>
                                <form method="POST" onsubmit="return confirm('Approve ALL pending offers?')">
                                    <button type="submit" name="approve_all" value="1" class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors whitespace-nowrap"><i class="fas fa-check-double"></i> Approve All</button>
                                </form>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <?php if (empty($offers)): ?>
                    <div class="text-center py-12">
                        <i class="fas fa-inbox text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400 font-bold">No <?php echo $tab; ?> offers found.</p>
                    </div>
                    <?php else: ?>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-white/10">
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Offer</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reward</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">USD Value</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                                    <?php if ($tab === 'pending'): ?>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    <?php endif; ?>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                <?php foreach ($offers as $o):
                                    $usdVal = ($exchangeRate > 0) ? ((float)$o['reward'] / $exchangeRate) : 0;
                                ?>
                                <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <td class="py-3 pr-2"><span class="text-xs font-mono bg-gray-100 dark:bg-dark-900 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400">#<?php echo $o['id']; ?></span></td>
                                    <td class="py-3 pr-2">
                                        <div class="flex items-center gap-2">
                                            <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0"><?php echo strtoupper(substr($o['username'] ?: 'U', 0, 1)); ?></div>
                                            <span class="font-bold text-gray-900 dark:text-white truncate max-w-[100px]"><?php echo htmlspecialchars($o['username'] ?: 'User #' . $o['user_id']); ?></span>
                                        </div>
                                    </td>
                                    <td class="py-3 pr-2"><span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px] block"><?php echo htmlspecialchars($o['offer_name']); ?></span></td>
                                    <td class="py-3 pr-2"><span class="inline-flex px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-md text-[10px] font-bold uppercase"><?php echo htmlspecialchars($o['offer_type']); ?></span></td>
                                    <td class="py-3 pr-2"><span class="font-extrabold text-emerald-600 dark:text-emerald-400"><?php echo number_format($o['reward'], 2); ?></span> <span class="text-[10px] text-gray-400"><?php echo htmlspecialchars($currencyName); ?></span></td>
                                    <td class="py-3 pr-2 hidden md:table-cell"><span class="font-bold text-gray-600 dark:text-gray-400">$<?php echo number_format($usdVal, 4); ?></span></td>
                                    <td class="py-3 pr-2 hidden lg:table-cell"><span class="text-xs text-gray-500 dark:text-gray-400"><?php echo date('M d, Y H:i', strtotime($o['created_at'])); ?></span></td>
                                    <?php if ($tab === 'pending'): ?>
                                    <td class="py-3 text-right">
                                        <div class="flex gap-1.5 justify-end">
                                            <form method="POST" class="inline" onsubmit="return confirm('Approve this offer and credit reward?')">
                                                <input type="hidden" name="offer_id" value="<?php echo $o['id']; ?>">
                                                <button type="submit" name="approve_offer" value="1" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"><i class="fas fa-check"></i> Approve</button>
                                            </form>
                                            <form method="POST" class="inline" onsubmit="return confirm('Reject this offer?')">
                                                <input type="hidden" name="offer_id" value="<?php echo $o['id']; ?>">
                                                <button type="submit" name="reject_offer" value="1" class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"><i class="fas fa-times"></i> Reject</button>
                                            </form>
                                        </div>
                                    </td>
                                    <?php endif; ?>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>

                    <?php if ($totalPages > 1): ?>
                    <div class="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                        <?php if ($page > 1): ?>
                        <a href="?tab=<?php echo $tab; ?>&page=<?php echo $page - 1; ?>&search=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-sm transition-colors"><i class="fas fa-chevron-left"></i> Prev</a>
                        <?php endif; ?>
                        <span class="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-xl font-bold text-sm">Page <?php echo $page; ?> / <?php echo $totalPages; ?></span>
                        <?php if ($page < $totalPages): ?>
                        <a href="?tab=<?php echo $tab; ?>&page=<?php echo $page + 1; ?>&search=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-sm transition-colors">Next <i class="fas fa-chevron-right"></i></a>
                        <?php endif; ?>
                    </div>
                    <?php endif; ?>
                    <?php endif; ?>
                </div>

                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — Offer Approval
                </div>
            </div>
        </main>
    </div>

    <script>
        const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
        const themeToggleBtn = document.getElementById('theme-toggle');
        if (themeToggleDarkIcon) {
            if (document.documentElement.classList.contains('dark')) themeToggleLightIcon.classList.remove('hidden');
            else themeToggleDarkIcon.classList.remove('hidden');
        }
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', function() {
            themeToggleDarkIcon.classList.toggle('hidden');
            themeToggleLightIcon.classList.toggle('hidden');
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        });
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
    </script>
</body>
</html>