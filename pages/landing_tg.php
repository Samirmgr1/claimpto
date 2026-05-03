<?php
if (!isset($pdo)) exit();

$site_name = getSetting('site_name') ?: 'Weadev';
$site_logo = getSetting('site_logo') ?: '';
$bot_user = getSetting('telegram_bot_username') ?: '';
$commission_rate = (float)(getSetting('referral_commission') ?: 10);

$ref_code = "app";
if (isset($_GET['ref']) && is_numeric($_GET['ref'])) {
    $ref_code = (int)$_GET['ref'];
} elseif (isset($_SESSION['ref'])) {
    $ref_code = (int)$_SESSION['ref'];
}

$tg_link = !empty($bot_user) ? "https://t.me/" . htmlspecialchars($bot_user) . "?start=" . $ref_code : "#";

$currency = getSetting('currency_name') ?: 'Coins';
$allowed_coins = getSetting('allowed_coins') ?: 'USDT';

$coins_array = array_filter(array_map('trim', explode(',', $allowed_coins)));
$supported_coins_count = count($coins_array) > 0 ? count($coins_array) : 1;

$totalUsers = 0;
$totalCoins = 0;
$totalWithdraws = 0;
$proofs = [];

try { 
    $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() ?: 0; 
    $totalCoins = $pdo->query("SELECT SUM(reward) FROM completed_offers WHERE reward > 0 AND status IN ('1', 'approved')")->fetchColumn() ?: 0; 
    $totalWithdraws = $pdo->query("SELECT COUNT(*) FROM completed_offers WHERE reward < 0 AND status IN ('1', 'approved')")->fetchColumn() ?: 0;
    
    $proofs = $pdo->query("
        SELECT u.username, ABS(c.reward) as amount 
        FROM completed_offers c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.reward < 0 AND c.status IN ('1', 'approved')
        ORDER BY c.id DESC LIMIT 15
    ")->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($site_name); ?> Mini-App — Earn Crypto on Telegram</title>
    <meta name="description" content="Complete simple tasks on Telegram and earn real crypto. Withdraw to FaucetPay instantly.">
    
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#060913', 800: '#0F1320', 700: '#1A1F30' },
                        brand: { primary: '#8B5CF6', accent: '#22D3EE', glow: '#A78BFA' }
                    },
                    animation: {
                        'marquee': 'marquee 25s linear infinite',
                        'float': 'float 6s ease-in-out infinite',
                    },
                    keyframes: {
                        marquee: {
                            '0%': { transform: 'translateX(0%)' },
                            '100%': { transform: 'translateX(-50%)' },
                        },
                        float: {
                            '0%, 100%': { transform: 'translateY(0)' },
                            '50%': { transform: 'translateY(-20px)' },
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .bg-grid {
            background-size: 40px 40px;
            position: fixed; inset: 0; z-index: -2; pointer-events: none;
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            mask-image: radial-gradient(circle at center, black 60%, transparent 100%);
        }
        .glass-panel {
            background: rgba(15, 19, 32, 0.7);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(139, 92, 246, 0.08);
        }
        .ticker-container:hover .animate-marquee {
            animation-play-state: paused;
        }
    </style>
    <?php echo getSetting('custom_head_code'); ?>
</head>
<body class="bg-dark-900 text-gray-200 min-h-screen relative overflow-x-hidden selection:bg-brand-primary/30 selection:text-white">

    <div class="bg-grid"></div>
    <div class="fixed top-0 left-1/4 w-[500px] h-[500px] bg-brand-primary/15 rounded-full blur-[150px] pointer-events-none -translate-y-1/2"></div>
    <div class="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-accent/15 rounded-full blur-[120px] pointer-events-none translate-y-1/2"></div>

    <nav class="sticky top-0 z-50 glass-panel border-b-white/5">
        <div class="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
            <div class="flex items-center gap-3 font-extrabold text-xl tracking-tight text-white">
                <?php if (!empty($site_logo)): ?>
                    <img src="<?= htmlspecialchars($site_logo); ?>" alt="Logo" class="h-8 object-contain">
                <?php else: ?>
                    <i class="fas fa-shield-halved text-brand-primary text-2xl"></i>
                <?php endif; ?>
                <?= htmlspecialchars($site_name); ?>
            </div>
            <a href="<?= $tg_link; ?>" target="_blank" class="px-5 py-2.5 bg-brand-primary hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-primary/30 flex items-center gap-2 transform hover:-translate-y-0.5">
                <i class="fab fa-telegram-plane text-lg"></i> <span class="hidden sm:inline">Open in Telegram</span>
            </a>
        </div>
    </nav>

    <main class="relative z-10">
        <section class="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold text-xs uppercase tracking-widest mb-8 animate-float">
                <span class="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span> Official Telegram App
            </div>
            <h1 class="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                Earn Real Crypto <br class="hidden md:block">
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">Directly on Telegram</span>
            </h1>
            <p class="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Watch PTC ads to earn Coins — <strong>withdraw anytime</strong> to your FaucetPay wallet in <?= htmlspecialchars($allowed_coins); ?>.
            </p>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="<?= $tg_link; ?>" target="_blank" class="w-full sm:w-auto px-8 py-4 bg-white text-dark-900 hover:bg-gray-100 rounded-2xl font-extrabold text-lg transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-3">
                    <i class="fab fa-telegram text-blue-500 text-2xl"></i> Start Earning Free
                </a>
                <a href="#how" class="w-full sm:w-auto px-8 py-4 glass-panel hover:bg-white/5 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center">
                    How it works
                </a>
            </div>
        </section>

        <section class="max-w-6xl mx-auto px-6 py-8">
            <div class="glass-panel rounded-3xl p-2 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                <div class="flex-1 p-6 text-center">
                    <div class="text-4xl font-black text-white mb-1"><?= number_format($totalUsers); ?></div>
                    <div class="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Earners</div>
                </div>
                <div class="flex-1 p-6 text-center">
                    <div class="text-4xl font-black text-brand-primary mb-1"><?= number_format($totalCoins, 2); ?></div>
                    <div class="text-sm font-bold text-gray-500 uppercase tracking-wider"><?= htmlspecialchars($currency); ?> Distributed</div>
                </div>
                <div class="flex-1 p-6 text-center">
                    <div class="text-4xl font-black text-brand-accent mb-1"><?= number_format($totalWithdraws); ?></div>
                    <div class="text-sm font-bold text-gray-500 uppercase tracking-wider">Withdrawals Paid</div>
                </div>
                <div class="flex-1 p-6 text-center">
                    <div class="text-4xl font-black text-white mb-1"><?= $supported_coins_count; ?></div>
                    <div class="text-sm font-bold text-gray-500 uppercase tracking-wider">Supported Coins</div>
                </div>
            </div>
        </section>

        <section class="py-12 overflow-hidden border-y border-white/5 bg-dark-800/50 mt-12 relative">
            <div class="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-dark-900 to-transparent z-10"></div>
            <div class="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-dark-900 to-transparent z-10"></div>
            
            <div class="text-center mb-6">
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest"><i class="fas fa-money-bill-transfer text-emerald-500"></i> Recent Withdrawals</h3>
            </div>

            <?php if (empty($proofs)): ?>
                <div class="text-center text-gray-500 py-4 font-medium">
                    <i class="fas fa-clock text-xl mb-2 opacity-50 block"></i>
                    Waiting for the first withdrawal!
                </div>
            <?php else: ?>
                <div class="ticker-container flex whitespace-nowrap overflow-hidden">
                    <div class="animate-marquee flex gap-4 min-w-max">
                        <?php 
                        $displayProofs = array_merge($proofs, $proofs);
                        foreach ($displayProofs as $p): 
                            $name = strlen($p['username']) > 3 ? substr($p['username'], 0, 1) . '***' : 'User';
                            $initial = strtoupper(substr($name, 0, 1));
                            $amt = number_format($p['amount'], 4);
                        ?>
                        <div class="glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 border border-white/5">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold shadow-inner">
                                <?= $initial; ?>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-white"><?= htmlspecialchars($name); ?></div>
                                <div class="text-xs font-bold text-emerald-400">+<?= $amt; ?> <span class="text-gray-500 font-medium"><?= htmlspecialchars($currency); ?></span></div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>
        </section>

        <section id="how" class="max-w-6xl mx-auto px-6 py-24">
            <div class="text-center mb-16">
                <div class="text-brand-primary font-bold text-sm uppercase tracking-widest mb-2">Process</div>
                <h2 class="text-3xl md:text-5xl font-extrabold text-white mb-4">Three steps to crypto</h2>
                <p class="text-gray-400 max-w-xl mx-auto">No investment. No complexity. Just tasks and payouts.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="glass-panel p-8 rounded-3xl hover:bg-white/[0.03] transition-colors border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><i class="fas fa-robot text-8xl text-brand-primary"></i></div>
                    <div class="text-brand-primary font-bold text-sm mb-4 relative z-10">01</div>
                    <div class="w-14 h-14 bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center text-2xl mb-6 relative z-10"><i class="fas fa-bolt"></i></div>
                    <h3 class="text-xl font-bold text-white mb-3 relative z-10">Open the Mini App</h3>
                    <p class="text-gray-400 text-sm leading-relaxed relative z-10">Launch <?= htmlspecialchars($site_name); ?> directly inside Telegram — no separate app or browser needed.</p>
                </div>
                
                <div class="glass-panel p-8 rounded-3xl hover:bg-white/[0.03] transition-colors border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><i class="fas fa-bullseye text-8xl text-brand-accent"></i></div>
                    <div class="text-brand-accent font-bold text-sm mb-4 relative z-10">02</div>
                    <div class="w-14 h-14 bg-brand-accent/20 text-brand-accent rounded-2xl flex items-center justify-center text-2xl mb-6 relative z-10"><i class="fas fa-crosshairs"></i></div>
                    <h3 class="text-xl font-bold text-white mb-3 relative z-10">Complete Tasks</h3>
                    <p class="text-gray-400 text-sm leading-relaxed relative z-10">Watch PTC ads. Each ad earns you Coins instantly.</p>
                </div>

                <div class="glass-panel p-8 rounded-3xl hover:bg-white/[0.03] transition-colors border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><i class="fas fa-wallet text-8xl text-emerald-500"></i></div>
                    <div class="text-emerald-500 font-bold text-sm mb-4 relative z-10">03</div>
                    <div class="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mb-6 relative z-10"><i class="fas fa-money-bill-wave"></i></div>
                    <h3 class="text-xl font-bold text-white mb-3 relative z-10">Withdraw to FaucetPay</h3>
                    <p class="text-gray-400 text-sm leading-relaxed relative z-10">Hit the minimum threshold and withdraw in your preferred crypto. Processed fast, every time.</p>
                </div>
            </div>
        </section>
        
        <section class="max-w-6xl mx-auto px-6 py-12">
            <div class="glass-panel p-10 md:p-14 rounded-[2.5rem] border border-brand-primary/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10 group">
                <div class="absolute inset-0 bg-gradient-to-br from-brand-primary/20 via-transparent to-brand-accent/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div class="relative z-10 flex-1 text-center md:text-left">
                    <div class="inline-block px-4 py-1.5 rounded-full bg-brand-primary/20 text-brand-primary font-bold text-xs uppercase tracking-widest mb-6">
                        <i class="fas fa-user-friends mr-1"></i> Referral Program
                    </div>
                    <h2 class="text-3xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">Earn while others earn</h2>
                    <p class="text-gray-300 text-lg leading-relaxed max-w-xl mx-auto md:mx-0 mb-8">
                        Share your unique referral link. Every time someone you referred earns, you pocket <strong class="text-white bg-brand-primary/20 px-2 py-0.5 rounded"><?= $commission_rate; ?>% commission</strong> — automatically, with no cap.
                    </p>
                    <a href="<?= $tg_link; ?>" target="_blank" class="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-brand-primary/30 transform hover:-translate-y-1">
                        <i class="fas fa-link"></i> Get My Referral Link
                    </a>
                </div>
                
                <div class="relative z-10 hidden md:flex items-center justify-center">
                    <div class="w-48 h-48 rounded-full border-8 border-brand-primary/20 flex flex-col items-center justify-center bg-dark-900/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
                        <div class="absolute inset-0 bg-brand-primary/10 animate-pulse"></div>
                        <span class="text-5xl font-black text-white relative z-10">+<?= $commission_rate; ?>%</span>
                        <span class="text-sm font-bold text-brand-primary uppercase tracking-widest mt-2 relative z-10">Commission</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="max-w-4xl mx-auto px-6 py-20 mb-12 text-center">
            <h2 class="text-3xl md:text-5xl font-extrabold text-white mb-6">Ready to start <span class="text-brand-primary">earning?</span></h2>
            <p class="text-gray-400 text-lg mb-10">Join <?= number_format($totalUsers); ?>+ users already making crypto on Telegram.</p>
            <a href="<?= $tg_link; ?>" target="_blank" class="inline-flex items-center gap-3 px-8 py-4 bg-white text-dark-900 hover:bg-gray-100 rounded-2xl font-extrabold text-lg transition-all shadow-xl shadow-white/10 transform hover:scale-105">
                <i class="fab fa-telegram text-blue-500 text-2xl"></i> Open <?= htmlspecialchars($site_name); ?> on Telegram
            </a>
        </section>
    </main>

    <footer class="border-t border-white/5 py-8 text-center text-gray-500 text-sm glass-panel relative z-10">
        <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="flex gap-6 justify-center md:justify-start">
                <a href="/" class="hover:text-white transition-colors">Home</a>
                <a href="<?= $tg_link; ?>" target="_blank" class="hover:text-white transition-colors">Telegram</a>
                <a href="https://faucetpay.io/?r=11951" target="_blank" rel="noopener" class="hover:text-white transition-colors">FaucetPay</a>
            </div>
            <div>&copy; <?= date('Y'); ?> <?= htmlspecialchars($site_name); ?>. No investment needed. Earn free crypto.</div>
        </div>
    </footer>
    <?php echo getSetting('custom_footer_code'); ?>
</body>
</html>