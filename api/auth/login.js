export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.HACKCLUB_CLIENT_ID,
    redirect_uri: process.env.HACKCLUB_REDIRECT_URI,
    response_type: "code",
    scope: "openid profile slack_id",
  });

  res.redirect(
    `https://auth.hackclub.com/oauth/authorize?${params.toString()}`
  );
}