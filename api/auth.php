<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/usage.php';

$action = $_REQUEST['action'] ?? '';

if ($action === 'status') {
    $user = getCurrentUser();
    if ($user) {
        $usage = getUserUsageMetrics($user['id'], $user['plan']);
        echo json_encode([
            'logged_in' => true,
            'user' => $user,
            'usage' => $usage
        ]);
    } else {
        // Guest usage metrics
        $guestUsage = getUserUsageMetrics(0, 'free');
        echo json_encode([
            'logged_in' => false,
            'user' => null,
            'usage' => $guestUsage
        ]);
    }
    exit;
}

if ($action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Email and password are required.']);
        exit;
    }
    
    $res = loginUser($email, $password);
    if ($res['success']) {
        $user = getCurrentUser();
        $res['user'] = $user;
        $res['usage'] = getUserUsageMetrics($user['id'], $user['plan']);
    }
    echo json_encode($res);
    exit;
}

if ($action === 'register') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $name = $input['name'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    $plan = $input['plan'] ?? 'starter';
    
    if (empty($name) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Name, email, and password are required.']);
        exit;
    }
    
    $res = registerUser($name, $email, $password, $plan);
    if ($res['success']) {
        $user = getCurrentUser();
        $res['user'] = $user;
        $res['usage'] = getUserUsageMetrics($user['id'], $user['plan']);
    }
    echo json_encode($res);
    exit;
}

if ($action === 'google') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $googleId = $input['google_id'] ?? '';
    $email = $input['email'] ?? '';
    $name = $input['name'] ?? 'Google User';
    $avatar = $input['avatar_url'] ?? '';
    
    if (empty($googleId) || empty($email)) {
        echo json_encode(['success' => false, 'message' => 'Invalid Google authentication data.']);
        exit;
    }
    
    $res = loginWithGoogle($googleId, $email, $name, $avatar);
    if ($res['success']) {
        $user = getCurrentUser();
        $res['user'] = $user;
        $res['usage'] = getUserUsageMetrics($user['id'], $user['plan']);
    }
    echo json_encode($res);
    exit;
}

if ($action === 'upgrade_plan') {
    $user = getCurrentUser();
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Please sign in to change your plan.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $plan = $input['plan'] ?? 'starter';
    $cycle = $input['billing_cycle'] ?? 'monthly';
    
    updateUserPlan($user['id'], $plan, $cycle);
    $updatedUser = getCurrentUser();
    echo json_encode([
        'success' => true,
        'message' => 'Subscription plan updated successfully!',
        'user' => $updatedUser,
        'usage' => getUserUsageMetrics($updatedUser['id'], $updatedUser['plan'])
    ]);
    exit;
}

if ($action === 'logout') {
    logoutUser();
    echo json_encode(['success' => true, 'message' => 'Logged out successfully.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
