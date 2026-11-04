import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { TESTS } from "@/content/corps";
import { doneToday, streak, totalHeight, weekDelta } from "@/engine/core";
import { foremanLine, localReport, pendingTitle, weekData } from "@/engine/insights";
import { weeklyReport } from "@/ai/contremaitre";
import { DAY, f0, f1, fdate, fdateK, keyToTs, pad, plural, startOfDay } from "@/lib/format";
import { exportBackup } from "@/lib/backup";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Card, Foreman, Thinking, useNow } from "@/ui/kit";
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
  const fl = foremanLine(c, now);
  const monthEx = c.excuses.filter((e) => e.ts > now - 30 * DAY).length;
  const rest = startOfDay(now) + DAY - now;
  const doneN = PILLAR_IDS.filter((id) => doneToday(c, id, now)).length;
  const reportFresh = c.report && now - c.report.ts < 7 * DAY;
  const backupDue = !demo && now - c.created > 7 * DAY && (!settings.lastBackup || now - keyToTs(settings.lastBackup) > 14 * DAY);

  const zero = [
    { ok: TESTS.every((T) => c.tests.some((t) => t.kind === T.id)), t: "Passer les quatre tests étalons", to: "/corps" },
    { ok: c.orals.length > 0, t: "Premier oral de 90 secondes", to: "/verbe" },
    { ok: c.esprit.length > 0, t: "Première explication à l'Examinateur", to: "/esprit" },
    { ok: c.missionLog.length > 0 || c.missions.length > 0, t: "Première action de mission", to: "/capital" },
    { ok: aiEnabled(settings), t: "Brancher le Contremaître IA (clé DeepSeek)", to: "/reglages" },
    { ok: profileGaps(c.profile).length === 0, t: "Compléter ton profil (" + (profileGaps(c.profile).join(", ") || "ok") + ")", to: "/profil" },
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
        <div className="band">
          <div><span className="pill demo">Démo</span></div>
          <p>Ces données sont <b>simulées</b> : 47 jours d'un utilisateur fictif. Rien de ce que tu fais ici n'est enregistré.</p>
          <div className="btn-row"><button className="btn primary small" type="button" onClick={quitDemo}>Quitter la démo</button></div>
        </div>
      )}

      <Foreman say={fl.say} sub={fl.sub} />

      {c.pending.length > 0 && (
        <div className="alert">
          <span className="eyebrow">{plural(c.pending.length, "Compte")} à rendre · {c.pending.length}</span>
          <strong>{pendingTitle(c, now)}</strong>
          <p className="muted">Gains divisés par deux tant que tu ne t'es pas expliqué.</p>
          <div><button className="btn danger" type="button" onClick={() => setAccount(true)}>Rendre des comptes</button></div>
        </div>
      )}

      <div className="temple">
        <TempleSvg c={c} now={now} />
        <div className="plabels">
          {PILLAR_IDS.map((id) => {
            const P = PILLAR[id], wd = weekDelta(c, id);
            return (
              <div className="plabel" key={id}>
                <span className="n" style={{ color: P.color }}>{P.name}</span>
                <span className="v num">{f1(c.p[id].s)}</span>
                <span className={"d num " + (wd === null ? "muted" : wd >= 0 ? "up" : "down")}>{wd === null ? "—" : `${wd >= 0 ? "▲" : "▼"} ${f1(Math.abs(wd))} /7 j`}</span>
                <span className="d down num">−{f1(P.rate * 100)} %/j</span>
              </div>
            );
          })}
        </div>
        <p className="legend">HAUTEUR EN ASSISES · 1 TAMBOUR = 10 ASSISES · PLUS UN PILIER EST HAUT, PLUS IL S'ÉRODE</p>
      </div>

      {!demo && zero.some((z) => !z.ok) && (
        <Card title="Point zéro" aside={`${zero.filter((z) => z.ok).length}/${zero.length}`}>
          <p className="muted small">Ce que tu mesures aujourd'hui, c'est ce contre quoi tu te battras demain.</p>
          <div className="todo">
            {zero.map((z) => (
              <button key={z.t} type="button" className={z.ok ? "ok" : ""} onClick={() => nav(z.to)}>
                <span className="box">{z.ok ? "✓" : ""}</span><span className="lab">{z.t}</span><span className="mono muted">›</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {backupDue && (
        <div className="band">
          <p><b>Aucune sauvegarde depuis {settings.lastBackup ? fdateK(settings.lastBackup) : "le début"}.</b> Un téléphone perdu, et tout le chantier part avec.</p>
          <div><button className="btn small" type="button" onClick={() => void exportBackup()}>Exporter maintenant</button></div>
        </div>
      )}

      <Card title="Planchers du jour" aside={`${doneN}/4 · reste ${Math.floor(rest / 3600e3)} h ${pad(Math.floor((rest % 3600e3) / 60e3))}`}>
        <div className="floors">
          {PILLAR_IDS.map((id) => {
            const d = doneToday(c, id, now);
            return (
              <button key={id} type="button" className={"floor " + (d ? "done" : "miss")} onClick={() => nav("/" + id)}>
                <span className="r">{PILLAR[id].roman}</span><span className="s">{d ? "Posé" : "Nu"}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="stats">
        <div className="stat"><span className="k num">{f0(totalHeight(c))}</span><span className="l">assises au total</span></div>
        <div className="stat"><span className="k num">{streak(c, now)}</span><span className="l">jours complets d'affilée</span></div>
        <div className="stat"><span className="k num" style={{ color: monthEx ? "var(--blood)" : undefined }}>{monthEx}</span><span className="l">excuses en 30 jours</span></div>
      </div>

      <MemoryCard c={c} />

      <Card title="Courbe du chantier" aside={`${c.hist.length} ${plural(c.hist.length, "jour")}`}><HistChart c={c} now={now} /></Card>

      <Card title="Dossier de preuves" aside="avant → maintenant"><Dossier c={c} /></Card>

      <Card title="Rapport sans filtre" aside="7 derniers jours">
        {reporting ? <Thinking>Le Contremaître relit ta semaine</Thinking> : <div className="voice">{reportFresh ? c.report!.text : localReport(c, now)}</div>}
        {reportFresh && !reporting && <p className="mono muted" style={{ fontSize: 11 }}>Rédigé par le Contremaître IA le {fdate(c.report!.ts)}</p>}
        <div className="btn-row"><button className="btn" type="button" disabled={reporting} onClick={runReport}>Faire parler le Contremaître</button></div>
      </Card>

      <Card title="Registre des excuses" aside={c.excuses.length}>
        <ExcuseBars c={c} now={now} />
        <div className="list">
          {c.excuses.length ? c.excuses.slice(-6).reverse().map((e) => (
            <div className="li" key={e.ts + e.pillar}>
              <span className="main">« {e.text} »</span>
              <span className={"side " + (e.ok ? "up" : "down")}>{e.ok ? "recevable" : "rejetée"}</span>
              <span className="sub">{PILLAR[e.pillar].name} · {fdateK(e.date)} — {e.verdict}</span>
            </div>
          )) : <p className="muted">Vide. Que ça dure.</p>}
        </div>
      </Card>

      <Card title="Bocal à victoires" aside={c.wins.length}>
        <p className="muted small">Chaque record, chaque euro gagné seul, chaque 8/10 finit ici. Quand tu voudras lâcher, le Contremaître te le ressortira.</p>
        <div className="list">
          {c.wins.length ? c.wins.slice(-6).reverse().map((w) => (
            <div className="li" key={w.ts + w.text}><span className="main">{w.text}</span><span className="side muted">{fdate(w.ts)}</span></div>
          )) : <p className="muted">Rien encore. Va chercher la première.</p>}
        </div>
      </Card>

      <div className="foot"><span>Les Piliers · v{__APP_VERSION__}</span></div>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
