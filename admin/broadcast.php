<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

// AJAX: Send broadcast in batches
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    header('Content-Type: application/json');

    if ($_POST['ajax_action'] === 'start_broadcast') {
        $message = trim($_POST['message'] ?? '');
        if (empty($message)) {
            echo json_encode(['success' => false, 'error' => 'Message cannot be empty.']);
            exit;
        }
        $botToken = getSetting('telegram_bot_token');
        if (empty($botToken)) {
            echo json_encode(['success' => false, 'error' => 'Bot token not configured. Go to Settings first.']);
            exit;
        }

        // Get all users with telegram_id
        $stmt = $pdo->query("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != '' AND is_banned = 0");
        $users = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($users)) {
            echo json_encode(['success' => false, 'error' => 'No users with Telegram ID found.']);
            exit;
        }

        // Store broadcast job in session
        $jobId = uniqid('bc_');
        $_SESSION['broadcast_' . $jobId] = [
            'message' => $message,
            'include_button' => !empty($_POST['include_button']),
            'users' => $users,
            'total' => count($users),
            'sent' => 0,
            'failed' => 0,
            'failed_ids' => [],
            'offset' => 0,
            'status' => 'running',
            'started_at' => time(),
            'retry_mode' => false
        ];

        echo json_encode(['success' => true, 'job_id' => $jobId, 'total' => count($users)]);
        exit;
    }

    if ($_POST['ajax_action'] === 'send_batch') {
        $jobId = $_POST['job_id'] ?? '';
        $key = 'broadcast_' . $jobId;
        if (empty($jobId) || !isset($_SESSION[$key])) {
            echo json_encode(['success' => false, 'error' => 'Invalid or expired broadcast job.']);
            exit;
        }

        $job = &$_SESSION[$key];
        $botToken = getSetting('telegram_bot_token');
        $batchSize = (int)($_POST['batch_size'] ?? 25);
        $batchSize = max(1, min(30, $batchSize));

        // Build reply markup
        $replyMarkup = null;
        if ($job['include_button']) {
            $botUsername = trim((string)getSetting('telegram_bot_username'));
            $appShort = trim((string)getSetting('telegram_app_shortname'));
            $btnText = getSetting('tg_btn_app_text') ?: '🚀 Open App';
            if ($botUsername !== '' && $appShort !== '') {
                $miniAppUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShort;
                $replyMarkup = json_encode([
                    'inline_keyboard' => [[
                        ['text' => $btnText, 'url' => $miniAppUrl]
                    ]]
                ]);
            }
        }

        $users = $job['users'];
        $offset = $job['offset'];
        $batch = array_slice($users, $offset, $batchSize);
        $batchSent = 0;
        $batchFailed = 0;
        $retryAfter = 0;

        foreach ($batch as $telegramId) {
            $postFields = [
                'chat_id' => $telegramId,
                'text' => $job['message'],
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true
            ];
            if ($replyMarkup) {
                $postFields['reply_markup'] = $replyMarkup;
            }

            $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postFields,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT => 15
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode == 200) {
                $batchSent++;
            } else {
                // Check for rate limit (429)
                $respData = json_decode($response, true);
                if ($httpCode == 429 && isset($respData['parameters']['retry_after'])) {
                    $retryAfter = (int)$respData['parameters']['retry_after'];
                    // Don't count this as failed, we'll retry
                    $job['failed_ids'][] = $telegramId;
                } else {
                    $batchFailed++;
                    $job['failed_ids'][] = $telegramId;
                }
            }
        }

        $job['sent'] += $batchSent;
        $job['failed'] += $batchFailed;
        $job['offset'] += count($batch);

        $done = $job['offset'] >= $job['total'];
        if ($done) {
            $job['status'] = 'completed';
        }

        echo json_encode([
            'success' => true,
            'sent' => $job['sent'],
            'failed' => $job['failed'],
            'pending' => max(0, $job['total'] - $job['offset']),
            'total' => $job['total'],
            'done' => $done,
            'retry_after' => $retryAfter,
            'progress' => round(($job['offset'] / $job['total']) * 100, 1)
        ]);
        exit;
    }

    if ($_POST['ajax_action'] === 'retry_failed') {
        $jobId = $_POST['job_id'] ?? '';
        $key = 'broadcast_' . $jobId;
        if (empty($jobId) || !isset($_SESSION[$key])) {
            echo json_encode(['success' => false, 'error' => 'Invalid or expired broadcast job.']);
            exit;
        }

        $job = &$_SESSION[$key];
        if (empty($job['failed_ids'])) {
            echo json_encode(['success' => true, 'message' => 'No failed messages to retry.', 'retried' => 0]);
            exit;
        }

        $botToken = getSetting('telegram_bot_token');
        $replyMarkup = null;
        if ($job['include_button']) {
            $botUsername = trim((string)getSetting('telegram_bot_username'));
            $appShort = trim((string)getSetting('telegram_app_shortname'));
            $btnText = getSetting('tg_btn_app_text') ?: '🚀 Open App';
            if ($botUsername !== '' && $appShort !== '') {
                $miniAppUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShort;
                $replyMarkup = json_encode([
                    'inline_keyboard' => [[
                        ['text' => $btnText, 'url' => $miniAppUrl]
                    ]]
                ]);
            }
        }

        $retried = 0;
        $stillFailed = [];
        foreach ($job['failed_ids'] as $telegramId) {
            $postFields = [
                'chat_id' => $telegramId,
                'text' => $job['message'],
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true
            ];
            if ($replyMarkup) {
                $postFields['reply_markup'] = $replyMarkup;
            }

            $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postFields,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT => 15
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode == 200) {
                $retried++;
                $job['sent']++;
                $job['failed']--;
            } else {
                $stillFailed[] = $telegramId;
            }

            if ($retried % 20 === 0) {
                usleep(1500000); // 1.5s pause every 20 retries
            }
        }

        $job['failed_ids'] = $stillFailed;
        echo json_encode([
            'success' => true,
            'retried' => $retried,
            'still_failed' => count($stillFailed),
            'sent' => $job['sent'],
            'failed' => $job['failed'],
            'total' => $job['total']
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Unknown action.']);
    exit;
}

// Get stats
$totalTgUsers = $pdo->query("SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL AND telegram_id != '' AND is_banned = 0")->fetchColumn();
$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();

$site_logo = getSetting('site_logo') ?: '';
$botToken = getSetting('telegram_bot_token');
$botConfigured = !empty($botToken);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broadcast - Admin Panel</title>
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
        .dark .bg-grid { background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px); }
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
            <a href="lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>
            <a href="admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
            </a>
            <a href="broadcast.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
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
                    <i class="fas fa-bullhorn"></i> <span class="truncate">Broadcast</span>
                </div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Telegram Broadcast</h1>
                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg"><?php echo number_format($totalTgUsers); ?> Reachable</span>
            </div>
            <div class="flex items-center gap-3 md:gap-4 ml-auto">
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
            <div class="w-full max-w-4xl mx-auto space-y-6">

                <!-- Stats Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-blue-500/10 text-6xl"><i class="fas fa-users"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-users text-blue-500"></i> Total Users</div>
                        <div class="text-xl font-black text-blue-500"><?php echo number_format($totalUsers); ?></div>
                    </div>
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-brand-primary/10 text-6xl"><i class="fab fa-telegram"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fab fa-telegram text-brand-primary"></i> Reachable</div>
                        <div class="text-xl font-black text-brand-primary"><?php echo number_format($totalTgUsers); ?></div>
                    </div>
                    <div id="stat-sent" class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-6xl"><i class="fas fa-check-circle"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-check-circle text-emerald-500"></i> Sent</div>
                        <div class="text-xl font-black text-emerald-500" id="count-sent">0</div>
                    </div>
                    <div id="stat-failed" class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                        <div class="absolute -right-4 -top-4 text-red-500/10 text-6xl"><i class="fas fa-times-circle"></i></div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1"><i class="fas fa-times-circle text-red-500"></i> Failed</div>
                        <div class="text-xl font-black text-red-500" id="count-failed">0</div>
                    </div>
                </div>

                <!-- Progress Bar (hidden initially) -->
                <div id="progress-section" class="hidden">
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent"></div>
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                                <i class="fas fa-paper-plane text-brand-primary"></i> <span id="progress-title">Broadcasting...</span>
                            </h4>
                            <span class="text-sm font-bold text-brand-primary" id="progress-percent">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-3 overflow-hidden">
                            <div id="progress-bar" class="h-3 bg-gradient-to-r from-brand-primary to-brand-accent rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
                        </div>
                        <div class="flex items-center justify-between mt-3 text-xs text-gray-500">
                            <span><b id="progress-sent">0</b> sent · <b id="progress-failed">0</b> failed</span>
                            <span><b id="progress-pending">0</b> pending</span>
                        </div>
                    </div>
                </div>

                <?php if (!$botConfigured): ?>
                <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 font-bold">
                    <i class="fas fa-circle-exclamation text-xl"></i> Telegram bot token not configured. <a href="settings.php" class="underline">Go to Settings</a> to set it up.
                </div>
                <?php endif; ?>

                <!-- Compose Message -->
                <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    <h3 class="text-lg font-extrabold text-blue-500 flex items-center gap-2 mb-5"><i class="fas fa-pen-fancy"></i> Compose Message</h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Message (HTML supported)</label>
                            <textarea id="broadcast-message" rows="6" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-500/50 transition-all resize-y" placeholder="Type your broadcast message here...&#10;&#10;Supports HTML: <b>bold</b>, <i>italic</i>, <code>code</code>, <a href='url'>link</a>"></textarea>
                            <p class="text-[10px] text-gray-400 mt-1">Supports HTML tags: &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;code&gt;, &lt;pre&gt;, &lt;a href=&quot;&quot;&gt;</p>
                        </div>

                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="include-button" checked class="w-5 h-5 accent-blue-500">
                                <span class="font-bold text-sm text-gray-700 dark:text-gray-300">Include App Button</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <label class="text-xs font-bold text-gray-500">Batch Size:</label>
                                <select id="batch-size" class="px-3 py-1.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-bold outline-none">
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="25" selected>25</option>
                                    <option value="30">30</option>
                                </select>
                                <span class="text-[10px] text-gray-400">msgs/batch</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-xs font-bold text-gray-500">Delay:</label>
                                <select id="batch-delay" class="px-3 py-1.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-bold outline-none">
                                    <option value="1000">1s</option>
                                    <option value="1500" selected>1.5s</option>
                                    <option value="2000">2s</option>
                                    <option value="3000">3s</option>
                                </select>
                                <span class="text-[10px] text-gray-400">between batches</span>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-3 pt-2">
                            <button id="btn-send" onclick="startBroadcast()" class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 <?php echo $botConfigured ? '' : 'opacity-50 cursor-not-allowed'; ?>" <?php echo $botConfigured ? '' : 'disabled'; ?>>
                                <i class="fas fa-paper-plane"></i> Send Broadcast
                            </button>
                            <button id="btn-retry" onclick="retryFailed()" class="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 hidden">
                                <i class="fas fa-rotate-right"></i> Retry Failed (<span id="retry-count">0</span>)
                            </button>
                            <button id="btn-stop" onclick="stopBroadcast()" class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hidden">
                                <i class="fas fa-stop"></i> Stop
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tips -->
                <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-white/5 rounded-2xl">
                    <i class="fas fa-circle-info text-gray-400 mt-0.5"></i>
                    <div class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        <p><b>Tips:</b> Telegram allows ~30 messages/second. The broadcast sends in batches with configurable delays to avoid rate limits. If some messages fail due to flood limits, use the <b>Retry Failed</b> button after the broadcast completes. Users who blocked the bot will always fail.</p>
                    </div>
                </div>

                <div class="text-center py-4 text-xs text-gray-400 dark:text-gray-600 font-medium">
                    <i class="fas fa-shield-halved text-brand-primary"></i> Weadev — Broadcast
                </div>
            </div>
        </main>
    </div>

    <script>
    let currentJobId = null;
    let isSending = false;
    let stopRequested = false;

    function startBroadcast() {
        const message = document.getElementById('broadcast-message').value.trim();
        if (!message) {
            alert('Please enter a message.');
            return;
        }
        if (!confirm('Send this message to all ' + <?php echo (int)$totalTgUsers; ?> + ' Telegram users?')) return;

        const includeButton = document.getElementById('include-button').checked ? '1' : '0';
        
        document.getElementById('btn-send').disabled = true;
        document.getElementById('btn-send').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Starting...';
        document.getElementById('btn-stop').classList.remove('hidden');
        document.getElementById('btn-retry').classList.add('hidden');
        document.getElementById('progress-section').classList.remove('hidden');
        stopRequested = false;

        const formData = new FormData();
        formData.append('ajax_action', 'start_broadcast');
        formData.append('message', message);
        formData.append('include_button', includeButton);

        fetch('broadcast.php', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    alert(data.error);
                    resetUI();
                    return;
                }
                currentJobId = data.job_id;
                isSending = true;
                document.getElementById('progress-pending').textContent = data.total;
                document.getElementById('btn-send').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending...';
                sendNextBatch();
            })
            .catch(err => {
                alert('Error: ' + err.message);
                resetUI();
            });
    }

    function sendNextBatch() {
        if (!isSending || stopRequested || !currentJobId) {
            finishBroadcast();
            return;
        }

        const batchSize = document.getElementById('batch-size').value;
        const delay = parseInt(document.getElementById('batch-delay').value);

        const formData = new FormData();
        formData.append('ajax_action', 'send_batch');
        formData.append('job_id', currentJobId);
        formData.append('batch_size', batchSize);

        fetch('broadcast.php', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    alert(data.error);
                    finishBroadcast();
                    return;
                }

                updateStats(data.sent, data.failed, data.pending, data.progress);

                if (data.done) {
                    finishBroadcast();
                    return;
                }

                // If rate limited, wait longer
                let waitTime = delay;
                if (data.retry_after > 0) {
                    waitTime = Math.max(delay, data.retry_after * 1000 + 500);
                    document.getElementById('progress-title').textContent = 'Rate limited, waiting ' + Math.ceil(waitTime / 1000) + 's...';
                } else {
                    document.getElementById('progress-title').textContent = 'Broadcasting...';
                }

                setTimeout(sendNextBatch, waitTime);
            })
            .catch(err => {
                console.error('Batch error:', err);
                // Retry after a delay on network errors
                setTimeout(sendNextBatch, 3000);
            });
    }

    function stopBroadcast() {
        if (confirm('Stop the broadcast? Already sent messages cannot be undone.')) {
            stopRequested = true;
            isSending = false;
        }
    }

    function finishBroadcast() {
        isSending = false;
        document.getElementById('btn-send').disabled = false;
        document.getElementById('btn-send').innerHTML = '<i class="fas fa-paper-plane"></i> Send Broadcast';
        document.getElementById('btn-stop').classList.add('hidden');
        document.getElementById('progress-title').textContent = stopRequested ? 'Broadcast Stopped' : 'Broadcast Complete!';

        const failCount = parseInt(document.getElementById('count-failed').textContent);
        if (failCount > 0) {
            document.getElementById('btn-retry').classList.remove('hidden');
            document.getElementById('retry-count').textContent = failCount;
        }
    }

    function retryFailed() {
        if (!currentJobId) return;
        
        document.getElementById('btn-retry').disabled = true;
        document.getElementById('btn-retry').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Retrying...';

        const formData = new FormData();
        formData.append('ajax_action', 'retry_failed');
        formData.append('job_id', currentJobId);

        fetch('broadcast.php', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('count-sent').textContent = data.sent;
                    document.getElementById('progress-sent').textContent = data.sent;
                    document.getElementById('count-failed').textContent = data.failed;
                    document.getElementById('progress-failed').textContent = data.failed;
                    
                    if (data.still_failed > 0) {
                        document.getElementById('retry-count').textContent = data.still_failed;
                        document.getElementById('btn-retry').disabled = false;
                        document.getElementById('btn-retry').innerHTML = '<i class="fas fa-rotate-right"></i> Retry Failed (<span id="retry-count">' + data.still_failed + '</span>)';
                        document.getElementById('progress-title').textContent = 'Retried ' + data.retried + ', ' + data.still_failed + ' still failed';
                    } else {
                        document.getElementById('btn-retry').classList.add('hidden');
                        document.getElementById('progress-title').textContent = 'All retries successful!';
                    }
                } else {
                    alert(data.error || 'Retry failed.');
                    document.getElementById('btn-retry').disabled = false;
                    document.getElementById('btn-retry').innerHTML = '<i class="fas fa-rotate-right"></i> Retry Failed (<span id="retry-count">' + document.getElementById('count-failed').textContent + '</span>)';
                }
            })
            .catch(err => {
                alert('Error: ' + err.message);
                document.getElementById('btn-retry').disabled = false;
                document.getElementById('btn-retry').innerHTML = '<i class="fas fa-rotate-right"></i> Retry Failed';
            });
    }

    function updateStats(sent, failed, pending, progress) {
        document.getElementById('count-sent').textContent = sent;
        document.getElementById('count-failed').textContent = failed;
        document.getElementById('progress-sent').textContent = sent;
        document.getElementById('progress-failed').textContent = failed;
        document.getElementById('progress-pending').textContent = pending;
        document.getElementById('progress-percent').textContent = progress + '%';
        document.getElementById('progress-bar').style.width = progress + '%';
    }

    function resetUI() {
        document.getElementById('btn-send').disabled = false;
        document.getElementById('btn-send').innerHTML = '<i class="fas fa-paper-plane"></i> Send Broadcast';
        document.getElementById('btn-stop').classList.add('hidden');
    }

    // Theme toggle
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

    // Sidebar toggle
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
