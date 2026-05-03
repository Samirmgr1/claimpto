<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['user_id'])) {
    return;
}

$user_id = $_SESSION['user_id'];
$currency = getSetting('currency_name') ?: 'Coins';
$commission_rate = (float)(getSetting('referral_commission') ?: 10);
$tg_only_mode = getSetting('telegram_only_mode') == '1';

$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE referred_by = ?");
$stmt->execute([$user_id]);
$totalReferrals = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COALESCE(SUM(commission), 0) FROM referral_earnings WHERE user_id = ?");
$stmt->execute([$user_id]);
$totalCommission = (float)$stmt->fetchColumn();

$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$allowed_limits = [10, 20, 50, 100];
$limit = isset($_GET['limit']) && in_array((int)$_GET['limit'], $allowed_limits) ? (int)$_GET['limit'] : 10;
$offset = ($page - 1) * $limit;

$total_pages = $totalReferrals > 0 ? ceil($totalReferrals / $limit) : 1;

$stmt = $pdo->prepare("
    SELECT u.id, u.username, u.created_at, 
           COALESCE(SUM(re.commission), 0) as earned
    FROM users u
    LEFT JOIN referral_earnings re ON re.referred_id = u.id AND re.user_id = :uid
    WHERE u.referred_by = :uid
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute(['uid' => $user_id]);
$referredUsers = $stmt->fetchAll();

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];

if ($tg_only_mode || (isset($_SESSION['is_telegram']) && $_SESSION['is_telegram'])) {
    $tgUsername = getSetting('telegram_bot_username');
    if ($tgUsername) {
        $refLink = 'https://t.me/' . htmlspecialchars($tgUsername) . '?start=' . $user_id;
    } else {
        $refLink = 'https://t.me/YourBotUser?start=' . $user_id;
    }
} else {
    $refLink = $protocol . '://' . $host . '/index.php?ref=' . $user_id;
}
?>

<?php $bannerTop = getSetting('banner_top'); if (!empty($bannerTop)): ?>
<div class="w-full mb-4 rounded-xl overflow-hidden text-center flex justify-center" id="banner-top"><?php echo $bannerTop; ?></div>
<?php endif; ?>

<div class="mb-8 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-violet-500/30 relative overflow-hidden animate-[fadeInUp_0.5s_ease-out]">
    <div class="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
    <div class="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
    <div class="relative z-10">
        <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                <i class="fas fa-user-group"></i>
            </div>
            <div>
                <h3 class="text-xl sm:text-2xl font-extrabold tracking-tight">Invite Friends & Earn</h3>
                <p class="text-violet-100 text-sm font-medium">Get <span class="font-extrabold text-white"><?php echo $commission_rate; ?>%</span> commission from your referrals' earnings!</p>
            </div>
        </div>
        <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input type="text" id="refLinkInput" value="<?php echo htmlspecialchars($refLink); ?>" readonly 
                   class="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white font-mono text-sm outline-none cursor-text select-all">
            <button onclick="copyRefLink()" id="copyBtn" class="whitespace-nowrap px-6 py-3 bg-white text-violet-600 hover:bg-violet-50 hover:scale-105 active:scale-95 rounded-lg font-extrabold transition-all duration-300 shadow-lg flex items-center justify-center gap-2">
                <i class="fas fa-copy" id="copyIcon"></i> <span id="copyText">Copy Link</span>
            </button>
        </div>
    </div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform">
        <div class="absolute -right-4 -top-4 text-violet-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-users"></i></div>
        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-users text-violet-500"></i> Total Referrals</div>
        <div class="text-3xl font-extrabold text-gray-900 dark:text-white"><?php echo number_format($totalReferrals); ?></div>
    </div>
    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm hover:-translate-y-1 transition-transform">
        <div class="absolute -right-4 -top-4 text-emerald-500/10 text-8xl group-hover:scale-110 transition-transform"><i class="fas fa-coins"></i></div>
        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-coins text-emerald-500"></i> Commission Earned</div>
        <div class="text-3xl font-extrabold text-emerald-500"><?php echo number_format($totalCommission, 2); ?> <span class="text-sm font-medium opacity-70"><?php echo htmlspecialchars($currency); ?></span></div>
    </div>
</div>

