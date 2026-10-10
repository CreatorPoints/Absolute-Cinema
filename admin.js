(() => {
  const token = localStorage.getItem('cinema_session');
  let usersLoaded = false;
  let isUsersOpen = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchUsers() {
    const listEl = document.getElementById("users-table-body");
    const countBadge = document.getElementById("user-count-badge");
    if (!listEl) return;

    listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">Loading users...</td></tr>`;

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("https://absolute-cinema-manager.hackclub.app/api/admin/users", {
        headers
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
        let roleClass = "role-participant";
        if (role === "admin") roleClass = "role-admin";
        else if (role === "reviewer") roleClass = "role-reviewer";

        const anichips = u.anichips !== undefined ? u.anichips : 0;
        const joinedDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : "-";

        return `
          <tr>
            <td><strong>#${escapeHtml(u.id)}</strong></td>
            <td>${escapeHtml(u.name || "Anonymous")}</td>
            <td>${escapeHtml(u.email || "-")}</td>
            <td><span class="role-pill ${roleClass}">${escapeHtml(role)}</span></td>
            <td>🪙 ${anichips}</td>
            <td style="color: #64748b;">${joinedDate}</td>
          </tr>
        `;
      }).join('');

      usersLoaded = true;
    } catch (err) {
      listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function initAdmin() {
    const toggleBtn = document.getElementById("toggle-users-btn");
    const usersContainer = document.getElementById("users-container");
    const closeBtn = document.getElementById("close-users-btn");

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
      if (isUsersOpen) {
        closeUsers();
      } else {
        openUsers();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeUsers);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
