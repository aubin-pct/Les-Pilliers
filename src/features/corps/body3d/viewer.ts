/*
 * Visionneuse de l'écorché : scène three.js, boucle d'animation, caméra orbitale, toucher d'un muscle (rayon),
 * cadrage automatique sur le mouvement puis sur le muscle choisi, mode « isoler » (le reste devient verre).
 * Aucune dépendance à React : `ExoViewer.tsx` la pilote.
 */
import {
  BoxGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, PerspectiveCamera, PlaneGeometry, Raycaster, Scene,
  Vector2, Vector3, WebGLRenderer, LinearSRGBColorSpace, type Object3D, type ShaderMaterial,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MUSCLE_BY_ID, PARTS, type MovementId, type MuscleId, type PartFocus } from "@/content/anatomy";
import { applyPose, buildRig, worldOfRest, REST, type Rig } from "./rig";
import { buildStrands, updateStrand, type Strand } from "./muscles";
import { bodyMats, buildBody, type BodyMats } from "./body";
import { floorMat, makeMat, shadowMat } from "./materials";
import { ANIMS, sampleAnim, type Anim, type Prop } from "./poses";

export interface ViewerOpts {
  accent: string; bg: string; onPick: (id: MuscleId | null, part?: string) => void; reducedMotion?: boolean;
  /** Avancement du cycle (0–1) et effort instantané (0–1), environ dix fois par seconde. */
  onFrame?: (phase: number, effort: number) => void;
}
export type View = "face" | "profil" | "dos";

const BASE_MUSCLE = "#7a6f68"; // repos : neutre, pour que le rouge ne dise que l'intensité

export class BodyViewer {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(34, 1, 0.05, 30);
  private controls: OrbitControls;
  private rig: Rig;
  private strands: Strand[];
  private meshes: Mesh[] = [];
  private mats: BodyMats;
  private bodyMeshes: Mesh[];
  private props = new Group();
  private shadow: Mesh;
  private heat: Partial<Record<MuscleId, number>> = {};
  private parts: PartFocus = {};
  private selPart: string | null = null;
  private overlay: HTMLElement | null = null;
  private pins: { el: HTMLElement; strands: Strand[]; q: 0 | 1 | 2 }[] = [];
  private anim: Anim = ANIMS.debout;
  private phase = 0;
  private last = 0;
  private raf = 0;
  private speed = 1;
  playing = true;
  private sel: MuscleId | null = null;
  private isolate = false;
  private ro: ResizeObserver;
  private tween: { t0: number; dur: number; fromT: Vector3; toT: Vector3; fromP: Vector3; toP: Vector3 } | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private frameCenter = new Vector3(0, 1, 0);
  private frameDist = 3.2;
  private disposed = false;
  private lastFrameCb = 0;

