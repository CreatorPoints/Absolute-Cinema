fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
  credentials: "include",
  cache: "no-store" 
})
.then(response => {
  // Check if the user is currently on the dashboard page
  const isDashboard = window.location.pathname.includes("dashboard");

  if (!response.ok) {
    // If they are NOT logged in, AND trying to sneak into the dashboard, kick them to home
    if (isDashboard) {
      window.location.replace("/"); 
    }
    throw new Error("No active session.");
  }
  return response.json();
})
.then(userData => {
  console.log("Welcome back:", userData.name);
  
  const isDashboard = window.location.pathname.includes("dashboard");
  
  // If they ARE logged in, but just sitting on the home page, fast-track them to the dashboard!
  if (!isDashboard) {
    window.location.replace("/dashboard.html");
  } else {
    
    console.log("Welcome to Cinema Hall!");
    
    // Pro-tip: You can update your HTML here using their data!
    document.getElementById("username").innerText = userData.name;
  }
})
.catch(error => console.log("Auth status:", error.message));