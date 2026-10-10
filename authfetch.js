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
const isShop = window.location.pathname.includes("shop");
const isProfile = window.location.pathname.includes("profile");
const isReview = window.location.pathname.includes("review");
const isAdminPage = window.location.pathname.includes("admin");
const isAppPage = isDashboard || isShop || isProfile || isReview || isAdminPage;
const isHomePage =
  !isAppPage &&
  (window.location.pathname === "/" ||
   window.location.pathname.endsWith("/index.html") ||
   window.location.pathname.endsWith("/index") ||
   window.location.pathname === "" ||
   window.location.pathname.endsWith("/"));

if (!token) {
  if (isAppPage) {
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
        window.userRole = userData.role || (userData.isAdmin ? "admin" : "participant");
        if (isHomePage) {
          window.location.replace(dashboardUrl);
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
      if (isAppPage) {
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

    const role = userData.role || (userData.isAdmin ? "admin" : "participant");
    window.currentUser = userData;
    window.userRole = role;

    const canReview = role === "reviewer" || role === "admin";
    const canAdmin = role === "admin";

    if (isHomePage) {
      if (userData.email && userData.email.toLowerCase() === "creatorpoints.dev@gmail.com") {
        window.location.replace(dashboardUrl);
        return;
      }
      window.location.replace(dashboardUrl);
      return;
    }

    if (isReview && !canReview) {
      window.location.replace(dashboardUrl);
      return;
    }

    if (isAdminPage && !canAdmin) {
      window.location.replace(dashboardUrl);
      return;
    }

    console.log("Safely landed on app page. Absolute Cinema is online.");
    const usernameEl = document.getElementById("username-display");
    if (usernameEl) {
      usernameEl.innerText = userData.name || userData.email || "Creator";
    }
    const anichipsEl = document.getElementById("anichips-balance");
    if (anichipsEl && userData.anichips !== undefined) {
      anichipsEl.innerText = userData.anichips;
    }
    const statChipsEl = document.getElementById("stats-anichips");
    if (statChipsEl && userData.anichips !== undefined) {
      statChipsEl.innerText = userData.anichips;
    }
    const reviewLink = document.getElementById("review-nav-link");
    if (reviewLink) {
      reviewLink.style.display = canReview ? "flex" : "none";
    }
    const adminLink = document.getElementById("admin-nav-link");
    if (adminLink) {
      adminLink.style.display = canAdmin ? "flex" : "none";
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
          window.location.replace(targetDashboard);
          return;
        }
      } catch (err) {
        console.warn("Session check error:", err);
      }
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
        await refreshDashboardData();
      } catch (err) {
        if (feedbackMsg) {
          feedbackMsg.textContent = err.message || 'Error creating film';
          feedbackMsg.style.display = 'block';
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

  function updateDashboardStats(userData, projects) {
    const chips = (userData && userData.anichips !== undefined && userData.anichips !== null) ? Number(userData.anichips) : 0;
    const statChipsEl = document.getElementById('stats-anichips');
    if (statChipsEl) {
      statChipsEl.textContent = chips;
    }
    const navChipsEl = document.getElementById('anichips-balance');
    if (navChipsEl) {
      navChipsEl.textContent = chips;
    }

    const projectList = Array.isArray(projects) ? projects : [];
    const totalHours = projectList.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    const formattedHours = Number.isInteger(totalHours) ? totalHours : (Math.round(totalHours * 10) / 10);
    const statHoursEl = document.getElementById('stats-total-hours');
    if (statHoursEl) {
      statHoursEl.textContent = formattedHours;
    }

    const statCountEl = document.getElementById('stats-animations-count');
    if (statCountEl) {
      statCountEl.textContent = projectList.length;
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
      let projects = [];
      if (projRes.ok) {
        try {
          const parsed = await projRes.json();
          if (Array.isArray(parsed)) projects = parsed;
        } catch (_) {}
      }

      window.currentUser = userData;
      const role = userData.role || (userData.isAdmin ? "admin" : "participant");
      window.userRole = role;

      const usernameEl = document.getElementById('username-display');
      if (usernameEl) {
        usernameEl.innerText = userData.name || userData.email || "Creator";
      }

      const canReview = role === "reviewer" || role === "admin";
      const canAdmin = role === "admin";
      const reviewLink = document.getElementById("review-nav-link");
      if (reviewLink) reviewLink.style.display = canReview ? "flex" : "none";
      const adminLink = document.getElementById("admin-nav-link");
      if (adminLink) adminLink.style.display = canAdmin ? "flex" : "none";

      updateDashboardStats(userData, projects);
      renderDashboardProjects(projects);
    } catch (err) {
    } finally {
      isRefreshing = false;
    }
  }

  refreshDashboardData();
  setInterval(refreshDashboardData, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshDashboardData();
    }
  });
}