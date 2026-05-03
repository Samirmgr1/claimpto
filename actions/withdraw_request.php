<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';
if (!isset($_SESSION['user_id']) || $_SERVER['REQUEST_METHOD'] != 'POST') {
    header("Location: index.php");
    exit();
}
$user_id = $_SESSION['user_id'];
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();
$min_withdrawal = (float)(getSetting('min_withdrawal') ?: 100);
if ($user['balance'] >= $min_withdrawal) {
    $amount = $user['balance'];
    $stmt = $pdo->prepare("UPDATE users SET balance = 0 WHERE id = ?");
    $stmt->execute([$user_id]);
    $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $trans_id = 'WITHDRAW-' . time() . '-' . $user_id;
    $stmt->execute([$user_id, $trans_id, 'Manual Withdrawal', 'withdrawal', -$amount, 0, 1]);
    $_SESSION['msg'] = "Withdrawal of $amount requested successfully!";
} else {
    $_SESSION['msg'] = "Insufficient balance! Minimum is $min_withdrawal";
}
header("Location: index.php?page=withdraw");
exit();
?>