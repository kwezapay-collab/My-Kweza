lucide.createIcons();

let currentUser = null;
let dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const getMenuBackUrl = (fallbackPath = '/dashboard.html') => fallbackPath;

function updateHeader() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
}

function renderPayouts(payouts) {
    const tableBody = document.getElementById('historyPayoutsTable');
    const historyCount = document.getElementById('historyCount');
    tableBody.innerHTML = '';

    if (!payouts.length) {
        historyCount.innerText = 'No payout records yet.';
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
        return;
    }

    historyCount.innerText = `${payouts.length} payout record${payouts.length === 1 ? '' : 's'} found`;

    payouts.forEach((p) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${p.month} ${p.year}</td>
            <td style="text-transform: capitalize;">${p.type}</td>
            <td>MWK ${Number(p.amount || 0).toLocaleString()}</td>
            <td><span class="status-pill status-${p.status}">${p.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadPayoutHistory() {
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

        const payoutRes = await apiFetch('/api/payouts');
        if (!payoutRes.ok) {
            document.getElementById('historyCount').innerText = 'Unable to load payout history.';
            return;
        }

        const payouts = await payoutRes.json();
        const sortedPayouts = Array.isArray(payouts)
            ? [...payouts].sort((a, b) => (b.id || 0) - (a.id || 0))
            : [];

        renderPayouts(sortedPayouts);
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = getMenuBackUrl(dashboardPath);
});

document.getElementById('exportCSVBtn').addEventListener('click', () => {
    window.location.href = '/api/export/payouts';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadPayoutHistory();
