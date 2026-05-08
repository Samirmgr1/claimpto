<?php
require_once 'core/db.php';

$botToken = getSetting('telegram_bot_token');
$webAppUrl = "https://" . $_SERVER['HTTP_HOST'] . "/telegram.php";

$btnAppText = getSetting('tg_btn_app_text') ?: '🚀 Open App';
$btnChannelUrl = getSetting('tg_channel_url') ?: '';
$btnHelpUrl = getSetting('tg_btn_help_url') ?: 'https://t.me/your_support';
$siteName = getSetting('site_name') ?: 'Telegram Mini-App';

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (isset($update['message'])) {
    $chatId = $update['message']['chat']['id'];
    $text = $update['message']['text'];
    $firstName = htmlspecialchars($update['message']['from']['first_name']);

    if (strpos($text, '/start') === 0) {
        
        $rawMessage = getSetting('tg_welcome_message');
        if (empty($rawMessage)) {
            $rawMessage = "👋 <b>Hello, {name}!</b>\n\nWelcome to <b>{site_name} App</b>\n\nTap the button below to get started 👇";
        }
        $replyMessage = str_replace(['{name}', '{site_name}'], [$firstName, $siteName], $rawMessage);

        $secondRow = [];
        if (!empty($btnChannelUrl)) {
            $secondRow[] = ['text' => '👥 Join Channel', 'url' => $btnChannelUrl];
        }
        $secondRow[] = ['text' => '👥 Join Group', 'url' => $btnHelpUrl];

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => $btnAppText, 'web_app' => ['url' => $webAppUrl]]
                ],
                $secondRow
            ]
        ];

        $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
        $postData = [
            'chat_id' => $chatId,
            'text' => $replyMessage,
            'parse_mode' => 'HTML',
            'reply_markup' => json_encode($keyboard)
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_exec($ch);
        curl_close($ch);
    }
}
echo "OK";
?>