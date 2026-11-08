// Visualizzatore 3D: manichino olografico animato con pose a fotogrammi chiave.
// Il manichino è uno scheletro gerarchico (bacino → colonna → torace → braccia, bacino → gambe).
// Ogni pose indica gli angoli articolari in gradi; il visualizzatore interpola,
// appoggia il corpo a terra e mantiene fermi i punti d'appoggio (piedi o mani).

import * as THREE from '../vendor/three.module.min.js';
import { MOTIONS, motionFor, MUSCLE_SEGMENTS } from './motions.js';

const D2R = Math.PI / 180;
const SIDES = [['L', 1], ['R', -1]];

const C = {
  base: new THREE.Color('#262b33'),
  rim: new THREE.Color('#5cf0ff'),
  hl: new THREE.Color('#c6ff3d'),
  joint: new THREE.Color('#5cf0ff'),
  prop: new THREE.Color('#5cf0ff'),
};

// ------------------------------------------------------------------
// Materiali
// ------------------------------------------------------------------

const VERT = `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 base; uniform vec3 rim; uniform vec3 hlColor; uniform float hl; uniform float time;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN);
  float ndv = max(dot(n, vV), 0.0);
  float fres = pow(1.0 - ndv, 2.4);
  vec3 l = normalize(vec3(0.35, 0.85, 0.55));
  float diff = max(dot(n, l), 0.0) * 0.7 + 0.3;
  vec3 c = base * diff + rim * fres * 0.85;
  float pulse = 0.72 + 0.28 * sin(time * 4.0);
  vec3 h = hlColor * (0.35 + 0.45 * diff) + hlColor * fres * 1.3;
  c = mix(c, h, hl * pulse);
  gl_FragColor = vec4(c, 1.0);
}`;

function bodyMat() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { base: { value: C.base }, rim: { value: C.rim }, hlColor: { value: C.hl }, hl: { value: 0 }, time: { value: 0 } },
  });
}
const jointMat = new THREE.MeshBasicMaterial({ color: C.joint });
const visorMat = new THREE.MeshBasicMaterial({ color: C.joint });

// ------------------------------------------------------------------
// Costruzione del manichino
// ------------------------------------------------------------------

const DIM = {
  hipW: 0.095, thigh: 0.44, shin: 0.43, spine: 0.2, chest: 0.25, neck: 0.08,
  shW: 0.19, upper: 0.29, fore: 0.26,
};

function limb(len, r1, r2, mat, gap = 0.03) {
  const g = new THREE.Group();
  const l = len - gap * 2;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, l, 18, 1, true), mat);
  cyl.position.y = -gap - l / 2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(r1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  top.position.y = -gap;
  const bot = new THREE.Mesh(new THREE.SphereGeometry(r2, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
  bot.position.y = -gap - l;
  g.add(cyl, top, bot);
  return g;
}
function ellipsoid(rx, ry, rz, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat);
  m.scale.set(rx, ry, rz);
  return m;
}
function joint(r) { return new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), jointMat); }

