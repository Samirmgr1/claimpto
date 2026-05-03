<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

// Create tables
$pdo->exec("CREATE TABLE IF NOT EXISTS lottery_draws (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    prize_pool DECIMAL(18,8) DEFAULT 0,
    winner_user_id INT DEFAULT NULL,
    winner_ticket_id INT DEFAULT NULL,
    status ENUM('active','drawn','cancelled') DEFAULT 'active',
    drawn_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uw (week_start)
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS lottery_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    draw_id INT NOT NULL,
    ticket_number VARCHAR(16) NOT NULL,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_draw (draw_id),
    INDEX idx_user_draw (user_id, draw_id)
)");

$success = '';
$error = '';

// Handle draw action
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    header('Content-Type: application/json');
    $action = $_POST['ajax_action'];

    if ($action === 'draw_now') {
        $draw_id = (int)$_POST['draw_id'];
        try {
            $stmt = $pdo->prepare("SELECT * FROM lottery_draws WHERE id = ? AND status = 'active'");
            $stmt->execute([$draw_id]);
            $draw = $stmt->fetch();
            if (!$draw) {
                echo json_encode(['success' => false, 'error' => 'Draw not found or already completed.']);
                exit;
            }
            $tickets = $pdo->prepare("SELECT lt.*, u.username, u.telegram_id FROM lottery_tickets lt JOIN users u ON lt.user_id = u.id WHERE lt.draw_id = ?");
            $tickets->execute([$draw_id]);
            $allTickets = $tickets->fetchAll();
            if (count($allTickets) === 0) {
                echo json_encode(['success' => false, 'error' => 'No tickets sold for this draw.']);
                exit;
            }
            $winnerTicket = $allTickets[array_rand($allTickets)];
            $prize = (float)(getSetting('lottery_prize') ?: 0);

            $pdo->beginTransaction();
            $pdo->prepare("UPDATE lottery_draws SET status = 'drawn', winner_user_id = ?, winner_ticket_id = ?, drawn_at = NOW() WHERE id = ?")->execute([$winnerTicket['user_id'], $winnerTicket['id'], $draw_id]);
            if ($prize > 0) {
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$prize, $winnerTicket['user_id']]);
                $trans_id = 'LOTTERY_' . $draw_id . '_' . $winnerTicket['user_id'];
                $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, status) VALUES (?, ?, 'Lottery Winner', 'Lottery', ?, 'completed')")->execute([$winnerTicket['user_id'], $trans_id, $prize]);
            }
            $pdo->commit();

            // Send personal congratulations to the winner
            $botToken = getSetting('telegram_bot_token');
            if ($botToken && !empty($winnerTicket['telegram_id'])) {
                $siteName = getSetting('site_name') ?: 'Mini App';
                $currencyName = getSetting('currency_name') ?: 'Coins';
                $msg = "🎉🎉🎉 <b>CONGRATULATIONS!</b> 🎉🎉🎉\n\n"
                     . "🏆 You are the <b>LOTTERY WINNER</b>!\n\n"
                     . "🎟 Winning Ticket: <b>#" . $winnerTicket['ticket_number'] . "</b>\n"
                     . "💰 Prize: <b>" . number_format($prize, 2) . " " . htmlspecialchars($currencyName) . "</b>\n"
                     . "📅 Week: " . $draw['week_start'] . " — " . $draw['week_end'] . "\n\n"
                     . "Your prize has been added to your balance! 🚀\n\n"
                     . "— <b>" . $siteName . "</b>";

                $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => [
                        'chat_id' => $winnerTicket['telegram_id'],
                        'text' => $msg,
                        'parse_mode' => 'HTML'
                    ],
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                curl_exec($ch);
                curl_close($ch);
            }

            // Broadcast winner announcement to ALL users via Telegram bot
            $broadcastResult = broadcastLotteryWinner(
                $pdo,
                $winnerTicket['username'],
                $winnerTicket['ticket_number'],
                $prize,
                $draw['week_start'],
                $draw['week_end']
            );

            $broadcastInfo = ' | Broadcast: ' . $broadcastResult['sent'] . ' sent, ' . $broadcastResult['failed'] . ' failed';
            echo json_encode(['success' => true, 'message' => 'Draw completed! Winner: ' . $winnerTicket['username'] . ' (Ticket #' . $winnerTicket['ticket_number'] . ')' . $broadcastInfo]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'cancel_draw') {
        $draw_id = (int)$_POST['draw_id'];
        try {
            $pdo->prepare("UPDATE lottery_draws SET status = 'cancelled' WHERE id = ? AND status = 'active'")->execute([$draw_id]);
            echo json_encode(['success' => true, 'message' => 'Draw cancelled.']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
}

// Save settings
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_lottery_settings'])) {
    foreach ($_POST['settings'] as $key => $value) {
        updateSetting($key, $value);
    }
    $success = "Lottery settings saved successfully!";
}

// Ensure current week draw exists
$now = new DateTime('now', new DateTimeZone('UTC'));
$dow = (int)$now->format('N'); // 1=Mon, 7=Sun
$weekStart = (clone $now)->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
$weekEnd = (clone $now)->modify('+' . (7 - $dow) . ' days')->format('Y-m-d');

$existingDraw = $pdo->prepare("SELECT id FROM lottery_draws WHERE week_start = ?");
$existingDraw->execute([$weekStart]);
if (!$existingDraw->fetchColumn()) {
    $pdo->prepare("INSERT INTO lottery_draws (week_start, week_end, status) VALUES (?, ?, 'active')")->execute([$weekStart, $weekEnd]);
}

// Fetch draws
$draws = $pdo->query("SELECT ld.*, u.username as winner_name, (SELECT COUNT(*) FROM lottery_tickets WHERE draw_id = ld.id) as ticket_count FROM lottery_draws ld LEFT JOIN users u ON ld.winner_user_id = u.id ORDER BY ld.id DESC LIMIT 20")->fetchAll();

// Current settings
$lottery_status = getSetting('lottery_status') ?: '1';
$lottery_prize = getSetting('lottery_prize') ?: '500';
$lottery_req_ads = getSetting('lottery_req_ads') ?: '10';
$lottery_req_earn = getSetting('lottery_req_earn') ?: '15';
$lottery_ticket_pool_increment = getSetting('lottery_ticket_pool_increment') ?: '10';

$site_logo = getSetting('site_logo') ?: '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lottery - Admin Panel</title>
    <?php if (!empty($site_logo) && file_exists('../' . $site_logo)): ?>
    <link rel="icon" type="image/png" href="../<?php echo htmlspecialchars($site_logo); ?>" />
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
            <a href="withdrawals.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="lottery.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
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
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2"><i class="fas fa-ticket"></i> <span class="truncate">Lottery</span></div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Lottery Management</h1>
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
            <div class="w-full max-w-4xl mx-auto space-y-6">

                <?php if ($success): ?>
                <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-check-circle text-xl"></i> <?php echo htmlspecialchars($success); ?></div>
                <?php endif; ?>
                <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-circle-exclamation text-xl"></i> <?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>

                <!-- Settings -->
                <form method="POST">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                        <h3 class="text-lg font-extrabold text-amber-600 dark:text-amber-400 mb-6 flex items-center gap-2"><i class="fas fa-ticket"></i> Lottery Settings</h3>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Status</label>
                                <select name="settings[lottery_status]" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm">
                                    <option value="1" <?php echo $lottery_status === '1' ? 'selected' : ''; ?>>Enabled</option>
                                    <option value="0" <?php echo $lottery_status === '0' ? 'selected' : ''; ?>>Disabled</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Weekly Prize (coins)</label>
                                <input type="number" name="settings[lottery_prize]" value="<?php echo htmlspecialchars($lottery_prize); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm" step="any">
                                <p class="text-[10px] text-gray-500 mt-1">Total prize awarded to the winner each week.</p>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Prize Pool Increment per Ticket</label>
                                <input type="number" name="settings[lottery_ticket_pool_increment]" value="<?php echo htmlspecialchars($lottery_ticket_pool_increment); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm" step="any" min="0">
                                <p class="text-[10px] text-gray-500 mt-1">Ticket is always free. This amount is added to the prize pool on every ticket claim.</p>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Required: Watch Ads</label>
                                <input type="number" name="settings[lottery_req_ads]" value="<?php echo htmlspecialchars($lottery_req_ads); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm" min="0">
                                <p class="text-[10px] text-gray-500 mt-1">User must watch this many ads today before claiming a ticket. Set 0 to skip.</p>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Required: Earn Tasks</label>
                                <input type="number" name="settings[lottery_req_earn]" value="<?php echo htmlspecialchars($lottery_req_earn); ?>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white outline-none font-medium text-sm" min="0">
                                <p class="text-[10px] text-gray-500 mt-1">User must complete this many Earn-section / Bitcotask PTC tasks today before claiming a ticket. Set 0 to skip.</p>
                            </div>
                        </div>

                        <div class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                            <p class="text-xs text-amber-700 dark:text-amber-400 font-medium"><i class="fas fa-info-circle mr-1"></i> Lottery runs weekly (Monday to Sunday, UTC). Users can claim 1 ticket per day, max 7 per week. Winner is drawn manually or via cron at week end.</p>
                        </div>

                        <div class="flex justify-end mt-6">
                            <button type="submit" name="save_lottery_settings" value="1" class="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-amber-500/30 flex items-center gap-2"><i class="fas fa-save"></i> Save Settings</button>
                        </div>
                    </div>
                </form>

                <!-- Draws -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-violet-500"></div>
                    <h3 class="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center gap-2"><i class="fas fa-trophy"></i> Draw History</h3>

                    <div class="space-y-4">
                        <?php foreach ($draws as $d): ?>
                        <div class="border <?php echo $d['status'] === 'active' ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-900/10' : ($d['status'] === 'drawn' ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-white/10'); ?> rounded-xl p-5">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <?php if ($d['status'] === 'active'): ?>
                                            <span class="text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg"><i class="fas fa-clock mr-1"></i> Active</span>
                                        <?php elseif ($d['status'] === 'drawn'): ?>
                                            <span class="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg"><i class="fas fa-check mr-1"></i> Drawn</span>
                                        <?php else: ?>
                                            <span class="text-xs font-bold text-gray-500 bg-gray-500/10 px-2.5 py-1 rounded-lg"><i class="fas fa-ban mr-1"></i> Cancelled</span>
                                        <?php endif; ?>
                                        <span class="text-sm font-bold text-gray-700 dark:text-gray-300"><?php echo $d['week_start']; ?> &mdash; <?php echo $d['week_end']; ?></span>
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-3 mt-1">
                                        <span><i class="fas fa-ticket text-amber-500 mr-1"></i> <?php echo $d['ticket_count']; ?> tickets</span>
                                        <?php if ($d['status'] === 'drawn' && $d['winner_name']): ?>
                                            <span><i class="fas fa-trophy text-emerald-500 mr-1"></i> Winner: <b><?php echo htmlspecialchars($d['winner_name']); ?></b></span>
                                            <?php if ($d['drawn_at']): ?>
                                                <span><i class="fas fa-calendar-check mr-1"></i> <?php echo $d['drawn_at']; ?></span>
                                            <?php endif; ?>
                                        <?php endif; ?>
                                    </div>
                                </div>
                                <?php if ($d['status'] === 'active'): ?>
                                <div class="flex gap-2">
                                    <button onclick="drawNow(<?php echo $d['id']; ?>)" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"><i class="fas fa-trophy mr-1"></i> Draw Now</button>
                                    <button onclick="cancelDraw(<?php echo $d['id']; ?>)" class="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl font-bold text-xs transition-colors"><i class="fas fa-ban mr-1"></i> Cancel</button>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php endforeach; ?>
                        <?php if (empty($draws)): ?>
                        <div class="text-center py-8 text-gray-400"><i class="fas fa-ticket text-4xl mb-3 opacity-30"></i><p class="font-bold">No draws yet</p></div>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev &mdash; Lottery Management
                </div>
            </div>
        </main>
    </div>

    <script>
        // Theme toggle
        const themeToggleDark = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLight = document.getElementById('theme-toggle-light-icon');
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            themeToggleLight.classList.remove('hidden');
        } else {
            themeToggleDark.classList.remove('hidden');
        }
        document.getElementById('theme-toggle').addEventListener('click', function() {
            themeToggleDark.classList.toggle('hidden');
            themeToggleLight.classList.toggle('hidden');
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        });

        // Sidebar
        function toggleSidebar() {
            const s = document.getElementById('sidebar'), o = document.getElementById('sidebar-overlay');
            s.classList.toggle('-translate-x-full');
            o.classList.toggle('hidden');
            setTimeout(() => o.classList.toggle('opacity-0'), 10);
        }
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        const overlay = document.getElementById('sidebar-overlay');
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);

        function drawNow(drawId) {
            Swal.fire({
                title: 'Draw Winner?',
                text: 'This will randomly select a winner from all tickets and award the prize. This cannot be undone.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Yes, Draw Now!',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch('lottery.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'ajax_action=draw_now&draw_id=' + drawId
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({ icon: 'success', title: 'Winner Drawn!', text: data.message }).then(() => location.reload());
                        } else {
                            Swal.fire({ icon: 'error', title: 'Error', text: data.error });
                        }
                    });
                }
            });
        }

        function cancelDraw(drawId) {
            Swal.fire({
                title: 'Cancel Draw?',
                text: 'This will cancel the current weekly draw. No winner will be selected.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Yes, Cancel It'
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch('lottery.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'ajax_action=cancel_draw&draw_id=' + drawId
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({ icon: 'success', title: 'Cancelled', text: data.message }).then(() => location.reload());
                        } else {
                            Swal.fire({ icon: 'error', title: 'Error', text: data.error });
                        }
                    });
                }
            });
        }
    </script>
</body>
</html>
