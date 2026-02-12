const { db, initDb } = require('./db');

async function migrate() {
    try {
        await initDb();

        await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_receive_dividends INTEGER DEFAULT 0`);
        await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dividend_fee_paid INTEGER DEFAULT 0`);
        await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS salary DOUBLE PRECISION DEFAULT 0`);
        await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus DOUBLE PRECISION DEFAULT 0`);
        await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dividends DOUBLE PRECISION DEFAULT 0`);

        await db.execute(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            amount DOUBLE PRECISION NOT NULL,
            method TEXT NOT NULL,
            details TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_message TEXT`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_sent_by INTEGER`);
        await db.execute(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await db.execute(`UPDATE withdrawal_requests SET updated_at = created_at WHERE updated_at IS NULL`);
        await db.execute(`UPDATE withdrawal_requests SET status = 'accepted' WHERE status = 'approved'`);

        await db.execute(`CREATE TABLE IF NOT EXISTS complaints (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER NOT NULL REFERENCES users(id),
            subject TEXT,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
