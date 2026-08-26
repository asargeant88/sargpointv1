<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/auth.php';

$user = getCurrentUser();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = getDBConnection();
$action = $_REQUEST['action'] ?? 'list';

if ($action === 'list') {
    $stmt = $db->prepare("SELECT id, name, api_key, created_at, last_used_at FROM api_keys WHERE user_id = :uid ORDER BY id DESC");
    $stmt->execute([':uid' => $user['id']]);
    $keys = $stmt->fetchAll();
    echo json_encode(['success' => true, 'keys' => $keys]);
    exit;
}

if ($action === 'create') {
    if ($user['plan'] === 'free' || $user['plan'] === 'starter') {
        echo json_encode(['success' => false, 'message' => 'API Key generation requires Pro or Enterprise tier subscription.']);
        exit;
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $keyName = trim($input['name'] ?? 'Production Key');
    $newKey = 'sp_live_' . bin2hex(random_bytes(16));
    
    $stmt = $db->prepare("INSERT INTO api_keys (user_id, name, api_key) VALUES (:uid, :name, :key)");
    $stmt->execute([
        ':uid' => $user['id'],
        ':name' => $keyName,
        ':key' => $newKey
    ]);
    
    echo json_encode(['success' => true, 'message' => 'API Key created successfully', 'api_key' => $newKey]);
    exit;
}

if ($action === 'delete') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $keyId = (int)($input['id'] ?? 0);
    
    $stmt = $db->prepare("DELETE FROM api_keys WHERE id = :id AND user_id = :uid");
    $stmt->execute([':id' => $keyId, ':uid' => $user['id']]);
    
    echo json_encode(['success' => true, 'message' => 'API Key revoked.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
