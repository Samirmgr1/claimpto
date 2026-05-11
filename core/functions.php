<?php
function getUserIP() {
    if (isset($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    } elseif (isset($_SERVER['REMOTE_ADDR'])) {
        return $_SERVER['REMOTE_ADDR'];
    }
    return 'Unknown IP';
}

function getUserCountry($ip = null) {
    if (isset($_SERVER['HTTP_CF_IPCOUNTRY']) && $_SERVER['HTTP_CF_IPCOUNTRY'] !== 'XX') {
        return strtoupper($_SERVER['HTTP_CF_IPCOUNTRY']);
    }
    if (empty($ip)) {
        $ip = getUserIP();
    }
    if (!empty($ip) && $ip !== '127.0.0.1' && $ip !== '::1') {
        $apiUrl = "https://ipapi.co/{$ip}/country/";
        $country = @file_get_contents($apiUrl);
        if ($country && preg_match('/^[A-Z]{2}$/', trim($country))) {
            return trim($country);
        }
    }
    return 'US';
}

function requestWithCurl($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        return false;
    }
    curl_close($ch);
    return $response;
}

function getCachedCryptoPrice($coin, $cacheTtl = 300) {
    global $pdo;
    $coinUpper = strtoupper(trim($coin));
    $stmt = $pdo->prepare("SELECT price, updated_at FROM price_cache WHERE coin = ?");
    $stmt->execute([$coinUpper]);
    $cached = $stmt->fetch();
    if ($cached && (time() - $cached['updated_at']) < $cacheTtl) {
        return (float)$cached['price'];
    }
    $price = getCryptoPrice($coin);
    if ($price && $price > 0) {
        $stmt = $pdo->prepare("REPLACE INTO price_cache (coin, price, updated_at) VALUES (?, ?, ?)");
        $stmt->execute([$coinUpper, $price, time()]);
    } elseif ($cached) {
        return (float)$cached['price'];
    }
    return $price;
}

function getAllCachedPrices($coins, $cacheTtl = 300) {
    $prices = [];
    foreach ($coins as $coin) {
        $coin = strtoupper(trim($coin));
        $p = getCachedCryptoPrice($coin, $cacheTtl);
        if ($p && $p > 0) {
            $prices[$coin] = $p;
        }
    }
    return $prices;
}

function getCryptoPrice($coin) {
    $coinUpper = strtoupper($coin);
    if (in_array($coinUpper, ['AoyUSD', 'USDT', 'USDC', 'USD'])) {
        return 1.0;
    }
    $symbol = $coinUpper . 'USDT';
    $url = "https://api.binance.com/api/v3/ticker/price?symbol=$symbol";
    $response = requestWithCurl($url);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['price'])) {
            return (float)$data['price'];
        }
    }
    $url = "https://min-api.cryptocompare.com/data/price?fsym=$coinUpper&tsyms=USD";
    $response = requestWithCurl($url);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['USD'])) {
            return (float)$data['USD'];
        }
    }
    $coinGeckoMap = [
        'BTC'   => 'bitcoin',
        'ETH'   => 'ethereum',
        'DOGE'  => 'dogecoin',
        'LTC'   => 'litecoin',
        'BCH'   => 'bitcoin-cash',
        'DASH'  => 'dash',
        'DGB'   => 'digibyte',
        'TRX'   => 'tron',
        'ZEC'   => 'zcash',
        'BNB'   => 'binancecoin',
        'SOL'   => 'solana',
        'XRP'   => 'ripple',
        'POL'   => 'polygon-ecosystem-token',
        'ADA'   => 'cardano',
        'TON'   => 'the-open-network',
        'XLM'   => 'stellar',
        'XMR'   => 'monero',
        'TARA'  => 'taraxa',
        'TRUMP' => 'maga',
        'PEPE'  => 'pepe'
    ];
    $cgId = isset($coinGeckoMap[$coinUpper]) ? $coinGeckoMap[$coinUpper] : strtolower($coin);
    $url = "https://api.coingecko.com/api/v3/simple/price?ids={$cgId}&vs_currencies=usd";
    $response = requestWithCurl($url);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data[$cgId]['usd'])) {
            return (float)$data[$cgId]['usd'];
        }
    }
    return false;
}

/**
 * Broadcast a lottery winner announcement to ALL users who have a telegram_id.
 * Sends a public announcement so every user knows who won.
 */
