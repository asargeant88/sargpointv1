<?php
$dbFile = __DIR__ . '/data/sample_gis.sqlite';
if (file_exists($dbFile)) unlink($dbFile);

$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE pipeline_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    latitude REAL,
    longitude REAL,
    asset_type TEXT,
    status TEXT
)");

$stmt = $pdo->prepare("INSERT INTO pipeline_assets (name, latitude, longitude, asset_type, status) VALUES (?, ?, ?, ?, ?)");
$stmt->execute(['Edmonton Control Station', 53.5461, -113.4938, 'Control Station', 'Active']);
$stmt->execute(['Red Deer Pump Vault', 52.2681, -113.8112, 'Pump Station', 'Active']);
$stmt->execute(['Calgary Distribution Hub', 51.0447, -114.0719, 'Terminal', 'Active']);

echo "Created sample SQLite database at data/sample_gis.sqlite with 3 records!\n";
