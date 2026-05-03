<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['identifier'])) {
    $identifier = trim($_POST['identifier']);
    $ip = getUserIP();
    
    if ($ip == '127.0.0.1' || $ip == '::1' || $ip == 'Unknown IP') {
        $ip = '103.112.53.1'; 
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS ip_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cache_key VARCHAR(255) UNIQUE NOT NULL,
            cache_value TEXT NOT NULL,
            expires_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (PDOException $e) {
    }

    $gateway = getSetting('payment_gateway');
    if (!$gateway) $gateway = 'faucetpay'; 
    
    $securityPassed = true;
    $errorMsg = '';

    $proxy_key = trim(getSetting('proxycheck_api_key'));
    if (!empty($proxy_key)) {
        $cacheKey = "proxy_" . md5($ip);
        $stmtCache = $pdo->prepare("SELECT cache_value FROM ip_cache WHERE cache_key = ? AND expires_at > NOW()");
        $stmtCache->execute([$cacheKey]);
        $cachedResult = $stmtCache->fetchColumn();

        if ($cachedResult === 'proxy_yes') {
            $securityPassed = false;
            $errorMsg = "Access Denied: Please disable your VPN/Proxy.";
        } elseif ($cachedResult !== 'proxy_no') {
            $proxy_url = "https://proxycheck.io/v2/{$ip}?key={$proxy_key}&vpn=1&asn=1";
            $proxy_res = requestWithCurl($proxy_url);
            if ($proxy_res) {
                $proxy_data = json_decode($proxy_res, true);
                if (isset($proxy_data[$ip]['proxy']) && $proxy_data[$ip]['proxy'] == 'yes') {
                    $securityPassed = false;
                    $errorMsg = "Access Denied: Please disable your VPN/Proxy.";
                    $stmt = $pdo->prepare("INSERT INTO ip_cache (cache_key, cache_value, expires_at) VALUES (?, 'proxy_yes', DATE_ADD(NOW(), INTERVAL 24 HOUR)) ON DUPLICATE KEY UPDATE cache_value = 'proxy_yes', expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)");
                    $stmt->execute([$cacheKey]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO ip_cache (cache_key, cache_value, expires_at) VALUES (?, 'proxy_no', DATE_ADD(NOW(), INTERVAL 24 HOUR)) ON DUPLICATE KEY UPDATE cache_value = 'proxy_no', expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)");
                    $stmt->execute([$cacheKey]);
                }
            }
        }
    }

    if ($securityPassed) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE ip_address = ? AND wallet != ? AND username != ?");
        $stmt->execute([$ip, $identifier, $identifier]);
        if ($stmt->rowCount() > 0) {
            $securityPassed = false;
            $errorMsg = "Account Banned: Multiple accounts detected from this IP.";
        }
    }

    if ($securityPassed) {
        $stmt = $pdo->prepare("SELECT id, is_admin, is_banned, ban_reason FROM users WHERE username = ? OR wallet = ?");
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();

        if ($user && $user['is_banned']) {
            $banMsg = 'Your account has been banned.';
            if (!empty($user['ban_reason'])) {
                $banMsg .= ' Reason: ' . $user['ban_reason'];
            }
            $_SESSION['login_error'] = '🚫 ' . $banMsg;
            header("Location: ../index.php");
            exit();
        }

        if (!$user) {
            $countStmt = $pdo->query("SELECT COUNT(*) FROM users");
            $userCount = $countStmt->fetchColumn();
            $isAdmin = ($userCount == 0) ? 1 : 0;
            $referredBy = null;

            if (isset($_SESSION['ref'])) {
                $refId = (int)$_SESSION['ref'];
                $refCheck = $pdo->prepare("SELECT id FROM users WHERE id = ?");
                $refCheck->execute([$refId]);
                if ($refCheck->fetch()) {
                    $referredBy = $refId;
                }
                unset($_SESSION['ref']);
            }

            $stmt = $pdo->prepare("INSERT INTO users (username, wallet, ip_address, is_admin, referred_by) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$identifier, $identifier, $ip, $isAdmin, $referredBy]);
            $user_id = $pdo->lastInsertId();

            $banMode = getSetting('ban_mode');
            if ($banMode === 'auto' && !$isAdmin) {
                $dupStmt = $pdo->prepare("SELECT id FROM users WHERE ip_address = ? AND id != ? AND is_admin = 0");
                $dupStmt->execute([$ip, $user_id]);
                if ($dupStmt->rowCount() > 0) {
                    $pdo->prepare("UPDATE users SET is_banned = 1, ban_reason = 'Auto-banned: Duplicate IP detected' WHERE id = ?")->execute([$user_id]);
                    $_SESSION['login_error'] = '🚫 Your account has been automatically banned. Reason: Duplicate IP detected.';
                    header("Location: ../index.php");
                    exit();
                }
            }

            if ($isAdmin) {
                $_SESSION['admin'] = true;
            }
        } else {
            $user_id = $user['id'];
            if ($user['is_admin']) {
                $_SESSION['admin'] = true;
            }
            $stmt = $pdo->prepare("UPDATE users SET ip_address = ? WHERE id = ?");
            $stmt->execute([$ip, $user_id]);
        }

        $_SESSION['user_id'] = $user_id;
        $_SESSION['login_ip'] = $ip;

        // Handle "Remember this browser" checkbox
        if (isset($_POST['remember_browser']) && $_POST['remember_browser'] == '1') {
            // Set cookie to store user_id for 30 days
            setcookie('remember_browser', $user_id, time() + (30 * 24 * 60 * 60), '/', '', false, true);
        }

        header("Location: ../index.php");
        exit();

    } else {
        $_SESSION['login_error'] = "🚫 " . $errorMsg;
        header("Location: ../index.php");
        exit();
    }

} else {
    header("Location: ../index.php");
    exit();
}
?>