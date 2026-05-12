/* =============================================
   Social Media Badge Generator — Core Logic
   3-Layer Canvas: Background → User Photo → Foreground
   ============================================= */

(function () {
  'use strict';

  const CANVAS_SIZE = 1080;

  // DOM elements
  const canvas = document.getElementById('badgeCanvas');
  const ctx = canvas.getContext('2d');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const uploadOverlay = document.getElementById('uploadOverlay');
  const photoInput = document.getElementById('photoInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadControlsCard = document.getElementById('uploadControls');
  const adjustControls = document.getElementById('adjustControls');
  const downloadControls = document.getElementById('downloadControls');
  const fileName = document.getElementById('fileName');
  const moveHint = document.getElementById('moveHint');
  const copyBtn = document.getElementById('copyBtn');
  const saveModal = document.getElementById('saveModal');
  const saveModalBackdrop = document.getElementById('saveModalBackdrop');
  const saveModalClose = document.getElementById('saveModalClose');
  const saveModalImage = document.getElementById('saveModalImage');
  const saveModalText = document.getElementById('saveModalText');

  // State
  let userImage = null;
  let foregroundImage = null;
  let foregroundAlpha = null; // Uint8Array of alpha values, indexed [y * CANVAS_SIZE + x]
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let rafId = null;
  let hasPanned = false;


  // Load foreground overlay and build alpha atlas for hit-testing
  async function loadForeground() {
    try {
      const res = await fetch('assets/foreground%20v4.png');
      if (!res.ok) throw new Error('fetch ' + res.status);
      const blob = await res.blob();

      // Prefer createImageBitmap; fall back to <img> + data URL if unavailable
      let source;
      if (typeof createImageBitmap === 'function') {
        try { source = await createImageBitmap(blob); }
        catch (e) { /* iOS quirks — fall through */ }
      }
      if (!source) {
        source = await new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onloadend = function () {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = reject;
            img.src = reader.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      foregroundImage = source;

      const offscreen = document.createElement('canvas');
      offscreen.width = CANVAS_SIZE;
      offscreen.height = CANVAS_SIZE;
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(source, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const raw = offCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;

      const atlas = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
      for (let i = 0; i < atlas.length; i++) atlas[i] = raw[i * 4 + 3];
      foregroundAlpha = atlas;

      render();
    } catch (err) {
      console.error('Foreground load failed:', err);
    }
  }

  // Render all 3 layers
  function render() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Layer 1: White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Layer 2: User photo (centered, scaled, panned)
      if (userImage) {
        drawUserPhoto();
      }

      // Layer 3: Foreground overlay
      if (foregroundImage) {
        ctx.drawImage(foregroundImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      rafId = null;
    });
  }

  function drawUserPhoto() {
    const img = userImage;
    const scale = zoom;

    // Fit image to cover canvas, then apply user zoom
    const coverScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const drawWidth = img.width * coverScale * scale;
    const drawHeight = img.height * coverScale * scale;

    // Center the image, then apply pan offset
    const drawX = (CANVAS_SIZE - drawWidth) / 2 + panX;
    const drawY = (CANVAS_SIZE - drawHeight) / 2 + panY;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // Handle file upload
  function handleFile(file) {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      alert('Bitte nur JPG oder PNG hochladen.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        userImage = img;
        zoom = 1;
        panX = 0;
        panY = 0;
        hasPanned = false;

        moveHint.classList.add('move-hint--visible');
        uploadOverlay.classList.add('upload-overlay--hidden');
        adjustControls.classList.remove('control-card--disabled');
        adjustControls.classList.add('control-card--active');
        downloadControls.classList.remove('control-card--disabled');
        uploadControlsCard.classList.remove('control-card--active');
        uploadControlsCard.classList.add('control-card--hidden');
        downloadBtn.classList.remove('download-btn--pulse');
        fileName.textContent = file.name;

        render();
        syncPreviewSize();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // File input change
  photoInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Click overlay to trigger upload
  uploadOverlay.addEventListener('click', function () {
    photoInput.click();
  });

  // Drag and drop on canvas
  canvasWrapper.addEventListener('dragover', function (e) {
    e.preventDefault();
    canvasWrapper.classList.add('drag-over');
  });

  canvasWrapper.addEventListener('dragleave', function () {
    canvasWrapper.classList.remove('drag-over');
  });

  canvasWrapper.addEventListener('drop', function (e) {
    e.preventDefault();
    canvasWrapper.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Maps a client pointer position to internal canvas coordinates (0–CANVAS_SIZE).
  // Uses canvas.getBoundingClientRect() for precision — avoids wrapper border offsets.
  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width  * CANVAS_SIZE,
      y: (clientY - rect.top)  / rect.height * CANVAS_SIZE
    };
  }

  // Returns true when the foreground PNG is transparent at these canvas coords,
  // meaning the user photo layer is exposed and can be dragged there.
  function isForegroundTransparent(cx, cy) {
    if (!foregroundAlpha) return false; // block drag until atlas is ready
    const x = Math.round(cx);
    const y = Math.round(cy);
    if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) return false;
    return foregroundAlpha[y * CANVAS_SIZE + x] < 10;
  }

  function markAdjusted() {
    moveHint.classList.remove('move-hint--visible');
    if (hasPanned) return;
    hasPanned = true;
    adjustControls.classList.remove('control-card--active');
    adjustControls.classList.add('control-card--hidden');
    downloadControls.classList.add('control-card--active');
    downloadBtn.classList.add('download-btn--pulse');
  }

  // Pan (drag to reposition) — Mouse
  canvasWrapper.addEventListener('mousedown', function (e) {
    if (!userImage) return;
    const pt = canvasPoint(e.clientX, e.clientY);
    if (!isForegroundTransparent(pt.x, pt.y)) return;
    isDragging = true;
    canvasWrapper.classList.remove('is-draggable');
    canvasWrapper.classList.add('is-dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
  });

  // Update cursor based on whether the hovered pixel is draggable
  canvasWrapper.addEventListener('mousemove', function (e) {
    if (isDragging) return;
    if (!userImage) return;
    const pt = canvasPoint(e.clientX, e.clientY);
    canvasWrapper.classList.toggle('is-draggable', isForegroundTransparent(pt.x, pt.y));
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const rect = canvasWrapper.getBoundingClientRect();
    const scaleRatio = CANVAS_SIZE / rect.width;
    panX = panStartX + (e.clientX - dragStartX) * scaleRatio;
    panY = panStartY + (e.clientY - dragStartY) * scaleRatio;
    if (Math.abs(e.clientX - dragStartX) + Math.abs(e.clientY - dragStartY) > 4) {
      markAdjusted();
    }
    render();
  });

  document.addEventListener('mouseup', function () {
    isDragging = false;
    canvasWrapper.classList.remove('is-dragging');
  });

  // Pan — Touch
  canvasWrapper.addEventListener('touchstart', function (e) {
    if (!userImage || e.touches.length !== 1) return;
    const pt = canvasPoint(e.touches[0].clientX, e.touches[0].clientY);
    if (!isForegroundTransparent(pt.x, pt.y)) return;
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    panStartX = panX;
    panStartY = panY;
  }, { passive: true });

  canvasWrapper.addEventListener('touchmove', function (e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const rect = canvasWrapper.getBoundingClientRect();
    const scaleRatio = CANVAS_SIZE / rect.width;
    panX = panStartX + (e.touches[0].clientX - dragStartX) * scaleRatio;
    panY = panStartY + (e.touches[0].clientY - dragStartY) * scaleRatio;
    if (Math.abs(e.touches[0].clientX - dragStartX) + Math.abs(e.touches[0].clientY - dragStartY) > 6) {
      markAdjusted();
    }
    render();
  }, { passive: false });

  canvasWrapper.addEventListener('touchend', function () {
    isDragging = false;
  });

  // Pinch to zoom on touch
  let lastPinchDist = 0;
  canvasWrapper.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      lastPinchDist = getPinchDistance(e.touches);
    }
  }, { passive: true });

  canvasWrapper.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && userImage) {
      e.preventDefault();
      const dist = getPinchDistance(e.touches);
      const delta = dist / lastPinchDist;
      zoom = Math.min(3, Math.max(0.5, zoom * delta));
      lastPinchDist = dist;
      markAdjusted();
      render();
    }
  }, { passive: false });

  function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Mouse wheel zoom on canvas
  canvasWrapper.addEventListener('wheel', function (e) {
    if (!userImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoom = Math.min(3, Math.max(0.5, zoom + delta));
    markAdjusted();
    render();
  }, { passive: false });

  // Environment detection for download strategy
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\//i.test(ua) ||
    /Twitter|TikTok|LinkedInApp|Snapchat|Pinterest|WhatsApp|Threads/i.test(ua) ||
    (/; wv\)/.test(ua)); // generic Android WebView
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function openSaveModal(dataUrl) {
    saveModalImage.src = dataUrl;
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

  // Download as PNG
  downloadBtn.addEventListener('click', async function () {
    downloadBtn.classList.remove('download-btn--pulse');
    // Force a synchronous full-quality render
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (userImage) drawUserPhoto();
    if (foregroundImage) ctx.drawImage(foregroundImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const exportName = 'startup-contacts-2026-badge.png';

    canvas.toBlob(async function (blob) {
      if (!blob) return;

      const file = new File([blob], exportName, { type: 'image/png' });

      // Strategy 1: Native share sheet with file (iOS Safari 15+, Android Chrome,
      // most modern iOS/Android PWAs). Opens "Save to Photos" / "Download" options.
      if (!isInAppBrowser && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Startup Contacts 2026 Badge'
          });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return; // user cancelled
          // otherwise fall through to fallbacks
        }
      }

      // Strategy 2: In-app browser, iOS (Safari's <a download> is unreliable there),
      // or PWA standalone — show image in a modal so user can long-press → save.
      if (isInAppBrowser || isIOS || isStandalone) {
        const reader = new FileReader();
        reader.onloadend = function () {
          openSaveModal(reader.result);
        };
        reader.readAsDataURL(blob);
        return;
      }

      // Strategy 3: Desktop / standard Android browser — trigger normal download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  });

  // Copy to clipboard
  copyBtn.addEventListener('click', async function () {
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert('Dein Browser unterstützt das Kopieren von Bildern leider nicht. Bitte nutze "Herunterladen".');
      return;
    }

    // Force a synchronous full-quality render first
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (userImage) drawUserPhoto();
    if (foregroundImage) ctx.drawImage(foregroundImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error('toBlob failed'));
          }, 'image/png');
        }) })
      ]);
      copyBtn.classList.add('copy-btn--success');
      const origLabel = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Kopiert!';
      setTimeout(function () {
        copyBtn.classList.remove('copy-btn--success');
        copyBtn.innerHTML = origLabel;
      }, 2500);
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        alert('Bitte erlaube den Zugriff auf die Zwischenablage in deinem Browser.');
      } else {
        alert('Kopieren fehlgeschlagen. Bitte nutze "Herunterladen".');
      }
    }
  });

  // Match preview size to controls height
  function syncPreviewSize() {
    const controls = document.querySelector('.generator__controls');
    const preview = document.querySelector('.generator__preview');
    if (!controls || !preview || window.innerWidth <= 900) {
      preview.style.maxWidth = '';
      return;
    }
    const controlsHeight = controls.offsetHeight;
    preview.style.maxWidth = controlsHeight + 'px';
  }

  // Init
  loadForeground();
  syncPreviewSize();
  window.addEventListener('resize', syncPreviewSize);

  // Re-sync when controls become visible
  new MutationObserver(syncPreviewSize).observe(
    document.querySelector('.generator__controls'),
    { childList: true, subtree: true, attributes: true }
  );
})();