function buildRig() {
  const j = {};       // articolazioni (gruppi ruotabili)
  const seg = {};     // segmenti corporei: { nome: { group, mat } }
  const addSeg = (name, parent, obj, mat) => { parent.add(obj); seg[name] = { obj, mat }; };

  const root = new THREE.Group(); root.rotation.order = 'YXZ'; j.root = root;

  // bacino
  const mPelvis = bodyMat();
  const pelvis = ellipsoid(0.15, 0.1, 0.1, mPelvis); pelvis.position.y = -0.02;
  addSeg('pelvis', root, pelvis, mPelvis);

  // colonna
  const spine = new THREE.Group(); spine.rotation.order = 'YXZ'; root.add(spine); j.spine = spine;
  const mAbs = bodyMat();
  const abs = ellipsoid(0.125, 0.12, 0.09, mAbs); abs.position.y = 0.11;
  addSeg('abs', spine, abs, mAbs);
  const jSp = joint(0.05); jSp.position.y = 0.03; spine.add(jSp);

  const chest = new THREE.Group(); chest.rotation.order = 'YXZ'; chest.position.y = DIM.spine; spine.add(chest); j.chest = chest;
  const mChest = bodyMat();
  const torso = ellipsoid(0.17, 0.16, 0.11, mChest); torso.position.y = 0.12;
  addSeg('chest', chest, torso, mChest);

  const neck = new THREE.Group(); neck.rotation.order = 'YXZ'; neck.position.y = DIM.chest; chest.add(neck); j.neck = neck;
  const mHead = bodyMat();
  const headG = new THREE.Group();
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 12), mHead); neckM.position.y = 0.03;
  const head = ellipsoid(0.1, 0.12, 0.11, mHead); head.position.y = 0.16;
  const visor = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.011, 8, 40, Math.PI * 0.9), visorMat);
  visor.position.set(0, 0.17, 0.012); visor.rotation.set(Math.PI / 2, 0, Math.PI * 0.05 + Math.PI);
  headG.add(neckM, head, visor);
  addSeg('head', neck, headG, mHead);

  // braccia
  for (const [s, sign] of SIDES) {
    const sh = new THREE.Group(); sh.rotation.order = 'XZY'; sh.position.set(sign * DIM.shW, DIM.chest - 0.035, 0); chest.add(sh); j['sh' + s] = sh;
    const mSh = bodyMat();
    addSeg('shoulder' + s, sh, ellipsoid(0.06, 0.06, 0.06, mSh), mSh);
    const mUp = bodyMat();
    addSeg('upperArm' + s, sh, limb(DIM.upper, 0.048, 0.04, mUp), mUp);
    const el = new THREE.Group(); el.position.y = -DIM.upper; sh.add(el); j['el' + s] = el;
    el.add(joint(0.032));
    const mFo = bodyMat();
    addSeg('foreArm' + s, el, limb(DIM.fore, 0.038, 0.03, mFo), mFo);
    const wr = new THREE.Group(); wr.position.y = -DIM.fore; el.add(wr); j['wr' + s] = wr;
    wr.add(joint(0.026));
    const mHand = bodyMat();
    const hand = ellipsoid(0.03, 0.05, 0.022, mHand); hand.position.y = -0.055;
    addSeg('hand' + s, wr, hand, mHand);
  }

  // gambe
  for (const [s, sign] of SIDES) {
    const hip = new THREE.Group(); hip.rotation.order = 'XZY'; hip.position.set(sign * DIM.hipW, -0.04, 0); root.add(hip); j['hip' + s] = hip;
    hip.add(joint(0.05));
    const mTh = bodyMat();
    addSeg('thigh' + s, hip, limb(DIM.thigh, 0.07, 0.05, mTh), mTh);
    const kn = new THREE.Group(); kn.position.y = -DIM.thigh; hip.add(kn); j['kn' + s] = kn;
    kn.add(joint(0.04));
    const mSh = bodyMat();
    addSeg('shin' + s, kn, limb(DIM.shin, 0.05, 0.035, mSh), mSh);
    const an = new THREE.Group(); an.position.y = -DIM.shin; kn.add(an); j['an' + s] = an;
    an.add(joint(0.03));
    const mFt = bodyMat();
    const foot = ellipsoid(0.045, 0.035, 0.115, mFt); foot.position.set(0, -0.05, 0.06);
    addSeg('foot' + s, an, foot, mFt);
  }
  return { root, j, seg };
}

// ------------------------------------------------------------------
// Pose
// ------------------------------------------------------------------

const ZERO3 = [0, 0, 0];
export function fillPose(p) {
  const v3 = (x) => (Array.isArray(x) ? [x[0] ?? 0, x[1] ?? 0, x[2] ?? 0] : null);
  const o = {
    rx: p.rx ?? 0, ry: p.ry ?? 0, rz: p.rz ?? 0, x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0,
    sp: v3(p.sp) || ZERO3, ch: v3(p.ch) || ZERO3, nk: v3(p.nk) || ZERO3,
  };
  for (const [s] of SIDES) {
    o['s' + s] = v3(p['s' + s]) || v3(p.s) || [0, 8, 0];
    o['e' + s] = p['e' + s] ?? p.e ?? 10;
    o['h' + s] = v3(p['h' + s]) || v3(p.h) || [0, 4, 0];
    o['k' + s] = p['k' + s] ?? p.k ?? 2;
    o['a' + s] = p['a' + s] ?? p.a ?? 0;
    o['f' + s] = (p['f' + s] ?? p.f ?? true) ? 1 : 0;
  }
  return o;
}

