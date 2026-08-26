// Production server for the built static site (dist/). Same static-file serving
// `serve` used to do (via serve-handler, the library `serve` itself is built on,
// including the Cache-Control rules from public/serve.json), plus an optional
// HTTP Basic Auth gate in front of everything.
//
// The gate is OFF by default — if ACCESS_GATE_CREDENTIALS isn't set in the
// environment, every request is served with no login prompt, same as before.
// Set it in Railway's service Variables (never commit real credentials to git)
// as a comma-separated "user:pass,user:pass,..." list to turn it on. Each
// approved person gets their own username/password; browsers show their native
// login popup and remember it for the session.
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
const serveConfig = JSON.parse(readFileSync(join(distDir, "serve.json"), "utf8"));

function parseCredentials(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return null;
      return { user: pair.slice(0, idx), pass: pair.slice(idx + 1) };
    })
    .filter(Boolean);
}

const credentials = parseCredentials(process.env.ACCESS_GATE_CREDENTIALS);

// Hash both sides to a fixed-length digest before comparing, so two secrets of
// different lengths can still be compared in constant time (a plain
// timingSafeEqual throws on mismatched buffer lengths, and comparing raw
// strings byte-by-byte would leak how many leading characters matched).
function safeEqual(a, b) {
  const ah = createHash("sha256").update(String(a)).digest();
  const bh = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ah, bh);
}

function isAuthorized(req) {
  if (credentials.length === 0) return true; // gate disabled — nothing configured
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return credentials.some((c) => safeEqual(c.user, user) && safeEqual(c.pass, pass));
}

// Shown when someone hits the login wall and either cancels the browser's native Basic Auth
// popup, or fails to authenticate — browsers won't render this until then (the native prompt
// takes over first), so this is specifically for a visitor who doesn't have a login yet and
// wants to ask for one, not a replacement for the popup itself.
const ACCESS_REQUEST_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SG Money — Private access</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #faf7f4;
    color: #2a2622;
    padding: 24px;
    box-sizing: border-box;
  }
  .card {
    max-width: 420px;
    width: 100%;
    background: #fff;
    border: 1px solid #eae5df;
    border-radius: 16px;
    padding: 32px 28px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .lock { font-size: 40px; margin-bottom: 8px; }
  h1 { font-size: 19px; margin: 0 0 10px; }
  p { font-size: 14px; line-height: 1.5; color: #6b6259; margin: 0 0 22px; }
  a.whatsapp {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #25D366;
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    padding: 12px 22px;
    border-radius: 999px;
  }
  a.whatsapp:hover { opacity: 0.92; }
  @media (prefers-color-scheme: dark) {
    body { background: #1c1a18; color: #eee8e2; }
    .card { background: #26221f; border-color: #3a352f; }
    p { color: #b8afa5; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="lock">🔒</div>
    <h1>This is a private tool</h1>
    <p>SG Money is a personal finance calculator with restricted access. If you'd like to use it, message me and I'll set you up with a login.</p>
    <a class="whatsapp" href="https://wa.me/6588877041" target="_blank" rel="noopener noreferrer">💬 Message me on WhatsApp</a>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (!isAuthorized(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="SG Money", charset="UTF-8"',
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(ACCESS_REQUEST_HTML);
    return;
  }
  handler(req, res, { public: distDir, headers: serveConfig.headers });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(
    `SG Money serving on port ${port}${
      credentials.length ? ` (access gate ON — ${credentials.length} account(s))` : " (access gate OFF)"
    }`
  );
});
