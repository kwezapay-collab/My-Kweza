lucide.createIcons();

let currentUser = null;
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isDevOpsAssistantRole = (role) => role === 'Dev Operations Assistant';
const getMenuBackUrl = (fallbackPath = '/dashboard.html') => fallbackPath;

function syncDevOpsThemeForCurrentUser(themeMode = null) {
    const activeTheme = themeMode || (window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark');
    const usePurpleTheme = isDevOpsAssistantRole(currentUser?.role) && activeTheme !== 'light';
    document.body.classList.toggle('devops-purple-theme', usePurpleTheme);
    document.body.dataset.useDevopsTheme = isDevOpsAssistantRole(currentUser?.role) ? '1' : '0';
    document.body.dataset.devopsThemeInitialized = '1';
}

function getAccountThemeMode() {
    const serverThemeMode = String(currentUser?.theme_mode || '').toLowerCase();
    if (serverThemeMode === 'light' || serverThemeMode === 'dark') return serverThemeMode;
    if (window.themeManager?.getTheme) return window.themeManager.getTheme();
    return 'dark';
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

function updateUI() {
    const navUserName = document.getElementById('userName');
    if (navUserName) navUserName.innerText = currentUser.name;
    const navUserRole = document.getElementById('userRole');
    if (navUserRole) navUserRole.innerText = currentUser.sub_role || currentUser.role;

    const nameField = document.getElementById('profileName');
    if (nameField) nameField.value = currentUser.name;

    const themeMode = getAccountThemeMode();
    if (window.themeManager?.syncFromServer) {
        window.themeManager.syncFromServer(themeMode);
    }
    syncDevOpsThemeForCurrentUser(themeMode);

    const getDashboardPath = () => {
        if (currentUser.role === 'Super Admin') return '/super-admin.html';
        if (currentUser.role === 'Dev Operations Assistant') return '/dev-operations.html';
        return '/dashboard.html';
    };
    const dashboardPath = getDashboardPath();

    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.onclick = () => window.myKwezaPageTransition.go(dashboardPath);
    }

    const brandBtn = document.querySelector('.brand-group[onclick*="/dashboard.html"]');
    if (brandBtn) {
        brandBtn.onclick = () => window.myKwezaPageTransition.go(dashboardPath);
    }

    const backBtn = document.querySelector('header button[onclick*="/dashboard.html"]');
    if (backBtn) {
        backBtn.onclick = () => window.myKwezaPageTransition.go(getMenuBackUrl(dashboardPath));
    }
}

async function loadSettings() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.myKwezaPageTransition.go('/');
            return;
        }
        currentUser = await res.json();
        updateUI();
    } catch (err) {
        window.myKwezaPageTransition.go('/');
    }
}

const logoutLogic = async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.myKwezaPageTransition.go('/');
};

document.getElementById('logoutBtn')?.addEventListener('click', logoutLogic);

document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameField = document.getElementById('profileName');
    const updatedName = String(nameField?.value || '').trim();

    if (!updatedName) {
        alert('Name is required.');
        return;
    }

    try {
        const res = await apiFetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: updatedName })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Failed to update profile preferences.');
            return;
        }

        currentUser.name = updatedName;
        updateUI();
        alert('Profile preferences updated successfully.');
        setProfileFormVisibility(false);
    } catch (err) {
        alert('An error occurred. Please try again.');
    }
});

document.getElementById('pinForm')?.addEventListener('submit', async (e) => {
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

initSettingsFormToggles();
loadSettings();
