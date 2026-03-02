-- ============================================================
-- Run this in XAMPP phpMyAdmin → SQL tab
-- Go to: http://localhost/phpmyadmin
-- ============================================================

CREATE DATABASE IF NOT EXISTS discord_app;
USE discord_app;

-- Users table (with password reset columns)
CREATE TABLE IF NOT EXISTS discord_users (
    user_id              INT AUTO_INCREMENT PRIMARY KEY,
    email                VARCHAR(255) NOT NULL UNIQUE,
    username             VARCHAR(32)  NOT NULL UNIQUE,
    display_name         VARCHAR(100),
    password_hash        VARCHAR(255) NOT NULL,
    dob_month            TINYINT,
    dob_day              TINYINT,
    dob_year             SMALLINT,
    email_opt_in         TINYINT DEFAULT 0,
    reset_token          VARCHAR(255) DEFAULT NULL,
    reset_token_expires  DATETIME DEFAULT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login           DATETIME
);

-- Login logs table
CREATE TABLE IF NOT EXISTS discord_login_logs (
    log_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status     VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES discord_users(user_id)
);

SELECT 'Tables created successfully!' AS Result;

-- ============================================================
-- IF TABLES ALREADY EXIST, run this to add reset columns:
-- ALTER TABLE discord_users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL;
-- ALTER TABLE discord_users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL;
-- ============================================================
