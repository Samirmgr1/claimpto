<?php
session_start();
require_once '../core/db.php';
require_once '../core/functions.php';

if (!isset($_SESSION['admin_logged_in']) || !$_SESSION['admin_logged_in']) {
    header("Location: ../admin.php");
    exit();
}

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_ad_settings'])) {
    foreach ($_POST['settings'] as $key => $value) {
        updateSetting($key, $value);
    }
    $success = "Ad settings saved successfully!";
}

$site_logo = getSetting('site_logo') ?: '';
$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ad Setup - Admin Panel</title>
    <?php if (!empty($site_logo) && file_exists('../' . $site_logo)): ?>
    <link rel="icon" type="image/png" href="../<?php echo htmlspecialchars($site_logo); ?>" />
    <?php else: ?>
    <link rel="icon" type="image/png" href="data:," />
    <?php endif; ?>
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
                        brand: { primary: '#8B5CF6', accent: '#22D3EE' }
                    }
                }
            }
        }
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    </script>
    <style>
        .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 211, 238, 0.08)); color: #A78BFA; font-weight: 700; border-right: 3px solid #8B5CF6; }
        .dark .admin-nav.active { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(34, 211, 238, 0.1)); }
        .bg-grid {
            background-size: 50px 50px;
            position: fixed; inset: 0; z-index: -2; pointer-events: none;
            background-image: linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
            mask-image: radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%);
        }
        .dark .bg-grid {
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        }
        html { scroll-behavior: smooth; }
        input, select, textarea { transition: all 0.3s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body class="bg-gray-50 dark:bg-dark-900 text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-300 font-sans flex overflow-x-hidden">
    <div class="bg-grid"></div>
    
    <div id="sidebar-overlay" class="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-300 md:hidden"></div>
    <aside id="sidebar" class="w-64 bg-white/95 dark:bg-dark-800/95 backdrop-blur-md border-r border-gray-200 dark:border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl md:shadow-lg transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
        <div class="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5">
            <div class="flex items-center gap-3">
                <i class="fas fa-shield-halved text-2xl text-brand-primary"></i>
                <div>
                    <span class="font-extrabold text-lg tracking-tight text-gray-900 dark:text-white block leading-tight">Weadev</span>
                    <span class="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">v1.7 Admin</span>
                </div>
            </div>
            <button id="close-sidebar-btn" class="md:hidden text-gray-400 hover:text-red-500 transition-colors">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <nav class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Overview</p>
            <a href="../admin.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-chart-line w-5 text-center"></i> Dashboard
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Management</p>
            <a href="users.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-users-gear w-5 text-center"></i> User Management
            </a>
            <a href="offers.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-clipboard-check w-5 text-center"></i> Offer Approval
            </a>
            <a href="withdrawals.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-money-bill-transfer w-5 text-center"></i> Withdrawals
            </a>
            <a href="lottery.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket w-5 text-center"></i> Lottery
            </a>
            <a href="admin_coupon.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-ticket-simple w-5 text-center"></i> Coupon Codes
            </a>
            <a href="broadcast.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-bullhorn w-5 text-center"></i> Broadcast
            </a>
            
            <p class="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-6 mb-2">Configuration</p>
            <a href="settings.php" class="admin-nav w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-gear w-5 text-center"></i> Settings
            </a>
            <a href="ad_setup.php" class="admin-nav active w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <i class="fas fa-rectangle-ad w-5 text-center"></i> Ad Setup
            </a>
        </nav>
        <div class="p-4 border-t border-gray-100 dark:border-white/5 space-y-2">
            <a href="../index.php" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary dark:hover:bg-brand-primary/20 dark:hover:text-brand-primary rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400">
                <i class="fas fa-eye"></i> View Site
            </a>
            <a href="../admin.php?logout=1" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded-xl transition-all font-bold text-sm text-gray-600 dark:text-gray-400">
                <i class="fas fa-right-from-bracket"></i> Logout
            </a>
        </div>
    </aside>
    <div class="flex-1 md:ml-64 flex flex-col min-h-screen relative z-10 w-full animate-[fadeInUp_0.4s_ease-out]">
        <header class="h-20 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
            <div class="md:hidden flex items-center gap-3">
                <button id="mobile-menu-btn" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors">
                    <i class="fas fa-bars text-lg"></i>
                </button>
                <div class="font-extrabold text-xl text-brand-primary flex items-center gap-2">
                    <i class="fas fa-shield-halved"></i> <span class="truncate max-w-[120px]">Weadev</span>
                </div>
            </div>
            <div class="hidden md:flex items-center gap-3">
                <h1 class="text-xl font-extrabold text-gray-900 dark:text-white">Ad Setup & Faucet</h1>
                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-900 px-2.5 py-1 rounded-lg">v1.7</span>
            </div>
            <div class="flex items-center gap-3 md:gap-4 ml-auto">
                <div class="hidden sm:flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <i class="fas fa-users"></i> <?php echo number_format($totalUsers); ?> Users
                </div>
                <button id="theme-toggle" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-900 text-gray-600 dark:text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-700 transition-all">
                    <i id="theme-toggle-dark-icon" class="fa-solid fa-moon hidden"></i>
                    <i id="theme-toggle-light-icon" class="fa-solid fa-sun hidden"></i>
                </button>
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-dark-800">
                    <i class="fas fa-crown text-sm"></i>
                </div>
            </div>
        </header>
        <main class="flex-1 p-4 sm:p-6 md:p-8">
            <div class="w-full max-w-6xl mx-auto space-y-8">

                <?php if ($success): ?>
                <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 shadow-sm">
                    <i class="fas fa-check-circle text-lg"></i> <?php echo htmlspecialchars($success); ?>
                </div>
                <?php endif; ?>
                <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 shadow-sm">
                    <i class="fas fa-circle-exclamation text-lg"></i> <?php echo htmlspecialchars($error); ?>
                </div>
                <?php endif; ?>

                <form method="POST" action="">
                    <input type="hidden" name="save_ad_settings" value="1">

                    <!-- Hourly Faucet Settings (TOP) -->
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden mb-8">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-500"></div>
                        <h3 class="text-lg font-extrabold text-indigo-500 flex items-center gap-2 mb-2"><i class="fas fa-droplet"></i> Hourly Faucet</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-6"><i class="fas fa-info-circle text-indigo-500 mr-1"></i> Users watch up to 3 ads then claim a bonus. Set "Show in Faucet" below on each ad network.</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET STATUS</label>
                                <select name="settings[faucet_status]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    <option value="1" <?php echo getSetting("faucet_status") !== '0' ? 'selected' : ''; ?>>Enabled</option>
                                    <option value="0" <?php echo getSetting("faucet_status") === '0' ? 'selected' : ''; ?>>Disabled</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">COOLDOWN (MINUTES)</label>
                                <input type="number" name="settings[faucet_cooldown]" value="<?php echo htmlspecialchars(getSetting('faucet_cooldown') ?: '60'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                <p class="text-[10px] text-gray-500 mt-1">60 = 1 hour between claims.</p>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET MIN REWARD</label>
                                <input type="number" name="settings[faucet_reward_min]" value="<?php echo htmlspecialchars(getSetting('faucet_reward_min') ?: '1'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium" min="0">
                                <p class="text-[10px] text-gray-500 mt-1">Minimum random reward per hourly faucet claim. Default 1.</p>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET MAX REWARD</label>
                                <input type="number" name="settings[faucet_reward_max]" value="<?php echo htmlspecialchars(getSetting('faucet_reward_max') ?: '50'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium" min="0">
                                <p class="text-[10px] text-gray-500 mt-1">Maximum random reward per hourly faucet claim.</p>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">ADS TO WATCH</label>
                                <input type="number" name="settings[faucet_required_ads]" value="<?php echo htmlspecialchars(getSetting('faucet_required_ads') ?: '2'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium" min="1" max="10">
                                <p class="text-[10px] text-gray-500 mt-1">Number of ads user must watch before claiming faucet. Default 2.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Ad Networks -->
                    <div class="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden mb-8">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                        <h3 class="text-lg font-extrabold text-blue-500 flex items-center gap-2 mb-2"><i class="fas fa-rectangle-ad"></i> Ad Networks</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-6"><i class="fas fa-info-circle text-blue-500 mr-1"></i> Configure each network. Set reward, daily limit, and toggle faucet visibility.</p>

                        <div class="space-y-6">
                            <!-- Monetag -->
                            <div class="border border-blue-200 dark:border-blue-500/20 rounded-xl p-5 bg-blue-50/30 dark:bg-blue-900/10">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2"><i class="fas fa-video text-blue-500"></i> Monetag</h4>
                                    <a href="https://monetag.com/" target="_blank" class="text-[10px] text-blue-500 hover:underline font-bold"><i class="fas fa-external-link-alt"></i> Dashboard</a>
                                </div>
                                <div class="md:col-span-2 bg-white dark:bg-dark-800 p-4 border border-blue-200 dark:border-blue-500/30 rounded-xl mb-4">
                                    <label class="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide"><i class="fas fa-magic"></i> Paste Monetag Script Tag (Auto Extract)</label>
                                    <input type="text" id="monetag_auto_extract" placeholder="<script src='//libtl.com/sdk.js' data-zone='10694673' data-sdk='show_10694673'></script>" class="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm focus:ring-2 focus:ring-blue-500/50 transition-all">
                                    <p class="text-[10px] text-gray-500 mt-2">Paste the full script tag &mdash; Zone ID and Script URL auto-fill below.</p>
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">STATUS</label>
                                        <select name="settings[ad_monetag_status]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_monetag_status") == '1' ? 'selected' : ''; ?>>Enabled</option>
                                            <option value="0" <?php echo getSetting("ad_monetag_status") != '1' ? 'selected' : ''; ?>>Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">ZONE ID</label>
                                        <input type="text" id="monetag_zone_id" name="settings[ad_monetag_zone_id]" value="<?php echo htmlspecialchars(getSetting('ad_monetag_zone_id')); ?>" placeholder="e.g. 10694673" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">REWARD</label>
                                        <input type="number" name="settings[ad_monetag_reward]" value="<?php echo htmlspecialchars(getSetting('ad_monetag_reward') ?: '20'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">DAILY LIMIT</label>
                                        <input type="number" name="settings[ad_monetag_daily_limit]" value="<?php echo htmlspecialchars(getSetting('ad_monetag_daily_limit') ?: '10'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div class="col-span-2 md:col-span-3">
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">SDK SCRIPT URL</label>
                                        <input type="text" id="monetag_script_url" name="settings[ad_monetag_script_url]" value="<?php echo htmlspecialchars(getSetting('ad_monetag_script_url')); ?>" placeholder="e.g. https://libtl.com/sdk.js" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET</label>
                                        <select name="settings[ad_monetag_faucet]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_monetag_faucet") == '1' ? 'selected' : ''; ?>>Yes</option>
                                            <option value="0" <?php echo getSetting("ad_monetag_faucet") != '1' ? 'selected' : ''; ?>>No</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Adsgram -->
                            <div class="border border-purple-200 dark:border-purple-500/20 rounded-xl p-5 bg-purple-50/30 dark:bg-purple-900/10">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2"><i class="fas fa-ad text-purple-500"></i> Adsgram</h4>
                                    <a href="https://partner.adsgram.ai/" target="_blank" class="text-[10px] text-purple-500 hover:underline font-bold"><i class="fas fa-external-link-alt"></i> Dashboard</a>
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">STATUS</label>
                                        <select name="settings[ad_adsgram_status]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_adsgram_status") == '1' ? 'selected' : ''; ?>>Enabled</option>
                                            <option value="0" <?php echo getSetting("ad_adsgram_status") != '1' ? 'selected' : ''; ?>>Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">BLOCK ID</label>
                                        <input type="text" name="settings[ad_adsgram_block_id]" value="<?php echo htmlspecialchars(getSetting('ad_adsgram_block_id')); ?>" placeholder="e.g. 1234" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">REWARD</label>
                                        <input type="number" name="settings[ad_adsgram_reward]" value="<?php echo htmlspecialchars(getSetting('ad_adsgram_reward') ?: '15'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">DAILY LIMIT</label>
                                        <input type="number" name="settings[ad_adsgram_daily_limit]" value="<?php echo htmlspecialchars(getSetting('ad_adsgram_daily_limit') ?: '10'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET</label>
                                        <select name="settings[ad_adsgram_faucet]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_adsgram_faucet") == '1' ? 'selected' : ''; ?>>Yes</option>
                                            <option value="0" <?php echo getSetting("ad_adsgram_faucet") != '1' ? 'selected' : ''; ?>>No</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Adexora -->
                            <div class="border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-5 bg-emerald-50/30 dark:bg-emerald-900/10">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><i class="fas fa-bullhorn text-emerald-500"></i> Adexora</h4>
                                    <a href="https://adexora.com/" target="_blank" class="text-[10px] text-emerald-500 hover:underline font-bold"><i class="fas fa-external-link-alt"></i> Dashboard</a>
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">STATUS</label>
                                        <select name="settings[ad_adexora_status]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_adexora_status") == '1' ? 'selected' : ''; ?>>Enabled</option>
                                            <option value="0" <?php echo getSetting("ad_adexora_status") != '1' ? 'selected' : ''; ?>>Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">APP ID</label>
                                        <input type="text" name="settings[ad_adexora_app_id]" value="<?php echo htmlspecialchars(getSetting('ad_adexora_app_id')); ?>" placeholder="e.g. abc123" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">REWARD</label>
                                        <input type="number" name="settings[ad_adexora_reward]" value="<?php echo htmlspecialchars(getSetting('ad_adexora_reward') ?: '15'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">DAILY LIMIT</label>
                                        <input type="number" name="settings[ad_adexora_daily_limit]" value="<?php echo htmlspecialchars(getSetting('ad_adexora_daily_limit') ?: '10'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET</label>
                                        <select name="settings[ad_adexora_faucet]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_adexora_faucet") == '1' ? 'selected' : ''; ?>>Yes</option>
                                            <option value="0" <?php echo getSetting("ad_adexora_faucet") != '1' ? 'selected' : ''; ?>>No</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- GigaPub -->
                            <div class="border border-amber-200 dark:border-amber-500/20 rounded-xl p-5 bg-amber-50/30 dark:bg-amber-900/10">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2"><i class="fas fa-bolt text-amber-500"></i> GigaPub</h4>
                                    <a href="https://giga.pub/" target="_blank" class="text-[10px] text-amber-500 hover:underline font-bold"><i class="fas fa-external-link-alt"></i> Dashboard</a>
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">STATUS</label>
                                        <select name="settings[ad_gigapub_status]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_gigapub_status") == '1' ? 'selected' : ''; ?>>Enabled</option>
                                            <option value="0" <?php echo getSetting("ad_gigapub_status") != '1' ? 'selected' : ''; ?>>Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">PROJECT ID</label>
                                        <input type="text" name="settings[ad_gigapub_project_id]" value="<?php echo htmlspecialchars(getSetting('ad_gigapub_project_id')); ?>" placeholder="e.g. your-project-id" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">REWARD</label>
                                        <input type="number" name="settings[ad_gigapub_reward]" value="<?php echo htmlspecialchars(getSetting('ad_gigapub_reward') ?: '20'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">DAILY LIMIT</label>
                                        <input type="number" name="settings[ad_gigapub_daily_limit]" value="<?php echo htmlspecialchars(getSetting('ad_gigapub_daily_limit') ?: '10'); ?>" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">FAUCET</label>
                                        <select name="settings[ad_gigapub_faucet]" class="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-medium">
                                            <option value="1" <?php echo getSetting("ad_gigapub_faucet") == '1' ? 'selected' : ''; ?>>Yes</option>
                                            <option value="0" <?php echo getSetting("ad_gigapub_faucet") != '1' ? 'selected' : ''; ?>>No</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end">
                        <button type="submit" class="px-8 py-4 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-brand-primary text-white rounded-2xl font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-brand-primary/30 active:scale-95 transition-all">
                            <i class="fas fa-save"></i> Save Ad Settings
                        </button>
                    </div>
                </form>

            </div>
        </main>
    </div>

    <script>
        const themeToggleBtn = document.getElementById('theme-toggle');
        const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
        if (document.documentElement.classList.contains('dark')) {
            themeToggleLightIcon && themeToggleLightIcon.classList.remove('hidden');
        } else {
            themeToggleDarkIcon && themeToggleDarkIcon.classList.remove('hidden');
        }
        function doToggleTheme() {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            if (themeToggleDarkIcon) { themeToggleDarkIcon.classList.toggle('hidden'); themeToggleLightIcon.classList.toggle('hidden'); }
        }
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', doToggleTheme);

        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        function toggleSidebar() {
            if (!sidebar) return;
            sidebar.classList.toggle('-translate-x-full');
            if (sidebar.classList.contains('-translate-x-full')) {
                overlay.classList.remove('opacity-100');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            } else {
                overlay.classList.remove('hidden');
                setTimeout(() => overlay.classList.add('opacity-100'), 10);
            }
        }
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);

        // Monetag auto-extract
        const extractInput = document.getElementById('monetag_auto_extract');
        const zoneInput = document.getElementById('monetag_zone_id');
        const scriptUrlInput = document.getElementById('monetag_script_url');
        if (extractInput) {
            extractInput.addEventListener('input', function(e) {
                const raw = e.target.value;
                const srcMatch = raw.match(/src=['"]([^'"]+)['"]/i);
                const zoneMatch = raw.match(/data-zone=['"](\d+)['"]/i);
                if (srcMatch && srcMatch[1]) {
                    let url = srcMatch[1];
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (scriptUrlInput) {
                        scriptUrlInput.value = url;
                        scriptUrlInput.classList.add('ring-2', 'ring-emerald-500');
                        setTimeout(() => scriptUrlInput.classList.remove('ring-2', 'ring-emerald-500'), 1500);
                    }
                }
                if (zoneMatch && zoneMatch[1] && zoneInput) {
                    zoneInput.value = zoneMatch[1];
                    zoneInput.classList.add('ring-2', 'ring-emerald-500');
                    setTimeout(() => zoneInput.classList.remove('ring-2', 'ring-emerald-500'), 1500);
                }
            });
        }
    </script>
</body>
</html>
