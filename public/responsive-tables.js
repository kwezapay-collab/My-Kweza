(function () {
    const TABLE_SELECTOR = 'table.mobile-stack';

    function normalizeLabel(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/[_-]+/g, ' ')
            .trim();
    }

    function setLabels(table) {
        if (!table) return;
        const headers = Array.from(table.querySelectorAll('thead th')).map((header) =>
            normalizeLabel(header.textContent)
        );

        if (!headers.length) return;

        table.querySelectorAll('tbody tr').forEach((row) => {
            const cells = Array.from(row.children).filter((cell) => cell.tagName === 'TD');
            cells.forEach((cell, index) => {
                if (cell.hasAttribute('colspan')) {
                    cell.removeAttribute('data-label');
                    return;
                }

                const label = headers[index] || '';
                if (label) {
                    cell.setAttribute('data-label', label);
                } else {
                    cell.removeAttribute('data-label');
                }
            });
        });
    }

    function observeTable(table) {
        const body = table.querySelector('tbody');
        if (!body || body.dataset.mobileObserverAttached === '1') return;

        const observer = new MutationObserver(() => {
            setLabels(table);
        });

        observer.observe(body, { childList: true, subtree: true });
        body.dataset.mobileObserverAttached = '1';
    }

    function applyResponsiveTableLabels(root = document) {
        root.querySelectorAll(TABLE_SELECTOR).forEach((table) => {
            setLabels(table);
            observeTable(table);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyResponsiveTableLabels());
    } else {
        applyResponsiveTableLabels();
    }

    window.applyResponsiveTableLabels = applyResponsiveTableLabels;
})();
