-- PostgreSQL Enterprise Database Schema for Sargpoint GIS Converter
-- Generated for PostgreSQL / Postgres Cloud Cluster

-- 1. Enable Required Extensions (if applicable)
-- PostgreSQL supports gen_random_uuid() natively.

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    current_period_end TIMESTAMPTZ,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4. Usage Logs Table (Tracks spatial conversions, file size, CRS projections)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT,
    file_size_mb NUMERIC(10, 4) NOT NULL,
    source_format VARCHAR(50),
    target_format VARCHAR(50),
    source_crs VARCHAR(100),
    target_crs VARCHAR(100),
    feature_count INT DEFAULT 0,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 5. User Saved Datasets Table
CREATE TABLE IF NOT EXISTS user_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format VARCHAR(50) NOT NULL,
    file_size_mb NUMERIC(10, 4) NOT NULL,
    feature_count INT DEFAULT 0,
    crs VARCHAR(100) DEFAULT 'EPSG:4326',
    geojson_data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 6. API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_used_at TIMESTAMPTZ
);

-- 6. Transactions & Invoices Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    gateway VARCHAR(50) NOT NULL DEFAULT 'stripe',
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 7. Support Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 8. Ticket Conversation Replies Table
CREATE TABLE IF NOT EXISTS ticket_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_staff INT NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON usage_logs(user_id, converted_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_thread ON ticket_replies(ticket_id, created_at ASC);

-- Initial Demo User Seed Data
INSERT INTO users (name, email, password_hash, plan, billing_cycle)
VALUES (
    'Demo GIS User',
    'demo@sargpoint.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'pro',
    'yearly'
)
ON CONFLICT (email) DO NOTHING;
