lucide.createIcons();

let currentUser = null;
let allWeeklyReports = [];
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

function formatDateTime(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '--';
    return new Date(parsed).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
    const approvalFilter = String(document.getElementById('approvalFilter')?.value || 'all');

    return allWeeklyReports.filter((report) => {
        const developerName = String(report.developer_name || report.current_developer_name || '').toLowerCase();
        const memberId = String(report.developer_member_id || report.current_developer_member_id || '').toLowerCase();
        const projectName = String(report.project_name || '').toLowerCase();
        const reportDate = String(report.report_date || '').slice(0, 10);
        const reviewedBy = String(report.reviewed_by || '').trim();

        const matchesQuery = !query
            || developerName.includes(query)
            || memberId.includes(query)
            || projectName.includes(query);
        const matchesFrom = !fromDate || (reportDate && reportDate >= fromDate);
        const matchesTo = !toDate || (reportDate && reportDate <= toDate);
        const matchesApproval = approvalFilter === 'all'
            || (approvalFilter === 'reviewed' && reviewedBy)
            || (approvalFilter === 'pending' && !reviewedBy);

        return matchesQuery && matchesFrom && matchesTo && matchesApproval;
    });
}

function renderWeeklyReports() {
    const tableBody = document.getElementById('founderWeeklyReportsHistoryTable');
    const historyCount = document.getElementById('historyCount');
    const rows = filteredReports();
    tableBody.innerHTML = '';

    historyCount.innerText = `${rows.length} report${rows.length === 1 ? '' : 's'} found`;

    if (!rows.length) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">No weekly reports found</td></tr>';
        return;
    }

    rows.forEach((report) => {
        const developerName = escapeHtml(report.developer_name || report.current_developer_name || '--');
        const memberId = escapeHtml(report.developer_member_id || report.current_developer_member_id || '--');
        const reviewedBy = String(report.reviewed_by || '').trim();
        const approvalDate = report.approval_date ? formatDate(report.approval_date) : '--';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0; white-space: nowrap;">${formatDate(report.report_date)}</td>
            <td>
                <div style="font-weight: 600;">${developerName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${memberId}</div>
            </td>
            <td style="font-weight: 600; min-width: 150px;">${escapeHtml(report.project_name || '--')}</td>
            <td style="white-space: nowrap;">${formatDateTime(report.date_time_started)}</td>
            <td style="white-space: nowrap;">${formatDate(report.target_completion_date)}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${renderBullets(report.work_completed)}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${renderBullets(report.challenges_blockers)}</td>
            <td style="min-width: 220px; color: var(--text-muted); font-size: 0.85rem;">${renderBullets(report.plan_next_week)}</td>
            <td style="white-space: nowrap;">
                <div style="font-weight: 600;">${escapeHtml(reviewedBy || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${approvalDate}</div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchWeeklyReports() {
    const res = await apiFetch('/api/founder/weekly-reports');
    if (!res.ok) {
        document.getElementById('historyCount').innerText = 'Unable to load weekly reports.';
        return;
    }

    const reports = await res.json();
    allWeeklyReports = Array.isArray(reports)
        ? [...reports].sort((a, b) => {
            const parsedTimeA = Date.parse(a.report_date || '');
            const parsedTimeB = Date.parse(b.report_date || '');
            const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
            const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || 0) - (a.id || 0);
        })
        : [];

    renderWeeklyReports();
}

async function loadFounderWeeklyReportsHistory() {
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
        await fetchWeeklyReports();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('reportSearch')?.addEventListener('input', renderWeeklyReports);
document.getElementById('fromDate')?.addEventListener('change', renderWeeklyReports);
document.getElementById('toDate')?.addEventListener('change', renderWeeklyReports);
document.getElementById('approvalFilter')?.addEventListener('change', renderWeeklyReports);

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

loadFounderWeeklyReportsHistory();
