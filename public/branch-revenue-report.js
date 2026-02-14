lucide.createIcons();

let currentUser = null;
const dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function updateHeader() {
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = currentUser.name;
    const userRoleEl = document.getElementById('userRole'); if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;
    const memberIdEl = document.getElementById('memberId'); if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;
}

function resetFormDefaults() {
    const branch = String(currentUser?.branch || 'Assigned Branch').trim();
    document.getElementById('reportDate').value = todayIsoDate();
    document.getElementById('branchName').value = branch;
    document.getElementById('managerName').value = String(currentUser?.name || '').trim();
    document.getElementById('reportTitle').value = branch
        ? `${branch} branch revenue report`
        : 'Branch revenue report';
}

function collectTextareaLines(id) {
    return String(document.getElementById(id)?.value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

async function loadBranchRevenueReportPage() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.myKwezaPageTransition.go('/');
            return;
        }
        currentUser = await meRes.json();

        if (currentUser.role !== 'Branch Manager') {
            if (currentUser.role === 'Super Admin') {
                window.myKwezaPageTransition.go('/super-admin.html');
            } else if (currentUser.role === 'Dev Operations Assistant') {
                window.myKwezaPageTransition.go('/dev-operations.html');
            } else {
                window.myKwezaPageTransition.go('/dashboard.html');
            }
            return;
        }

        updateHeader();
        resetFormDefaults();
    } catch (err) {
        window.myKwezaPageTransition.go('/');
    }
}

document.getElementById('branchRevenueReportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const report_date = document.getElementById('reportDate').value;
    const report_title = String(document.getElementById('reportTitle').value || '').trim();
    const total_collection = Number(document.getElementById('totalCollection').value || 0);
    const highlights = collectTextareaLines('highlights');
    const detailed_report = String(document.getElementById('detailedReport').value || '').trim();
    const challenges = collectTextareaLines('challenges');
    const support_needed = String(document.getElementById('supportNeeded').value || '').trim();

    if (!report_title) {
        alert('Report title is required.');
        return;
    }
    if (!Number.isFinite(total_collection) || total_collection <= 0) {
        alert('Please enter a valid total collection amount.');
        return;
    }
    if (!detailed_report) {
        alert('Detailed report is required.');
        return;
    }

    try {
        const res = await apiFetch('/api/branch/detailed-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_date,
                report_title,
                total_collection,
                highlights,
                detailed_report,
                challenges,
                support_needed
            })
        });

        if (res.ok) {
            alert('Branch revenue report submitted to founders successfully.');
            document.getElementById('branchRevenueReportForm').reset();
            resetFormDefaults();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to submit branch revenue report.');
        }
    } catch (err) {
        console.error('Branch revenue report submit error:', err);
        alert('Failed to submit branch revenue report.');
    }
});

document.getElementById('backToDashboardBtn')?.addEventListener('click', () => {
    window.myKwezaPageTransition.go(dashboardPath);
});

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    window.myKwezaPageTransition.go(dashboardPath);
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.myKwezaPageTransition.go('/');
});

loadBranchRevenueReportPage();
