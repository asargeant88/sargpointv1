<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/usage.php';

$user = getCurrentUser();
$userId = $user ? $user['id'] : 0;
$userPlan = $user ? $user['plan'] : 'free';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$action = $input['action'] ?? $_GET['action'] ?? 'record';

if ($action === 'check') {
    $usage = getUserUsageMetrics($userId, $userPlan);
    echo json_encode($usage);
    exit;
}

if ($action === 'record') {
    $fileName = $input['file_name'] ?? 'dataset.geojson';
    $fileSizeMb = (float)($input['file_size_mb'] ?? 0.1);
    $sourceFormat = $input['source_format'] ?? 'geojson';
    $targetFormat = $input['target_format'] ?? 'shp';
    $sourceCrs = $input['source_crs'] ?? 'EPSG:4326';
    $targetCrs = $input['target_crs'] ?? 'EPSG:4326';

    // Verify limit before recording
    $usage = getUserUsageMetrics($userId, $userPlan);
    if (!$usage['can_convert']) {
        echo json_encode([
            'success' => false,
            'message' => $usage['reason'],
            'usage' => $usage
        ]);
        exit;
    }

    recordUserConversion($userId, $fileName, $fileSizeMb, $sourceFormat, $targetFormat, $sourceCrs, $targetCrs);
    $updatedUsage = getUserUsageMetrics($userId, $userPlan);

    echo json_encode([
        'success' => true,
        'message' => 'Conversion logged.',
        'usage' => $updatedUsage
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
