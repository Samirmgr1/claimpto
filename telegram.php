<?php
session_start();
require_once 'core/db.php';
$_SESSION['is_telegram'] = true;
$is_logged_in = isset($_SESSION['user_id']);
$user = null;

if ($is_logged_in) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        session_destroy();
        header("Location: telegram.php");
        exit;
    }
}

$botUsername = getSetting('telegram_bot_username') ?: 'YourBot';
$botLink = "https://t.me/" . $botUsername;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?php echo htmlspecialchars(getSetting('site_name')); ?> - Mini App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#060913', 800: '#0F1320', 700: '#1A1F30' },
                        brand: { primary: '#8B5CF6', accent: '#22D3EE', glow: '#A78BFA' },
                        tg: {
                            bg: 'var(--tg-theme-bg-color, #ffffff)',
                            text: 'var(--tg-theme-text-color, #222222)',
                            hint: 'var(--tg-theme-hint-color, #999999)',
                            link: 'var(--tg-theme-link-color, #2481cc)',
                            button: 'var(--tg-theme-button-color, #6366f1)',
                            button_text: 'var(--tg-theme-button-text-color, #ffffff)',
                            secondary_bg: 'var(--tg-theme-secondary-bg-color, #f4f4f5)',
                        }
                    },
                    animation: {
                        'float': 'float 3s ease-in-out infinite',
                        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    },
                    keyframes: {
                        float: {
                            '0%, 100%': { transform: 'translateY(0)' },
                            '50%': { transform: 'translateY(-10px)' },
                        },
                        fadeInUp: {
                            '0%': { opacity: '0', transform: 'translateY(20px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' },
                        }
                    }
                }
            }
        }
    </script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            -webkit-tap-highlight-color: transparent;
            scrollbar-width: none; 
        }
        body::-webkit-scrollbar { display: none; }
        
        /* Website Theme Matching Classes */
        .bg-grid {
            background-size: 40px 40px; position: fixed; inset: 0; z-index: -2; pointer-events: none;
            background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
            mask-image: radial-gradient(circle at center, black 60%, transparent 100%);
        }
        .dark .bg-grid {
            background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
        }
        .glow-primary {
            position: fixed; top: 0; left: 10%; width: 320px; height: 320px; background: rgba(139, 92, 246, 0.15); border-radius: 50%; filter: blur(100px); pointer-events: none; transform: translateY(-50%); z-index: -1;
        }
        .glow-accent {
            position: fixed; bottom: 0; right: 10%; width: 280px; height: 280px; background: rgba(34, 211, 238, 0.15); border-radius: 50%; filter: blur(100px); pointer-events: none; transform: translateY(50%); z-index: -1;
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.65);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .dark .glass-panel {
            background: rgba(15, 19, 32, 0.7);
            border: 1px solid rgba(139, 92, 246, 0.08);
        }
        
        /* Inputs & Buttons */
        .tg-input {
            background-color: var(--tg-theme-secondary-bg-color, #f4f4f5);
            color: var(--tg-theme-text-color, #222222);
            border: 1px solid transparent;
            transition: all 0.3s ease;
        }
        .dark .tg-input {
            background-color: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.05);
        }
        .tg-input:focus {
            border-color: #6366f1;
            background-color: transparent;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        .tg-input::placeholder { color: var(--tg-theme-hint-color, #999999); }
        
        .tg-button {
            background: linear-gradient(135deg, #6366f1, #06b6d4);
            color: #ffffff;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .tg-button:active { transform: scale(0.96); }

        /* Navigation Bottom */
        .nav-item i { color: var(--tg-theme-hint-color, #999999); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .nav-item span { color: var(--tg-theme-hint-color, #999999); transition: all 0.3s; }
        .nav-dot {
            opacity: 0; transform: scale(0) translateY(5px);
            background-color: #6366f1; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item.active i { color: #6366f1; transform: translateY(-2px) scale(1.1); }
        .nav-item.active span { color: var(--tg-theme-text-color, #222222); font-weight: 800; }
        .dark .nav-item.active span { color: #ffffff; }
        .nav-item.active .nav-dot { opacity: 1; transform: scale(1) translateY(0); }
    </style>
</head>
<body class="bg-gray-50 dark:bg-dark-900 text-gray-800 dark:text-gray-200 pb-24 transition-colors duration-300 min-h-screen relative">
    
    <div class="bg-grid"></div>
    <div class="glow-primary"></div>
    <div class="glow-accent"></div>

    <div id="desktop-restriction" class="hidden fixed inset-0 z-[9999] bg-gray-50 dark:bg-dark-900 flex-col items-center justify-center p-6 text-center overflow-hidden">
        <div class="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10">
            <div class="absolute -top-32 -right-32 w-96 h-96 bg-brand-primary rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div class="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-accent rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>
        <div class="relative z-10 animate-fade-in-up flex flex-col items-center">
            <h2 class="text-3xl font-extrabold mb-3 text-gray-900 dark:text-white tracking-tight">Mobile Only</h2>
            <p class="text-gray-500 dark:text-gray-400 text-lg mb-10 font-medium">Open on Telegram<br>iOS or Android</p>
            <div class="bg-white p-4 rounded-[2rem] shadow-2xl border border-gray-100 mb-10 inline-block animate-float">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=<?php echo urlencode($botLink); ?>&margin=10" alt="QR Code" class="w-52 h-52 rounded-2xl">
            </div>
            <p class="font-extrabold text-sm tracking-[0.2em] text-gray-400 mb-8 uppercase"><i class="fas fa-expand mr-2"></i>Scan to Open</p>
            <a href="<?php echo htmlspecialchars($botLink); ?>" target="_blank" class="tg-button w-full max-w-xs py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/30">
                <i class="fab fa-telegram text-2xl"></i> Open in Telegram
            </a>
        </div>
    </div>

    <?php if (!$is_logged_in): ?>
    <div id="tg-auth-container" class="min-h-screen flex flex-col items-center justify-center p-6 transition-opacity duration-500 relative overflow-hidden z-10">
        
        <div id="loading-auth" class="flex flex-col items-center justify-center relative z-10">
            <?php $siteLogo = getSetting('site_logo'); if(!empty($siteLogo) && file_exists($siteLogo)): ?>
                <div class="relative w-28 h-28 mb-8">
                    <div class="absolute inset-0 bg-brand-primary opacity-20 rounded-full animate-ping"></div>
                    <img src="<?php echo htmlspecialchars($siteLogo); ?>" class="relative z-10 w-full h-full object-contain drop-shadow-xl" alt="Logo">
                </div>
            <?php else: ?>
                <div class="relative w-20 h-20 mb-8 flex justify-center items-center">
                    <div class="absolute inset-0 border-4 border-gray-200 dark:border-white/10 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
                    <i class="fas fa-wallet text-2xl text-brand-primary"></i>
                </div>
            <?php endif; ?>
            <p class="font-bold text-gray-500 dark:text-gray-400 animate-pulse tracking-wide">Syncing account...</p>
        </div>

        <div id="login-form-wrapper" class="hidden w-full max-w-[340px] flex-col items-center z-10 animate-fade-in-up">
            <div class="glass-panel p-8 rounded-[2.5rem] shadow-2xl w-full flex flex-col items-center relative overflow-hidden group">
                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-primary to-brand-accent"></div>
                
                <div class="w-20 h-20 bg-gradient-to-tr from-brand-primary to-brand-accent rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-brand-primary/30 text-white transform group-hover:rotate-6 transition-transform">
                    <i class="fas fa-rotate text-3xl"></i>
                </div>
                <h1 class="text-2xl font-extrabold mb-2 text-center text-gray-900 dark:text-white tracking-tight">Connection Issue</h1>
                <div id="login-error" class="mt-2 mb-5 p-4 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold w-full text-center border border-rose-500/20"></div>
                <button type="button" id="btn-retry" onclick="autoLoginAttempts=0;document.getElementById('login-form-wrapper').classList.add('hidden');document.getElementById('login-form-wrapper').classList.remove('flex');document.getElementById('loading-auth').classList.remove('hidden');attemptAutoLogin();" class="tg-button w-full py-4 rounded-2xl font-bold text-base flex justify-center items-center gap-2 shadow-lg shadow-brand-primary/20 mb-3">
                    <i class="fas fa-rotate text-sm"></i>
                    <span>Retry</span>
                </button>
                <p class="text-center text-gray-500 dark:text-gray-400 text-[10px] leading-relaxed">
                    Please reopen the app from Telegram. If the issue persists, try restarting the bot.
                </p>
                <form id="tg-login-form" class="hidden w-full">
                    <input type="email" id="email" value="" class="hidden">
                </form>
            </div>
        </div>
    </div>
    <?php else: ?>
    
    <div class="p-4 md:p-6 relative z-10" id="app-content">
        <div class="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
            <div class="relative w-16 h-16 flex justify-center items-center">
                <div class="absolute inset-0 border-4 border-gray-200 dark:border-white/10 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
                <i class="fas fa-bolt text-brand-primary"></i>
            </div>
            <span class="mt-4 text-sm font-bold text-gray-500 dark:text-gray-400">Loading Hub...</span>
        </div>
    </div>

    <div class="fixed bottom-0 left-0 w-full z-50 glass-panel rounded-t-[2rem] pb-safe border-t border-gray-200 dark:border-white/10">
        <div class="flex justify-between items-end px-2 py-2 mb-1">
            <button onclick="tgLoadContent('pages/load_dashboard.php', this)" class="nav-item active relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-house text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Home</span>
            </button>
            <button onclick="tgLoadContent('pages/load_ptc.php', this)" class="nav-item relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-bullseye text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Earn</span>
            </button>
            <button onclick="tgLoadContent('pages/load_lottery.php', this)" class="nav-item relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-ticket text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Lottery</span>
            </button>
            <button onclick="tgLoadContent('pages/load_tg_ads.php', this)" class="nav-item relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-circle-play text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Watch</span>
            </button>
            <button onclick="tgLoadContent('pages/load_referrals.php', this)" class="nav-item relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-user-group text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Friends</span>
            </button>
            <button onclick="tgLoadContent('pages/load_withdraw.php', this)" class="nav-item relative flex flex-col items-center justify-center w-[16.66%] pt-2 pb-1 group">
                <div class="absolute top-0 w-1.5 h-1.5 rounded-full nav-dot"></div>
                <div class="p-1.5 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-white/5 transition-colors mb-0.5">
                    <i class="fas fa-wallet text-lg"></i>
                </div>
                <span class="text-[9px] font-semibold">Wallet</span>
            </button>
        </div>
    </div>
    <?php endif; ?>

    <script>
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        const tgPlatform = window.Telegram.WebApp.platform;
        if (tgPlatform !== 'android' && tgPlatform !== 'ios') {
            document.body.style.overflow = 'hidden';
            const restrictionScreen = document.getElementById('desktop-restriction');
            restrictionScreen.classList.remove('hidden');
            restrictionScreen.classList.add('flex');
            throw new Error("App restricted to mobile devices only."); 
        }

        function updateTelegramTheme() {
            if (window.Telegram.WebApp.colorScheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        
        setTimeout(updateTelegramTheme, 100);
        window.Telegram.WebApp.onEvent('themeChanged', updateTelegramTheme);

        let tgUserData = window.Telegram.WebApp.initDataUnsafe?.user;
        let persistentTgId = tgUserData?.id || localStorage.getItem('persistent_tg_id');
        let persistentTgUsername = tgUserData?.username || tgUserData?.first_name || localStorage.getItem('persistent_tg_username');
        if (tgUserData?.id) {
            localStorage.setItem('persistent_tg_id', tgUserData.id);
            localStorage.setItem('persistent_tg_username', persistentTgUsername || 'Member');
        } else if (!persistentTgId) {
            persistentTgId = 'TEST_ID_' + Math.floor(Math.random() * 1000000);
            persistentTgUsername = 'Member' + Math.floor(Math.random() * 1000);
            localStorage.setItem('persistent_tg_id', persistentTgId);
            localStorage.setItem('persistent_tg_username', persistentTgUsername);
        }

        <?php if (!$is_logged_in): ?>
        let autoLoginAttempts = 0;
        const maxRetries = 3;

        function attemptAutoLogin() {
            autoLoginAttempts++;
            const formData = new FormData();
            formData.append('telegram_id', persistentTgId);
            formData.append('telegram_username', persistentTgUsername);
            formData.append('auto_login', '1');
            const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param || '';
            if (startParam) formData.append('referred_by', startParam);
            fetch('actions/tg_auth.php', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                } else if (autoLoginAttempts < maxRetries) {
                    setTimeout(attemptAutoLogin, 1000);
                } else {
                    document.getElementById('loading-auth').classList.add('hidden');
                    document.getElementById('login-form-wrapper').classList.remove('hidden');
                    document.getElementById('login-form-wrapper').classList.add('flex');
                    const err = document.getElementById('login-error');
                    if (err) {
                        err.textContent = data.message || 'Could not open automatically. Please try again.';
                        err.classList.remove('hidden');
                    }
                }
            })
            .catch(err => {
                if (autoLoginAttempts < maxRetries) {
                    setTimeout(attemptAutoLogin, 1000);
                } else {
                    document.getElementById('loading-auth').classList.add('hidden');
                    document.getElementById('login-form-wrapper').classList.remove('hidden');
                    document.getElementById('login-form-wrapper').classList.add('flex');
                    const errBox = document.getElementById('login-error');
                    if (errBox) {
                        errBox.textContent = 'Connection failed. Please reopen the mini app.';
                        errBox.classList.remove('hidden');
                    }
                }
            });
        }
        attemptAutoLogin();

        // Email form removed - wallet linking is in Wallet section only
        document.getElementById('tg-login-form').addEventListener('submit', function(e) {
            e.preventDefault();
        });
        <?php else: ?>
        function tgLoadContent(url, btnElement) {
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active');
            });
            if(btnElement) {
                btnElement.classList.add('active');
                window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
            
            const contentDiv = document.getElementById('app-content');
            contentDiv.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[60vh]">
                    <div class="relative w-14 h-14 flex justify-center items-center">
                        <div class="absolute inset-0 border-4 border-gray-200 dark:border-white/10 rounded-full"></div>
                        <div class="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
                    </div>
                </div>
            `;
            
            fetch(url)
                .then(r => r.text())
                .then(html => {
                    let headerHtml = `
                    <div class="glass-panel p-5 rounded-[1.5rem] shadow-sm mb-6 flex items-center justify-between animate-fade-in-up">
                        <div class="flex items-center gap-4">
                            <div class="relative w-12 h-12 group">
                                <div class="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-accent rounded-[1rem] shadow-md transform rotate-3 opacity-70 group-hover:rotate-6 transition-transform"></div>
                                <div class="absolute inset-0 bg-brand-primary rounded-[1rem] flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                                    <?php echo strtoupper(substr(htmlspecialchars($user['username'] ?? $user['wallet']), 0, 1) ?: 'U'); ?>
                                </div>
                            </div>
                            <div class="flex flex-col justify-center">
                                <div class="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-0.5">Total Balance</div>
                                <div class="font-extrabold text-xl flex items-baseline gap-1.5 text-gray-900 dark:text-white">
                                    <span id="tg-balance" class="tracking-tight"><?php echo number_format($user['balance'], 8); ?></span>
                                    <span class="text-brand-accent text-xs uppercase"><?php echo getSetting('currency_name'); ?></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                    contentDiv.innerHTML = headerHtml + html;
                    
                    const scripts = contentDiv.getElementsByTagName('script');
                    for (let i = 0; i < scripts.length; i++) {
                        eval(scripts[i].innerText);
                    }
                })
                .catch(e => {
                    contentDiv.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-8 bg-rose-500/10 rounded-3xl mt-10 border border-rose-500/20">
                        <i class="fas fa-triangle-exclamation text-4xl text-rose-500 mb-4"></i>
                        <p class="text-rose-600 dark:text-rose-400 font-bold text-center">Connection Error</p>
                        <p class="text-rose-500/80 text-xs text-center mt-2">Failed to load content. Please try again.</p>
                        <button onclick="tgLoadContent('${url}', document.querySelector('.nav-item.active'))" class="mt-4 px-6 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-500/20 active:scale-95 transition-transform">Retry</button>
                    </div>`;
                });
        }
        
        window.addEventListener('DOMContentLoaded', () => {
            tgLoadContent('pages/load_dashboard.php', document.querySelector('.nav-item.active'));
        });
        
        function copyRefLink() {
            var input = document.getElementById('refLinkInput');
            var btn = document.getElementById('copyBtn');
            var icon = document.getElementById('copyIcon');
            var text = document.getElementById('copyText');
            var linkValue = input.value;
            var copied = false;
            try {
                var ta = document.createElement('textarea');
                ta.value = linkValue;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '-9999px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                copied = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch(e) { copied = false; }
            if (!copied && navigator.clipboard) {
                navigator.clipboard.writeText(linkValue).catch(e=>{});
                copied = true;
            }
            if (copied) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                icon.className = 'fas fa-check';
                text.textContent = 'Copied!';
                btn.classList.add('bg-emerald-500', 'text-white', 'border-transparent');
                setTimeout(function() {
                    icon.className = 'fas fa-copy';
                    text.textContent = 'Copy Link';
                    btn.classList.remove('bg-emerald-500', 'text-white', 'border-transparent');
                }, 2000);
            } else {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
        }
        <?php endif; ?>
    </script>


</body>
</html>