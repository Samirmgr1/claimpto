<?php
session_start();
require_once '../core/db.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
    exit;
}

try {
    $checkTgCol = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'telegram_id'");
    if ($checkTgCol && $checkTgCol->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `users` ADD `telegram_id` varchar(100) DEFAULT NULL AFTER `referred_by`");
    }
} catch (Exception $e) {}
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$telegram_id = trim($_POST['telegram_id'] ?? '');
$telegram_username = trim($_POST['telegram_username'] ?? '');
if (empty($telegram_username)) {
    $telegram_username = 'Member' . rand(1000, 9999);
}
$referred_by = isset($_POST['referred_by']) ? (int)$_POST['referred_by'] : null;
$ip_address = $_SERVER['REMOTE_ADDR'];
$is_auto_login = isset($_POST['auto_login']) && $_POST['auto_login'] == '1';
if (empty($telegram_id)) {
    echo json_encode(['status' => 'error', 'message' => 'Telegram ID is missing']);
    exit;
}
if ($is_auto_login) {
    try {
        $stmt = $pdo->prepare("SELECT id, is_admin FROM users WHERE telegram_id = ?");
        $stmt->execute([$telegram_id]);
        $user = $stmt->fetch();
        if ($user) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['is_telegram'] = true;
            if ($user['is_admin']) {
                $_SESSION['admin'] = true;
            }
            $stmt = $pdo->prepare("UPDATE users SET ip_address = ?, username = ? WHERE id = ?");
            $stmt->execute([$ip_address, $telegram_username, $user['id']]);
            echo json_encode(['status' => 'success', 'message' => 'Telegram login successful']);
            exit;
        }

        if ($referred_by) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$referred_by]);
            if (!$stmt->fetch()) {
                $referred_by = null;
            }
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE ip_address = ?");
        $stmt->execute([$ip_address]);
        if ($stmt->fetchColumn() >= 3) {
            echo json_encode(['status' => 'error', 'message' => 'Too many accounts from this IP address']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO users (username, wallet, ip_address, referred_by, telegram_id) VALUES (?, NULL, ?, ?, ?)");
        $stmt->execute([$telegram_username, $ip_address, $referred_by, $telegram_id]);
        $_SESSION['user_id'] = $pdo->lastInsertId();
        $_SESSION['is_telegram'] = true;
        echo json_encode(['status' => 'success', 'message' => 'Telegram account created']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Telegram login failed. Please try again.']);
    }
    exit;
}
if (!$email) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid email address']);
    exit;
}
try {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE telegram_id = ? AND wallet != ?");
    $stmt->execute([$telegram_id, $email]);
    if ($stmt->fetch()) {
        echo json_encode(['status' => 'error', 'message' => 'This Telegram account is already linked to another email.']);
        exit;
    }
    $stmt = $pdo->prepare("SELECT * FROM users WHERE wallet = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user) {
        $stmt = $pdo->prepare("UPDATE users SET telegram_id = ?, ip_address = ?, username = ? WHERE id = ?");
        $stmt->execute([$telegram_id, $ip_address, $telegram_username, $user['id']]);
        $_SESSION['user_id'] = $user['id'];
        if ($user['is_admin']) {
            $_SESSION['admin'] = true;
        }
    } else {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE ip_address = ?");
        $stmt->execute([$ip_address]);
        if ($stmt->fetchColumn() >= 3) { 
             echo json_encode(['status' => 'error', 'message' => 'Too many accounts from this IP address']);
             exit;
        }
        if ($referred_by) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$referred_by]);
            if (!$stmt->fetch()) {
                $referred_by = null; 
            }
        }
        $stmt = $pdo->prepare("INSERT INTO users (username, wallet, ip_address, referred_by, telegram_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $telegram_username,
            $email,
            $ip_address,
            $referred_by,
            $telegram_id
        ]);
        $_SESSION['user_id'] = $pdo->lastInsertId();
    }
    $_SESSION['is_telegram'] = true;
    echo json_encode([
        'status' => 'success', 
        'message' => 'Account linked and authenticated successfully'
    ]);
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Unknown column \'telegram_id\'') !== false) {
        echo json_encode(['status' => 'error', 'message' => 'System error: Database needs to be updated. Please contact admin.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
}
?>