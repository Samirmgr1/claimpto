<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/coupon_auto.php';

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    header('Content-Type: application/json');
}

$secret = couponGetSetting('auto_coupon_secret', '');
if (!empty($secret)) {
    if ($isCli) {
        $provided = $argv[1] ?? '';
    } else {
        $provided = $_GET['secret'] ?? '';
    }
    if (!hash_equals($secret, $provided)) {
        if (!$isCli) {
            http_response_code(403);
        }
        echo json_encode(['success' => false, 'message' => 'Invalid cron secret.']);
        exit($isCli ? 1 : 0);
    }
}

if ($isCli) {
    $force = in_array('--force', $argv ?? [], true);
} else {
    $force = isset($_GET['force']) && $_GET['force'] === '1';
}

$result = couponCreateAutoCoupon($force);
echo json_encode($result, JSON_PRETTY_PRINT) . ($isCli ? "\n" : "");
?>
