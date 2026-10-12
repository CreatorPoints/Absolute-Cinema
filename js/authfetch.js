// 1. Check if we just arrived from the backend login with a fresh token
const urlParams = new URLSearchParams(window.location.search);
const sessionToken = urlParams.get('session');

if (sessionToken) {
  // Save it safely in the browser's local storage (Browsers can't block this!)
  localStorage.setItem('cinema_session', sessionToken);
  
  // Clean the URL so the token vanishes from the address bar
  window.history.replaceState({}, document.title, window.location.pathname);
}

// 2. Retrieve our token for making API calls
let token = localStorage.getItem('cinema_session');
const dashboardUrl = window.location.protocol === "file:" ? "dashboard.html" : "/dashboard.html";
const isDashboard = window.location.pathname.includes("dashboard");
const isHomePage =
  !isDashboard &&
  (window.location.pathname === "/" ||
   window.location.pathname.endsWith("/index.html") ||
   window.location.pathname.endsWith("/index") ||
   window.location.pathname === "" ||
   window.location.pathname.endsWith("/"));

function checkIsAdminUser(userData) {
  if (!userData) return false;
  if (userData.isAdmin || userData.is_admin === 1 || userData.role === "admin") return true;
  if (userData.email && (
    userData.email.toLowerCase() === "creatorpoints.dev@gmail.com" ||
    userData.email.toLowerCase() === "ghoshsoumyadeep48@gmail.com"
  )) return true;
  return false;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderIndexSignedInState(userData, isAdmin) {
  const regSection = document.querySelector(".registration");
  if (!regSection) return;

  const displayName = userData.name || (userData.email ? userData.email.split('@')[0] : "Creator");
  const roleName = isAdmin ? "Admin" : (userData.role === "reviewer" ? "Reviewer" : "Participant");

  regSection.innerHTML = `
    <div class="signed-in-card">
      <div class="signed-in-user-row">
        <h1>Welcome, <span class="highlight-user">${escapeHtml(displayName)}</span>! 👋</h1>
        <span class="user-role-badge ${isAdmin ? 'badge-admin' : 'badge-participant'}">${roleName}</span>
      </div>
      <p class="signed-in-note">You are signed in with Hack Club.</p>
      
      <div class="wip-banner">
        <span class="wip-icon">🚨</span>
        <p class="wip-message">CreatorPoints is busy making the cinema hall</p>
      </div>

      <div class="signed-in-actions">
        ${isAdmin ? `<a href="${dashboardUrl}" class="enter-dash-btn"><button class="signin">Enter Dashboard 🛠️</button></a>` : ''}
        <button class="logout-btn" onclick="logoutCinema()">Log out</button>
      </div>
    </div>
  `;
}

if (!token) {
  if (isDashboard) {
    window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
  } else {
    fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
      credentials: "include",
      cache: "no-store"
    })
    .then(r => r.ok ? r.json() : null)
    .then(userData => {
      if (userData) {
        if (userData.sessionId) {
          localStorage.setItem('cinema_session', userData.sessionId);
          token = userData.sessionId;
        }
        window.currentUser = userData;
        const isAdmin = checkIsAdminUser(userData);
        window.userRole = userData.role || (isAdmin ? "admin" : "participant");

        if (isDashboard) {
          if (!isAdmin) {
            window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
            return;
          }
          document.body.classList.remove('auth-pending');
        } else if (isHomePage) {
          renderIndexSignedInState(userData, isAdmin);
        }
      }
    })
    .catch(() => {});
  }
} else {
  // 3. We have a token! Ask the backend who we are.
  fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}` // THE VIP PASS
    },
    credentials: "include",
    cache: "no-store"
  })
  .then(response => {
    if (!response.ok) {
      localStorage.removeItem('cinema_session');
      if (isDashboard) {
        window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
      }
      throw new Error("Session invalid or expired.");
    }
    return response.json();
  })
  .then(userData => {
    console.log("Welcome back:", userData.name);
    
    if (userData.sessionId && !localStorage.getItem('cinema_session')) {
      localStorage.setItem('cinema_session', userData.sessionId);
      token = userData.sessionId;
    }

    const isAdmin = checkIsAdminUser(userData);
    const role = userData.role || (isAdmin ? "admin" : "participant");
    window.currentUser = userData;
    window.userRole = role;

    if (isDashboard) {
      if (!isAdmin) {
        // Participants & reviewers cannot access the dashboard during WIP
        window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
        return;
      }
      // Admins are authorized! Reveal dashboard
      document.body.classList.remove('auth-pending');
    }

    if (isHomePage) {
      renderIndexSignedInState(userData, isAdmin);
      return;
    }

    console.log("Safely landed on app page. Absolute Cinema is online.");
    const usernameEl = document.getElementById("username-display");
    if (usernameEl) {
      usernameEl.innerText = userData.name || userData.email || "Creator";
    }
    const anichipsEl = document.getElementById("anichips-balance");
    if (anichipsEl && userData.anichips !== undefined) {
      animateStatNumber(anichipsEl, userData.anichips, 1000, false);
    }
    const statChipsEl = document.getElementById("stats-anichips");
    if (statChipsEl && userData.anichips !== undefined) {
      animateStatNumber(statChipsEl, userData.anichips, 1000, false);
    }
  })
  .catch(error => {
    console.error("Auth status:", error.message);
  });
}

function initIndexEmailHandler() {
  const emailInput = document.getElementById("email");
  const signinBtn = document.querySelector(".signin");
  const signinLink = document.querySelector(".registration a");

  if (!emailInput && !signinBtn && !signinLink) return;

  const adminEmails = ["creatorpoints.dev@gmail.com", "ghoshsoumyadeep48@gmail.com"];
  const targetDashboard = window.location.protocol === "file:" ? "dashboard.html" : "/dashboard.html";

  async function handleCreatorRedirect(e) {
    const rawVal = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const placeholderVal = emailInput ? emailInput.placeholder.trim().toLowerCase() : "";
    const currentVal = rawVal || placeholderVal;

    if (adminEmails.includes(currentVal)) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const activeToken = localStorage.getItem("cinema_session");
      if (activeToken) {
        localStorage.setItem("cinema_new_arrival", "true");
        window.location.replace(targetDashboard);
        return;
      }

      if (signinBtn) {
        signinBtn.disabled = true;
        signinBtn.innerText = "Entering... 🎬";
      }

      try {
        const res = await fetch("https://absolute-cinema-manager.hackclub.app/api/auth/session-by-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentVal })
        });
        const data = await res.json();
        if (data && data.sessionId) {
          localStorage.setItem("cinema_session", data.sessionId);
          localStorage.setItem("cinema_new_arrival", "true");
          window.location.replace(targetDashboard);
          return;
        }
      } catch (err) {
        console.warn("Session check error:", err);
      }
      localStorage.setItem("cinema_new_arrival", "true");
      window.location.href = "https://absolute-cinema-manager.hackclub.app/login";
    }
  }

  if (signinBtn) {
    signinBtn.addEventListener("click", handleCreatorRedirect);
  }
  if (signinLink) {
    signinLink.addEventListener("click", handleCreatorRedirect);
  }
  if (emailInput) {
    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreatorRedirect(e);
      }
    });

    emailInput.addEventListener("input", () => {
      const val = emailInput.value.trim().toLowerCase();
      if (adminEmails.includes(val)) {
        if (signinLink) {
          signinLink.setAttribute("href", targetDashboard);
        }
      } else {
        if (signinLink) {
          signinLink.setAttribute("href", "https://absolute-cinema-manager.hackclub.app/login");
        }
      }
    });

    if (adminEmails.includes(emailInput.value.trim().toLowerCase())) {
      if (signinLink) {
        signinLink.setAttribute("href", targetDashboard);
      }
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIndexEmailHandler);
} else {
  initIndexEmailHandler();
}

function animateStatNumber(element, targetValue, duration = 1200, isDecimal = false) {
  if (!element) return;
  const target = Number(targetValue) || 0;
  const currentValAttr = element.getAttribute('data-val');
  const start = currentValAttr !== null ? (parseFloat(currentValAttr) || 0) : (parseFloat(element.textContent) || 0);

  if (currentValAttr !== null && start === target) {
    return;
  }

  element.setAttribute('data-val', target);

  if (element._animFrameId) {
    cancelAnimationFrame(element._animFrameId);
  }

  if (start === target) {
    element.textContent = isDecimal ? target.toFixed(1) : target;
    return;
  }

  element.classList.add('stat-counting');
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Smooth cubic ease-out
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * easeProgress;

    if (isDecimal) {
      element.textContent = current.toFixed(1);
    } else {
      element.textContent = Math.round(current);
    }

    if (progress < 1) {
      element._animFrameId = requestAnimationFrame(step);
    } else {
      element.textContent = isDecimal ? target.toFixed(1) : target;
      element._animFrameId = null;
      element.classList.remove('stat-counting');
    }
  }

  element._animFrameId = requestAnimationFrame(step);
}

// BONUS: A global logout function you can attach to any button on your site
window.logoutCinema = async function() {
  const currentToken = localStorage.getItem('cinema_session');
  localStorage.removeItem('cinema_session');
  if (currentToken) {
    try {
      await fetch("https://absolute-cinema-manager.hackclub.app/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentToken}` }
      });
    } catch (err) {
      console.warn("Logout notification failed:", err.message);
    }
  }
  window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
};

