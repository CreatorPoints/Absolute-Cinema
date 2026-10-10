(() => {
  const token = localStorage.getItem('cinema_session');

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
    const pendingContainer = document.getElementById("pending-review-list");
    const reviewedContainer = document.getElementById("reviewed-list");
    const pendingBadge = document.getElementById("pending-count-badge");
    const reviewedBadge = document.getElementById("reviewed-count-badge");

    if (!pendingContainer && !reviewedContainer) return;

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
          if (pendingContainer) {
            pendingContainer.innerHTML = `<p style="color: #f87171;">Access denied. Only reviewers and admins can access this page.</p>`;
          }
          return;
        }
        throw new Error("Failed to load review submissions.");
      }

      const projects = await res.json();
      if (!Array.isArray(projects)) {
        throw new Error("Invalid projects response.");
      }

      const pending = projects.filter(p => (p.status || "").toLowerCase() === "submitted");
      const reviewed = projects.filter(p => {
        const s = (p.status || "").toLowerCase();
        return s === "approved" || s === "declined";
      });

      if (pendingBadge) pendingBadge.innerText = String(pending.length);
      if (reviewedBadge) reviewedBadge.innerText = String(reviewed.length);

      if (pendingContainer) {
        if (pending.length === 0) {
          pendingContainer.innerHTML = `<p style="color: #94a3b8; font-size: 14px;">No pending film submissions waiting for review.</p>`;
        } else {
          pendingContainer.innerHTML = pending.map(p => renderPendingCard(p)).join('');
        }
      }

      if (reviewedContainer) {
        if (reviewed.length === 0) {
          reviewedContainer.innerHTML = `<p style="color: #94a3b8; font-size: 14px;">No reviewed films yet.</p>`;
        } else {
          reviewedContainer.innerHTML = reviewed.map(p => renderReviewedCard(p)).join('');
        }
      }

    } catch (err) {
      if (pendingContainer) {
        pendingContainer.innerHTML = `<p style="color: #f87171;">Error loading reviews: ${escapeHtml(err.message)}</p>`;
      }
    }
  }

  function renderPendingCard(p) {
    const totalHours = Number(p.hours) || 0;
    const suggestedChips = Math.max(10, Math.round(totalHours * 3)) || 10;
    const authorText = p.author_name || p.author_email || "Creator";
    const devlogCount = p.devlog_count !== undefined ? p.devlog_count : 0;
    const filmUrl = `/projects/${p.uid}`;

    const bannerHtml = p.banner_url
      ? `<div class="review-card-banner"><img src="${escapeHtml(p.banner_url)}" alt="${escapeHtml(p.title)} Banner" onerror="this.parentElement.style.display='none'"></div>`
      : ``;

    return `
      <article class="review-card" id="card-${p.uid}">
        ${bannerHtml}
        <div class="review-card-header">
          <h3 class="review-card-title">${escapeHtml(p.title)}</h3>
          <span class="meta-badge badge-status status-submitted">Status: Pending Review</span>
        </div>
        <div class="review-card-meta">
          👤 <strong>${escapeHtml(authorText)}</strong> &bull; 🛠️ ${escapeHtml(p.software)} &bull; ⏱️ <strong>${totalHours} hrs</strong> &bull; 📝 ${devlogCount} devlogs
        </div>
        <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 14px 0; line-height: 1.5;">
          ${escapeHtml(p.notes || "No description provided.")}
        </p>

        <div class="review-card-inputs-grid">
          <div class="review-input-group">
            <label for="chips-${p.uid}">AniChips to Award</label>
            <input type="number" id="chips-${p.uid}" class="review-field-input" value="${suggestedChips}" min="0" placeholder="e.g. 30">
          </div>
          <div class="review-input-group">
            <label for="inflation-${p.uid}">Deflation / Inflation</label>
            <input type="text" id="inflation-${p.uid}" class="review-field-input" placeholder="e.g. 1.0x, +10%, or -5 chips">
          </div>
          <div class="review-input-group full-width">
            <label for="feedback-${p.uid}">Reviewer Feedback</label>
            <textarea id="feedback-${p.uid}" class="review-field-input" rows="2" placeholder="Write feedback for the creator..."></textarea>
          </div>
        </div>

        <div class="review-actions-row">
          <a href="${filmUrl}" class="sidebar-link" style="padding: 8px 14px; font-size: 13px; width: auto;">🎬 Inspect Film Showcase</a>
          <button type="button" id="btn-approve-${p.uid}" class="btn-approve" onclick="submitReviewAction('${p.uid}', 'approved')">✓ Approve Film</button>
          <button type="button" id="btn-decline-${p.uid}" class="btn-decline" onclick="submitReviewAction('${p.uid}', 'declined')">✗ Decline</button>
        </div>
      </article>
    `;
  }

  function renderReviewedCard(p) {
    const totalHours = Number(p.hours) || 0;
    const authorText = p.author_name || p.author_email || "Creator";
    const devlogCount = p.devlog_count !== undefined ? p.devlog_count : 0;
    const filmUrl = `/projects/${p.uid}`;
    const statusRaw = (p.status || "").toLowerCase();
    const isApproved = statusRaw === "approved";

    const badgeClass = isApproved ? "status-approved" : "status-declined";
    const badgeLabel = isApproved ? `✓ Approved (${p.anichips || 0} AniChips)` : `✗ Declined`;

    const bannerHtml = p.banner_url
      ? `<div class="review-card-banner"><img src="${escapeHtml(p.banner_url)}" alt="${escapeHtml(p.title)} Banner" onerror="this.parentElement.style.display='none'"></div>`
      : ``;

    const feedbackHtml = p.review_feedback
      ? `<div style="margin-top: 6px;"><strong>Feedback:</strong> ${escapeHtml(p.review_feedback)}</div>`
      : ``;
    const adjustmentHtml = p.review_adjustment
      ? `<div style="margin-top: 4px;"><strong>Deflation/Inflation:</strong> ${escapeHtml(p.review_adjustment)}</div>`
      : ``;

    return `
      <article class="review-card" style="opacity: 0.9;">
        ${bannerHtml}
        <div class="review-card-header">
          <h3 class="review-card-title">${escapeHtml(p.title)}</h3>
          <span class="meta-badge badge-status ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="review-card-meta">
          👤 <strong>${escapeHtml(authorText)}</strong> &bull; 🛠️ ${escapeHtml(p.software)} &bull; ⏱️ <strong>${totalHours} hrs</strong> &bull; 📝 ${devlogCount} devlogs
        </div>
        <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 10px 0; line-height: 1.5;">
          ${escapeHtml(p.notes || "No description provided.")}
        </p>

        <div class="review-summary-box">
          <div><strong>Review Status:</strong> Finalized (Cannot be re-reviewed)</div>
          ${isApproved ? `<div><strong>AniChips Awarded:</strong> ${p.anichips || 0}</div>` : ''}
          ${adjustmentHtml}
          ${feedbackHtml}
        </div>

        <div class="review-actions-row">
          <a href="${filmUrl}" class="sidebar-link" style="padding: 8px 14px; font-size: 13px; width: auto;">🎬 Inspect Film Showcase</a>
          <span style="color: #64748b; font-size: 12px; margin-left: auto;">🔒 Reviewed</span>
        </div>
      </article>
    `;
  }

  window.submitReviewAction = async function(uid, status) {
    const approveBtn = document.getElementById(`btn-approve-${uid}`);
    const declineBtn = document.getElementById(`btn-decline-${uid}`);
    const chipsInput = document.getElementById(`chips-${uid}`);
    const inflationInput = document.getElementById(`inflation-${uid}`);
    const feedbackInput = document.getElementById(`feedback-${uid}`);

    const anichips = chipsInput ? parseInt(chipsInput.value, 10) : 0;
    const deflationInflation = inflationInput ? inflationInput.value.trim() : "";
    const feedback = feedbackInput ? feedbackInput.value.trim() : "";

    if (status === "approved" && (isNaN(anichips) || anichips < 0)) {
      if (chipsInput) chipsInput.focus();
      return;
    }

    if (approveBtn) approveBtn.disabled = true;
    if (declineBtn) declineBtn.disabled = true;

    if (status === "approved" && approveBtn) {
      approveBtn.innerText = "Approving...";
    } else if (status === "declined" && declineBtn) {
      declineBtn.innerText = "Declining...";
    }

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`https://absolute-cinema-manager.hackclub.app/api/review/projects/${encodeURIComponent(uid)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          status,
          anichips: status === "approved" ? anichips : 0,
          feedback,
          deflation_inflation: deflationInflation
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Review operation failed.");
      }

      await loadReviewSubmissions();

    } catch (err) {
      console.error("Error submitting review:", err.message);
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.innerText = "✓ Approve Film";
      }
      if (declineBtn) {
        declineBtn.disabled = false;
        declineBtn.innerText = "✗ Decline";
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadReviewSubmissions);
  } else {
    loadReviewSubmissions();
  }
})();