function lerpPose(a, b, t) {
  const o = {};
  for (const k in a) {
    if (Array.isArray(a[k])) o[k] = a[k].map((v, i) => v + (b[k][i] - v) * t);
    else if (k[0] === 'f') o[k] = t < 0.5 ? a[k] : b[k];
    else o[k] = a[k] + (b[k] - a[k]) * t;
  }
  return o;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _box = new THREE.Box3();

function applyPose(rig, P, tpl) {
  const { j } = rig;
  j.root.rotation.set(P.rx * D2R, P.ry * D2R, P.rz * D2R);
  j.root.position.set(0, 0, 0);
  const setT = (g, a) => g.rotation.set(a[0] * D2R, a[2] * D2R, -a[1] * D2R);
  setT(j.spine, P.sp); setT(j.chest, P.ch); setT(j.neck, P.nk);
  for (const [s, sg] of SIDES) {
    const S = P['s' + s], H = P['h' + s];
    j['sh' + s].rotation.set(-S[0] * D2R, sg * S[2] * D2R, sg * S[1] * D2R);
    j['el' + s].rotation.x = -P['e' + s] * D2R;
    j['hip' + s].rotation.set(-H[0] * D2R, sg * H[2] * D2R, sg * H[1] * D2R);
    j['kn' + s].rotation.x = P['k' + s] * D2R;
    const flat = P['f' + s] ? -(j.root.rotation.x + j['hip' + s].rotation.x + j['kn' + s].rotation.x) : 0;
    j['an' + s].rotation.x = flat + P['a' + s] * D2R;
  }
  j.root.updateMatrixWorld(true);

  // ancoraggio orizzontale
  const anchor = tpl.anchor || 'feet';
  const pt = (name) => {
    if (name === 'feet') return j.anL.getWorldPosition(_v).add(j.anR.getWorldPosition(_w)).multiplyScalar(0.5);
    if (name === 'hands') return j.wrL.getWorldPosition(_v).add(j.wrR.getWorldPosition(_w)).multiplyScalar(0.5);
    if (name === 'footL') return j.anL.getWorldPosition(_v);
    if (name === 'footR') return j.anR.getWorldPosition(_v);
    return null;
  };
  const a = pt(anchor);
  if (a) { j.root.position.x -= a.x; j.root.position.z -= a.z; }

  // appoggio a terra (o su un supporto)
  const names = tpl.ground || null;
  _box.makeEmpty();
  if (names) for (const n of names) _box.expandByObject(rig.seg[n].obj, true);
  else for (const n in rig.seg) _box.expandByObject(rig.seg[n].obj, true);
  j.root.position.y += (tpl.groundY ?? 0) - _box.min.y;

  j.root.position.x += P.x; j.root.position.y += P.y; j.root.position.z += P.z;
  j.root.updateMatrixWorld(true);
}

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// ------------------------------------------------------------------
// Attrezzi e ambiente
// ------------------------------------------------------------------

const holoMat = () => new THREE.MeshBasicMaterial({ color: C.prop, transparent: true, opacity: 0.12, depthWrite: false });
const edgeMat = () => new THREE.LineBasicMaterial({ color: C.prop, transparent: true, opacity: 0.85 });
const metalMat = new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.9, roughness: 0.3, emissive: '#1b3a40' });

function holoBox(w, h, d) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, holoMat()));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat()));
  return g;
}
function dumbbell(len = 0.3) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 10), metalMat);
  g.add(bar);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 6), metalMat);
    w.position.y = s * (len / 2 - 0.04);
    g.add(w);
  }
  return g;
}
function barbell() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.7, 10), metalMat);
  bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), new THREE.MeshBasicMaterial({ color: C.prop, transparent: true, opacity: 0.35 }));
    w.rotation.z = Math.PI / 2; w.position.x = s * 0.7; g.add(w);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24)), edgeMat());
    e.rotation.z = Math.PI / 2; e.position.x = s * 0.7; g.add(e);
  }
  return g;
}
function bandLine() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C.hl, transparent: true, opacity: 0.9 }));
}

