// npm install express   (needs Node 18+)
// Env vars: HC_CLIENT_ID, HC_CLIENT_SECRET, HC_REDIRECT_URI,
//           SLACK_BOT_TOKEN, SLACK_CHANNEL_ID
const express = require("express");
const crypto = require("crypto");

const app = express();
const {
  HC_CLIENT_ID,
  HC_CLIENT_SECRET,
  HC_REDIRECT_URI, // e.g. https://yoursite.com/callback
  SLACK_BOT_TOKEN,
  SLACK_CHANNEL_ID,
} = process.env;

// serve your existing site (index.html, style.css, assets/)
app.use(express.static("public"));

function getCookie(req, name) {
  const match = (req.headers.cookie || "").match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

// 1. "Lets GO!" button links here
app.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);

  const url = new URL("https://auth.hackclub.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: HC_CLIENT_ID,
    redirect_uri: HC_REDIRECT_URI,
    response_type: "code",
    scope: "openid email name slack_id",
    state,
  });
  res.redirect(url.toString());
});

// 2. Hack Club Auth sends the user back here
app.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== getCookie(req, "oauth_state")) {
      return res.status(400).send("Invalid login attempt. Please try again.");
    }

    // exchange code for token
    const tokenRes = await fetch("https://auth.hackclub.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: HC_CLIENT_ID,
        client_secret: HC_CLIENT_SECRET,
        redirect_uri: HC_REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) return res.status(400).send("Token exchange failed.");

    // get the user's identity
    const meRes = await fetch("https://auth.hackclub.com/api/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json();
    const slackId = me.identity?.slack_id || me.slack_id;

    if (!slackId) {
      return res.redirect("/?error=no_slack");
    }

    // 3. invite them to the Slack channel
    const slackRes = await fetch("https://slack.com/api/conversations.invite", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, users: slackId }),
    });
    const slack = await slackRes.json();

    if (!slack.ok && slack.error !== "already_in_channel") {
      console.error("Slack error:", slack.error);
      return res.redirect("/?error=slack_failed");
    }

    res.redirect("/?joined=1");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong.");
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Running"));
