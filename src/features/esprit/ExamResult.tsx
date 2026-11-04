import { Foreman } from "@/ui/kit";

export interface ExamView { note: number; ai: boolean; lines: [string, string | undefined][] }

/** Verdict d'un examen (Esprit, concept du Capital). Sans IA, seule la longueur est jugée et la note plafonne à 6. */
export function ExamResult({ exam, onContinue }: { exam: ExamView; onContinue: () => void }) {
  return (
    <>
      <Foreman who={exam.ai ? "L'Examinateur" : "Notation automatique (sans IA, plafonnée à 6)"} tone={exam.note >= 6 ? "good" : "bad"} say={`${exam.note}/10`} sayStyle={{ fontSize: 40 }}>
        {exam.ai
          ? exam.lines.filter(([, v]) => v).map(([k, v]) => <p className="voice" key={k}><b>{k} :</b> {v}</p>)
          : <p className="muted">Sans IA, seule la longueur est jugée. Branche le Contremaître pour une vraie correction.</p>}
      </Foreman>
      <button className="btn block" type="button" onClick={onContinue}>Continuer</button>
    </>
  );
}
