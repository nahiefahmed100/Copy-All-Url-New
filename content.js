(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════
  //  ⚙️  OWNER CONFIGURATION  — শুধু এই অংশ পরিবর্তন করুন
  // ═══════════════════════════════════════════════════════

  const CONFIG = {
    // আপনার GitHub username
    githubUsername: 'YOUR_GITHUB_USERNAME',

    // আপনার GitHub Gist ID  (gist.github.com/username/THIS_PART)
    gistId: 'YOUR_GIST_ID_HERE',

    // Gist-এর ভেতরে JSON file-এর নাম
    gistFile: 'licenses.json',

    // Script-এর নাম (UI-তে দেখাবে)
    scriptName: 'FB Comment Scraper',

    // License কতক্ষণ cache থাকবে (milliseconds) — default: 24 ঘণ্টা
    cacheDuration: 24 * 60 * 60 * 1000,
  };

  // ═══════════════════════════════════════════════════════
  //  GitHub Gist-এ licenses.json এর format:
  //
  //  {
  //    "keys": {
  //      "KEY-ABCD-1234-EFGH": { "active": true,  "note": "User 1" },
  //      "KEY-WXYZ-5678-IJKL": { "active": true,  "note": "User 2" },
  //      "KEY-REVK-0000-0000": { "active": false, "note": "Revoked" }
  //    }
  //  }
  //
  //  active: false করলে সেই key block হয়ে যাবে।
  // ═══════════════════════════════════════════════════════

  const STORAGE_KEY = 'fbcs_license_key';
  const CACHE_KEY   = 'fbcs_license_cache';

  // ── Entry Point ──────────────────────────────────────
  initLicenseCheck();

  async function initLicenseCheck() {
    const savedKey = localStorage.getItem(STORAGE_KEY);

    if (savedKey) {
      // Cached validation check
      const cacheData = tryParseJSON(localStorage.getItem(CACHE_KEY));
      const now = Date.now();

      if (cacheData && cacheData.key === savedKey && (now - cacheData.timestamp) < CONFIG.cacheDuration) {
        if (cacheData.valid) {
          startMainScript();
        } else {
          // Cache says invalid — show error, clear key
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(CACHE_KEY);
          showLicenseModal('❌ Your license key has been revoked. Please enter a valid key.');
        }
        return;
      }

      // Cache expired → re-validate online
      const result = await validateKeyOnline(savedKey);
      saveCacheResult(savedKey, result.valid);

      if (result.valid) {
        startMainScript();
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CACHE_KEY);
        showLicenseModal(`❌ ${result.reason || 'Invalid license key.'}  Please enter a valid key.`);
      }
    } else {
      showLicenseModal();
    }
  }

  // ── License Modal UI ─────────────────────────────────
  function showLicenseModal(errorMessage = '') {
    // Remove existing modal if any
    const existing = document.getElementById('fbcs-license-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fbcs-license-modal';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '2147483647',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      background: '#fff',
      borderRadius: '16px',
      padding: '36px 32px',
      width: '380px',
      maxWidth: '90vw',
      boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      animation: 'fbcs-slide-in 0.25s ease',
      position: 'relative',
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fbcs-slide-in {
        from { opacity: 0; transform: translateY(-20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      #fbcs-license-modal input:focus {
        outline: none;
        border-color: #1877f2 !important;
        box-shadow: 0 0 0 3px rgba(24,119,242,0.15) !important;
      }
      #fbcs-activate-btn:hover:not(:disabled) {
        background: #1464d8 !important;
        transform: translateY(-1px);
      }
      #fbcs-activate-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed !important;
      }
    `;
    document.head.appendChild(style);

    modal.innerHTML = `
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-size:36px; margin-bottom:8px;">🔑</div>
        <h2 style="margin:0 0 6px; font-size:20px; color:#1c1e21; font-weight:700;">
          ${CONFIG.scriptName}
        </h2>
        <p style="margin:0; font-size:13px; color:#65676b;">
          Enter your license key to continue
        </p>
      </div>

      ${errorMessage ? `
        <div id="fbcs-error-msg" style="
          background:#fff0f0; border:1px solid #ffb3b3;
          border-radius:8px; padding:10px 14px;
          font-size:13px; color:#d32f2f;
          margin-bottom:16px; line-height:1.4;
        ">${errorMessage}</div>
      ` : ''}

      <div id="fbcs-status-msg" style="display:none; background:#e8f4e8; border:1px solid #a5d6a7;
        border-radius:8px; padding:10px 14px; font-size:13px; color:#2e7d32;
        margin-bottom:16px;">
      </div>

      <label style="display:block; font-size:13px; font-weight:600; color:#1c1e21; margin-bottom:6px;">
        License Key
      </label>
      <input id="fbcs-key-input" type="text" placeholder="KEY-XXXX-XXXX-XXXX"
        style="
          width:100%; box-sizing:border-box; padding:11px 14px;
          border:1.5px solid #ddd; border-radius:8px;
          font-size:14px; color:#1c1e21;
          font-family:monospace; letter-spacing:0.5px;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-bottom:16px;
        " />

      <button id="fbcs-activate-btn" style="
        width:100%; padding:13px; background:#1877f2; color:#fff;
        border:none; border-radius:8px; font-size:15px; font-weight:700;
        cursor:pointer; transition: background 0.2s, transform 0.15s;
      ">Activate</button>

      <p style="text-align:center; margin:16px 0 0; font-size:12px; color:#8a8d91;">
        Don't have a key? Contact the script owner.
      </p>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input   = modal.querySelector('#fbcs-key-input');
    const btn     = modal.querySelector('#fbcs-activate-btn');
    const statusEl = modal.querySelector('#fbcs-status-msg');

    input.focus();

    // Allow Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) {
        shakeElement(input);
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ Validating…';
      statusEl.style.display = 'none';

      const result = await validateKeyOnline(key);
      saveCacheResult(key, result.valid);

      if (result.valid) {
        localStorage.setItem(STORAGE_KEY, key);
        statusEl.textContent = '✅ License activated! Loading script…';
        statusEl.style.display = 'block';
        statusEl.style.background = '#e8f4e8';
        statusEl.style.borderColor = '#a5d6a7';
        statusEl.style.color = '#2e7d32';
        setTimeout(() => {
          overlay.remove();
          startMainScript();
        }, 1000);
      } else {
        btn.disabled = false;
        btn.textContent = 'Activate';
        statusEl.textContent = `❌ ${result.reason || 'Invalid key. Please try again.'}`;
        statusEl.style.display = 'block';
        statusEl.style.background = '#fff0f0';
        statusEl.style.borderColor = '#ffb3b3';
        statusEl.style.color = '#d32f2f';
        shakeElement(input);
      }
    });
  }

  function shakeElement(el) {
    el.style.animation = 'none';
    el.style.border = '1.5px solid #d32f2f';
    const shakeCss = `
      @keyframes fbcs-shake {
        0%,100% { transform: translateX(0); }
        20%     { transform: translateX(-8px); }
        60%     { transform: translateX(8px); }
      }
    `;
    if (!document.getElementById('fbcs-shake-style')) {
      const s = document.createElement('style');
      s.id = 'fbcs-shake-style';
      s.textContent = shakeCss;
      document.head.appendChild(s);
    }
    el.style.animation = 'fbcs-shake 0.3s ease';
    setTimeout(() => { el.style.animation = ''; el.style.border = '1.5px solid #ddd'; }, 400);
  }

  // ── GitHub Gist Validation ────────────────────────────
  async function validateKeyOnline(key) {
    const gistUrl = `https://gist.githubusercontent.com/${CONFIG.githubUsername}/${CONFIG.gistId}/raw/${CONFIG.gistFile}?t=${Date.now()}`;

    try {
      const response = await fetch(gistUrl, { cache: 'no-store' });

      if (!response.ok) {
        return { valid: false, reason: 'Could not reach license server. Check your internet connection.' };
      }

      const data = await response.json();
      const keys = data.keys || {};

      if (!keys[key]) {
        return { valid: false, reason: 'License key not found.' };
      }

      if (keys[key].active === false) {
        return { valid: false, reason: 'This license key has been revoked.' };
      }

      // Check optional expiry date (format: "YYYY-MM-DD")
      if (keys[key].expires) {
        const expiry = new Date(keys[key].expires);
        if (Date.now() > expiry.getTime()) {
          return { valid: false, reason: 'This license key has expired.' };
        }
      }

      return { valid: true };

    } catch (err) {
      // If fetch fails (no internet), fallback to cached result
      const cache = tryParseJSON(localStorage.getItem(CACHE_KEY));
      if (cache && cache.key === key && cache.valid) {
        return { valid: true }; // Offline grace
      }
      return { valid: false, reason: 'Network error. Please check your connection.' };
    }
  }

  function saveCacheResult(key, valid) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      key,
      valid,
      timestamp: Date.now()
    }));
  }

  function tryParseJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
  }


  // ════════════════════════════════════════════════════════
  //  MAIN SCRIPT — License check passed হলে এটি চলবে
  // ════════════════════════════════════════════════════════

  function startMainScript() {
    const COPY_BUTTON_CLASS = 'fbcs-copy-btn';
    const IGNORED_DIALOG_LABELS = new Set(['messenger', 'notifications', 'menu', 'your profile']);

    function findCommentDialog() {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const dialog of dialogs) {
        const ariaLabel = (dialog.getAttribute('aria-label') || '').trim().toLowerCase();
        if (ariaLabel && IGNORED_DIALOG_LABELS.has(ariaLabel)) continue;
        const hasAriaLabelledBy = dialog.hasAttribute('aria-labelledby');
        const hasCommentArticle = dialog.querySelector(
          '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
        );
        if (hasAriaLabelledBy || hasCommentArticle) return dialog;
      }
      return null;
    }

    const domObserver = new MutationObserver(() => {
      const commentDialog = findCommentDialog();
      if (!commentDialog) return;
      if (commentDialog.querySelector('.' + COPY_BUTTON_CLASS)) return;

      const copyButton = document.createElement('button');
      copyButton.textContent = '📋 Copy ALL commenters + replies (@uname)';
      copyButton.className = COPY_BUTTON_CLASS;
      Object.assign(copyButton.style, {
        position: 'sticky', top: '8px', zIndex: 9999,
        margin: '8px', padding: '8px 12px',
        background: '#1877f2', color: '#fff',
        border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,.2)'
      });

      const statusDiv = document.createElement('div');
      Object.assign(statusDiv.style, { margin: '4px 8px', fontSize: '12px' });

      const targetHeader = commentDialog.querySelector('header') || commentDialog.firstElementChild || commentDialog;
      targetHeader.prepend(statusDiv);
      targetHeader.prepend(copyButton);

      copyButton.addEventListener('click', async () => {
        copyButton.disabled = true;
        copyButton.textContent = '⏳ Expanding…';
        try {
          // Re-validate license silently before use
          const savedKey = localStorage.getItem(STORAGE_KEY);
          if (!savedKey) {
            copyButton.textContent = '🔑 No license';
            setTimeout(() => { copyButton.disabled = false; copyButton.textContent = '📋 Copy ALL commenters + replies (@uname)'; }, 2000);
            return;
          }

          await expandCommentsAndScroll(commentDialog, (msg) => { statusDiv.textContent = msg; });
          const usernames = extractUsernames(commentDialog);
          if (usernames.length === 0) {
            copyButton.textContent = '⚠️ No commenters found';
            return;
          }
          const clipboardText = usernames.map(n => '@' + n).join('\n');
          await navigator.clipboard.writeText(clipboardText);
          copyButton.textContent = '✅ Copied ' + usernames.length + ' IDs';
        } catch (err) {
          console.error(err);
          copyButton.textContent = '❌ Error (see console)';
        } finally {
          setTimeout(() => {
            copyButton.disabled = false;
            copyButton.textContent = '📋 Copy ALL commenters + replies (@uname)';
            statusDiv.textContent = '';
          }, 2500);
        }
      });
    });

    domObserver.observe(document.body, { childList: true, subtree: true });

    // ── Helpers (same as before) ──────────────────────
    function findScrollableElements(container) {
      const scrollables = [];
      container.querySelectorAll('*').forEach(el => {
        try {
          const style = getComputedStyle(el);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
               el.scrollHeight > el.clientHeight + 50) {
            scrollables.push(el);
          }
        } catch (e) {}
      });
      return scrollables.length ? scrollables : [container];
    }

    async function expandCommentsAndScroll(dialog, onStatusUpdate) {
      const scrollableElements = findScrollableElements(dialog);
      const mainScrollable = scrollableElements.sort(
        (a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)
      )[0] || dialog;

      const startTime = performance.now();
      const maxDuration = 45000;
      const idleTimeout = 2500;
      let lastActivityTime = performance.now();
      let commentCount = countComments(dialog);
      let scrollHeight = mainScrollable.scrollHeight;

      while (performance.now() - startTime < maxDuration) {
        const clicked = clickExpandButtons(dialog);
        performScroll(mainScrollable);
        await sleep(300);
        const newCount = countComments(dialog);
        const newHeight = mainScrollable.scrollHeight;
        if (clicked || newCount > commentCount || newHeight > scrollHeight) {
          lastActivityTime = performance.now();
          commentCount = Math.max(commentCount, newCount);
          scrollHeight = Math.max(scrollHeight, newHeight);
          onStatusUpdate?.('Loading… ' + commentCount + ' items');
        } else if (performance.now() - lastActivityTime > idleTimeout) {
          onStatusUpdate?.('Loaded ' + commentCount + '.');
          break;
        }
      }
    }

    function countComments(container) {
      return container.querySelectorAll(
        '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
      ).length;
    }

    function performScroll(element) {
      try {
        const max = element.scrollHeight - element.clientHeight;
        element.scrollTop = Math.max(0, Math.floor(max * 0.85));
        element.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, bubbles: true }));
        element.scrollTop = max;
        element.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, bubbles: true }));
        element.scrollTop = Math.max(0, max - 200);
      } catch (e) {}
    }

    function clickExpandButtons(container) {
      let clickedAny = false;
      const allButtons = Array.from(container.querySelectorAll(
        'div[role="button"], span[role="button"], a[role="button"], button'
      ));
      const expandRegexes = [
        /(^|\s)(view|see)\s+(all\s+)?\d*\s*(more\s+)?(reply|replies)\b/i,
        /(^|\s)(view|see)\s+(all\s+)?\d*\s*(more\s+)?(comment|comments)\b/i,
        /(^|\s)(view|see)\s+previous\s+(comment|comments)\b/i,
        /\bmore replies?\b/i, /\bprevious comments?\b/i
      ];
      for (const btn of allButtons) {
        const t = (btn.innerText || '').trim();
        if (!t || isCloseButton(btn)) continue;
        if (expandRegexes.some(r => r.test(t) || r.test(t.toLowerCase()))) {
          try { btn.click(); clickedAny = true; } catch (e) {}
        }
      }
      const comments = container.querySelectorAll(
        '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
      );
      for (const comment of comments) {
        comment.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], button')
          .forEach(b => {
            const t = (b.innerText || '').trim().toLowerCase();
            if (t && /(^|\s)(view|see)\s+(all\s+)?\d*\s*(more\s+)?(reply|replies)\b/.test(t)) {
              try { b.click(); clickedAny = true; } catch (e) {}
            }
          });
      }
      return clickedAny;
    }

    function isCloseButton(el) {
      const a = (el.getAttribute('aria-label') || '').toLowerCase();
      const t = (el.innerText || '').trim().toLowerCase();
      return a === 'close' || t === 'close' || t === 'esc';
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function extractNameFromAriaLabel(ariaLabel) {
      if (!ariaLabel) return '';
      let c = ariaLabel.replace(/^(Comment|Reply)\s+by\s+/i, '').trim();
      c = c.replace(/\s+to\s+.+?(?:['']s)?\s+(?:comment|reply)\b.*$/i, '');
      c = c.replace(/\s+\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?)\s+ago.*$/i, '');
      c = c.replace(/\s*(?:·\s*)?\d+\s*[smhdw]\b.*$/i, '');
      c = c.replace(/\s+·.*$/i, '').replace(/\s{2,}/g, ' ').trim();
      return c;
    }

    function resolveCommenterName(a, b) {
      const ac = (a || '').trim(), bc = (b || '').trim();
      if (!bc) return ac; if (!ac) return bc;
      const af = ac.split(/\s+/)[0].toLowerCase(), bf = bc.split(/\s+/)[0].toLowerCase();
      if (af === bf) return bc.length > ac.length ? bc : ac;
      return ac.length >= bc.length ? ac : bc;
    }

    function normalizeText(t) {
      try { return t.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
      catch { return (t||'').toLowerCase().trim(); }
    }

    function isExcludedUrl(url) {
      const u = (url||'').toLowerCase();
      return ['/videos/','/watch/','/posts/','/groups/','/hashtag/','/photo.php','/permalink.php','/story.php','/marketplace/']
        .some(p => u.includes(p));
    }

    function findProfileLinkByName(el, name) {
      if (!name) return null;
      const norm = normalizeText(name);
      for (const link of el.querySelectorAll('a[href*="facebook.com/"]')) {
        const lt = normalizeText((link.innerText||'').trim());
        if (lt && (lt === norm || lt.startsWith(norm+' ')) && !isExcludedUrl(link.getAttribute('href')||''))
          return link.href;
      }
      return null;
    }

    function findFallbackProfileLink(el) {
      let l = el.querySelector('a[href*="facebook.com/"][href*="comment_id="], a[href*="facebook.com/"][href*="reply_comment_id="]');
      if (l) return l.href;
      l = el.querySelector('a[href*="facebook.com/profile.php?id="]');
      if (l) return l.href;
      l = el.querySelector(':scope a[role="link"][href^="https://www.facebook.com/"]');
      if (l && !isExcludedUrl(l.href)) return l.href;
      for (const a of el.querySelectorAll('a[href*="facebook.com/"]')) {
        if (!isExcludedUrl(a.getAttribute('href')||'')) return a.href;
      }
      return null;
    }

    function extractUsernameFromUrl(url) {
      try {
        const u = new URL(url, 'https://www.facebook.com');
        const p = u.pathname.replace(/\/+$/,'');
        if (p.toLowerCase()==='/profile.php') {
          const id=(u.searchParams.get('id')||'').trim();
          return (id && !/^\d+$/.test(id)) ? id : '';
        }
        if (/^\/people\/[^/]+\/\d+$/i.test(p)) return '';
        const seg = (p.split('/').filter(Boolean)[0]||'').trim();
        if (!seg) return '';
        if (/(pages|groups|watch|marketplace|events|reels|gaming|photos|video|videos)/i.test(seg)) return '';
        if (/^\d+$/.test(seg)) return '';
        return decodeURIComponent(seg);
      } catch { return ''; }
    }

    function extractUsernames(container) {
      const seen = new Set();
      for (const comment of container.querySelectorAll(
        '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
      )) {
        const name = resolveCommenterName(
          extractNameFromAriaLabel(comment.getAttribute('aria-label')||''),
          ((comment.querySelector('a[role="link"] span[dir="auto"]') || {}).textContent||'').trim()
        );
        const url = findProfileLinkByName(comment, name) || findFallbackProfileLink(comment);
        if (!url || isExcludedUrl(url)) continue;
        const uname = extractUsernameFromUrl(url);
        if (uname) seen.add(uname.toLowerCase());
      }
      return Array.from(seen);
    }
  } // end startMainScript

}());