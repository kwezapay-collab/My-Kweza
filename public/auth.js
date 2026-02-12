const apiFetch = (input, init = {}) => fetch(input, { credentials: 'include', ...init });

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const member_id = document.getElementById('memberId').value;
    const pin = document.getElementById('pin').value;
    const errorMsg = document.getElementById('errorMsg');

    try {
        const res = await apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id, pin })
        });

        const data = await res.json();

        if (res.ok) {
            if (data.user.role === 'Super Admin') {
                window.location.href = '/super-admin.html';
            } else if (data.user.role === 'Dev Operations Assistant') {
                window.location.href = '/dev-operations.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        } else {
            errorMsg.innerText = data.error || 'Login failed';
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.innerText = 'Network error. Please try again.';
        errorMsg.style.display = 'block';
    }
});
