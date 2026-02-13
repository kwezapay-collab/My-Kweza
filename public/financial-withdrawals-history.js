lucide.createIcons();

let currentUser = null;
let financialWithdrawals = [];
const dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const getMenuBackUrl = (fallbackPath = '/dashboard.html') => `${fallbackPath}#menu`;

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

function updateHeader() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
}

function renderFinancialWithdrawals() {
    const tableBody = document.getElementById('historyFinancialWithdrawalsTable');
    const historyCount = document.getElementById('historyCount');
    const pendingCount = financialWithdrawals.filter((w) => normalizeWithdrawalStatus(w.status) === 'pending').length;

    tableBody.innerHTML = '';
    historyCount.innerText = `${financialWithdrawals.length} queue item${financialWithdrawals.length === 1 ? '' : 's'} found`;
    document.getElementById('financialPendingCount').innerText = `Pending: ${pendingCount}`;

    if (!financialWithdrawals.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests in queue</td></tr>';
        return;
    }

    financialWithdrawals.forEach((w) => {
        const status = normalizeWithdrawalStatus(w.status);
        const noteInputId = `financeHistoryNote-${w.id}`;
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

async function fetchFinancialWithdrawals() {
    const tableBody = document.getElementById('historyFinancialWithdrawalsTable');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/financial/withdrawals');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
            document.getElementById('historyCount').innerText = 'Unable to load queue history.';
            return;
        }

        const rows = await res.json();
        financialWithdrawals = Array.isArray(rows)
            ? [...rows].sort((a, b) => {
                const parsedTimeA = Date.parse(a.created_at || '');
                const parsedTimeB = Date.parse(b.created_at || '');
                const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
                const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
                if (timeA !== timeB) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            })
            : [];
        renderFinancialWithdrawals();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
        document.getElementById('historyCount').innerText = 'Unable to load queue history.';
    }
}

async function updateFinancialWithdrawalStatus(id, status) {
    try {
        const res = await apiFetch(`/api/financial/withdrawals/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            await fetchFinancialWithdrawals();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to update withdrawal request.');
        }
    } catch (err) {
        console.error('Withdrawal status update error:', err);
    }
}

async function sendFinancialWithdrawalNotification(id) {
    const input = document.getElementById(`financeHistoryNote-${id}`);
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
            await fetchFinancialWithdrawals();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to send notification.');
        }
    } catch (err) {
        console.error('Withdrawal notification error:', err);
    }
}

async function loadFinancialQueueHistory() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await meRes.json();

        if (currentUser.role !== 'Financial Manager') {
            if (currentUser.role === 'Super Admin') {
                window.location.href = '/super-admin.html';
            } else if (currentUser.role === 'Dev Operations Assistant') {
                window.location.href = '/dev-operations.html';
            } else {
                window.location.href = '/dashboard.html';
            }
            return;
        }

        updateHeader();
        await fetchFinancialWithdrawals();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = getMenuBackUrl(dashboardPath);
});

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

window.updateFinancialWithdrawalStatus = updateFinancialWithdrawalStatus;
window.sendFinancialWithdrawalNotification = sendFinancialWithdrawalNotification;

loadFinancialQueueHistory();
