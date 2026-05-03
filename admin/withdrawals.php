<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    header('Content-Type: application/json');
    $action = $_POST['ajax_action'];
    $id = (int)$_POST['id'];

    if ($action === 'approve') {
        try {
            $stmt = $pdo->prepare("SELECT co.*, u.wallet, u.ip_address FROM completed_offers co JOIN users u ON co.user_id = u.id WHERE co.id = ? AND co.status = '0' AND co.reward < 0");
            $stmt->execute([$id]);
            $w = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$w) {
                echo json_encode(['success' => false, 'error' => 'Withdrawal not found or already processed.']);
                exit;
            }

            $currency = 'USDT';
            $gateway_name = 'faucetpay';
            if (preg_match('/Withdrawal to (.*?) \((.*?)\)/', $w['offer_name'], $matches)) {
                $gateway_name = strtolower(trim($matches[1]));
                $currency = trim($matches[2]);
            }

            $payout_amount = (float)$w['payout'];
            $wallet = $w['wallet'];

            $gateway_api_key = trim(getSetting('faucetpay_api_key'));
            if (empty($gateway_api_key)) {
                echo json_encode(['success' => false, 'error' => 'Payment Gateway API Key is missing in Settings.']);
                exit;
            }

            $paymentSuccess = false;
            $paymentErrorMsg = 'Unknown error';
            $transaction_id = '';

            if (strpos($gateway_name, 'aoyco') !== false || getSetting('payment_gateway') === 'aoyco') {
                $data = [
                    'api_key' => $gateway_api_key,
                    'user_email' => $wallet, 
                    'reward_amount' => $payout_amount,
                    'reward_currency' => $currency
                ];
                $ch = curl_init('https://aoyco.in/api/faucet/claim');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $api_token = getSetting('api_token');
                if (!empty($api_token)) curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$api_token}"]);
                
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                if ($response) {
                    $result = json_decode($response, true);
                    if ($http_code == 200 && isset($result['status']) && in_array(strtolower($result['status']), ['ok', 'success'])) {
                        $paymentSuccess = true;
                        $transaction_id = $result['transaction_id'] ?? time();
                    } else {
                        $paymentErrorMsg = "Aoyco API Error: " . ($result['message'] ?? strip_tags($response));
                    }
                } else {
                    $paymentErrorMsg = "Aoyco API Connection Failed.";
                }
            } else {
                $amount_satoshi = (string)round($payout_amount * 100000000);
                if ((int)$amount_satoshi <= 0) {
                    echo json_encode(['success' => false, 'error' => 'Amount too small to send. Minimum 1 satoshi required.']);
                    exit;
                }
                
                $data = [
                    'api_key' => $gateway_api_key,
                    'amount' => $amount_satoshi, 
                    'currency' => $currency,
                    'to' => $wallet,
                    'referral' => 'false',
                    'ip_address' => $w['ip_address'] ?: '127.0.0.1'
                ];
                
                $ch = curl_init('https://faucetpay.io/api/v1/send');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $data); 
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                
                if (curl_errno($ch)) {
                    $paymentErrorMsg = 'CURL Error: ' . curl_error($ch);
                } else {
                    $result = json_decode($response, true);
                    if ($result && isset($result['status']) && $result['status'] == 200) {
                        $paymentSuccess = true;
                        $transaction_id = $result['payment_id'] ?? time();
                    } else {
                        $paymentErrorMsg = 'FaucetPay Error: ' . ($result['message'] ?? "HTTP $http_code");
                    }
                }
                curl_close($ch);
            }

            if ($paymentSuccess) {
                $new_trans_id = 'WD-' . $transaction_id . '-' . $w['user_id'];
                $stmt = $pdo->prepare("UPDATE completed_offers SET status = '1', trans_id = ? WHERE id = ?");
                $stmt->execute([$new_trans_id, $id]);
                echo json_encode(['success' => true, 'message' => "Successfully paid {$payout_amount} {$currency} to user wallet!"]);
            } else {
                echo json_encode(['success' => false, 'error' => $paymentErrorMsg]);
            }

        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'reject') {
        try {
            $stmt = $pdo->prepare("SELECT user_id, reward FROM completed_offers WHERE id = ? AND status = '0' AND reward < 0");
            $stmt->execute([$id]);
            $w = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($w) {
                $pdo->beginTransaction();
                $pdo->prepare("UPDATE completed_offers SET status = '2' WHERE id = ?")->execute([$id]);
                
                $refundAmount = abs((float)$w['reward']);
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$refundAmount, $w['user_id']]);
                
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => "Request rejected and " . number_format($refundAmount, 2) . " coins refunded."]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Request not found.']);
            }
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => 'Failed to reject: ' . $e->getMessage()]);
        }
        exit;
    }
}


