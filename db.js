const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
    throw new Error('POSTGRES_URL (or DATABASE_URL) is required');
}

const useSsl = !/localhost|127\.0\.0\.1/i.test(connectionString);
const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
});

const mapPlaceholders = (sql, args) => {
    if (!args || args.length === 0 || !sql.includes('?')) {
        return { sql, args: args || [] };
    }

    let index = 0;
    const mappedSql = sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
    return { sql: mappedSql, args };
};

const db = {
    async execute(input) {
        const payload = typeof input === 'string'
            ? { sql: input, args: [] }
            : { sql: input.sql, args: input.args || [] };

        const mapped = mapPlaceholders(payload.sql, payload.args);
        const result = await pool.query(mapped.sql, mapped.args);
        return { rows: result.rows };
    },
    async close() {
        await pool.end();
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
