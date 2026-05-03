<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';
if (!isset($_SESSION['user_id'])) {
    die('<div class="text-center p-8 text-red-500 font-bold">Session expired. Please login again.</div>');
}
$user_id = $_SESSION['user_id'];
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();
$currency_name = getSetting('currency_name');
$min_withdrawal = (float)(getSetting('min_withdrawal') ?: 100);
$exchange_rate = (float)(getSetting('exchange_rate') ?: 1000);
if ($exchange_rate <= 0) $exchange_rate = 1000;
$usd_value = $user['balance'] / $exchange_rate;
$can_withdraw = ($user['balance'] >= $min_withdrawal);
$progress_percent = min(100, ($user['balance'] / $min_withdrawal) * 100);
$gateway = 'faucetpay';
$gateway_desc = "Sent instantly to your FaucetPay wallet";
$wallet_label = "FaucetPay:";
$has_wallet = !empty($user['wallet']);
?>
<?php $bannerTop = getSetting('banner_top'); if (!empty($bannerTop)): ?>
<div class="w-full mb-4 rounded-xl overflow-hidden text-center flex justify-center" id="banner-top"><?php echo $bannerTop; ?></div>
<?php endif; ?>
<div class="max-w-5xl mx-auto my-8 relative w-full px-4 sm:px-0">
    <div class="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-10 shadow-xl relative overflow-hidden">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <?php if(!$has_wallet): ?>
        <div class="relative z-10 mb-8 rounded-3xl border border-amber-300/40 dark:border-amber-400/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-5 md:p-6 shadow-lg shadow-amber-500/10">
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                    <i class="fas fa-link text-xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-black text-gray-900 dark:text-white">Link Account</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-300 font-medium mt-1">Connect your FaucetPay email for withdrawals.</p>
                    <form id="wallet-link-form" class="mt-4 flex flex-col sm:flex-row gap-3" onsubmit="return window.linkWalletAccount(event)">
                        <input type="email" id="wallet_link_email" required placeholder="Enter FaucetPay email" class="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-dark-900 border border-amber-200 dark:border-white/10 text-gray-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-amber-500/40">
                        <button id="wallet_link_btn" type="submit" class="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-shield-halved"></i>
                            <span>Connect Securely</span>
                        </button>
                    </form>
                    <div id="wallet_link_msg" class="mt-3 text-xs font-bold min-h-[18px]"></div>
                </div>
            </div>
        </div>
        <?php endif; ?>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative z-10 text-left">
            <div class="flex flex-col justify-center">
                <div class="flex items-center gap-5 mb-8">
                    <div class="w-16 h-16 bg-amber-500/10 border-2 border-amber-500/20 rounded-full flex shrink-0 items-center justify-center shadow-inner">
                        <i class="fas fa-wallet text-2xl text-amber-500"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">Withdraw Earnings</h3>
                        <p class="text-gray-500 dark:text-gray-400 text-sm font-medium"><?php echo $gateway_desc; ?></p>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-dark-900 p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                    <span class="text-gray-500 dark:text-gray-400 block mb-2 text-xs font-bold uppercase tracking-widest">Current Balance</span>
                    <h2 class="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-baseline gap-2">
                        <?php echo number_format($user['balance'], 2); ?> 
                        <span class="text-xl font-normal opacity-70"><?php echo htmlspecialchars($currency_name); ?></span>
                    </h2>
                    <div class="text-amber-500 font-bold text-lg mb-2">
                        ≈ $<?php echo number_format($usd_value, 6); ?> USD
                    </div>
                    <?php if(!$can_withdraw): ?>
                    <div class="mt-6 border-t border-gray-200 dark:border-white/5 pt-5">
                        <div class="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                            <span>Progress to Minimum</span>
                            <span class="text-amber-500"><?php echo number_format($progress_percent, 1); ?>%</span>
                        </div>
                        <div class="w-full h-3 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                            <div class="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000 ease-out" style="width: <?php echo $progress_percent; ?>%;"></div>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <div class="flex flex-col justify-center">
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-gray-50 dark:bg-white/5 p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                        <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><i class="fas fa-arrow-down-short-wide text-amber-500"></i> Minimum</div>
                        <div class="font-extrabold text-lg text-gray-800 dark:text-gray-200 leading-none"><?php echo number_format($min_withdrawal); ?> <span class="text-xs font-medium opacity-70"><?php echo htmlspecialchars($currency_name); ?></span></div>
                    </div>
                    <div class="bg-gray-50 dark:bg-white/5 p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                        <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><i class="fas fa-right-left text-amber-500"></i> Exchange Rate</div>
                        <div class="font-extrabold text-lg text-gray-800 dark:text-gray-200 leading-none"><?php echo number_format($exchange_rate); ?> <span class="text-xs font-medium opacity-70">= $1</span></div>
                    </div>
                </div>
                <div class="mb-6">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Select Coin</label>
                    <div class="relative group">
                        <select id="withdraw_coin" onchange="window.updateCoinPreview()" class="w-full p-4 pl-5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-base font-extrabold outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 appearance-none transition-all shadow-sm">
                            <?php
                            $allowed_coins_raw = getSetting('allowed_coins') ?: 'USDT';
                            $allowed_coins = array_filter(array_map('trim', explode(',', $allowed_coins_raw)));
                            foreach ($allowed_coins as $coin) {
                                echo "<option value=\"".htmlspecialchars($coin)."\">".htmlspecialchars($coin)."</option>";
                            }
                            ?>
                        </select>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-amber-500 transition-colors">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
                <div id="coin_preview" class="mb-6 bg-gray-50 dark:bg-dark-900 p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm transition-all">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <i class="fas fa-coins text-amber-500"></i> You will receive
                        </span>
                        <span id="coin_preview_loading" class="hidden text-xs text-gray-400"><i class="fas fa-spinner fa-spin"></i> Loading...</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span id="coin_preview_amount" class="text-2xl font-extrabold text-gray-900 dark:text-white">&mdash;</span>
                        <span id="coin_preview_symbol" class="text-base font-bold text-amber-500"></span>
                    </div>
                    <div id="coin_preview_rate" class="text-xs text-gray-400 dark:text-gray-500 mt-1"></div>
                </div>
                <form onsubmit="event.preventDefault(); window.processWithdraw(this);">
                    <?php if ($can_withdraw): ?>
                        <button type="submit" id="withdraw_btn" class="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-extrabold text-lg transition-all transform hover:-translate-y-1 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-95">
                            <i class="fas fa-bolt"></i> Process Withdrawal
                        </button>
                    <?php else: ?>
                        <button type="button" disabled class="w-full py-4 px-6 bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 rounded-xl font-bold text-base cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 dark:border-white/5">
                            <i class="fas fa-lock"></i> Need <?php echo number_format($min_withdrawal - $user['balance'], 2); ?> more to unlock
                        </button>
                    <?php endif; ?>
                </form>
                <p class="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium bg-amber-500/5 py-3 px-4 rounded-xl border border-amber-500/10 flex w-full items-center justify-center gap-2">
                    <i class="fas fa-paper-plane text-amber-500"></i> 
                    <span>To <?php echo $wallet_label; ?></span>
                    <span class="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[150px] sm:max-w-[200px]"><?php echo htmlspecialchars($user['wallet'] ?: 'Not Set'); ?></span>
                </p>
            </div>
        </div>
    </div>
    <div id="success_modal" class="hidden fixed inset-0 bg-black/80 z-[9999] items-center justify-center p-4 backdrop-blur-md transition-opacity">
        <div class="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 w-full max-w-sm rounded-[2rem] p-8 md:p-10 text-center relative overflow-hidden transform scale-95 transition-transform duration-300" id="success_modal_card">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/20 blur-3xl pointer-events-none"></div>
            <div class="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-emerald-500/40 relative z-10 animate-bounce">
                <i class="fas fa-check"></i>
            </div>
            <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white mb-3 relative z-10">Payment Sent!</h2>
            <p id="payout_msg" class="text-gray-500 dark:text-gray-400 mb-8 text-sm font-medium relative z-10">
                Congratulations! Your rewards have been sent to your wallet successfully.
            </p>
            <button onclick="document.getElementById('success_modal').classList.add('hidden'); window.reloadWithdrawPage();" class="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/30 relative z-10">
                Great, Thanks!
            </button>
        </div>
    </div>
