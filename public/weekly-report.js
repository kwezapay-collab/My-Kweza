lucide.createIcons();

let currentUser = null;
const dashboardPath = '/dev-operations.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function nowForDatetimeLocal() {
    const now = new Date();
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
}

function updateHeader() {
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = currentUser.name;
    const userRoleEl = document.getElementById('userRole'); if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;
    const memberIdEl = document.getElementById('memberId'); if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;
}

function resetFormDefaults() {
    document.getElementById('reportDate').value = todayIsoDate();
    document.getElementById('dateTimeStarted').value = nowForDatetimeLocal();
    document.getElementById('developerName').value = currentUser.name;
}

function collectTextareaLines(id) {
    return String(document.getElementById(id)?.value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

async function loadWeeklyReportPage() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.myKwezaPageTransition.go('/');
            return;
        }
        currentUser = await meRes.json();

        if (currentUser.role !== 'Dev Operations Assistant') {
            if (currentUser.role === 'Super Admin') {
                window.myKwezaPageTransition.go('/super-admin.html');
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

document.getElementById('weeklyReportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const report_date = document.getElementById('reportDate').value;
    const project_name = String(document.getElementById('projectName').value || '').trim();
    const date_time_started = document.getElementById('dateTimeStarted').value;
    const target_completion_date = document.getElementById('targetCompletionDate').value;
    const work_completed = collectTextareaLines('workCompleted');
    const challenges_blockers = collectTextareaLines('challenges');
    const plan_next_week = collectTextareaLines('nextWeekPlan');
    const reviewed_by = String(document.getElementById('reviewedBy').value || '').trim();
    const approval_date = document.getElementById('approvalDate').value;

    if (!project_name) {
        alert('Project name is required.');
        return;
    }
    if (!work_completed.length) {
        alert('Please add at least one work completed item.');
        return;
    }

    try {
        const res = await apiFetch('/api/devops/weekly-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_date,
                project_name,
                date_time_started,
                target_completion_date,
                work_completed,
                challenges_blockers,
                plan_next_week,
                reviewed_by,
                approval_date
            })
        });

        if (res.ok) {
            alert('Weekly report submitted to founders successfully.');
            document.getElementById('weeklyReportForm').reset();
            resetFormDefaults();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to submit weekly report.');
        }
    } catch (err) {
        console.error('Weekly report submit error:', err);
        alert('Failed to submit weekly report.');
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

loadWeeklyReportPage();
