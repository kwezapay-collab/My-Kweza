// Initialize Lucide icons
lucide.createIcons();

let currentUser = null;
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

async function loadDashboard() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await res.json();

        if (currentUser.role === 'Super Admin') {
            window.location.href = '/super-admin.html';
            return;
        }
        if (currentUser.role === 'Dev Operations Assistant') {
            window.location.href = '/dev-operations.html';
            return;
        }

        updateUI();
        fetchPayouts();
        if (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') {
            fetchAdminSummary();
        }
    } catch (err) {
        window.location.href = '/';
    }
}

function updateUI() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
    document.getElementById('welcomeText').innerText = `Welcome back, ${currentUser.name.split(' ')[0]}`;
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Role-based visibility
    if (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') {
        document.getElementById('adminOverview').style.display = 'block';
    }

    if (currentUser.role === 'Super Admin') {
        document.getElementById('superAdminBtn').style.display = 'flex';
        // Hide personal stats for system overseer
        document.querySelector('.unified-stats-card').style.display = 'none';
        document.querySelector('.main-content section h2').innerText = 'Global Payout Activity';
        // Optionally update welcome text to reflect system status
        document.getElementById('welcomeText').innerText = `System Overview: ${currentUser.name}`;
    }

    if (currentUser.role === 'Branch Member' || currentUser.role === 'Branch Manager') {
        document.getElementById('branchPanel').style.display = 'block';
        document.getElementById('branchName').innerText = currentUser.branch || 'Assigned Branch';
    }
}

async function fetchPayouts() {
    const res = await apiFetch('/api/payouts');
    const payouts = await res.json();
    const sortedPayouts = Array.isArray(payouts)
        ? [...payouts].sort((a, b) => (b.id || 0) - (a.id || 0))
        : [];
    const recentPayouts = sortedPayouts.slice(0, 2);
    const tableBody = document.getElementById('payoutsTable');
    const showMoreWrap = document.getElementById('showMorePayoutsWrap');
    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = sortedPayouts.length > 2 ? 'block' : 'none';
    }

    if (recentPayouts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
    }

    recentPayouts.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${p.month} ${p.year}</td>
            <td style="text-transform: capitalize;">${p.type}</td>
            <td>MWK ${p.amount.toLocaleString()}</td>
            <td><span class="status-pill status-${p.status}">${p.status}</span></td>
        `;
        tableBody.appendChild(row);
    });

    // Update stats cards from user record
    const salary = currentUser.salary || 0;
    const bonus = currentUser.bonus || 0;
    const dividends = currentUser.dividends || 0;

    document.getElementById('salaryVal').innerText = salary.toLocaleString();
    document.getElementById('bonusVal').innerText = bonus.toLocaleString();
    document.getElementById('dividendVal').innerText = dividends.toLocaleString();
    document.getElementById('totalVal').innerText = (salary + bonus + dividends).toLocaleString();

    // LRM Warning for members
    if (window.isLRMActive && (bonus > 0 || dividends > 0)) {
        const warning = document.createElement('div');
        warning.className = 'glass-card animate-fade';
        warning.style.borderColor = 'var(--gold)';
        warning.style.marginBottom = '1.5rem';
        warning.innerHTML = `<p style="color: var(--gold); font-size: 0.85rem;"><i data-lucide="info" style="width: 14px; vertical-align: middle; margin-right: 8px;"></i> System currently in Low Revenue Mode. Bonuses and Dividends may experience processing delays.</p>`;
        document.querySelector('.main-content').insertBefore(warning, document.querySelector('.unified-stats-card'));
        lucide.createIcons();
    }
}

async function fetchAdminSummary() {
    const res = await apiFetch('/api/admin/summary');
    const data = await res.json();

    document.getElementById('adminTotalRev').innerText = data.totalRevenue.toLocaleString();
    document.getElementById('adminTotalPay').innerText = data.totalPayouts.toLocaleString();
    document.getElementById('adminRemaining').innerText = data.remainingFunds.toLocaleString();

    const lrmIcon = document.getElementById('lrmIcon');
    if (data.lowRevenueMode) {
        lrmIcon.setAttribute('data-lucide', 'shield-check');
        lrmIcon.style.color = 'var(--gold)';
        window.isLRMActive = true;
    } else {
        lrmIcon.setAttribute('data-lucide', 'shield-off');
        lrmIcon.style.color = 'var(--text-muted)';
        window.isLRMActive = false;
    }
    lucide.createIcons();
}

// Event Listeners
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

document.getElementById('exportCSVBtn')?.addEventListener('click', () => {
    window.location.href = '/api/export/payouts';
});

document.getElementById('submitBranchReport')?.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('revenueInput').value);
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid collection amount.');

    const date = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    try {
        const res = await apiFetch('/api/branch/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                month: months[date.getMonth()],
                year: String(date.getFullYear())
            })
        });

        if (res.ok) {
            alert('Official revenue report submitted successfully!');
            document.getElementById('revenueInput').value = '';
        } else {
            alert('Failed to submit report.');
        }
    } catch (err) {
        console.error('Report error:', err);
    }
});

document.getElementById('withdrawalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const details = document.getElementById('withdrawDetails').value;

    if (isNaN(amount) || amount <= 0) return alert('Enter a valid amount');

    try {
        const res = await apiFetch('/api/withdrawals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method, details })
        });

        if (res.ok) {
            alert('Withdrawal request submitted for approval.');
            document.getElementById('withdrawalForm').reset();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to submit request');
        }
    } catch (err) {
        console.error('Withdrawal error:', err);
    }
});

document.getElementById('complaintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('complaintSubject').value.trim();
    const message = document.getElementById('complaintMessage').value.trim();
    if (!message) return alert('Please enter complaint details.');

    try {
        const res = await apiFetch('/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message })
        });

        if (res.ok) {
            alert('Complaint sent to Dev Operations Assistant.');
            document.getElementById('complaintForm').reset();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to send complaint.');
        }
    } catch (err) {
        console.error('Complaint error:', err);
    }
});

// Load on start
loadDashboard();
