<?php
define('AOY_APP', true);
ob_start();
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['user_id'])) {
    ob_end_clean();
    echo '<div class="text-center text-rose-500 font-bold p-8"><i class="fas fa-lock text-4xl mb-3"></i><br>Please login to access this feature.</div>';
    exit();
}

$user_id = $_SESSION['user_id'];
$status = getSetting('db_status') ?? '1';
$currency = getSetting('currency_name') ?? 'Coins';
$total_days = (int)(getSetting('db_total_days') ?? 7);
$completion_action = getSetting('db_completion_action') ?? 'loop';

$turnstile_site = getSetting('cloudflare_turnstile_site_key') ?? '';
$turnstile_secret = getSetting('cloudflare_turnstile_secret_key') ?? '';

$rewards = [];
for ($i = 1; $i <= $total_days; $i++) {
    $rewards[$i] = (float)(getSetting("db_day_$i") ?? ($i * 5));
}

$stmt = $pdo->prepare("SELECT streak, last_claim FROM daily_bonus_users WHERE user_id = ?");
$stmt->execute([$user_id]);
$userData = $stmt->fetch(PDO::FETCH_ASSOC);

$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));

$currentStreak = 0;
$canClaim = true;
$nextRewardDay = 1;
$isCompleted = false;

if ($userData) {
    $lastClaim = $userData['last_claim'];
    $streak = $userData['streak'];

    if ($completion_action === 'stop' && $streak >= $total_days) {
        $currentStreak = $total_days;
        $canClaim = false;
        $isCompleted = true;
    } else {
        if ($lastClaim === $today) {
            $canClaim = false;
            $currentStreak = min($streak, $total_days);

            if ($streak >= $total_days) {
                $nextRewardDay = ($completion_action === 'hold') ? $total_days : 1;
            } else {
                $nextRewardDay = $streak + 1;
            }
        } elseif ($lastClaim === $yesterday) {
            $canClaim = true;
            if ($streak >= $total_days) {
                if ($completion_action === 'hold') {
                    $currentStreak = $total_days;
                    $nextRewardDay = $total_days;
                } else {
                    $currentStreak = 0;
                    $nextRewardDay = 1;
                }
            } else {
                $currentStreak = $streak;
                $nextRewardDay = $streak + 1;
            }
        } else {
            $canClaim = true;
            $currentStreak = 0;
            $nextRewardDay = 1;
        }
    }
}

$tomorrowDay = 1;
if ($currentStreak < $total_days) {
    $tomorrowDay = $currentStreak + 1;
} else {
    $tomorrowDay = ($completion_action === 'hold') ? $total_days : 1;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'claim_bonus') {
    ob_end_clean();
    header('Content-Type: application/json');

    if ($status !== '1' && $status !== 1) {
        echo json_encode(['success' => false, 'message' => 'Daily Bonus is currently disabled.']);
        exit;
    }

    if (!$canClaim || $isCompleted) {
        echo json_encode(['success' => false, 'message' => 'You cannot claim at this time.']);
        exit;
    }

    if (!empty($turnstile_secret)) {
        $turnstile_response = $_POST['cf_response'] ?? '';
        if (empty($turnstile_response)) {
            echo json_encode(['success' => false, 'message' => 'Please complete the CAPTCHA check.']);
            exit;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'secret' => $turnstile_secret,
            'response' => $turnstile_response,
            'remoteip' => $_SERVER['REMOTE_ADDR']
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $outcome = json_decode(curl_exec($ch), true);
        curl_close($ch);

        if (!$outcome || empty($outcome['success'])) {
            echo json_encode(['success' => false, 'message' => 'CAPTCHA verification failed. Please try again.']);
            exit;
        }
    }

    $rewardAmount = $rewards[$nextRewardDay];
    $newStreak = $nextRewardDay;

    try {
        $pdo->beginTransaction();

        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$rewardAmount, $user_id]);

        $stmt = $pdo->prepare("INSERT INTO daily_bonus_users (user_id, streak, last_claim) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE streak = ?, last_claim = ?");
        $stmt->execute([$user_id, $newStreak, $today, $newStreak, $today]);

        $transId = uniqid('db_');
        $offerName = "Daily Bonus";
        $stmt = $pdo->prepare("INSERT INTO completed_offers (user_id, trans_id, offer_name, offer_type, reward, payout, status) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$user_id, $transId, $offerName, 'addon', $rewardAmount, 0]);

        $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $newBalance = $stmt->fetchColumn();

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'reward' => $rewardAmount,
            'new_balance' => $newBalance,
            'new_streak' => $newStreak,
            'tomorrow_day' => ($newStreak < $total_days) ? $newStreak + 1 : (($completion_action === 'hold') ? $total_days : 1),
            'is_completed_now' => ($completion_action === 'stop' && $newStreak >= $total_days)
        ]);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'System error. Please try again later.']);
        exit;
    }
}
ob_end_flush();

