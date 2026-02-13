// Initialize Lucide icons
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

async function readApiPayload(res) {
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
        try {
            return await res.json();
        } catch (err) {
            return {};
        }
    }

    try {
        const text = await res.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch (parseErr) {
            return { error: text };
        }
    } catch (err) {
        return {};
    }
}

function getAccountThemeMode() {
    const serverThemeMode = String(currentUser?.theme_mode || '').toLowerCase();
    if (serverThemeMode === 'light' || serverThemeMode === 'dark') {
        return serverThemeMode;
    }
    if (window.themeManager?.getTheme) {
        return window.themeManager.getTheme();
    }
    return 'dark';
}

function updateThemeStatusLabel(themeMode) {
    const themeStatus = document.getElementById('themeStatusText');
    if (themeStatus) {
        themeStatus.innerText = `Current: ${themeMode === 'light' ? 'Light Mode' : 'Dark Mode'}`;
    }
}

function syncAppearanceUI(themeMode) {
    const lightModeToggle = document.getElementById('lightModeToggle');
    if (lightModeToggle) {
        lightModeToggle.checked = themeMode === 'light';
    }
    updateThemeStatusLabel(themeMode);
}

function setProfileFormVisibility(visible) {
    const formWrap = document.getElementById('profileFormWrap');
    const toggleBtn = document.getElementById('toggleProfileFormBtn');
    if (!formWrap || !toggleBtn) return;

    formWrap.style.display = visible ? 'block' : 'none';
    toggleBtn.innerText = visible ? 'Hide Preferences Form' : 'Update Preferences';
}

function setPinFormVisibility(visible) {
    const formWrap = document.getElementById('pinFormWrap');
    const toggleBtn = document.getElementById('togglePinFormBtn');
    if (!formWrap || !toggleBtn) return;

    formWrap.style.display = visible ? 'block' : 'none';
    toggleBtn.innerText = visible ? 'Hide PIN Form' : 'Update PIN';
}

function initSettingsFormToggles() {
    setProfileFormVisibility(false);
    setPinFormVisibility(false);

    document.getElementById('toggleProfileFormBtn')?.addEventListener('click', () => {
        const formWrap = document.getElementById('profileFormWrap');
        setProfileFormVisibility(formWrap?.style.display !== 'block');
    });

    document.getElementById('togglePinFormBtn')?.addEventListener('click', () => {
        const formWrap = document.getElementById('pinFormWrap');
        setPinFormVisibility(formWrap?.style.display !== 'block');
    });
}

async function loadSettings() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await res.json();

        updateUI();

        if (isFinancialManagerRole(currentUser.role)) {
            const founderSection = document.getElementById('founderCompSection');
            if (founderSection) founderSection.style.display = 'block';
            await loadFounderMembers();
        }
    } catch (err) {
        window.location.href = '/';
    }
}

function updateUI() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;

    // Profile Settings
    document.getElementById('profileEmail').value = currentUser.email || '';
    document.getElementById('notifyToggle').checked = currentUser.notifications_enabled === 1;

    const themeMode = getAccountThemeMode();
    if (window.themeManager?.syncFromServer) {
        window.themeManager.syncFromServer(themeMode);
    }
    syncDevOpsThemeForCurrentUser(themeMode);
    syncAppearanceUI(themeMode);

    const getDashboardPath = () => {
        if (currentUser.role === 'Super Admin') return '/super-admin.html';
        if (currentUser.role === 'Dev Operations Assistant') return '/dev-operations.html';
        return '/dashboard.html';
    };
    const dashboardPath = getDashboardPath();

    // Handle Dashboard button link
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.onclick = () => window.location.href = dashboardPath;
    }

    const brandBtn = document.querySelector('.brand-group[onclick*="/dashboard.html"]');
    if (brandBtn) {
        brandBtn.onclick = () => window.location.href = dashboardPath;
    }

    const backBtn = document.querySelector('header button[onclick*="/dashboard.html"]');
    if (backBtn) {
        backBtn.onclick = () => window.location.href = dashboardPath;
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
        .map(m => `<option value="${m.id}">${m.name} (${m.member_id})</option>`)
        .join('');
}

