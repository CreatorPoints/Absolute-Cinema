// ============================================================================
// Flork - The RPG Introducer & Notifier Mascot for Absolute Cinema
// ============================================================================

(function () {
  'use strict';

  // Audio Context & Sound Synthesizer (Web Audio API)
  let audioCtx = null;
  let soundEnabled = true;

  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // RPG text blip on each spoken letter (Undertale / EarthBound style)
  function playRpgBlip(char) {
    if (!soundEnabled) return;
    if (!char || /\s|[.,!?;:—\-\(\)]/.test(char)) return;

    try {
      const ctx = getAudioCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      // Pleasant pitch variation based on character code
      const baseFreq = 460;
      const variation = ((char.charCodeAt(0) % 9) - 4) * 20; // 380Hz - 540Hz
      osc.frequency.setValueAtTime(baseFreq + variation, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.038);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }

  // Melodic notification chime for events
  function playFlorkChime(isPositive = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = isPositive ? [523.25, 659.25, 783.99] : [440, 392];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.09 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.24);
      });
    } catch (_) {}
  }

  // Flork Dialogue State
  let isTyping = false;
  let typingTimeoutId = null;
  let currentStepIndex = 0;
  let currentScript = [];
  let currentFullText = '';

  // DOM Elements cache
  let overlayEl = null;
  let cardEl = null;
  let textEl = null;
  let imgEl = null;
  let cursorEl = null;
  let nextBtnEl = null;
  let skipBtnEl = null;
  let soundToggleBtnEl = null;

  // Build Flork Intro Modal DOM
  function createFlorkElements() {
    if (document.getElementById('flork-dialogue-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'flork-dialogue-overlay';
    overlay.className = 'flork-dialogue-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="flork-dialogue-card" id="flork-dialogue-card">
        <div class="flork-mascot-perch">
          <img id="flork-character-img" src="assets/flork/Wave.png" alt="Flork" class="flork-character-img">
          <div class="flork-name-badge">
            <span class="flork-name-sparkle">✨</span>
            <span class="flork-name-text">Flork</span>
          </div>
        </div>

        <div class="flork-card-header">
          <div class="flork-dialogue-title">Absolute Cinema • Guide</div>
          <button type="button" class="flork-sound-btn" id="flork-sound-btn" title="Toggle Sound">
            <span id="flork-sound-icon">🔊</span>
          </button>
        </div>

        <div class="flork-dialogue-body" id="flork-dialogue-body">
          <p class="flork-dialogue-text" id="flork-dialogue-text"></p>
          <span class="flork-rpg-cursor" id="flork-rpg-cursor" aria-hidden="true">▼</span>
        </div>

        <div class="flork-card-footer">
          <div class="flork-step-indicator" id="flork-step-indicator">Step 1 of 4</div>
          <div class="flork-btn-group">
            <button type="button" class="flork-btn-skip" id="flork-btn-skip">Skip</button>
            <button type="button" class="flork-btn-next" id="flork-btn-next">Next ▶</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlayEl = overlay;
    cardEl = document.getElementById('flork-dialogue-card');
    textEl = document.getElementById('flork-dialogue-text');
    imgEl = document.getElementById('flork-character-img');
    cursorEl = document.getElementById('flork-rpg-cursor');
    nextBtnEl = document.getElementById('flork-btn-next');
    skipBtnEl = document.getElementById('flork-btn-skip');
    soundToggleBtnEl = document.getElementById('flork-sound-btn');

    // Click anywhere on dialogue body/card to advance or fast-forward
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('#flork-btn-skip') || e.target.closest('#flork-sound-btn')) return;
      handleCardClick();
    });

    nextBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardClick();
    });

    skipBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFlorkIntro(true);
    });

    soundToggleBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      soundEnabled = !soundEnabled;
      const icon = document.getElementById('flork-sound-icon');
      if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
    });

    // Keyboard support: Space / Enter advances
    document.addEventListener('keydown', (e) => {
      if (overlayEl && overlayEl.classList.contains('active')) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleCardClick();
        } else if (e.key === 'Escape') {
          closeFlorkIntro(true);
        }
      }
    });
  }

  // Typewriter Engine with stops and variable timing
  function typeMessage(text, pose = 'Wave.png', onComplete) {
    if (!textEl) return;

    if (typingTimeoutId) {
      clearTimeout(typingTimeoutId);
      typingTimeoutId = null;
    }

    isTyping = true;
    currentFullText = text;
    textEl.innerHTML = '';
    cursorEl.classList.remove('visible');
    nextBtnEl.disabled = false;

    if (imgEl) {
      imgEl.src = `assets/flork/${pose}`;
      imgEl.classList.add('talking');
    }

    let i = 0;

    function getDelayForChar(char, nextChar) {
      // Natural RPG stops
      if (char === '.' && nextChar === '.') return 100;
      if (char === '.' || char === '!' || char === '?') return 480; // Dramatic stop
      if (char === ',') return 260; // Breath pause
      if (char === ':' || char === ';') return 200;
      if (char === ' ') return 40;
      return 34; // Normal letter
    }

    function typeNextChar() {
      if (!isTyping) return;

      if (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1] || '';

        textEl.textContent += char;
        playRpgBlip(char);

        const delay = getDelayForChar(char, nextChar);
        i++;
        typingTimeoutId = setTimeout(typeNextChar, delay);
      } else {
        finishTyping(onComplete);
      }
    }

    typeNextChar();
  }

  function finishTyping(onComplete) {
    isTyping = false;
    if (typingTimeoutId) {
      clearTimeout(typingTimeoutId);
      typingTimeoutId = null;
    }
    if (textEl) {
      textEl.textContent = currentFullText;
    }
    if (imgEl) {
      imgEl.classList.remove('talking');
    }
    if (cursorEl) {
      cursorEl.classList.add('visible');
    }
    const indicator = document.getElementById('flork-step-indicator');
    if (indicator) {
      indicator.textContent = `Step ${currentStepIndex + 1} of ${currentScript.length}`;
    }
    if (currentStepIndex === currentScript.length - 1) {
      if (nextBtnEl) nextBtnEl.textContent = "Let's Cook! 🚀";
    } else {
      if (nextBtnEl) nextBtnEl.textContent = "Next ▶";
    }
    if (onComplete) onComplete();
  }

  function handleCardClick() {
    getAudioCtx(); // Resume Web Audio context on user gesture
    if (isTyping) {
      // Fast-forward current line instantly
      finishTyping();
    } else {
      // Advance to next dialogue step
      currentStepIndex++;
      if (currentStepIndex < currentScript.length) {
        showCurrentStep();
      } else {
        closeFlorkIntro(false);
      }
    }
  }

  function showCurrentStep() {
    const step = currentScript[currentStepIndex];
    if (!step) return;

    const indicator = document.getElementById('flork-step-indicator');
    if (indicator) {
      indicator.textContent = `Step ${currentStepIndex + 1} of ${currentScript.length}`;
    }

    typeMessage(step.text, step.pose);
  }

  // Start the RPG Intro Dialogue
  function startFlorkIntro(force = false) {
    createFlorkElements();
    getAudioCtx();

    // Determine current user display name
    let userName = 'Creator';
    if (window.currentUser) {
      userName = window.currentUser.name || (window.currentUser.email ? window.currentUser.email.split('@')[0] : 'Creator');
    } else {
      const displayEl = document.getElementById('username-display');
      if (displayEl && displayEl.innerText && displayEl.innerText !== '...') {
        userName = displayEl.innerText;
      }
    }

    // RPG Dialogue Script
    currentScript = [
      {
        text: `Hello! ${userName}, seems like youre new here!`,
        pose: 'Wave.png'
      },
      {
        text: `Welcome to Absolute Cinema! I am Flork, your studio director and guide.`,
        pose: 'Standing-happy.png'
      },
      {
        text: `Here you cook animated films, submit your work, earn AniChips, and unlock epic animator gear in our shop!`,
        pose: 'Morejoy.png'
      },
      {
        text: `Check out the weekly theme, hit '+ Create a film!', and set the stage on FIRE!`,
        pose: 'Standing-happy.png'
      },
      {
        text: `You can rewatch this intro anytime by clicking '🎬 Rewatch Intro' in the sidebar. Let's cook! 🚀`,
        pose: 'Morejoy.png'
      }
    ];

    currentStepIndex = 0;
    overlayEl.classList.add('active');
    document.body.classList.add('flork-intro-open');

    playFlorkChime(true);
    showCurrentStep();
  }

  function closeFlorkIntro(skipped = false) {
    if (overlayEl) {
      overlayEl.classList.remove('active');
    }
    document.body.classList.remove('flork-intro-open');

    // Clean up local storage flags
    localStorage.removeItem('cinema_new_arrival');
    localStorage.removeItem('cinema_flork_intro_seen');

    // Update backend so user is recorded as introduced
    const activeToken = localStorage.getItem('cinema_session') || (window.token || '');
    if (activeToken) {
      fetch('https://absolute-cinema-manager.hackclub.app/api/me/intro', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        }
      })
      .then(r => r.json())
      .then(data => {
        if (window.currentUser) {
          window.currentUser.has_seen_intro = true;
          window.currentUser.introduced = true;
        }
      })
      .catch(err => {
        console.warn('Intro sync to backend error:', err.message);
      });
    }

    if (window.currentUser) {
      window.currentUser.has_seen_intro = true;
      window.currentUser.introduced = true;
    }

    playFlorkChime(!skipped);
  }

  // ============================================================================
  // Flork Toast Notifier System (Mascot notifications)
  // ============================================================================

  let toastContainer = null;

  function ensureToastContainer() {
    if (!toastContainer) {
      let existing = document.getElementById('flork-toast-container');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'flork-toast-container';
        existing.className = 'flork-toast-container';
        document.body.appendChild(existing);
      }
      toastContainer = existing;
    }
    return toastContainer;
  }

  function florkNotify({ message, title = 'Flork', pose = 'Standing-happy.png', duration = 5000, type = 'info' }) {
    if (!message) return;
    ensureToastContainer();
    playFlorkChime(type !== 'error');

    const toast = document.createElement('div');
    toast.className = `flork-toast-item flork-toast-${type}`;

    toast.innerHTML = `
      <div class="flork-toast-mascot">
        <img src="assets/flork/${pose}" alt="Flork" class="flork-toast-img">
      </div>
      <div class="flork-toast-bubble">
        <div class="flork-toast-header">
          <strong>${title}</strong>
          <button type="button" class="flork-toast-close" aria-label="Close notification">&times;</button>
        </div>
        <div class="flork-toast-message">${message}</div>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('active');
    });

    const closeBtn = toast.querySelector('.flork-toast-close');
    let removeTimeout = null;

    function removeToast() {
      if (removeTimeout) clearTimeout(removeTimeout);
      toast.classList.remove('active');
      toast.classList.add('leaving');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast();
      });
    }

    toast.addEventListener('click', removeToast);

    if (duration > 0) {
      removeTimeout = setTimeout(removeToast, duration);
    }
  }

  // Hook for authfetch to call when user data is ready on dashboard
  let introAutoTriggered = false;

  window.initFlorkOnDashboard = function (userData) {
    if (userData && !window.currentUser) {
      window.currentUser = userData;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const forceIntro = urlParams.get('intro') === '1' || urlParams.get('intro') === 'true';

    // Backend field check: has_seen_intro / introduced
    const backendIntroduced = userData && (userData.has_seen_intro === true || userData.introduced === true);

    // If user has not been introduced on the backend yet, or forceIntro is requested in URL
    if ((!backendIntroduced || forceIntro) && !introAutoTriggered) {
      introAutoTriggered = true;
      setTimeout(() => {
        startFlorkIntro(forceIntro);
      }, 600);
    }
  };

  // Expose API globally
  window.startFlorkIntro = startFlorkIntro;
  window.florkNotify = florkNotify;

  // Auto-init on dashboard
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createFlorkElements();
    });
  } else {
    createFlorkElements();
  }
})();
