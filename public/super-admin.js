// State management
let currentUser = null;
let allMembers = [];
let allPayouts = [];
let allUsers = [];
let allWithdrawals = [];
let allRevenue = [];
const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

// Initialize Dashboard
async function init() {
    try {
        // 1. Verify Authentication
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.myKwezaPageTransition.go('/');
            return;
        }

        currentUser = await res.json();
        if (currentUser.role !== 'Super Admin') {
            if (currentUser.role === 'Dev Operations Assistant') {
                window.myKwezaPageTransition.go('/dev-operations.html');
            } else {
                window.myKwezaPageTransition.go('/dashboard.html');
            }
            return;
        }

        // 2. Load Core Data
        await Promise.all([
            loadMembers(),
            loadPayouts(),
            loadSummary(),
            loadUsers(),
            loadWithdrawals(),
            loadRevenueHistory()
        ]);

        // 3. Setup UI Interactions
        setupEventListeners();

        // 4. Render Icons
        if (window.lucide) {
            lucide.createIcons();
        }

        console.log('Super Admin Console Initialized successfully');
    } catch (err) {
        console.error('Initialization error:', err);
    }
}

// Data Loading Functions
async function loadMembers() {
    try {
        const res = await apiFetch('/api/super/members');
        const members = await res.json();
        allMembers = Array.isArray(members) ? members : [];

        const select = document.getElementById('userId');
        if (select) {
            select.innerHTML = allMembers.map(m =>
                `<option value="${m.id}">${m.name} (${m.member_id})</option>`
            ).join('');
        }
    } catch (err) {
        console.error('Failed to load members:', err);
    }
}

async function loadPayouts() {
    try {
        const res = await apiFetch('/api/super/payouts');
        const payouts = await res.json();
        allPayouts = Array.isArray(payouts) ? payouts : [];
        renderPayouts();
        await loadSummary(); // Refresh cards whenever payouts change
    } catch (err) {
        console.error('Failed to load payouts:', err);
    }
}

async function loadSummary() {
    try {
        const res = await apiFetch('/api/admin/summary');
        const data = await res.json();

        document.getElementById('adminTotalRev').innerText = data.totalRevenue.toLocaleString();
        document.getElementById('adminTotalPay').innerText = data.totalPayouts.toLocaleString();
        document.getElementById('adminRemaining').innerText = data.remainingFunds.toLocaleString();

        const lrmText = document.getElementById('lrmStatusText');
        const lrmIcon = document.getElementById('lrmIcon');
        if (data.lowRevenueMode) {
            lrmText.innerText = 'ACTIVE';
            lrmText.style.color = 'var(--gold)';
            lrmIcon.setAttribute('data-lucide', 'shield-check');
            lrmIcon.style.color = 'var(--gold)';
        } else {
            lrmText.innerText = 'INACTIVE';
            lrmText.style.color = 'var(--text-muted)';
            lrmIcon.setAttribute('data-lucide', 'shield-off');
            lrmIcon.style.color = 'var(--text-muted)';
        }
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Failed to load summary:', err);
    }
}

