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
const token = localStorage.getItem('cinema_session');
const isDashboard = window.location.pathname.includes("dashboard");

if (!token) {
  // If there's absolutely no token, and they are trying to peek at the dashboard, boot them.
  if (isDashboard) {
    window.location.replace("/");
  } else {
    console.log("No active session found. Waiting for user login.");
  }
} else {
  // 3. We have a token! Ask the backend who we are.
  fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}` // THE VIP PASS
    },
    cache: "no-store"
  })
  .then(response => {
    if (!response.ok) {
      // If the backend says the token is dead, delete it and kick them out
      localStorage.removeItem('cinema_session');
      if (isDashboard) {
        window.location.replace("/");
      }
      throw new Error("Session invalid or expired.");
    }
    return response.json();
  })
  .then(userData => {
    console.log("Welcome back:", userData.name);
    
    if (!isDashboard) {
      window.location.replace("/dashboard.html");
    } else {
      console.log("Safely landed on the dashboard. Absolute Cinema is online.");
      const usernameEl = document.getElementById("username-display");
      if (usernameEl) {
        usernameEl.innerText = userData.name || userData.email || "Creator";
      }
    }
  })
  .catch(error => console.error("Auth status:", error.message));
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
  window.location.replace("/");
};