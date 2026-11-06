import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "./server.mjs";

const TOKEN = "jeton-de-test-0123456789abcdef";
let base, server, dir;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "piliers-"));
  fs.mkdirSync(path.join(dir, "static"));
  fs.writeFileSync(path.join(dir, "static", "index.html"), "<!doctype html><title>Les Piliers</title>");
  server = createServer({ token: TOKEN, dataDir: path.join(dir, "data"), staticDir: path.join(dir, "static"), origins: "https://aubin-pct.github.io", log: () => {} });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const auth = { Authorization: `Bearer ${TOKEN}` };
const put = (state, baseRev) => fetch(`${base}/api/state`, { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ baseRev, state, shared: { apiKey: "sk-x" } }) });

describe("serveur de synchronisation", () => {
  it("refuse un jeton trop court au démarrage", () => {
    expect(() => createServer({ token: "court", dataDir: dir })).toThrow(/SYNC_TOKEN/);
  });
  it("répond à /api/health sans jeton, refuse l'état sans jeton", async () => {
    expect((await (await fetch(`${base}/api/health`)).json()).app).toBe("les-piliers");
    expect((await fetch(`${base}/api/state`)).status).toBe(401);
    expect((await fetch(`${base}/api/state`, { headers: { Authorization: "Bearer mauvais-jeton-0123456789" } })).status).toBe(401);
  });
  it("enregistre un état, incrémente la révision, renvoie 409 sur une base périmée", async () => {
    const s0 = await (await fetch(`${base}/api/state`, { headers: auth })).json();
    expect(s0.rev).toBe(0);
    const r1 = await put({ v: 2, euros: 10 }, 0);
    expect((await r1.json()).rev).toBe(1);
    const r2 = await put({ v: 2, euros: 20 }, 0);
    expect(r2.status).toBe(409);
    expect((await r2.json()).state.euros).toBe(10);
    expect((await fetch(`${base}/api/state?since=1`, { headers: auth })).status).toBe(204);
    const s = await (await fetch(`${base}/api/state?since=0`, { headers: auth })).json();
    expect(s).toMatchObject({ rev: 1, state: { euros: 10 }, shared: { apiKey: "sk-x" } });
    expect(fs.readdirSync(path.join(dir, "data", "backups")).length).toBe(1);
  });
  it("refuse un état invalide", async () => {
    expect((await put({ v: 9 }, 1)).status).toBe(400);
  });
  it("stocke et rend les médias, rejette les clés dangereuses", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const w = await fetch(`${base}/api/media/audio/1730000000000`, { method: "PUT", headers: { ...auth, "Content-Type": "audio/webm" }, body });
    expect(w.status).toBe(200);
    const g = await fetch(`${base}/api/media/audio/1730000000000`, { headers: auth });
    expect(g.headers.get("content-type")).toBe("audio/webm");
    expect([...new Uint8Array(await g.arrayBuffer())]).toEqual([1, 2, 3, 4]);
    expect((await (await fetch(`${base}/api/media`, { headers: auth })).json()).audio).toEqual(["1730000000000"]);
    expect((await fetch(`${base}/api/media/audio/..%2Fstate.json`, { headers: auth })).status).toBe(404);
    expect((await fetch(`${base}/api/media/autre/x`, { headers: auth })).status).toBe(404);
  });
  it("autorise l'origine GitHub Pages (CORS) et sert l'appli", async () => {
    const o = await fetch(`${base}/api/state`, { method: "OPTIONS", headers: { Origin: "https://aubin-pct.github.io", "Access-Control-Request-Method": "PUT" } });
    expect(o.status).toBe(204);
    expect(o.headers.get("access-control-allow-origin")).toBe("https://aubin-pct.github.io");
    // Tous les en-têtes envoyés par l'appli doivent être autorisés, sinon le navigateur bloque la requête.
    const allowed = o.headers.get("access-control-allow-headers").toLowerCase();
    for (const h of ["authorization", "content-type", "x-device"]) expect(allowed).toContain(h);
    const x = await fetch(`${base}/api/health`, { headers: { Origin: "https://evil.example" } });
    expect(x.headers.get("access-control-allow-origin")).toBeNull();
    expect(await (await fetch(`${base}/corps`)).text()).toContain("Les Piliers");
    expect((await fetch(`${base}/../../etc/passwd`)).status).not.toBe(500);
  });
});