<div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
    <div class="p-6 border-b border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 class="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <i class="fas fa-list text-brand-primary"></i> Your Referrals
        </h3>
        
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-dark-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Show:</span>
            <select onchange="window.changeRefLimit(this.value)" class="bg-transparent text-sm font-bold text-brand-primary outline-none cursor-pointer">
                <option value="10" <?php echo $limit == 10 ? 'selected' : ''; ?>>10</option>
                <option value="20" <?php echo $limit == 20 ? 'selected' : ''; ?>>20</option>
                <option value="50" <?php echo $limit == 50 ? 'selected' : ''; ?>>50</option>
                <option value="100" <?php echo $limit == 100 ? 'selected' : ''; ?>>100</option>
            </select>
        </div>
    </div>

    <?php if (empty($referredUsers)): ?>
        <div class="p-10 text-center">
            <div class="w-20 h-20 bg-gray-200 dark:bg-dark-900 rounded-full flex items-center justify-center mb-6 border border-gray-300 dark:border-white/5 shadow-inner mx-auto">
                <i class="fas fa-user-plus text-3xl text-gray-400 dark:text-gray-600"></i>
            </div>
            <h3 class="text-xl font-extrabold text-gray-800 dark:text-white mb-2">No Referrals Yet</h3>
            <p class="text-gray-500 dark:text-gray-400 font-medium text-sm">Share your link above to start inviting friends and earning commissions!</p>
        </div>
    <?php else: ?>
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="bg-gray-50 dark:bg-dark-900/50 text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                        <th class="px-6 py-4 text-left">#</th>
                        <th class="px-6 py-4 text-left">User</th>
                        <th class="px-6 py-4 text-left">Joined</th>
                        <th class="px-6 py-4 text-right">Commission</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    <?php foreach ($referredUsers as $i => $ref): 
                        $maskedName = substr($ref['username'], 0, 3) . '***' . substr($ref['username'], -2);
                        $rowNumber = $offset + $i + 1;
                    ?>
                    <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td class="px-6 py-4 text-sm font-bold text-gray-400"><?php echo $rowNumber; ?></td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                    <?php echo strtoupper(substr($ref['username'], 0, 1)); ?>
                                </div>
                                <span class="font-bold text-sm text-gray-700 dark:text-gray-300"><?php echo htmlspecialchars($maskedName); ?></span>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                            <?php echo date('M d, Y', strtotime($ref['created_at'])); ?>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <span class="font-extrabold text-sm <?php echo $ref['earned'] > 0 ? 'text-emerald-500' : 'text-gray-400'; ?>">
                                <?php echo number_format($ref['earned'], 2); ?> <?php echo htmlspecialchars($currency); ?>
                            </span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <?php if ($total_pages > 1): ?>
        <div class="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark-900/50">
            
            <button onclick="window.goToRefPage(<?php echo $page - 1; ?>)" <?php echo $page <= 1 ? 'disabled' : ''; ?> 
                    class="px-3 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page <= 1 ? 'text-gray-400 bg-gray-100 dark:bg-dark-800 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                <i class="fas fa-chevron-left"></i> Prev
            </button>

            <div class="flex items-center gap-1 hidden sm:flex">
                <?php 
                $start_page = max(1, $page - 2);
                $end_page = min($total_pages, $page + 2);

                if ($start_page > 1) {
                    echo '<button onclick="window.goToRefPage(1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">1</button>';
                    if ($start_page > 2) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                }

                for ($i = $start_page; $i <= $end_page; $i++) {
                    if ($i == $page) {
                        echo '<button class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-brand-primary text-white shadow-md shadow-brand-primary/30">'.$i.'</button>';
                    } else {
                        echo '<button onclick="window.goToRefPage('.$i.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">'.$i.'</button>';
                    }
                }

                if ($end_page < $total_pages) {
                    if ($end_page < $total_pages - 1) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                    echo '<button onclick="window.goToRefPage('.$total_pages.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">'.$total_pages.'</button>';
                }
                ?>
            </div>
            
            <div class="sm:hidden text-xs font-bold text-gray-500">
                Page <?php echo $page; ?> of <?php echo $total_pages; ?>
            </div>

            <button onclick="window.goToRefPage(<?php echo $page + 1; ?>)" <?php echo $page >= $total_pages ? 'disabled' : ''; ?> 
                    class="px-3 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page >= $total_pages ? 'text-gray-400 bg-gray-100 dark:bg-dark-800 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                Next <i class="fas fa-chevron-right"></i>
            </button>
            
        </div>
        <?php endif; ?>

    <?php endif; ?>
</div>

<?php $bannerBottom = getSetting('banner_bottom'); if (!empty($bannerBottom)): ?>
<div class="w-full mt-6 rounded-xl overflow-hidden text-center flex justify-center" id="banner-bottom"><?php echo $bannerBottom; ?></div>
<?php endif; ?>

<script>
    window.currentRefLimit = <?php echo $limit; ?>;
    
    window.changeRefLimit = function(newLimit) {
        let targetUrl = 'pages/load_referrals.php?page=1&limit=' + newLimit;
        window.callRefLoader(targetUrl);
    };

    window.goToRefPage = function(pageNumber) {
        let targetUrl = 'pages/load_referrals.php?page=' + pageNumber + '&limit=' + window.currentRefLimit;
        window.callRefLoader(targetUrl);
    };

    window.callRefLoader = function(url) {
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            let activeMenu = document.querySelector('.nav-item.active') || document.querySelector('.nav-link.active');
            tgLoadContent(url, activeMenu);
        } else if (typeof loadContent === 'function') {
            loadContent(url);
        } else {
            console.error("Loader function not found.");
        }
    };
</script>