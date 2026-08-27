<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/admin.php';

// Strict Admin Security Check
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'message' => 'Access denied. Administrator privileges required.'
    ]);
    exit;
}

$action = $_REQUEST['action'] ?? '';

// 1. Get Full System Analytics & KPI Metrics
if ($action === 'analytics') {
    $analytics = getAdminSystemAnalytics();
    echo json_encode([
        'success' => true,
        'analytics' => $analytics
    ]);
    exit;
}

// 2. Get Registered Users List for Admin Table
if ($action === 'users_list') {
    $users = getAdminUsersList();
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
    exit;
}

// 3. Admin Plan Override (Instant Auto-Activation for Target User)
if ($action === 'update_plan') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $targetUserId = intval($input['user_id'] ?? 0);
    $plan = strtolower($input['plan'] ?? 'free');
    $cycle = strtolower($input['billing_cycle'] ?? 'monthly');
    
    if (!$targetUserId) {
        echo json_encode(['success' => false, 'message' => 'Target user ID is required.']);
        exit;
    }
    
    $res = adminUpdateUserPlan($targetUserId, $plan, $cycle);
    echo json_encode($res);
    exit;
}

// 4. Toggle User Admin Privileges
if ($action === 'toggle_admin') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $targetUserId = intval($input['user_id'] ?? 0);
    $isAdminStatus = intval($input['is_admin'] ?? 0);
    
    if (!$targetUserId) {
        echo json_encode(['success' => false, 'message' => 'Target user ID is required.']);
        exit;
    }
    
    $res = adminToggleUserAdminStatus($targetUserId, $isAdminStatus);
    echo json_encode($res);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid admin action requested.']);
?>
