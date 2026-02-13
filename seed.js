const { db, initDb } = require('./db');
const bcrypt = require('bcryptjs');

const productionMembers = [
    { member_id: 'FON-2025-001', name: 'Felix O. Phiri', role: 'Founder', sub_role: 'Chief Executive Officer (CEO) / Core Founder' },
    { member_id: 'FON-2025-002', name: 'Future I. Cherani', role: 'Financial Manager', sub_role: 'Head of Finance / Co-Founder' },
    { member_id: 'FON-2025-003', name: 'Rodrick Mchochoma', role: 'Admin', sub_role: 'Marketing Officer' },

    { member_id: 'MEM-2025-001', name: 'Jessie Chumbu', role: 'Core Team', sub_role: 'Secretary' },
    { member_id: 'MEM-2025-002', name: 'Yamikani Chimenya', role: 'Core Team', sub_role: 'Logistics Officer' },
    { member_id: 'MEM-2025-003', name: 'Alice Magombo', role: 'Core Team', sub_role: 'Marketing Support' },
    { member_id: 'MEM-2025-004', name: 'Edwin Msilimba', role: 'Admin', sub_role: 'ICT Officer I' },
    { member_id: 'MEM-2025-005', name: 'Bridget F. Chinyanga', role: 'Financial Manager', sub_role: 'Compliance Officer' },
    { member_id: 'MEM-2025-006', name: 'William Nkhono', role: 'Core Team', sub_role: 'Loan Officer' },
    { member_id: 'MEM-2025-007', name: 'Jabulani B. Mayenda', role: 'Core Team', sub_role: 'ICT Officer II' },
    { member_id: 'MEM-2025-008', name: 'Francis Ndeule', role: 'Core Team', sub_role: 'Repayment Officer' },

    { member_id: 'CTM-2025-001', name: 'Isha Shaibu', role: 'Core Team', sub_role: 'Role Rotation' },
    { member_id: 'CTM-2025-002', name: 'Blessings Shia Phiri', role: 'Admin', sub_role: 'ICT Officer III - Front-End Developer' },
    { member_id: 'CTM-2026-001', name: 'Ellen Nyilenda', role: 'Core Team', sub_role: 'Sales Manager / Marketing Assistant' },
    { member_id: 'CTM-2026-002', name: 'Antony Phiri', role: 'Core Team', sub_role: 'ICT Officer IV - Back-End Developer' },
    { member_id: 'CTM-2026-003', name: 'Jane Alex', role: 'Core Team', sub_role: 'ICT Officer V - Front-End Developer' },
    { member_id: 'CTM-2026-005', name: 'Takondwa Zephania', role: 'Dev Operations Assistant', sub_role: 'Development Operations Assistant' },

    { member_id: 'BM-2026-001', name: 'Matthews Kalombozi', role: 'Branch Manager', sub_role: 'Branch Manager', branch: 'Lilongwe' },

    { member_id: 'BSLW-2026-001', name: 'Benson Mussa', role: 'Branch Member', sub_role: 'Loan Officer', branch: 'Lilongwe' },
    { member_id: 'BSLW-2026-002', name: 'Bernard Mussa', role: 'Branch Member', sub_role: 'Recovery Officer', branch: 'Lilongwe' },
    { member_id: 'BSLW-2026-003', name: 'Tayamika Msambati', role: 'Branch Member', sub_role: 'Finance Clerk', branch: 'Lilongwe' },
    { member_id: 'BSLW-2026-004', name: 'George Gunde', role: 'Branch Member', sub_role: 'Marketing Officer', branch: 'Lilongwe' }
];

const resetForProduction = async () => {
    console.log('Initializing database schema...');
    await initDb();

    console.log('Clearing transactional data and existing users...');
    await db.execute('TRUNCATE TABLE weekly_reports RESTART IDENTITY CASCADE');
    await db.execute('TRUNCATE TABLE complaints RESTART IDENTITY CASCADE');
    await db.execute('TRUNCATE TABLE revenue RESTART IDENTITY CASCADE');
    await db.execute('TRUNCATE TABLE withdrawal_requests RESTART IDENTITY CASCADE');
    await db.execute('TRUNCATE TABLE payouts RESTART IDENTITY CASCADE');
    await db.execute('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    const defaultPinHash = await bcrypt.hash('1234', 10);

    console.log('Inserting production members...');
    for (const member of productionMembers) {
        await db.execute({
            sql: `
                INSERT INTO users (member_id, name, role, sub_role, pin, branch, theme_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                member.member_id,
                member.name,
                member.role,
                member.sub_role || null,
                defaultPinHash,
                member.branch || 'Headquarters',
                'dark'
            ]
        });
    }

    const result = await db.execute('SELECT COUNT(*)::int AS total FROM users');
    console.log(`Production reset complete. Active users: ${result.rows[0].total}`);
    process.exit(0);
};

resetForProduction().catch((err) => {
    console.error('Production reset failed:', err);
    process.exit(1);
});
