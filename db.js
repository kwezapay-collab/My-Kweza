const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const initDb = async () => {
    // Users Table
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        sub_role TEXT,
        pin TEXT NOT NULL,
        email TEXT,
        branch TEXT,
        notifications_enabled INTEGER DEFAULT 1,
        can_receive_dividends INTEGER DEFAULT 0,
        dividend_fee_paid INTEGER DEFAULT 0,
        salary REAL DEFAULT 0,
        bonus REAL DEFAULT 0,
        dividends REAL DEFAULT 0
    )`);

    // Payouts Table
    await db.execute(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        approved_by INTEGER,
        paid_at DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Withdrawal Requests Table
    await db.execute(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Revenue Table
    await db.execute(`CREATE TABLE IF NOT EXISTS revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        submitted_by INTEGER,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(submitted_by) REFERENCES users(id)
    )`);

    // Complaints Table
    await db.execute(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reporter_id) REFERENCES users(id)
    )`);

    // Settings Table
    await db.execute(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Seed initial setting
    await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('low_revenue_mode', 'false')`);
};

module.exports = { db, initDb };
