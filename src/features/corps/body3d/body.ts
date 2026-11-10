/*
 * Ce qui n'est pas muscle : plan profond (tissu sombre qui comble les interstices), os visibles (côtes, clavicules,
 * sternum, rotules, épineuses, malléoles), tête de pierre aux yeux dans la couleur du pilier, mains et pieds.
 * Chaque pièce est accrochée à un os du squelette et décrite en coordonnées monde au repos.
 */
import { CapsuleGeometry, CatmullRomCurve3, LatheGeometry, Mesh, Quaternion, SphereGeometry, TubeGeometry, Vector2, Vector3, type BufferGeometry, type ShaderMaterial } from "three";
import { REST, mirrorX, type Joint, type Rig, type V3 } from "./rig";
import { makeMat } from "./materials";

export interface BodyMats { tissu: ShaderMaterial; os: ShaderMaterial; pierre: ShaderMaterial; oeil: ShaderMaterial }

export function bodyMats(accent: string): BodyMats {
  return {
    tissu: makeMat("tissu", "#2c1917"),
    os: makeMat("os", "#cbc1ae"),
    pierre: makeMat("pierre", "#c4baa8"),
    oeil: makeMat("oeil", accent),
  };
}

const SPHERE = new SphereGeometry(1, 30, 22);
const SMALL = new SphereGeometry(1, 14, 10);

function put(rig: Rig, bone: Joint, geo: BufferGeometry, mat: ShaderMaterial, at: V3, scale?: V3, q?: Quaternion) {
  const m = new Mesh(geo, mat);
  const r = REST[bone];
  m.position.set(at[0] - r[0], at[1] - r[1], at[2] - r[2]);
  if (scale) m.scale.set(...scale);
  if (q) m.quaternion.copy(q);
  rig.bones[bone].add(m);
  return m;
}

/** Fuseau creux qui va d'une articulation à la suivante (rayon r0 → r1), arrondi aux deux bouts. */
function limb(rig: Rig, bone: Joint, to: Joint, r0: number, r1: number, mat: ShaderMaterial) {
  const a = new Vector3(...REST[bone]), b = new Vector3(...REST[to]);
  const len = a.distanceTo(b);
  const pts: Vector2[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const cap = Math.sin(Math.PI * Math.min(1, Math.min(u, 1 - u) * 5)) ** 0.5; // arrondi
    const r = (r0 + (r1 - r0) * u) * (0.35 + 0.65 * cap) + 0.0005;
    pts.push(new Vector2(r, -u * len));
  }
  const geo = new LatheGeometry(pts, 20);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), b.clone().sub(a).normalize());
  return put(rig, bone, geo, mat, REST[bone], undefined, q);
}

function tube(rig: Rig, bone: Joint, pts: V3[], r: number, mat: ShaderMaterial) {
  const rr = REST[bone];
  const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(p[0] - rr[0], p[1] - rr[1], p[2] - rr[2])));
  const m = new Mesh(new TubeGeometry(curve, Math.max(8, pts.length * 6), r, 7, false), mat);
  rig.bones[bone].add(m);
  return m;
}

