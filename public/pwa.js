if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

const createMobileSplash = () => {
  const splash = document.createElement('div');
  splash.id = 'mobileSplash';
  splash.className = 'mobile-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = `
    <div class="mobile-splash-logo-wrap">
      <img src="/logo.png" alt="My Kweza Logo" class="mobile-splash-logo"
        onerror="this.src='https://placehold.co/220x220/1a4d6e/ffffff?text=My+Kweza'">
    </div>
  `;
  return splash;
};

const showMobileSplash = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;

  const seenKey = 'my-kweza-mobile-splash-seen';
  try {
    if (sessionStorage.getItem(seenKey) === '1') return;
    sessionStorage.setItem(seenKey, '1');
  } catch (err) {
    // Ignore storage errors; splash still displays.
  }

  const splash = createMobileSplash();
  document.body.appendChild(splash);

  const displayDuration = 900;
  setTimeout(() => splash.remove(), displayDuration);
};

window.addEventListener('DOMContentLoaded', showMobileSplash);
