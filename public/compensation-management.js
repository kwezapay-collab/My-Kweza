lucide.createIcons();

let currentUser = null;
let founderMembers = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isFinancialManagerRole = (role) => role === 'Financial Manager';
const isDevOpsAssistantRole = (role) => role === 'Dev Operations Assistant';

function syncDevOpsThemeForCurrentUser(themeMode = null) {
    const activeTheme = themeMode || (window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark');
    const usePurpleTheme = isDevOpsAssistantRole(currentUser?.role) && activeTheme !== 'light';
    document.body.classList.toggle('devops-purple-theme', usePurpleTheme);
    document.body.dataset.useDevopsTheme = isDevOpsAssistantRole(currentUser?.role) ? '1' : '0';
    document.body.dataset.devopsThemeInitialized = '1';
}

function getDashboardPath() {
    if (currentUser?.role === 'Super Admin') return '/super-admin.html';
    if (currentUser?.role === 'Dev Operations Assistant') return '/dev-operations.html';
    return '/dashboard.html';
}

function updateHeader() {
    const navUserName = document.getElementById('userName');
    if (navUserName) navUserName.innerText = currentUser.name;
    const navUserRole = document.getElementById('userRole');
    if (navUserRole) navUserRole.innerText = currentUser.sub_role || currentUser.role;

    const dashboardPath = getDashboardPath();
    document.getElementById('dashboardBtn')?.addEventListener('click', () => {
        window.location.href = dashboardPath;
    });
    document.getElementById('backBtn')?.addEventListener('click', () => {
        window.location.href = dashboardPath;
    });

    const brandBtn = document.querySelector('.brand-group[onclick*="/dashboard.html"]');
    if (brandBtn) {
        brandBtn.onclick = () => window.location.href = dashboardPath;
    }
}

function renderFounderMemberOptions() {
    const select = document.getElementById('founderMemberSelect');
    if (!select) return;

    if (!founderMembers.length) {
        select.innerHTML = '<option value="">No members found</option>';
        return;
    }

    select.innerHTML = founderMembers
        .map((m) => `<option value="${m.id}">${m.name} (${m.member_id})</option>`)
        .join('');
}

function fillFounderCompInputs(memberId) {
    const member = founderMembers.find((m) => String(m.id) === String(memberId));
    if (!member) return;

    document.getElementById('founderSalaryInput').value = Number(member.salary || 0);
    document.getElementById('founderBonusInput').value = Number(member.bonus || 0);
    document.getElementById('founderDividendsInput').value = Number(member.dividends || 0);
}

function renderFounderCompTable() {
    const tableBody = document.getElementById('founderCompTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (!founderMembers.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No members found</td></tr>';
        return;
    }

    founderMembers.forEach((m) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${m.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${m.member_id}</div>
            </td>
            <td>${m.role}</td>
            <td>MWK ${Number(m.salary || 0).toLocaleString()}</td>
            <td>MWK ${Number(m.bonus || 0).toLocaleString()}</td>
            <td>MWK ${Number(m.dividends || 0).toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadFounderMembers(selectedId = null) {
    try {
        const res = await apiFetch('/api/founder/members');
        if (!res.ok) {
            const tableBody = document.getElementById('founderCompTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load members</td></tr>';
            }
            return;
        }

        founderMembers = await res.json();
        renderFounderMemberOptions();
        renderFounderCompTable();

        const select = document.getElementById('founderMemberSelect');
        if (!select || !founderMembers.length) return;

        const targetId = selectedId && founderMembers.find((m) => String(m.id) === String(selectedId))
            ? String(selectedId)
            : String(founderMembers[0].id);
        select.value = targetId;
        fillFounderCompInputs(targetId);
    } catch (err) {
        console.error('Founder members load error:', err);
    }
}

async function loadCompensationPage() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }

        currentUser = await res.json();
        if (!isFinancialManagerRole(currentUser.role)) {
            window.location.href = '/dashboard.html';
            return;
        }

        const themeMode = String(currentUser.theme_mode || '').toLowerCase() === 'light' ? 'light' : 'dark';
        if (window.themeManager?.syncFromServer) {
            window.themeManager.syncFromServer(themeMode);
        }
        syncDevOpsThemeForCurrentUser(themeMode);

        updateHeader();
        await loadFounderMembers();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('founderMemberSelect')?.addEventListener('change', (e) => {
    fillFounderCompInputs(e.target.value);
});

document.getElementById('founderCompForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isFinancialManagerRole(currentUser?.role)) return;

    const memberId = document.getElementById('founderMemberSelect').value;
    const salary = Number(document.getElementById('founderSalaryInput').value || 0);
    const bonus = Number(document.getElementById('founderBonusInput').value || 0);
    const dividends = Number(document.getElementById('founderDividendsInput').value || 0);

    if ([salary, bonus, dividends].some((v) => !Number.isFinite(v) || v < 0)) {
        alert('Salary, bonus and dividends must be non-negative numbers.');
        return;
    }

    const res = await apiFetch(`/api/founder/members/${memberId}/compensation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary, bonus, dividends })
    });

    if (res.ok) {
        alert('Compensation updated successfully.');
        await loadFounderMembers(memberId);
    } else {
        const data = await res.json();
        alert(data.error || 'Failed to update compensation.');
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadCompensationPage();
