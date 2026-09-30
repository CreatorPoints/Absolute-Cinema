// authfetch.js
fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
  credentials: "include"
})
.then(response => {
  // Check if they are on the root homepage or index.html
  const isHomePage = window.location.pathname === "/" || window.location.pathname.endsWith("index.html");

  if (!response.ok) {
    // Only kick them back to the homepage if they are on the dashboard
    if (!isHomePage) {
      window.location.href = "/";
    }
    throw new Error("No active session found.");
  }
  
  return response.json();
})
.then(userData => {
  console.log("Welcome back:", userData.name);
  
  const isHomePage = window.location.pathname === "/" || window.location.pathname.endsWith("index.html");
  
  // If they ARE logged in but just sitting on the homepage, fast-track them to the dashboard 🏎️
  if (isHomePage) {
    window.location.href = "/dashboard.html";
  } else {
    // If they are already on the dashboard, you can update the UI here!
    // document.getElementById("username").innerText = userData.name;
  }
})
.catch(error => console.log("Auth status:", error.message));