if ($status !== '1' && $status !== 1) {
    echo '<div class="w-full max-w-4xl mx-auto mt-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center animate-[fadeIn_0.5s_ease-out]">
            <i class="fas fa-power-off text-5xl text-rose-500 mb-4"></i>
            <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Module Offline</h2>
            <p class="text-gray-600 dark:text-gray-400">The Daily Bonus system is currently disabled by the administrator.</p>
          </div>';
    exit();
}
?>

<div class="animate-[fadeInUp_0.5s_ease-out] w-full max-w-6xl mx-auto mt-6">
    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden text-center">
        
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>

        <div class="mb-8">
            <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center justify-center gap-3">
                <i class="fas fa-calendar-check text-amber-500"></i> Daily Check-In Bonus
            </h2>
            <p class="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                Claim your rewards daily. Reach <?php echo $total_days; ?> days for maximum rewards!
            </p>
        </div>

        <div class="flex flex-wrap justify-center gap-3 mb-8">
            <?php for ($i = 1; $i <= $total_days; $i++): 
                
                $isClaimed = $isCompleted ? true : ($canClaim ? ($i < $nextRewardDay) : ($i <= $currentStreak));
                $isToday = $isCompleted ? false : ($canClaim && $i === $nextRewardDay);
                
                $boxClass = "border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-dark-900 opacity-60";
                $textClass = "text-gray-400";
                $icon = "fa-lock";

                if ($isClaimed) {
                    $boxClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
                    $textClass = "text-emerald-500";
                    $icon = "fa-check-circle";
                } elseif ($isToday) {
                    $boxClass = "border-amber-500 bg-amber-50 dark:bg-amber-500/10 ring-2 ring-amber-500/50 shadow-md transform scale-105 z-10";
                    $textClass = "text-amber-500";
                    $icon = "fa-gift animate-bounce";
                }
            ?>
            <div id="day-box-<?php echo $i; ?>" class="w-20 md:w-24 rounded-xl border-2 p-3 flex flex-col items-center justify-center transition-all duration-300 <?php echo $boxClass; ?>">
                <span id="day-text-<?php echo $i; ?>" class="text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2 <?php echo $textClass; ?>">Day <?php echo $i; ?></span>
                <i id="day-icon-<?php echo $i; ?>" class="fas <?php echo $icon; ?> text-xl md:text-2xl mb-2 <?php echo $textClass; ?>"></i>
                <span class="font-extrabold text-gray-800 dark:text-white text-sm md:text-base"><?php echo $rewards[$i]; ?></span>
            </div>
            <?php endfor; ?>
        </div>

        <!-- Giga.pub Ad -->
        <div id="gigapub-ad-container" class="mb-4"></div>

        <div id="claim-action-area" class="flex flex-col items-center">
            <?php if ($canClaim): ?>
                
                <?php if (!empty($turnstile_site)): ?>
                    <div id="db-turnstile-container" class="mb-4"></div>
                <?php endif; ?>
                
                <button id="btn-claim-daily" class="btn bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-lg px-12 py-4 rounded-xl shadow-lg shadow-amber-500/30 transition-all transform hover:-translate-y-1">
                    <i class="fas fa-hand-holding-usd mr-2"></i> Claim Day <?php echo $nextRewardDay; ?> Reward
                </button>
            <?php else: ?>
                <div class="inline-block bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl px-8 py-4">
                    <?php if ($isCompleted): ?>
                        <p class="text-emerald-500 font-bold text-lg">
                            <i class="fas fa-party-horn mr-2"></i> Congratulations! You have completed all rewards.
                        </p>
                    <?php else: ?>
                        <p class="text-gray-500 dark:text-gray-400 font-bold">
                            <i class="fas fa-clock mr-2 text-emerald-500"></i> Come back tomorrow for Day <?php echo $tomorrowDay; ?> reward!
                        </p>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>

    </div>
</div>

