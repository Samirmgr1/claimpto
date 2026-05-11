<?php
if (!function_exists('couponEnsureTables')) {
    function couponEnsureTables($pdo) {
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

if (!function_exists('couponGetSetting')) {
    function couponGetSetting($key, $default = null) {
        if (function_exists('getSetting')) {
            $value = getSetting($key);
            return ($value === null || $value === '') ? $default : $value;
        }
        global $pdo;
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = ?");
        $stmt->execute([$key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return ($row && $row['value'] !== '') ? $row['value'] : $default;
    }
}

if (!function_exists('couponUpdateSetting')) {
    function couponUpdateSetting($key, $value) {
        if (function_exists('updateSetting')) {
            updateSetting($key, $value);
            return;
        }
        global $pdo;
        $stmt = $pdo->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");
        $stmt->execute([$key, $value]);
    }
}

if (!function_exists('couponRandomCode')) {
    function couponRandomCode($prefix = 'DROP') {
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/', '', $prefix));
        if ($prefix === '') $prefix = 'DROP';
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $suffix = '';
        for ($i = 0; $i < 8; $i++) {
            $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $prefix . '-' . $suffix;
    }
}

if (!function_exists('couponTelegramSendMessage')) {
    function couponTelegramSendMessage($botToken, $chatId, $message, $buttonUrl = '') {
        if (empty($botToken) || empty($chatId)) {
            return ['ok' => false, 'description' => 'Missing bot token or Telegram channel/chat id.'];
        }
        $url = "https://api.telegram.org/bot" . $botToken . "/sendMessage";
        $postData = [
            'chat_id' => $chatId,
            'text' => $message,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true
        ];

        // Build Mini App url button (web_app type not supported in channels)
        $botUsername = trim((string)couponGetSetting('telegram_bot_username', ''));
        $appShort = trim((string)couponGetSetting('telegram_app_shortname', ''));
        $btnAppText = couponGetSetting('auto_coupon_btn_text', '') ?: couponGetSetting('tg_btn_app_text', '') ?: '🎁 Claim Coupon';
        if ($botUsername !== '' && $appShort !== '') {
            $miniAppUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShort;
            $postData['reply_markup'] = json_encode([
                'inline_keyboard' => [[
                    ['text' => $btnAppText, 'url' => $miniAppUrl]
                ]]
            ]);
        }
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($response === false) {
            return ['ok' => false, 'description' => $curlError ?: 'Telegram request failed.'];
        }
        $data = json_decode($response, true);
        if (!is_array($data)) {
            return ['ok' => false, 'description' => 'Telegram returned an invalid response.', 'raw' => $response];
        }
        return $data;
    }
}

if (!function_exists('couponCreateAutoCoupon')) {
    function couponCreateAutoCoupon($force = false) {
        global $pdo;
        couponEnsureTables($pdo);

        $enabled = couponGetSetting('auto_coupon_enabled', '0') === '1';
        if (!$enabled && !$force) {
            return ['success' => false, 'message' => 'Auto coupon is disabled.'];
        }

        $intervalMinutes = max(1, (int)couponGetSetting('auto_coupon_interval_minutes', '60'));
        $lastSent = (int)couponGetSetting('auto_coupon_last_sent', '0');
        $nextAllowed = $lastSent + ($intervalMinutes * 60);
        if (!$force && $lastSent > 0 && time() < $nextAllowed) {
            return [
                'success' => false,
                'message' => 'Not time yet.',
                'next_run' => date('Y-m-d H:i:s', $nextAllowed)
            ];
        }

        $prefix = couponGetSetting('auto_coupon_prefix', 'DROP');
        $reward = (float)couponGetSetting('auto_coupon_reward', '10');
        $maxUses = max(1, (int)couponGetSetting('auto_coupon_max_uses', '50'));
        $expireHours = (int)couponGetSetting('auto_coupon_expire_hours', '24');
        $reqType = couponGetSetting('auto_coupon_req_offer_type', 'none');
        $reqAmount = (float)couponGetSetting('auto_coupon_req_offer_amount', '0');
        $reqTimeframe = couponGetSetting('auto_coupon_req_timeframe', 'all_time');
        $currency = couponGetSetting('currency_name', 'Coins');
        $siteName = couponGetSetting('site_name', 'Reward App');
        $channel = couponGetSetting('auto_coupon_channel', '');
        $botToken = couponGetSetting('telegram_bot_token', '');

        if ($reward <= 0) {
            return ['success' => false, 'message' => 'Auto coupon reward must be greater than 0.'];
        }
        if (empty($channel)) {
            return ['success' => false, 'message' => 'Telegram channel/chat id is missing.'];
        }
        if (empty($botToken)) {
            return ['success' => false, 'message' => 'Telegram bot token is missing. Save it in Settings first.'];
        }

        $expiresAt = null;
        if ($expireHours > 0) {
            $expiresAt = date('Y-m-d H:i:s', time() + ($expireHours * 3600));
        }

        $code = '';
        for ($try = 0; $try < 10; $try++) {
            $candidate = couponRandomCode($prefix);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM addon_coupons WHERE code = ?");
            $stmt->execute([$candidate]);
            if ((int)$stmt->fetchColumn() === 0) {
                $code = $candidate;
                break;
            }
        }
        if ($code === '') {
            return ['success' => false, 'message' => 'Could not generate a unique coupon code.'];
        }

        $stmt = $pdo->prepare("INSERT INTO addon_coupons (code, reward, max_uses, req_offer_type, req_offer_amount, req_timeframe, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$code, $reward, $maxUses, $reqType, $reqAmount, $reqTimeframe, $expiresAt]);
        $couponId = $pdo->lastInsertId();

        $messageTemplate = couponGetSetting('auto_coupon_message', "🎁 <b>{site_name} Coupon Drop!</b>\n\nCode: <code>{code}</code>\nReward: <b>{reward} {currency}</b>\nClaims: <b>{max_uses}</b> users\nExpires: <b>{expires}</b>\n\nTap the button below and claim it from the Home page!");
        $expiresText = $expiresAt ? date('M d, Y H:i', strtotime($expiresAt)) : 'No expiry';
        $message = str_replace(
            ['{site_name}', '{code}', '{reward}', '{currency}', '{max_uses}', '{expires}'],
            [$siteName, $code, rtrim(rtrim(number_format($reward, 8, '.', ''), '0'), '.'), $currency, $maxUses, $expiresText],
            $messageTemplate
        );

        $botUsername = trim((string)couponGetSetting('telegram_bot_username', ''));
        $appShortName = trim((string)couponGetSetting('telegram_app_shortname', ''));
        $claimUrl = '';
        if ($botUsername !== '' && $appShortName !== '') {
            $claimUrl = 'https://t.me/' . ltrim($botUsername, '@') . '/' . $appShortName . '?startapp=coupon';
        } elseif ($botUsername !== '') {
            $claimUrl = 'https://t.me/' . ltrim($botUsername, '@');
        }

        $telegramResponse = couponTelegramSendMessage($botToken, $channel, $message, $claimUrl);
        $telegramOk = isset($telegramResponse['ok']) && $telegramResponse['ok'];

        couponUpdateSetting('auto_coupon_last_sent', (string)time());
        couponUpdateSetting('auto_coupon_last_code', $code);

        if ($telegramOk) {
            couponUpdateSetting('auto_coupon_last_message_id', (string)($telegramResponse['result']['message_id'] ?? ''));
        }

        return [
            'success' => true,
            'message' => $telegramOk
                ? 'Auto coupon created and sent to Telegram.'
                : 'Auto coupon created but Telegram send failed: ' . ($telegramResponse['description'] ?? 'Unknown Telegram error'),
            'code' => $code,
            'reward' => $reward,
            'max_uses' => $maxUses,
            'expires_at' => $expiresAt,
            'telegram_ok' => $telegramOk,
            'telegram_message_id' => $telegramOk ? ($telegramResponse['result']['message_id'] ?? null) : null
        ];
    }
}
?>
