const { db } = require('./db');

async function migrate() {
    try {
        await db.execute(`ALTER TABLE users ADD COLUMN can_receive_dividends INTEGER DEFAULT 0`).catch(err => {
            if (!err.message.includes('duplicate column name')) {
                console.error('Error adding can_receive_dividends:', err.message);
            }
        });

        await db.execute(`ALTER TABLE users ADD COLUMN dividend_fee_paid INTEGER DEFAULT 0`).catch(err => {
            if (!err.message.includes('duplicate column name')) {
                console.error('Error adding dividend_fee_paid:', err.message);
            }
        });

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

        await db.execute(`ALTER TABLE users ADD COLUMN salary REAL DEFAULT 0`).catch(() => {});
        await db.execute(`ALTER TABLE users ADD COLUMN bonus REAL DEFAULT 0`).catch(() => {});
        await db.execute(`ALTER TABLE users ADD COLUMN dividends REAL DEFAULT 0`).catch(() => {});
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

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
