lucide.createIcons();

let currentUser = null;
let allComplaints = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
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

        if (currentUser.role !== 'Dev Operations Assistant') {
            if (currentUser.role === 'Super Admin') {
                window.myKwezaPageTransition.go('/super-admin.html');
            } else {
                window.myKwezaPageTransition.go('/dashboard.html');
            }
            return;
        }

        updateUI();
        fetchNotifications();

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
}

async function fetchPayouts() {
    const res = await apiFetch('/api/payouts');
    if (!res.ok) return;
    const payouts = await res.json();
    const sortedPayouts = Array.isArray(payouts)
        ? [...payouts].sort((a, b) => (b.id || 0) - (a.id || 0))
        : [];
    const recentPayouts = sortedPayouts.slice(0, 2);

    const tableBody = document.getElementById('payoutsTable');
    const showMoreWrap = document.getElementById('showMorePayoutsWrap');
    tableBody.innerHTML = '';

    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }

    if (!recentPayouts.length) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
        return;
    }

    recentPayouts.forEach((p) => {
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

async function fetchComplaints() {
    const res = await apiFetch('/api/devops/complaints');
    if (!res.ok) {
        document.getElementById('complaintCount').innerText = 'Unable to load';
        return;
    }

    const complaints = await res.json();
    allComplaints = Array.isArray(complaints)
        ? [...complaints].sort((a, b) => {
            const parsedTimeA = Date.parse(a.created_at || '');
            const parsedTimeB = Date.parse(b.created_at || '');
            const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
            const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || 0) - (a.id || 0);
        })
        : [];
    renderComplaints();
}

function renderComplaints() {
    const tableBody = document.getElementById('complaintsInboxTable');
    const complaintCount = document.getElementById('complaintCount');
    const showMoreWrap = document.getElementById('showMoreComplaintsWrap');
    tableBody.innerHTML = '';
    const recentComplaints = allComplaints.slice(0, 2);

    if (complaintCount) {
        complaintCount.innerText = allComplaints.length > 2
            ? `Showing 2 of ${allComplaints.length} complaints`
            : `${allComplaints.length} complaint${allComplaints.length === 1 ? '' : 's'}`;
    }
    if (showMoreWrap) {
        showMoreWrap.style.display = 'block';
    }

    if (!allComplaints.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No complaints submitted yet</td></tr>';
        return;
    }

    recentComplaints.forEach((c) => {
        const statusClass = c.status === 'resolved' ? 'status-paid' : (c.status === 'in_review' ? 'status-approved' : 'status-pending');
        const row = document.createElement('tr');
        const details = String(c.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const subject = String(c.subject || 'General').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${c.reporter_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${c.member_id} | ${c.reporter_role}</div>
            </td>
            <td style="font-weight: 600;">${subject}</td>
            <td style="max-width: 420px; color: var(--text-muted); font-size: 0.85rem;">${details}</td>
            <td><span class="status-pill ${statusClass}">${c.status}</span></td>
            <td>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary complaint-action-btn" data-id="${c.id}" data-status="in_review" style="padding: 8px 12px; font-size: 0.7rem;">In Review</button>
                    <button class="btn btn-primary complaint-action-btn" data-id="${c.id}" data-status="resolved" style="padding: 8px 12px; font-size: 0.7rem;">Resolve</button>
                    <button class="btn complaint-action-btn" data-id="${c.id}" data-status="open" style="padding: 8px 12px; font-size: 0.7rem; background: transparent; border: 1px solid var(--glass-border); color: var(--text-muted);">Reopen</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    document.querySelectorAll('.complaint-action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.id);
            const status = btn.dataset.status;
            await updateComplaintStatus(id, status);
        });
    });
}

async function updateComplaintStatus(id, status) {
    try {
        const res = await apiFetch(`/api/devops/complaints/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            fetchComplaints();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to update complaint status');
        }
    } catch (err) {
        console.error('Complaint status error:', err);
    }
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.myKwezaPageTransition.go('/');
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
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to submit request');
        }
    } catch (err) {
        console.error('Withdrawal error:', err);
    }
});

document.getElementById('complaintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('complaintSubject').value.trim();
    const message = document.getElementById('complaintMessage').value.trim();
    if (!message) return alert('Please provide complaint details.');

    try {
        const res = await apiFetch('/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message })
        });
        if (res.ok) {
            alert('Complaint sent successfully.');
            document.getElementById('complaintForm').reset();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to submit complaint');
        }
    } catch (err) {
        console.error('Complaint submit error:', err);
    }
});

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
                    <span class="notification-time">${formatDateTime(n.created_at)}</span>
                </div>
                <div class="notification-card-title">${escapeHtml(n.title || 'Notification')}</div>
                <div class="notification-card-message">${escapeHtml(n.message || '')}</div>
            </div>
        `;

        card.onclick = () => {
            window.myKwezaPageTransition.go(`/notifications.html?id=${n.id}`);
        };

        listEl.appendChild(card);
    });
    lucide.createIcons();

    listEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (isScrollingNotifs) return;
        if (e.deltaY > 0) {
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
    }, { passive: false });

    let touchStartY = 0;
    listEl.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
    listEl.addEventListener('touchmove', (e) => {
        if (isScrollingNotifs) return;
        const touchY = e.touches[0].clientY;
        const diff = touchStartY - touchY;
        if (Math.abs(diff) > 30) {
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
            translateY = -120;
            scale = 0.8;
            opacity = 0;
            pointerEvents = 'none';
        } else if (relativeIndex === 0) {
            translateY = 0;
            scale = 1;
            opacity = 1;
        } else {
            translateY = relativeIndex * 12;
            scale = Math.max(0.7, 1 - (relativeIndex * 0.05));
            opacity = Math.max(0, 1 - (relativeIndex * 0.3));
        }

        card.style.transform = `translateY(${translateY}px) scale(${scale})`;
        card.style.opacity = opacity;
        card.style.pointerEvents = pointerEvents;
        card.style.zIndex = 100 - relativeIndex;
        card.style.filter = relativeIndex > 0 ? `blur(${relativeIndex * 2}px)` : 'none';
    });
}

loadDashboard();

