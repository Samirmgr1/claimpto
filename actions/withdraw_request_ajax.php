<?php
ob_start();
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';
if (ob_get_length()) ob_clean();
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Not logged in.']);
    exit;
}
$user_id = $_SESSION['user_id'];
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();
if (!$user) {
    echo json_encode(['status' => 'error', 'message' => 'User not found.']);
    exit;
}
$min_withdrawal = (float)(getSetting('min_withdrawal') ?: 100);
$exchange_rate = (float)(getSetting('exchange_rate') ?: 1000);
$currency_input = isset($_POST['currency']) ? trim($_POST['currency']) : (getSetting('faucetpay_currency') ?: 'USDT');
$allowed_coins_str = getSetting('allowed_coins') ?: 'USDT';
$allowed_coins = array_filter(array_map('trim', explode(',', $allowed_coins_str)));
$currency = '';
foreach ($allowed_coins as $allowed_coin) {
    if (strcasecmp($currency_input, $allowed_coin) === 0) {
        $currency = $allowed_coin;
        break;
    }
}
if ($currency === '') {
    echo json_encode(['status' => 'error', 'message' => 'This coin is not allowed for withdrawal.']);
    exit;
}
if ($user['balance'] < $min_withdrawal) {
    echo json_encode(['status' => 'error', 'message' => 'Minimum withdrawal is ' . $min_withdrawal . ' coins.']);
    exit;
}
if ($exchange_rate <= 0) $exchange_rate = 1000;
$usd_value = $user['balance'] / $exchange_rate;
$coin_price = getCachedCryptoPrice($currency);
if (!$coin_price || $coin_price <= 0) {
    if (strtoupper($currency) === 'AOYUSD') {
        $coin_price = 1.0;
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to fetch ' . $currency . ' price. Please try another coin.']);
        exit;
    }
}
$amount_decimal = $usd_value / $coin_price;
$amount_to_pay_display = number_format($amount_decimal, 8, '.', '');
$wallet = $user['wallet'];
if (empty($wallet)) {
    echo json_encode(['status' => 'error', 'message' => 'Your wallet address is not set. Please update your profile.']);
    exit;
}
$gateway = 'faucetpay';
$gateway_api_key = trim(getSetting('faucetpay_api_key'));
if (empty($gateway_api_key)) {
    echo json_encode(['status' => 'error', 'message' => 'FaucetPay API Key is missing in Admin Panel.']);
    exit;
}
$paymentSuccess = false;
$paymentErrorMsg = 'Unknown error';
$transaction_id = '';
{
    $amount_satoshi = (string)round($amount_decimal * 100000000);
    if ((float)$amount_decimal <= 0 || (int)$amount_satoshi <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Amount too small to send. Minimum 1 satoshi required.']);
        exit;
    }
    $data = [
        'api_key' => $gateway_api_key,
        'amount' => $amount_satoshi, 
        'currency' => $currency,
        'to' => $wallet,
        'referral' => 'false',
        'ip_address' => ($_SERVER['REMOTE_ADDR'] == '::1' || $_SERVER['REMOTE_ADDR'] == '127.0.0.1') ? '103.112.53.1' : $_SERVER['REMOTE_ADDR']
    ];
    $ch = curl_init('https://faucetpay.io/api/v1/send');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data); 
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (curl_errno($ch)) {
        $paymentErrorMsg = 'CURL Connection Error: ' . curl_error($ch);
        curl_close($ch);
    } else {
        curl_close($ch);
        $log_data = date('Y-m-d H:i:s') . " - FP Req: " . json_encode($data) . " - Resp: " . ($response ?: 'Empty') . " - CODE: " . $http_code . PHP_EOL;
        file_put_contents('withdraw_log.txt', $log_data, FILE_APPEND);
        $result = json_decode($response, true);
        if ($result && isset($result['status']) && $result['status'] == 200) {
            $paymentSuccess = true;
            $transaction_id = $result['payment_id'] ?? time();
        } else {
            $fp_msg = $result['message'] ?? 'Unknown FaucetPay Error (HTTP ' . $http_code . ')';
            if (!$result && !empty($response)) {
                $fp_msg .= " - Raw: " . substr(strip_tags($response), 0, 50);
            }
            $paymentErrorMsg = 'FaucetPay: ' . $fp_msg;
        }
    }
}
if ($paymentSuccess) {
    $amount_coins = $user['balance'];
    $pdo->prepare("UPDATE users SET balance = 0 WHERE id = ?")->execute([$user_id]);
    $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $gateway_name = 'FaucetPay';
    $trans_id = 'WD-' . $transaction_id . '-' . $user_id;
    $stmt->execute([
        $user_id, 
        $trans_id, 
        'Withdrawal to ' . $gateway_name . ' (' . $currency . ')', 
        'withdrawal', 
        -$amount_coins, 
        $amount_to_pay_display, 
        1
    ]);
    echo json_encode([
        'status' => 'success', 
        'message' => 'Sent ' . $amount_to_pay_display . ' ' . $currency . ' to your ' . $gateway_name . '!'
    ]);
} else {
    echo json_encode([
        'status' => 'error', 
        'message' => $paymentErrorMsg
    ]);
}
?>