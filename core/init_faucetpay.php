<?php
require_once 'db.php';
$settings = [
    'faucetpay_api_key' => '',
    'faucetpay_currency' => 'USDT',
    'min_withdrawal' => '100',
    'exchange_rate' => '1000'
];
foreach ($settings as $key => $val) {
    $stmt = $pdo->prepare("INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)");
    $stmt->execute([$key, $val]);
}
echo "FaucetPay settings initialized.";
?>
