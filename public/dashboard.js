// Initialize Lucide icons
lucide.createIcons();

let currentUser = null;
let myWithdrawals = [];
let financialWithdrawals = [];
let founderWeeklyReports = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });
const isFinancialManagerRole = (role) => role === 'Financial Manager';
const isFounderRole = (role) => role === 'Founder';

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWithdrawalStatus = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    return normalized === 'approved' ? 'accepted' : normalized;
};

const withdrawalStatusClass = (status) => {
    const normalized = normalizeWithdrawalStatus(status);
    if (normalized === 'paid') return 'status-paid';
    if (normalized === 'accepted') return 'status-accepted';
    if (normalized === 'rejected') return 'status-rejected';
    return 'status-pending';
};

const withdrawalStatusLabel = (status) => normalizeWithdrawalStatus(status);

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

const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
};

const formatDate = (value) => {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '--';
    return new Date(parsed).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

function getEarningsRoleTheme(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized.includes('admin')) return 'admin';
    if (normalized.includes('financial') || normalized.includes('finance')) return 'finance';
    if (normalized.includes('branch')) return 'branch';
    if (normalized.includes('core')) return 'core';
    if (normalized.includes('founder')) return 'founder';
    if (normalized.includes('dev operations') || normalized.includes('devops')) return 'devops';
    return 'member';
}

function applyEarningsCardTheme(role) {
    const card = document.getElementById('earningsCard');
    if (!card) return;
    const roleTheme = getEarningsRoleTheme(role);
    card.classList.remove(
        'earnings-role-admin',
        'earnings-role-finance',
        'earnings-role-branch',
        'earnings-role-core',
        'earnings-role-founder',
        'earnings-role-devops',
        'earnings-role-member'
    );
    card.classList.add(`earnings-role-${roleTheme}`);
}

function updateEarningsCardMeta() {
    const memberIdEl = document.getElementById('earningsCardNumber');
    if (memberIdEl) {
        memberIdEl.innerText = `ID: ${String(currentUser?.member_id || '--')}`;
    }

    const validThruEl = document.getElementById('earningsValidThru');
    if (validThruEl) {
        const now = new Date();
        validThruEl.innerText = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }

    const holderEl = document.getElementById('earningsCardHolder');
    if (holderEl) {
        holderEl.innerText = String(currentUser?.name || '--');
    }
}

async function loadDashboard() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.myKwezaPageTransition.go('/');
            return;
        }
        currentUser = await res.json();

        if (currentUser.role === 'Super Admin') {
            window.myKwezaPageTransition.go('/super-admin.html');
            return;
        }
        if (currentUser.role === 'Dev Operations Assistant') {
            window.myKwezaPageTransition.go('/dev-operations.html');
            return;
        }

        updateUI();

        const requests = [fetchPayouts(), fetchWithdrawalRequests(), fetchNotifications()];
        if (isFinancialManagerRole(currentUser.role)) {
            requests.push(fetchFinancialWithdrawals());
        }
        if (isFounderRole(currentUser.role)) {
            requests.push(fetchFounderWeeklyReports());
        }

        await Promise.all(requests);
    } catch (err) {
        window.myKwezaPageTransition.go('/');
    }
}

