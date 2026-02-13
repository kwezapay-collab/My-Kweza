lucide.createIcons();

let currentUser = null;
let dashboardPath = '/dashboard.html';
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

function renderWithdrawals(withdrawals) {
    const tableBody = document.getElementById('historyWithdrawalsTable');
    const historyCount = document.getElementById('historyCount');
    tableBody.innerHTML = '';

    if (!withdrawals.length) {
        historyCount.innerText = 'No withdrawal requests yet.';
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
        return;
    }

    historyCount.innerText = `${withdrawals.length} withdrawal request${withdrawals.length === 1 ? '' : 's'} found`;

    withdrawals.forEach((w) => {
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

async function loadWithdrawalHistory() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await meRes.json();

        if (currentUser.role === 'Super Admin') {
            window.location.href = '/super-admin.html';
            return;
        }
        if (currentUser.role === 'Dev Operations Assistant') {
            dashboardPath = '/dev-operations.html';
        }

        const dashboardBtn = document.getElementById('dashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.onclick = () => {
                window.location.href = dashboardPath;
            };
        }

        updateHeader();

        const withdrawalsRes = await apiFetch('/api/withdrawals');
        if (!withdrawalsRes.ok) {
            document.getElementById('historyCount').innerText = 'Unable to load withdrawal history.';
            return;
        }

        const withdrawals = await withdrawalsRes.json();
        const sortedWithdrawals = Array.isArray(withdrawals)
            ? [...withdrawals].sort((a, b) => {
                const parsedTimeA = Date.parse(a.created_at || '');
                const parsedTimeB = Date.parse(b.created_at || '');
                const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
                const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
                if (timeA !== timeB) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            })
            : [];
        renderWithdrawals(sortedWithdrawals);
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

loadWithdrawalHistory();