  constructor(private canvas: HTMLCanvasElement, private opts: ViewerOpts) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.rig = buildRig();
    this.scene.add(this.rig.root);
    this.mats = bodyMats(opts.accent);
    this.bodyMeshes = buildBody(this.rig, this.mats);
    this.strands = buildStrands();
    this.strands.forEach((s, i) => {
      const m = new Mesh(s.geo, makeMat("muscle", BASE_MUSCLE, { tend: s.def.tend ?? [0.08, 0.12], seg: s.def.seg ?? 0, rim: opts.accent, seed: i * 1.7, fibers: Math.round(8 + s.def.w * 140) }));
      m.userData.id = s.def.id; m.userData.part = s.def.part; m.userData.grad = s.def.grad;
      m.frustumCulled = false;
      m.renderOrder = s.def.deep ? 1 : 2;
      this.meshes.push(m);
      this.scene.add(m);
    });
    const floor = new Mesh(new CircleGeometry(2.6, 64), floorMat(opts.bg, opts.accent));
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -2;
    this.scene.add(floor);
    this.shadow = new Mesh(new PlaneGeometry(1, 1), shadowMat());
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.002; this.shadow.renderOrder = -1;
    this.scene.add(this.shadow);
    this.scene.add(this.props);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false; this.controls.minDistance = 0.7; this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI * 0.62; this.controls.rotateSpeed = 0.75;
    this.controls.addEventListener("start", () => { this.tween = null; });

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    document.addEventListener("visibilitychange", this.onVis);
    this.resize();
    this.loop(performance.now());
  }

  /* ---------------- API ---------------- */

  setExercise(mouvement: MovementId, muscles: { id: MuscleId; w: number }[], parts: PartFocus = {}) {
    this.anim = ANIMS[mouvement] ?? ANIMS.debout;
    this.heat = Object.fromEntries(muscles.map((m) => [m.id, m.w]));
    this.parts = parts;
    this.buildPins();
    this.phase = 0;
    this.buildProps(this.anim.props ?? []);
    this.frame(true);
  }
  setPlaying(p: boolean) { this.playing = p; }
  setSpeed(s: number) { this.speed = s; }
  setIsolate(b: boolean) { this.isolate = b; this.applyLook(); }
  /** Conteneur HTML (au-dessus du canvas) où s'affichent les étiquettes des portions du muscle choisi. */
  setOverlay(el: HTMLElement | null) { this.overlay = el; this.buildPins(); }
  select(id: MuscleId | null, focus = true, part: string | null = null) {
    const changed = id !== this.sel;
    this.sel = id; this.selPart = part; this.applyLook(); this.buildPins();
    if (!changed && id) return;
    if (id && focus) this.focusMuscle(id); else if (!id && focus) this.frame(false);
  }
  /** Revient au cadrage d'origine du mouvement. */
  recenter() { this.sel = null; this.selPart = null; this.applyLook(); this.buildPins(); this.frame(false); }
  setView(v: View) {
    const az = v === "face" ? 0 : v === "profil" ? 90 : 180;
    this.moveTo(this.frameCenter.clone(), this.orbitPos(this.frameCenter, az, 8, this.frameDist), 650);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.pins.forEach((p) => p.el.remove()); this.pins = [];
    this.ro.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as ShaderMaterial).dispose(); }
    });
    this.renderer.dispose();
  }

  /* ---------------- Interne ---------------- */

  private onVis = () => { if (!document.hidden) this.last = performance.now(); };

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (this.playing && !this.opts.reducedMotion) this.phase = (this.phase + (dt * this.speed) / this.anim.dur) % 1;
    const pose = sampleAnim(this.anim, this.phase);
    applyPose(this.rig, pose);
    const effort = pose.effort ?? 0.6;
    if (this.opts.onFrame && now - this.lastFrameCb > 100) { this.lastFrameCb = now; this.opts.onFrame(this.phase, effort); }
    const k = 0.7 + 0.3 * effort;
    for (let i = 0; i < this.strands.length; i++) {
      const s = this.strands[i];
      const [a, b] = this.strandHeat(s);
      updateStrand(s, this.rig, Math.max(a, b) * k * effort);
      const u = (this.meshes[i].material as ShaderMaterial).uniforms;
      u.uHeat.value = a * k; u.uHeatB.value = b * k; u.uPulse.value = effort;
    }
    this.placePins();
    this.mats.oeil.uniforms.uPulse.value = 0.4 + 0.6 * effort;
    this.placeShadow();
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur), e = 1 - Math.pow(1 - k, 3);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e);
      this.camera.position.lerpVectors(this.tween.fromP, this.tween.toP, e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /** Intensité d'une portion (muscle × part de la portion dans le mouvement). */
  private partHeat(id: MuscleId, part?: string) {
    const w = this.heat[id] ?? 0;
    return Math.min(1, part ? w * (this.parts[id]?.[part] ?? 1) : w);
  }
  /** Intensité à l'origine et à l'insertion du faisceau (différentes seulement pour le grand droit). */
  private strandHeat(s: Strand): [number, number] {
    if (s.def.grad) return [this.partHeat(s.def.id, s.def.grad[0]), this.partHeat(s.def.id, s.def.grad[1])];
    const h = this.partHeat(s.def.id, s.def.part);
    return [h, h];
  }

  /** Étiquettes posées sur le corps : une par portion du muscle choisi (ou une seule s'il n'a pas de portions). */
  private buildPins() {
    this.pins.forEach((p) => p.el.remove());
    this.pins = [];
    const id = this.sel, host = this.overlay;
    if (!id || !host) return;
    const own = this.strands.filter((s) => s.def.id === id);
    const parts = PARTS[id];
    const make = (label: string, h: number, strands: Strand[], q: 0 | 1 | 2, part: string | null) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "anat-pin" + (part && part === this.selPart ? " on" : "");
      el.innerHTML = `<i></i><span><em></em><b></b></span>`;
      (el.querySelector("em") as HTMLElement).textContent = label;
      (el.querySelector("b") as HTMLElement).textContent = String(Math.round(h * 100));
      el.style.setProperty("--h", heatColor(h));
      el.addEventListener("click", (e) => { e.stopPropagation(); this.opts.onPick(id, part ?? undefined); });
      host.appendChild(el);
      this.pins.push({ el, strands, q });
    };
    if (!parts) { make(MUSCLE_BY_ID[id].nom, this.partHeat(id), own, 1, null); return; }
    for (const p of parts) {
      const grad = own.filter((s) => s.def.grad);
      if (grad.length) make(p.court, this.partHeat(id, p.id), grad, grad[0].def.grad![0] === p.id ? 0 : 2, p.id);
      else make(p.court, this.partHeat(id, p.id), own.filter((s) => s.def.part === p.id), 1, p.id);
    }
  }
  private placePins() {
    if (!this.pins.length || !this.overlay) return;
    const w = this.overlay.clientWidth, h = this.overlay.clientHeight;
    const cam = this.camera.position, v = new Vector3();
    const pts = this.pins.map((p) => {
      // Le faisceau du côté de la caméra (le gauche ou le droit) porte l'étiquette.
      let best: Vector3 | null = null, bd = Infinity;
      for (const s of p.strands) { const d = s.q[p.q].distanceTo(cam); if (d < bd) { bd = d; best = s.q[p.q]; } }
      if (!best) return null;
      v.copy(best).project(this.camera);
      return v.z > 1 ? null : { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
    });
    const visible = pts.filter(Boolean) as { x: number; y: number }[];
    const cx = visible.reduce((a, p) => a + p.x, 0) / Math.max(1, visible.length);
    // Étiquettes empilées sans se chevaucher : on les écarte verticalement de 24 px au moins.
    const order = this.pins.map((_, i) => i).filter((i) => pts[i]).sort((a, b) => pts[a]!.y - pts[b]!.y);
    let lastY = -Infinity;
    for (const i of order) {
      const p = pts[i]!, ly = Math.max(p.y, lastY + 24); lastY = ly;
      const el = this.pins[i].el;
      el.style.display = "";
      el.classList.toggle("left", p.x < cx || (visible.length === 1 && p.x > w * 0.6));
      el.style.setProperty("--dy", `${ly - p.y}px`);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    this.pins.forEach((p, i) => { if (!pts[i]) p.el.style.display = "none"; });
  }

  private applyLook() {
    for (let i = 0; i < this.meshes.length; i++) {
      const id = this.strands[i].def.id;
      const mat = this.meshes[i].material as ShaderMaterial;
      const on = this.sel === id;
      const ghost = this.isolate ? ((this.heat[id] ?? 0) > 0.05 || on ? 0 : 1) : this.sel && !on ? 0 : 0;
      mat.uniforms.uSel.value = on ? (this.selPart ? 0.35 : 1) : 0;
      const s = this.strands[i];
      mat.uniforms.uPart.value = on && this.selPart && (s.def.part === this.selPart || s.def.grad) ? 1 : 0;
      mat.uniforms.uGhost.value = ghost;
      mat.depthWrite = ghost < 0.5;
      this.meshes[i].renderOrder = ghost ? 5 : this.strands[i].def.deep ? 1 : 2;
    }
    const ghostBody = this.isolate ? 1 : 0;
    for (const m of this.bodyMeshes) {
      const mat = m.material as ShaderMaterial;
      if (mat === this.mats.oeil) continue;
      mat.uniforms.uGhost.value = ghostBody; mat.depthWrite = !ghostBody;
      m.renderOrder = ghostBody ? 4 : 0;
    }
  }

  private placeShadow() {
    const b = this.rig.bones;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
    const v = new Vector3();
    for (const j of ["head", "chest", "hips", "handL", "handR", "footL", "footR", "shinL", "shinR", "foreL", "foreR"] as const) {
      b[j].getWorldPosition(v);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); minY = Math.min(minY, v.y);
    }
    const lift = Math.max(0, minY - 0.08);
    this.shadow.position.set((minX + maxX) / 2, 0.002, (minZ + maxZ) / 2);
    this.shadow.scale.set(maxX - minX + 0.5 + lift, maxZ - minZ + 0.5 + lift, 1);
    (this.shadow.material as ShaderMaterial).opacity = 1;
  }

  /** Cadre tout le mouvement (boîte englobante sur un cycle). */
  private frame(instant: boolean) {
    const pts: Vector3[] = [];
    for (let k = 0; k < 10; k++) {
      applyPose(this.rig, sampleAnim(this.anim, k / 10));
      for (const j of ["head", "handL", "handR", "footL", "footR", "hips", "chest"] as const) pts.push(this.rig.bones[j].getWorldPosition(new Vector3()));
      pts.push(worldOfRest(this.rig, "head", [0, 1.8, 0]));
    }
    if (this.anim.props?.some((p) => p === "barre" || p === "poignees")) pts.push(new Vector3(0, 2.42, 0)); // la barre reste dans le cadre
    const min = pts.reduce((a, p) => a.min(p), pts[0].clone()), max = pts.reduce((a, p) => a.max(p), pts[0].clone());
    const c = min.clone().add(max).multiplyScalar(0.5);
    const size = max.clone().sub(min);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const vSpan = Math.max(size.y, 0.6) * 1.28, hSpan = Math.max(Math.hypot(size.x, size.z), 0.6) * 1.12;
    const fit = Math.max(vSpan / 2 / tanV, hSpan / 2 / (tanV * this.camera.aspect)) + Math.hypot(size.x, size.z) * 0.25;
    this.frameCenter.copy(c);
    this.frameDist = Math.max(1.6, Math.min(5.5, fit));
    const pos = this.orbitPos(c, this.anim.az ?? 30, this.anim.el ?? 8, this.frameDist);
    if (instant) { this.controls.target.copy(c); this.camera.position.copy(pos); this.controls.update(); }
    else this.moveTo(c, pos, 700);
  }

  private orbitPos(target: Vector3, azDeg: number, elDeg: number, dist: number) {
    const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
    return new Vector3(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
  }

  private moveTo(target: Vector3, pos: Vector3, dur: number) {
    this.tween = { t0: performance.now(), dur, fromT: this.controls.target.clone(), toT: target, fromP: this.camera.position.clone(), toP: pos };
  }

  /** Tourne la caméra vers le muscle : on le regarde depuis l'extérieur du corps. */
  private focusMuscle(id: MuscleId) {
    const ss = this.strands.filter((s) => s.def.id === id);
    if (!ss.length) return;
    const c = new Vector3(); ss.forEach((s) => c.add(s.center)); c.multiplyScalar(1 / ss.length);
    // Côté du corps où se trouve le muscle : on le juge par rapport au tronc, dans le repère du bassin.
    const hips = this.rig.bones.hips;
    const local = hips.worldToLocal(c.clone());
    const face = MUSCLE_BY_ID[id].face;
    const dirLocal = face === "avant" ? new Vector3(0.35, 0, 1) : face === "arriere" ? new Vector3(0.35, 0, -1) : new Vector3(Math.sign(local.x || 1), 0, 0.35);
    const dir = dirLocal.normalize().transformDirection(hips.matrixWorld);
    dir.y = Math.max(dir.y, -0.1) + 0.18;
    const target = c.clone().lerp(this.frameCenter, 0.35);
    this.moveTo(target, target.clone().add(dir.normalize().multiplyScalar(Math.max(1.3, this.frameDist * 0.62))), 700);
  }

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 450) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new Raycaster(); ray.setFromCamera(ndc, this.camera);
    const targets: Object3D[] = [];
    this.meshes.forEach((m, i) => {
      const ghost = (m.material as ShaderMaterial).uniforms.uGhost.value > 0.5;
      if (!ghost) { this.strands[i].geo.computeBoundingSphere(); targets.push(m); }
    });
    const solid = this.isolate ? [] : this.bodyMeshes.filter((m) => m.material !== this.mats.oeil);
    const hit = ray.intersectObjects([...targets, ...solid], false)[0];
    const id = (hit?.object.userData.id as MuscleId | undefined) ?? null;
    let part = hit?.object.userData.part as string | undefined;
    const grad = hit?.object.userData.grad as [string, string] | undefined;
    if (grad && hit?.uv) part = hit.uv.x < 0.5 ? grad[0] : grad[1];
    this.opts.onPick(id, part);
  };

  private buildProps(list: Prop[]) {
    this.props.children.slice().forEach((c) => { this.props.remove(c); (c as Mesh).geometry?.dispose(); });
    // Accessoires portés par le corps (haltères dans les mains, haltère contre la poitrine) : retirés avant d'en poser d'autres.
    const worn: Object3D[] = [];
    this.rig.root.traverse((o) => { if (o.userData.prop) worn.push(o); });
    worn.forEach((o) => o.parent?.remove(o));
    const metal = makeMat("metal", "#5d636b");
    const brass = makeMat("metal", "#a8873e");
    const wood = makeMat("pierre", "#4a4239");
    const stone = makeMat("pierre", "#2a2d31");
    const mesh = (g: ConstructorParameters<typeof Mesh>[0], m: ShaderMaterial, p: [number, number, number], rz = 0, rx = 0) => {
      const o = new Mesh(g, m); o.position.set(...p); o.rotation.z = rz; o.rotation.x = rx; this.props.add(o); return o;
    };
    for (const p of list) {
      if (typeof p === "object") {
        const [x, y, z, w, h, d] = p.box;
        mesh(new BoxGeometry(w, h, d), stone, [x, y, z]);
        mesh(new BoxGeometry(w, 0.025, d), wood, [x, y + h / 2 + 0.012, z]);
      } else if (p === "poignees") {
        mesh(new CylinderGeometry(0.02, 0.02, 1.3, 12), stone, [0, 2.44, 0.02], Math.PI / 2);
        for (const x of [-0.17, 0.17]) {
          mesh(new CylinderGeometry(0.016, 0.016, 0.24, 14), metal, [x, 2.3, 0.02], 0, Math.PI / 2);
          for (const dz of [-0.12, 0.12]) mesh(new CylinderGeometry(0.012, 0.012, 0.15, 8), stone, [x, 2.37, 0.02 + dz]);
        }
        for (const x of [-0.65, 0.65]) mesh(new CylinderGeometry(0.03, 0.03, 0.9, 12), stone, [x, 2.85, 0.02]);
      } else if (p === "barre") {
        mesh(new CylinderGeometry(0.016, 0.016, 1.3, 16), metal, [0, 2.3, 0.02], Math.PI / 2);
        for (const x of [-0.65, 0.65]) mesh(new CylinderGeometry(0.03, 0.03, 0.9, 12), stone, [x, 2.7, 0.02]);
      } else if (p === "banc") {
        mesh(new BoxGeometry(0.32, 0.07, 1.15), wood, [0, 0.415, -0.3]);
        for (const z of [-0.75, 0.15]) mesh(new BoxGeometry(0.26, 0.38, 0.06), stone, [0, 0.19, z]);
      } else if (p === "banc_dips") {
        mesh(new BoxGeometry(0.9, 0.06, 0.34), wood, [0, 0.42, -0.3]);
        for (const x of [-0.38, 0.38]) mesh(new BoxGeometry(0.06, 0.4, 0.3), stone, [x, 0.2, -0.3]);
      } else if (p === "mur") {
        mesh(new BoxGeometry(1.6, 2.1, 0.08), stone, [0, 1.05, -0.36]);
      } else if (p === "barres_paralleles") {
        for (const x of [-0.26, 0.26]) {
          mesh(new CylinderGeometry(0.02, 0.02, 1.1, 14), metal, [x, 1.25, 0.1], 0, Math.PI / 2);
          for (const z of [-0.4, 0.6]) mesh(new CylinderGeometry(0.025, 0.03, 1.25, 10), stone, [x, 0.625, z]);
        }
      } else if (p === "goblet") {
        // Un seul haltère tenu debout contre la poitrine, accroché au thorax.
        const g = new Group(); g.userData.prop = true;
        const r = REST.chest;
        g.position.set(0 - r[0], 1.235 - r[1], 0.215 - r[2]);
        g.add(new Mesh(new CylinderGeometry(0.013, 0.013, 0.17, 12), metal));
        for (const y of [-0.075, 0.075]) {
          const plate = new Mesh(new CylinderGeometry(0.055, 0.055, 0.035, 20), metal); plate.position.y = y; g.add(plate);
          const rim = new Mesh(new CylinderGeometry(0.057, 0.057, 0.006, 20), brass); rim.position.y = y + Math.sign(y) * 0.018; g.add(rim);
        }
        this.rig.bones.chest.add(g);
      } else if (p === "tapis") {
        mesh(new BoxGeometry(0.62, 0.012, 1.8), makeMat("tissu", "#23262b"), [0, 0.006, 0]);
      } else if (p === "halteres") {
        for (const side of ["L", "R"] as const) {
          const g = new Group(); g.name = `halteres${side}`; g.userData.prop = true;
          const hand = this.rig.bones[`hand${side}`];
          const r = REST[`hand${side}`];
          const cx = (side === "L" ? 0.238 : -0.238) - r[0];
          g.position.set(cx, 0.85 - r[1], 0.016 - r[2]);
          const bar = new Mesh(new CylinderGeometry(0.011, 0.011, 0.17, 12), metal); bar.rotation.z = Math.PI / 2; g.add(bar);
          for (const x of [-0.07, 0.07]) {
            const plate = new Mesh(new CylinderGeometry(0.044, 0.044, 0.04, 20), metal); plate.rotation.z = Math.PI / 2; plate.position.x = x; g.add(plate);
            const rim = new Mesh(new CylinderGeometry(0.046, 0.046, 0.006, 20), brass); rim.rotation.z = Math.PI / 2; rim.position.x = x + Math.sign(x) * 0.02; g.add(rim);
          }
          hand.add(g);
        }
      }
    }
  }
}

/** Même rampe que le shader (pour les étiquettes HTML). */
function heatColor(h: number) {
  const st: [number, number[]][] = [[0, [122, 111, 104]], [0.08, [56, 158, 77]], [0.45, [230, 204, 46]], [0.72, [247, 122, 31]], [0.95, [224, 26, 20]], [1, [224, 26, 20]]];
  let i = 0; while (i < st.length - 2 && h > st[i + 1][0]) i++;
  const [a, ca] = st[i], [b, cb] = st[i + 1], u = Math.max(0, Math.min(1, (h - a) / (b - a)));
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * u)).join(",")})`;
}

export const hasWebGL = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};
