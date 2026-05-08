<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['user_id'])) {
    echo '<div class="p-4 bg-red-100 text-red-600 rounded-xl font-bold">Please login first.</div>';
    exit;
}
$user_id = $_SESSION['user_id'];
$currency = getSetting('currency_name') ?: 'Coins';

// Check if wheel addon is installed and active
$wheelActive = false;
$wheelUrl = 'addons/wheel.php';
try {
    if ($pdo->query("SHOW TABLES LIKE 'installed_addons'")->rowCount() > 0) {
        $wStmt = $pdo->prepare("SELECT * FROM installed_addons WHERE addon_id = 'wheel_of_fortune' LIMIT 1");
        $wStmt->execute();
        $wheelAddon = $wStmt->fetch(PDO::FETCH_ASSOC);
        if ($wheelAddon && getSetting('wheel_status') === '1') {
            $wheelActive = true;
        }
    }
} catch (Exception $e) {}
?>

<div class="animate-[fadeIn_0.4s_ease-out]">
    <!-- Header -->
    <div class="mb-6 bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-pink-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-40 h-40 bg-white/15 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
        <div class="relative z-10 flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-inner ring-1 ring-white/10">
                <i class="fas fa-gamepad"></i>
            </div>
            <div>
                <h3 class="text-xl sm:text-2xl font-extrabold mb-1 tracking-tight">Games</h3>
                <p class="text-pink-100 text-sm font-medium">Play games and win rewards!</p>
            </div>
        </div>
    </div>

    <!-- Games Grid -->
    <div class="mb-4">
        <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <i class="fas fa-dice text-brand-primary"></i> Available Games
            </h4>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold border border-brand-primary/20">
                <span class="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></span> 1 Game
            </span>
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Wheel of Fortune Game Card -->
        <div class="group relative">
            <div class="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-[1px] shadow-xl shadow-orange-500/20 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-orange-500/30 group-hover:-translate-y-1">
                <div class="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-white dark:bg-dark-800 p-5">
                    <!-- Decorative elements -->
                    <div class="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div class="absolute -bottom-8 -left-8 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>

                    <!-- Game icon -->
                    <div class="relative z-10 flex items-center gap-4 mb-4">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                            <i class="fas fa-dharmachakra text-3xl animate-[spin_8s_linear_infinite]"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">Spin the Wheel</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">Try your luck!</p>
                        </div>
                    </div>

                    <!-- Game description -->
                    <p class="relative z-10 text-sm text-gray-600 dark:text-gray-300 font-medium mb-4 leading-relaxed">
                        Spin the wheel of fortune for a chance to win big rewards! Each spin gives you a random prize in <strong class="text-orange-500"><?php echo htmlspecialchars($currency); ?></strong>.
                    </p>

                    <!-- Game stats -->
                    <div class="relative z-10 flex items-center gap-2 mb-5">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[11px] font-bold border border-amber-200 dark:border-amber-500/20">
                            <i class="fas fa-star text-[9px]"></i> Popular
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[11px] font-bold border border-emerald-200 dark:border-emerald-500/20">
                            <i class="fas fa-gift text-[9px]"></i> Win <?php echo htmlspecialchars($currency); ?>
                        </span>
                    </div>

                    <!-- Play button -->
                    <?php if ($wheelActive): ?>
                    <button onclick="<?php echo "window.openGame('" . $wheelUrl . "', this)"; ?>" class="relative z-10 w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-play"></i> Play Now
                    </button>
                    <?php else: ?>
                    <button disabled class="relative z-10 w-full py-3.5 bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400 rounded-2xl font-extrabold text-sm cursor-not-allowed flex items-center justify-center gap-2">
                        <i class="fas fa-lock"></i> Coming Soon
                    </button>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- More Games Coming Soon placeholder -->
        <div class="group relative">
            <div class="relative overflow-hidden rounded-[1.75rem] border-2 border-dashed border-gray-300 dark:border-white/10 transition-all duration-300">
                <div class="relative overflow-hidden rounded-[calc(1.75rem-2px)] bg-gray-50/50 dark:bg-dark-800/30 p-5 flex flex-col items-center justify-center min-h-[260px] text-center">
                    <div class="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500 flex items-center justify-center mb-4">
                        <i class="fas fa-puzzle-piece text-3xl"></i>
                    </div>
                    <h3 class="text-base font-extrabold text-gray-500 dark:text-gray-400 mb-1">More Games</h3>
                    <p class="text-xs text-gray-400 dark:text-gray-500 font-semibold">Coming soon...</p>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    window.openGame = function(url, btnElement) {
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            tgLoadContent(url, document.querySelector('.nav-item.active'));
        } else if (typeof loadContent === 'function') {
            loadContent(url);
        } else {
            console.error("Navigation function not found");
        }
    };
</script>