function updateUI() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.innerText = currentUser.name;

    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;

    const memberIdEl = document.getElementById('memberId');
    if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;

    updateEarningsCardMeta();
    applyEarningsCardTheme(currentUser.role);

    if (currentUser.role === 'Super Admin') {
        const superAdminBtn = document.getElementById('superAdminBtn');
        if (superAdminBtn) superAdminBtn.style.display = 'flex';
        const statsCard = document.querySelector('.unified-stats-card');
        if (statsCard) statsCard.style.display = 'none';
    }

    const branchRevenueReportBtn = document.getElementById('branchRevenueReportBtn');
    const branchRevenueReportBtnLabel = document.getElementById('branchRevenueReportBtnLabel');
    if (branchRevenueReportBtn) {
        const isBranchManager = currentUser.role === 'Branch Manager';
        branchRevenueReportBtn.style.display = isBranchManager ? 'flex' : 'none';
        if (isBranchManager && branchRevenueReportBtnLabel) {
            const branchName = String(currentUser.branch || '').trim();
            branchRevenueReportBtnLabel.innerText = branchName
                ? `${branchName} Revenue Reporting`
                : 'Branch Revenue Reporting';
        }
    }

    const financialPanel = document.getElementById('financialManagerPanel');
    if (financialPanel) {
        financialPanel.style.display = isFinancialManagerRole(currentUser.role) ? 'block' : 'none';
    }

    const founderWeeklyReportsPanel = document.getElementById('founderWeeklyReportsPanel');
    if (founderWeeklyReportsPanel) {
        founderWeeklyReportsPanel.style.display = isFounderRole(currentUser.role) ? 'flex' : 'none';
    }

    const withdrawalsHint = document.getElementById('myWithdrawalsHint');
    if (withdrawalsHint && isFinancialManagerRole(currentUser.role)) {
        withdrawalsHint.innerText = 'Track your own requests and payout notifications while managing the full queue below.';
    }

    const writeNotificationBtn = document.getElementById('writeNotificationBtn');
    if (writeNotificationBtn) {
        const allowedIds = ['CTM-2025-002', 'MEM-2025-004'];
        const isAllowed = isFounderRole(currentUser.role) || allowedIds.includes(currentUser.member_id);
        writeNotificationBtn.style.display = isAllowed ? 'flex' : 'none';
    }
}



async function fetchPayouts() {
    const tableBody = document.getElementById('payoutsTable');
    const showMoreWrap = document.getElementById('showMorePayoutsWrap');

    if (tableBody) {
        const res = await apiFetch('/api/payouts');
        const payouts = await res.json();
        const sortedPayouts = Array.isArray(payouts)
            ? [...payouts].sort((a, b) => (b.id || 0) - (a.id || 0))
            : [];
        const recentPayouts = sortedPayouts.slice(0, 2);

        tableBody.innerHTML = '';
        if (showMoreWrap) {
            showMoreWrap.style.display = 'block';
        }

        if (recentPayouts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
        }

        recentPayouts.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 1rem 0;">${p.month} ${p.year}</td>
                <td style="text-transform: capitalize;">${p.type}</td>
                <td>MWK ${Number(p.amount || 0).toLocaleString()}</td>
                <td><span class="status-pill status-${p.status}">${p.status}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Update stats cards from user record
    const salary = Number(currentUser.salary || 0);
    const bonus = Number(currentUser.bonus || 0);
    const dividends = Number(currentUser.dividends || 0);
    const totalValEl = document.getElementById('totalVal');
    if (totalValEl) {
        totalValEl.innerText = (salary + bonus + dividends).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // LRM Warning for members
    if (window.isLRMActive && (bonus > 0 || dividends > 0) && !document.getElementById('lrmWarningCard')) {
        const warning = document.createElement('div');
        warning.id = 'lrmWarningCard';
        warning.className = 'glass-card animate-fade';
        warning.style.borderColor = 'var(--gold)';
        warning.style.marginBottom = '1.5rem';
        warning.innerHTML = `<p style="color: var(--gold); font-size: 0.85rem;"><i data-lucide="info" style="width: 14px; vertical-align: middle; margin-right: 8px;"></i> System currently in Low Revenue Mode. Bonuses and Dividends may experience processing delays.</p>`;
        document.querySelector('.main-content').insertBefore(warning, document.querySelector('.unified-stats-card'));
        lucide.createIcons();
    }
}

async function fetchWithdrawalRequests() {
    const tableBody = document.getElementById('myWithdrawalsTable');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/withdrawals');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load withdrawal requests</td></tr>';
            return;
        }

        const rows = await res.json();
        myWithdrawals = Array.isArray(rows) ? rows : [];
        renderMyWithdrawals();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load withdrawal requests</td></tr>';
    }
}

