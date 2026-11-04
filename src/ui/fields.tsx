/* Champs de formulaire partagés (profil, ajustements). */
import { useState, type ReactNode } from "react";

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <label className="f" htmlFor={id}>
      {label}
      {children}
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
    </label>
  );
}

export function TextField({ id, label, value, onChange, placeholder, hint, area }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; area?: boolean }) {
  return (
    <Field label={label} hint={hint} id={id}>
      {area
        ? <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 84 }} />
        : <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </Field>
  );
}

export function NumField({ id, label, value, onChange, min, max, suffix, hint }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; suffix?: string; hint?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint} id={id}>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} value={value ?? ""}
        onChange={(e) => { const v = e.target.value.replace(",", "."); onChange(v === "" ? null : Number(v)); }} />
    </Field>
  );
}

/** Choix unique parmi quelques options. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: { label?: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label && <span className="muted" style={{ fontSize: 13 }}>{label}</span>}
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => <button key={String(o.id)} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
      </div>
    </div>
  );
}

/** Choix multiple en pastilles, avec ajout libre. */
export function Chips({ label, options, value, onChange, allowCustom, hint }: { label?: string; options: string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean; hint?: string }) {
  const [custom, setCustom] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const add = () => { const t = custom.trim(); if (t && !value.includes(t)) onChange([...value, t]); setCustom(""); };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {label && <span className="muted" style={{ fontSize: 13 }}>{label}</span>}
      <div className="chips">
        {all.map((o) => <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => toggle(o)}>{o}</button>)}
      </div>
      {allowCustom && (
        <div className="chip-add">
          <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ajouter…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button className="btn small" type="button" onClick={add}>Ajouter</button>
        </div>
      )}
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
    </div>
  );
}
