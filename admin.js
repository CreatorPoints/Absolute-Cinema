(() => {
  const token = localStorage.getItem('cinema_session');
  let usersLoaded = false;
  let isUsersOpen = false;
  let currentModalUserId = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function fetchUsers() {
    const listEl = document.getElementById("users-table-body");
    const countBadge = document.getElementById("user-count-badge");
    if (!listEl) return;

    listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">Loading users...</td></tr>`;

    try {
      const res = await fetch("https://absolute-cinema-manager.hackclub.app/api/admin/users", {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(res.status === 403 ? "Forbidden: Admin access required." : "Failed to load users.");
      }

      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">No users found.</td></tr>`;
        return;
      }

      if (countBadge) {
        countBadge.innerText = String(users.length);
        countBadge.style.display = "inline-block";
      }

      listEl.innerHTML = users.map(u => {
        const role = (u.role || (u.is_admin ? "admin" : "participant")).toLowerCase();
        const chips = u.anichips !== undefined ? u.anichips : 0;
        const projectCount = u.project_count !== undefined ? u.project_count : 0;
        const name = escapeHtml(u.name || "Anonymous");
        const email = escapeHtml(u.email || "-");

        return `
          <tr id="user-row-${u.id}">
            <td><strong>#${u.id}</strong></td>
            <td>
              <div style="font-weight: 600; color: #f8fafc;">${name}</div>
              <div style="color: #64748b; font-size: 12px;">${email}</div>
            </td>
            <td>
              <select id="role-select-${u.id}" class="admin-role-select">
                <option value="participant" ${role === 'participant' ? 'selected' : ''}>Participant</option>
                <option value="reviewer" ${role === 'reviewer' ? 'selected' : ''}>Reviewer</option>
                <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td>
              <input type="number" id="chips-input-${u.id}" class="admin-chips-input" value="${chips}" min="0">
            </td>
            <td>
              <button type="button" class="admin-btn-films" onclick="openUserFilms(${u.id}, '${name.replace(/'/g, "\\'")}')">
                🎬 Films (${projectCount})
              </button>
            </td>
            <td>
              <button type="button" id="save-user-btn-${u.id}" class="admin-btn-save" onclick="saveUserData(${u.id})">
                💾 Save
              </button>
            </td>
          </tr>
        `;
      }).join('');

      usersLoaded = true;
    } catch (err) {
      listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  window.saveUserData = async function(userId) {
    const saveBtn = document.getElementById(`save-user-btn-${userId}`);
    const roleSelect = document.getElementById(`role-select-${userId}`);
    const chipsInput = document.getElementById(`chips-input-${userId}`);

    if (!roleSelect || !chipsInput) return;

    const role = roleSelect.value;
    const anichips = parseInt(chipsInput.value, 10);

    if (isNaN(anichips) || anichips < 0) {
      chipsInput.focus();
      return;
    }

    const originalText = saveBtn ? saveBtn.innerText : "💾 Save";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "Saving...";
    }

    try {
      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/admin/users/${userId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ role, anichips })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      if (saveBtn) {
        saveBtn.innerText = "✓ Saved!";
        saveBtn.style.background = "#22c55e";
        setTimeout(() => {
          saveBtn.innerText = originalText;
          saveBtn.style.background = "#3399dd";
          saveBtn.disabled = false;
        }, 1500);
      }
    } catch (err) {
      alert(`Error saving user: ${err.message}`);
      if (saveBtn) {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
      }
    }
  };

  window.openUserFilms = async function(userId, userName) {
    currentModalUserId = userId;
    const modal = document.getElementById("user-films-modal");
    const titleEl = document.getElementById("modal-user-films-title");
    const listEl = document.getElementById("user-films-list");

    if (!modal || !listEl) return;

    if (titleEl) titleEl.innerText = `Films by ${userName || 'Creator'}`;
    listEl.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 30px;">Loading films...</p>`;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    try {
      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/admin/users/${userId}/projects`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Failed to load user projects.");

      const projects = await res.json();
      if (!Array.isArray(projects) || projects.length === 0) {
        listEl.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 40px; font-size: 14px;">This creator has not created any films yet.</p>`;
        return;
      }

      listEl.innerHTML = projects.map(p => renderAdminFilmCard(p, userId)).join('');
    } catch (err) {
      listEl.innerHTML = `<p style="color: #f87171; text-align: center; padding: 30px;">${escapeHtml(err.message)}</p>`;
    }
  };

  function renderAdminFilmCard(p, userId) {
    const rawStatus = (p.status || "design").toLowerCase();
    const isAbsCinema = p.is_absolute_cinema === 1 || rawStatus === "absolute_cinema";

    let statusLabel = "Design";
    if (rawStatus === "submitted") statusLabel = "Pending Review";
    else if (rawStatus === "approved") statusLabel = "Approved";
    else if (rawStatus === "declined") statusLabel = "Declined";
    else if (isAbsCinema) statusLabel = "Absolute Cinema 🎬✨";

    let badgeClass = `status-${rawStatus}`;
    if (isAbsCinema) badgeClass = "status-absolute_cinema";

    const bannerHtml = p.banner_url
      ? `<div class="admin-film-banner-preview"><img src="${escapeHtml(p.banner_url)}" alt="Banner" onerror="this.parentElement.style.display='none'"></div>`
      : ``;

    const totalHours = Number(p.hours) || 0;
    const devlogCount = p.devlog_count !== undefined ? p.devlog_count : 0;
    const filmUrl = `/projects/${p.uid}`;

    return `
      <article class="admin-film-card ${isAbsCinema ? 'is-absolute-cinema' : ''}" id="film-card-${p.uid}">
        ${bannerHtml}
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
          <div>
            <h3 style="margin: 0 0 4px 0; color: #f8fafc; font-size: 17px;">${escapeHtml(p.title)}</h3>
            <span style="color: #64748b; font-size: 12px;">UID: ${escapeHtml(p.uid)} &bull; ⏱️ ${totalHours} hrs &bull; 📝 ${devlogCount} devlogs</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="meta-badge badge-status ${badgeClass}" id="badge-${p.uid}">${statusLabel}</span>
            <a href="${filmUrl}" target="_blank" class="sidebar-link" style="padding: 6px 12px; font-size: 12px; width: auto;">🎬 Showcase</a>
          </div>
        </div>

        <div class="admin-film-form-grid">
          <div>
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Title</label>
            <input type="text" id="film-title-${p.uid}" class="review-field-input" value="${escapeHtml(p.title)}" style="width: 100%; box-sizing: border-box; margin-top: 4px;">
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Software</label>
            <input type="text" id="film-software-${p.uid}" class="review-field-input" value="${escapeHtml(p.software || '')}" style="width: 100%; box-sizing: border-box; margin-top: 4px;">
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">YouTube Video URL</label>
            <input type="url" id="film-yt-${p.uid}" class="review-field-input" value="${escapeHtml(p.youtube_url || '')}" placeholder="https://youtube.com/..." style="width: 100%; box-sizing: border-box; margin-top: 4px;">
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Image Banner URL</label>
            <input type="url" id="film-banner-${p.uid}" class="review-field-input" value="${escapeHtml(p.banner_url || '')}" placeholder="https://..." style="width: 100%; box-sizing: border-box; margin-top: 4px;">
          </div>
          <div class="full-col">
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Description / Notes</label>
            <textarea id="film-notes-${p.uid}" class="review-field-input" rows="2" style="width: 100%; box-sizing: border-box; margin-top: 4px;">${escapeHtml(p.notes || '')}</textarea>
          </div>
          <div class="full-col">
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Reviewer Feedback</label>
            <textarea id="film-feedback-${p.uid}" class="review-field-input" rows="2" placeholder="Feedback visible to author..." style="width: 100%; box-sizing: border-box; margin-top: 4px;">${escapeHtml(p.review_feedback || '')}</textarea>
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Status</label>
            <select id="film-status-${p.uid}" class="admin-role-select" style="width: 100%; box-sizing: border-box; margin-top: 4px; padding: 10px;">
              <option value="design" ${rawStatus === 'design' ? 'selected' : ''}>Design</option>
              <option value="submitted" ${rawStatus === 'submitted' ? 'selected' : ''}>Pending Review</option>
              <option value="approved" ${rawStatus === 'approved' ? 'selected' : ''}>Approved</option>
              <option value="declined" ${rawStatus === 'declined' ? 'selected' : ''}>Declined</option>
              <option value="absolute_cinema" ${isAbsCinema ? 'selected' : ''}>Absolute Cinema 🎬✨</option>
            </select>
          </div>
        </div>

        <div class="admin-film-actions">
          <button type="button" class="action-btn btn-primary" onclick="saveFilmInfo('${p.uid}', ${userId})">
            💾 Save Film Changes
          </button>
          <button type="button" class="btn-absolute-cinema" onclick="toggleAbsoluteCinema('${p.uid}', ${userId})">
            ${isAbsCinema ? '🌟 Unmark Absolute Cinema' : '✨ Mark Absolute Cinema'}
          </button>
          <button type="button" class="btn-decline" style="margin-left: auto;" onclick="deleteFilmAdmin('${p.uid}', ${userId})">
            🗑️ Delete Film
          </button>
        </div>
      </article>
    `;
  }

  window.saveFilmInfo = async function(uid, userId) {
    const title = document.getElementById(`film-title-${uid}`)?.value?.trim();
    const software = document.getElementById(`film-software-${uid}`)?.value?.trim();
    const youtubeUrl = document.getElementById(`film-yt-${uid}`)?.value?.trim();
    const bannerUrl = document.getElementById(`film-banner-${uid}`)?.value?.trim();
    const notes = document.getElementById(`film-notes-${uid}`)?.value?.trim();
    const feedback = document.getElementById(`film-feedback-${uid}`)?.value?.trim();
    const status = document.getElementById(`film-status-${uid}`)?.value;

    if (!title || !software) {
      alert("Title and Software are required.");
      return;
    }

    try {
      const isAbs = status === "absolute_cinema";
      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/admin/projects/${encodeURIComponent(uid)}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          software,
          youtubeUrl,
          bannerUrl,
          notes,
          feedback,
          status: isAbs ? "absolute_cinema" : status,
          is_absolute_cinema: isAbs ? 1 : 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update film.");

      const card = document.getElementById(`film-card-${uid}`);
      if (card && isAbs) {
        card.classList.add("is-absolute-cinema");
      } else if (card) {
        card.classList.remove("is-absolute-cinema");
      }

      const badge = document.getElementById(`badge-${uid}`);
      if (badge) {
        let label = "Design";
        if (status === "submitted") label = "Pending Review";
        else if (status === "approved") label = "Approved";
        else if (status === "declined") label = "Declined";
        else if (isAbs) label = "Absolute Cinema 🎬✨";

        badge.className = `meta-badge badge-status status-${isAbs ? 'absolute_cinema' : status}`;
        badge.innerText = label;
      }

      alert("🎉 Film changes saved successfully!");
    } catch (err) {
      alert(`Error updating film: ${err.message}`);
    }
  };

  window.toggleAbsoluteCinema = async function(uid, userId) {
    try {
      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/admin/projects/${encodeURIComponent(uid)}/absolute-cinema`, {
        method: "POST",
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle Absolute Cinema.");

      openUserFilms(userId, document.getElementById("modal-user-films-title")?.innerText?.replace("Films by ", ""));
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  window.deleteFilmAdmin = async function(uid, userId) {
    const confirmed = confirm("Are you sure you want to permanently delete this film and all its devlogs?");
    if (!confirmed) return;

    try {
      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/admin/projects/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete film.");

      const card = document.getElementById(`film-card-${uid}`);
      if (card) card.remove();

      fetchUsers();
    } catch (err) {
      alert(`Error deleting film: ${err.message}`);
    }
  };

  function closeUserFilmsModal() {
    const modal = document.getElementById("user-films-modal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  function initAdmin() {
    const toggleBtn = document.getElementById("toggle-users-btn");
    const usersContainer = document.getElementById("users-container");
    const closeUsersBtn = document.getElementById("close-users-btn");
    const closeFilmsModalBtn = document.getElementById("close-user-films-x");
    const filmsModal = document.getElementById("user-films-modal");

    if (!toggleBtn || !usersContainer) return;

    function openUsers() {
      isUsersOpen = true;
      usersContainer.style.display = "block";
      toggleBtn.innerHTML = `👥 Hide User List <span id="user-count-badge" class="review-count-badge" style="display: none;">0</span>`;
      if (!usersLoaded) {
        fetchUsers();
      }
    }

    function closeUsers() {
      isUsersOpen = false;
      usersContainer.style.display = "none";
      toggleBtn.innerHTML = `👥 View User List <span id="user-count-badge" class="review-count-badge" style="display: none;">0</span>`;
    }

    toggleBtn.addEventListener("click", () => {
      if (isUsersOpen) closeUsers();
      else openUsers();
    });

    if (closeUsersBtn) closeUsersBtn.addEventListener("click", closeUsers);
    if (closeFilmsModalBtn) closeFilmsModalBtn.addEventListener("click", closeUserFilmsModal);

    if (filmsModal) {
      filmsModal.addEventListener("click", (e) => {
        if (e.target === filmsModal) closeUserFilmsModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filmsModal && filmsModal.classList.contains("active")) {
        closeUserFilmsModal();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
