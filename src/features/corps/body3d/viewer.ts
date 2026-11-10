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
import { MUSCLE_BY_ID, type MovementId, type MuscleId } from "@/content/anatomy";
import { applyPose, buildRig, worldOfRest, REST, type Rig } from "./rig";
import { buildStrands, updateStrand, type Strand } from "./muscles";
import { bodyMats, buildBody, type BodyMats } from "./body";
import { floorMat, makeMat, shadowMat } from "./materials";
import { ANIMS, sampleAnim, type Anim, type Prop } from "./poses";

export interface ViewerOpts { accent: string; bg: string; onPick: (id: MuscleId | null) => void; reducedMotion?: boolean }
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
      m.userData.id = s.def.id;
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

  setExercise(mouvement: MovementId, muscles: { id: MuscleId; w: number }[]) {
    this.anim = ANIMS[mouvement] ?? ANIMS.debout;
    this.heat = Object.fromEntries(muscles.map((m) => [m.id, m.w]));
    this.phase = 0;
    this.buildProps(this.anim.props ?? []);
    this.frame(true);
  }
  setPlaying(p: boolean) { this.playing = p; }
  setSpeed(s: number) { this.speed = s; }
  setIsolate(b: boolean) { this.isolate = b; this.applyLook(); }
  select(id: MuscleId | null, focus = true) {
    this.sel = id; this.applyLook();
    if (id && focus) this.focusMuscle(id); else if (!id && focus) this.frame(false);
  }
  setView(v: View) {
    const az = v === "face" ? 0 : v === "profil" ? 90 : 180;
    this.moveTo(this.frameCenter.clone(), this.orbitPos(this.frameCenter, az, 8, this.frameDist), 650);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
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
    for (let i = 0; i < this.strands.length; i++) {
      const s = this.strands[i], h = this.heat[s.def.id] ?? 0;
      const v = h * (0.7 + 0.3 * effort);
      updateStrand(s, this.rig, v * effort);
      const u = (this.meshes[i].material as ShaderMaterial).uniforms;
      u.uHeat.value = v; u.uPulse.value = effort;
    }
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

  private applyLook() {
    for (let i = 0; i < this.meshes.length; i++) {
      const id = this.strands[i].def.id;
      const mat = this.meshes[i].material as ShaderMaterial;
      const on = this.sel === id;
      const ghost = this.isolate ? ((this.heat[id] ?? 0) > 0.05 || on ? 0 : 1) : this.sel && !on ? 0 : 0;
      mat.uniforms.uSel.value = on ? 1 : 0;
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
    this.opts.onPick(id);
  };

  private buildProps(list: Prop[]) {
    this.props.children.slice().forEach((c) => { this.props.remove(c); (c as Mesh).geometry?.dispose(); });
    for (const k of ["halteresL", "halteresR"]) { const o = this.rig.bones.handL.getObjectByName(k) ?? this.rig.bones.handR.getObjectByName(k); o?.parent?.remove(o); }
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
      } else if (p === "tapis") {
        mesh(new BoxGeometry(0.62, 0.012, 1.8), makeMat("tissu", "#23262b"), [0, 0.006, 0]);
      } else if (p === "halteres") {
        for (const side of ["L", "R"] as const) {
          const g = new Group(); g.name = `halteres${side}`;
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

export const hasWebGL = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};