export function buildBody(rig: Rig, M: BodyMats): Mesh[] {
  const out: Mesh[] = [];
  const add = (m: Mesh) => { out.push(m); return m; };

  /* Tronc : plans profonds. */
  add(put(rig, "chest", SPHERE, M.tissu, [0, 1.335, -0.014], [0.126, 0.158, 0.1]));
  add(put(rig, "spine", SPHERE, M.tissu, [0, 1.135, -0.002], [0.116, 0.12, 0.086]));
  add(put(rig, "hips", SPHERE, M.tissu, [0, 0.945, -0.008], [0.14, 0.085, 0.096]));
  add(put(rig, "neck", new CapsuleGeometry(0.046, 0.09, 6, 16), M.tissu, [0, 1.545, -0.025]));

  /* Sternum, côtes, épineuses. */
  add(put(rig, "chest", SPHERE, M.os, [0, 1.375, 0.098], [0.011, 0.07, 0.008]));
  for (let i = 0; i < 7; i++) {
    const y0 = 1.425 - i * 0.03, rx = 0.128 - Math.abs(i - 3) * 0.002, rz = 0.1;
    for (const s of [1, -1]) {
      const pts: V3[] = [];
      for (let k = 0; k <= 8; k++) {
        const phi = (-100 + (k / 8) * (i < 5 ? 175 : 140)) * (Math.PI / 180);
        pts.push([s * (Math.cos(phi) * rx + 0.004), y0 - (k / 8) * (0.045 + i * 0.006), Math.sin(phi) * rz - 0.014]);
      }
      add(tube(rig, "chest", pts, 0.0058, M.os));
    }
  }
  for (let y = 1.49; y > 0.97; y -= 0.036) {
    const bone: Joint = y > 1.5 ? "neck" : y > 1.28 ? "chest" : y > 1.07 ? "spine" : "hips";
    const z = y > 1.28 ? -0.106 - (1.49 - y) * 0.05 : -0.094;
    add(put(rig, bone, SMALL, M.os, [0, y, z], [0.0055, 0.008, 0.008]));
  }

  for (const s of ["L", "R"] as const) {
    const X = (p: V3): V3 => (s === "R" ? mirrorX(p) : p);
    const b = (k: string) => `${k}${s}` as Joint;
    /* Ceinture scapulaire et membres : plans profonds. */
    add(tube(rig, b("clav"), [X([0.015, 1.462, 0.07]), X([0.09, 1.47, 0.078]), X([0.175, 1.478, 0.006])], 0.0062, M.os));
    add(put(rig, b("clav"), SMALL, M.os, X([0.17, 1.475, -0.025]), [0.026, 0.009, 0.03])); // acromion
    add(put(rig, b("arm"), SPHERE, M.tissu, REST[b("arm")], [0.044, 0.044, 0.044]));
    add(limb(rig, b("arm"), b("fore"), 0.035, 0.029, M.tissu));
    add(put(rig, b("fore"), SPHERE, M.tissu, REST[b("fore")], [0.031, 0.031, 0.031]));
    add(put(rig, b("fore"), SMALL, M.os, X([0.215, 1.15, -0.048]), [0.014, 0.016, 0.012])); // olécrâne
    add(limb(rig, b("fore"), b("hand"), 0.028, 0.018, M.tissu));
    add(limb(rig, b("thigh"), b("shin"), 0.074, 0.05, M.tissu));
    add(put(rig, b("shin"), SPHERE, M.tissu, REST[b("shin")], [0.046, 0.046, 0.046]));
    add(put(rig, b("shin"), SPHERE, M.os, X([0.1, 0.5, 0.058]), [0.024, 0.029, 0.013])); // rotule
    add(limb(rig, b("shin"), b("foot"), 0.046, 0.027, M.tissu));
    add(tube(rig, b("shin"), [X([0.1, 0.46, 0.05]), X([0.104, 0.3, 0.045]), X([0.098, 0.12, 0.03])], 0.0055, M.os)); // crête tibiale
    add(put(rig, b("shin"), SMALL, M.os, X([0.132, 0.08, -0.022]), [0.013, 0.016, 0.013]));
    add(put(rig, b("shin"), SMALL, M.os, X([0.07, 0.088, -0.016]), [0.013, 0.016, 0.013]));
    add(put(rig, "hips", SMALL, M.os, X([0.118, 0.99, 0.085]), [0.012, 0.012, 0.012])); // épine iliaque

    /* Main : paume, quatre doigts légèrement fléchis, pouce. */
    const h = b("hand");
    add(put(rig, h, SPHERE, M.os, X([0.238, 0.85, 0.014]), [0.036, 0.048, 0.015]));
    const finger = new CapsuleGeometry(0.0082, 0.062, 4, 8);
    const curl = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.28);
    [-0.024, -0.008, 0.008, 0.023].forEach((dx, i) => {
      add(put(rig, h, finger, M.os, X([0.238 + dx, 0.775 + (i === 0 || i === 3 ? 0.008 : 0), 0.024]), undefined, curl));
    });
    const thumbQ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), s === "L" ? 0.55 : -0.55).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.5));
    add(put(rig, h, new CapsuleGeometry(0.0095, 0.045, 4, 8), M.os, X([0.272, 0.835, 0.03]), undefined, thumbQ));

    /* Pied : talon, voûte, avant-pied. */
    const f = b("foot");
    add(put(rig, f, SPHERE, M.os, X([0.1, 0.045, -0.04]), [0.034, 0.042, 0.048]));
    add(put(rig, f, SPHERE, M.os, X([0.104, 0.036, 0.06]), [0.042, 0.034, 0.1]));
    add(put(rig, f, SPHERE, M.os, X([0.108, 0.018, 0.155]), [0.046, 0.019, 0.04]));
  }

  /* Tête : crâne et visage de pierre, regard dans la couleur du pilier. */
  add(put(rig, "head", SPHERE, M.pierre, [0, 1.695, 0.0], [0.078, 0.1, 0.096]));
  add(put(rig, "head", SPHERE, M.pierre, [0, 1.632, 0.036], [0.058, 0.052, 0.062]));
  add(put(rig, "head", SPHERE, M.pierre, [0, 1.668, 0.094], [0.011, 0.021, 0.014])); // nez
  add(put(rig, "head", SPHERE, M.pierre, [0, 1.722, 0.07], [0.068, 0.022, 0.035])); // arcades
  for (const x of [0.03, -0.03]) {
    add(put(rig, "head", SMALL, M.tissu, [x, 1.697, 0.082], [0.017, 0.011, 0.01]));
    add(put(rig, "head", SMALL, M.oeil, [x, 1.697, 0.088], [0.011, 0.0055, 0.006]));
  }
  for (const x of [0.078, -0.078]) add(put(rig, "head", SPHERE, M.pierre, [x, 1.685, -0.005], [0.01, 0.026, 0.017]));
  return out;
}
