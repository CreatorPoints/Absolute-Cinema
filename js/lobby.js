// ============================================================================
// Absolute Cinema — Forge-Style Interactive Reception Lobby & Hotspots
// ============================================================================

(function () {
  'use strict';

  function initLobbyInteractions() {
    const florkHotspot = document.getElementById('hotspot-flork');
    const doorHotspot = document.getElementById('hotspot-door');
    const dialogueCard = document.getElementById('flork-dialogue-card');
    const dialogueClose = document.getElementById('flork-dialogue-close');
    const speechText = document.getElementById('flork-speech-text');
    const avatarImg = document.getElementById('flork-avatar-img');
    const btnTicket = document.getElementById('flork-btn-ticket');
    const btnAdvice = document.getElementById('flork-btn-advice');
    const btnRooms = document.getElementById('flork-btn-rooms');

    const wisdomQuotes = [
      {
        text: "Rule #1 of 2D animation: If an in-between frame looks cursed, pretend it's an intentional smear frame! 😂",
        pose: "Morejoy.png"
      },
      {
        text: "24 frames per second means 1,440 drawings for a single minute. Keep hydrated and stretch those wrists, director! 💧",
        pose: "Standing-happy.png"
      },
      {
        text: "The green double doors lead to the screening rooms (/rooms). That's where films stream live during premiere night! 🎬",
        pose: "Wave.png"
      },
      {
        text: "Every AniChip in your wallet was forged in raw sweat and keyframes. Respect the craft! 🪙",
        pose: "Standing-happy.png"
      },
      {
        text: "Flork's Pro Tip: The best animated story isn't the one with the most frames, it's the one with the biggest heart! 🍿",
        pose: "Morejoy.png"
      },
      {
        text: "Wait... did you just click me again? Go animate! The premiere clock is ticking! ⏳",
        pose: "Standing-bruh.png"
      }
    ];

    let quoteIndex = 0;

    // Web Audio Sound Chime for RPG feel
    function playChime(freq = 587.33) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch (_) {}
    }

    function getUserName() {
      if (window.currentUser && window.currentUser.name) {
        return window.currentUser.name;
      }
      const userDisplay = document.getElementById('username-display');
      if (userDisplay && userDisplay.innerText && userDisplay.innerText !== '...') {
        return userDisplay.innerText;
      }
      return 'Director';
    }

    // 1. Hotspot: Flork Clicked
    if (florkHotspot && dialogueCard) {
      florkHotspot.addEventListener('click', (e) => {
        e.preventDefault();
        playChime(523.25);
        const name = getUserName();
        if (speechText) {
          speechText.innerHTML = `Welcome to the reception desk, <strong>${name}</strong>! 🍿 I'm Flork, your studio director. Check your premiere ticket, book a premiere screening room, or step through the green doors into the auditorium!`;
        }
        if (avatarImg) {
          avatarImg.src = 'assets/flork/Standing-happy.png';
        }
        dialogueCard.classList.add('active');
        dialogueCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    // 2. Hotspot: Green Door Clicked -> /rooms
    if (doorHotspot) {
      doorHotspot.addEventListener('click', (e) => {
        e.preventDefault();
        playChime(659.25);
        const destination = window.location.protocol === 'file:' ? 'rooms.html' : '/rooms';
        window.location.href = destination;
      });
    }

    // Flork action: Go to rooms button
    if (btnRooms) {
      btnRooms.addEventListener('click', (e) => {
        e.preventDefault();
        const destination = window.location.protocol === 'file:' ? 'rooms.html' : '/rooms';
        window.location.href = destination;
      });
    }

    // Flork action: View Ticket
    if (btnTicket) {
      btnTicket.addEventListener('click', () => {
        playChime(783.99);
        const ticketSection = document.getElementById('ticket');
        if (ticketSection) {
          ticketSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const ticketStub = ticketSection.querySelector('.cinema-ticket-stub');
          if (ticketStub) {
            ticketStub.classList.add('ticket-highlight');
            setTimeout(() => {
              ticketStub.classList.remove('ticket-highlight');
            }, 2000);
          }
        }
      });
    }

    // Flork action: Animator Wisdom / Dialogue cycle
    if (btnAdvice && speechText && avatarImg) {
      btnAdvice.addEventListener('click', () => {
        playChime(880);
        const quote = wisdomQuotes[quoteIndex % wisdomQuotes.length];
        quoteIndex++;
        speechText.textContent = quote.text;
        avatarImg.src = `assets/flork/${quote.pose}`;
      });
    }

    // Dialogue close button
    if (dialogueClose && dialogueCard) {
      dialogueClose.addEventListener('click', () => {
        dialogueCard.classList.remove('active');
      });
    }

    // Sidebar rooms link
    const sidebarRoomsLink = document.getElementById('sidebar-rooms-link');
    if (sidebarRoomsLink) {
      sidebarRoomsLink.addEventListener('click', (e) => {
        e.preventDefault();
        const destination = window.location.protocol === 'file:' ? 'rooms.html' : '/rooms';
        window.location.href = destination;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLobbyInteractions);
  } else {
    initLobbyInteractions();
  }
})();
