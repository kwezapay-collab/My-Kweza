(function () {
  const STORAGE_KEY = 'my-kweza-theme';

  const normalizeTheme = (value) => (value === 'light' ? 'light' : 'dark');

  const readStoredTheme = () => {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      return 'dark';
    }
  };

  const setStoredTheme = (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      // Ignore storage errors and continue with runtime theme.
    }
  };

  const syncDevOpsClassForTheme = (theme) => {
    if (!document.body) return;

    if (!document.body.dataset.devopsThemeInitialized) {
      document.body.dataset.devopsThemeInitialized = '1';
      document.body.dataset.useDevopsTheme = document.body.classList.contains('devops-purple-theme') ? '1' : '0';
    }

    if (document.body.dataset.useDevopsTheme === '1') {
      // DevOps pages keep purple in dark mode and switch to global light styling in light mode.
      document.body.classList.toggle('devops-purple-theme', theme !== 'light');
    }
  };

  const applyThemeClass = (theme) => {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light-mode', isLight);
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.classList.toggle('light-mode', isLight);
      syncDevOpsClassForTheme(theme);
    }
  };

  const applyTheme = (theme, persist = true) => {
    const normalized = normalizeTheme(theme);
    applyThemeClass(normalized);
    if (persist) setStoredTheme(normalized);
    return normalized;
  };

  const initialTheme = readStoredTheme();
  applyThemeClass(initialTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const activeTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || initialTheme);
    applyThemeClass(activeTheme);
  });

  window.themeManager = {
    storageKey: STORAGE_KEY,
    getTheme() {
      return normalizeTheme(document.documentElement.getAttribute('data-theme') || readStoredTheme());
    },
    setTheme(theme, persist = true) {
      return applyTheme(theme, persist);
    },
    syncFromServer(theme) {
      return applyTheme(theme, true);
    }
  };
})();
