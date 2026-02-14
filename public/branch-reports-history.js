lucide.createIcons();

let currentUser = null;
let allBranchReports = [];
const dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isFounderRole = (role) => role === 'Founder';

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '--';
    return new Date(parsed).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function splitBulletList(value) {
    return String(value || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function renderBullets(value) {
    const items = splitBulletList(value);
    if (!items.length) return '<span style="color: var(--text-muted);">--</span>';
    return items.map((item) => `<div style="margin-bottom: 0.3rem;">&bull; ${escapeHtml(item)}</div>`).join('');
}

function updateHeader() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
}

function filteredReports() {
    const query = String(document.getElementById('reportSearch')?.value || '').trim().toLowerCase();
    const fromDate = String(document.getElementById('fromDate')?.value || '').trim();
    const toDate = String(document.getElementById('toDate')?.value || '').trim();

    return allBranchReports.filter((report) => {
        const branch = String(report.branch || '').toLowerCase();
        const manager = String(report.submitted_by_name || report.current_manager_name || '').toLowerCase();
        const title = String(report.report_title || '').toLowerCase();
        const reportDate = String(report.report_date || '').slice(0, 10);

        const matchesQuery = !query
            || branch.includes(query)
            || manager.includes(query)
            || title.includes(query);
        const matchesFrom = !fromDate || (reportDate && reportDate >= fromDate);
        const matchesTo = !toDate || (reportDate && reportDate <= toDate);

        return matchesQuery && matchesFrom && matchesTo;
    });
}

function renderBranchReports() {
    const tableBody = document.getElementById('branchReportsHistoryTable');
    const historyCount = document.getElementById('historyCount');
    const rows = filteredReports();
    tableBody.innerHTML = '';

    historyCount.innerText = `${rows.length} report${rows.length === 1 ? '' : 's'} found`;

    if (!rows.length) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">No branch revenue reports found</td></tr>';
        return;
    }

    rows.forEach((report) => {
        const managerName = escapeHtml(report.submitted_by_name || report.current_manager_name || '--');
        const memberId = escapeHtml(report.submitted_by_member_id || report.current_manager_member_id || '--');
        const collection = Number(report.total_collection || 0).toLocaleString();

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0; white-space: nowrap;">${formatDate(report.report_date)}</td>
            <td style="font-weight: 600; min-width: 120px;">${escapeHtml(report.branch || '--')}</td>
            <td>
                <div style="font-weight: 600;">${managerName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${memberId}</div>
            </td>
            <td style="min-width: 170px; font-weight: 600;">${escapeHtml(report.report_title || '--')}</td>
            <td style="white-space: nowrap; font-weight: 600;">MWK ${collection}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${renderBullets(report.highlights)}</td>
            <td style="min-width: 300px; color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(report.detailed_report || '--')}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${renderBullets(report.challenges)}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(report.support_needed || '--')}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchBranchReports() {
    const res = await apiFetch('/api/founder/branch-reports');
    if (!res.ok) {
        document.getElementById('historyCount').innerText = 'Unable to load branch reports.';
        return;
    }

    const reports = await res.json();
    allBranchReports = Array.isArray(reports)
        ? [...reports].sort((a, b) => {
            const parsedTimeA = Date.parse(a.report_date || '');
            const parsedTimeB = Date.parse(b.report_date || '');
            const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
            const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || 0) - (a.id || 0);
        })
        : [];

    renderBranchReports();
}

async function loadBranchReportsHistory() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await meRes.json();

        if (!isFounderRole(currentUser.role)) {
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
        await fetchBranchReports();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('reportSearch')?.addEventListener('input', renderBranchReports);
document.getElementById('fromDate')?.addEventListener('change', renderBranchReports);
document.getElementById('toDate')?.addEventListener('change', renderBranchReports);

document.getElementById('backToDashboardBtn')?.addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadBranchReportsHistory();
