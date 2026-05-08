<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/coupon_auto.php';

header('Content-Type: application/json');

$secret = couponGetSetting('auto_coupon_secret', '');
if (!empty($secret)) {
    $provided = $_GET['secret'] ?? '';
    if (!hash_equals($secret, $provided)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid cron secret.']);
        exit;
    }
}

$force = isset($_GET['force']) && $_GET['force'] === '1';
$result = couponCreateAutoCoupon($force);
echo json_encode($result);
?>
