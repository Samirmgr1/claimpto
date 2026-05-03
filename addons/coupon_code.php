<?php
define('AOY_APP', true);
ob_start();
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['user_id'])) {
    ob_end_clean();
    echo '<div class="text-center text-red-500 font-bold p-8"><i class="fas fa-lock text-4xl mb-3"></i><br>Please login to access this feature.</div>';
    exit();
}

$user_id = $_SESSION['user_id'];
$currency = getSetting('currency_name') ?? 'Coins';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'redeem_coupon') {
    ob_end_clean();
    header('Content-Type: application/json');

    if (isset($_SESSION['coupon_fails']) && $_SESSION['coupon_fails'] >= 5) {
        $timePassed = time() - $_SESSION['last_fail_time'];
        if ($timePassed < 300) {
            $timeLeft = ceil((300 - $timePassed) / 60);
            echo json_encode(['success' => false, 'message' => "Too many failed attempts. Try again in $timeLeft minutes.", 'shake' => true]);
            exit;
        } else {
            $_SESSION['coupon_fails'] = 0;
        }
    }

    try {
        $code = strtoupper(trim($_POST['code'] ?? ''));

        if (empty($code)) {
            echo json_encode(['success' => false, 'message' => 'Please enter a valid promo code.', 'shake' => true]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM addon_coupons WHERE code = ?");
        $stmt->execute([$code]);
        $coupon = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$coupon) {
            $_SESSION['coupon_fails'] = ($_SESSION['coupon_fails'] ?? 0) + 1;
            $_SESSION['last_fail_time'] = time();
            echo json_encode(['success' => false, 'message' => 'Invalid or non-existent promo code.', 'shake' => true]);
            exit;
        }

        if (!empty($coupon['expires_at']) && strtotime($coupon['expires_at']) < time()) {
            echo json_encode(['success' => false, 'message' => 'This promo code has expired.', 'shake' => true]);
            exit;
        }

        if ($coupon['used_count'] >= $coupon['max_uses']) {
            echo json_encode(['success' => false, 'message' => 'This promo code has reached its maximum usage limit.', 'shake' => true]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM addon_coupon_logs WHERE user_id = ? AND coupon_id = ?");
        $stmt->execute([$user_id, $coupon['id']]);
        if ($stmt->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'You have already redeemed this code.', 'shake' => true]);
            exit;
        }

        if ($coupon['req_offer_type'] !== 'none' && $coupon['req_offer_amount'] > 0) {
            $checkTable = $pdo->query("SHOW TABLES LIKE 'completed_offers'")->rowCount();
            
            if ($checkTable > 0) {
                $timeCondition = "";
                $timeMsg = "";
                
                if (isset($coupon['req_timeframe']) && $coupon['req_timeframe'] === '24_hours') {
                    $timeCondition = " AND created_at >= NOW() - INTERVAL 24 HOUR";
                    $timeMsg = " in the last 24 hours";
                }

                if ($coupon['req_offer_type'] === 'count') {
                    $stmt = $pdo->prepare("SELECT COUNT(id) FROM completed_offers WHERE user_id = ? AND status = 1 AND offer_type != 'addon'" . $timeCondition);
                    $stmt->execute([$user_id]);
                    $userOffersCount = (int)$stmt->fetchColumn();
                    $reqAmount = (int)$coupon['req_offer_amount'];
                    
                    if ($userOffersCount < $reqAmount) {
                        echo json_encode(['success' => false, 'message' => "Requirement not met! You need to complete at least {$reqAmount} offers{$timeMsg}. (Completed: {$userOffersCount})", 'shake' => true]);
                        exit;
                    }
                } elseif ($coupon['req_offer_type'] === 'value') {
                    $stmt = $pdo->prepare("SELECT SUM(reward) FROM completed_offers WHERE user_id = ? AND status = 1 AND offer_type != 'addon'" . $timeCondition);
                    $stmt->execute([$user_id]);
                    $userOffersValue = (float)$stmt->fetchColumn();
                    $reqValue = (float)$coupon['req_offer_amount'];
                    
                    if ($userOffersValue < $reqValue) {
                        $formattedReq = number_format($reqValue, 4);
                        $formattedEarned = number_format($userOffersValue, 4);
                        echo json_encode(['success' => false, 'message' => "Requirement not met! You need to earn at least {$formattedReq} {$currency} from offers{$timeMsg}. (Earned: {$formattedEarned} {$currency})", 'shake' => true]);
                        exit;
                    }
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Offerwall validation system is not configured yet.']);
                exit;
            }
        }

        $pdo->beginTransaction();

        $pdo->prepare("UPDATE addon_coupons SET used_count = used_count + 1 WHERE id = ?")->execute([$coupon['id']]);
        
        $pdo->prepare("INSERT INTO addon_coupon_logs (user_id, coupon_id) VALUES (?, ?)")->execute([$user_id, $coupon['id']]);
        
        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$coupon['reward'], $user_id]);

        $transId = uniqid('coup_') . '_' . $coupon['id'];
        $offerName = "Promo Code: " . $coupon['code'];
        $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$user_id, $transId, $offerName, 'addon', $coupon['reward'], 0]);

        $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $newBalance = $stmt->fetchColumn();

        $pdo->commit();

        $_SESSION['coupon_fails'] = 0;

        echo json_encode([
            'success' => true,
            'reward' => (float)$coupon['reward'],
            'new_balance' => $newBalance
        ]);
        exit;

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'System error: ' . $e->getMessage()]);
        exit;
    }
}
ob_end_flush();
?>