</div>
<?php $bannerBottom = getSetting('banner_bottom'); if (!empty($bannerBottom)): ?>
<div class="w-full mt-6 rounded-xl overflow-hidden text-center flex justify-center" id="banner-bottom"><?php echo $bannerBottom; ?></div>
<?php endif; ?>
<script>
    window.usdValue = <?php echo json_encode((float)$usd_value); ?>;
    window.priceCache = window.priceCache || {};
    window.pricesFetched = window.pricesFetched || false;

    window.updateCoinPreview = function() {
        const coin = document.getElementById('withdraw_coin').value;
        const amountEl = document.getElementById('coin_preview_amount');
        const symbolEl = document.getElementById('coin_preview_symbol');
        const rateEl = document.getElementById('coin_preview_rate');
        const loadingEl = document.getElementById('coin_preview_loading');
        symbolEl.textContent = coin;
        if (window.priceCache[coin] && window.priceCache[coin] > 0) {
            const received = window.usdValue / window.priceCache[coin];
            amountEl.textContent = received.toFixed(8);
            rateEl.textContent = '1 ' + coin + ' = $' + Number(window.priceCache[coin]).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
            loadingEl.classList.add('hidden');
        } else if (window.pricesFetched) {
            amountEl.textContent = '—';
            rateEl.textContent = 'Price unavailable for ' + coin;
            loadingEl.classList.add('hidden');
        } else {
            amountEl.textContent = '...';
            rateEl.textContent = '';
            loadingEl.classList.remove('hidden');
        }
    };

    window.fetchPrices = function() {
        const loadingEl = document.getElementById('coin_preview_loading');
        loadingEl.classList.remove('hidden');
        fetch('../actions/get_prices.php')
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success' && data.prices) {
                    window.priceCache = data.prices;
                }
                window.pricesFetched = true;
                window.updateCoinPreview();
            })
            .catch(() => {
                window.pricesFetched = true;
                window.updateCoinPreview();
            });
    };

    window.reloadWithdrawPage = function() {
        let targetUrl = 'pages/load_withdraw.php';
        if (typeof tgLoadContent === 'function' && window.Telegram && window.Telegram.WebApp) {
            let activeMenu = document.querySelector('.nav-item.active') || document.querySelector('.nav-link.active');
            tgLoadContent(targetUrl, activeMenu);
        } else if (typeof loadContent === 'function') {
            loadContent(targetUrl);
        }
    };

    window.processWithdraw = function(form) {
        const btn = document.getElementById('withdraw_btn');
        const coin = document.getElementById('withdraw_coin').value;
        const originalText = btn.innerHTML;
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        const formData = new FormData();
        formData.append('currency', coin);
        fetch('../actions/withdraw_request_ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(async response => {
            const text = await response.text();
            try { 
                return JSON.parse(text); 
            } catch(e) { 
                console.error("Raw response:", text);
                throw new Error('Invalid JSON response from server.'); 
            }
        })
        .then(data => {
            if(data.status === 'success') {
                if (document.getElementById('payout_msg')) {
                    document.getElementById('payout_msg').innerText = data.message;
                }
                const modal = document.getElementById('success_modal');
                const modalCard = document.getElementById('success_modal_card');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    setTimeout(() => {
                        modalCard.classList.remove('scale-95');
                        modalCard.classList.add('scale-100');
                    }, 10);
                } else {
                    alert(data.message);
                    window.reloadWithdrawPage();
                }
            } else {
                alert(data.message || 'Unknown error occurred.');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        })
        .catch(err => {
            alert('Request failed: ' + err.message + '\nCheck console for details.');
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    };


    window.linkWalletAccount = function(evt) {
        evt.preventDefault();
        const input = document.getElementById('wallet_link_email');
        const btn = document.getElementById('wallet_link_btn');
        const msg = document.getElementById('wallet_link_msg');
        if (!input || !btn) return false;
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connecting...</span>';
        if (msg) msg.innerHTML = '';
        const formData = new FormData();
        formData.append('email', input.value.trim());
        fetch('../actions/link_wallet.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                if (msg) msg.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400">' + data.message + '</span>';
                btn.innerHTML = '<i class="fas fa-check"></i><span>Connected</span>';
                setTimeout(() => window.reloadWithdrawPage(), 1000);
            } else {
                throw new Error(data.message || 'Could not link account.');
            }
        })
        .catch(err => {
            if (msg) msg.innerHTML = '<span class="text-rose-600 dark:text-rose-400">' + err.message + '</span>';
            btn.disabled = false;
            btn.innerHTML = original;
        });
        return false;
    };

    window.fetchPrices();
</script>