$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['ajax_action'])) {
    if (isset($_POST['save_withdraw_limit'])) {
        $limit = (float)$_POST['auto_withdraw_limit_usd'];
        try {
            $stmt = $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");
            $stmt->execute(['auto_withdraw_limit_usd', (string)$limit]);
            $success = "Auto-Withdrawal Limit updated successfully.";
        } catch(Exception $e) {
            $error = "Failed to save setting: " . $e->getMessage();
        }
    }

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
}

$tab = $_GET['tab'] ?? 'pending';
if (!in_array($tab, ['pending', 'approved', 'rejected'])) $tab = 'pending';
$search = trim($_GET['search'] ?? '');
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$offset = ($page - 1) * $perPage;

$params = [];
if ($tab === 'pending') {
    $whereClause = "WHERE co.reward < 0 AND co.status = '0'";
} elseif ($tab === 'approved') {
    $whereClause = "WHERE co.reward < 0 AND co.status = '1'";
} else {
    $whereClause = "WHERE co.reward < 0 AND co.status = '2'";
}

if ($search !== '') {
    $whereClause .= " AND (u.username LIKE ? OR co.offer_name LIKE ? OR co.trans_id LIKE ? OR u.wallet LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM completed_offers co LEFT JOIN users u ON co.user_id = u.id $whereClause");
$countStmt->execute($params);
$totalItems = $countStmt->fetchColumn();
$totalPages = max(1, ceil($totalItems / $perPage));

