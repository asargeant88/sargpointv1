<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

function getCurrentUser() {
    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    
    $db = getDBConnection();
    $stmt = $db->prepare("SELECT id, name, email, google_id, avatar_url, plan, billing_cycle, is_admin, created_at FROM users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

function registerUser($name, $email, $password, $plan = 'starter') {
    $db = getDBConnection();
    
    // Check existing
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute([':email' => strtolower(trim($email))]);
    if ($stmt->fetch()) {
        return ['success' => false, 'message' => 'An account with this email already exists.'];
    }
    
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (name, email, password_hash, plan) VALUES (:name, :email, :hash, :plan)");
    $stmt->execute([
        ':name' => trim($name),
        ':email' => strtolower(trim($email)),
        ':hash' => $hash,
        ':plan' => $plan
    ]);
    
    $userId = $db->lastInsertId();
    $_SESSION['user_id'] = $userId;
    
    return ['success' => true, 'message' => 'Registration successful!', 'user_id' => $userId];
}

function loginUser($email, $password) {
    $db = getDBConnection();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute([':email' => strtolower(trim($email))]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return ['success' => false, 'message' => 'Invalid email or password.'];
    }
    
    $_SESSION['user_id'] = $user['id'];
    return ['success' => true, 'message' => 'Login successful!'];
}

function loginWithGoogle($googleId, $email, $name, $avatarUrl) {
    $db = getDBConnection();
    
    // Check if user exists by google_id or email
    $stmt = $db->prepare("SELECT * FROM users WHERE google_id = :gid OR email = :email");
    $stmt->execute([':gid' => $googleId, ':email' => strtolower(trim($email))]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Update google_id and avatar if needed
        $stmt = $db->prepare("UPDATE users SET google_id = :gid, avatar_url = :avatar, name = :name WHERE id = :id");
        $stmt->execute([
            ':gid' => $googleId,
            ':avatar' => $avatarUrl,
            ':name' => $name,
            ':id' => $user['id']
        ]);
        $_SESSION['user_id'] = $user['id'];
        return ['success' => true, 'message' => 'Welcome back!'];
    } else {
        // Create new account with starter plan
        $stmt = $db->prepare("INSERT INTO users (name, email, google_id, avatar_url, plan) VALUES (:name, :email, :gid, :avatar, 'starter')");
        $stmt->execute([
            ':name' => $name,
            ':email' => strtolower(trim($email)),
            ':gid' => $googleId,
            ':avatar' => $avatarUrl
        ]);
        $userId = $db->lastInsertId();
        $_SESSION['user_id'] = $userId;
        return ['success' => true, 'message' => 'Account created with Google!'];
    }
}

function updateUserPlan($userId, $plan, $billingCycle = 'monthly') {
    $db = getDBConnection();
    $stmt = $db->prepare("UPDATE users SET plan = :plan, billing_cycle = :cycle WHERE id = :id");
    $stmt->execute([
        ':plan' => $plan,
        ':cycle' => $billingCycle,
        ':id' => $userId
    ]);
    return true;
}

function logoutUser() {
    unset($_SESSION['user_id']);
    session_destroy();
    return true;
}
?>
