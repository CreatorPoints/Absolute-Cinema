const token = localStorage.getItem('cinema_session');
const isLocalDevelopment =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.endsWith(".local") ||
  window.location.protocol === "file:";

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadReviewSubmissions() {
  const container = document.getElementById("review-list");
  if (!container) return;

  try {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("https://absolute-cinema-manager.hackclub.app/api/review/projects", {
      headers
    });

    if (!res.ok) {
      if (res.status === 403) {
        container.innerHTML = `<p style="color: #f87171;">Access denied. Only reviewers and admins can access this page.</p>`;
        return;
      }
      throw new Error("Failed to load review submissions.");
    }

    const projects = await res.json();
    if (!Array.isArray(projects) || projects.length === 0) {
      container.innerHTML = `<p style="color: #94a3b8;">No film submissions found.</p>`;
      return;
    }

    const pending = projects.filter(p => (p.status || "").toLowerCase() === "submitted");
    const others = projects.filter(p => (p.status || "").toLowerCase() !== "submitted");
    const sorted = [...pending, ...others];

    container.innerHTML = sorted.map(p => {
      const statusRaw = (p.status || "design").toLowerCase();
      let statusClass = "status-design";
      let statusLabel = "Design";
      if (statusRaw === "submitted") {
        statusClass = "status-submitted";
        statusLabel = "Pending Review";
      } else if (statusRaw === "approved") {
        statusClass = "status-approved";
        statusLabel = "Approved";
      } else if (statusRaw === "declined") {
        statusClass = "status-declined";
        statusLabel = "Declined";
      }

      const totalHours = Number(p.hours) || 0;
      const devlogCount = p.devlog_count !== undefined ? p.devlog_count : 0;
      const authorText = p.author_name || p.author_email || "Creator";
      const filmUrl = isLocalDevelopment ? `/project.html?uid=${p.uid}` : `/projects/${p.uid}`;

      const reviewActionsHtml = `
        <div class="review-actions-row">
          <a href="${filmUrl}" target="_blank" class="sidebar-link" style="padding: 8px 14px; font-size: 13px; width: auto;">🎬 Inspect Film Showcase</a>
          <button type="button" class="btn-approve" onclick="approveFilm('${p.uid}', ${totalHours})">✓ Approve Film</button>
          <button type="button" class="btn-decline" onclick="declineFilm('${p.uid}')">✗ Decline</button>
        </div>
      `;

      return `
        <article class="review-card">
          <div class="review-card-header">
            <h3 class="review-card-title">${escapeHtml(p.title)}</h3>
            <span class="meta-badge badge-status ${statusClass}">Status: ${statusLabel}</span>
          </div>
          <div class="review-card-meta">
            👤 <strong>${escapeHtml(authorText)}</strong> &bull; 🛠️ ${escapeHtml(p.software)} &bull; ⏱️ <strong>${totalHours} hrs</strong> &bull; 📝 ${devlogCount} devlogs
          </div>
          <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 10px 0; line-height: 1.5;">${escapeHtml(p.notes || "No description provided.")}</p>
          ${reviewActionsHtml}
        </article>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<p style="color: #f87171;">Error loading reviews: ${escapeHtml(err.message)}</p>`;
  }
}

window.approveFilm = async function(uid, hours) {
  const suggestedChips = Math.max(10, Math.round(hours * 3)) || 10;
  const inputChips = prompt(`Award AniChips for this animation:`, String(suggestedChips));
  if (inputChips === null) return;

  const chips = parseInt(inputChips, 10);
  if (isNaN(chips) || chips < 0) {
    alert("Please enter a valid positive number for AniChips.");
    return;
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/review/projects/${encodeURIComponent(uid)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "approved", anichips: chips })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Approval failed");

    alert(`🎉 Film approved! ${chips} AniChips awarded.`);
    loadReviewSubmissions();
  } catch (err) {
    alert(`Error approving film: ${err.message}`);
  }
};

window.declineFilm = async function(uid) {
  const notes = prompt("Enter feedback / decline reason for creator (optional):", "");
  if (notes === null) return;

  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/review/projects/${encodeURIComponent(uid)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "declined", notes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Decline failed");

    alert("Film marked as declined.");
    loadReviewSubmissions();
  } catch (err) {
    alert(`Error declining film: ${err.message}`);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  loadReviewSubmissions();
});
