<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

function getUserUsageMetrics($userId, $userPlan = 'free') {
    $db = getDBConnection();
    
    // First day of current month
    $firstOfMonth = date('Y-m-01 00:00:00');
    
    $stmt = $db->prepare("SELECT COUNT(*) as file_count, SUM(file_size_mb) as total_mb 
                          FROM usage_logs 
                          WHERE user_id = :user_id AND converted_at >= :start_date");
    $stmt->execute([
        ':user_id' => $userId,
        ':start_date' => $firstOfMonth
    ]);
    
    $usage = $stmt->fetch();
    $usedFiles = (int)($usage['file_count'] ?? 0);
    $usedMb = (float)($usage['total_mb'] ?? 0.0);
    
    $planConfig = $GLOBALS['PLAN_LIMITS'][$userPlan] ?? $GLOBALS['PLAN_LIMITS']['free'];
    
    $maxMb = $planConfig['monthly_mb'];
    $maxFiles = $planConfig['monthly_files'];
    
    $filesRemaining = ($maxFiles === -1) ? 'Unlimited' : max(0, $maxFiles - $usedFiles);
    $mbRemaining = max(0.0, round($maxMb - $usedMb, 2));
    
    $canConvert = true;
    $reason = '';
    
    if ($maxFiles !== -1 && $usedFiles >= $maxFiles) {
        $canConvert = false;
        $reason = "You have reached your monthly limit of {$maxFiles} files for the {$planConfig['name']} plan.";
    } elseif ($usedMb >= $maxMb) {
        $canConvert = false;
        $reason = "You have reached your monthly storage bandwidth limit of {$maxMb} MB for the {$planConfig['name']} plan.";
    }
    
    return [
        'plan' => $userPlan,
        'plan_name' => $planConfig['name'],
        'used_files' => $usedFiles,
        'max_files' => $maxFiles,
        'files_remaining' => $filesRemaining,
        'used_mb' => round($usedMb, 2),
        'max_mb' => $maxMb,
        'mb_remaining' => $mbRemaining,
        'can_convert' => $canConvert,
        'reason' => $reason,
        'api_access' => $planConfig['api_access']
    ];
}

function recordUserConversion($userId, $fileName, $fileSizeMb, $sourceFormat, $targetFormat, $sourceCrs, $targetCrs) {
    $db = getDBConnection();
    $stmt = $db->prepare("INSERT INTO usage_logs (user_id, file_name, file_size_mb, source_format, target_format, source_crs, target_crs) 
                          VALUES (:user_id, :file_name, :file_size_mb, :source_format, :target_format, :source_crs, :target_crs)");
    $stmt->execute([
        ':user_id' => $userId,
        ':file_name' => $fileName,
        ':file_size_mb' => $fileSizeMb,
        ':source_format' => $sourceFormat,
        ':target_format' => $targetFormat,
        ':source_crs' => $sourceCrs,
        ':target_crs' => $targetCrs
    ]);
}
?>
