<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

$action = $_REQUEST['action'] ?? '';

// Check current session user
$user = getCurrentUser();

// 1. Save Dataset to User Profile
if ($action === 'save') {
    if (!$user) {
        echo json_encode([
            'success' => false, 
            'require_auth' => true,
            'message' => 'Sign in required to save spatial datasets to your profile.'
        ]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $name = trim($input['name'] ?? 'Untitled Dataset');
    $format = strtoupper($input['format'] ?? 'GEOJSON');
    $fileSizeMb = floatval($input['file_size_mb'] ?? 0.1);
    $featureCount = intval($input['feature_count'] ?? 0);
    $crs = $input['crs'] ?? 'EPSG:4326';
    $geoJsonData = $input['geojson_data'] ?? '';

    if (empty($geoJsonData)) {
        echo json_encode(['success' => false, 'message' => 'No spatial dataset geometry content provided.']);
        exit;
    }

    // Check Plan Quota
    $usage = getUserUsageMetrics($user['id'], $user['plan']);
    if ($usage['upload_remaining_mb'] !== -1 && $fileSizeMb > $usage['upload_remaining_mb']) {
        echo json_encode([
            'success' => false,
            'message' => 'Monthly upload quota exceeded. Upgrade your plan to save larger datasets.'
        ]);
        exit;
    }

    try {
        $db = getDBConnection();
        $stmt = $db->prepare("
            INSERT INTO user_datasets (user_id, name, format, file_size_mb, feature_count, crs, geojson_data)
            VALUES (:uid, :name, :fmt, :sz, :fc, :crs, :geo)
        ");
        $stmt->execute([
            ':uid' => $user['id'],
            ':name' => $name,
            ':fmt' => $format,
            ':sz' => $fileSizeMb,
            ':fc' => $featureCount,
            ':crs' => $crs,
            ':geo' => is_string($geoJsonData) ? $geoJsonData : json_encode($geoJsonData)
        ]);

        $datasetId = $db->lastInsertId();

        // Log conversion usage
        recordConversionUsage($user['id'], $name, $fileSizeMb, $format, $format, $crs, $crs);

        echo json_encode([
            'success' => true,
            'dataset_id' => $datasetId,
            'message' => "Dataset '$name' successfully saved to your profile profile!"
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// 2. List Profile Saved Datasets
if ($action === 'list') {
    if (!$user) {
        echo json_encode(['success' => false, 'datasets' => [], 'message' => 'Not logged in.']);
        exit;
    }

    $db = getDBConnection();
    $stmt = $db->prepare("
        SELECT id, name, format, file_size_mb, feature_count, crs, created_at 
        FROM user_datasets 
        WHERE user_id = :uid 
        ORDER BY created_at DESC
    ");
    $stmt->execute([':uid' => $user['id']]);
    $datasets = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'datasets' => $datasets
    ]);
    exit;
}

// 3. Load Full Geometry of a Saved Dataset
if ($action === 'get') {
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Sign in required to load profile datasets.']);
        exit;
    }

    $datasetId = intval($_GET['id'] ?? 0);
    $db = getDBConnection();
    $stmt = $db->prepare("SELECT * FROM user_datasets WHERE id = :id AND user_id = :uid");
    $stmt->execute([':id' => $datasetId, ':uid' => $user['id']]);
    $ds = $stmt->fetch();

    if (!$ds) {
        echo json_encode(['success' => false, 'message' => 'Dataset not found or access denied.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'dataset' => $ds
    ]);
    exit;
}

// 4. Delete Saved Dataset from Profile
if ($action === 'delete') {
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Sign in required.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $datasetId = intval($input['id'] ?? 0);

    $db = getDBConnection();
    $stmt = $db->prepare("DELETE FROM user_datasets WHERE id = :id AND user_id = :uid");
    $stmt->execute([':id' => $datasetId, ':uid' => $user['id']]);

    echo json_encode([
        'success' => true,
        'message' => 'Dataset removed from profile.'
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid dataset action.']);
?>
