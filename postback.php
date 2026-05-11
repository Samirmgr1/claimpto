<?php
define('POSTBACK_MODE', true);
require_once 'core/db.php';
require_once 'core/functions.php';

$secret = getSetting('bitcotask_secret_key');
$IP = getUserIP();

// Bitcotasks official IP (from docs: https://bitcotasks.com/documentations)
$allowed_ips = array('45.14.135.48');

// Also allow any extra IPs from admin settings
$allowed_ips_setting = getSetting('postback_allowed_ips');
if (!empty($allowed_ips_setting)) {
    $extra = array_map('trim', explode(',', $allowed_ips_setting));
    $allowed_ips = array_merge($allowed_ips, $extra);
}

if (!in_array($IP, $allowed_ips)) {
    http_response_code(403);
    file_put_contents('postback_error.txt', date('Y-m-d H:i:s') . " - Blocked IP: $IP | Allowed: " . implode(',', $allowed_ips) . PHP_EOL, FILE_APPEND);
    die("ERROR: Invalid source IP ($IP)");
}

// Read postback parameters (Bitcotasks S2S format)
$subId = isset($_REQUEST['subId']) ? trim($_REQUEST['subId']) : null;
$transId = isset($_REQUEST['transId']) ? trim($_REQUEST['transId']) : null;
$reward = isset($_REQUEST['reward']) ? trim($_REQUEST['reward']) : null;
$status = isset($_REQUEST['status']) ? (int)$_REQUEST['status'] : 1;
$signature = isset($_REQUEST['signature']) ? trim($_REQUEST['signature']) : null;
$offer_name = isset($_REQUEST['offer_name']) ? trim($_REQUEST['offer_name']) : 'Unknown Offer';
$offer_type = isset($_REQUEST['offer_type']) ? trim($_REQUEST['offer_type']) : 'offerwall';
$payout = isset($_REQUEST['payout']) ? trim($_REQUEST['payout']) : '0';

if (!$subId || !$transId || !$reward || !$signature) {
    http_response_code(400);
    $received = json_encode($_REQUEST);
    file_put_contents('postback_error.txt', date('Y-m-d H:i:s') . " - Missing params | Received: $received" . PHP_EOL, FILE_APPEND);
    die("ERROR: Missing parameters");
}

if (md5($subId . $transId . $reward . $secret) !== $signature) {
    http_response_code(403);
    die("ERROR: Signature doesn't match");
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("SELECT id, status FROM completed_offers WHERE trans_id = ? FOR UPDATE");
    $stmt->execute([$transId]);
    $existing = $stmt->fetch();

    if ($status == 1) {
        if (!$existing) {
            $approvalEnabled = getSetting('offer_approval_enabled') === '1';
            $approvalThreshold = (float)(getSetting('offer_approval_threshold') ?: 0.1);
            $exchangeRate = (float)(getSetting('exchange_rate') ?: 1000);
            $rewardUsd = ($exchangeRate > 0) ? ((float)$reward / $exchangeRate) : 0;
            
            if ($approvalEnabled && $rewardUsd >= $approvalThreshold) {
                $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, 0)");
                $stmt->execute([$subId, $transId, $offer_name, $offer_type, $reward, $payout]);
            } else {
                $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
                $stmt->execute([$reward, $subId]);
                
                $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, 1)");
                $stmt->execute([$subId, $transId, $offer_name, $offer_type, $reward, $payout]);
                
                $refStmt = $pdo->prepare("SELECT referred_by FROM users WHERE id = ?");
                $refStmt->execute([$subId]);
                $refData = $refStmt->fetch();
                if ($refData && !empty($refData['referred_by'])) {
                    $commissionRate = (float)(getSetting('referral_commission') ?: 10);
                    $commission = round((float)$reward * ($commissionRate / 100), 8);
                    if ($commission > 0) {
                        $stmt = $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
                        $stmt->execute([$commission, $refData['referred_by']]);
                        
                        $stmt = $pdo->prepare("INSERT INTO referral_earnings (user_id, referred_id, source_type, source_reward, commission) VALUES (?, ?, ?, ?, ?)");
                        $stmt->execute([$refData['referred_by'], $subId, $offer_type, $reward, $commission]);
                    }
                }
            }
        } else {
            $pdo->rollBack();
            die("OK: Already credited");
        }
    } else if ($status == 2) {
        if ($existing) {
            if ($existing['status'] == 1) {
                $stmt = $pdo->prepare("UPDATE users SET balance = GREATEST(0, balance - ?) WHERE id = ?");
                $stmt->execute([$reward, $subId]);
            }
            
            $stmt = $pdo->prepare("UPDATE completed_offers SET status = 2 WHERE trans_id = ?");
            $stmt->execute([$transId]);
        } else {
            $pdo->rollBack();
            die("OK: Transaction not found for chargeback");
        }
    }
    
    $pdo->commit();
    echo "ok";

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    file_put_contents('postback_error.txt', date('Y-m-d H:i:s') . " - DB Error: " . $e->getMessage() . PHP_EOL, FILE_APPEND);
    die("ERROR: Database execution failed");
}
?>