// UI Rendering Functions
function renderPayouts() {
    const tableBody = document.getElementById('payoutsTable');
    if (!tableBody) return;

    const searchTerm = document.getElementById('memberSearch').value.toLowerCase();
    const typeFilter = document.getElementById('filterType').value;
    const monthFilter = document.getElementById('filterMonth').value;
    const yearFilter = document.getElementById('filterYear').value;

    const filtered = allPayouts.filter(p => {
        const name = (p.member_name || '').toLowerCase();
        const mid = (p.member_id || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || mid.includes(searchTerm);
        const matchesType = typeFilter === 'all' || p.type === typeFilter;
        const matchesMonth = monthFilter === 'all' || p.month === monthFilter;
        const matchesYear = yearFilter === 'all' || String(p.year) === yearFilter;
        return matchesSearch && matchesType && matchesMonth && matchesYear;
    });

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">No records found matching filters</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1.2rem 0;">
                <div style="font-weight: 600; color: var(--text-main);">${p.member_name}</div>
                <div style="font-size: 0.75rem; color: var(--accent); opacity: 0.8;">${p.member_id}</div>
            </td>
            <td>${p.month} ${p.year}</td>
            <td style="text-transform: capitalize; font-size: 0.85rem;">${p.type}</td>
            <td style="font-weight: 600;">MWK ${p.amount.toLocaleString()}</td>
            <td><span class="status-pill status-${p.status}">${p.status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="nav-icon-btn edit-btn" data-id="${p.id}"><i data-lucide="edit-2"></i></button>
                    <button class="nav-icon-btn delete-btn" data-id="${p.id}" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Re-initialize icons for new rows
    if (window.lucide) lucide.createIcons();

    // Attach listeners to dynamic buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => openModal('edit', parseInt(btn.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => deletePayout(parseInt(btn.dataset.id));
    });
}

// Modal Logic
function openModal(mode, id = null) {
    const modal = document.getElementById('payoutModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('payoutForm');
    const memberRow = document.getElementById('memberSelectRow');

    if (!modal || !form) return;

    form.reset();
    document.getElementById('payoutId').value = '';

    if (mode === 'add') {
        title.innerText = 'Add New Payout';
        memberRow.style.display = 'block';
    } else {
        title.innerText = 'Edit Payout Record';
        memberRow.style.display = 'none';

        const payout = allPayouts.find(p => p.id === id);
        if (payout) {
            document.getElementById('payoutId').value = payout.id;
            document.getElementById('userId').value = payout.user_id;
            document.getElementById('payoutType').value = payout.type;
            document.getElementById('payoutAmount').value = payout.amount;
            document.getElementById('payoutMonth').value = payout.month;
            document.getElementById('payoutYear').value = payout.year;
            document.getElementById('payoutStatus').value = payout.status;
        }
    }

    modal.style.display = 'flex';
    console.log('Modal opened:', mode);
}

function closeModal() {
    const modal = document.getElementById('payoutModal');
    if (modal) modal.style.display = 'none';
}

function openRevenueModal() {
    const modal = document.getElementById('revenueModal');
    if (modal) {
        modal.style.display = 'flex';
        const date = new Date();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('revMonth').value = months[date.getMonth()];
        document.getElementById('revYear').value = date.getFullYear();
    }
}

function closeRevenueModal() {
    const modal = document.getElementById('revenueModal');
    if (modal) modal.style.display = 'none';
}

// Event Listeners Setup
function setupEventListeners() {
    // Static filters
    document.getElementById('memberSearch')?.addEventListener('input', renderPayouts);
    document.getElementById('filterType')?.addEventListener('change', renderPayouts);
    document.getElementById('filterMonth')?.addEventListener('change', renderPayouts);
    document.getElementById('filterYear')?.addEventListener('change', renderPayouts);

    document.getElementById('userSearch')?.addEventListener('input', renderUsers);
    document.getElementById('userRoleFilter')?.addEventListener('change', renderUsers);

    document.getElementById('revSearch')?.addEventListener('input', renderRevenue);

    // Form submission
    document.getElementById('payoutForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('userForm')?.addEventListener('submit', handleUserSubmit);

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await apiFetch('/api/logout', { method: 'POST' });
        window.myKwezaPageTransition.go('/');
    });

    // Close modal on background click
    window.onclick = (event) => {
        const payModal = document.getElementById('payoutModal');
        const revModal = document.getElementById('revenueModal');
        const userModal = document.getElementById('userModal');
        if (event.target === payModal) closeModal();
        if (event.target === revModal) closeRevenueModal();
        if (event.target === userModal) closeUserModal();
    };

    document.getElementById('revenueForm')?.addEventListener('submit', handleRevenueSubmit);
    document.getElementById('complaintForm')?.addEventListener('submit', handleComplaintSubmit);

    // Global assignment for HTML onclick attributes
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.openRevenueModal = openRevenueModal;
    window.closeRevenueModal = closeRevenueModal;
    window.toggleLRM = toggleLRM;
    window.exportCSV = exportCSV;
    window.switchTab = switchTab;
    window.openUserModal = openUserModal;
    window.closeUserModal = closeUserModal;
    window.deleteUser = deleteUser;
    window.updateWithdrawalStatus = updateWithdrawalStatus;
}

