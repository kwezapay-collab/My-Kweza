const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, initDb } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'kweza-secret-key-2026';
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || (IS_PROD ? 'none' : 'lax');
const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : IS_PROD;
const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
};
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : true;

const ensureSchema = async () => {
    await initDb();
    await db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'dark'");
    await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_receive_dividends INTEGER DEFAULT 0');
    await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS dividend_fee_paid INTEGER DEFAULT 0');
    await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS salary DOUBLE PRECISION DEFAULT 0');
    await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus DOUBLE PRECISION DEFAULT 0');
    await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS dividends DOUBLE PRECISION DEFAULT 0');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_message TEXT');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS notification_sent_by INTEGER');
    await db.execute('ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await db.execute('UPDATE withdrawal_requests SET updated_at = created_at WHERE updated_at IS NULL');
    await db.execute("UPDATE withdrawal_requests SET status = 'accepted' WHERE status = 'approved'");
    await db.execute("UPDATE users SET theme_mode = 'dark' WHERE theme_mode IS NULL OR theme_mode NOT IN ('dark', 'light')");
};

app.use(express.json());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'Super Admin') return res.status(403).json({ error: 'Super Admin access required' });
    next();
};

const isDevOpsAssistant = (req, res, next) => {
    if (req.user.role !== 'Dev Operations Assistant') {
        return res.status(403).json({ error: 'Dev Operations Assistant access required' });
    }
    next();
};

const isFinancialManager = (req, res, next) => {
    if (req.user.role !== 'Financial Manager') {
        return res.status(403).json({ error: 'Financial Manager access required' });
    }
    next();
};

const isFounderAccess = (req, res, next) => {
    if (req.user.role !== 'Founder' && req.user.role !== 'Financial Manager') {
        return res.status(403).json({ error: 'Founder access required' });
    }
    next();
};

// --- ROUTES ---

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { member_id, pin } = req.body;
        const result = await db.execute({
            sql: 'SELECT * FROM users WHERE member_id = ?',
            args: [member_id]
        });
        const user = result.rows[0];

        if (!user) return res.status(401).json({ error: 'User not found' });

        const validPin = await bcrypt.compare(pin, user.pin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        const token = jwt.sign({ id: user.id, member_id: user.member_id, role: user.role }, SECRET, { expiresIn: '1d' });
        res.cookie('token', token, COOKIE_OPTIONS);
        res.json({
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                member_id: user.member_id,
                theme_mode: user.theme_mode === 'light' ? 'light' : 'dark'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Current User info
app.get('/api/me', authenticate, async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT id, member_id, name, role, sub_role, branch, email, notifications_enabled, theme_mode, salary, bonus, dividends FROM users WHERE id = ?',
            args: [req.user.id]
        });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: COOKIE_SAME_SITE,
        secure: COOKIE_SECURE,
        path: '/'
    });
    res.json({ success: true });
});

