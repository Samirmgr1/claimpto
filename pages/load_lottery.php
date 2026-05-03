<?php
session_start();
require_once '../core/db.php';

if (!isset($_SESSION['user_id'])) {
    echo '<div class="p-4 bg-red-100 text-red-600 rounded-xl font-bold">Please login first.</div>';
    exit;
}
$user_id = $_SESSION['user_id'];

// Create tables if not exist
$pdo->exec("CREATE TABLE IF NOT EXISTS lottery_draws (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    prize_pool DECIMAL(18,8) DEFAULT 0,
    winner_user_id INT DEFAULT NULL,
    winner_ticket_id INT DEFAULT NULL,
    status ENUM('active','drawn','cancelled') DEFAULT 'active',
    drawn_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uw (week_start)
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS lottery_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    draw_id INT NOT NULL,
    ticket_number VARCHAR(16) NOT NULL,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_draw (draw_id),
    INDEX idx_user_draw (user_id, draw_id)
)");

$lottery_status = getSetting('lottery_status');
$lottery_enabled = ($lottery_status === '0') ? false : true;

if (!$lottery_enabled) {
    echo '<div class="flex flex-col items-center justify-center py-20 text-center">
        <i class="fas fa-ticket text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <p class="text-gray-500 dark:text-gray-400 font-bold text-lg">Lottery is currently disabled</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Check back later!</p>
    </div>';
    exit;
}

$lottery_prize_base = (float)(getSetting('lottery_prize') ?: 500);
$lottery_req_ads = (int)(getSetting('lottery_req_ads') ?: 0);
$lottery_req_earn = (int)(getSetting('lottery_req_earn') ?: 0);
$lottery_ticket_pool_increment = (float)(getSetting('lottery_ticket_pool_increment') ?: 10);

// Ensure current week draw
$now = new DateTime('now', new DateTimeZone('UTC'));
$dow = (int)$now->format('N');
$weekStart = (clone $now)->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
$weekEnd = (clone $now)->modify('+' . (7 - $dow) . ' days')->format('Y-m-d');

$existingDraw = $pdo->prepare("SELECT id FROM lottery_draws WHERE week_start = ?");
$existingDraw->execute([$weekStart]);
$drawId = $existingDraw->fetchColumn();
if (!$drawId) {
    $pdo->prepare("INSERT INTO lottery_draws (week_start, week_end, status) VALUES (?, ?, 'active')")->execute([$weekStart, $weekEnd]);
    $drawId = $pdo->lastInsertId();
}

// Get current draw info
$drawStmt = $pdo->prepare("SELECT * FROM lottery_draws WHERE id = ?");
$drawStmt->execute([$drawId]);
$currentDraw = $drawStmt->fetch();

// Total prize = base prize + accumulated pool from ticket claims
$lottery_prize = $lottery_prize_base + (float)$currentDraw['prize_pool'];

// User's tickets this week
$userTicketsStmt = $pdo->prepare("SELECT * FROM lottery_tickets WHERE user_id = ? AND draw_id = ? ORDER BY claimed_at DESC");
$userTicketsStmt->execute([$user_id, $drawId]);
$userTickets = $userTicketsStmt->fetchAll();
$userTicketCount = count($userTickets);

// Did user claim today?
$todayStr = $now->format('Y-m-d');
$todayClaimStmt = $pdo->prepare("SELECT COUNT(*) FROM lottery_tickets WHERE user_id = ? AND draw_id = ? AND DATE(claimed_at) = ?");
$todayClaimStmt->execute([$user_id, $drawId, $todayStr]);
$claimedToday = (int)$todayClaimStmt->fetchColumn() > 0;

// Total tickets in draw
$totalTicketsStmt = $pdo->prepare("SELECT COUNT(*) FROM lottery_tickets WHERE draw_id = ?");
$totalTicketsStmt->execute([$drawId]);
$totalTickets = (int)$totalTicketsStmt->fetchColumn();

// Total participants
$totalParticipantsStmt = $pdo->prepare("SELECT COUNT(DISTINCT user_id) FROM lottery_tickets WHERE draw_id = ?");
$totalParticipantsStmt->execute([$drawId]);
$totalParticipants = (int)$totalParticipantsStmt->fetchColumn();
$drawEndTs = strtotime($currentDraw['week_end'] . ' 23:59:59');
$nowTs = time();
$secondsLeft = max(0, $drawEndTs - $nowTs);
$daysLeft = intdiv($secondsLeft, 86400);
$hoursLeft = intdiv($secondsLeft % 86400, 3600);
$minutesLeft = intdiv($secondsLeft % 3600, 60);
$secondsOnlyLeft = $secondsLeft % 60;