function renderMyWithdrawals() {
    const tableBody = document.getElementById('myWithdrawalsTable');
    const showMoreWrap = document.getElementById('showMoreMyWithdrawalsWrap');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }

    if (!myWithdrawals.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests submitted yet</td></tr>';
        return;
    }

    const recentWithdrawals = myWithdrawals.slice(0, 2);

    recentWithdrawals.forEach((w) => {
        const status = normalizeWithdrawalStatus(w.status);
        const managerUpdate = w.notification_message
            ? escapeHtml(w.notification_message)
            : (status === 'accepted'
                ? 'Accepted. Awaiting transfer notification.'
                : (status === 'paid'
                    ? 'Payment sent.'
                    : (status === 'rejected' ? 'Request was rejected.' : 'Awaiting review.')));

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${formatDateTime(w.created_at)}</td>
            <td style="font-weight: 600;">MWK ${Number(w.amount || 0).toLocaleString()}</td>
            <td>
                <div style="font-weight: 500;">${escapeHtml(w.method || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.details || '--')}</div>
            </td>
            <td><span class="status-pill ${withdrawalStatusClass(status)}">${withdrawalStatusLabel(status)}</span></td>
            <td style="max-width: 320px; color: var(--text-muted); font-size: 0.85rem;">${managerUpdate}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchFinancialWithdrawals() {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    const tableBody = document.getElementById('financialWithdrawalsTable');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/financial/withdrawals');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
            return;
        }

        const rows = await res.json();
        financialWithdrawals = Array.isArray(rows) ? rows : [];
        renderFinancialWithdrawals();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load finance queue</td></tr>';
    }
}

function renderFinancialWithdrawals() {
    const tableBody = document.getElementById('financialWithdrawalsTable');
    const showMoreWrap = document.getElementById('showMoreFinancialWithdrawalsWrap');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }
    const pendingCount = financialWithdrawals.filter((w) => normalizeWithdrawalStatus(w.status) === 'pending').length;
    const pendingLabel = document.getElementById('financialPendingCount');
    if (pendingLabel) {
        pendingLabel.innerText = `Pending: ${pendingCount}`;
    }

    if (!financialWithdrawals.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests in queue</td></tr>';
        return;
    }

    const recentFinancialWithdrawals = financialWithdrawals.slice(0, 2);

    recentFinancialWithdrawals.forEach((w) => {
        const status = normalizeWithdrawalStatus(w.status);
        const noteInputId = `financeNote-${w.id}`;
        const defaultMessage = `Your withdrawal request of MWK ${Number(w.amount || 0).toLocaleString()} has been paid.`;

        let actionMarkup = '<span style="color: var(--text-muted); font-size: 0.8rem;">---</span>';
        if (status === 'pending') {
            actionMarkup = `
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="updateFinancialWithdrawalStatus(${w.id}, 'accepted')">Accept</button>
                    <button class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="updateFinancialWithdrawalStatus(${w.id}, 'rejected')">Reject</button>
                </div>
            `;
        } else if (status === 'accepted') {
            actionMarkup = `
                <div style="display: grid; gap: 0.6rem; min-width: 260px;">
                    <textarea id="${noteInputId}" placeholder="Payment notification message" style="width: 100%; min-height: 80px; resize: vertical; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); padding: 10px; border-radius: 10px; color: white; font-size: 0.85rem;">${escapeHtml(defaultMessage)}</textarea>
                    <button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.72rem;" onclick="sendFinancialWithdrawalNotification(${w.id})">Mark Paid + Notify</button>
                </div>
            `;
        } else if (status === 'paid') {
            const sentTime = w.notification_sent_at ? formatDateTime(w.notification_sent_at) : '--';
            actionMarkup = `<span style="color: var(--accent); font-size: 0.8rem;">Notification sent: ${sentTime}</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${escapeHtml(w.member_name || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.member_id || '--')}</div>
            </td>
            <td style="font-weight: 600;">MWK ${Number(w.amount || 0).toLocaleString()}</td>
            <td>
                <div style="font-weight: 500;">${escapeHtml(w.method || '--')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(w.details || '--')}</div>
            </td>
            <td><span class="status-pill ${withdrawalStatusClass(status)}">${withdrawalStatusLabel(status)}</span></td>
            <td>${actionMarkup}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function updateFinancialWithdrawalStatus(id, status) {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    try {
        const res = await apiFetch(`/api/financial/withdrawals/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            await Promise.all([fetchFinancialWithdrawals(), fetchWithdrawalRequests()]);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to update withdrawal request.');
        }
    } catch (err) {
        console.error('Withdrawal status update error:', err);
    }
}

