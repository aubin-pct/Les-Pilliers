/*
 * Serveur de synchronisation des Piliers — Node 22, aucune dépendance.
 * - Sert l'appli construite (dist/) : même origine que l'API, donc pas de CORS côté Mac et téléphone.
 * - GET/PUT /api/state : le chantier, avec un numéro de révision (le client fusionne en cas de conflit, réponse 409).
 * - GET/PUT /api/media/:magasin/:clé : enregistrements audio et photos de preuve.
 * - Protégé par un jeton (SYNC_TOKEN) envoyé en « Authorization: Bearer ».
 * Données dans DATA_DIR : state.json, sauvegardes quotidiennes (14 jours), media/.
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "1.0.0";
const MAX_STATE = 25 * 1024 * 1024;
const MAX_MEDIA = 40 * 1024 * 1024;
const STORES = new Set(["audio", "proofs"]);
const KEY_RE = /^[A-Za-z0-9._-]{1,100}$/;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

export function createServer(opts = {}) {
  const TOKEN = opts.token ?? process.env.SYNC_TOKEN ?? "";
  const DATA = opts.dataDir ?? process.env.DATA_DIR ?? "/data";
  const STATIC = opts.staticDir ?? process.env.STATIC_DIR ?? "";
  const ORIGINS = (opts.origins ?? process.env.ALLOWED_ORIGINS ?? "https://aubin-pct.github.io").split(",").map((s) => s.trim()).filter(Boolean);
  const log = opts.log ?? ((...a) => console.log(new Date().toISOString(), ...a));
  if (TOKEN.length < 16) throw new Error("SYNC_TOKEN manquant ou trop court (16 caractères minimum). Génère-en un avec : openssl rand -hex 24");

  const statePath = path.join(DATA, "state.json");
  const backupDir = path.join(DATA, "backups");
  const mediaDir = path.join(DATA, "media");
  fs.mkdirSync(backupDir, { recursive: true });
  for (const s of STORES) fs.mkdirSync(path.join(mediaDir, s), { recursive: true });

  let current = { rev: 0, savedAt: 0, state: null, shared: null };
  try { current = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch { /* premier démarrage */ }
  let writing = Promise.resolve();

  const tokenBuf = Buffer.from(TOKEN);
  const authed = (req) => {
    const h = req.headers.authorization ?? "";
    const got = Buffer.from(h.startsWith("Bearer ") ? h.slice(7) : "");
    return got.length === tokenBuf.length && crypto.timingSafeEqual(got, tokenBuf);
  };

  const cors = (req, res) => {
    const o = req.headers.origin;
    if (o && (ORIGINS.includes(o) || ORIGINS.includes("*"))) {
      res.setHeader("Access-Control-Allow-Origin", o);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Max-Age", "600");
    }
  };
  const json = (res, code, body) => {
    const b = JSON.stringify(body);
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(b) });
    res.end(b);
  };
  const readBody = (req, max) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error("trop gros"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

  async function persist(next) {
    const tmp = statePath + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(next));
    await fsp.rename(tmp, statePath);
    // Une sauvegarde par jour, 14 jours gardés.
    const day = new Date().toISOString().slice(0, 10);
    const bk = path.join(backupDir, `state-${day}.json`);
    await fsp.copyFile(statePath, bk);
    const all = (await fsp.readdir(backupDir)).filter((f) => f.startsWith("state-")).sort();
    for (const f of all.slice(0, Math.max(0, all.length - 14))) await fsp.unlink(path.join(backupDir, f)).catch(() => {});
  }

  async function serveStatic(req, res, pathname) {
    if (!STATIC) { res.writeHead(404); res.end("Appli non embarquée"); return; }
    let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
    if (!rel) rel = "index.html";
    let file = path.resolve(STATIC, rel);
    if (!file.startsWith(path.resolve(STATIC))) { res.writeHead(403); res.end(); return; }
    let st = await fsp.stat(file).catch(() => null);
    if (!st || st.isDirectory()) { file = path.join(STATIC, "index.html"); st = await fsp.stat(file).catch(() => null); }
    if (!st) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(file);
    const immutable = /\/assets\//.test(file);
    const noCache = ext === ".html" || /sw\.js$|workbox-|registerSW|manifest|version\.json$/.test(file);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream", "Content-Length": st.size,
      "Cache-Control": noCache ? "no-cache" : immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    });
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    try {
      if (p.startsWith("/api/")) {
        cors(req, res);
        if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
        if (p === "/api/health") return json(res, 200, { ok: true, app: "les-piliers", version: VERSION, rev: current.rev });
        if (!authed(req)) return json(res, 401, { error: "Jeton refusé." });

        if (p === "/api/state" && req.method === "GET") {
          const since = Number(url.searchParams.get("since") ?? -1);
          if (since === current.rev) { res.writeHead(204, { "Cache-Control": "no-store" }); res.end(); return; }
          return json(res, 200, current);
        }
        if (p === "/api/state" && req.method === "PUT") {
          const body = JSON.parse((await readBody(req, MAX_STATE)).toString("utf8") || "{}");
          if (!body.state || typeof body.state !== "object" || ![1, 2].includes(body.state.v)) return json(res, 400, { error: "État invalide." });
          // Écritures en file : deux appareils qui poussent en même temps ne s'écrasent pas.
          const result = await (writing = writing.then(async () => {
            if (Number(body.baseRev) !== current.rev) return { conflict: true };
            const next = { rev: current.rev + 1, savedAt: Date.now(), state: body.state, shared: body.shared ?? current.shared ?? null };
            await persist(next);
            current = next;
            return { conflict: false };
          }));
          if (result.conflict) return json(res, 409, current);
          log(`état rev ${current.rev} (${req.headers["x-device"] ?? "?"})`);
          return json(res, 200, { rev: current.rev, savedAt: current.savedAt });
        }
        if (p === "/api/media" && req.method === "GET") {
          const out = {};
          for (const s of STORES) out[s] = (await fsp.readdir(path.join(mediaDir, s))).filter((f) => !f.endsWith(".type"));
          return json(res, 200, out);
        }
        const m = p.match(/^\/api\/media\/([a-z]+)\/([^/]+)$/);
        if (m && STORES.has(m[1]) && KEY_RE.test(decodeURIComponent(m[2]))) {
          const file = path.join(mediaDir, m[1], decodeURIComponent(m[2]));
          if (req.method === "PUT") {
            const buf = await readBody(req, MAX_MEDIA);
            await fsp.writeFile(file, buf);
            await fsp.writeFile(file + ".type", String(req.headers["content-type"] ?? "application/octet-stream"));
            return json(res, 200, { ok: true, bytes: buf.length });
          }
          if (req.method === "GET") {
            const st = await fsp.stat(file).catch(() => null);
            if (!st) return json(res, 404, { error: "Introuvable." });
            const type = await fsp.readFile(file + ".type", "utf8").catch(() => "application/octet-stream");
            res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": "private, max-age=31536000, immutable" });
            fs.createReadStream(file).pipe(res);
            return;
          }
        }
        return json(res, 404, { error: "Route inconnue." });
      }
      if (req.method === "GET" || req.method === "HEAD") return await serveStatic(req, res, p);
      res.writeHead(405); res.end();
    } catch (e) {
      log("erreur", e?.message);
      if (!res.headersSent) json(res, e?.code === 413 ? 413 : e instanceof SyntaxError ? 400 : 500, { error: e?.code === 413 ? "Trop volumineux." : "Erreur du serveur." });
      else res.destroy();
    }
  });
  return server;
}

// Lancement direct : node server.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  try {
    createServer().listen(port, "0.0.0.0", () => console.log(`Les Piliers · serveur de synchronisation sur le port ${port}`));
  } catch (e) { console.error(e.message); process.exit(1); }
}
