(() => {
  const token = localStorage.getItem('cinema_session');
  let currentFilmData = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractYoutubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\//, "");
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.includes("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1];
      }
      if (parsed.pathname.includes("/embed/")) {
        return parsed.pathname.split("/embed/")[1];
      }
      return parsed.searchParams.get("v");
    }
  } catch (e) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  }
  return null;
}

function getUidFromUrl() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const projectsIdx = pathParts.indexOf("projects");
  if (projectsIdx !== -1 && pathParts[projectsIdx + 1]) {
    return pathParts[projectsIdx + 1];
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("uid") || urlParams.get("id");
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function loadFilm() {
  const uid = getUidFromUrl();
  const loadingEl = document.getElementById("loading-state");
  const errorEl = document.getElementById("error-state");
  const contentEl = document.getElementById("project-content");

  if (!uid) {
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) {
      errorEl.style.display = "block";
      document.getElementById("error-message").innerText = "No film UID provided in URL.";
    }
    return;
  }

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      throw new Error(res.status === 404 ? "Film not found" : "Failed to load film details");
    }

    const data = await res.json();
    currentFilmData = data;

    renderFilmData(data);

    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";
  } catch (err) {
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) {
      errorEl.style.display = "block";
      document.getElementById("error-message").innerText = err.message || "Failed to load film.";
    }
  }
}

