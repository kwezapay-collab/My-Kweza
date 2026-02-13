lucide.createIcons();

let currentUser = null;
let allComplaints = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

function setupEarningsCardToggle() {
    const card = document.getElementById('earningsCard');
    if (!card || card.dataset.toggleBound === '1') return;

    const toggleLabel = card.querySelector('.earnings-toggle-text');

    const applyState = (expanded) => {
        card.classList.toggle('is-expanded', expanded);
        card.classList.toggle('is-collapsed', !expanded);
        card.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (toggleLabel) {
            toggleLabel.innerText = expanded ? 'Hide' : 'Details';
        }
    };

    applyState(false);

    const toggle = () => applyState(!card.classList.contains('is-expanded'));

    card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, input, textarea, select, label')) return;
        toggle();
    });

    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
    });

    card.dataset.toggleBound = '1';
}

async function loadDashboard() {
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        currentUser = await res.json();

        if (currentUser.role !== 'Dev Operations Assistant') {
            if (currentUser.role === 'Super Admin') {
                window.location.href = '/super-admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
            return;
        }

        updateUI();
    } catch (err) {
        window.location.href = '/';
    }
}

function updateUI() {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.sub_role || currentUser.role;
    document.getElementById('memberId').innerText = `ID: ${currentUser.member_id}`;
    document.getElementById('welcomeText').innerText = `Welcome back, ${currentUser.name.split(' ')[0]} \u2764\uFE0F`;
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    setupEarningsCardToggle();

    const salary = Number(currentUser.salary || 0);
    const bonus = Number(currentUser.bonus || 0);
    const dividends = Number(currentUser.dividends || 0);
    document.getElementById('salaryVal').innerText = salary.toLocaleString();
    document.getElementById('bonusVal').innerText = bonus.toLocaleString();
    document.getElementById('dividendVal').innerText = dividends.toLocaleString();
    document.getElementById('totalVal').innerText = (salary + bonus + dividends).toLocaleString();
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

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
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

loadDashboard();