<script>
    // Load Giga.pub ad dynamically
    (function() {
        const adContainer = document.getElementById('gigapub-ad-container');
        if (adContainer) {
            const adScript = document.createElement('script');
            adScript.src = 'https://ad.gigapub.tech/script?id=6437';
            adContainer.appendChild(adScript);
        }
    })();

    let dbTurnstileWidgetId = null;
    
    function initDailyBonusTurnstile() {
        const siteKey = "<?php echo htmlspecialchars($turnstile_site); ?>";
        const container = document.getElementById('db-turnstile-container');
        
        if (siteKey && container) {
            if (typeof turnstile !== 'undefined') {
                container.innerHTML = '';
                dbTurnstileWidgetId = turnstile.render(container, {
                    sitekey: siteKey,
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                });
            } else {
                const script = document.createElement('script');
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.onload = function() {
                    dbTurnstileWidgetId = turnstile.render(container, {
                        sitekey: siteKey,
                        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                    });
                };
                document.head.appendChild(script);
            }
        }
    }

    initDailyBonusTurnstile();

    document.getElementById('btn-claim-daily')?.addEventListener('click', function() {
        const btn = this;
        const originalText = btn.innerHTML;
        const headerBalance = document.getElementById('header-user-balance');
        const totalDaysConfigured = <?php echo $total_days; ?>;
        const siteKey = "<?php echo htmlspecialchars($turnstile_site); ?>";
        
        let turnstileResponse = '';
        
        if (siteKey !== "" && dbTurnstileWidgetId !== null) {
            if (typeof turnstile !== 'undefined') {
                turnstileResponse = turnstile.getResponse(dbTurnstileWidgetId);
                if (!turnstileResponse) {
                    Swal.fire({ 
                        icon: 'warning', 
                        title: 'Action Required', 
                        text: 'Please complete the CAPTCHA check before claiming.', 
                        customClass: { popup: 'swal2-dark-support', title: 'swal2-title-dark-support', htmlContainer: 'swal2-html-dark-support' }
                    });
                    return;
                }
            }
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Claiming...';

        fetch('addons/daily_bonus.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=claim_bonus&cf_response=' + encodeURIComponent(turnstileResponse)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (headerBalance) {
                    headerBalance.classList.add('text-amber-500', 'scale-125', 'transition-transform');
                    headerBalance.innerText = parseFloat(data.new_balance).toFixed(2);
                    setTimeout(() => {
                        headerBalance.classList.remove('text-amber-500', 'scale-125');
                    }, 500);
                }

                const dayBox = document.getElementById('day-box-' + data.new_streak);
                const dayText = document.getElementById('day-text-' + data.new_streak);
                const dayIcon = document.getElementById('day-icon-' + data.new_streak);
                
                if (dayBox) {
                    dayBox.className = "w-20 md:w-24 rounded-xl border-2 p-3 flex flex-col items-center justify-center transition-all duration-300 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
                    dayText.className = "text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2 text-emerald-500";
                    dayIcon.className = "fas fa-check-circle text-xl md:text-2xl mb-2 text-emerald-500";
                }

                let claimActionHtml = '';
                if (data.is_completed_now) {
                    claimActionHtml = `
                        <div class="inline-block bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl px-8 py-4 animate-[fadeIn_0.5s_ease-out]">
                            <p class="text-emerald-500 font-bold text-lg">
                                <i class="fas fa-party-horn mr-2"></i> Congratulations! You have completed all rewards.
                            </p>
                        </div>
                    `;
                } else {
                    claimActionHtml = `
                        <div class="inline-block bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl px-8 py-4 animate-[fadeIn_0.5s_ease-out]">
                            <p class="text-gray-500 dark:text-gray-400 font-bold">
                                <i class="fas fa-clock mr-2 text-emerald-500"></i> Come back tomorrow for Day ${data.tomorrow_day} reward!
                            </p>
                        </div>
                    `;
                }
                
                document.getElementById('claim-action-area').innerHTML = claimActionHtml;

                Swal.fire({
                    icon: 'success',
                    title: 'Claimed Successfully!',
                    text: `You received ${data.reward} <?php echo $currency; ?> for Day ${data.new_streak} streak.`,
                    customClass: { popup: 'swal2-dark-support', title: 'swal2-title-dark-support', htmlContainer: 'swal2-html-dark-support' },
                    confirmButtonColor: '#10b981',
                    timer: 3000,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false
                });

            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: data.message,
                    customClass: { popup: 'swal2-dark-support', title: 'swal2-title-dark-support', htmlContainer: 'swal2-html-dark-support' }
                });
                btn.disabled = false;
                btn.innerHTML = originalText;
                
                if (typeof turnstile !== 'undefined' && dbTurnstileWidgetId !== null) {
                    turnstile.reset(dbTurnstileWidgetId);
                }
            }
        })
        .catch(err => {
            Swal.fire('Error', 'Network error. Please try again.', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (typeof turnstile !== 'undefined' && dbTurnstileWidgetId !== null) { 
                turnstile.reset(dbTurnstileWidgetId); 
            }
        });
    });
</script>