// Check requirements: ads watched today
$userAdsToday = 0;
if ($lottery_req_ads > 0) {
    try {
        $adStmt = $pdo->prepare("SELECT COALESCE(SUM(claims), 0) FROM user_ad_daily WHERE user_id = ? AND claim_date = ?");
        $adStmt->execute([$user_id, $todayStr]);
        $userAdsToday = (int)$adStmt->fetchColumn();
    } catch(Exception $e) { $userAdsToday = 0; }
}

// Check requirements: earn tasks today from Earn section / Bitcotask PTC only.
// Bitcotasks postbacks may use different offer_type values, so count all completed_offers except WatchAd and Lottery.
$userEarnToday = 0;
if ($lottery_req_earn > 0) {
    try {
        $earnStmt = $pdo->prepare("SELECT COUNT(*) FROM completed_offers WHERE user_id = ? AND DATE(created_at) = ? AND reward > 0 AND LOWER(COALESCE(offer_type, '')) NOT IN ('watchad', 'lottery')");
        $earnStmt->execute([$user_id, $todayStr]);
        $userEarnToday = (int)$earnStmt->fetchColumn();
    } catch(Exception $e) { $userEarnToday = 0; }
}

$adsOk = ($lottery_req_ads <= 0 || $userAdsToday >= $lottery_req_ads);
$earnOk = ($lottery_req_earn <= 0 || $userEarnToday >= $lottery_req_earn);
$requirementsOk = $adsOk && $earnOk;
$canClaim = !$claimedToday && $userTicketCount < 7 && $requirementsOk && $currentDraw['status'] === 'active';
$buttonCanClick = !$claimedToday && $userTicketCount < 7 && $currentDraw['status'] === 'active';


// Handle ticket claim AJAX
if (isset($_GET['claim_ticket'])) {
    header('Content-Type: application/json');
    
    if ($currentDraw['status'] !== 'active') {
        echo json_encode(['status' => 'error', 'msg' => 'Draw is not active.']);
        exit;
    }
    if ($claimedToday) {
        echo json_encode(['status' => 'error', 'msg' => 'You already claimed a ticket today!']);
        exit;
    }
    if ($userTicketCount >= 7) {
        echo json_encode(['status' => 'error', 'msg' => 'Maximum 7 tickets per week reached!']);
        exit;
    }
    if (!$adsOk) {
        echo json_encode(['status' => 'error', 'msg' => "Watch {$lottery_req_ads} ads first! ({$userAdsToday}/{$lottery_req_ads})"]);
        exit;
    }
    if (!$earnOk) {
        echo json_encode(['status' => 'error', 'msg' => "Complete {$lottery_req_earn} Earn-section / Bitcotask PTC tasks first! ({$userEarnToday}/{$lottery_req_earn})"]);
        exit;
    }
    try {
        $pdo->beginTransaction();
        
        // Generate ticket number
        $ticketNumber = strtoupper(substr(md5($user_id . $drawId . microtime(true) . mt_rand()), 0, 8));
        
        // Insert ticket
        $pdo->prepare("INSERT INTO lottery_tickets (user_id, draw_id, ticket_number) VALUES (?, ?, ?)")->execute([$user_id, $drawId, $ticketNumber]);
        
        // Update prize pool by admin-controlled amount per free ticket claim
        if ($lottery_ticket_pool_increment > 0) {
            $pdo->prepare("UPDATE lottery_draws SET prize_pool = prize_pool + ? WHERE id = ?")->execute([$lottery_ticket_pool_increment, $drawId]);
        }
        
        $pdo->commit();

        // Fetch updated prize pool so front-end can display the new total instantly
        $updatedPoolStmt = $pdo->prepare("SELECT prize_pool FROM lottery_draws WHERE id = ?");
        $updatedPoolStmt->execute([$drawId]);
        $newPool = (float)$updatedPoolStmt->fetchColumn();
        $newTotalPrize = $lottery_prize_base + $newPool;

        echo json_encode(['status' => 'success', 'ticket' => $ticketNumber, 'msg' => 'Ticket #' . $ticketNumber . ' claimed!', 'new_prize' => $newTotalPrize]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'msg' => 'Failed to claim ticket.']);
    }
    exit;
}

// Past winners
$pastWinners = $pdo->query("SELECT ld.*, u.username FROM lottery_draws ld JOIN users u ON ld.winner_user_id = u.id WHERE ld.status = 'drawn' ORDER BY ld.drawn_at DESC LIMIT 5")->fetchAll();

