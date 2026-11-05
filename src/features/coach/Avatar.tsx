/*
 * Le visage du Contremaître : un masque de pierre taillée, deux fentes de regard dans la couleur du pilier,
 * une bouche en barres de son qui s'anime quand il parle. États : repos (respire), réflexion (le regard balaie),
 * parole (la bouche bat), écoute (le halo pulse).
 */
export type AvatarState = "idle" | "think" | "talk" | "listen";

export function Avatar({ state = "idle", size = 56 }: { state?: AvatarState; size?: number }) {
  return (
    <svg className="av" data-state={state} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="av-stone" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3a3f46" /><stop offset=".55" stopColor="#202428" /><stop offset="1" stopColor="#121417" />
        </linearGradient>
        <radialGradient id="av-halo"><stop offset="0" style={{ stopColor: "var(--acc)" }} stopOpacity=".55" /><stop offset="1" style={{ stopColor: "var(--acc)" }} stopOpacity="0" /></radialGradient>
      </defs>
      <circle className="av-halo" cx="32" cy="32" r="31" fill="url(#av-halo)" />
      <path className="av-head" d="M32 4 L53 12 L58 31 L50 53 L32 61 L14 53 L6 31 L11 12 Z" fill="url(#av-stone)" />
      <path d="M32 4 L32 61 M11 12 L24 26 M53 12 L40 26 M6 31 L20 33 M58 31 L44 33 M14 53 L24 44 M50 53 L40 44" className="av-facet" />
      <path d="M15 22 L28 24.5 M49 22 L36 24.5" className="av-brow" />
      <g className="av-eyes">
        <path className="av-eye" d="M16 28.5 L28 29.5 L27 32 L17 31 Z" />
        <path className="av-eye" d="M48 28.5 L36 29.5 L37 32 L47 31 Z" />
      </g>
      <g className="av-mouth">
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={23.4 + i * 3.6} y={42} width={2.2} height={6} rx={1.1} />)}
      </g>
    </svg>
  );
}
