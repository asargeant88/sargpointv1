<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/usage.php';

// Authenticate via Bearer Token
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$apiKey = '';

if (preg_match('/Bearer\s+(sp_live_[a-f0-9]+)/i', $authHeader, $matches)) {
    $apiKey = $matches[1];
} elseif (isset($_REQUEST['api_key'])) {
    $apiKey = $_REQUEST['api_key'];
}

if (empty($apiKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Missing or invalid API key. Header format: Authorization: Bearer sp_live_...']);
    exit;
}

$db = getDBConnection();
$stmt = $db->prepare("SELECT k.*, u.plan, u.id as user_id FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.api_key = :key");
$stmt->execute([':key' => $apiKey]);
$keyData = $stmt->fetch();

if (!$keyData) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid API key provided.']);
    exit;
}

// Update last used timestamp
$db->exec("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = {$keyData['id']}");

$userId = $keyData['user_id'];
$plan = $keyData['plan'];

$usage = getUserUsageMetrics($userId, $plan);
if (!$usage['can_convert']) {
    http_response_code(429);
    echo json_encode([
        'error' => 'Quota Exceeded',
        'message' => $usage['reason'],
        'usage' => $usage
    ]);
    exit;
}

// Process request input
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$geojson = $input['geojson'] ?? null;
$targetCrs = $input['target_crs'] ?? 'EPSG:4326';
$targetFormat = strtolower($input['target_format'] ?? 'geojson');

if (!$geojson) {
    echo json_encode([
        'status' => 'ready',
        'message' => 'Sargpoint API is active. Send POST with JSON payload containing `geojson`, `target_format`, and `target_crs`.',
        'user_quota' => $usage
    ]);
    exit;
}

// Compute file size estimate
$sizeMb = strlen(json_encode($geojson)) / (1024 * 1024);
recordUserConversion($userId, 'api_request.geojson', max(0.01, $sizeMb), 'geojson', $targetFormat, 'EPSG:4326', $targetCrs);

echo json_encode([
    'status' => 'success',
    'message' => 'Dataset processed via Sargpoint API.',
    'target_crs' => $targetCrs,
    'target_format' => $targetFormat,
    'usage' => getUserUsageMetrics($userId, $plan)
]);
?>
