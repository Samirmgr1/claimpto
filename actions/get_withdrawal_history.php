<?php
require_once '../core/db.php';
require_once '../core/functions.php';

// Get page number (default 1)
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$itemsPerPage = 10;
$offset = ($page - 1) * $itemsPerPage;

try {
    // Get total count of successful withdrawals
    $countStmt = $pdo->query("
        SELECT COUNT(*) as total FROM completed_offers 
        WHERE offer_type = 'withdrawal' AND status = 1
    ");
    $countResult = $countStmt->fetch();
    $totalWithdrawals = $countResult['total'] ?? 0;
    $totalPages = ceil($totalWithdrawals / $itemsPerPage);

    // Get withdrawals for current page
    $stmt = $pdo->prepare("
        SELECT 
            co.id,
            co.user_id,
            co.trans_id,
            co.offer_name,
            co.reward,
            co.payout,
            co.status,
            co.created_at,
            u.wallet,
            u.username
        FROM completed_offers co
        JOIN users u ON co.user_id = u.id
        WHERE co.offer_type = 'withdrawal' AND co.status = 1
        ORDER BY co.created_at DESC
        LIMIT " . (int)$itemsPerPage . " OFFSET " . (int)$offset . "
    ");
    $stmt->execute();
    $withdrawals = $stmt->fetchAll();

    if (empty($withdrawals)) {
        echo '<div class="text-center py-8"><p class="text-gray-500 dark:text-gray-400">No successful withdrawals yet.</p></div>';
        exit;
    }

    // Display withdrawals
    echo '<div class="space-y-3">';
    foreach ($withdrawals as $wd) {
        $coinAmount = abs((float)$wd['reward']);  // Negative value, so abs to get positive
        $cryptoAmount = (float)$wd['payout'];
        $createdDate = new DateTime($wd['created_at']);
        $dateFormatted = $createdDate->format('M d, Y');
        $timeFormatted = $createdDate->format('H:i');
        
        // Mask the username for privacy
        $username = htmlspecialchars($wd['username'] ?: 'User');
        // Always mask: show first 2 chars + ... + last 2 chars (even for short usernames)
        if (strlen($username) > 4) {
            $maskedUsername = substr($username, 0, 2) . str_repeat('*', max(1, strlen($username) - 4)) . substr($username, -2);
        } else {
            $maskedUsername = str_repeat('*', strlen($username));
        }
        
        // Mask the wallet address for privacy
        $wallet = htmlspecialchars($wd['wallet']);
        $maskedWallet = strlen($wallet) > 10 ? substr($wallet, 0, 4) . '...' . substr($wallet, -4) : $wallet;
        
        // Parse crypto from offer name (e.g., "Withdrawal to FaucetPay (USDT)" -> "USDT")
        $cryptoSymbol = 'CRYPTO';
        if (preg_match('/\((.*?)\)/', $wd['offer_name'], $matches)) {
            $cryptoSymbol = $matches[1];
        }
        
        echo '
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 hover:shadow-md transition-all group">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 text-lg">
                        <i class="fas fa-arrow-up"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="text-sm font-bold text-gray-900 dark:text-white truncate">
                                ' . $maskedUsername . '
                            </p>
                            <span class="text-[10px] bg-emerald-100 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-bold whitespace-nowrap">
                                ✓ Completed
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <i class="fas fa-wallet mr-1"></i> ' . $maskedWallet . ' • ' . $dateFormatted . ' ' . $timeFormatted . '
                        </p>
                    </div>
                </div>
                <div class="text-right flex-shrink-0 ml-2">
                    <p class="text-sm font-bold text-gray-900 dark:text-white">
                        ' . number_format($cryptoAmount, 8) . '
                    </p>
                    <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        ' . htmlspecialchars($cryptoSymbol) . '
                    </p>
                </div>
            </div>
        </div>
        ';
    }
    echo '</div>';

    // Pagination
    if ($totalPages > 1) {
        echo '<div class="flex items-center justify-center gap-2 mt-6 flex-wrap">';
        
        // Previous button
        if ($page > 1) {
            echo '<button onclick="loadWithdrawalHistory(' . ($page - 1) . ')" class="px-3 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-brand-primary hover:text-white text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold transition-colors"><i class="fas fa-chevron-left"></i></button>';
        }
        
        // Page numbers (show max 5 pages)
        $startPage = max(1, $page - 2);
        $endPage = min($totalPages, $page + 2);
        
        if ($startPage > 1) {
            echo '<button onclick="loadWithdrawalHistory(1)" class="px-3 py-2 bg-gray-100 dark:bg-dark-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors">1</button>';
            if ($startPage > 2) echo '<span class="text-gray-400">...</span>';
        }
        
        for ($i = $startPage; $i <= $endPage; $i++) {
            if ($i === $page) {
                echo '<button class="px-3 py-2 bg-gradient-to-r from-brand-primary to-indigo-600 text-white rounded-lg text-sm font-bold shadow-md">' . $i . '</button>';
            } else {
                echo '<button onclick="loadWithdrawalHistory(' . $i . ')" class="px-3 py-2 bg-gray-100 dark:bg-dark-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors">' . $i . '</button>';
            }
        }
        
        if ($endPage < $totalPages) {
            if ($endPage < $totalPages - 1) echo '<span class="text-gray-400">...</span>';
            echo '<button onclick="loadWithdrawalHistory(' . $totalPages . ')" class="px-3 py-2 bg-gray-100 dark:bg-dark-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors">' . $totalPages . '</button>';
        }
        
        // Next button
        if ($page < $totalPages) {
            echo '<button onclick="loadWithdrawalHistory(' . ($page + 1) . ')" class="px-3 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-brand-primary hover:text-white text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold transition-colors"><i class="fas fa-chevron-right"></i></button>';
        }
        
        echo '</div>';
    }

} catch (Exception $e) {
    error_log("Withdrawal History Error: " . $e->getMessage());
    echo '<div class="text-center text-red-500 py-8"><i class="fas fa-exclamation-triangle mr-2"></i> Error loading withdrawal history</div>';
}
?>
