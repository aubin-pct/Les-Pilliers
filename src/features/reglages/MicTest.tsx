/* Test du micro : parle, regarde le texte nettoyé et le journal brut de la reconnaissance (à copier pour un diagnostic). */
import { useEffect, useRef, useState } from "react";
import { canDictate, hush, Recognizer } from "@/lib/voice";
import { toast } from "@/store/ui";
import { Card, Fold } from "@/ui/kit";

export function MicTest() {
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const rec = useRef<Recognizer | null>(null);
  const t0 = useRef(0);
  useEffect(() => () => rec.current?.abort(), []);
  const start = () => {
    hush(); setText(""); t0.current = Date.now();
    setLog([`appareil : ${navigator.userAgent}`, `version : ${__APP_VERSION__}`]);
    const r = new Recognizer({
      text: (f) => setText(f),
      raw: (l) => setLog((x) => [...x, `${((Date.now() - t0.current) / 1000).toFixed(1)} s · ${l}`].slice(-120)),
      end: () => setOn(false),
      fail: (e) => toast(`Reconnaissance : ${e}`, "loss"),
    });
    rec.current = r;
    if (r.start()) setOn(true);
  };
  const stop = () => { rec.current?.stop(); setOn(false); };
  if (!canDictate) return <Card title="Test du micro"><p className="muted small">Ce navigateur n'a pas de reconnaissance vocale.</p></Card>;
  return (
    <Card title="Test du micro" aside={__APP_VERSION__}>
      <div className="transcript" style={{ minHeight: 60 }}>{text || <span className="muted">{on ? "Parle…" : "Dis une phrase de 10 secondes."}</span>}</div>
      <div className="btn-row">
        <button className={"btn " + (on ? "danger" : "primary")} type="button" onClick={on ? stop : start}>{on ? "Arrêter" : "Parler"}</button>
        {log.length > 2 && <button className="btn ghost" type="button" onClick={() => { void navigator.clipboard?.writeText(log.join("\n") + "\n\nTexte final : " + text).then(() => toast("Journal copié."), () => toast("Copie impossible.")); }}>Copier le journal</button>}
      </div>
      {log.length > 2 && <Fold title="Journal brut" aside={log.length - 2}><pre className="script" style={{ maxHeight: 260, overflow: "auto", fontSize: 11.5 }}>{log.join("\n")}</pre></Fold>}
    </Card>
  );
}
