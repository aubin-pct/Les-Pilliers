import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { TESTS } from "@/content/corps";
import { doneToday, streak, totalHeight, weekDelta } from "@/engine/core";
import { localReport, weekData } from "@/engine/insights";
import { weeklyReport } from "@/ai/contremaitre";
import { DAY, f0, f1, fdate, fdateK, keyToTs, pad, startOfDay } from "@/lib/format";
import { exportBackup } from "@/lib/backup";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Fold, Thinking, useNow } from "@/ui/kit";
import { CoachHead } from "@/features/coach/CoachHead";
import { TempleSvg } from "./TempleSvg";
import { Dossier, ExcuseBars, HistChart } from "./Charts";
import { AccountSheet } from "./AccountSheet";
import { MemoryCard } from "./Memory";
import { profileGaps } from "@/content/profile";

export function TempleView() {
  const c = useChantier()!;
  const demo = useIsDemo();
  const settings = useSettings();
  const quitDemo = useStore((s) => s.quitDemo);
  const act = useStore((s) => s.act);
  const now = useNow(30_000);
  const nav = useNavigate();
  const [account, setAccount] = useState(false);
  const [reporting, setReporting] = useState(false);
  const monthEx = c.excuses.filter((e) => e.ts > now - 30 * DAY).length;
  const rest = startOfDay(now) + DAY - now;
  const reportFresh = c.report && now - c.report.ts < 7 * DAY;
  const backupDue = !demo && !settings.syncUrl && now - c.created > 7 * DAY && (!settings.lastBackup || now - keyToTs(settings.lastBackup) > 14 * DAY);

  const zero = [
    { ok: aiEnabled(settings), t: "Clé DeepSeek", to: "/reglages" },
    { ok: profileGaps(c.profile).length === 0, t: "Profil complet", to: "/profil" },
    { ok: TESTS.every((T) => c.tests.some((t) => t.kind === T.id)), t: "4 tests étalons", to: "/corps" },
    { ok: c.capital.thesis !== null, t: "Piste Capital", to: "/capital" },
    { ok: c.esprit.length > 0, t: "1er sujet", to: "/esprit" },
    { ok: c.orals.length > 0, t: "1er oral", to: "/verbe" },
  ];

  const runReport = async () => {
    if (!aiEnabled(settings) || demo) { toast(demo ? "En démo, le rapport est calculé par les règles." : "Sans clé, le rapport est calculé par les règles."); return; }
    setReporting(true);
    const txt = await weeklyReport(weekData(c, Date.now()));
    setReporting(false);
    if (txt) act((d) => { d.report = { ts: Date.now(), text: txt }; });
  };

  return (
    <div className="view">
      {demo && (
        <div className="band row-band">
          <span className="pill demo">Démo</span><span className="small">Données simulées. Rien n'est enregistré.</span>
          <button className="btn small" type="button" onClick={quitDemo}>Quitter</button>
        </div>
      )}

      <CoachHead scope="temple" />

      {c.pending.length > 0 && (
        <button type="button" className="alert-row" onClick={() => setAccount(true)}>
          <b className="num">{c.pending.length}</b><span>{c.pending.length > 1 ? "comptes" : "compte"} à rendre · gains ÷ 2</span><span className="go">Rendre ›</span>
        </button>
      )}

      <div className="temple">
        <TempleSvg c={c} now={now} onPick={(id) => nav("/" + id)} />
        <div className="plabels">
          {PILLAR_IDS.map((id) => {
            const P = PILLAR[id], wd = weekDelta(c, id), d = doneToday(c, id, now);
            return (
              <button type="button" className={"plabel" + (d ? " done" : "")} key={id} onClick={() => nav("/" + id)}>
                <span className="n" style={{ color: P.color }}>{P.name}</span>
                <span className="v num">{f1(c.p[id].s)}</span>
                <span className={"d num " + (wd === null ? "muted" : wd >= 0 ? "up" : "down")}>{wd === null ? "—" : `${wd >= 0 ? "▲" : "▼"}${f1(Math.abs(wd))}`}</span>
                <span className={"fl " + (d ? "ok" : "ko")}>{d ? "posé" : "nu"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="k num">{f0(totalHeight(c))}</span><span className="l">assises</span></div>
        <div className="stat"><span className="k num">{streak(c, now)}</span><span className="l">jours complets</span></div>
        <div className="stat"><span className="k num">{Math.floor(rest / 3600e3)}:{pad(Math.floor((rest % 3600e3) / 60e3))}</span><span className="l">avant minuit</span></div>
        <div className="stat"><span className="k num" style={{ color: monthEx ? "var(--blood)" : undefined }}>{monthEx}</span><span className="l">excuses 30 j</span></div>
      </div>

      {!demo && zero.some((z) => !z.ok) && (
        <div className="zero">
          {zero.map((z) => <button key={z.t} type="button" className={z.ok ? "ok" : ""} onClick={() => nav(z.to)}><span className="box">{z.ok ? "✓" : ""}</span>{z.t}</button>)}
        </div>
      )}

      {backupDue && (
        <button type="button" className="alert-row soft" onClick={() => void exportBackup()}>
          <span>Pas de sauvegarde depuis {settings.lastBackup ? fdateK(settings.lastBackup) : "le début"}</span><span className="go">Exporter ›</span>
        </button>
      )}

      <Fold title="Courbe" aside={`${c.hist.length} j`} open><HistChart c={c} now={now} /></Fold>
      <Fold title="Ce qu'il sait de toi" aside={`${Object.keys(c.memoire).length}/4`}><MemoryCard c={c} /></Fold>
      <Fold title="Rapport de la semaine" aside={reportFresh ? fdate(c.report!.ts) : "7 j"}>
        {reporting ? <Thinking>Il relit ta semaine</Thinking> : <div className="voice">{reportFresh ? c.report!.text : localReport(c, now)}</div>}
        <div><button className="btn small" type="button" disabled={reporting} onClick={runReport}>Le faire parler</button></div>
      </Fold>
      <Fold title="Avant → maintenant"><Dossier c={c} /></Fold>
      <Fold title="Excuses" aside={c.excuses.length}>
        <ExcuseBars c={c} now={now} />
        <div className="list">
          {c.excuses.slice(-6).reverse().map((e) => (
            <div className="li" key={e.ts + e.pillar}>
              <span className="main">« {e.text} »</span><span className={"side " + (e.ok ? "up" : "down")}>{e.ok ? "reçue" : "rejetée"}</span>
              <span className="sub">{PILLAR[e.pillar].name} · {fdateK(e.date)}</span>
            </div>
          ))}
        </div>
      </Fold>
      <Fold title="Victoires" aside={c.wins.length}>
        <div className="list">
          {c.wins.length ? c.wins.slice(-8).reverse().map((w) => <div className="li" key={w.ts + w.text}><span className="main">{w.text}</span><span className="side muted">{fdate(w.ts)}</span></div>) : <p className="muted">Rien encore.</p>}
        </div>
      </Fold>

      <div className="foot"><span>Les Piliers · v{__APP_VERSION__}</span></div>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
