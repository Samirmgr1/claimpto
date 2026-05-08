<?php
/**
 * Lottery Auto-Draw Cron Job
 * Run this weekly (e.g. every Sunday at 23:59 UTC):
 *   curl https://yourdomain.com/lottery_draw.php?key=YOUR_CRON_KEY
 * 
 * Set the cron key in admin Settings > lottery_cron_key
 */
define('POSTBACK_MODE', true);
require_once 'core/db.php';
require_once 'core/functions.php';

$cronKey = getSetting('lottery_cron_key');
$providedKey = isset($_GET['key']) ? trim($_GET['key']) : '';

if (empty($cronKey) || $providedKey !== $cronKey) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid cron key']);
    exit;
}

header('Content-Type: application/json');

// Create tables if needed
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

// Find active draws that should be drawn (week_end <= today)
$now = new DateTime('now', new DateTimeZone('UTC'));
$today = $now->format('Y-m-d');

$stmt = $pdo->prepare("SELECT * FROM lottery_draws WHERE status = 'active' AND week_end <= ?");
$stmt->execute([$today]);
$activeDraws = $stmt->fetchAll();

$results = [];

foreach ($activeDraws as $draw) {
    $tickets = $pdo->prepare("SELECT lt.*, u.username, u.telegram_id FROM lottery_tickets lt JOIN users u ON lt.user_id = u.id WHERE lt.draw_id = ?");
    $tickets->execute([$draw['id']]);
    $allTickets = $tickets->fetchAll();

    if (count($allTickets) === 0) {
        $pdo->prepare("UPDATE lottery_draws SET status = 'cancelled' WHERE id = ?")->execute([$draw['id']]);
        $results[] = ['draw_id' => $draw['id'], 'result' => 'cancelled', 'reason' => 'No tickets'];
        continue;
    }

    $winnerTicket = $allTickets[array_rand($allTickets)];
    $basePrize = (float)(getSetting('lottery_prize') ?: 0);
    $poolPrize = (float)($draw['prize_pool'] ?? 0);
    $prize = $basePrize + $poolPrize;

    try {
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE lottery_draws SET status = 'drawn', winner_user_id = ?, winner_ticket_id = ?, drawn_at = NOW() WHERE id = ?")->execute([$winnerTicket['user_id'], $winnerTicket['id'], $draw['id']]);
        if ($prize > 0) {
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$prize, $winnerTicket['user_id']]);
            $trans_id = 'LOTTERY_' . $draw['id'] . '_' . $winnerTicket['user_id'];
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

        $results[] = [
            'draw_id' => $draw['id'],
            'result' => 'drawn',
            'winner' => $winnerTicket['username'],
            'ticket' => $winnerTicket['ticket_number'],
            'prize' => $prize,
            'broadcast' => $broadcastResult
        ];

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $results[] = ['draw_id' => $draw['id'], 'result' => 'error', 'message' => $e->getMessage()];
    }
}

echo json_encode(['status' => 'ok', 'draws_processed' => count($results), 'results' => $results]);
