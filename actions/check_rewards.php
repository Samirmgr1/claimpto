<?php
session_start();
require_once '../core/db.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Not logged in']);
    exit;
}
$user_id = $_SESSION['user_id'];
$last_checked_id = isset($_SESSION['last_reward_id']) ? (int)$_SESSION['last_reward_id'] : 0;
if ($last_checked_id === 0) {
    $stmt = $pdo->prepare("SELECT MAX(id) FROM completed_offers WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $max_id = (int)$stmt->fetchColumn();
    $_SESSION['last_reward_id'] = $max_id;
    echo json_encode(['status' => 'success', 'rewards' => []]);
    exit;
}
$stmt = $pdo->prepare("SELECT * FROM completed_offers WHERE user_id = ? AND id > ? AND reward > 0 ORDER BY id ASC");
$stmt->execute([$user_id, $last_checked_id]);
$rewards = $stmt->fetchAll();
if (!empty($rewards)) {
    $latest = end($rewards);
    $_SESSION['last_reward_id'] = (int)$latest['id'];
    $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $new_balance = $stmt->fetchColumn();
    echo json_encode([
        'status' => 'success', 
        'rewards' => $rewards,
        'new_balance' => number_format((float)$new_balance, 2)
    ]);
} else {
    echo json_encode(['status' => 'success', 'rewards' => []]);
}
?>
