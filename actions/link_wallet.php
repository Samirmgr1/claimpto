<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';
header('Content-Type: application/json');

/**
 * Verify if email is registered on FaucetPay
 */
function verifyFaucetPayEmail($email, $api_key) {
    // FaucetPay API endpoint to check address
    $data = [
        'api_key' => $api_key,
        'address' => $email,
        'currency' => 'USDT' // Use USDT for email verification
    ];
    
    $ch = curl_init('https://faucetpay.io/api/v1/checkaddress');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if (!$response) {
        return ['valid' => false, 'message' => 'Unable to connect to FaucetPay. Please try again.'];
    }
    
    $result = json_decode($response, true);
    
    // FaucetPay returns status 200 for valid addresses
    if ($result && isset($result['status'])) {
        if ($result['status'] == 200) {
            return ['valid' => true, 'message' => 'Email verified with FaucetPay'];
        } else if ($result['status'] == 456) {
            return ['valid' => false, 'message' => 'This email is not registered on FaucetPay. Please register at faucetpay.io first.'];
        } else {
            $msg = $result['message'] ?? 'Email verification failed';
            return ['valid' => false, 'message' => $msg];
        }
    }
    
    return ['valid' => false, 'message' => 'Unable to verify email with FaucetPay. Please try again.'];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
    exit;
}
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Session expired. Please reopen the mini app.']);
    exit;
}
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
if (!$email) {
    echo json_encode(['status' => 'error', 'message' => 'Please enter a valid FaucetPay email.']);
    exit;
}

// Get FaucetPay API key for verification
$faucetpay_api_key = trim(getSetting('faucetpay_api_key'));
if (empty($faucetpay_api_key)) {
    echo json_encode(['status' => 'error', 'message' => 'FaucetPay API is not configured. Please contact admin.']);
    exit;
}

// Verify email is registered on FaucetPay
$verification = verifyFaucetPayEmail($email, $faucetpay_api_key);
if (!$verification['valid']) {
    echo json_encode(['status' => 'error', 'message' => $verification['message']]);
    exit;
}

$user_id = (int)$_SESSION['user_id'];
try {
    $stmt = $pdo->prepare("SELECT id, wallet, telegram_id, balance, is_admin FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$current) {
        echo json_encode(['status' => 'error', 'message' => 'Account not found.']);
        exit;
    }
    if (!empty($current['wallet']) && strtolower($current['wallet']) !== strtolower($email)) {
        echo json_encode(['status' => 'error', 'message' => 'This account already has a FaucetPay email linked.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, balance, is_admin FROM users WHERE wallet = ? AND id != ? LIMIT 1");
    $stmt->execute([$email, $user_id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        // Move the current Telegram session to the existing wallet account and merge any temporary balance.
        $pdo->beginTransaction();
        $telegram_id = $current['telegram_id'] ?? null;
        $temp_balance = (float)($current['balance'] ?? 0);
        if ($temp_balance > 0) {
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$temp_balance, $existing['id']]);
        }
        $pdo->prepare("UPDATE users SET telegram_id = ?, ip_address = ? WHERE id = ?")->execute([$telegram_id, $_SERVER['REMOTE_ADDR'], $existing['id']]);
        $pdo->prepare("UPDATE users SET telegram_id = NULL, balance = 0 WHERE id = ?")->execute([$user_id]);
        $pdo->commit();
        $_SESSION['user_id'] = (int)$existing['id'];
        if (!empty($existing['is_admin'])) $_SESSION['admin'] = true;
        echo json_encode(['status' => 'success', 'message' => 'FaucetPay account linked successfully.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE users SET wallet = ? WHERE id = ?");
    $stmt->execute([$email, $user_id]);
    echo json_encode(['status' => 'success', 'message' => 'FaucetPay email linked successfully.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => 'Could not link account. Please try again.']);
}
?>
