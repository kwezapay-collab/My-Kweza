const { Pool } = require('pg');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const useLocalDb = process.env.USE_LOCAL_DB === 'true' || !postgresUrl;

let pgPool = null;
let sqliteClient = null;

if (!useLocalDb) {
    const useSsl = !/localhost|127\.0\.0\.1/i.test(postgresUrl);
    pgPool = new Pool({
        connectionString: postgresUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
} else {
    console.log('Using local SQLite database (kweza.db)');
    sqliteClient = createClient({
        url: 'file:kweza.db',
    });
}

const mapPlaceholders = (sql, args, isSqlite) => {
    if (!args || args.length === 0) return { sql, args: [] };

    if (isSqlite) {
        // SQLite/libsql handles ? placeholders naturally
        return { sql, args };
    }

    // Convert ? to $1, $2 for PostgreSQL
    let index = 0;
    const mappedSql = sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
    return { sql: mappedSql, args };
};

const db = {
    async execute(input) {
        let { sql, args } = typeof input === 'string'
            ? { sql: input, args: [] }
            : { sql: input.sql, args: input.args || [] };

        if (sqliteClient) {
            // Translate PostgreSQL syntax to SQLite
            sql = sql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
            sql = sql.replace(/::int/gi, '');
            sql = sql.replace(/NULLS LAST/gi, '');
            sql = sql.replace(/timestamp/gi, 'datetime');

            // Handle ALTER TABLE ADD COLUMN IF NOT EXISTS (SQLite doesn't support IF NOT EXISTS for columns)
            if (sql.toUpperCase().includes('ADD COLUMN IF NOT EXISTS')) {
                sql = sql.replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN');
                try {
                    const result = await sqliteClient.execute({ sql, args });
                    return { rows: result.rows || [] };
                } catch (err) {
                    const msg = err.message.toLowerCase();
                    if (msg.includes('duplicate column') || msg.includes('already exists')) {
                        return { rows: [] }; // Ignore if column exists
                    }
                    throw err;
                }
            }

            // Handle TRUNCATE RESTART IDENTITY for SQLite
            if (sql.toUpperCase().includes('TRUNCATE TABLE')) {
                const tableName = sql.match(/TRUNCATE TABLE\s+(\w+)/i)?.[1];
                if (tableName) {
                    await sqliteClient.execute(`DELETE FROM ${tableName}`);
                    await sqliteClient.execute(`DELETE FROM sqlite_sequence WHERE name='${tableName}'`).catch(() => { });
                    return { rows: [] };
                }
            }

            try {
                const result = await sqliteClient.execute({ sql, args });
                return { rows: result.rows || [] };
            } catch (err) {
                console.error('SQLITE EXECUTE ERROR:', { sql, args, message: err.message });
                throw err;
            }
        }

        const mapped = mapPlaceholders(sql, args, false);
        const result = await pgPool.query(mapped.sql, mapped.args);
        return { rows: result.rows };
    },
    async close() {
        if (pgPool) await pgPool.end();
        if (sqliteClient) await sqliteClient.close();
    }
};

const initDb = async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        member_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        sub_role TEXT,
        pin TEXT NOT NULL,
        email TEXT,
        branch TEXT,
        notifications_enabled INTEGER DEFAULT 1,
        theme_mode TEXT DEFAULT 'dark',
        can_receive_dividends INTEGER DEFAULT 0,
        dividend_fee_paid INTEGER DEFAULT 0,
        salary DOUBLE PRECISION DEFAULT 0,
        bonus DOUBLE PRECISION DEFAULT 0,
        dividends DOUBLE PRECISION DEFAULT 0
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        status TEXT DEFAULT 'pending',
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        approved_by INTEGER,
        paid_at TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        method TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        notification_message TEXT,
        notification_sent_at TIMESTAMP,
        notification_sent_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS revenue (
        id SERIAL PRIMARY KEY,
        branch TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        submitted_by INTEGER REFERENCES users(id),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id),
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS weekly_reports (
        id SERIAL PRIMARY KEY,
        developer_id INTEGER NOT NULL REFERENCES users(id),
        developer_name TEXT NOT NULL,
        developer_member_id TEXT,
        project_name TEXT NOT NULL,
        report_date DATE,
        date_time_started TEXT,
        target_completion_date DATE,
        work_completed TEXT,
        challenges_blockers TEXT,
        plan_next_week TEXT,
        reviewed_by TEXT,
        approval_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS branch_detailed_reports (
        id SERIAL PRIMARY KEY,
        branch TEXT NOT NULL,
        submitted_by INTEGER NOT NULL REFERENCES users(id),
        submitted_by_name TEXT NOT NULL,
        submitted_by_member_id TEXT,
        report_title TEXT NOT NULL,
        report_date DATE NOT NULL,
        total_collection DOUBLE PRECISION NOT NULL,
        highlights TEXT,
        detailed_report TEXT NOT NULL,
        challenges TEXT,
        support_needed TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        notification_type TEXT DEFAULT 'general',
        link_url TEXT,
        is_read INTEGER DEFAULT 0,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read)');

    await db.execute(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    await db.execute(`INSERT INTO settings (key, value)
        VALUES ('low_revenue_mode', 'false')
        ON CONFLICT (key) DO NOTHING`);
};

module.exports = { db, initDb };
