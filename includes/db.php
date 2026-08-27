<?php
require_once __DIR__ . '/../config.php';

function initDatabase() {
    $db = getDBConnection();
    
    // Users table
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        avatar_url TEXT,
        plan TEXT DEFAULT 'free',
        billing_cycle TEXT DEFAULT 'monthly',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Subscriptions table
    $db->exec("CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan TEXT NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly',
        status TEXT DEFAULT 'active',
        current_period_start DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_period_end DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Usage Logs table (tracks conversions)
    $db->exec("CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_name TEXT,
        file_size_mb REAL NOT NULL,
        source_format TEXT,
        target_format TEXT,
        source_crs TEXT,
        target_crs TEXT,
        converted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // API Keys table
    $db->exec("CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Transactions & Invoices table
    $db->exec("CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        transaction_id TEXT UNIQUE NOT NULL,
        invoice_number TEXT UNIQUE NOT NULL,
        plan TEXT NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly',
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        gateway TEXT DEFAULT 'paypal',
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Support Tickets Table
    $db->exec("CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Ticket Conversation Replies Table
    $db->exec("CREATE TABLE IF NOT EXISTS ticket_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_staff INTEGER DEFAULT 0,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");
    
    // Ensure default demo user exists for immediate testing if empty
    $stmt = $db->query("SELECT COUNT(*) as cnt FROM users");
    $count = $stmt->fetch()['cnt'];
    if ($count == 0) {
        $demoPass = password_hash('password123', PASSWORD_BCRYPT);
        $db->exec("INSERT INTO users (name, email, password_hash, plan) VALUES ('Demo GIS User', 'demo@sargpoint.com', '$demoPass', 'pro')");
        $userId = $db->lastInsertId();
        
        // Generate a demo API key for pro user
        $demoApiKey = 'sp_live_' . bin2hex(random_bytes(16));
        $db->exec("INSERT INTO api_keys (user_id, name, api_key) VALUES ($userId, 'Default Key', '$demoApiKey')");
    }
}

// Auto-run init on include
initDatabase();
?>
