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

  const targetEmail = "creatorpoints.dev@gmail.com";
  const targetDashboard = window.location.protocol === "file:" ? "dashboard.html" : "/dashboard.html";

  async function handleCreatorRedirect(e) {
    const rawVal = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const placeholderVal = emailInput ? emailInput.placeholder.trim().toLowerCase() : "";
    const currentVal = rawVal || placeholderVal;

    if (currentVal === targetEmail) {
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
          body: JSON.stringify({ email: targetEmail })
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
      if (emailInput.value.trim().toLowerCase() === targetEmail) {
        if (signinLink) {
          signinLink.setAttribute("href", targetDashboard);
        }
      } else {
        if (signinLink) {
          signinLink.setAttribute("href", "https://absolute-cinema-manager.hackclub.app/login");
        }
      }
    });

    if (emailInput.value.trim().toLowerCase() === targetEmail) {
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

  function openFilmModal() {
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFilmModal() {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
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

  // 5. Project Form Submission
  const submissionForm = document.getElementById('submission-form');
  if (submissionForm) {
    submissionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = submissionForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerText : 'Submit Film 🎬';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Creating Project... 🚀';
      }

      const payload = {
        title: document.getElementById('film-title')?.value?.trim(),
        software: document.getElementById('film-software')?.value?.trim(),
        notes: document.getElementById('film-notes')?.value?.trim() || '',
        bannerUrl: document.getElementById('film-banner')?.value?.trim() || ''
      };

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('https://absolute-cinema-manager.hackclub.app/api/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create project');
        }

        const targetShowcaseUrl = data.url || `/projects/${data.uid}`;

        alert(`🎉 Film created successfully!\n\nView film:\n${targetShowcaseUrl}`);

        addProjectCardToDashboard(data.project);
        submissionForm.reset();
        closeFilmModal();
      } catch (err) {
        alert(`Error submitting film: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
        }
      }
    });
  }

  function addProjectCardToDashboard(project) {
    const listEl = document.getElementById('animation-list');
    if (!listEl || !project) return;

    const projectPageUrl = `/projects/${project.uid}`;

    const rawStatus = (project.status || "design").toLowerCase();
    let statusLabel = "Design";
    if (rawStatus === "submitted") statusLabel = "Pending Review";
    if (rawStatus === "approved") statusLabel = "Approved";
    if (rawStatus === "declined") statusLabel = "Declined";

    const card = document.createElement('article');
    card.className = 'animation-card';
    const bannerHtml = project.banner_url
      ? `<div style="max-height: 180px; overflow: hidden; border-radius: 8px; margin-bottom: 12px;"><img src="${escapeHtml(project.banner_url)}" style="width: 100%; max-height: 180px; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'"></div>`
      : '';
    const hoursHtml = Number(project.hours) > 0 ? `<p><strong>Time spent:</strong> ${project.hours} hours</p>` : '';
    const videoLinkHtml = project.youtube_url ? ` | <a href="${escapeHtml(project.youtube_url)}" target="_blank">View Video</a>` : '';

    card.innerHTML = `
      ${bannerHtml}
      <h3>${escapeHtml(project.title)}</h3>
      <p><strong>Software:</strong> ${escapeHtml(project.software)}</p>
      ${hoursHtml}
      <p><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
      <a href="${projectPageUrl}" target="_blank">🎬 View Film Page</a>${videoLinkHtml}
    `;

    listEl.prepend(card);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Load user projects if logged in
  if (token) {
    fetch('https://absolute-cinema-manager.hackclub.app/api/my-projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : [])
    .then(projects => {
      if (Array.isArray(projects) && projects.length > 0) {
        const listEl = document.getElementById('animation-list');
        if (listEl) {
          listEl.innerHTML = '';
          projects.forEach(p => addProjectCardToDashboard(p));
        }
      }
    })
    .catch(() => {});
  }
}