function renderFilmData(data) {
  document.title = `${data.title} - Absolute Cinema`;

  const titleEl = document.getElementById("project-title");
  if (titleEl) titleEl.innerText = data.title;

  const authorEl = document.getElementById("meta-author");
  if (authorEl) authorEl.innerText = `👤 ${data.author_name || "Creator"}`;

  const softwareEl = document.getElementById("meta-software");
  if (softwareEl) softwareEl.innerText = `🛠️ ${data.software}`;

  const hoursEl = document.getElementById("meta-hours");
  if (hoursEl) {
    const totalHours = Number(data.hours) || 0;
    hoursEl.innerText = `⏱️ ${totalHours} hrs`;
  }

  renderStatusBadge(data.status);

  const notesEl = document.getElementById("project-notes");
  if (notesEl) notesEl.innerText = data.notes || "No notes provided.";

  const videoWrapper = document.getElementById("video-container");
  const videoFrame = document.getElementById("video-frame");
  if (data.youtube_url) {
    const ytId = extractYoutubeId(data.youtube_url);
    if (ytId && videoFrame) {
      videoFrame.src = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`;
    } else if (videoFrame) {
      videoFrame.src = data.youtube_url;
    }
    if (videoWrapper) videoWrapper.style.display = "block";
  } else {
    if (videoWrapper) videoWrapper.style.display = "none";
  }

  const timelapseLink = document.getElementById("timelapse-link");
  if (timelapseLink) {
    if (data.timelapse_url) {
      timelapseLink.href = data.timelapse_url;
      timelapseLink.style.display = "inline-flex";
    } else {
      timelapseLink.style.display = "none";
    }
  }

  const canEdit = !!data.can_edit;
  const actionsCard = document.getElementById("film-actions-card");
  if (actionsCard) {
    actionsCard.style.display = canEdit ? "block" : "none";
  }

  const addDevlogBtn = document.getElementById("open-devlog-modal-btn");
  if (addDevlogBtn) {
    addDevlogBtn.style.display = canEdit ? "inline-flex" : "none";
  }

  const submitReviewBtn = document.getElementById("submit-review-btn");
  if (submitReviewBtn) {
    const status = (data.status || "design").toLowerCase();
    if (status === "design" || status === "declined") {
      submitReviewBtn.disabled = false;
      submitReviewBtn.style.opacity = "1";
      submitReviewBtn.style.cursor = "pointer";
      submitReviewBtn.innerText = status === "declined" ? "🔄 Resubmit for Review" : "🚀 Submit for Review";
    } else if (status === "submitted") {
      submitReviewBtn.disabled = true;
      submitReviewBtn.style.opacity = "0.7";
      submitReviewBtn.style.cursor = "default";
      submitReviewBtn.innerText = "⏳ Submitted (Under Review)";
    } else if (status === "approved") {
      submitReviewBtn.disabled = true;
      submitReviewBtn.style.opacity = "0.7";
      submitReviewBtn.style.cursor = "default";
      submitReviewBtn.innerText = "✓ Film Approved";
    }
  }

  renderDevlogs(data.devlogs || [], canEdit);
}

function renderStatusBadge(status) {
  const badgeEl = document.getElementById("meta-status");
  if (!badgeEl) return;

  const rawStatus = (status || "design").toLowerCase();
  badgeEl.className = `meta-badge badge-status status-${rawStatus}`;

  let label = "Design";
  if (rawStatus === "submitted") label = "Pending Review";
  if (rawStatus === "approved") label = "Approved";
  if (rawStatus === "declined") label = "Declined";

  badgeEl.innerText = `Status: ${label}`;
}

function renderDevlogs(devlogs, canEdit) {
  const container = document.getElementById("devlog-list");
  if (!container) return;

  if (!devlogs || devlogs.length === 0) {
    container.innerHTML = `
      <div class="devlog-empty">
        <p style="margin: 0;">No devlogs published yet. Log what you cooked to track hours!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = devlogs.map(log => {
    const formattedDate = new Date(log.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const hoursText = Number(log.hours) > 0 ? `+${log.hours} hrs` : "0 hrs";
    const lapseLinkHtml = log.lapse_url
      ? `<a href="${escapeHtml(log.lapse_url)}" target="_blank" rel="noopener noreferrer" class="devlog-lapse-link">📹 View Timelapse</a>`
      : `<span></span>`;
    const deleteBtnHtml = canEdit
      ? `<button type="button" class="devlog-delete-btn" onclick="deleteDevlog('${escapeHtml(log.uid || log.id)}')">Delete</button>`
      : ``;

    return `
      <article class="devlog-card">
        <div class="devlog-card-header">
          <h3 class="devlog-card-title">${escapeHtml(log.title)}</h3>
          <div class="devlog-meta-right">
            <span class="devlog-hours-badge">${hoursText}</span>
            <span class="devlog-date">${formattedDate}</span>
          </div>
        </div>
        <p class="devlog-description">${escapeHtml(log.description)}</p>
        <div class="devlog-footer">
          ${lapseLinkHtml}
          ${deleteBtnHtml}
        </div>
      </article>
    `;
  }).join('');
}

function openConfigureModal() {
  if (!currentFilmData) return;
  const modal = document.getElementById("configure-film-modal");
  if (!modal) return;

  const titleInput = document.getElementById("config-film-title");
  if (titleInput) titleInput.value = currentFilmData.title || "";

  const softwareInput = document.getElementById("config-film-software");
  if (softwareInput) softwareInput.value = currentFilmData.software || "";

  const notesInput = document.getElementById("config-film-notes");
  if (notesInput) notesInput.value = currentFilmData.notes || "";

  const ytInput = document.getElementById("config-film-youtube");
  if (ytInput) ytInput.value = currentFilmData.youtube_url || "";

  const lapseInput = document.getElementById("config-film-timelapse");
  if (lapseInput) lapseInput.value = currentFilmData.timelapse_url || "";

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeConfigureModal() {
  const modal = document.getElementById("configure-film-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function handleConfigureSubmit(e) {
  e.preventDefault();
  const uid = getUidFromUrl();
  if (!uid) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerText : "Save Changes";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Saving...";
  }

  const payload = {
    title: document.getElementById("config-film-title")?.value?.trim(),
    software: document.getElementById("config-film-software")?.value?.trim(),
    notes: document.getElementById("config-film-notes")?.value?.trim() || "",
    youtubeUrl: document.getElementById("config-film-youtube")?.value?.trim() || "",
    timelapseUrl: document.getElementById("config-film-timelapse")?.value?.trim() || ""
  };

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update film");
    }

    closeConfigureModal();
    await loadFilm();
  } catch (err) {
    alert(`Error updating film: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }
}

async function submitFilmForReview() {
  const uid = getUidFromUrl();
  if (!uid) return;

  const confirmed = confirm("Are you ready to submit your film for review?\n\nReviewers will inspect your devlogs, hours, and animation progress.");
  if (!confirmed) return;

  const btn = document.getElementById("submit-review-btn");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}/submit`, {
      method: "POST",
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to submit film for review");
    }

    alert("🎉 Film submitted for review! Reviewers will evaluate it soon.");
    await loadFilm();
  } catch (err) {
    alert(`Error submitting for review: ${err.message}`);
    if (btn) btn.disabled = false;
  }
}

async function deleteFilm() {
  const uid = getUidFromUrl();
  if (!uid) return;

  const filmTitle = currentFilmData?.title || "this film";
  const confirmed = confirm(`⚠️ Are you sure you want to delete "${filmTitle}"?\n\nThis will permanently remove the film and all its devlogs.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to delete film");
    }

    alert("Film deleted successfully.");
    window.location.replace("/dashboard.html");
  } catch (err) {
    alert(`Error deleting film: ${err.message}`);
  }
}

function openDevlogModal() {
  const modal = document.getElementById("devlog-modal");
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeDevlogModal() {
  const modal = document.getElementById("devlog-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function handleDevlogSubmit(e) {
  e.preventDefault();
  const uid = getUidFromUrl();
  if (!uid) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerText : "Post Devlog";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Posting...";
  }

  const payload = {
    title: document.getElementById("devlog-name")?.value?.trim(),
    description: document.getElementById("devlog-description")?.value?.trim(),
    hours: parseFloat(document.getElementById("devlog-hours")?.value) || 0,
    lapseUrl: document.getElementById("devlog-lapse-url")?.value?.trim() || ""
  };

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}/devlogs`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to post devlog");
    }

    e.target.reset();
    closeDevlogModal();
    await loadFilm();
  } catch (err) {
    alert(`Error posting devlog: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }
}

window.deleteDevlog = async function(devlogId) {
  const uid = getUidFromUrl();
  if (!uid || !devlogId) return;

  const confirmed = confirm("Are you sure you want to delete this devlog?");
  if (!confirmed) return;

  try {
    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/projects/${encodeURIComponent(uid)}/devlogs/${encodeURIComponent(devlogId)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to delete devlog");
    }

    await loadFilm();
  } catch (err) {
    alert(`Error deleting devlog: ${err.message}`);
  }
};

function copyProjectLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) {
      const originalText = shareBtn.innerText;
      shareBtn.innerText = "✓ Link Copied!";
      setTimeout(() => {
        shareBtn.innerText = originalText;
      }, 2000);
    }
  }).catch(() => {
    prompt("Copy this link:", window.location.href);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadFilm();

  const configureBtn = document.getElementById("open-configure-btn");
  if (configureBtn) configureBtn.addEventListener("click", openConfigureModal);

  const closeConfigBtn = document.getElementById("close-configure-modal");
  if (closeConfigBtn) closeConfigBtn.addEventListener("click", closeConfigureModal);

  const closeConfigX = document.getElementById("close-configure-x");
  if (closeConfigX) closeConfigX.addEventListener("click", closeConfigureModal);

  const configForm = document.getElementById("configure-form");
  if (configForm) configForm.addEventListener("submit", handleConfigureSubmit);

  const submitReviewBtn = document.getElementById("submit-review-btn");
  if (submitReviewBtn) submitReviewBtn.addEventListener("click", submitFilmForReview);

  const deleteFilmBtn = document.getElementById("delete-film-btn");
  if (deleteFilmBtn) deleteFilmBtn.addEventListener("click", deleteFilm);

  const openDevlogBtn = document.getElementById("open-devlog-modal-btn");
  if (openDevlogBtn) openDevlogBtn.addEventListener("click", openDevlogModal);

  const closeDevlogBtn = document.getElementById("close-devlog-modal");
  if (closeDevlogBtn) closeDevlogBtn.addEventListener("click", closeDevlogModal);

  const closeDevlogX = document.getElementById("close-devlog-x");
  if (closeDevlogX) closeDevlogX.addEventListener("click", closeDevlogModal);

  const devlogForm = document.getElementById("devlog-form");
  if (devlogForm) devlogForm.addEventListener("submit", handleDevlogSubmit);

  const shareBtn = document.getElementById("share-btn");
  if (shareBtn) shareBtn.addEventListener("click", copyProjectLink);
});
})();
