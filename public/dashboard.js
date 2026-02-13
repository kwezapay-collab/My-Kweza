// Initialize Lucide icons
lucide.createIcons();

let currentUser = null;
let myWithdrawals = [];
let financialWithdrawals = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isFinancialManagerRole = (role) => role === 'Financial Manager';

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWithdrawalStatus = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    return normalized === 'approved' ? 'accepted' : normalized;
};

const withdrawalStatusClass = (status) => {
    const normalized = normalizeWithdrawalStatus(status);
    if (normalized === 'paid') return 'status-paid';
    if (normalized === 'accepted') return 'status-accepted';
    if (normalized === 'rejected') return 'status-rejected';
    return 'status-pending';
};

const withdrawalStatusLabel = (status) => normalizeWithdrawalStatus(status);

const formatDateTime = (value) => {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '--';
    return new Date(parsed).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

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

        const requests = [fetchPayouts(), fetchWithdrawalRequests()];
        if (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') {
            requests.push(fetchAdminSummary());
        }
        if (isFinancialManagerRole(currentUser.role)) {
            requests.push(fetchFinancialWithdrawals());
        }

        await Promise.all(requests);
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
        document.querySelector('.unified-stats-card').style.display = 'none';
        document.querySelector('.main-content section h2').innerText = 'Global Payout Activity';
        document.getElementById('welcomeText').innerText = `System Overview: ${currentUser.name}`;
    }

    if (currentUser.role === 'Branch Member' || currentUser.role === 'Branch Manager') {
        document.getElementById('branchPanel').style.display = 'block';
        document.getElementById('branchName').innerText = currentUser.branch || 'Assigned Branch';
    }

    const financialPanel = document.getElementById('financialManagerPanel');
    if (financialPanel) {
        financialPanel.style.display = isFinancialManagerRole(currentUser.role) ? 'block' : 'none';
    }

    const withdrawalsHint = document.getElementById('myWithdrawalsHint');
    if (withdrawalsHint && isFinancialManagerRole(currentUser.role)) {
        withdrawalsHint.innerText = 'Track your own requests and payout notifications while managing the full queue below.';
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
        showMoreWrap.style.display = 'block';
    }

    if (recentPayouts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
    }

    recentPayouts.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${p.month} ${p.year}</td>
            <td style="text-transform: capitalize;">${p.type}</td>
            <td>MWK ${Number(p.amount || 0).toLocaleString()}</td>
            <td><span class="status-pill status-${p.status}">${p.status}</span></td>
        `;
        tableBody.appendChild(row);
    });

    // Update stats cards from user record
    const salary = Number(currentUser.salary || 0);
    const bonus = Number(currentUser.bonus || 0);
    const dividends = Number(currentUser.dividends || 0);

    document.getElementById('salaryVal').innerText = salary.toLocaleString();
    document.getElementById('bonusVal').innerText = bonus.toLocaleString();
    document.getElementById('dividendVal').innerText = dividends.toLocaleString();
    document.getElementById('totalVal').innerText = (salary + bonus + dividends).toLocaleString();

    // LRM Warning for members
    if (window.isLRMActive && (bonus > 0 || dividends > 0) && !document.getElementById('lrmWarningCard')) {
        const warning = document.createElement('div');
        warning.id = 'lrmWarningCard';
        warning.className = 'glass-card animate-fade';
        warning.style.borderColor = 'var(--gold)';
        warning.style.marginBottom = '1.5rem';
        warning.innerHTML = `<p style="color: var(--gold); font-size: 0.85rem;"><i data-lucide="info" style="width: 14px; vertical-align: middle; margin-right: 8px;"></i> System currently in Low Revenue Mode. Bonuses and Dividends may experience processing delays.</p>`;
        document.querySelector('.main-content').insertBefore(warning, document.querySelector('.unified-stats-card'));
        lucide.createIcons();
    }
}

async function fetchWithdrawalRequests() {
    const tableBody = document.getElementById('myWithdrawalsTable');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/withdrawals');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load withdrawal requests</td></tr>';
            return;
        }

        const rows = await res.json();
        myWithdrawals = Array.isArray(rows) ? rows : [];
        renderMyWithdrawals();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load withdrawal requests</td></tr>';
    }
}

function renderMyWithdrawals() {
    const tableBody = document.getElementById('myWithdrawalsTable');
    const showMoreWrap = document.getElementById('showMoreMyWithdrawalsWrap');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }

    if (!myWithdrawals.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests submitted yet</td></tr>';
        return;
    }

    const recentWithdrawals = myWithdrawals.slice(0, 2);

    recentWithdrawals.forEach((w) => {
        const status = normalizeWithdrawalStatus(w.status);
        const managerUpdate = w.notification_message
            ? escapeHtml(w.notification_message)
            : (status === 'accepted'
                ? 'Accepted. Awaiting transfer notification.'
                : (status === 'paid'
                    ? 'Payment sent.'
                    : (status === 'rejected' ? 'Request was rejected.' : 'Awaiting review.')));

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${formatDateTime(w.created_at)}</td>
            <td style="font-weight: 600;">MWK ${Number(w.amount || 0).toLocaleString()}</td>
            <td>
                <div style="font-weight: 500;">${escapeHtml(w.method || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.details || '--')}</div>
            </td>
            <td><span class="status-pill ${withdrawalStatusClass(status)}">${withdrawalStatusLabel(status)}</span></td>
            <td style="max-width: 320px; color: var(--text-muted); font-size: 0.85rem;">${managerUpdate}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchFinancialWithdrawals() {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    const tableBody = document.getElementById('financialWithdrawalsTable');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/financial/withdrawals');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
            return;
        }

        const rows = await res.json();
        financialWithdrawals = Array.isArray(rows) ? rows : [];
        renderFinancialWithdrawals();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
    }
}

function renderFinancialWithdrawals() {
    const tableBody = document.getElementById('financialWithdrawalsTable');
    const showMoreWrap = document.getElementById('showMoreFinancialWithdrawalsWrap');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }
    const pendingCount = financialWithdrawals.filter((w) => normalizeWithdrawalStatus(w.status) === 'pending').length;
    const pendingLabel = document.getElementById('financialPendingCount');
    if (pendingLabel) {
        pendingLabel.innerText = `Pending: ${pendingCount}`;
    }

    if (!financialWithdrawals.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests in queue</td></tr>';
        return;
    }

    const recentFinancialWithdrawals = financialWithdrawals.slice(0, 2);

    recentFinancialWithdrawals.forEach((w) => {
        const status = normalizeWithdrawalStatus(w.status);
        const noteInputId = `financeNote-${w.id}`;
        const defaultMessage = `Your withdrawal request of MWK ${Number(w.amount || 0).toLocaleString()} has been paid.`;

        let actionMarkup = '<span style="color: var(--text-muted); font-size: 0.8rem;">---</span>';
        if (status === 'pending') {
            actionMarkup = `
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="updateFinancialWithdrawalStatus(${w.id}, 'accepted')">Accept</button>
                    <button class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="updateFinancialWithdrawalStatus(${w.id}, 'rejected')">Reject</button>
                </div>
            `;
        } else if (status === 'accepted') {
            actionMarkup = `
                <div style="display: grid; gap: 0.6rem; min-width: 260px;">
                    <textarea id="${noteInputId}" placeholder="Payment notification message" style="width: 100%; min-height: 80px; resize: vertical; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); padding: 10px; border-radius: 10px; color: white; font-size: 0.85rem;">${escapeHtml(defaultMessage)}</textarea>
                    <button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="sendFinancialWithdrawalNotification(${w.id})">Mark Paid + Notify</button>
                </div>
            `;
        } else if (status === 'paid') {
            const sentTime = w.notification_sent_at ? formatDateTime(w.notification_sent_at) : '--';
            actionMarkup = `<span style="color: var(--accent); font-size: 0.8rem;">Notification sent: ${sentTime}</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${escapeHtml(w.member_name || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.member_id || '--')}</div>
            </td>
            <td style="font-weight: 600;">MWK ${Number(w.amount || 0).toLocaleString()}</td>
            <td>
                <div style="font-weight: 500;">${escapeHtml(w.method || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.details || '--')}</div>
            </td>
            <td><span class="status-pill ${withdrawalStatusClass(status)}">${withdrawalStatusLabel(status)}</span></td>
            <td>${actionMarkup}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function updateFinancialWithdrawalStatus(id, status) {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    try {
        const res = await apiFetch(`/api/financial/withdrawals/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            await Promise.all([fetchFinancialWithdrawals(), fetchWithdrawalRequests()]);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to update withdrawal request.');
        }
    } catch (err) {
        console.error('Withdrawal status update error:', err);
    }
}

async function sendFinancialWithdrawalNotification(id) {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    const input = document.getElementById(`financeNote-${id}`);
    const message = String(input?.value || '').trim();
    if (!message) {
        alert('Please enter a notification message before sending.');
        return;
    }

    try {
        const res = await apiFetch(`/api/financial/withdrawals/${id}/notify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (res.ok) {
            alert('Notification sent to requester.');
            await Promise.all([fetchFinancialWithdrawals(), fetchWithdrawalRequests()]);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to send notification.');
        }
    } catch (err) {
        console.error('Withdrawal notification error:', err);
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
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
            await fetchWithdrawalRequests();
            if (isFinancialManagerRole(currentUser?.role)) {
                await fetchFinancialWithdrawals();
            }
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

window.updateFinancialWithdrawalStatus = updateFinancialWithdrawalStatus;
window.sendFinancialWithdrawalNotification = sendFinancialWithdrawalNotification;

// Load on start
loadDashboard();