async function sendFinancialWithdrawalNotification(id) {
    if (!isFinancialManagerRole(currentUser?.role)) return;

    const input = document.getElementById(`financeNote-${id}`);
    const message = String(input?.value || '').trim();
    if (!message) {
        alert('Please enter a notification message before sending.');
        return;
    }

    try {
        const res = await apiFetch(`/api/financial/withdrawals/${id}/notify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (res.ok) {
            alert('Notification sent to requester.');
            await Promise.all([fetchFinancialWithdrawals(), fetchWithdrawalRequests()]);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to send notification.');
        }
    } catch (err) {
        console.error('Withdrawal notification error:', err);
    }
}

async function fetchFounderWeeklyReports() {
    if (!isFounderRole(currentUser?.role)) return;

    const tableBody = document.getElementById('founderWeeklyReportsTable');
    const countLabel = document.getElementById('founderWeeklyReportsCount');
    if (!tableBody) return;

    try {
        const res = await apiFetch('/api/founder/weekly-reports');
        if (!res.ok) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load weekly reports</td></tr>';
            if (countLabel) countLabel.innerText = 'Unable to load reports';
            return;
        }

        const rows = await res.json();
        founderWeeklyReports = Array.isArray(rows)
            ? [...rows].sort((a, b) => {
                const parsedTimeA = Date.parse(a.report_date || '');
                const parsedTimeB = Date.parse(b.report_date || '');
                const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
                const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
                if (timeA !== timeB) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            })
            : [];
        renderFounderWeeklyReports();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load weekly reports</td></tr>';
        if (countLabel) countLabel.innerText = 'Unable to load reports';
    }
}

function renderFounderWeeklyReports() {
    const tableBody = document.getElementById('founderWeeklyReportsTable');
    const countLabel = document.getElementById('founderWeeklyReportsCount');
    const showMoreWrap = document.getElementById('showMoreFounderWeeklyReportsWrap');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }

    if (countLabel) {
        countLabel.innerText = founderWeeklyReports.length > 2
            ? `Showing 2 of ${founderWeeklyReports.length} reports`
            : `${founderWeeklyReports.length} report${founderWeeklyReports.length === 1 ? '' : 's'}`;
    }

    if (!founderWeeklyReports.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No weekly reports submitted yet</td></tr>';
        return;
    }

    const recentReports = founderWeeklyReports.slice(0, 2);

    recentReports.forEach((report) => {
        const developerName = escapeHtml(report.developer_name || report.current_developer_name || '--');
        const memberId = escapeHtml(report.developer_member_id || report.current_developer_member_id || '--');
        const reviewedBy = escapeHtml(report.reviewed_by || '--');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">${formatDate(report.report_date)}</td>
            <td>
                <div style="font-weight: 600;">${developerName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${memberId}</div>
            </td>
            <td style="font-weight: 600;">${escapeHtml(report.project_name || '--')}</td>
            <td>${formatDate(report.target_completion_date)}</td>
            <td>${reviewedBy}</td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchNotifications() {
    const listEl = document.getElementById('notificationCenterList');
    if (!listEl) return;

    try {
        const res = await apiFetch('/api/notifications?limit=20');
        let rows = [];
        if (res.ok) {
            rows = await res.json();
        }
        const unreadRows = Array.isArray(rows) ? rows.filter(r => Number(r.is_read) !== 1) : [];
        renderNotificationCenter(unreadRows);
    } catch (err) {
        console.error('Failed to fetch notifications:', err);
    }
}


let currentNotifIndex = 0;
let isScrollingNotifs = false;

function renderNotificationCenter(notifications) {
    const listEl = document.getElementById('notificationCenterList');
    if (!listEl) return;

    if (!notifications.length) {
        listEl.innerHTML = '<div class="notification-center-empty">No new notifications</div>';
        return;
    }

    listEl.innerHTML = '';
    notifications.forEach((n, index) => {
        const card = document.createElement('div');
        card.className = 'notification-card';
        card.dataset.id = n.id;
        card.dataset.index = index;

        // Initial stacking
        const offset = index * 8;
        const scale = Math.max(0.7, 1 - (index * 0.05));
        const opacity = Math.max(0, 1 - (index * 0.3));

        card.style.transform = `translateY(${offset}px) scale(${scale})`;
        card.style.opacity = opacity;
        card.style.zIndex = 100 - index;

        card.innerHTML = `
            <div class="notification-icon-wrap">
                <i data-lucide="bell" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="notification-content">
                <div class="notification-card-header">
                    <span class="notification-app-name">MYKWEZA</span>
                    <span class="notification-time">${timeAgo(n.created_at)}</span>
                </div>
                <div class="notification-card-title">${escapeHtml(n.title || 'Notification')}</div>
                <div class="notification-card-message">${escapeHtml(n.message || '')}</div>
            </div>
            <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; position: relative; margin-left: 0.5rem; border: 1px solid rgba(255,255,255,0.1);">
                <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: rgba(255,255,255,0.3);"></i>
            </div>
        `;

        card.onclick = () => {
            window.myKwezaPageTransition.go(`/notifications.html?id=${n.id}`);
        };

        listEl.appendChild(card);
    });
    lucide.createIcons();

    // Attach wheel listener to the list container
    listEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (isScrollingNotifs) return;

        if (e.deltaY > 0) {
            // Scroll down: next notification
            if (currentNotifIndex < notifications.length - 1) {
                currentNotifIndex++;
                updateNotifStack();
            }
        } else {
            // Scroll up: previous
            if (currentNotifIndex > 0) {
                currentNotifIndex--;
                updateNotifStack();
            }
        }

        isScrollingNotifs = true;
        setTimeout(() => isScrollingNotifs = false, 400); // Match transition time
    }, { passive: false });

    // Touch support for swiping
    let touchStartY = 0;
    listEl.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    listEl.addEventListener('touchmove', (e) => {
        if (isScrollingNotifs) return;
        const touchY = e.touches[0].clientY;
        const diff = touchStartY - touchY;

        if (Math.abs(diff) > 30) { // Threshold
            if (diff > 0) {
                if (currentNotifIndex < notifications.length - 1) {
                    currentNotifIndex++;
                    updateNotifStack();
                }
            } else {
                if (currentNotifIndex > 0) {
                    currentNotifIndex--;
                    updateNotifStack();
                }
            }
            isScrollingNotifs = true;
            setTimeout(() => isScrollingNotifs = false, 400);
        }
    }, { passive: true });
}


function updateNotifStack() {
    const cards = document.querySelectorAll('.notification-card');
    cards.forEach((card) => {
        const index = parseInt(card.dataset.index);
        const relativeIndex = index - currentNotifIndex;

        let translateY = 0;
        let scale = 1;
        let opacity = 1;
        let pointerEvents = 'auto';

        if (relativeIndex < 0) {
            // Above focus: slide up and fade out
            translateY = -120;
            scale = 0.8;
            opacity = 0;
            pointerEvents = 'none';
        } else if (relativeIndex === 0) {
            // In focus: centered and full size
            translateY = 0;
            scale = 1;
            opacity = 1;
        } else {
            // Below focus: stacked behind
            translateY = relativeIndex * 12;
            scale = Math.max(0.7, 1 - (relativeIndex * 0.05));
            opacity = Math.max(0, 1 - (relativeIndex * 0.3));
        }

        card.style.transform = `translateY(${translateY}px) scale(${scale})`;
        card.style.opacity = opacity;
        card.style.pointerEvents = pointerEvents;
        card.style.zIndex = 100 - relativeIndex;

        // Add a blur to background cards
        card.style.filter = relativeIndex > 0 ? `blur(${relativeIndex * 2}px)` : 'none';
    });
}

// Event Listeners
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.myKwezaPageTransition.go('/');
});

document.getElementById('exportCSVBtn')?.addEventListener('click', () => {
    window.myKwezaPageTransition.go('/api/export/payouts');
});

document.getElementById('withdrawalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const details = document.getElementById('withdrawDetails').value;

    if (isNaN(amount) || amount <= 0) return alert('Enter a valid amount');

    try {
        const res = await apiFetch('/api/withdrawals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method, details })
        });

        if (res.ok) {
            alert('Withdrawal request submitted for approval.');
            document.getElementById('withdrawalForm').reset();
            await fetchWithdrawalRequests();
            if (isFinancialManagerRole(currentUser?.role)) {
                await fetchFinancialWithdrawals();
            }
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to submit request');
        }
    } catch (err) {
        console.error('Withdrawal error:', err);
    }
});

document.getElementById('complaintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('complaintSubject').value.trim();
    const message = document.getElementById('complaintMessage').value.trim();
    if (!message) return alert('Please enter complaint details.');

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
    }
});

window.updateFinancialWithdrawalStatus = updateFinancialWithdrawalStatus;
window.sendFinancialWithdrawalNotification = sendFinancialWithdrawalNotification;

// Load on start
loadDashboard();