function fillFounderCompInputs(memberId) {
    const member = founderMembers.find(m => String(m.id) === String(memberId));
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

        const targetId = selectedId && founderMembers.find(m => String(m.id) === String(selectedId))
            ? String(selectedId)
            : String(founderMembers[0].id);
        select.value = targetId;
        fillFounderCompInputs(targetId);
    } catch (err) {
        console.error('Founder members load error:', err);
    }
}

// Event Listeners
const logoutLogic = async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
};

document.getElementById('logoutBtn').addEventListener('click', logoutLogic);
if (document.getElementById('contentLogoutBtn')) {
    document.getElementById('contentLogoutBtn').addEventListener('click', logoutLogic);
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('profileEmail').value;
    const notifications_enabled = document.getElementById('notifyToggle').checked;

    const res = await apiFetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notifications_enabled })
    });

    if (res.ok) {
        alert('Preferences updated!');
        setProfileFormVisibility(false);
    }
});

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

    if ([salary, bonus, dividends].some(v => !Number.isFinite(v) || v < 0)) {
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

document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const old_pin = document.getElementById('oldPin').value;
    const new_pin = document.getElementById('newPin').value;
    const confirm_pin = document.getElementById('confirmPin').value;

    if (new_pin !== confirm_pin) {
        alert('New PINs do not match!');
        return;
    }

    if (new_pin.length !== 4) {
        alert('PIN must be 4 digits!');
        return;
    }

    try {
        const res = await apiFetch('/api/profile/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_pin, new_pin })
        });

        const data = await res.json();
        if (res.ok) {
            alert('PIN changed successfully!');
            document.getElementById('pinForm').reset();
            setPinFormVisibility(false);
        } else {
            alert(data.error || 'Failed to change PIN');
        }
    } catch (err) {
        alert('An error occurred. Please try again.');
    }
});

document.getElementById('lightModeToggle')?.addEventListener('change', (e) => {
    const selectedTheme = e.target.checked ? 'light' : 'dark';
    if (window.themeManager?.setTheme) {
        window.themeManager.setTheme(selectedTheme, false);
    }
    syncDevOpsThemeForCurrentUser(selectedTheme);
    updateThemeStatusLabel(selectedTheme);
});

document.getElementById('appearanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedTheme = document.getElementById('lightModeToggle')?.checked ? 'light' : 'dark';

    try {
        const email = document.getElementById('profileEmail')?.value || currentUser.email || '';
        const notificationsEnabled = document.getElementById('notifyToggle')?.checked ?? (currentUser.notifications_enabled === 1);

        const res = await apiFetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                notifications_enabled: notificationsEnabled,
                theme_mode: selectedTheme
            })
        });

        const data = await readApiPayload(res);
        if (res.ok) {
            const savedTheme = selectedTheme === 'light' ? 'light' : 'dark';
            currentUser.theme_mode = savedTheme;
            if (window.themeManager?.syncFromServer) {
                window.themeManager.syncFromServer(savedTheme);
            }
            syncDevOpsThemeForCurrentUser(savedTheme);
            syncAppearanceUI(savedTheme);
            alert('Theme saved successfully.');
        } else {
            alert(data.error || 'Failed to save theme setting on server.');
            syncDevOpsThemeForCurrentUser(getAccountThemeMode());
            syncAppearanceUI(getAccountThemeMode());
        }
    } catch (err) {
        if (window.themeManager?.setTheme) {
            window.themeManager.setTheme(selectedTheme, true);
        }
        syncDevOpsThemeForCurrentUser(selectedTheme);
        syncAppearanceUI(selectedTheme);
        alert('Server was unreachable. Theme was saved on this device only.');
    }
});

// Load on start
initSettingsFormToggles();
loadSettings();
