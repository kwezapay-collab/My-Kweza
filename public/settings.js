// Initialize Lucide icons
lucide.createIcons();

let currentUser = null;
let founderMembers = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isFounderRole = (role) => role === 'Founder' || role === 'Founder Member';
const isDevOpsAssistantRole = (role) => role === 'Dev Operations Assistant';

async function loadSettings() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await res.json();

        updateUI();

        if (isFounderRole(currentUser.role)) {
            const founderSection = document.getElementById('founderCompSection');
            if (founderSection) founderSection.style.display = 'block';
            await loadFounderMembers();
        }
    } catch (err) {
        window.location.href = '/';
    }
}

function updateUI() {
    if (isDevOpsAssistantRole(currentUser.role)) {
        document.body.classList.add('devops-purple-theme');
    } else {
        document.body.classList.remove('devops-purple-theme');
    }

    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;

    // Profile Settings
    document.getElementById('profileEmail').value = currentUser.email || '';
    document.getElementById('notifyToggle').checked = currentUser.notifications_enabled === 1;

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

    if (res.ok) alert('Preferences updated!');
});

document.getElementById('founderMemberSelect')?.addEventListener('change', (e) => {
    fillFounderCompInputs(e.target.value);
});

document.getElementById('founderCompForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isFounderRole(currentUser?.role)) return;

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
        } else {
            alert(data.error || 'Failed to change PIN');
        }
    } catch (err) {
        alert('An error occurred. Please try again.');
    }
});

// Load on start
loadSettings();