<script src='//libtl.com/sdk.js' data-zone='10746379' data-sdk='show_10746379'></script>

<style>
    @keyframes shakeError {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    .shake-input {
        animation: shakeError 0.4s ease-in-out;
        border-color: #ef4444 !important;
        color: #ef4444 !important;
    }
</style>

<div class="animate-[fadeInUp_0.5s_ease-out] w-full max-w-xl mx-auto mt-6">
    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden text-center">
        
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

        <div class="mb-8">
            <div class="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-500/20 shadow-inner">
                <i class="fas fa-ticket-alt text-4xl text-indigo-500 transform -rotate-12 transition-transform hover:rotate-12 duration-300"></i>
            </div>
            <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Redeem Promo Code
            </h2>
            <p class="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                Enter your promo code below to receive free <span class="text-indigo-500 font-bold"><?php echo $currency; ?></span>!
            </p>
        </div>

        <div class="space-y-4">
            <div class="relative group">
                <div class="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500">
                    <i class="fas fa-gift text-gray-400 group-focus-within:text-indigo-500 transition-colors"></i>
                </div>
                <input type="text" id="coupon_code" placeholder="ENTER CODE HERE" class="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-dark-900 border-2 border-gray-200 dark:border-white/10 rounded-xl focus:ring-0 focus:border-indigo-500 text-gray-900 dark:text-white font-black text-center text-xl tracking-widest uppercase transition-all outline-none placeholder-gray-300 dark:placeholder-gray-600 shadow-sm" autocomplete="off">
            </div>

            <button id="btn-redeem-coupon" class="w-full btn bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-lg py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2">
                <i class="fas fa-unlock-alt"></i> Redeem Reward
            </button>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 text-xs text-gray-400 font-medium">
            <p><i class="fas fa-shield-alt mr-1 text-gray-300"></i> Anti-Spam protection is enabled.</p>
            <p class="mt-1">Watch a short ad to claim your reward.</p>
        </div>

    </div>
</div>

<script>
    (function() {
        if (typeof Swal === 'undefined') {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
            document.head.appendChild(script);
        }

        const claimBtn = document.getElementById('btn-redeem-coupon');
        const codeInput = document.getElementById('coupon_code');
        const isDark = document.documentElement.classList.contains('dark');

        codeInput.addEventListener('input', function() {
            this.classList.remove('shake-input');
        });

        if (claimBtn) {
            claimBtn.addEventListener('click', () => {
                const code = codeInput.value.trim();
                codeInput.classList.remove('shake-input');
                
                if (code === '') {
                    codeInput.classList.add('shake-input');
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Wait!',
                            text: 'Please enter a promo code first.',
                            background: isDark ? '#1e293b' : '#ffffff',
                            color: isDark ? '#f8fafc' : '#1e293b'
                        });
                    }
                    return;
                }

                // Show Ads First
                if (typeof show_10746379 === 'function') {
                    show_10746379().then(() => {
                        // User closed the ad or it finished, now redeem
                        executeRedemption(code);
                    }).catch((e) => {
                        // If ad fails to load, still allow them to redeem
                        console.error("Ad failed to load:", e);
                        executeRedemption(code);
                    });
                } else {
                    // Ad SDK not ready, proceed anyway
                    executeRedemption(code);
                }
            });
        }

        function executeRedemption(code) {
            const originalText = claimBtn.innerHTML;
            claimBtn.disabled = true;
            claimBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
            claimBtn.classList.add('opacity-70', 'cursor-not-allowed');

            fetch('addons/coupon_code.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'action=redeem_coupon&code=' + encodeURIComponent(code)
            })
            .then(res => res.text())
            .then(text => {
                try {
                    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
                    const data = JSON.parse(jsonStr);

                    if (data.success) {
                        showSuccessPopup(data);
                        codeInput.value = '';
                    } else {
                        if (data.shake) codeInput.classList.add('shake-input');
                        
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'error',
                                title: 'Oops!',
                                text: data.message,
                                background: isDark ? '#1e293b' : '#ffffff',
                                color: isDark ? '#f8fafc' : '#1e293b'
                            });
                        }
                        resetButton();
                    }
                } catch (e) {
                    console.error("Server Error:", text);
                    resetButton();
                }
            })
            .catch(err => {
                resetButton();
            });

            function resetButton() {
                claimBtn.disabled = false;
                claimBtn.innerHTML = originalText;
                claimBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        }

        function showSuccessPopup(data) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Code Redeemed!',
                    html: `Congratulations! You received <b class="text-indigo-500 text-2xl drop-shadow-sm">+${data.reward} <?php echo $currency; ?></b>!`,
                    background: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#1e293b',
                    confirmButtonColor: '#8B5CF6'
                }).then(() => {
                    const headerBal = document.getElementById('header-user-balance');
                    if(headerBal) {
                        headerBal.innerText = parseFloat(data.new_balance).toFixed(2);
                    }
                    if (typeof loadContent === 'function') {
                        loadContent('addons/coupon_code.php');
                    }
                });
            }
        }
    })();
</script>
