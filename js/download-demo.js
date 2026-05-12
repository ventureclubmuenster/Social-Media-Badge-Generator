/* Download Methods Demo — 9 variants, all targeting assets/foreground v3.png */

(function () {
  'use strict';

  const DEMO_IMAGE = 'assets/foreground%20v3.png';
  const DEMO_FILENAME = 'foreground-v3.png';

  // Environment detection
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp = detectInApp(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function detectInApp(ua) {
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
    if (/Line\//i.test(ua)) return 'LINE';
    if (/Twitter/i.test(ua)) return 'Twitter / X';
    if (/TikTok/i.test(ua)) return 'TikTok';
    if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
    if (/Snapchat/i.test(ua)) return 'Snapchat';
    if (/Pinterest/i.test(ua)) return 'Pinterest';
    if (/WhatsApp/i.test(ua)) return 'WhatsApp';
    if (/Threads/i.test(ua)) return 'Threads';
    if (/; wv\)/i.test(ua)) return 'Android WebView';
    return null;
  }

  // Render environment info
  function renderEnv() {
    const env = document.getElementById('demoEnv');
    const parts = [];
    parts.push('Platform: <strong>' + (isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop / Other') + '</strong>');
    parts.push('Browser: <strong>' + (inApp ? inApp + ' (In-App)' : 'normal') + '</strong>');
    parts.push('PWA: <strong>' + (isStandalone ? 'yes' : 'no') + '</strong>');
    const features = [];
    if (navigator.canShare) features.push('canShare');
    if (window.ClipboardItem) features.push('ClipboardItem');
    if ('serviceWorker' in navigator) features.push('SW');
    parts.push('Features: <strong>' + (features.join(', ') || 'none') + '</strong>');
    env.innerHTML = parts.join(' · ');
  }

  function setStatus(key, msg, kind) {
    const el = document.querySelector('[data-status="' + key + '"]');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('is-ok', 'is-err');
    if (kind === 'ok') el.classList.add('is-ok');
    else if (kind === 'err') el.classList.add('is-err');
  }

  async function fetchBlob() {
    const res = await fetch(DEMO_IMAGE);
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    return await res.blob();
  }

  // === Variant 1: Web Share API ===
  async function variantShare() {
    setStatus('share', '…');
    try {
      const blob = await fetchBlob();
      const file = new File([blob], DEMO_FILENAME, { type: 'image/png' });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        setStatus('share', 'Browser kann keine Dateien teilen', 'err');
        return;
      }
      await navigator.share({ files: [file], title: 'Demo Bild' });
      setStatus('share', 'Share-Sheet geöffnet ✓', 'ok');
    } catch (e) {
      if (e && e.name === 'AbortError') {
        setStatus('share', 'Vom User abgebrochen');
      } else {
        setStatus('share', 'Fehler: ' + (e.message || e), 'err');
      }
    }
  }

  // === Variant 2: <a download> ===
  function variantAnchor() {
    setStatus('anchor', '…');
    const a = document.createElement('a');
    a.href = DEMO_IMAGE;
    a.download = DEMO_FILENAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus('anchor', 'click() ausgelöst — siehe Browser-Verhalten', 'ok');
  }

  // === Variant 3: Long-press modal ===
  const saveModal = document.getElementById('saveModal');
  const saveModalBackdrop = document.getElementById('saveModalBackdrop');
  const saveModalClose = document.getElementById('saveModalClose');
  const saveModalImage = document.getElementById('saveModalImage');
  const saveModalText = document.getElementById('saveModalText');

  function openSaveModal() {
    saveModalImage.src = DEMO_IMAGE;
    if (isIOS) {
      saveModalText.innerHTML = 'Halte das Bild gedrückt und wähle <strong>„Zu Fotos hinzufügen"</strong>.';
    } else if (isAndroid) {
      saveModalText.innerHTML = 'Halte das Bild gedrückt und wähle <strong>„Bild herunterladen"</strong>.';
    } else {
      saveModalText.innerHTML = 'Rechtsklick auf das Bild und <strong>„Bild speichern unter…"</strong>.';
    }
    saveModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSaveModal() {
    saveModal.hidden = true;
    saveModalImage.src = '';
    document.body.style.overflow = '';
  }

  saveModalBackdrop.addEventListener('click', closeSaveModal);
  saveModalClose.addEventListener('click', closeSaveModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !saveModal.hidden) closeSaveModal();
  });

  function variantModal() {
    openSaveModal();
    setStatus('modal', 'Modal geöffnet — Bild gedrückt halten', 'ok');
  }

  // === Variant 4: window.open(blobUrl) ===
  async function variantNewTab() {
    setStatus('newtab', '…');
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        setStatus('newtab', 'Popup blockiert', 'err');
        URL.revokeObjectURL(url);
        return;
      }
      setStatus('newtab', 'Neuer Tab geöffnet ✓', 'ok');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
      setStatus('newtab', 'Fehler: ' + (e.message || e), 'err');
    }
  }

  // === Variant 5: location.href = blobUrl ===
  async function variantNavigate() {
    if (!confirm('Diese Seite wird verlassen. Fortfahren?')) {
      setStatus('navigate', 'Abgebrochen');
      return;
    }
    try {
      const blob = await fetchBlob();
      window.location.href = URL.createObjectURL(blob);
    } catch (e) {
      setStatus('navigate', 'Fehler: ' + (e.message || e), 'err');
    }
  }

  // === Variant 6: Clipboard ===
  async function variantClipboard() {
    setStatus('clipboard', '…');
    if (!navigator.clipboard || !window.ClipboardItem) {
      setStatus('clipboard', 'ClipboardItem nicht unterstützt', 'err');
      return;
    }
    try {
      // Some browsers require the blob promise inside ClipboardItem
      const item = new ClipboardItem({
        'image/png': fetchBlob()
      });
      await navigator.clipboard.write([item]);
      setStatus('clipboard', 'In Zwischenablage kopiert ✓ — irgendwo einfügen', 'ok');
    } catch (e) {
      // Some browsers don't allow promise form — try resolved blob
      try {
        const blob = await fetchBlob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatus('clipboard', 'In Zwischenablage kopiert ✓', 'ok');
      } catch (e2) {
        setStatus('clipboard', 'Fehler: ' + (e2.message || e2), 'err');
      }
    }
  }

  // === Variant 7: Service Worker + Content-Disposition ===
  let swReady = false;

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      // Wait until SW is active / controlling
      if (reg.active) {
        swReady = true;
      } else {
        await new Promise(function (resolve) {
          const target = reg.installing || reg.waiting;
          if (!target) { resolve(); return; }
          target.addEventListener('statechange', function () {
            if (target.state === 'activated') resolve();
          });
        });
        swReady = true;
      }
      // Ensure this page is controlled (claim on activate handles it)
      if (!navigator.serviceWorker.controller) {
        await new Promise(function (resolve) {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          setTimeout(resolve, 2000);
        });
      }
      return true;
    } catch (e) {
      console.warn('SW register failed', e);
      return false;
    }
  }

  async function variantSW() {
    setStatus('sw', '…');
    if (!('serviceWorker' in navigator)) {
      setStatus('sw', 'Service Worker nicht unterstützt', 'err');
      return;
    }
    if (!swReady) {
      setStatus('sw', 'Registriere SW…');
      const ok = await registerSW();
      if (!ok) {
        setStatus('sw', 'SW Registrierung fehlgeschlagen', 'err');
        return;
      }
    }
    if (!navigator.serviceWorker.controller) {
      setStatus('sw', 'SW noch nicht aktiv — bitte erneut klicken');
      return;
    }
    // Trigger download via SW-handled URL
    const a = document.createElement('a');
    a.href = '__download/' + encodeURIComponent(DEMO_FILENAME);
    a.download = DEMO_FILENAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus('sw', 'Attachment-Response gesendet ✓', 'ok');
  }

  // === Variant 8: QR Code ===
  function variantQR() {
    const fullUrl = new URL(DEMO_IMAGE, location.href).href;
    const qrPanel = document.querySelector('[data-qr]');
    const qrImg = document.getElementById('qrImg');
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(fullUrl);
    qrPanel.hidden = false;
    setStatus('qr', 'QR Code zum Bild generiert ✓ — mit Telefon scannen', 'ok');
  }

  // === Variant 9: Open in external browser ===
  function variantBanner() {
    const banner = document.querySelector('[data-banner]');
    let msg;
    if (inApp === 'Instagram' && isIOS) {
      msg = 'Du bist im <strong>Instagram</strong> In-App-Browser. Tippe <strong>⋯</strong> oben rechts → <strong>„In Safari öffnen"</strong>.';
    } else if (inApp === 'Instagram') {
      msg = 'Du bist im <strong>Instagram</strong> In-App-Browser. Tippe <strong>⋮</strong> oben rechts → <strong>„In Chrome öffnen"</strong>.';
    } else if (inApp === 'Facebook' && isIOS) {
      msg = 'Du bist im <strong>Facebook</strong> In-App-Browser. Tippe <strong>⋯</strong> unten rechts → <strong>„In Safari öffnen"</strong>.';
    } else if (inApp === 'Facebook') {
      msg = 'Du bist im <strong>Facebook</strong> In-App-Browser. Tippe <strong>⋮</strong> oben rechts → <strong>„In externem Browser öffnen"</strong>.';
    } else if (inApp === 'LinkedIn') {
      msg = 'Du bist im <strong>LinkedIn</strong> In-App-Browser. Tippe das Menü-Icon → <strong>„In Browser öffnen"</strong>.';
    } else if (inApp === 'TikTok') {
      msg = 'Du bist im <strong>TikTok</strong> In-App-Browser. Tippe das Teilen-Icon → <strong>„In Browser öffnen"</strong>.';
    } else if (inApp) {
      msg = 'Du bist im <strong>' + inApp + '</strong> In-App-Browser. Suche im Menü nach <strong>„In Browser öffnen"</strong>.';
    } else if (isIOS) {
      msg = 'Du nutzt bereits <strong>Safari</strong> — Downloads funktionieren regulär. (Wenn du in einer App bist: ⋯ → Safari öffnen)';
    } else if (isAndroid) {
      msg = 'Du nutzt bereits <strong>Chrome / Standard-Browser</strong> — Downloads funktionieren regulär.';
    } else {
      msg = 'Du nutzt einen <strong>Desktop-Browser</strong> — Downloads funktionieren regulär.';
    }
    banner.innerHTML = msg;
    banner.hidden = false;
    setStatus('banner', 'Hinweis nach UA generiert ✓', 'ok');
  }

  // Wire up buttons
  const variants = {
    share: variantShare,
    anchor: variantAnchor,
    modal: variantModal,
    newtab: variantNewTab,
    navigate: variantNavigate,
    clipboard: variantClipboard,
    sw: variantSW,
    qr: variantQR,
    banner: variantBanner
  };

  document.querySelectorAll('[data-variant]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const v = btn.getAttribute('data-variant');
      const fn = variants[v];
      if (fn) fn();
    });
  });

  // Init
  renderEnv();
  // Pre-register SW so variant 7 is ready on first click
  if ('serviceWorker' in navigator) {
    registerSW();
  }
})();