// User Management Logic
async function loadUsers() {
    try {
        const res = await apiFetch('/api/super/members');
        allUsers = await res.json();
        renderUsers();
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function renderUsers() {
    const tableBody = document.getElementById('usersTable');
    if (!tableBody) return;

    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('userRoleFilter').value;

    const filtered = allUsers.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm) || u.member_id.toLowerCase().includes(searchTerm);
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    tableBody.innerHTML = '';
    filtered.forEach(u => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${u.name}</div>
                <div style="font-size: 0.75rem; color: var(--accent);">${u.member_id}</div>
            </td>
            <td>${u.role}</td>
            <td>${u.branch || '---'}</td>
            <td>
                <div style="font-size: 0.85rem; font-weight: 600;">S: ${u.salary?.toLocaleString() || 0}</div>
                <div style="font-size: 0.85rem; color: var(--gold);">B: ${u.bonus?.toLocaleString() || 0}</div>
                <div style="font-size: 0.85rem; color: var(--accent);">D: ${u.dividends?.toLocaleString() || 0}</div>
                ${u.dividend_fee_paid ? '<span style="font-size: 0.6rem; color: var(--accent); display: block;">Fee Paid</span>' : ''}
            </td>
            <td>
                <div class="action-btns">
                    <button class="nav-icon-btn" onclick="openUserModal('edit', ${u.id})"><i data-lucide="edit-2"></i></button>
                    <button class="nav-icon-btn" onclick="deleteUser(${u.id})" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    if (window.lucide) lucide.createIcons();
}

function openUserModal(mode, id = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const pinRow = document.getElementById('pinRow');

    form.reset();
    document.getElementById('editUserId').value = '';

    if (mode === 'add') {
        title.innerText = 'Add New User';
        pinRow.style.display = 'block';
    } else {
        title.innerText = 'Edit User';
        pinRow.style.display = 'none';
        const user = allUsers.find(u => u.id === id);
        if (user) {
            document.getElementById('editUserId').value = user.id;
            document.getElementById('userNameInput').value = user.name;
            document.getElementById('userMemberIdInput').value = user.member_id;
            document.getElementById('userRoleInput').value = user.role;
            document.getElementById('userBranchInput').value = user.branch || '';
            document.getElementById('userEmailInput').value = user.email || '';
            document.getElementById('userDividendInput').checked = user.can_receive_dividends === 1;
            document.getElementById('userDividendFeeInput').checked = user.dividend_fee_paid === 1;
            document.getElementById('userSalaryInput').value = user.salary || 0;
            document.getElementById('userBonusInput').value = user.bonus || 0;
            document.getElementById('userDividendsInput').value = user.dividends || 0;
        }
    }
    modal.style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const data = {
        name: document.getElementById('userNameInput').value,
        member_id: document.getElementById('userMemberIdInput').value,
        role: document.getElementById('userRoleInput').value,
        branch: document.getElementById('userBranchInput').value,
        email: document.getElementById('userEmailInput').value,
        can_receive_dividends: document.getElementById('userDividendInput').checked ? 1 : 0,
        dividend_fee_paid: document.getElementById('userDividendFeeInput').checked ? 1 : 0,
        salary: parseFloat(document.getElementById('userSalaryInput').value) || 0,
        bonus: parseFloat(document.getElementById('userBonusInput').value) || 0,
        dividends: parseFloat(document.getElementById('userDividendsInput').value) || 0
    };

    if (!id) {
        data.pin = document.getElementById('userPinInput').value;
        if (!data.pin) return alert('PIN is required for new users');
    }

    try {
        const url = id ? `/api/super/users/${id}` : '/api/super/users';
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeUserModal();
            loadUsers();
            loadMembers(); // Refresh dropdowns
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to save user');
        }
    } catch (err) {
        console.error('User save error:', err);
    }
}

async function deleteUser(id) {
    if (!confirm('Permanently delete this user?')) return;
    try {
        const res = await apiFetch(`/api/super/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadUsers();
            loadMembers();
        }
    } catch (err) {
        console.error('Delete user error:', err);
    }
}

// Withdrawal Management
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

async function loadWithdrawals() {
    try {
        const res = await apiFetch('/api/super/withdrawals');
        allWithdrawals = await res.json();
        renderWithdrawals();
        
        const pendingCount = allWithdrawals.filter(w => normalizeWithdrawalStatus(w.status) === 'pending').length;
        const badge = document.getElementById('withdrawalBadge');
        if (badge) {
            if (pendingCount > 0) {
                badge.innerText = pendingCount;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Failed to load withdrawals:', err);
    }
}

// Revenue Management Logic
async function loadRevenueHistory() {
    try {
        const res = await apiFetch('/api/super/revenue');
        allRevenue = await res.json();
        renderRevenue();
    } catch (err) {
        console.error('Failed to load revenue history:', err);
    }
}

function renderRevenue() {
    const tableBody = document.getElementById('revenueTable');
    if (!tableBody) return;

    const searchTerm = document.getElementById('revSearch').value.toLowerCase();

    const filtered = allRevenue.filter(r => {
        return (r.branch || '').toLowerCase().includes(searchTerm) || (r.submitter_name || '').toLowerCase().includes(searchTerm);
    });

    tableBody.innerHTML = '';
    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No revenue records found</td></tr>';
        return;
    }

    filtered.forEach(r => {
        const date = new Date(r.submitted_at).toLocaleDateString();
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1.2rem 0;">
                <div style="font-weight: 600;">${r.branch}</div>
            </td>
            <td>${r.month} ${r.year}</td>
            <td style="font-weight: 600; color: var(--accent);">MWK ${r.amount.toLocaleString()}</td>
            <td style="font-size: 0.85rem;">${r.submitter_name || 'System'}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${date}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderWithdrawals() {
    const tableBody = document.getElementById('withdrawalsTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (allWithdrawals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No withdrawal requests</td></tr>';
        return;
    }

    allWithdrawals.forEach(w => {
        const status = normalizeWithdrawalStatus(w.status);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 1rem 0;">
                <div style="font-weight: 600;">${w.member_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${w.member_id}</div>
            </td>
            <td style="font-weight: 600;">MWK ${w.amount.toLocaleString()}</td>
            <td>
                <div style="font-weight: 500;">${w.method}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${w.details}</div>
            </td>
            <td><span class="status-pill ${withdrawalStatusClass(status)}">${status}</span></td>
            <td>
                ${status === 'pending' ? `
                    <div class="action-btns">
                        <button class="btn btn-primary btn-sm" onclick="updateWithdrawalStatus(${w.id}, 'accepted')">Accept</button>
                        <button class="btn btn-secondary btn-sm" onclick="updateWithdrawalStatus(${w.id}, 'rejected')">Reject</button>
                    </div>
                ` : '---'}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function updateWithdrawalStatus(id, status) {
    try {
        const res = await apiFetch(`/api/super/withdrawals/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            loadWithdrawals();
        }
    } catch (err) {
        console.error('Update withdrawal error:', err);
    }
}

// Tab Switching Logic
function switchTab(section) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const sectionEl = document.getElementById(section + 'Section');
    if (sectionEl) sectionEl.classList.add('active');
    
    // Find the button that was clicked and activate it
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${section}'`)) {
            btn.classList.add('active');
        }
    });

    // Update main action button based on tab
    const mainBtn = document.getElementById('mainActionBtn');
    if (section === 'users') {
        mainBtn.onclick = () => openUserModal('add');
        mainBtn.querySelector('span').innerText = 'New User';
        mainBtn.style.visibility = 'visible';
    } else if (section === 'system') {
        mainBtn.onclick = () => openModal('add');
        mainBtn.querySelector('span').innerText = 'New Record';
        mainBtn.style.visibility = 'visible';
    } else if (section === 'revenue') {
        mainBtn.onclick = () => openRevenueModal();
        mainBtn.querySelector('span').innerText = 'Add Revenue';
        mainBtn.style.visibility = 'visible';
    } else if (section === 'complaints') {
        mainBtn.style.visibility = 'hidden';
    } else {
        mainBtn.style.visibility = 'hidden';
    }

    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (section === 'system') {
        pageTitle.innerText = 'System Management';
        pageSubtitle.innerText = 'Financial oversight & system-wide adjustments';
    } else if (section === 'users') {
        pageTitle.innerText = 'User Management';
        pageSubtitle.innerText = 'Manage system access and member roles';
    } else if (section === 'revenue') {
        pageTitle.innerText = 'Revenue Management';
        pageSubtitle.innerText = 'Track and log company income sources';
    } else if (section === 'complaints') {
        pageTitle.innerText = 'Report Complaint';
        pageSubtitle.innerText = 'Send issues to Dev Operations Assistant';
    } else {
        pageTitle.innerText = 'Withdrawal Requests';
        pageSubtitle.innerText = 'Process member payout requests';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('payoutId').value;
    const data = {
        user_id: document.getElementById('userId').value,
        type: document.getElementById('payoutType').value,
        amount: parseFloat(document.getElementById('payoutAmount').value),
        month: document.getElementById('payoutMonth').value,
        year: document.getElementById('payoutYear').value,
        status: document.getElementById('payoutStatus').value
    };

    try {
        const url = id ? `/api/super/payouts/${id}` : '/api/super/payouts';
        const method = id ? 'PUT' : 'POST';

        const res = await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            await loadPayouts(); // Refresh list
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to save payout record');
        }
    } catch (err) {
        console.error('Save error:', err);
        alert('An error occurred while saving.');
    }
}

