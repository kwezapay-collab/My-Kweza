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

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '--';
    return new Date(parsed).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const resolveDashboardPathByRole = (role) => {
    if (role === 'Super Admin') return '/super-admin.html';
    if (role === 'Dev Operations Assistant') return '/dev-operations.html';
    return '/dashboard.html';
};

function updateHeader() {
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = currentUser.name;
    const userRoleEl = document.getElementById('userRole'); if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;
    const memberIdEl = document.getElementById('memberId'); if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;

    dashboardPath = resolveDashboardPathByRole(currentUser.role);

    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.onclick = () => {
            window.location.href = dashboardPath;
        };
    }

    const brandBtn = document.querySelector('.brand-group');
    if (brandBtn) {
        brandBtn.onclick = () => {
            window.location.href = dashboardPath;
        };
    }

    applyRoleTheme();
}

async function markNotificationRead(notificationId) {
    const id = Number.parseInt(String(notificationId || ''), 10);
    if (!Number.isFinite(id) || id <= 0) return;

    await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PUT'
    });
}

function bindNotificationActions() {
    document.querySelectorAll('.notification-open-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const id = Number.parseInt(String(button.dataset.id || ''), 10);
            const isRead = String(button.dataset.read || '0') === '1';
            const link = String(button.dataset.link || '').trim();

            try {
                if (!isRead) {
                    await markNotificationRead(id);
                }
            } catch (err) {
                // Continue navigation even if mark-read fails.
            }

            if (link) {
                window.location.href = link;
                return;
            }

            await loadNotifications();
        });
    });
}

function renderNotifications(rows) {
    const tableBody = document.getElementById('notificationsTable');
    const countLabel = document.getElementById('notificationsCount');
    const notifications = Array.isArray(rows) ? rows : [];
    const unreadCount = notifications.filter((item) => Number(item.is_read) !== 1).length;

    tableBody.innerHTML = '';
    countLabel.innerText = `${notifications.length} notification${notifications.length === 1 ? '' : 's'} - ${unreadCount} unread`;

    if (!notifications.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No notifications yet</td></tr>';
        return;
    }

    notifications.forEach((entry) => {
        const isRead = Number(entry.is_read) === 1;
        const statusLabel = isRead ? 'read' : 'unread';
        const statusClass = isRead ? 'status-paid' : 'status-pending';
        const link = String(entry.link_url || '').trim();
        const actionLabel = link ? (isRead ? 'Open' : 'Read + Open') : (isRead ? 'Viewed' : 'Mark Read');
        const actionDisabled = !link && isRead;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0; white-space: nowrap;">${formatDateTime(entry.created_at)}</td>
            <td style="font-weight: 600; min-width: 170px;">${escapeHtml(entry.title || 'Notification')}</td>
            <td style="max-width: 420px; color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(entry.message || '--')}</td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>
                <button class="btn btn-secondary notification-open-btn" type="button"
                    data-id="${entry.id}"
                    data-read="${isRead ? 1 : 0}"
                    data-link="${escapeHtml(link)}"
                    ${actionDisabled ? 'disabled' : ''}
                    style="padding: 8px 12px; font-size: 0.72rem;">
                    ${actionLabel}
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    bindNotificationActions();
}

async function loadNotifications() {
    const countLabel = document.getElementById('notificationsCount');
    try {
        const response = await apiFetch('/api/notifications?limit=120');
        if (!response.ok) {
            countLabel.innerText = 'Unable to load notifications.';
            return;
        }
        const rows = await response.json();
        renderNotifications(rows);
    } catch (err) {
        countLabel.innerText = 'Unable to load notifications.';
    }
}

async function loadNotificationsPage() {
    try {
        const meResponse = await apiFetch('/api/me');
        if (!meResponse.ok) {
            window.location.href = '/';
            return;
        }

        currentUser = await meResponse.json();
        updateHeader();
        await loadNotifications();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('backToDashboardBtn')?.addEventListener('click', () => {
    window.location.href = getMenuBackUrl(dashboardPath);
});

document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    try {
        await apiFetch('/api/notifications/read-all', { method: 'PUT' });
        await loadNotifications();
    } catch (err) {
        alert('Failed to mark notifications as read.');
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadNotificationsPage();
