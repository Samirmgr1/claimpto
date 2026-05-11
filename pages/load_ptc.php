<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';
if (!isset($_SESSION['user_id'])) {
    return;
}
$user_id = $_SESSION['user_id'];
$api_key = getSetting('bitcotask_api_key');
$api_token = getSetting('bitcotask_api_token');
$ip = getUserIP();
if ($ip == '127.0.0.1' || $ip == '::1' || $ip == 'Unknown IP') {
    $ip = '103.112.53.1';
}
$currency = getSetting('currency_name');
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$limit = 15;
$is_tg = isset($_SESSION['is_telegram']) && $_SESSION['is_telegram'];
?>
<?php $bannerTop = getSetting('banner_top'); if (!empty($bannerTop)): ?>
<div class="w-full mb-4 rounded-xl overflow-hidden text-center flex justify-center" id="banner-top"><?php echo $bannerTop; ?></div>
<?php endif; ?>
<div class="mb-8 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-violet-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden animate-[fadeInUp_0.5s_ease-out]">
    <div class="absolute top-0 right-0 w-40 h-40 bg-white/15 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
    <div class="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
    <div class="relative z-10 flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
        <div class="w-14 h-14 bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-inner ring-1 ring-white/10">
            <i class="fas fa-bullhorn transform -rotate-12"></i>
        </div>
        <div>
            <h3 class="text-xl sm:text-2xl font-extrabold mb-1 tracking-tight">PTC Ads</h3>
            <p class="text-violet-100 text-sm font-medium">View ads and earn instant rewards.</p>
        </div>
    </div>