async function handleRevenueSubmit(e) {
    e.preventDefault();
    const data = {
        amount: parseFloat(document.getElementById('revAmount').value),
        branch: document.getElementById('revBranch').value || 'System',
        month: document.getElementById('revMonth').value,
        year: document.getElementById('revYear').value
    };

    try {
        const res = await apiFetch('/api/super/revenue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeRevenueModal();
            document.getElementById('revenueForm').reset();
            await Promise.all([loadSummary(), loadRevenueHistory()]);
        } else {
            alert('Failed to add revenue');
        }
    } catch (err) {
        console.error('Revenue error:', err);
    }
}

async function handleComplaintSubmit(e) {
    e.preventDefault();
    const subject = document.getElementById('complaintSubject').value.trim();
    const message = document.getElementById('complaintMessage').value.trim();
    if (!message) return alert('Please provide complaint details');

    try {
        const res = await apiFetch('/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message })
        });

        if (res.ok) {
            alert('Complaint sent to Dev Operations Assistant');
            document.getElementById('complaintForm').reset();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to send complaint');
        }
    } catch (err) {
        console.error('Complaint submit error:', err);
    }
}

async function toggleLRM() {
    const currentStatus = document.getElementById('lrmStatusText').innerText === 'ACTIVE';
    const newValue = !currentStatus;

    try {
        const res = await apiFetch('/api/super/toggle-lrm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: newValue })
        });

        if (res.ok) {
            await loadSummary();
        }
    } catch (err) {
        console.error('LRM toggle error:', err);
    }
}

function exportCSV() {
    window.myKwezaPageTransition.go('/api/export/payouts');
}

async function deletePayout(id) {
    if (!confirm('Are you sure you want to delete this payout record permanently?')) return;

    try {
        const res = await apiFetch(`/api/super/payouts/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadPayouts();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to delete record');
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('An error occurred during deletion.');
    }
}

// Start Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
