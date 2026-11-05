import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MISS_PENALTY, PILLARS } from "@/content/pillars";
import { POINTS } from "@/engine/scoring";
import { testKey } from "@/ai/contremaitre";
import { AIError } from "@/ai/client";
import { exportBackup, readBackup, type Backup } from "@/lib/backup";
import { clearMedia } from "@/lib/media";
import { f0, f1, fdate, fdateK } from "@/lib/format";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Card, Foreman, Sheet, Thinking } from "@/ui/kit";
import { HoldButton } from "@/ui/HoldButton";

export function ReglagesView() {
  const settings = useSettings();
  const setSettings = useStore((s) => s.setSettings);
  const c = useChantier();
  const demo = useIsDemo();
  const real = useStore((s) => s.chantier);
  const { startDemo, quitDemo, wipe, replace, recording } = useStore();
  const nav = useNavigate();
  const [key, setKey] = useState(settings.apiKey);
  const [base, setBase] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [deep, setDeep] = useState(settings.deep);
  const [test, setTest] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });
  const [usage, setUsage] = useState("");
  const [restore, setRestore] = useState<Backup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { navigator.storage?.estimate?.().then((e) => setUsage(`Espace utilisé : ${f1((e.usage ?? 0) / 1048576)} Mo`)).catch(() => undefined); }, []);

  const saveForm = () => setSettings({ apiKey: key.trim(), baseUrl: base.trim() || "https://api.deepseek.com", model: model.trim() || "deepseek-flash", deep });
  const runTest = async () => {
    saveForm(); setTest({ busy: true });
    try { setTest({ busy: false, ok: await testKey() }); }
    catch (e) { setTest({ busy: false, err: e instanceof AIError ? e.message : "Échec inattendu." }); }
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    try { setRestore(await readBackup(f)); } catch (e) { toast((e as Error).message); }
  };

  return (
    <div className="view">
      <div className="phead"><span className="rom" aria-hidden="true">Ø</span><div className="t"><span className="eyebrow">Réglages</span><h1>Atelier</h1></div><div /></div>
      {demo && <div className="band"><p>Tu es en démo. Les réglages de l'IA s'appliquent à ton vrai chantier.</p></div>}

      {c && (
        <Card title="Profil" aside={c.profile?.updated ? `mis à jour le ${fdate(c.profile.updated)}` : "à remplir"}>
          <p className="muted small">Objectifs, niveau, matériel, compétences, domaines : tout ce que le Contremaître sait de toi et dont il se sert pour construire tes séances, tes missions et tes sujets.</p>
          <div><button className="btn" type="button" onClick={() => nav("/profil")}>Modifier mon profil</button></div>
        </Card>
      )}

      <Card title="Contremaître IA" aside={<span className={"pill " + (aiEnabled(settings) ? "on" : "")}>{aiEnabled(settings) ? "Branché" : "Débranché"}</span>}>
        <label className="f" htmlFor="s-key">Clé API DeepSeek
          <input type="password" id="s-key" autoComplete="off" spellCheck={false} placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <p className="muted small">À créer sur platform.deepseek.com. Elle reste sur ce téléphone et n'est jamais exportée.</p>
        <div className="grid2">
          <label className="f" htmlFor="s-base">Adresse de l'API<input type="url" id="s-base" spellCheck={false} value={base} onChange={(e) => setBase(e.target.value)} /></label>
          <label className="f" htmlFor="s-model">Modèle<input type="text" id="s-model" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} /></label>
        </div>
        <label className="check" htmlFor="s-deep"><input type="checkbox" id="s-deep" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Examens et rapport approfondis (plus lents, plus chers)</label>
        <div className="btn-row">
          <button className="btn primary" type="button" onClick={() => { saveForm(); toast("Réglages enregistrés."); }}>Enregistrer</button>
          <button className="btn" type="button" disabled={test.busy} onClick={() => void runTest()}>Tester la clé</button>
        </div>
        {test.busy && <Thinking>Appel du Contremaître</Thinking>}
        {test.ok && <Foreman who="Branché" tone="good"><p className="voice">{test.ok}</p></Foreman>}
        {test.err && <p className="down small">{test.err}</p>}
      </Card>

      <Card title="Tribune">
        <div className="seg" role="group" aria-label="Mode de la Tribune">
          {(["micro", "clavier"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={settings.oralMode === m} disabled={recording} onClick={() => setSettings({ oralMode: m })}>{m === "micro" ? "Micro" : "Clavier"}</button>
          ))}
        </div>
        <p className="muted small">Micro : ta voix est enregistrée, les blancs mesurés, la transcription se fait en direct quand le navigateur le permet. Clavier : tu dictes avec le micro du clavier, sans enregistrement.</p>
      </Card>

      {real && !demo && (
        <Card title="Sauvegarde" aside={settings.lastBackup ? `dernière : ${fdateK(settings.lastBackup)}` : "jamais"}>
          <p className="muted small">Tout vit sur ce téléphone. Exporte régulièrement ton chantier dans Fichiers ou ton Drive. Les enregistrements audio et les photos de preuve ne sont pas inclus.</p>
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => void exportBackup()}>Exporter</button>
            <button className="btn ghost" type="button" onClick={() => fileRef.current?.click()}>Restaurer</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {usage && <p className="mono muted small">{usage}</p>}
        </Card>
      )}

      <Card title="Les règles">
        <div className="list">
          {PILLARS.map((P) => <div className="li" key={P.id}><span className="main"><b>{P.name}</b> · plancher : {P.floor}</span><span className="side down">−{f1(P.rate * 100)} %/j</span></div>)}
          <div className="li"><span className="main">Pilier nu à minuit</span><span className="side down">−{MISS_PENALTY * 100} % + compte à rendre</span></div>
          <div className="li"><span className="main">Comptes à rendre en attente</span><span className="side down">gains ÷ 2</span></div>
          <div className="li"><span className="main">Égaler ou rater son record</span><span className="side down">{POINTS.equalRecord} assises</span></div>
          <div className="li"><span className="main">Révision ratée</span><span className="side down">{POINTS.reviewKo} assises</span></div>
          <div className="li"><span className="main">Changer de sujet à la Tribune</span><span className="side down">{POINTS.skipSubject} assise</span></div>
          <div className="li"><span className="main">Mise non tenue</span><span className="side down">−{POINTS.stakePenalty * 100} % Capital</span></div>
        </div>
      </Card>

      <Card title="Zone rouge">
        <div className="btn-row">
          {demo ? <button className="btn" type="button" onClick={() => { quitDemo(); nav("/"); }}>Quitter la démo</button>
            : <button className="btn" type="button" onClick={() => { startDemo(); nav("/"); }}>Voir la démo</button>}
          {real && !demo && (
            <HoldButton tone="danger" ms={2000} label="Tout effacer" hint="Destruction" onConfirm={async () => { wipe(); await clearMedia().catch(() => undefined); nav("/"); toast("Chantier rasé."); }} />
          )}
        </div>
        {real && !demo && <p className="muted small">« Tout effacer » : maintiens deux secondes. Chantier, oraux, photos : tout disparaît de ce téléphone. Exporte d'abord si tu veux garder une trace.</p>}
      </Card>

      {!c && <button className="btn primary block" type="button" onClick={() => nav("/")}>Retour au contrat</button>}
      <div className="foot"><span>Les Piliers · v{__APP_VERSION__}</span></div>

      <Sheet open={!!restore} onClose={() => setRestore(null)} label="Restaurer">
        {restore && (
          <>
            <span className="eyebrow">Restaurer</span>
            <h2 className="h-display" style={{ fontSize: 30 }}>Remplacer ton chantier ?</h2>
            <p className="muted">Sauvegarde du {fdate(restore.exported)} : {restore.state.orals.length} oraux, {restore.state.esprit.length} sujets, {f0(restore.state.euros)} € gagnés. Ton chantier actuel sera remplacé. Ta clé API reste en place.</p>
            <div className="btn-row">
              <button className="btn danger" type="button" onClick={() => {
                replace(restore.state);
                if (restore.settings) setSettings({ ...restore.settings });
                useStore.getState().tick();
                setRestore(null); nav("/"); toast("Chantier restauré.");
              }}>Remplacer</button>
              <button className="btn ghost" type="button" onClick={() => setRestore(null)}>Annuler</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