// Days left calc
$endDate = new DateTime($weekEnd . ' 23:59:59', new DateTimeZone('UTC'));
$daysLeft = max(0, (int)$now->diff($endDate)->days);
$drawIsActive = $currentDraw['status'] === 'active';
?>

<style>
@keyframes ticketPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.ticket-pulse { animation: ticketPulse 2s ease-in-out infinite; }
.shimmer-bg { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); background-size: 200% 100%; animation: shimmer 3s infinite; }
@keyframes confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(-100px) rotate(720deg); opacity: 0; } }
.confetti-piece { animation: confetti 1s ease-out forwards; }
</style>

<div class="space-y-4 pb-4">

    <!-- Hero Card -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 p-[1px] shadow-lg shadow-violet-500/30">
        <div class="relative overflow-hidden rounded-[calc(0.75rem-1px)] bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 p-5">
            <div class="absolute inset-0 shimmer-bg"></div>
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
            <div class="relative flex items-center gap-4">
                <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm ticket-pulse ring-2 ring-white/20">
                    <i class="fas fa-ticket text-3xl text-white"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-extrabold text-white text-lg tracking-tight">Weekly Lottery</h3>
                    <p class="text-violet-100 text-xs font-medium mt-0.5">Win <b id="lottery-hero-prize"><?php echo number_format($lottery_prize, 0); ?></b> coins every week!</p>
                </div>
                <?php if ($drawIsActive): ?>
                <div class="bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-center ring-1 ring-white/10">
                    <div class="text-lg font-extrabold"><?php echo $daysLeft; ?></div>
                    <div class="text-[9px] font-bold uppercase opacity-80">days left</div>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 gap-3">
        <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-violet-500/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <div id="lottery-stat-prize" class="text-lg font-extrabold bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent"><?php echo number_format($lottery_prize, 0); ?></div>
            <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Prize</div>
        </div>
        <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-violet-500/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <div class="text-lg font-extrabold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent"><?php echo $totalTickets; ?></div>
            <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Tickets</div>
        </div>
        <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-violet-500/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <div class="text-lg font-extrabold bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent"><?php echo $totalParticipants; ?></div>
            <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Players</div>
        </div>
    </div>

    <!-- Claim Ticket Section -->
    <?php if ($drawIsActive): ?>
    <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
            <h4 class="font-extrabold text-gray-800 dark:text-white flex items-center gap-2"><i class="fas fa-ticket text-amber-500"></i> Claim Ticket</h4>
            <span class="text-xs font-bold text-gray-500 dark:text-gray-400"><?php echo $userTicketCount; ?>/7 this week</span>
        </div>

        <!-- Requirements -->
        <div class="space-y-2 mb-4">

            <?php if ($lottery_req_ads > 0): ?>
            <div class="flex items-center justify-between p-3 rounded-xl <?php echo $adsOk ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20' : 'bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-500/20'; ?>">
                <div class="flex items-center gap-2 text-xs font-bold <?php echo $adsOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'; ?>">
                    <i class="fas <?php echo $adsOk ? 'fa-check-circle' : 'fa-circle-play'; ?>"></i>
                    <span>Watch Ads</span>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg <?php echo $adsOk ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'; ?>"><?php echo $userAdsToday; ?>/<?php echo $lottery_req_ads; ?></span>
            </div>
            <?php endif; ?>

            <?php if ($lottery_req_earn > 0): ?>
            <div class="flex items-center justify-between p-3 rounded-xl <?php echo $earnOk ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20' : 'bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-500/20'; ?>">
                <div class="flex items-center gap-2 text-xs font-bold <?php echo $earnOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'; ?>">
                    <i class="fas <?php echo $earnOk ? 'fa-check-circle' : 'fa-bullseye'; ?>"></i>
                    <span>Earn Tasks</span>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg <?php echo $earnOk ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'; ?>"><?php echo $userEarnToday; ?>/<?php echo $lottery_req_earn; ?></span>
            </div>
            <?php endif; ?>

            <?php if ($claimedToday): ?>
            <div class="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20">
                <div class="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <i class="fas fa-info-circle"></i>
                    <span>Already claimed today — come back tomorrow!</span>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <!-- Claim Button -->
        <button id="claim-ticket-btn" onclick="claimTicket()" <?php echo $buttonCanClick ? '' : 'disabled'; ?>
            class="w-full py-3.5 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-2
            <?php echo $buttonCanClick ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer' : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-600 cursor-not-allowed'; ?>">
            <i class="fas fa-ticket"></i>
            <?php
            if ($claimedToday) echo 'Claimed Today';
            elseif ($userTicketCount >= 7) echo 'Max Tickets Reached';
            elseif (!$adsOk) echo 'Watch Ads First';
            elseif (!$earnOk) echo 'Complete Earn First';
            else echo 'Claim Free Ticket';
            ?>
        </button>
    </div>
    <?php endif; ?>

    <!-- Your Tickets -->
    <?php if (!empty($userTickets)): ?>
    <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <h4 class="font-extrabold text-gray-800 dark:text-white flex items-center gap-2 mb-3"><i class="fas fa-ticket text-indigo-500"></i> Your Tickets</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <?php foreach ($userTickets as $t): ?>
            <div class="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-3 text-center">
                <div class="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">#<?php echo $t['ticket_number']; ?></div>
                <div class="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5"><?php echo date('M j', strtotime($t['claimed_at'])); ?></div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Past Winners -->
    <?php if (!empty($pastWinners)): ?>
    <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <h4 class="font-extrabold text-gray-800 dark:text-white flex items-center gap-2 mb-3"><i class="fas fa-trophy text-amber-500"></i> Recent Winners</h4>
        <div class="space-y-2">
            <?php foreach ($pastWinners as $w): ?>
            <div class="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                <div>
                    <div class="text-xs font-bold text-gray-800 dark:text-white"><i class="fas fa-crown text-amber-500 mr-1"></i> <?php echo htmlspecialchars($w['username']); ?></div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400"><?php echo $w['week_start']; ?> — <?php echo $w['week_end']; ?></div>
                </div>
                <div class="text-xs font-extrabold text-amber-600 dark:text-amber-400">+<?php echo number_format((float)$w['prize_pool'] > 0 ? (float)(getSetting('lottery_prize') ?: 500) + (float)$w['prize_pool'] : (float)(getSetting('lottery_prize') ?: 500), 0); ?></div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Draw ended state -->
    <?php if (!$drawIsActive): ?>
    <div class="bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-sm">
        <?php if ($currentDraw['status'] === 'drawn'): ?>
            <i class="fas fa-trophy text-4xl text-amber-500 mb-3"></i>
            <p class="font-extrabold text-gray-800 dark:text-white text-lg">This week's draw is complete!</p>
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">A new draw starts next Monday (UTC).</p>
        <?php else: ?>
            <i class="fas fa-pause-circle text-4xl text-gray-400 mb-3"></i>
            <p class="font-extrabold text-gray-800 dark:text-white text-lg">Draw was cancelled</p>
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Check back next week!</p>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<script>
window.claimTicket = function() {
    var btn = document.getElementById('claim-ticket-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';

    fetch('./pages/load_lottery.php?claim_ticket=1', {
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.status === 'success') {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.msg;
            btn.className = 'w-full py-3.5 rounded-xl font-extrabold text-sm bg-emerald-500 text-white shadow-lg';

            // Instantly update prize display on the page
            if (data.new_prize) {
                var formattedPrize = Number(data.new_prize).toLocaleString('en-US', {maximumFractionDigits: 0});
                var heroPrize = document.getElementById('lottery-hero-prize');
                var statPrize = document.getElementById('lottery-stat-prize');
                if (heroPrize) heroPrize.textContent = formattedPrize;
                if (statPrize) statPrize.textContent = formattedPrize;
            }
            setTimeout(function() {
                if (typeof tgLoadContent === 'function') {
                    tgLoadContent('pages/load_lottery.php', document.querySelector('.nav-item.active'));
                } else {
                    location.reload();
                }
            }, 1500);
        } else {
            btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (data.msg || 'Unable to claim ticket');
            btn.className = 'w-full py-3.5 rounded-xl font-extrabold text-sm bg-red-500 text-white';
            btn.disabled = false;
            setTimeout(function() {
                if (typeof tgLoadContent === 'function') {
                    tgLoadContent('pages/load_lottery.php', document.querySelector('.nav-item.active'));
                } else {
                    location.reload();
                }
            }, 2500);
        }
    })
    .catch(function() {
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error, try again';
        btn.disabled = false;
    });
};

// Defensive binding for AJAX-loaded content where inline onclick may not execute reliably.
(function() {
    var btn = document.getElementById('claim-ticket-btn');
    if (btn) {
        btn.removeEventListener('click', window.claimTicket);
        btn.addEventListener('click', window.claimTicket);
    }
})();
</script>
