lucide.createIcons();

let currentUser = null;
const dashboardPath = '/dev-operations.html';
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateValue) {
    if (!dateValue) return '--';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function statusClass(status) {
    if (status === 'resolved') return 'status-paid';
    if (status === 'in_review') return 'status-approved';
    return 'status-pending';
}

function updateHeader() {
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.innerText = currentUser.name;
    const userRoleEl = document.getElementById('userRole'); if (userRoleEl) userRoleEl.innerText = currentUser.sub_role || currentUser.role;
    const memberIdEl = document.getElementById('memberId'); if (memberIdEl) memberIdEl.innerText = `ID: ${currentUser.member_id}`;
}

function attachActionHandlers() {
    document.querySelectorAll('.complaint-action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.id);
            const status = btn.dataset.status;
            await updateComplaintStatus(id, status);
        });
    });
}

function renderComplaints(complaints) {
    const tableBody = document.getElementById('historyComplaintsTable');
    const historyCount = document.getElementById('historyCount');
    tableBody.innerHTML = '';

    if (!complaints.length) {
        historyCount.innerText = 'No complaints found.';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No complaints found</td></tr>';
        return;
    }

    historyCount.innerText = `${complaints.length} complaint${complaints.length === 1 ? '' : 's'} found`;

    complaints.forEach((complaint) => {
        const row = document.createElement('tr');
        const details = escapeHtml(complaint.message || '');
        const subject = escapeHtml(complaint.subject || 'General');
        const reporterName = escapeHtml(complaint.reporter_name || 'Unknown');
        const reporterMeta = `${escapeHtml(complaint.member_id || '--')} | ${escapeHtml(complaint.reporter_role || '--')}`;
        const currentStatus = escapeHtml(complaint.status || 'open');
        const createdAt = formatDate(complaint.created_at);

        row.innerHTML = `
            <td style="padding: 1rem 0; white-space: nowrap;">${createdAt}</td>
            <td>
                <div style="font-weight: 600;">${reporterName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${reporterMeta}</div>
            </td>
            <td style="font-weight: 600; min-width: 150px;">${subject}</td>
            <td style="max-width: 420px; color: var(--text-muted); font-size: 0.85rem;">${details}</td>
            <td><span class="status-pill ${statusClass(complaint.status)}">${currentStatus}</span></td>
            <td>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary complaint-action-btn" data-id="${complaint.id}" data-status="in_review" style="padding: 8px 12px; font-size: 0.7rem;">In Review</button>
                    <button class="btn btn-primary complaint-action-btn" data-id="${complaint.id}" data-status="resolved" style="padding: 8px 12px; font-size: 0.7rem;">Resolve</button>
                    <button class="btn complaint-action-btn" data-id="${complaint.id}" data-status="open" style="padding: 8px 12px; font-size: 0.7rem; background: transparent; border: 1px solid var(--glass-border); color: var(--text-muted);">Reopen</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachActionHandlers();
}

async function fetchComplaints() {
    const res = await apiFetch('/api/devops/complaints');
    if (!res.ok) {
        document.getElementById('historyCount').innerText = 'Unable to load complaints.';
        return;
    }

    const complaints = await res.json();
    const sortedComplaints = Array.isArray(complaints)
        ? [...complaints].sort((a, b) => {
            const parsedTimeA = Date.parse(a.created_at || '');
            const parsedTimeB = Date.parse(b.created_at || '');
            const timeA = Number.isFinite(parsedTimeA) ? parsedTimeA : 0;
            const timeB = Number.isFinite(parsedTimeB) ? parsedTimeB : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || 0) - (a.id || 0);
        })
        : [];
    renderComplaints(sortedComplaints);
}

async function updateComplaintStatus(id, status) {
    try {
        const res = await apiFetch(`/api/devops/complaints/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            await fetchComplaints();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to update complaint status');
        }
    } catch (err) {
        console.error('Complaint status error:', err);
    }
}

async function loadComplaintsHistory() {
    try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await meRes.json();

        if (currentUser.role !== 'Dev Operations Assistant') {
            if (currentUser.role === 'Super Admin') {
                window.location.href = '/super-admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
            return;
        }

        updateHeader();
        await fetchComplaints();
    } catch (err) {
        window.location.href = '/';
    }
}

document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    window.location.href = dashboardPath;
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

loadComplaintsHistory();