// 4. Modal popup handling for "Create a film!"
if (isDashboard) {
  const openButtons = document.querySelectorAll('.open-film-modal-btn');
  const modal = document.getElementById('film-modal');
  const closeBtn = document.getElementById('close-film-modal');
  const closeX = document.getElementById('close-film-x');
  const feedbackMsg = document.getElementById('modal-feedback-msg');

  function openFilmModal() {
    if (modal) {
      if (feedbackMsg) {
        feedbackMsg.textContent = '';
        feedbackMsg.style.display = 'none';
      }
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFilmModal() {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      if (feedbackMsg) {
        feedbackMsg.textContent = '';
        feedbackMsg.style.display = 'none';
      }
    }
  }

  openButtons.forEach(btn => btn.addEventListener('click', openFilmModal));
  if (closeBtn) closeBtn.addEventListener('click', closeFilmModal);
  if (closeX) closeX.addEventListener('click', closeFilmModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeFilmModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeFilmModal();
    }
  });

  const submissionForm = document.getElementById('submission-form');
  if (submissionForm) {
    submissionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = submissionForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerText : 'Submit Film 🎬';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Creating Film... 🎬';
      }
      if (feedbackMsg) {
        feedbackMsg.textContent = '';
        feedbackMsg.style.display = 'none';
      }

      const payload = {
        title: document.getElementById('film-title')?.value?.trim(),
        software: document.getElementById('film-software')?.value?.trim(),
        notes: document.getElementById('film-notes')?.value?.trim() || '',
        bannerUrl: document.getElementById('film-banner')?.value?.trim() || ''
      };

      try {
        const activeToken = localStorage.getItem('cinema_session') || token;
        const headers = { 'Content-Type': 'application/json' };
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }

        const res = await fetch('https://absolute-cinema-manager.hackclub.app/api/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create film');
        }

        submissionForm.reset();
        closeFilmModal();
        if (window.florkNotify) {
          window.florkNotify({
            message: `"${payload.title || 'Your film'}" was submitted! Let's cook! 🎬`,
            pose: 'Morejoy.png',
            title: 'Film Submitted!'
          });
        }
        await refreshDashboardData();
      } catch (err) {
        if (feedbackMsg) {
          feedbackMsg.textContent = err.message || 'Error creating film';
          feedbackMsg.style.display = 'block';
        }
        if (window.florkNotify) {
          window.florkNotify({
            message: err.message || 'Error creating film',
            pose: 'Standing-bruh.png',
            title: 'Submission Error',
            type: 'error'
          });
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createProjectCard(project) {
    const projectPageUrl = `/projects/${project.uid}`;

    const rawStatus = (project.status || "design").toLowerCase();
    const isAbsCinema = project.is_absolute_cinema === 1 || project.is_absolute_cinema === true || rawStatus === "absolute_cinema";

    let statusLabel = "Design";
    let statusColor = "#94a3b8";
    if (isAbsCinema) {
      statusLabel = "Absolute Cinema 🎬✨";
      statusColor = "#f59e0b";
    } else if (rawStatus === "submitted") {
      statusLabel = "Pending Review ⏳";
      statusColor = "#38bdf8";
    } else if (rawStatus === "approved") {
      statusLabel = "Approved ✅";
      statusColor = "#22c55e";
    } else if (rawStatus === "declined") {
      statusLabel = "Declined ❌";
      statusColor = "#ef4444";
    }

    const card = document.createElement('article');
    card.className = 'animation-card';
    const bannerHtml = project.banner_url
      ? `<div style="max-height: 180px; overflow: hidden; border-radius: 8px; margin-bottom: 12px;"><img src="${escapeHtml(project.banner_url)}" style="width: 100%; max-height: 180px; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'"></div>`
      : '';
    const hoursHtml = Number(project.hours) > 0 ? `<p><strong>Time spent:</strong> ${project.hours} hrs</p>` : '';
    const videoLinkHtml = project.youtube_url ? ` | <a href="${escapeHtml(project.youtube_url)}">View Video</a>` : '';

    card.innerHTML = `
      ${bannerHtml}
      <h3>${escapeHtml(project.title)}</h3>
      <p><strong>Software:</strong> ${escapeHtml(project.software)}</p>
      ${hoursHtml}
      <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${escapeHtml(statusLabel)}</span></p>
      <a href="${projectPageUrl}">🎬 View Film Page</a>${videoLinkHtml}
    `;

    return card;
  }

  let statsSectionVisible = false;
  let latestStatsData = null;

  function triggerStatsAnimation() {
    if (!latestStatsData) return;
    const { chips, formattedHours, hasDecimal, count } = latestStatsData;
    const statChipsEl = document.getElementById('stats-anichips');
    if (statChipsEl) {
      animateStatNumber(statChipsEl, chips, 1200, false);
    }
    const statHoursEl = document.getElementById('stats-total-hours');
    if (statHoursEl) {
      animateStatNumber(statHoursEl, formattedHours, 1200, hasDecimal);
    }
    const statCountEl = document.getElementById('stats-animations-count');
    if (statCountEl) {
      animateStatNumber(statCountEl, count, 1200, false);
    }
  }

  function initDashboardStatsObserver() {
    const statsSection = document.getElementById('stats') || document.querySelector('.stats-overview');
    if (!statsSection) {
      statsSectionVisible = true;
      return;
    }

    function onVisible() {
      if (!statsSectionVisible) {
        statsSectionVisible = true;
        triggerStatsAnimation();
      }
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onVisible();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(statsSection);
    } else {
      function checkInView() {
        const rect = statsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
          onVisible();
          window.removeEventListener('scroll', checkInView);
        }
      }
      window.addEventListener('scroll', checkInView, { passive: true });
      checkInView();
    }
  }

  let lastKnownChips = null;

  function updateDashboardStats(userData, projects) {
    const chips = (userData && userData.anichips !== undefined && userData.anichips !== null) ? Number(userData.anichips) : 0;
    const navChipsEl = document.getElementById('anichips-balance');
    if (navChipsEl) {
      animateStatNumber(navChipsEl, chips, 1200, false);
    }

    if (lastKnownChips !== null && chips > lastKnownChips && window.florkNotify) {
      const diff = chips - lastKnownChips;
      window.florkNotify({
        message: `You earned +${diff} AniChips! Balance is now ${chips} chips! 🍿`,
        pose: 'Morejoy.png',
        title: 'Chips Earned!'
      });
    }
    lastKnownChips = chips;

    const projectList = Array.isArray(projects) ? projects : [];
    const totalHours = projectList.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    const hasDecimal = !Number.isInteger(totalHours);
    const formattedHours = hasDecimal ? (Math.round(totalHours * 10) / 10) : totalHours;

    latestStatsData = {
      chips,
      formattedHours,
      hasDecimal,
      count: projectList.length
    };

    if (statsSectionVisible) {
      triggerStatsAnimation();
    }
  }

  let lastProjectsJson = null;

  function renderDashboardProjects(projects) {
    const listEl = document.getElementById('animation-list');
    if (!listEl) return;

    const currentJson = JSON.stringify(projects || []);
    if (currentJson === lastProjectsJson) {
      return;
    }
    lastProjectsJson = currentJson;

    listEl.innerHTML = '';
    if (!Array.isArray(projects) || projects.length === 0) {
      listEl.innerHTML = '<p style="color: #94a3b8;">You have no films cooked yet!</p>';
      return;
    }

    projects.forEach(p => {
      listEl.appendChild(createProjectCard(p));
    });
  }

  function addProjectCardToDashboard(project) {
    if (!project) return;
    refreshDashboardData();
  }

  let isRefreshing = false;

  async function refreshDashboardData() {
    const currentToken = localStorage.getItem('cinema_session') || token;
    if (!currentToken) return;
    if (isRefreshing) return;
    isRefreshing = true;

    try {
      const [meRes, projRes] = await Promise.all([
        fetch('https://absolute-cinema-manager.hackclub.app/api/me', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
          cache: 'no-store'
        }),
        fetch('https://absolute-cinema-manager.hackclub.app/api/my-projects', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
          cache: 'no-store'
        })
      ]);

      if (!meRes.ok) {
        if (meRes.status === 401 || meRes.status === 403) {
          localStorage.removeItem('cinema_session');
          window.location.replace('/');
        }
        return;
      }

      const userData = await meRes.json();
      const isAdmin = checkIsAdminUser(userData);
      if (!isAdmin) {
        window.location.replace(window.location.protocol === "file:" ? "index.html" : "/");
        return;
      }
      document.body.classList.remove('auth-pending');

      let projects = [];
      if (projRes.ok) {
        try {
          const parsed = await projRes.json();
          if (Array.isArray(parsed)) projects = parsed;
        } catch (_) {}
      }

      window.currentUser = userData;
      const role = userData.role || (isAdmin ? "admin" : "participant");
      window.userRole = role;

      const usernameEl = document.getElementById('username-display');
      if (usernameEl) {
        usernameEl.innerText = userData.name || userData.email || "Creator";
      }

      updateDashboardStats(userData, projects);
      renderDashboardProjects(projects);
    } catch (err) {
    } finally {
      isRefreshing = false;
    }
  }

  refreshDashboardData();
  initDashboardStatsObserver();
  setInterval(refreshDashboardData, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshDashboardData();
    }
  });
}