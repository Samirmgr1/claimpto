<?php
if (!function_exists('getSetting')) {
    function getSetting($key) {
        global $pdo;
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = ?");
        $stmt->execute([$key]);
        return $stmt->fetchColumn();
    }
}

if (!function_exists('updateSetting')) {
    function updateSetting($key, $value) {
        global $pdo;
        $stmt = $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");
        return $stmt->execute([$key, $value]);
    }
}

if (!function_exists('ensureCouponTables')) {
    function ensureCouponTables($pdo) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS addon_coupons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(100) NOT NULL UNIQUE,
            reward DECIMAL(20,8) NOT NULL DEFAULT 0,
            max_uses INT NOT NULL DEFAULT 1,
            used_count INT NOT NULL DEFAULT 0,
            req_offer_type VARCHAR(20) NOT NULL DEFAULT 'none',
            req_offer_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
            req_timeframe VARCHAR(20) NOT NULL DEFAULT 'all_time',
            expires_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS addon_coupon_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            coupon_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_coupon (user_id, coupon_id),
            KEY idx_coupon_id (coupon_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
}

if (!function_exists('autoCouponCreateCode')) {
    function autoCouponCreateCode($prefix = 'DAILY') {
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/', '', $prefix));
        if ($prefix === '') $prefix = 'DAILY';
        return $prefix . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    }
}

if (!function_exists('sendTelegramChannelMessage')) {
    function sendTelegramChannelMessage($text) {
        $botToken = trim((string)getSetting('telegram_bot_token'));
        $channel = trim((string)getSetting('auto_coupon_channel'));
        if ($botToken === '' || $channel === '') {
            return ['ok' => false, 'message' => 'Telegram bot token or channel is missing.'];
        }

        $postFields = [
            'chat_id' => $channel,
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true
        ];

        // Build Mini App url button (web_app type not supported in channels)
        $botUsername = trim((string)getSetting('telegram_bot_username'));
        $appShort = trim((string)getSetting('telegram_app_shortname'));
        $btnAppText = getSetting('tg_btn_app_text') ?: '🚀 Open App';
        if ($botUsername !== '' && $appShort !== '') {
            $miniAppUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShort;
            $postFields['reply_markup'] = json_encode([
                'inline_keyboard' => [[
                    ['text' => $btnAppText, 'url' => $miniAppUrl]
                ]]
            ]);
        }

        $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_POSTFIELDS => $postFields
        ]);
        $response = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        if ($response === false) return ['ok' => false, 'message' => $err ?: 'Telegram request failed.'];
        $json = json_decode($response, true);
        if (!empty($json['ok'])) return ['ok' => true, 'message' => 'Sent'];
        return ['ok' => false, 'message' => $json['description'] ?? $response];
    }
}

if (!function_exists('generateAutoCoupon')) {
    function generateAutoCoupon($force = false) {
        global $pdo;
        ensureCouponTables($pdo);

        $enabled = getSetting('auto_coupon_status') === '1';
        if (!$enabled && !$force) {
            return ['success' => false, 'message' => 'Auto coupon is disabled.'];
        }

        $today = date('Y-m-d');
        $lastDate = (string)getSetting('auto_coupon_last_date');
        if (!$force && $lastDate === $today) {
            return ['success' => false, 'message' => 'Today\'s auto coupon was already generated.'];
        }

        $min = (float)(getSetting('auto_coupon_reward_min') ?: 10);
        $max = (float)(getSetting('auto_coupon_reward_max') ?: 50);
        if ($min <= 0) $min = 10;
        if ($max < $min) $max = $min;
        $reward = random_int((int)round($min * 100), (int)round($max * 100)) / 100;

        $maxUses = (int)(getSetting('auto_coupon_max_uses') ?: 100);
        if ($maxUses <= 0) $maxUses = 100;
        $prefix = getSetting('auto_coupon_prefix') ?: 'DAILY';
        $expiresHours = (int)(getSetting('auto_coupon_expires_hours') ?: 24);
        if ($expiresHours <= 0) $expiresHours = 24;
        $expiresAt = date('Y-m-d H:i:s', time() + ($expiresHours * 3600));

        $code = autoCouponCreateCode($prefix);
        for ($i = 0; $i < 5; $i++) {
            try {
                $stmt = $pdo->prepare("INSERT INTO addon_coupons (code, reward, max_uses, req_offer_type, req_offer_amount, req_timeframe, expires_at) VALUES (?, ?, ?, 'none', 0, 'all_time', ?)");
                $stmt->execute([$code, $reward, $maxUses, $expiresAt]);
                break;
            } catch (PDOException $e) {
                if ($i === 4) throw $e;
                $code = autoCouponCreateCode($prefix);
            }
        }

        $currency = getSetting('currency_name') ?: 'Coins';
        $siteName = getSetting('site_name') ?: 'Mini App';
        $botUsername = trim((string)getSetting('telegram_bot_username'));
        $openLine = $botUsername !== '' ? "\n\nOpen app: https://t.me/" . htmlspecialchars($botUsername) : '';
        $message = "🎁 <b>Daily Coupon Code</b>\n\n" .
                   "Code: <code>{$code}</code>\n" .
                   "Reward: <b>" . number_format($reward, 2) . " {$currency}</b>\n" .
                   "Claims: <b>{$maxUses}</b> users\n" .
                   "Expires: <b>" . date('M d, Y H:i', strtotime($expiresAt)) . "</b>\n\n" .
                   "Redeem it from the Home section in {$siteName}." . $openLine;

        $telegram = sendTelegramChannelMessage($message);
        updateSetting('auto_coupon_last_date', $today);
        updateSetting('auto_coupon_last_code', $code);
        updateSetting('auto_coupon_last_sent', date('Y-m-d H:i:s'));
        updateSetting('auto_coupon_last_telegram_status', $telegram['ok'] ? 'success' : ('error: ' . $telegram['message']));

        return [
            'success' => true,
            'message' => $telegram['ok'] ? 'Coupon created and sent to Telegram.' : 'Coupon created, but Telegram send failed: ' . $telegram['message'],
            'code' => $code,
            'reward' => $reward,
            'max_uses' => $maxUses,
            'expires_at' => $expiresAt,
            'telegram_ok' => $telegram['ok'],
            'telegram_message' => $telegram['message']
        ];
    }
}
?>
