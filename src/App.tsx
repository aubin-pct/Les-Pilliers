import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { PILLAR_IDS, PILLAR } from "@/content/pillars";
import { daysSinceStart, doneToday } from "@/engine/core";
import { pad } from "@/lib/format";
import { buzz, reacquireWake } from "@/lib/device";
import { Stamp } from "@/ui/motion";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Toast, useNow } from "@/ui/kit";
import { Contract } from "@/features/accueil/Contract";
import { TempleView } from "@/features/temple/TempleView";
import { CorpsView } from "@/features/corps/CorpsView";
import { CapitalView } from "@/features/capital/CapitalView";
import { EspritView } from "@/features/esprit/EspritView";
import { VerbeView } from "@/features/verbe/VerbeView";
import { ReglagesView } from "@/features/reglages/ReglagesView";
import { Onboarding } from "@/features/profil/Onboarding";
import { ProfilView } from "@/features/profil/ProfilView";

/** Érosion vivante : un tic toutes les 30 s et au retour sur l'appli. */
function useEngineClock() {
  const tick = useStore((s) => s.tick);
  useEffect(() => {
    tick();
    const t = setInterval(tick, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") { tick(); reacquireWake(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [tick]);
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

function Header() {
  const c = useChantier();
  const demo = useIsDemo();
  const settings = useSettings();
  const online = useOnline();
  const now = useNow(30_000);
  const loc = useLocation();
  const d = new Date(now);
  const pill = demo ? { t: "Démo", k: "demo" } : !online ? { t: "Hors ligne", k: "" } : aiEnabled(settings) ? { t: "IA", k: "on" } : { t: "Sans IA", k: "" };
  const atSettings = loc.pathname === "/reglages";
  return (
    <header className="top">
      <div className="wrap">
        <div className="mark">Les Piliers<small>{demo ? "DÉMO · RIEN N'EST ENREGISTRÉ" : "LE CHANTIER D'UNE VIE"}</small></div>
        <div className="top-right">
          <span className={"pill " + pill.k}>{pill.t}</span>
          <div>
            <div className="jday num">{c ? `J+${daysSinceStart(c, now)}` : "J0"}</div>
            <div className="num">{pad(d.getHours())}:{pad(d.getMinutes())}</div>
          </div>
          <Link className="gear" to={atSettings ? "/" : "/reglages"} aria-label="Réglages" aria-current={atSettings ? "page" : undefined}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

const TempleGlyph = () => (
  <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><rect x="1" y="15" width="20" height="3" fill="currentColor" /><rect x="0" y="0" width="22" height="3" fill="currentColor" /><rect x="2.5" y="4" width="3" height="10" fill="currentColor" /><rect x="7.2" y="4" width="3" height="10" fill="currentColor" /><rect x="11.8" y="4" width="3" height="10" fill="currentColor" /><rect x="16.5" y="4" width="3" height="10" fill="currentColor" /></svg>
);

function TabBar() {
  const c = useChantier()!;
  const recording = useStore((s) => s.recording);
  const now = useNow(30_000);
  const top = Math.max(60, ...PILLAR_IDS.map((id) => c.p[id].s)) * 1.05;
  const tabs = [
    { to: "/", label: "Temple", glyph: <TempleGlyph />, dot: c.pending.length > 0, color: "var(--brass)", fill: null as number | null },
    ...PILLAR_IDS.map((id) => ({ to: "/" + id, label: PILLAR[id].name, glyph: PILLAR[id].roman, dot: !doneToday(c, id, now), color: PILLAR[id].color, fill: c.p[id].s / top })),
  ];
  return (
    <nav className="tabs" aria-label="Chantiers">
      <div className="row">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end className="tab" aria-disabled={recording || undefined} style={{ ["--tc" as string]: t.color }} aria-label={t.label + (t.dot ? (t.to === "/" ? ", comptes à rendre" : ", plancher nu") : "")}
            onClick={(e) => { if (recording) { e.preventDefault(); toast("Termine ta prise de parole d'abord."); } else buzz(8); }}>
            <span className="glyph">
              {t.fill !== null && <span className="gauge" aria-hidden="true"><span style={{ height: `${Math.max(6, Math.min(100, t.fill * 100))}%` }} /></span>}
              {t.glyph}
            </span>
            <span className="lbl">{t.label}</span>{t.dot && <span className="dot" aria-hidden="true" />}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Couleur d'accent de la page : celle du pilier ouvert. */
function useAccent() {
  const { pathname } = useLocation();
  useEffect(() => {
    const id = pathname.slice(1);
    document.documentElement.dataset.pillar = (PILLAR_IDS as string[]).includes(id) ? id : "temple";
  }, [pathname]);
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  useEngineClock();
  useAccent();
  const c = useChantier();
  const demo = useIsDemo();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { if (!c && loc.pathname !== "/reglages" && loc.pathname !== "/") nav("/", { replace: true }); }, [c, loc.pathname, nav]);
  // Profil absent ou accueil inachevé : on passe d'abord par l'accueil (sauf réglages).
  const onboarding = !!c && !demo && (!c.profile || c.profile.updated === 0) && loc.pathname !== "/reglages";
  if (onboarding) {
    return (
      <>
        <Header />
        <main style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}><div className="wrap"><Onboarding /></div></main>
        <Toast />
      </>
    );
  }
  return (
    <>
      <Header />
      <ScrollTop />
      <main style={c ? undefined : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}>
        <div className="wrap">
          <div className="route" key={loc.pathname}>
          <Routes location={loc}>
            <Route path="/reglages" element={<ReglagesView />} />
            {c ? (
              <>
                <Route path="/" element={<TempleView />} />
                <Route path="/corps" element={<CorpsView />} />
                <Route path="/capital" element={<CapitalView />} />
                <Route path="/esprit" element={<EspritView />} />
                <Route path="/verbe" element={<VerbeView />} />
                <Route path="/profil" element={<ProfilView />} />
              </>
            ) : (
              <Route path="/" element={<Contract />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </div>
      </main>
      {c && <TabBar />}
      <Toast />
      <Stamp />
    </>
  );
}
