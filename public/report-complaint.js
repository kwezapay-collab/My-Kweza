lucide.createIcons();

let currentUser = null;
let dashboardPath = '/dashboard.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const getMenuBackUrl = (fallbackPath = '/dashboard.html') => fallbackPath;

function resolveDashboardPath(role) {
    if (role === 'Super Admin') return '/super-admin.html';
    if (role === 'Dev Operations Assistant') return '/dev-operations.html';
    return '/dashboard.html';
}

function applyRoleTheme() {
    if (!document.body) return;
    const isDevOps = currentUser?.role === 'Dev Operations Assistant';
    if (!isDevOps) return;

    const activeTheme = window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark';
    document.body.dataset.useDevopsTheme = '1';
    document.body.classList.toggle('devops-purple-theme', activeTheme !== 'light');
}

function updateHeader() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
}

async function loadComplaintPage() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/';
            return;
        }

        currentUser = await meRes.json();
        dashboardPath = resolveDashboardPath(currentUser.role);

        updateHeader();
        applyRoleTheme();

        const devopsInboxHint = document.getElementById('devopsInboxHint');
        if (devopsInboxHint) {
            devopsInboxHint.style.display = currentUser.role === 'Dev Operations Assistant' ? 'block' : 'none';
        }
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('complaintForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const subject = document.getElementById('complaintSubject').value.trim();
    const message = document.getElementById('complaintMessage').value.trim();

    if (!message) {
        alert('Please enter complaint details.');
        return;
    }

    try {
        const res = await apiFetch('/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message })
        });

        if (res.ok) {
            alert('Complaint sent to Dev Operations Assistant.');
            document.getElementById('complaintForm').reset();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to send complaint.');
        }
    } catch (err) {
        console.error('Complaint error:', err);
        alert('Failed to send complaint.');
    }
});

document.getElementById('backToDashboardBtn')?.addEventListener('click', () => {
    window.location.href = getMenuBackUrl(dashboardPath);
});

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadComplaintPage();
