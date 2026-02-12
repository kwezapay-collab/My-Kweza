const { db, initDb } = require('./db');
const bcrypt = require('bcryptjs');

const seedData = async () => {
    console.log('Initializing database...');
    await initDb();

    const defaultPin = await bcrypt.hash('1234', 10);

    const members = [
        // Founders
        { mid: 'FON-2025-001', name: 'Felix O. Phiri', role: 'Founder', srole: 'CEO / Core Founder' },
        { mid: 'FON-2025-002', name: 'Future I. Cherani', role: 'Admin', srole: 'Head of Finance / Co-Founder' },
        { mid: 'FON-2025-003', name: 'Rodrick Mchochoma', role: 'Founder', srole: 'Marketing Officer' },

        // Members
        { mid: 'MEM-2025-001', name: 'Jessie Chumbu', role: 'Member', srole: 'Secretary' },
        { mid: 'MEM-2025-002', name: 'Yamikani Chimenya', role: 'Member', srole: 'Logistics & Strategic Officer' },
        { mid: 'MEM-2025-003', name: 'Alice Magombo', role: 'Member', srole: 'PR Manager' },
        { mid: 'MEM-2025-004', name: 'Edwin Msilimba', role: 'Member', srole: 'ICT Officer I' },
        { mid: 'MEM-2025-005', name: 'Bridget F. Chinyanga', role: 'Member', srole: 'Compliance Manager' },
        { mid: 'MEM-2025-006', name: 'William Nkhono', role: 'Member', srole: 'Loan Officer' },
        { mid: 'MEM-2025-007', name: 'Jabulani B. Mayenda', role: 'Member', srole: 'ICT Officer II' },
        { mid: 'MEM-2025-008', name: 'Francis Ndeule', role: 'Member', srole: 'Repayment Officer' },

        // Core Team
        { mid: 'CTM-2025-001', name: 'Isha Shaibu', role: 'Core Team', srole: 'Project Manager' },
        { mid: 'CTM-2025-002', name: 'Blessings Shia Phiri', role: 'Core Team', srole: 'ICT Officer III' },
        { mid: 'CTM-2026-001', name: 'Ellen Nyilenda', role: 'Core Team', srole: 'Sales Manager' },
        { mid: 'CTM-2026-002', name: 'Antony Phiri', role: 'Core Team', srole: 'ICT Officer IV' },
        { mid: 'CTM-2026-003', name: 'Jane Alex', role: 'Core Team', srole: 'ICT Officer V' },

        // Branch
        { mid: 'BM-LW-2026-001', name: 'Matthews Kalombozi', role: 'Branch Manager', srole: 'Branch Manager', branch: 'Lilongwe' },

        // Test Accounts
        { mid: '1000', name: 'Test Admin', role: 'Admin', srole: 'Testing Admin' },
        { mid: '2000', name: 'Test Branch', role: 'Branch Manager', srole: 'Testing Branch Manager', branch: 'Test Branch' },
        { mid: '3000', name: 'Test Core Team', role: 'Core Team', srole: 'Testing Core Team' },
        { mid: '4000', name: 'Test Founder', role: 'Founder', srole: 'Testing Founder' },

        // Dev Operations Assistant (Support)
        { mid: '5000', name: 'Dev Operations Assistant', role: 'Dev Operations Assistant', srole: 'System Support & Complaints Desk' },

        // Super Admin (Distinct Entity)
        { mid: 'SAM-2026-0-0', name: 'System Administrator', role: 'Super Admin', srole: 'System Oversight' }
    ];

    console.log('Seeding members...');
    for (const m of members) {
        let pin = defaultPin;
        if (m.mid === 'SAM-2026-0-0') {
            pin = await bcrypt.hash('1234', 10);
        }
        await db.execute({
            sql: `INSERT OR IGNORE INTO users (member_id, name, role, sub_role, pin, branch) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [m.mid, m.name, m.role, m.srole, pin, m.branch || 'Headquarters']
        });
    }

    console.log('Database seeded successfully!');
    process.exit(0);
};

seedData().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
