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
$allowed_coins_str = getSetting('allowed_coins') ?: 'USDT';
$allowed_coins = array_filter(array_map('trim', explode(',', $allowed_coins_str)));
$prices = getAllCachedPrices($allowed_coins);
echo json_encode([
    'status' => 'success',
    'prices' => $prices
]);
?>
