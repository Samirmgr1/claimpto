<?php
session_start();
require_once '../core/db.php';
header('Content-Type: application/json');

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