// Get Payouts
app.get('/api/payouts', authenticate, async (req, res) => {
    try {
        let sql = 'SELECT * FROM payouts';
        const args = [];

        if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
            sql += ' WHERE user_id = ?';
            args.push(req.user.id);
        }

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Revenue Summary
app.get('/api/admin/summary', authenticate, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const revResult = await db.execute('SELECT SUM(amount) as total_revenue FROM revenue');
        const payResult = await db.execute('SELECT SUM(amount) as total_payouts FROM payouts');
        const userPayResult = await db.execute('SELECT SUM(salary + bonus + dividends) as total_user_payouts FROM users');
        const paidResult = await db.execute("SELECT SUM(amount) as total_paid FROM payouts WHERE status = 'paid'");
        const modeResult = await db.execute({
            sql: 'SELECT value FROM settings WHERE key = ?',
            args: ['low_revenue_mode']
        });

        const totalRevenue = revResult.rows[0].total_revenue || 0;
        const totalPayouts = (payResult.rows[0].total_payouts || 0) + (userPayResult.rows[0].total_user_payouts || 0);
        const totalPaid = paidResult.rows[0].total_paid || 0;

        res.json({
            totalRevenue,
            totalPayouts,
            totalPaid,
            remainingFunds: totalRevenue - totalPayouts,
            lowRevenueMode: modeResult.rows[0].value === 'true'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile (Email/Notifications)
app.post('/api/profile/update', authenticate, async (req, res) => {
    try {
        const { email, notifications_enabled } = req.body;
        const themeModeRaw = String(req.body.theme_mode || '').toLowerCase();
        const themeMode = themeModeRaw === 'light' || themeModeRaw === 'dark' ? themeModeRaw : null;

        if (themeMode) {
            await db.execute({
                sql: 'UPDATE users SET email = ?, notifications_enabled = ?, theme_mode = ? WHERE id = ?',
                args: [email, notifications_enabled ? 1 : 0, themeMode, req.user.id]
            });
        } else {
            await db.execute({
                sql: 'UPDATE users SET email = ?, notifications_enabled = ? WHERE id = ?',
                args: [email, notifications_enabled ? 1 : 0, req.user.id]
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profile/theme', authenticate, async (req, res) => {
    try {
        const themeModeRaw = String(req.body.theme_mode || '').toLowerCase();
        const themeMode = themeModeRaw === 'light' ? 'light' : 'dark';

        await db.execute({
            sql: 'UPDATE users SET theme_mode = ? WHERE id = ?',
            args: [themeMode, req.user.id]
        });
        res.json({ success: true, theme_mode: themeMode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Change PIN
app.post('/api/profile/change-pin', authenticate, async (req, res) => {
    try {
        const { old_pin, new_pin } = req.body;

        const result = await db.execute({
            sql: 'SELECT pin FROM users WHERE id = ?',
            args: [req.user.id]
        });
        const user = result.rows[0];

        if (!user) return res.status(500).json({ error: 'User not found' });

        const validPin = await bcrypt.compare(old_pin, user.pin);
        if (!validPin) return res.status(401).json({ error: 'Current PIN is incorrect' });

        const hashedPin = await bcrypt.hash(new_pin, 10);
        await db.execute({
            sql: 'UPDATE users SET pin = ? WHERE id = ?',
            args: [hashedPin, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Founder Compensation Management
app.get('/api/founder/members', authenticate, isFinancialManager, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT id, member_id, name, role, branch, salary, bonus, dividends
            FROM users
            ORDER BY name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/founder/members/:id/compensation', authenticate, isFinancialManager, async (req, res) => {
    try {
        const { id } = req.params;
        const salary = Number(req.body.salary || 0);
        const bonus = Number(req.body.bonus || 0);
        const dividends = Number(req.body.dividends || 0);

        if ([salary, bonus, dividends].some(v => !Number.isFinite(v) || v < 0)) {
            return res.status(400).json({ error: 'Salary, bonus and dividends must be non-negative numbers' });
        }

        await db.execute({
            sql: 'UPDATE users SET salary = ?, bonus = ?, dividends = ? WHERE id = ?',
            args: [salary, bonus, dividends, id]
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Report Complaint
app.post('/api/complaints', authenticate, async (req, res) => {
    try {
        const { subject, message } = req.body;
        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'Complaint message is required' });
        }

        await db.execute({
            sql: 'INSERT INTO complaints (reporter_id, subject, message, status) VALUES (?, ?, ?, ?)',
            args: [req.user.id, subject || 'General', String(message).trim(), 'open']
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dev Operations Assistant APIs
app.get('/api/devops/complaints', authenticate, isDevOpsAssistant, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT c.*, u.name as reporter_name, u.member_id, u.role as reporter_role
            FROM complaints c
            JOIN users u ON c.reporter_id = u.id
            ORDER BY c.created_at DESC, c.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/devops/complaints/:id', authenticate, isDevOpsAssistant, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = ['open', 'in_review', 'resolved'].includes(status) ? status : 'open';

        await db.execute({
            sql: 'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [normalizedStatus, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const normalizeDateInput = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 10);
};

const normalizeList = (value) => {
    const cleanLine = (item) => String(item || '').trim().replace(/^[\u2022\-]+\s*/, '');
    if (Array.isArray(value)) {
        return value.map(cleanLine).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split('\n')
            .map(cleanLine)
            .filter(Boolean);
    }
    return [];
};

app.post('/api/devops/weekly-reports', authenticate, isDevOpsAssistant, async (req, res) => {
    try {
        const projectName = String(req.body.project_name || '').trim();
        const reportDate = normalizeDateInput(req.body.report_date) || new Date().toISOString().slice(0, 10);
        const dateTimeStarted = String(req.body.date_time_started || '').trim();
        const targetCompletionDate = normalizeDateInput(req.body.target_completion_date);
        const workCompletedItems = normalizeList(req.body.work_completed);
        const challengeItems = normalizeList(req.body.challenges_blockers);
        const planItems = normalizeList(req.body.plan_next_week);
        const reviewedBy = String(req.body.reviewed_by || '').trim();
        const approvalDate = normalizeDateInput(req.body.approval_date);

        if (!projectName) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        if (!workCompletedItems.length) {
            return res.status(400).json({ error: 'At least one completed work item is required' });
        }

        const userResult = await db.execute({
            sql: 'SELECT name, member_id FROM users WHERE id = ?',
            args: [req.user.id]
        });
        const user = userResult.rows[0];
        if (!user) {
            return res.status(404).json({ error: 'Developer account not found' });
        }

        await db.execute({
            sql: `
                INSERT INTO weekly_reports (
                    developer_id,
                    developer_name,
                    developer_member_id,
                    project_name,
                    report_date,
                    date_time_started,
                    target_completion_date,
                    work_completed,
                    challenges_blockers,
                    plan_next_week,
                    reviewed_by,
                    approval_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                req.user.id,
                user.name,
                user.member_id,
                projectName,
                reportDate,
                dateTimeStarted || null,
                targetCompletionDate,
                workCompletedItems.join('\n'),
                challengeItems.join('\n'),
                planItems.join('\n'),
                reviewedBy || null,
                approvalDate
            ]
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/founder/weekly-reports', authenticate, isFounderAccess, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT
                wr.*,
                u.name as current_developer_name,
                u.member_id as current_developer_member_id
            FROM weekly_reports wr
            LEFT JOIN users u ON wr.developer_id = u.id
            ORDER BY wr.report_date DESC NULLS LAST, wr.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SUPER ADMIN APIs ---

// Get all members for dropdowns and list
app.get('/api/super/members', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const result = await db.execute("SELECT id, member_id, name, role, sub_role, branch, email, can_receive_dividends, dividend_fee_paid, salary, bonus, dividends FROM users ORDER BY name ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new user
app.post('/api/super/users', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { member_id, name, role, sub_role, pin, branch, email, can_receive_dividends, dividend_fee_paid, salary, bonus, dividends } = req.body;
        const hashedPin = await bcrypt.hash(pin, 10);
        await db.execute({
            sql: 'INSERT INTO users (member_id, name, role, sub_role, pin, branch, email, can_receive_dividends, dividend_fee_paid, salary, bonus, dividends) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [member_id, name, role, sub_role || null, hashedPin, branch || null, email || null, can_receive_dividends ? 1 : 0, dividend_fee_paid ? 1 : 0, salary || 0, bonus || 0, dividends || 0]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user (including dividend status)
app.put('/api/super/users/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, sub_role, branch, email, can_receive_dividends, dividend_fee_paid, salary, bonus, dividends } = req.body;
        await db.execute({
            sql: 'UPDATE users SET name = ?, role = ?, sub_role = ?, branch = ?, email = ?, can_receive_dividends = ?, dividend_fee_paid = ?, salary = ?, bonus = ?, dividends = ? WHERE id = ?',
            args: [name, role, sub_role, branch, email, can_receive_dividends ? 1 : 0, dividend_fee_paid ? 1 : 0, salary || 0, bonus || 0, dividends || 0, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user
app.delete('/api/super/users/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all payouts with member names
app.get('/api/super/payouts', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT p.*, u.name as member_name, u.member_id 
            FROM payouts p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add payout
app.post('/api/super/payouts', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { user_id, type, amount, month, year, status } = req.body;
        await db.execute({
            sql: 'INSERT INTO payouts (user_id, type, amount, month, year, status) VALUES (?, ?, ?, ?, ?, ?)',
            args: [user_id, type, amount, month, year, status || 'pending']
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update payout
app.put('/api/super/payouts/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, month, year, status } = req.body;
        await db.execute({
            sql: 'UPDATE payouts SET type = ?, amount = ?, month = ?, year = ?, status = ? WHERE id = ?',
            args: [type, amount, month, year, status, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete payout
app.delete('/api/super/payouts/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({
            sql: 'DELETE FROM payouts WHERE id = ?',
            args: [id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all revenue history
app.get('/api/super/revenue', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT r.*, u.name as submitter_name 
            FROM revenue r 
            LEFT JOIN users u ON r.submitted_by = u.id 
            ORDER BY r.submitted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Revenue
app.post('/api/super/revenue', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { amount, branch, month, year } = req.body;
        await db.execute({
            sql: 'INSERT INTO revenue (amount, branch, month, year, submitted_by) VALUES (?, ?, ?, ?, ?)',
            args: [amount, branch || 'System', month, year, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Withdrawal Requests APIs
app.get('/api/withdrawals', authenticate, async (req, res) => {
    try {
        const result = await db.execute({
            sql: `
                SELECT id, amount, method, details, status, created_at, reviewed_at, notification_message, notification_sent_at, updated_at
                FROM withdrawal_requests
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
            `,
            args: [req.user.id]
        });
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/withdrawals', authenticate, async (req, res) => {
    try {
        const { amount, method, details } = req.body;
        await db.execute({
            sql: 'INSERT INTO withdrawal_requests (user_id, amount, method, details) VALUES (?, ?, ?, ?)',
            args: [req.user.id, amount, method, details]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/financial/withdrawals', authenticate, isFinancialManager, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT wr.*, u.name as member_name, u.member_id
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            ORDER BY wr.created_at DESC, wr.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/financial/withdrawals/:id/status', authenticate, isFinancialManager, async (req, res) => {
    try {
        const { id } = req.params;
        const status = String(req.body.status || '').toLowerCase();
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be accepted or rejected' });
        }

        await db.execute({
            sql: `
                UPDATE withdrawal_requests
                SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [status, req.user.id, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/financial/withdrawals/:id/notify', authenticate, isFinancialManager, async (req, res) => {
    try {
        const { id } = req.params;
        const message = String(req.body.message || '').trim();
        if (!message) {
            return res.status(400).json({ error: 'Notification message is required' });
        }

        const requestResult = await db.execute({
            sql: 'SELECT status FROM withdrawal_requests WHERE id = ?',
            args: [id]
        });
        const requestRow = requestResult.rows[0];
        if (!requestRow) {
            return res.status(404).json({ error: 'Withdrawal request not found' });
        }

        const currentStatus = String(requestRow.status || '').toLowerCase();
        if (currentStatus !== 'accepted' && currentStatus !== 'paid') {
            return res.status(400).json({ error: 'Request must be accepted before sending payment notification' });
        }

        await db.execute({
            sql: `
                UPDATE withdrawal_requests
                SET status = 'paid',
                    notification_message = ?,
                    notification_sent_at = CURRENT_TIMESTAMP,
                    notification_sent_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [message, req.user.id, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/super/withdrawals', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT wr.*, u.name as member_name, u.member_id 
            FROM withdrawal_requests wr 
            JOIN users u ON wr.user_id = u.id 
            ORDER BY wr.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/super/withdrawals/:id', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const rawStatus = String(req.body.status || '').toLowerCase();
        const status = rawStatus === 'approved' ? 'accepted' : rawStatus;
        await db.execute({
            sql: 'UPDATE withdrawal_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [status, req.user.id, id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Low Revenue Mode
app.post('/api/super/toggle-lrm', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { value } = req.body; // 'true' or 'false'
        await db.execute({
            sql: 'UPDATE settings SET value = ? WHERE key = ?',
            args: [String(value), 'low_revenue_mode']
        });
        res.json({ success: true, lowRevenueMode: value === 'true' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CSV Export (Payouts)
app.get('/api/export/payouts', authenticate, async (req, res) => {
    try {
        let sql = 'SELECT p.month, p.year, p.type, p.amount, p.status, u.name, u.member_id FROM payouts p JOIN users u ON p.user_id = u.id';
        const args = [];

        if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
            sql += ' WHERE p.user_id = ?';
            args.push(req.user.id);
        }

        const result = await db.execute({ sql, args });
        const rows = result.rows;

        if (rows.length === 0) return res.status(404).send('No data to export');

        const headers = ['Month', 'Year', 'Type', 'Amount', 'Status', 'Name', 'MemberID'];
        const csvContent = [
            headers.join(','),
            ...rows.map(r => `${r.month},${r.year},${r.type},${r.amount},${r.status},"${r.name}",${r.member_id}`)
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payouts_export.csv');
        res.status(200).send(csvContent);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Submit Branch Revenue
app.post('/api/branch/report', authenticate, async (req, res) => {
    try {
        const { amount, month, year } = req.body;
        // Verify user is a branch member/manager
        const user = await db.execute({
            sql: 'SELECT branch, role FROM users WHERE id = ?',
            args: [req.user.id]
        });

        const branchName = user.rows[0].branch || 'Global';

        await db.execute({
            sql: 'INSERT INTO revenue (branch, amount, month, year, submitted_by) VALUES (?, ?, ?, ?, ?)',
            args: [branchName, amount, month, year, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const startServer = async () => {
    try {
        await ensureSchema();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Server startup failed:', err);
        process.exit(1);
    }
};

startServer();
