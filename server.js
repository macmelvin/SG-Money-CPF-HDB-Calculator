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

const server = http.createServer((req, res) => {
  if (!isAuthorized(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="SG Money", charset="UTF-8"',
      "Content-Type": "text/plain",
    });
    res.end("Authentication required.");
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
