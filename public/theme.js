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
  const MENU_HASH = '#menu';
  const MENU_HOME_STORAGE_KEY = 'my-kweza-menu-home-path';
  const NOTIFICATION_LAST_SEEN_KEY_PREFIX = 'my-kweza-notification-last-seen:';
  const NOTIFICATION_PERMISSION_PROMPT_KEY = 'my-kweza-notification-permission-requested';
  const NOTIFICATION_POLL_INTERVAL_MS = 45000;
  const NOTIFICATIONS_PAGE_PATH = '/notifications.html';

  const resolveMenuHomePathByRole = (role) => {
    if (role === 'Super Admin') return '/super-admin.html';
    if (role === 'Dev Operations Assistant') return '/dev-operations.html';
    return '/dashboard.html';
  };

  const inferMenuHomePathFromLocation = () => {
    const path = String(window.location.pathname || '').toLowerCase();
    if (path.endsWith('/super-admin.html')) return '/super-admin.html';
    if (path.endsWith('/dev-operations.html') || path.endsWith('/weekly-report.html') || path.endsWith('/complaints-history.html')) {
      return '/dev-operations.html';
    }
    return '/dashboard.html';
  };

  const setStoredMenuHomePath = (path) => {
    const normalized = String(path || '').trim();
    if (!normalized.startsWith('/')) return;
    try {
      sessionStorage.setItem(MENU_HOME_STORAGE_KEY, normalized);
    } catch (err) {
      // Ignore storage errors and continue.
    }
  };

  const getStoredMenuHomePath = (fallback = '/dashboard.html') => {
    const safeFallback = String(fallback || '/dashboard.html').startsWith('/')
      ? String(fallback || '/dashboard.html')
      : '/dashboard.html';
    try {
      const stored = String(sessionStorage.getItem(MENU_HOME_STORAGE_KEY) || '').trim();
      if (stored.startsWith('/')) return stored;
    } catch (err) {
      // Ignore storage errors and use fallback.
    }
    return safeFallback;
  };

  const buildMenuHomeUrl = (fallback = '/dashboard.html') => `${getStoredMenuHomePath(fallback)}${MENU_HASH}`;

  const createNotificationSeenStorageKey = (user) => {
    const identity = user?.member_id || user?.id || 'default';
    return `${NOTIFICATION_LAST_SEEN_KEY_PREFIX}${identity}`;
  };

  const readStoredNotificationSeenId = (user) => {
    const storageKey = createNotificationSeenStorageKey(user);
    try {
      const value = Number.parseInt(String(localStorage.getItem(storageKey) || '0'), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  };

  const saveStoredNotificationSeenId = (user, notificationId) => {
    const parsedId = Number(notificationId || 0);
    if (!Number.isFinite(parsedId) || parsedId <= 0) return;
    const storageKey = createNotificationSeenStorageKey(user);
    try {
      localStorage.setItem(storageKey, String(parsedId));
    } catch (err) {
      // Ignore storage errors and continue.
    }
  };

  const requestNotificationPermissionIfNeeded = async (user) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (!user || Number(user.notifications_enabled) !== 1) return;
    try {
      const hasPrompted = localStorage.getItem(NOTIFICATION_PERMISSION_PROMPT_KEY) === '1';
      if (hasPrompted) return;
      localStorage.setItem(NOTIFICATION_PERMISSION_PROMPT_KEY, '1');
    } catch (err) {
      // Ignore storage errors and continue with prompt attempt.
    }
    try {
      await Notification.requestPermission();
    } catch (err) {
      // Ignore notification prompt failures.
    }
  };

  const showSystemNotification = async (notification) => {
    if (!notification || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = String(notification.title || 'My Kweza');
    const body = String(notification.message || '').trim() || 'You have a new notification.';
    const targetUrl = String(notification.link_url || NOTIFICATIONS_PAGE_PATH).trim() || NOTIFICATIONS_PAGE_PATH;
    const options = {
      body,
      icon: '/icons/kweza-192.png',
      badge: '/icons/kweza-192.png',
      tag: `my-kweza-notification-${notification.id || Date.now()}`,
      data: { url: targetUrl }
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, options);
          return;
        }
      }
    } catch (err) {
      // Fall back to Notification API below.
    }

    try {
      // Fallback path for browsers that support Notification but not registration.showNotification.
      // eslint-disable-next-line no-new
      new Notification(title, options);
    } catch (err) {
      // Ignore browser notification errors.
    }
  };

  const PROFILE_PHOTO_KEY_PREFIX = 'my-kweza-profile-photo:';
  const PROFILE_HEADER_BG_KEY_PREFIX = 'my-kweza-profile-header-bg:';
  const PROFILE_HEADER_GRADIENT = 'linear-gradient(140deg, rgba(30, 182, 123, 0.88) 0%, rgba(26, 77, 110, 0.94) 46%, rgba(200, 86, 26, 0.9) 100%)';
  const DEFAULT_AVATAR_DATA_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2ecc71"/><stop offset="100%" stop-color="#1a4d6e"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="45" r="18" fill="#ffffff"/><path d="M24 97c4-16 18-26 36-26s32 10 36 26" fill="#ffffff"/></svg>'
  )}`;

  const createProfilePhotoStorageKey = (user) => {
    const identity = user?.member_id || user?.id || 'default';
    return `${PROFILE_PHOTO_KEY_PREFIX}${identity}`;
  };

  const readStoredProfilePhoto = (user) => {
    const fallbackKey = `${PROFILE_PHOTO_KEY_PREFIX}default`;
    const storageKey = createProfilePhotoStorageKey(user);
    try {
      const exact = localStorage.getItem(storageKey);
      if (exact) return exact;
      return localStorage.getItem(fallbackKey);
    } catch (err) {
      return null;
    }
  };

  const createProfileHeaderBackgroundStorageKey = (user) => {
    const identity = user?.member_id || user?.id || 'default';
    return `${PROFILE_HEADER_BG_KEY_PREFIX}${identity}`;
  };

  const readStoredProfileHeaderBackground = (user) => {
    const fallbackKey = `${PROFILE_HEADER_BG_KEY_PREFIX}default`;
    const storageKey = createProfileHeaderBackgroundStorageKey(user);
    try {
      const exact = localStorage.getItem(storageKey);
      if (exact) return exact;
      return localStorage.getItem(fallbackKey);
    } catch (err) {
      return null;
    }
  };

  const saveStoredProfileHeaderBackground = (user, value) => {
    const fallbackKey = `${PROFILE_HEADER_BG_KEY_PREFIX}default`;
    const storageKey = createProfileHeaderBackgroundStorageKey(user);
    try {
      localStorage.setItem(storageKey, value);
      localStorage.setItem(fallbackKey, value);
      return true;
    } catch (err) {
      return false;
    }
  };

  const buildProfileHeaderBackgroundCss = (imageDataUrl = '') => {
    const normalizedUrl = String(imageDataUrl || '').trim();
    if (!normalizedUrl) return PROFILE_HEADER_GRADIENT;
    return `${PROFILE_HEADER_GRADIENT}, url("${normalizedUrl}")`;
  };

  const saveStoredProfilePhoto = (user, value) => {
    const fallbackKey = `${PROFILE_PHOTO_KEY_PREFIX}default`;
    const storageKey = createProfilePhotoStorageKey(user);
    try {
      localStorage.setItem(storageKey, value);
      localStorage.setItem(fallbackKey, value);
      return true;
    } catch (err) {
      return false;
    }
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  const compressImageDataUrl = (dataUrl, maxSide = 320, quality = 0.82) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const largestSide = Math.max(image.width || 1, image.height || 1);
        const scale = Math.min(1, maxSide / largestSide);
        const width = Math.max(1, Math.round((image.width || 1) * scale));
        const height = Math.max(1, Math.round((image.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(dataUrl);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });

  const setupDashboardNavMenu = () => {
    const nav = document.querySelector('.dashboard-nav');
    if (!nav || !document.body) return;

    const userActions = nav.querySelector('.user-actions') || (() => {
      const wrap = document.createElement('div');
      wrap.className = 'user-actions';
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '1rem';
      nav.appendChild(wrap);
      return wrap;
    })();

    if (userActions.querySelector('#navMenuToggleBtn')) {
      document.body.classList.add('nav-hamburger-enabled');
      return;
    }

    const menuWrap = document.createElement('div');
    menuWrap.className = 'nav-hamburger-wrap';
    menuWrap.innerHTML = `
      <button id="navMenuToggleBtn" type="button" class="nav-icon-btn nav-hamburger-btn" aria-label="Open menu" aria-expanded="false" aria-haspopup="true">
        <i data-lucide="menu"></i>
      </button>
      <div class="nav-hamburger-menu" role="menu" aria-label="Navigation menu">
        <div class="nav-menu-profile">
          <div class="nav-menu-top-actions">
            <button id="navMenuBgEditBtn" class="nav-menu-bg-toggle" type="button" aria-label="Change profile header background" title="Change profile header background">
              <i data-lucide="image-plus"></i>
            </button>
            <button id="navMenuThemeToggleBtn" class="nav-menu-theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme">
              <i id="navMenuThemeToggleIcon" data-lucide="sun-moon"></i>
            </button>
            <button id="navMenuCloseBtn" class="nav-menu-close" type="button" aria-label="Close menu">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="nav-menu-avatar-wrap">
            <img id="navMenuAvatar" class="nav-menu-avatar" src="${DEFAULT_AVATAR_DATA_URI}" alt="Profile picture">
            <button id="navMenuAvatarEditBtn" class="nav-menu-avatar-edit" type="button" aria-label="Change profile picture">
              <i data-lucide="camera"></i>
            </button>
            <input id="navMenuAvatarInput" class="nav-menu-avatar-input" type="file" accept="image/*">
            <input id="navMenuBgInput" class="nav-menu-avatar-input" type="file" accept="image/*">
          </div>
          <p id="navMenuProfileName" class="nav-menu-profile-name">Employee</p>
          <p id="navMenuProfileMember" class="nav-menu-profile-member">Member ID: --</p>
          <p id="navMenuProfileDetails" class="nav-menu-profile-details">Role: -- | Branch: --</p>
        </div>
        <div class="nav-menu-items">
          <a id="navMenuNotificationsLink" class="nav-menu-link ${window.location.pathname.endsWith('/notifications.html') ? 'active' : ''}" role="menuitem" href="/notifications.html">
            <i data-lucide="bell"></i>
            <span>Notifications</span>
            <span id="navMenuNotificationBadge" class="nav-menu-badge" style="display: none;">0</span>
          </a>
          <a id="navMenuComplaintsLink" class="nav-menu-link ${window.location.pathname.endsWith('/complaints-history.html') ? 'active' : ''}" role="menuitem" href="/complaints-history.html" style="display: none;">
            <i data-lucide="inbox"></i>
            <span>Complaint Reports Inbox</span>
          </a>
          <a class="nav-menu-link ${window.location.pathname.endsWith('/withdrawals-history.html') ? 'active' : ''}" role="menuitem" href="/withdrawals-history.html">
            <i data-lucide="wallet"></i>
            <span>My Withdrawal Requests</span>
          </a>
          <a id="navMenuFinancialQueueLink" class="nav-menu-link ${window.location.pathname.endsWith('/financial-withdrawals-history.html') ? 'active' : ''}" role="menuitem" href="/financial-withdrawals-history.html" style="display: none;">
            <i data-lucide="inbox"></i>
            <span>Financial Manager Withdrawal Queue</span>
          </a>
          <a id="navMenuCompensationLink" class="nav-menu-link ${window.location.pathname.endsWith('/compensation-management.html') ? 'active' : ''}" role="menuitem" href="/compensation-management.html" style="display: none;">
            <i data-lucide="wallet-cards"></i>
            <span>Compensation Management</span>
          </a>
          <a class="nav-menu-link ${window.location.pathname.endsWith('/payouts-history.html') ? 'active' : ''}" role="menuitem" href="/payouts-history.html">
            <i data-lucide="history"></i>
            <span>Recent Payouts</span>
          </a>
          <a class="nav-menu-link ${window.location.pathname.endsWith('/settings.html') ? 'active' : ''}" role="menuitem" href="/settings.html">
            <i data-lucide="settings"></i>
            <span>Settings</span>
          </a>
          <button class="nav-menu-link nav-menu-logout" role="menuitem" type="button">
            <i data-lucide="log-out"></i>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    `;
    userActions.appendChild(menuWrap);

    const toggleBtn = menuWrap.querySelector('#navMenuToggleBtn');
    const menu = menuWrap.querySelector('.nav-hamburger-menu');
    const menuLinks = menuWrap.querySelectorAll('a.nav-menu-link');
    const notificationsLink = menuWrap.querySelector('#navMenuNotificationsLink');
    const notificationsBadge = menuWrap.querySelector('#navMenuNotificationBadge');
    const complaintsLink = menuWrap.querySelector('#navMenuComplaintsLink');
    const financialQueueLink = menuWrap.querySelector('#navMenuFinancialQueueLink');
    const compensationLink = menuWrap.querySelector('#navMenuCompensationLink');
    const logoutBtn = menuWrap.querySelector('.nav-menu-logout');
    const closeBtn = menuWrap.querySelector('#navMenuCloseBtn');
    const themeToggleBtn = menuWrap.querySelector('#navMenuThemeToggleBtn');
    const themeToggleIcon = menuWrap.querySelector('#navMenuThemeToggleIcon');
    const profilePanel = menuWrap.querySelector('.nav-menu-profile');
    const bgEditBtn = menuWrap.querySelector('#navMenuBgEditBtn');
    const bgInput = menuWrap.querySelector('#navMenuBgInput');
    const legacyLogoutBtn = nav.querySelector('#logoutBtn');
    const profileName = menuWrap.querySelector('#navMenuProfileName');
    const profileMember = menuWrap.querySelector('#navMenuProfileMember');
    const profileDetails = menuWrap.querySelector('#navMenuProfileDetails');
    const avatarImage = menuWrap.querySelector('#navMenuAvatar');
    const avatarEditBtn = menuWrap.querySelector('#navMenuAvatarEditBtn');
    const avatarInput = menuWrap.querySelector('#navMenuAvatarInput');
    let menuHomePath = getStoredMenuHomePath(inferMenuHomePathFromLocation());

    let currentMenuUser = null;
    let notificationsLastSeenId = 0;
    let notificationsPollTimer = null;
    let notificationsPollingInFlight = false;

    const refreshThemeToggleIcon = () => {
      const activeTheme = window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark';
      if (!themeToggleIcon) return;
      themeToggleIcon.setAttribute('data-lucide', activeTheme === 'light' ? 'moon' : 'sun');
      if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }
    };

    const updateProfileHeader = (user) => {
      if (!profileName || !profileMember || !profileDetails) return;
      const userName = String(user?.name || '').trim() || 'Employee';
      const userRole = String(user?.sub_role || user?.role || '').trim() || '--';
      const memberId = String(user?.member_id || '').trim() || '--';
      const userBranch = String(user?.branch || '').trim() || 'Not assigned';

      profileName.textContent = userName;
      profileMember.textContent = `Member ID: ${memberId}`;
      profileDetails.textContent = `Role: ${userRole} | Branch: ${userBranch}`;
    };

    const applyStoredProfilePhoto = (user) => {
      if (!avatarImage) return;
      const storedPhoto = readStoredProfilePhoto(user);
      avatarImage.src = storedPhoto || DEFAULT_AVATAR_DATA_URI;
    };

    const applyStoredProfileHeaderBackground = (user) => {
      if (!profilePanel) return;
      const storedBackground = readStoredProfileHeaderBackground(user);
      profilePanel.style.backgroundImage = buildProfileHeaderBackgroundCss(storedBackground || '');
      profilePanel.style.backgroundPosition = 'center';
      profilePanel.style.backgroundRepeat = 'no-repeat';
      profilePanel.style.backgroundSize = storedBackground ? 'cover' : 'auto';
    };

    const updateNotificationBadge = async () => {
      if (!notificationsBadge) return;
      try {
        const response = await fetch('/api/notifications/unread-count', { credentials: 'include' });
        if (!response.ok) return;
        const payload = await response.json();
        const unreadCount = Number.parseInt(String(payload?.unread_count || '0'), 10);
        const count = Number.isFinite(unreadCount) && unreadCount > 0 ? unreadCount : 0;
        if (count > 0) {
          notificationsBadge.style.display = 'inline-flex';
          notificationsBadge.textContent = count > 99 ? '99+' : String(count);
        } else {
          notificationsBadge.style.display = 'none';
          notificationsBadge.textContent = '0';
        }
      } catch (err) {
        // Ignore notification badge update failures.
      }
    };

    const pollNotificationUpdates = async (options = {}) => {
      if (!currentMenuUser || notificationsPollingInFlight) return;
      notificationsPollingInFlight = true;
      try {
        const shouldNotify = Boolean(options.shouldNotify);
        const query = new URLSearchParams();
        query.set('limit', '30');
        if (notificationsLastSeenId > 0) {
          query.set('since_id', String(notificationsLastSeenId));
        }

        const response = await fetch(`/api/notifications?${query.toString()}`, { credentials: 'include' });
        if (!response.ok) {
          await updateNotificationBadge();
          return;
        }

        const rows = await response.json();
        const notifications = Array.isArray(rows) ? rows : [];
        let highestId = notificationsLastSeenId;
        for (const item of notifications) {
          const itemId = Number.parseInt(String(item?.id || '0'), 10);
          if (Number.isFinite(itemId) && itemId > highestId) {
            highestId = itemId;
          }
          if (shouldNotify && Number(currentMenuUser.notifications_enabled) === 1) {
            await showSystemNotification(item);
          }
        }

        if (highestId > notificationsLastSeenId) {
          notificationsLastSeenId = highestId;
          saveStoredNotificationSeenId(currentMenuUser, notificationsLastSeenId);
        }

        await updateNotificationBadge();
      } catch (err) {
        // Ignore polling failures and retry on next interval.
      } finally {
        notificationsPollingInFlight = false;
      }
    };

    const startNotificationPolling = async (user) => {
      if (!notificationsLink || !notificationsBadge || !user) return;
      currentMenuUser = user;

      notificationsLastSeenId = readStoredNotificationSeenId(user);
      if (notificationsLastSeenId <= 0) {
        try {
          const latestResponse = await fetch('/api/notifications?limit=1', { credentials: 'include' });
          if (latestResponse.ok) {
            const latestRows = await latestResponse.json();
            const latest = Array.isArray(latestRows) && latestRows.length ? latestRows[0] : null;
            const latestId = Number.parseInt(String(latest?.id || '0'), 10);
            if (Number.isFinite(latestId) && latestId > 0) {
              notificationsLastSeenId = latestId;
              saveStoredNotificationSeenId(user, notificationsLastSeenId);
            }
          }
        } catch (err) {
          // Ignore baseline fetch failures.
        }
      }

      await updateNotificationBadge();
      await requestNotificationPermissionIfNeeded(user);

      if (notificationsPollTimer) {
        clearInterval(notificationsPollTimer);
      }
      notificationsPollTimer = setInterval(() => {
        pollNotificationUpdates({ shouldNotify: true });
      }, NOTIFICATION_POLL_INTERVAL_MS);
    };

    const hydrateProfileHeader = async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (!response.ok) return;
        const user = await response.json();
        currentMenuUser = user;
        menuHomePath = resolveMenuHomePathByRole(user.role);
        setStoredMenuHomePath(menuHomePath);
        updateProfileHeader(user);
        applyStoredProfilePhoto(user);
        applyStoredProfileHeaderBackground(user);
        const isFinancialManager = user.role === 'Financial Manager';
        const isDevOpsAssistant = user.role === 'Dev Operations Assistant';
        if (complaintsLink) {
          complaintsLink.style.display = isDevOpsAssistant ? 'flex' : 'none';
        }
        if (financialQueueLink) {
          financialQueueLink.style.display = isFinancialManager ? 'flex' : 'none';
        }
        if (compensationLink) {
          compensationLink.style.display = isFinancialManager ? 'flex' : 'none';
        }
        await startNotificationPolling(user);
      } catch (err) {
        const fallbackUser = {
          name: nav.querySelector('#userName')?.textContent || 'Employee',
          role: nav.querySelector('#userRole')?.textContent || '--',
          member_id: nav.querySelector('#memberId')?.textContent?.replace(/^ID:\s*/i, '') || '--'
        };
        menuHomePath = getStoredMenuHomePath(inferMenuHomePathFromLocation());
        setStoredMenuHomePath(menuHomePath);
        updateProfileHeader(fallbackUser);
        applyStoredProfilePhoto(fallbackUser);
        applyStoredProfileHeaderBackground(fallbackUser);
        if (complaintsLink) {
          complaintsLink.style.display = 'none';
        }
        if (financialQueueLink) {
          financialQueueLink.style.display = 'none';
        }
        if (compensationLink) {
          compensationLink.style.display = 'none';
        }
        if (notificationsBadge) {
          notificationsBadge.style.display = 'none';
          notificationsBadge.textContent = '0';
        }
      }
    };

    const setMenuHashOnCurrentEntry = () => {
      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.hash === MENU_HASH) return;
        currentUrl.hash = MENU_HASH;
        window.history.replaceState(window.history.state, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
      } catch (err) {
        // Ignore URL state update failures.
      }
    };

    const clearMenuHashFromCurrentEntry = () => {
      if (window.location.hash !== MENU_HASH) return;
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      } catch (err) {
        // Ignore URL state update failures.
      }
    };

    const closeMenu = ({ preserveHash = false } = {}) => {
      menuWrap.classList.remove('is-open');
      toggleBtn?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-menu-open');
      if (!preserveHash) {
        clearMenuHashFromCurrentEntry();
      }
    };

    const openMenu = () => {
      menuWrap.classList.add('is-open');
      toggleBtn?.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-menu-open');
      setStoredMenuHomePath(menuHomePath);
      setMenuHashOnCurrentEntry();
    };

    toggleBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (menuWrap.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menu?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    closeBtn?.addEventListener('click', () => {
      closeMenu();
    });

    themeToggleBtn?.addEventListener('click', async () => {
      const activeTheme = window.themeManager?.getTheme ? window.themeManager.getTheme() : 'dark';
      const nextTheme = activeTheme === 'light' ? 'dark' : 'light';

      if (window.themeManager?.setTheme) {
        window.themeManager.setTheme(nextTheme, true);
      }
      refreshThemeToggleIcon();

      try {
        if (currentMenuUser) {
          await fetch('/api/profile/update', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: currentMenuUser.email || '',
              notifications_enabled: Boolean(currentMenuUser.notifications_enabled),
              theme_mode: nextTheme
            })
          });
          currentMenuUser.theme_mode = nextTheme;
        }
      } catch (err) {
        // Keep local theme change even if server sync fails.
      }
    });

    menuLinks.forEach((link) => {
      link.addEventListener('click', () => {
        setStoredMenuHomePath(menuHomePath);
        closeMenu({ preserveHash: true });
      });
    });

    bgEditBtn?.addEventListener('click', () => {
      bgInput?.click();
    });

    bgInput?.addEventListener('change', async () => {
      const file = bgInput.files?.[0];
      if (!file) return;

      if (!String(file.type || '').startsWith('image/')) {
        alert('Please choose an image file.');
        bgInput.value = '';
        return;
      }

      if ((file.size || 0) > 10 * 1024 * 1024) {
        alert('Please choose an image smaller than 10MB.');
        bgInput.value = '';
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        const compressed = await compressImageDataUrl(dataUrl, 1280, 0.78);
        if (profilePanel) {
          profilePanel.style.backgroundImage = buildProfileHeaderBackgroundCss(compressed);
          profilePanel.style.backgroundPosition = 'center';
          profilePanel.style.backgroundRepeat = 'no-repeat';
          profilePanel.style.backgroundSize = 'cover';
        }
        const isSaved = saveStoredProfileHeaderBackground(currentMenuUser, compressed);
        if (!isSaved) {
          alert('Could not save header background locally. Storage may be full.');
        }
      } catch (err) {
        alert('Failed to update profile header background.');
      } finally {
        bgInput.value = '';
      }
    });

    avatarEditBtn?.addEventListener('click', () => {
      avatarInput?.click();
    });

    avatarImage?.addEventListener('click', () => {
      avatarInput?.click();
    });

    avatarInput?.addEventListener('change', async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;

      if (!String(file.type || '').startsWith('image/')) {
        alert('Please choose an image file.');
        avatarInput.value = '';
        return;
      }

      if ((file.size || 0) > 8 * 1024 * 1024) {
        alert('Please choose an image smaller than 8MB.');
        avatarInput.value = '';
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        const compressed = await compressImageDataUrl(dataUrl);
        if (avatarImage) avatarImage.src = compressed;
        const isSaved = saveStoredProfilePhoto(currentMenuUser, compressed);
        if (!isSaved) {
          alert('Could not save profile photo locally. Storage may be full.');
        }
      } catch (err) {
        alert('Failed to update profile picture.');
      } finally {
        avatarInput.value = '';
      }
    });

    document.addEventListener('click', () => {
      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        pollNotificationUpdates({ shouldNotify: false });
      }
    });

    logoutBtn?.addEventListener('click', async () => {
      closeMenu();
      if (notificationsPollTimer) {
        clearInterval(notificationsPollTimer);
        notificationsPollTimer = null;
      }
      if (legacyLogoutBtn) {
        legacyLogoutBtn.click();
        return;
      }
      try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      } finally {
        window.location.href = '/';
      }
    });

    document.body.classList.add('nav-hamburger-enabled');
    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
    refreshThemeToggleIcon();
    applyStoredProfileHeaderBackground(currentMenuUser);
    hydrateProfileHeader();
    if (window.location.hash === MENU_HASH) {
      openMenu();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const activeTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || initialTheme);
    applyThemeClass(activeTheme);
    setupDashboardNavMenu();
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
  window.myKwezaMenu = {
    menuHash: MENU_HASH,
    getHomePath(fallback = '/dashboard.html') {
      return getStoredMenuHomePath(fallback);
    },
    getHomeUrl(fallback = '/dashboard.html') {
      return buildMenuHomeUrl(fallback);
    }
  };
})();