$stmt = $pdo->prepare("
    SELECT co.*, u.username, u.balance, u.wallet as user_wallet, u.ip_address, u.created_at as user_created_at, u.is_banned, u.ban_reason,
           (
               COALESCE((SELECT SUM(reward) FROM completed_offers WHERE user_id = u.id AND reward > 0 AND (status IN ('1', 'approved') OR offer_type = 'WatchAd')), 0) + 
               COALESCE((SELECT SUM(commission) FROM referral_earnings WHERE user_id = u.id), 0)
           ) as total_earned,
           COALESCE((SELECT SUM(ABS(reward)) FROM completed_offers WHERE user_id = u.id AND reward < 0 AND status IN ('1', 'approved')), 0) as total_withdrawn,
           (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.id) as total_referrals
    FROM completed_offers co 
    LEFT JOIN users u ON co.user_id = u.id 
    $whereClause 
    ORDER BY co.id DESC 
    LIMIT $perPage OFFSET $offset
");
$stmt->execute($params);
$withdrawals = $stmt->fetchAll(PDO::FETCH_ASSOC);

$pendingCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE reward < 0 AND status = '0'")->fetchColumn();
$approvedCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE reward < 0 AND status = '1'")->fetchColumn();
$rejectedCount = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE reward < 0 AND status = '2'")->fetchColumn();

$exchangeRate = (float)(getSetting('exchange_rate') ?: 1000);
$currencyName = getSetting('currency_name') ?: 'Coins';
$site_logo = getSetting('site_logo') ?: '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Withdrawals - Admin Panel</title>
    <?php if (!empty($site_logo) && file_exists('../' . $site_logo)): ?>
    <link rel="icon" type="image/png" href="../<?php echo htmlspecialchars($site_logo); ?>" />
    <?php else: ?>
    <link rel="icon" type="image/png" href="data:," />
    <?php endif; ?>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

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
        .dark .swal2-popup { background: #151A25; color: #F8FAFC; border: 1px solid rgba(255,255,255,0.1); }
        .dark .swal2-title { color: #F8FAFC; }
        .dark .swal2-html-container { color: #94A3B8; }
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
            <a href="offers.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-clipboard-check w-5 text-center"></i> Offer Approval
            </a>
            <a href="withdrawals.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>

            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
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
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2"><i class="fas fa-money-bill-transfer"></i> <span class="truncate">Withdraws</span></div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Withdrawal Management</h1>
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

                <form method="POST" class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl shadow-sm mb-6 flex flex-col sm:flex-row items-center gap-4">
                    <div class="flex-1 w-full">
                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                            Auto-Withdrawal Limit (USD)
                        </label>
                        <input type="number" step="0.0001" name="auto_withdraw_limit_usd" value="<?php echo htmlspecialchars(getSetting('auto_withdraw_limit_usd') ?: '0.1'); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none font-medium text-sm">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                            <i class="fas fa-info-circle text-brand-primary"></i> 
                            Withdrawals <b>below</b> this amount = Instant transfer to user wallet. <br>
                            Withdrawals <b>at or above</b> this amount = Placed in Pending status for Admin approval.
                        </p>
                    </div>
                    <div class="w-full sm:w-auto mt-2 sm:mt-0 flex items-end h-full pt-6">
                        <button type="submit" name="save_withdraw_limit" value="1" class="w-full sm:w-auto px-6 py-3 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2">
                            <i class="fas fa-save"></i> Save Limit
                        </button>
                    </div>
                </form>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-amber-500/10 text-7xl"><i class="fas fa-clock"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-clock text-amber-500"></i> Pending Requests</div>
                        <div class="text-2xl font-extrabold text-amber-500"><?php echo number_format($pendingCount); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-7xl"><i class="fas fa-check-double"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-check-double text-emerald-500"></i> Paid Out</div>
                        <div class="text-2xl font-extrabold text-emerald-500"><?php echo number_format($approvedCount); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-red-500/10 text-7xl"><i class="fas fa-times-circle"></i></div>
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fas fa-times-circle text-red-500"></i> Rejected / Refunded</div>
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
                                    <i class="fas fa-check-double mr-1"></i> Paid
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
                                        <input type="text" name="search" value="<?php echo htmlspecialchars($search); ?>" placeholder="Search user, trans id..." class="w-full sm:w-52 pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-primary/50 text-gray-900 dark:text-white outline-none text-sm font-medium">
                                    </div>
                                    <button type="submit" class="px-4 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-colors"><i class="fas fa-search"></i></button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <?php if (empty($withdrawals)): ?>
                    <div class="text-center py-12">
                        <i class="fas fa-inbox text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400 font-bold">No <?php echo $tab; ?> requests found.</p>
                    </div>
                    <?php else: ?>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left border-b border-gray-200 dark:border-white/10">
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address / Info</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Value ($)</th>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                                    <?php if ($tab === 'pending'): ?>
                                    <th class="pb-3 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    <?php endif; ?>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                <?php foreach ($withdrawals as $w):
                                    $amount = abs((float)$w['reward']);
                                    $usdVal = ($exchangeRate > 0) ? ($amount / $exchangeRate) : 0;
                                    
                                    $userData = [
                                        'id' => $w['user_id'],
                                        'username' => $w['username'],
                                        'balance' => $w['balance'] ?? 0,
                                        'wallet' => $w['user_wallet'] ?? '-',
                                        'ip_address' => $w['ip_address'] ?? '-',
                                        'created_at' => $w['user_created_at'] ?? '',
                                        'total_earned' => $w['total_earned'] ?? 0,
                                        'total_withdrawn' => $w['total_withdrawn'] ?? 0,
                                        'total_referrals' => $w['total_referrals'] ?? 0,
                                        'is_banned' => $w['is_banned'] ?? 0,
                                        'ban_reason' => $w['ban_reason'] ?? ''
                                    ];
                                ?>
                                <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors <?php echo $userData['is_banned'] ? 'bg-red-50/50 dark:bg-red-500/5' : ''; ?>">
                                    <td class="py-4 pr-2"><span class="text-xs font-mono bg-gray-100 dark:bg-dark-900 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400">#<?php echo $w['id']; ?></span></td>
                                    <td class="py-4 pr-2">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-xs flex-shrink-0"><?php echo strtoupper(substr($w['username'] ?: 'U', 0, 1)); ?></div>
                                            <div class="min-w-0 flex flex-col items-start">
                                                <button type="button" onclick="openStatsModal(<?php echo htmlspecialchars(json_encode($userData), ENT_QUOTES, 'UTF-8'); ?>)" class="font-bold text-brand-primary hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate max-w-[150px] text-left">
                                                    <?php echo htmlspecialchars($w['username'] ?: 'User #' . $w['user_id']); ?>
                                                </button>
                                                <?php if ($userData['is_banned']): ?>
                                                    <span class="text-[10px] text-red-500 font-bold"><i class="fas fa-ban"></i> Banned</span>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-4 pr-2">
                                        <span class="font-bold text-gray-700 dark:text-gray-300 block mb-0.5"><?php echo htmlspecialchars($w['offer_name']); ?></span>
                                        <span class="inline-flex px-2 py-0.5 bg-gray-100 dark:bg-dark-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 rounded-md text-[9px] font-bold uppercase tracking-wider">
                                            <?php echo htmlspecialchars($w['offer_type']); ?>
                                        </span>
                                    </td>
                                    <td class="py-4 pr-2">
                                        <div class="flex flex-col gap-1 items-start">
                                            <?php if(!empty($w['trans_id'])): ?>
                                            <div class="flex items-center gap-2">
                                                <span class="font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title="<?php echo htmlspecialchars($w['trans_id']); ?>">
                                                    <?php echo htmlspecialchars($w['trans_id']); ?>
                                                </span>
                                                <button onclick="navigator.clipboard.writeText('<?php echo htmlspecialchars($w['trans_id']); ?>')" class="text-gray-400 hover:text-brand-primary transition-colors" title="Copy"><i class="far fa-copy"></i></button>
                                            </div>
                                            <?php else: ?>
                                            <span class="text-xs text-gray-400 italic">No extra info</span>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <td class="py-4 pr-2">
                                        <span class="font-extrabold text-amber-500 text-base"><?php echo number_format($amount, 2); ?></span>
                                        <span class="text-[10px] text-gray-400 block"><?php echo htmlspecialchars($currencyName); ?></span>
                                    </td>
                                    <td class="py-4 pr-2 hidden md:table-cell"><span class="font-bold text-gray-600 dark:text-gray-400">$<?php echo number_format($usdVal, 4); ?></span></td>
                                    <td class="py-4 pr-2 hidden lg:table-cell"><span class="text-xs text-gray-500 dark:text-gray-400"><?php echo date('M d, Y H:i', strtotime($w['created_at'])); ?></span></td>
                                    
                                    <?php if ($tab === 'pending'): ?>
                                    <td class="py-4 text-right">
                                        <div class="flex gap-2 justify-end">
                                            <button type="button" class="btn-approve px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20" data-id="<?php echo $w['id']; ?>">
                                                <i class="fas fa-check"></i> Paid
                                            </button>
                                            
                                            <button type="button" class="btn-reject px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-red-500/20" data-id="<?php echo $w['id']; ?>">
                                                <i class="fas fa-times"></i> Reject
                                            </button>
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
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — Withdrawals
                </div>
            </div>
        </main>
    </div>

    <div id="statsModal" class="fixed inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm z-[70] hidden flex items-center justify-center p-4">
        <div class="bg-white dark:bg-dark-800 rounded-3xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-white/10 animate-[fadeInUp_0.3s_ease-out] overflow-hidden flex flex-col max-h-[90vh]">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-dark-800 z-10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-xl">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-gray-900 dark:text-white text-lg leading-tight" id="statsModalTitle">User Stats</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-mono" id="statsModalId">#0</p>
                    </div>
                </div>
                <button onclick="closeStatsModal()" class="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-500 hover:text-red-500 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto">
                <div id="fraudAlert" class="hidden mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-4 items-start">
                    <i class="fas fa-triangle-exclamation text-red-500 text-2xl mt-1"></i>
                    <div>
                        <h4 class="font-bold text-red-600 dark:text-red-400 text-sm mb-1">Potential Fraud Detected</h4>
                        <p class="text-xs text-red-500/80 font-medium">This user's current balance + total withdrawn is greater than their total earned amount. This is mathematically impossible unless a bug or exploit occurred.</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div class="bg-gray-50 dark:bg-dark-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 relative z-10">Earned</div>
                        <div class="font-extrabold text-lg text-emerald-500 truncate relative z-10" id="statEarned">0.00</div>
                        <i class="fas fa-arrow-down absolute -bottom-2 -right-2 text-4xl text-emerald-500/5"></i>
                    </div>
                    <div class="bg-gray-50 dark:bg-dark-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 relative z-10">Withdrawn</div>
                        <div class="font-extrabold text-lg text-amber-500 truncate relative z-10" id="statWithdrawn">0.00</div>
                        <i class="fas fa-arrow-up absolute -bottom-2 -right-2 text-4xl text-amber-500/5"></i>
                    </div>
                    <div class="bg-gray-50 dark:bg-dark-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 relative z-10">Balance</div>
                        <div class="font-extrabold text-lg text-brand-primary truncate relative z-10" id="statBalance">0.00</div>
                        <i class="fas fa-wallet absolute -bottom-2 -right-2 text-4xl text-brand-primary/5"></i>
                    </div>
                    <div class="bg-gray-50 dark:bg-dark-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 relative z-10">Referrals</div>
                        <div class="font-extrabold text-lg text-gray-900 dark:text-white truncate relative z-10" id="statRefs">0</div>
                        <i class="fas fa-user-group absolute -bottom-2 -right-2 text-4xl text-gray-500/5"></i>
                    </div>
                </div>

                <div class="space-y-3 text-sm">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-dark-900 rounded-xl gap-2 border border-gray-100 dark:border-white/5">
                        <span class="text-gray-500 font-bold flex items-center gap-2"><i class="fas fa-envelope text-brand-primary"></i> User Wallet</span>
                        <span class="font-mono text-gray-900 dark:text-white break-all text-right" id="statWallet">-</span>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-dark-900 rounded-xl gap-2 border border-gray-100 dark:border-white/5">
                        <span class="text-gray-500 font-bold flex items-center gap-2"><i class="fas fa-network-wired text-brand-primary"></i> IP Address</span>
                        <span class="font-mono text-gray-900 dark:text-white" id="statIP">-</span>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-dark-900 rounded-xl gap-2 border border-gray-100 dark:border-white/5">
                        <span class="text-gray-500 font-bold flex items-center gap-2"><i class="fas fa-calendar-alt text-brand-primary"></i> Joined Date</span>
                        <span class="font-mono text-gray-900 dark:text-white" id="statJoined">-</span>
                    </div>
                </div>

                <div class="mt-6 pt-5 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3" id="statsModalActions"></div>
            </div>
        </div>
    </div>

    <div id="banModal" class="fixed inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm z-[80] hidden flex items-center justify-center p-4">
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
                    <input type="text" name="ban_reason" placeholder="e.g. Fraud, Multiple Accounts..." class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm">
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

        function openStatsModal(user) {
            document.getElementById('statsModalTitle').textContent = user.username || ('User #' + user.id);
            document.getElementById('statsModalId').textContent = '#' + user.id;
            
            const earned = parseFloat(user.total_earned) || 0;
            const withdrawn = parseFloat(user.total_withdrawn) || 0;
            const balance = parseFloat(user.balance) || 0;
            
            document.getElementById('statEarned').textContent = earned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
            document.getElementById('statWithdrawn').textContent = withdrawn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
            document.getElementById('statBalance').textContent = balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
            document.getElementById('statRefs').textContent = user.total_referrals;
            
            document.getElementById('statWallet').textContent = user.wallet || '-';
            document.getElementById('statIP').textContent = user.ip_address || '-';
            
            const dateObj = new Date(user.created_at);
            document.getElementById('statJoined').textContent = isNaN(dateObj) ? user.created_at : dateObj.toLocaleString();
            
            const fraudAlert = document.getElementById('fraudAlert');
            if ((withdrawn + balance) > (earned + 0.0001)) {
                fraudAlert.classList.remove('hidden');
            } else {
                fraudAlert.classList.add('hidden');
            }

            const actionsContainer = document.getElementById('statsModalActions');
            const safeUsername = (user.username || ('User #' + user.id)).replace(/'/g, "\\'");
            
            if (user.is_banned == 1) {
                actionsContainer.innerHTML = `
                    <form method="POST" class="m-0 w-full sm:w-auto" onsubmit="return confirm('Unban this user?')">
                        <input type="hidden" name="user_id" value="${user.id}">
                        <button type="submit" name="unban_user" value="1" class="w-full px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30">
                            <i class="fas fa-unlock"></i> Unban User
                        </button>
                    </form>
                `;
            } else {
                actionsContainer.innerHTML = `
                    <button type="button" onclick="closeStatsModal(); openBanModal(${user.id}, '${safeUsername}');" class="w-full sm:w-auto px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/30">
                        <i class="fas fa-ban"></i> Ban Suspicious User
                    </button>
                `;
            }
            
            document.getElementById('statsModal').classList.remove('hidden');
        }

        function closeStatsModal() {
            document.getElementById('statsModal').classList.add('hidden');
        }

        document.getElementById('statsModal').addEventListener('click', function(e) {
            if (e.target === this) closeStatsModal();
        });

        document.querySelectorAll('.btn-approve').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                Swal.fire({
                    title: 'Approve Withdrawal?',
                    text: "This will process the API payment and send funds to the user's wallet.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#10b981',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: '<i class="fas fa-check"></i> Yes, Pay Now!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        processAjaxAction(id, 'approve');
                    }
                });
            });
        });

        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                Swal.fire({
                    title: 'Reject Withdrawal?',
                    text: "This will reject the request and refund coins to the user's balance.",
                    icon: 'error',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: '<i class="fas fa-times"></i> Yes, Reject!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        processAjaxAction(id, 'reject');
                    }
                });
            });
        });

        function processAjaxAction(id, action) {
            Swal.fire({
                title: 'Processing...',
                text: 'Please wait while communicating with the API.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const formData = new FormData();
            formData.append('ajax_action', action);
            formData.append('id', id);

            fetch('', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success!',
                        text: data.message,
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Failed!',
                        text: data.error
                    });
                }
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'A network or server error occurred.'
                });
            });
        }
    </script>
</body>
</html>