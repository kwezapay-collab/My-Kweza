lucide.createIcons();

let currentUser = null;
let dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const getMenuBackUrl = (fallbackPath = '/dashboard.html') => fallbackPath;

function applyRoleTheme() {
    if (!document.body) return;
    const isDevOps = currentUser?.role === 'Dev Operations Assistant';
    document.body.dataset.useDevopsTheme = isDevOps ? '1' : '0';
    if (!isDevOps) {
        document.body.classList.remove('devops-purple-theme');
        return;
    }

    const activeTheme = window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark';
    document.body.classList.toggle('devops-purple-theme', activeTheme !== 'light');
}

function updateHeader() {
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = currentUser.name;
    const userRoleEl = document.getElementById('userRole'); if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;
    const memberIdEl = document.getElementById('memberId'); if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;
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
        applyRoleTheme();
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

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadPayoutHistory();