function broadcastLotteryWinner($pdo, $winnerUsername, $ticketNumber, $prize, $weekStart, $weekEnd) {
    $botToken = getSetting('telegram_bot_token');
    if (empty($botToken)) return ['sent' => 0, 'failed' => 0, 'error' => 'Bot token not configured'];

    $siteName = getSetting('site_name') ?: 'Mini App';
    $currencyName = getSetting('currency_name') ?: 'Coins';

    $maskedWinner = $winnerUsername;
    if (strlen($winnerUsername) > 4) {
        $maskedWinner = substr($winnerUsername, 0, 2) . str_repeat('*', strlen($winnerUsername) - 4) . substr($winnerUsername, -2);
    }

    $msg = "🏆🎰 <b>LOTTERY WINNER ANNOUNCED!</b> 🎰🏆\n\n"
         . "🎉 <b>" . htmlspecialchars($maskedWinner) . "</b> just won the weekly lottery!\n\n"
         . "🎟 Winning Ticket: <b>#" . htmlspecialchars($ticketNumber) . "</b>\n"
         . "💰 Prize: <b>" . number_format($prize, 2) . " " . htmlspecialchars($currencyName) . "</b>\n"
         . "📅 Week: " . htmlspecialchars($weekStart) . " — " . htmlspecialchars($weekEnd) . "\n\n"
         . "🍀 Want to be the next winner? Claim your free lottery tickets daily!\n\n"
         . "— <b>" . htmlspecialchars($siteName) . "</b>";

    // Build Mini App url button (url type works everywhere - channels, groups, DMs)
    $botUsername = trim((string)getSetting('telegram_bot_username'));
    $appShort = trim((string)getSetting('telegram_app_shortname'));
    $btnAppText = getSetting('tg_btn_app_text') ?: '🚀 Open App';
    $replyMarkup = null;
    if ($botUsername !== '' && $appShort !== '') {
        $miniAppUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShort;
        $replyMarkup = json_encode([
            'inline_keyboard' => [[
                ['text' => $btnAppText, 'url' => $miniAppUrl]
            ]]
        ]);
    }

    $stmt = $pdo->query("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != '' AND is_banned = 0");
    $allUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $sent = 0;
    $failed = 0;

    foreach ($allUsers as $telegramId) {
        $postFields = [
            'chat_id' => $telegramId,
            'text' => $msg,
            'parse_mode' => 'HTML'
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
            CURLOPT_TIMEOUT => 10
        ]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode == 200) {
            $sent++;
        } else {
            $failed++;
        }

        // Rate limit: Telegram allows ~30 messages/sec
        if (($sent + $failed) % 25 === 0) {
            usleep(1000000); // 1 second pause every 25 messages
        }
    }

    return ['sent' => $sent, 'failed' => $failed, 'total' => count($allUsers)];
}

/**
 * Auto-draw expired lottery draws and create new ones.
 * Call this on page loads to ensure draws complete on time without a cron job.
 */
function lotteryAutoDraw($pdo) {
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $today = $now->format('Y-m-d');

    // Find active draws past their end date
    $stmt = $pdo->prepare("SELECT * FROM lottery_draws WHERE status = 'active' AND week_end <= ?");
    $stmt->execute([$today]);
    $expiredDraws = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($expiredDraws as $draw) {
        $tickets = $pdo->prepare("SELECT lt.*, u.username, u.telegram_id FROM lottery_tickets lt JOIN users u ON lt.user_id = u.id WHERE lt.draw_id = ?");
        $tickets->execute([$draw['id']]);
        $allTickets = $tickets->fetchAll(PDO::FETCH_ASSOC);

        if (count($allTickets) === 0) {
            $pdo->prepare("UPDATE lottery_draws SET status = 'cancelled' WHERE id = ?")->execute([$draw['id']]);
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

            // Notify winner via Telegram
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
                    CURLOPT_POSTFIELDS => ['chat_id' => $winnerTicket['telegram_id'], 'text' => $msg, 'parse_mode' => 'HTML'],
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                curl_exec($ch);
                curl_close($ch);
            }

            // Broadcast to all users
            broadcastLotteryWinner($pdo, $winnerTicket['username'], $winnerTicket['ticket_number'], $prize, $draw['week_start'], $draw['week_end']);

        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
        }
    }

    // Auto-create new draw for current week if none exists
    $dow = (int)$now->format('N');
    $weekStart = (clone $now)->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
    $weekEnd = (clone $now)->modify('+' . (7 - $dow) . ' days')->format('Y-m-d');
    $chk = $pdo->prepare("SELECT id FROM lottery_draws WHERE week_start = ? AND status = 'active'");
    $chk->execute([$weekStart]);
    if (!$chk->fetchColumn()) {
        try {
            $pdo->prepare("INSERT IGNORE INTO lottery_draws (week_start, week_end, status) VALUES (?, ?, 'active')")->execute([$weekStart, $weekEnd]);
        } catch (Exception $e) {}
    }
}

if (!defined('POSTBACK_MODE') && session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!defined('POSTBACK_MODE') && isset($_SESSION['user_id']) && isset($_SESSION['login_ip']) && empty($_SESSION['is_telegram'])) {
    $current_ip = getUserIP();
    
    if ($current_ip !== $_SESSION['login_ip']) {
        session_unset();
        session_destroy();
        
        setcookie('remember_browser', '', time() - 3600, '/');
        
        echo "<script>
            alert('Security Alert: IP Address change detected. For your safety, you have been logged out.');
            window.top.location.href = '/'; 
        </script>";
        exit();
    }
}
?>