function makePlatform() {
  const g = new THREE.Group();
  const grid = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, col: { value: C.rim } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform float time; uniform vec3 col; varying vec2 vP;
        void main(){
          float r = length(vP);
          vec2 g = abs(fract(vP*5.0)-0.5);
          float line = 1.0 - smoothstep(0.0, 0.04, min(g.x, g.y));
          float ring = 1.0 - smoothstep(0.0, 0.012, abs(r - 1.45));
          float wave = 1.0 - smoothstep(0.0, 0.06, abs(r - mod(time*0.45, 1.6)));
          float fade = 1.0 - smoothstep(0.6, 1.6, r);
          float a = line*0.22*fade + ring*0.8 + wave*0.25*fade;
          gl_FragColor = vec4(col, a);
        }`,
    }),
  );
  grid.rotation.x = -Math.PI / 2;
  g.add(grid);
  return { group: g, mat: grid.material };
}

function makeShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002;
  return m;
}

function makeParticles() {
  const n = 70;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.4;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 2.4; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: C.rim, size: 0.012, transparent: true, opacity: 0.6, depthWrite: false }));
}

// ------------------------------------------------------------------
// Visualizzatore
// ------------------------------------------------------------------

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export function createViewer(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', 0.6));
  const dl = new THREE.DirectionalLight('#ffffff', 1.4); dl.position.set(2, 4, 3); scene.add(dl);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

  const rig = buildRig();
  scene.add(rig.root);
  const platform = makePlatform(); scene.add(platform.group);
  const shadow = makeShadow(); scene.add(shadow);
  const particles = makeParticles(); scene.add(particles);
  const propsGroup = new THREE.Group(); scene.add(propsGroup);

  let tpl = null, frames = [], dynamics = [], attached = [];
  let total = 0, clock = 0, speed = opts.speed || 1, playing = true, raf = 0;
  let target = new THREE.Vector3(0, 0.9, 0), dist = 4, az = 35, el = 12, baseAz = 35;
  let dragging = false, lastX = 0, lastY = 0, lastInteract = -10;
  const hlTarget = {};

  function clearProps() {
    for (const o of attached) o.parent?.remove(o);
    attached = []; dynamics = [];
    while (propsGroup.children.length) propsGroup.remove(propsGroup.children[0]);
  }

  function poseAt(time) {
    let t = time % total;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (t < f.hold) return f.pose;
      t -= f.hold;
      if (t < f.t) return lerpPose(f.pose, frames[(i + 1) % frames.length].pose, ease(t / f.t));
      t -= f.t;
    }
    return frames[0].pose;
  }

  function worldOf(name) {
    const { j, seg } = rig;
    const map = { hands: null, feet: null, pelvis: j.root, chest: seg.chest.obj, ankleL: j.anL, ankleR: j.anR, wristL: j.wrL, wristR: j.wrR, kneeL: j.knL, kneeR: j.knR };
    if (name === 'hands') return j.wrL.getWorldPosition(new THREE.Vector3()).add(j.wrR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    if (name === 'feet') return j.anL.getWorldPosition(new THREE.Vector3()).add(j.anR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    return map[name].getWorldPosition(new THREE.Vector3());
  }

  function buildProps() {
    clearProps();
    for (const pr of tpl.props || []) {
      const p = typeof pr === 'string' ? { type: pr } : pr;
      if (p.type === 'db2') {
        for (const s of ['L', 'R']) { const d = dumbbell(); d.rotation.z = Math.PI / 2; d.position.y = -0.055; rig.j['wr' + s].add(d); attached.push(d); }
      } else if (p.type === 'db1L') {
        const d = dumbbell(); d.rotation.z = Math.PI / 2; d.position.y = -0.055; rig.j.wrL.add(d); attached.push(d);
      } else if (p.type === 'dbChest') {
        const d = dumbbell(0.34); propsGroup.add(d);
        dynamics.push(() => { d.position.copy(worldOf('hands')); d.position.y -= 0.02; });
      } else if (p.type === 'dbPelvis') {
        const d = dumbbell(0.34); d.rotation.z = Math.PI / 2; d.position.set(0, 0.1, 0.08); rig.j.root.add(d); attached.push(d);
      } else if (p.type === 'barHands') {
        const b = p.plain ? new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 10), metalMat) : barbell();
        if (p.plain) b.rotation.z = Math.PI / 2;
        propsGroup.add(b);
        dynamics.push(() => { b.position.copy(worldOf('hands')); b.position.y -= 0.05; });
      } else if (p.type === 'barBack') {
        const b = barbell(); b.position.set(0, 0.25, -0.1); rig.j.chest.add(b); attached.push(b);
      } else if (p.type === 'band') {
        for (const s of ['L', 'R']) {
          const line = bandLine(); propsGroup.add(line);
          const to = p.to;
          dynamics.push(() => {
            const a = rig.j['wr' + s].getWorldPosition(new THREE.Vector3());
            const b = to === 'feet' ? rig.j['an' + s].getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(...to);
            const arr = line.geometry.attributes.position.array;
            arr.set([a.x, a.y - 0.04, a.z, b.x, b.y, b.z]);
            line.geometry.attributes.position.needsUpdate = true;
          });
        }
      } else if (p.type === 'bandKnees') {
        const line = bandLine(); propsGroup.add(line);
        dynamics.push(() => {
          const a = rig.j.knL.getWorldPosition(new THREE.Vector3()), b = rig.j.knR.getWorldPosition(new THREE.Vector3());
          line.geometry.attributes.position.array.set([a.x, a.y + 0.05, a.z, b.x, b.y + 0.05, b.z]);
          line.geometry.attributes.position.needsUpdate = true;
        });
      }
    }
    // attrezzi statici posizionati sulla pose di riferimento
    for (const pr of tpl.props || []) {
      if (typeof pr === 'string' || !['box', 'wall', 'bar', 'bike', 'water', 'rail', 'wallX'].includes(pr.type)) continue;
      applyPose(rig, frames[pr.kf || 0].pose, tpl);
      const at = pr.at ? worldOf(pr.at) : new THREE.Vector3();
      if (pr.type === 'box') {
        const top = pr.top !== undefined && pr.abs ? pr.top : at.y + (pr.top ?? 0);
        const h = Math.max(0.05, top);
        const b = holoBox(pr.w || 0.5, h, pr.d || 0.45);
        b.position.set(at.x + (pr.dx || 0), h / 2, at.z + (pr.dz || 0));
        propsGroup.add(b);
      } else if (pr.type === 'wall') {
        const b = holoBox(1.6, 2.2, 0.04);
        b.position.set(0, 1.1, at.z + (pr.dz || 0));
        propsGroup.add(b);
      } else if (pr.type === 'wallX') {
        const b = holoBox(0.04, 2.2, 1.4);
        b.position.set(at.x + (pr.dx || 0), 1.1, at.z);
        propsGroup.add(b);
      } else if (pr.type === 'bar') {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 10), metalMat);
        b.rotation.z = Math.PI / 2; b.position.set(at.x, at.y + (pr.dy || 0), at.z);
        propsGroup.add(b);
      } else if (pr.type === 'bike') {
        const g = new THREE.Group();
        const seat = holoBox(0.22, 0.05, 0.28); seat.position.set(0, at.y - 0.12, at.z); g.add(seat);
        const post = holoBox(0.05, at.y - 0.15, 0.05); post.position.set(0, (at.y - 0.15) / 2, at.z + 0.05); g.add(post);
        for (const z of [-0.45, 0.75]) {
          const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: C.prop }));
          w.rotation.y = Math.PI / 2; w.position.set(0, 0.33, at.z + z); g.add(w);
        }
        const bar = holoBox(0.5, 0.04, 0.04); bar.position.set(0, at.y + 0.18, at.z + 0.62); g.add(bar);
        const crank = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: C.hl }));
        crank.rotation.y = Math.PI / 2; crank.position.set(0, at.y - 0.62, at.z + 0.18); g.add(crank);
        propsGroup.add(g);
      } else if (pr.type === 'water') {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#1aa8ff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
        w.rotation.x = -Math.PI / 2; w.position.y = pr.y ?? 0.5; w.userData.noFit = true; propsGroup.add(w);
      } else if (pr.type === 'rail') {
        const r = holoBox(0.12, 0.08, 1.9); r.position.set(0, 0.04, at.z + (pr.dz || 0)); propsGroup.add(r);
      }
    }
  }

  function fitCamera() {
    const box = new THREE.Box3();
    for (const f of frames) { applyPose(rig, f.pose, tpl); box.expandByObject(rig.root); }
    for (const o of propsGroup.children) if (!o.userData.noFit) box.expandByObject(o);
    box.min.y = Math.min(box.min.y, 0);
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(target);
    const radius = Math.max(size.y * 0.62, Math.hypot(size.x, size.z) * 0.5, 0.75);
    dist = radius / Math.sin((camera.fov / 2) * D2R) * 0.92;
    target.y = Math.max(target.y, 0.45);
  }

  function setMotion(exId, muscles = []) {
    const m = motionFor(exId);
    tpl = m;
    frames = m.kf.map((f) => ({ pose: fillPose(f.p), t: f.t ?? 0.8, hold: f.hold ?? 0 }));
    total = frames.reduce((a, f) => a + f.t + f.hold, 0) || 1;
    clock = 0;
    baseAz = m.az ?? 35; az = baseAz; el = m.el ?? 12;
    buildProps();
    fitCamera();
    // muscoli evidenziati
    for (const k in rig.seg) hlTarget[k] = 0;
    for (const mu of muscles) for (const sg of MUSCLE_SEGMENTS[mu] || []) for (const s of ['', 'L', 'R']) if (rig.seg[sg + s]) hlTarget[sg + s] = 1;
    for (const k in rig.seg) rig.seg[k].mat.uniforms.hl.value = hlTarget[k];
  }

  function resize() {
    const w = container.clientWidth || 300, h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  let last = performance.now();
  let globalTime = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    globalTime += dt;
    if (playing) clock += dt * speed;
    if (!tpl) return;
    const P = poseAt(clock);
    applyPose(rig, P, tpl);
    for (const d of dynamics) d();
    for (const k in rig.seg) rig.seg[k].mat.uniforms.time.value = globalTime;
    platform.mat.uniforms.time.value = globalTime;
    particles.rotation.y = globalTime * 0.05;
    shadow.position.x = rig.j.root.position.x; shadow.position.z = rig.j.root.position.z;
    const hgt = Math.max(0, rig.j.root.position.y);
    shadow.scale.setScalar(1.1 + hgt * 0.3);
    shadow.material.opacity = Math.max(0.25, 1 - hgt * 0.4);

    if (!dragging && globalTime - lastInteract > 3) az += ((baseAz + Math.sin(globalTime * 0.25) * 14) - az) * 0.02;
    const a = az * D2R, e = el * D2R;
    camera.position.set(target.x + Math.sin(a) * Math.cos(e) * dist, target.y + Math.sin(e) * dist, target.z + Math.cos(a) * Math.cos(e) * dist);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const el$ = renderer.domElement;
  const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; el$.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!dragging) return;
    az -= (e.clientX - lastX) * 0.45; el = Math.max(-5, Math.min(65, el + (e.clientY - lastY) * 0.25));
    lastX = e.clientX; lastY = e.clientY; lastInteract = globalTime;
  };
  const up = () => { dragging = false; lastInteract = globalTime; };
  el$.addEventListener('pointerdown', down);
  el$.addEventListener('pointermove', move);
  el$.addEventListener('pointerup', up);
  el$.addEventListener('pointercancel', up);

  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);

  if (opts.exercise) setMotion(opts.exercise, opts.muscles);

  return {
    setMotion,
    setSpeed(s) { speed = s; },
    get speed() { return speed; },
    toggle() { playing = !playing; return playing; },
    view(name) { if (name === 'front') { baseAz = 0; el = 10; } if (name === 'side') { baseAz = 90; el = 8; } if (name === 'top') { el = 55; } az = baseAz; lastInteract = globalTime; },
    // per test: congela il tempo a una frazione del ciclo
    snapshot(frac) { playing = false; clock = total * frac; },
    dispose() {
      cancelAnimationFrame(raf); raf = 0;
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); });
      el$.remove();
    },
  };
}

export { MOTIONS };
