
  // Ask the Nest backend who is currently logged in
  fetch("https://absolute-cinema-manager.hackclub.app/api/me", {
    credentials: "include" // THIS IS CRITICAL to send the login cookie!
  })
  .then(response => {
    if (!response.ok) {
      // If they aren't logged in, kick them back to the home page
      window.location.href = "/";
      throw new Error("Not logged in");
    }
    return response.json();
  })
  .then(userData => {
    // Boom! You now have their Hack Club data. 
    console.log("Logged in as:", userData.name);
    console.log("Email:", userData.email);
    console.log("YSWS Eligible:", userData.eligible);
    
    // You can use JavaScript here to change the HTML and welcome them!
    // document.getElementById("welcome-text").innerText = `Welcome, ${userData.name}!`;
  })
  .catch(error => console.error("Auth error:", error));
