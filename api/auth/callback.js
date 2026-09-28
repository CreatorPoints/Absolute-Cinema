export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing OAuth code.");
  }

  // Exchange OAuth code for access token
  const tokenResponse = await fetch(
    "https://auth.hackclub.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.HACKCLUB_CLIENT_ID,
        client_secret: process.env.HACKCLUB_CLIENT_SECRET,
        redirect_uri: process.env.HACKCLUB_REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }),
    }
  );

  const token = await tokenResponse.json();

  if (!token.access_token) {
    console.error(token);
    return res.status(400).send("OAuth authentication failed.");
  }

  // Get Hack Club user information
  const meResponse = await fetch(
    "https://auth.hackclub.com/api/v1/me",
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    }
  );

  const me = await meResponse.json();
  const slackId = me.identity?.slack_id;

  if (!slackId) {
    return res
      .status(400)
      .send("Your Hack Club account doesn't have a Slack ID.");
  }

  // Invite them to the Absolute Cinema channel
  const slackResponse = await fetch(
    "https://slack.com/api/conversations.invite",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ID,
        users: slackId,
      }),
    }
  );

  const slackResult = await slackResponse.json();

  if (!slackResult.ok) {
    console.error(slackResult);
    return res.status(500).send(
      `Slack invitation failed: ${slackResult.error}`
    );
  }

  // Done 🎬
  res.redirect("/success.html");
}