</div>
<?php
if (empty($api_key) || empty($api_token)) {
    echo '<div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-center font-bold">Admin: Please set Bitcotasks API Key and Bearer Token in settings.</div>';
    return;
}
$url = "https://bitcotasks.com/api/{$api_key}/{$user_id}/{$ip}";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0';
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$api_token}",
    "User-UA: {$ua}",
    "Accept: application/json"
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
curl_close($ch);
if ($response) {
    $responseArray = json_decode($response, true);
    if (isset($responseArray['status']) && (int)$responseArray['status'] == 200 && !empty($responseArray['data'])) {
        $adCount = count($responseArray['data']);
        $totalRewards = 0;
        foreach ($responseArray['data'] as $item) {
            $totalRewards += isset($item['reward']) ? (float)$item['reward'] : 0;
        }
        usort($responseArray['data'], function($a, $b) {
            $boostedA = !empty($a['boosted_campaign']) ? 1 : 0;
            $boostedB = !empty($b['boosted_campaign']) ? 1 : 0;
            if ($boostedA !== $boostedB) {
                return $boostedB <=> $boostedA;
            }
            $rewardA = isset($a['reward']) ? (float)$a['reward'] : 0;
            $rewardB = isset($b['reward']) ? (float)$b['reward'] : 0;
            return $rewardB <=> $rewardA;
        });
        $total_pages = ceil($adCount / $limit);
        $offset = ($page - 1) * $limit;
        $current_page_ads = array_slice($responseArray['data'], $offset, $limit);
        ?>
        <div class="flex flex-wrap gap-4 mb-8 justify-center">
            <div class="bg-black/5 dark:bg-white/5 px-6 py-3 rounded-full border border-gray-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                <span class="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest">Ads:</span>
                <span class="font-extrabold text-brand-primary dark:text-brand-accent text-xl"><?= $adCount ?></span>
            </div>
            <div class="bg-black/5 dark:bg-white/5 px-6 py-3 rounded-full border border-gray-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                <span class="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest">Total:</span>
                <span class="font-extrabold text-emerald-500 text-xl">
                    <?= rtrim(rtrim(sprintf('%.6f', $totalRewards), '0'), '.') ?>
                    <span class="text-base font-normal opacity-80"><?= htmlspecialchars($currency) ?></span>
                </span>
            </div>
        </div>

        <?php if ($is_tg): ?>
        <div class="flex flex-col gap-3">
            <?php foreach ($current_page_ads as $campaign):
                $rawReward = isset($campaign['reward']) ? (float)$campaign['reward'] : 0;
                $displayReward = ($rawReward > 0 && $rawReward < 0.01) ? rtrim(rtrim(sprintf('%.6f', $rawReward), '0'), '.') : number_format($rawReward, 2);
                $adTitle = !empty($campaign['title']) ? $campaign['title'] : 'Click to earn';
                $adDuration = isset($campaign['duration']) ? (int)$campaign['duration'] : 0;
                $adCurrency = !empty($campaign['currency_name']) ? $campaign['currency_name'] : $currency;
                $adUrl = !empty($campaign['url']) ? $campaign['url'] : '#';
                $adImage = !empty($campaign['image']) ? $campaign['image'] : '';
                $isBoosted = !empty($campaign['boosted_campaign']);
            ?>
            <a href="<?= htmlspecialchars($adUrl) ?>" target="_blank" onclick="window.markAdProcessing(this)" class="ad-card relative flex items-center justify-between p-4 bg-white dark:bg-dark-800 rounded-2xl border <?= $isBoosted ? 'border-brand-primary/50' : 'border-gray-100 dark:border-white/5' ?> shadow-sm active:scale-[0.98] transition-all overflow-hidden">
                <?php if($isBoosted): ?>
                    <div class="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
                <?php endif; ?>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-xl shadow-inner shrink-0 overflow-hidden">
                        <?php if(!empty($adImage)): ?>
                            <img src="<?= htmlspecialchars($adImage) ?>" alt="" class="w-full h-full object-cover">
                        <?php else: ?>
                            <i class="fas fa-globe"></i>
                        <?php endif; ?>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 mb-1"><?= htmlspecialchars($adTitle) ?></h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-extrabold text-emerald-500"><?= $displayReward ?> <?= htmlspecialchars($adCurrency) ?></span>
                            <span class="text-[10px] text-gray-500 font-bold bg-gray-100 dark:bg-dark-900 px-2 py-0.5 rounded-md"><i class="fas fa-clock text-brand-accent"></i> <?= $adDuration ?>s</span>
                        </div>
                    </div>
                </div>
                <div class="claim-btn shrink-0 ml-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold flex items-center justify-center shadow-md">
                    <span class="btn-text">View</span> <i class="fas fa-play ml-1.5 text-[10px] btn-icon"></i>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            <?php foreach ($current_page_ads as $campaign):
                $rawReward = isset($campaign['reward']) ? (float)$campaign['reward'] : 0;
                $displayReward = ($rawReward > 0 && $rawReward < 0.01) ? rtrim(rtrim(sprintf('%.6f', $rawReward), '0'), '.') : number_format($rawReward, 2);
                $adTitle = !empty($campaign['title']) ? $campaign['title'] : 'Click to earn';
                $adDuration = isset($campaign['duration']) ? (int)$campaign['duration'] : 0;
                $adCurrency = !empty($campaign['currency_name']) ? $campaign['currency_name'] : $currency;
                $adUrl = !empty($campaign['url']) ? $campaign['url'] : '#';
                $isBoosted = !empty($campaign['boosted_campaign']);
            ?>
            <a href="<?= htmlspecialchars($adUrl) ?>" target="_blank" onclick="window.markAdProcessing(this)" class="ad-card block group relative">
                <div class="bg-white dark:bg-dark-800 border <?= $isBoosted ? 'border-brand-primary/40 dark:border-brand-primary/40' : 'border-gray-200 dark:border-white/10' ?> rounded-2xl p-5 h-full flex flex-col justify-between transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-xl group-hover:shadow-brand-primary/20 relative overflow-hidden">
                    <?php if($isBoosted): ?>
                        <div class="absolute top-0 right-0 bg-brand-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">BOOSTED</div>
                    <?php endif; ?>
                    <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10 pt-2">
                        <h3 class="text-base font-bold text-gray-800 dark:text-gray-200 mb-2 line-clamp-2 leading-tight group-hover:text-brand-primary transition-colors"><?= htmlspecialchars($adTitle) ?></h3>
                        <div class="font-extrabold text-brand-primary text-2xl mb-3 flex items-baseline gap-1">
                            <?= $displayReward ?>
                            <span class="text-xs font-semibold opacity-70"><?= htmlspecialchars($adCurrency) ?></span>
                        </div>
                        <div class="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-900 px-3 py-1.5 rounded-lg mb-4">
                            <i class="fas fa-clock text-brand-accent"></i> <?= $adDuration ?> Sec
                        </div>
                    </div>
                    <div class="claim-btn w-full bg-brand-primary group-hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm text-center transition-colors shadow-md relative z-10 flex items-center justify-center gap-2">
                        <span class="btn-text">Claim Now</span> <i class="fas fa-arrow-right text-xs btn-icon"></i>
                    </div>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <?php if ($total_pages > 1): ?>
        <div class="p-4 mt-6 border border-gray-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-dark-800/50 rounded-2xl shadow-sm">
            <button onclick="window.goToPtcPage(<?php echo $page - 1; ?>)" <?php echo $page <= 1 ? 'disabled' : ''; ?>
                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page <= 1 ? 'text-gray-400 bg-gray-100 dark:bg-dark-900 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                <i class="fas fa-chevron-left"></i> Prev
            </button>
            <div class="flex items-center gap-1 hidden sm:flex">
                <?php
                $start_page = max(1, $page - 2);
                $end_page = min($total_pages, $page + 2);
                if ($start_page > 1) {
                    echo '<button onclick="window.goToPtcPage(1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">1</button>';
                    if ($start_page > 2) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                }
                for ($i = $start_page; $i <= $end_page; $i++) {
                    if ($i == $page) {
                        echo '<button class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-brand-primary text-white shadow-md shadow-brand-primary/30">'.$i.'</button>';
                    } else {
                        echo '<button onclick="window.goToPtcPage('.$i.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">'.$i.'</button>';
                    }
                }
                if ($end_page < $total_pages) {
                    if ($end_page < $total_pages - 1) echo '<span class="text-gray-400 text-xs px-1">...</span>';
                    echo '<button onclick="window.goToPtcPage('.$total_pages.')" class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700">'.$total_pages.'</button>';
                }
                ?>
            </div>
            <div class="sm:hidden text-xs font-bold text-gray-500">
                Page <?php echo $page; ?> of <?php echo $total_pages; ?>
            </div>
            <button onclick="window.goToPtcPage(<?php echo $page + 1; ?>)" <?php echo $page >= $total_pages ? 'disabled' : ''; ?>
                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all <?php echo $page >= $total_pages ? 'text-gray-400 bg-gray-100 dark:bg-dark-900 cursor-not-allowed opacity-50' : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 shadow-sm border border-gray-200 dark:border-white/5'; ?>">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <?php endif; ?>
        <?php
    } else {
        $msg = $responseArray['message'] ?? 'No campaigns available currently.';
        echo '<div class="bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div class="w-20 h-20 bg-gray-200 dark:bg-dark-900 rounded-full flex items-center justify-center mb-6 border border-gray-300 dark:border-white/5 shadow-inner">
                    <i class="fas fa-box-open text-3xl text-gray-400 dark:text-gray-600"></i>
                </div>
                <h3 class="text-2xl font-extrabold text-gray-800 dark:text-white mb-2">No Ads Available</h3>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-6">' . htmlspecialchars($msg) . '</p>
              </div>';
    }
} else {
    echo '<div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-8 text-center">
            <i class="fas fa-satellite-dish text-4xl text-red-500 mb-4 animate-pulse"></i>
            <p class="text-red-600 dark:text-red-400 font-bold text-lg">Connection Error</p>
          </div>';
}
?>
<?php $bannerBottom = getSetting('banner_bottom'); if (!empty($bannerBottom)): ?>
<div class="w-full mt-6 rounded-xl overflow-hidden text-center flex justify-center" id="banner-bottom"><?php echo $bannerBottom; ?></div>
<?php endif; ?>
<script>
    window.markAdProcessing = function(element) {
        let card = element.closest('.ad-card');
        if (card) {
            card.classList.add('opacity-50', 'grayscale', 'pointer-events-none');
            let btn = card.querySelector('.claim-btn');
            if (btn) {
                btn.classList.remove('bg-brand-primary', 'group-hover:bg-indigo-500');
                btn.classList.add('bg-gray-500');
                let btnText = btn.querySelector('.btn-text');
                let btnIcon = btn.querySelector('.btn-icon');
                if(btnText) btnText.innerText = 'Processing';
                if(btnIcon) {
                    btnIcon.className = 'fas fa-spinner fa-spin ml-1.5 text-[10px] btn-icon';
                }
            }
        }
    };
    window.goToPtcPage = function(pageNumber) {
        let targetUrl = 'pages/load_ptc.php?page=' + pageNumber;
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            let activeMenu = document.querySelector('.nav-item.active') || document.querySelector('.nav-link.active');
            tgLoadContent(targetUrl, activeMenu);
        } else if (typeof loadContent === 'function') {
            loadContent(targetUrl);
        }
    };
</script>
