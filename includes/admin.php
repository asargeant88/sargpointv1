<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

/**
 * Check if the currently logged-in user is an administrator
 */
function isAdmin() {
    $user = getCurrentUser();
    return ($user && isset($user['is_admin']) && intval($user['is_admin']) === 1);
}

/**
 * Fetch full system analytics and KPI metrics for admin dashboard
 */
function getAdminSystemAnalytics() {
    $db = getDBConnection();
    
    // 1. Total Revenue
    $revStmt = $db->query("SELECT COALESCE(SUM(amount), 0) as total_revenue, COUNT(*) as total_transactions FROM transactions WHERE status = 'completed'");
    $revData = $revStmt->fetch();
    
    // 2. User Count & Breakdown by Plan Tiers
    $userCountStmt = $db->query("SELECT COUNT(*) as total_users FROM users");
    $totalUsers = $userCountStmt->fetch()['total_users'];
    
    $planBreakdownStmt = $db->query("SELECT plan, COUNT(*) as cnt FROM users GROUP BY plan");
    $planCounts = [
        'free' => 0,
        'starter' => 0,
        'pro' => 0,
        'enterprise' => 0
    ];
    while ($row = $planBreakdownStmt->fetch()) {
        $p = strtolower($row['plan']);
        $planCounts[$p] = intval($row['cnt']);
    }
    
    // 3. Conversion Usage Analytics (Total Files & Total Upload Volume MB)
    $usageStmt = $db->query("SELECT COUNT(*) as total_conversions, COALESCE(SUM(file_size_mb), 0) as total_mb_processed FROM usage_logs");
    $usageData = $usageStmt->fetch();
    
    // 4. API Keys Count
    $apiKeysStmt = $db->query("SELECT COUNT(*) as total_api_keys FROM api_keys");
    $totalApiKeys = $apiKeysStmt->fetch()['total_api_keys'];
    
    // 5. Help Desk Support Tickets Count
    $ticketStmt = $db->query("SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status = 'Closed' OR status = 'Resolved' THEN 1 ELSE 0 END) as resolved_tickets
        FROM tickets");
    $ticketData = $ticketStmt->fetch();
    
    return [
        'total_revenue' => floatval($revData['total_revenue']),
        'total_transactions' => intval($revData['total_transactions']),
        'total_users' => intval($totalUsers),
        'plan_counts' => $planCounts,
        'total_conversions' => intval($usageData['total_conversions']),
        'total_mb_processed' => round(floatval($usageData['total_mb_processed']), 2),
        'total_api_keys' => intval($totalApiKeys),
        'tickets_summary' => [
            'total' => intval($ticketData['total_tickets']),
            'open' => intval($ticketData['open_tickets']),
            'in_progress' => intval($ticketData['in_progress_tickets']),
            'resolved' => intval($ticketData['resolved_tickets'])
        ]
    ];
}

/**
 * Get full list of registered users with usage stats for admin table
 */
function getAdminUsersList() {
    $db = getDBConnection();
    $stmt = $db->query("
        SELECT u.id, u.name, u.email, u.plan, u.billing_cycle, u.is_admin, u.created_at,
               (SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = u.id) as conversion_count,
               (SELECT COALESCE(SUM(file_size_mb), 0) FROM usage_logs ul WHERE ul.user_id = u.id) as total_mb_used,
               (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id AND t.status = 'completed') as paid_invoices_count,
               (SELECT COALESCE(SUM(amount), 0) FROM transactions t WHERE t.user_id = u.id AND t.status = 'completed') as total_spent
        FROM users u 
        ORDER BY u.created_at DESC
    ");
    return $stmt->fetchAll();
}

/**
 * Admin override: Change user plan tier and billing cycle instantly
 */
function adminUpdateUserPlan($targetUserId, $newPlan, $billingCycle = 'monthly') {
    $db = getDBConnection();
    $validPlans = ['free', 'starter', 'pro', 'enterprise'];
    $plan = strtolower($newPlan);
    
    if (!in_array($plan, $validPlans)) {
        return ['success' => false, 'message' => 'Invalid plan tier specified.'];
    }
    
    $stmt = $db->prepare("UPDATE users SET plan = :plan, billing_cycle = :cycle WHERE id = :uid");
    $stmt->execute([':plan' => $plan, ':cycle' => $billingCycle, ':uid' => $targetUserId]);
    
    return [
        'success' => true, 
        'message' => "User plan successfully updated to " . strtoupper($plan) . " ($billingCycle)!"
    ];
}

/**
 * Admin override: Toggle user administrator status
 */
function adminToggleUserAdminStatus($targetUserId, $isAdminStatus) {
    $db = getDBConnection();
    $status = intval($isAdminStatus) === 1 ? 1 : 0;
    
    $stmt = $db->prepare("UPDATE users SET is_admin = :st WHERE id = :uid");
    $stmt->execute([':st' => $status, ':uid' => $targetUserId]);
    
    $actionText = $status === 1 ? 'granted Admin privileges' : 'revoked Admin privileges';
    return ['success' => true, 'message' => "Successfully $actionText for target user."];
}
?>
