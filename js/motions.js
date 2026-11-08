// Libreria di movimenti per il manichino 3D.
// Angoli in gradi. Convenzioni (vista dal soggetto):
//   rx/ry/rz  rotazione del corpo intero (rx > 0 = busto in avanti, 90 = prono, -90 = supino)
//   sp/ch/nk  [flessione in avanti, inclinazione laterale, torsione] di colonna, torace, collo
//   s         spalla [flessione (braccio avanti/su), abduzione (di lato), rotazione esterna]
//   e         gomito (flessione)
//   h         anca [flessione (coscia avanti), abduzione, rotazione esterna]
//   k         ginocchio (flessione)
//   a         caviglia (punta verso il basso)
//   f         piede appoggiato in piano (true/false)
// Con suffisso L/R si indica un solo lato, senza suffisso entrambi.
// Ogni fotogramma: { p: pose, t: secondi per passare al successivo, hold: pausa }

const ST = { s: [0, 8, 0], e: 10, h: [0, 4, 0], k: 2 };
const K = (p, t = 0.8, hold = 0) => ({ p, t, hold });
const P = (...o) => Object.assign({}, ...o);

const QUAD = { rx: 90, h: [90, 6, 0], k: 90, s: [90, 6, 0], e: 0, f: false, a: 70 };
const SUPINE_KNEES = { rx: -90, h: [55, 8, 0], k: 110, s: [0, 12, 0], e: 0 };
const SEATED = { h: [90, 8, 0], k: 90 };

// mirror di una pose: scambia lato sinistro e destro
function mirror(p) {
  const o = { ...p };
  for (const k of ['s', 'e', 'h', 'k', 'a', 'f']) {
    const l = p[k + 'L'], r = p[k + 'R'];
    if (l !== undefined || r !== undefined) { o[k + 'L'] = r; o[k + 'R'] = l; }
    if (o[k + 'L'] === undefined) delete o[k + 'L'];
    if (o[k + 'R'] === undefined) delete o[k + 'R'];
  }
  for (const k of ['sp', 'ch', 'nk']) if (p[k]) o[k] = [p[k][0], -(p[k][1] || 0), -(p[k][2] || 0)];
  if (p.rz) o.rz = -p.rz;
  return o;
}

// passo di camminata/corsa
function gait({ hip = 25, back = 15, knee = 50, arm = 25, elbow = 20, lean = 3, lift = 0, t = 0.36, extra = {} }) {
  const A = P(extra, { rx: lean, hL: [hip, 5], kL: 6, hR: [-back, 5], kR: 18, sL: [-arm, 9], sR: [arm, 9], e: elbow });
  const B = P(extra, { rx: lean, hL: [0, 5], kL: 10, hR: [hip * 0.7, 5], kR: knee, sL: [0, 9], sR: [0, 9], e: elbow, y: lift });
  return [K(A, t), K(B, t), K(mirror(A), t), K(mirror(B), t)];
}

export const MOTIONS = {
  // ---------------- SQUAT ----------------
  squat: { kf: [K(ST, 0.9, 0.2), K({ rx: 30, sp: [10], h: [115, 14], k: 115, s: [115, 8], e: 5 }, 0.9, 0.25)] },
  halfsquat: { kf: [K(ST, 0.8, 0.1), K({ rx: 18, sp: [5], h: [65, 10], k: 65, s: [95, 8], e: 5 }, 0.8, 0.1)] },
  sitstand: {
    kf: [K(P(ST, { s: [10, 8] }), 1, 0.2), K({ rx: 32, sp: [5], h: [112, 8], k: 100, s: [105, 8], e: 5 }, 1, 0.3)],
    props: [{ type: 'box', at: 'pelvis', kf: 1, top: -0.1, w: 0.48, d: 0.45, dz: -0.08 }],
  },
  wallsit: {
    kf: [K({ h: [90, 8], k: 90, s: [0, 10], e: 10, ch: [-2] }, 1.8), K({ h: [90, 8], k: 90, s: [0, 10], e: 10, ch: [3] }, 1.8)],
    props: [{ type: 'wall', at: 'pelvis', kf: 0, dz: -0.14 }], az: 70,
  },
  goblet: {
    kf: [K({ h: [0, 6], k: 2, s: [20, 15], e: 140 }, 0.9, 0.2), K({ rx: 25, sp: [8], h: [110, 16], k: 115, s: [55, 15], e: 140 }, 0.9, 0.25)],
    props: ['dbChest'],
  },
  backsquat: {
    kf: [K({ h: [0, 7], k: 2, s: [-15, 72, 90], e: 112 }, 1, 0.2), K({ rx: 32, sp: [8], h: [112, 15], k: 112, s: [15, 72, 90], e: 112 }, 1, 0.3)],
    props: ['barBack'],
  },
  legpress: {
    kf: [K({ rx: -50, h: [65, 8], k: 15, s: [10, 25], e: 20 }, 1, 0.1), K({ rx: -50, h: [140, 10], k: 115, s: [10, 25], e: 20 }, 1, 0.2)],
    ground: ['pelvis'], groundY: 0.42, anchor: 'none', f: false, az: 75,
    props: [{ type: 'box', at: 'pelvis', kf: 0, top: -0.08, w: 0.5, d: 0.5 }],
  },
  // ---------------- ANCA ----------------
  rdl: { kf: [K(P(ST, { s: [0, 8], e: 0 }), 1, 0.2), K({ rx: 72, h: [82, 6], k: 20, s: [72, 8], e: 0 }, 1, 0.25)], props: ['db2'], az: 65 },
  rdlband: { kf: [K(P(ST, { s: [0, 8], e: 0 }), 1, 0.2), K({ rx: 70, h: [80, 6], k: 20, s: [70, 8], e: 0 }, 1, 0.25)], props: [{ type: 'band', to: 'feet' }], az: 65 },
  deadlift: { kf: [K(P(ST, { s: [0, 10], e: 0 }), 1.1, 0.2), K({ rx: 50, sp: [5], h: [100, 8], k: 70, s: [55, 10], e: 0 }, 1.1, 0.25)], props: ['barHands'], az: 65 },
  hingebw: { kf: [K({ s: [-15, 35], e: 110 }, 0.9, 0.1), K({ rx: 60, h: [68, 6], k: 15, s: [45, 35], e: 110 }, 0.9, 0.1)], az: 65 },
  bridge: { kf: [K(SUPINE_KNEES, 0.9, 0.2), K(P(SUPINE_KNEES, { rx: -120, nk: [28], h: [22, 8], k: 102 }), 0.9, 0.5)], az: 80, el: 15 },
  bridge1: {
    kf: [K(P(SUPINE_KNEES, { hR: [55, 8], kR: 0 }), 0.9, 0.2), K(P(SUPINE_KNEES, { rx: -120, nk: [28], hL: [22, 8], kL: 102, hR: [22, 8], kR: 0 }), 0.9, 0.5)],
    az: 80, el: 15,
  },
  hipthrust: {
    kf: [K(P(SUPINE_KNEES, { rx: -75, nk: [5] }), 0.9, 0.2), K(P(SUPINE_KNEES, { rx: -112, nk: [25], h: [15, 8], k: 95 }), 0.9, 0.5)],
    props: ['dbPelvis'], az: 80, el: 15,
  },
  superman: {
    kf: [K({ rx: 90, s: [170, 15], e: 0, h: [0, 6], k: 0, f: false, a: 40 }, 1, 0.2),
      K({ rx: 90, sp: [-10], ch: [-10], nk: [-15], s: [192, 15], e: 0, h: [-14, 6], k: 0, f: false, a: 40 }, 1, 0.8)],
    az: 80, el: 20,
  },
  // ---------------- AFFONDI ----------------
  lunge: {
    kf: [K(ST, 0.9, 0.15), K({ rx: 4, hL: [88, 4], kL: 90, hR: [-15, 4], kR: 88, fR: false, aR: -70, s: [0, 10], e: 10 }, 0.9, 0.25)],
    anchor: 'footL', az: 70,
  },
  lungedb: {
    kf: [K(P(ST, { e: 0 }), 0.9, 0.15), K({ rx: 4, hL: [88, 4], kL: 90, hR: [-15, 4], kR: 88, fR: false, aR: -70, s: [0, 10], e: 0 }, 0.9, 0.25)],
    anchor: 'footL', az: 70, props: ['db2'],
  },
  stepup: {
    kf: [K({ hL: [60, 4], kL: 80, hR: [-8, 4], kR: 5, s: [15, 10], e: 20, rx: 8 }, 1, 0.1),
      K({ hL: [0, 4], kL: 2, hR: [70, 4], kR: 95, sL: [30, 10], sR: [-20, 10], e: 30 }, 1, 0.25)],
    anchor: 'footL', ground: ['footL'], groundY: 0.24, az: 70,
    props: [{ type: 'box', at: 'ankleL', kf: 0, top: 0.24, abs: true, w: 0.5, d: 0.42, dz: 0.03 }],
  },
  laterallunge: {
    kf: [K(P(ST, { h: [0, 18] }), 0.9, 0.1), K({ rx: 30, sp: [5], hL: [85, 32], kL: 95, hR: [20, 32], kR: 0, s: [100, 8], e: 15 }, 0.9, 0.25)],
    az: 15,
  },
  bulgarian: {
    kf: [K({ rx: 5, hL: [25, 4], kL: 25, hR: [-35, 4], kR: 85, fR: false, aR: -25, s: [0, 10], e: 10 }, 1, 0.1),
      K({ rx: 12, hL: [92, 4], kL: 95, hR: [-20, 4], kR: 115, fR: false, aR: -25, s: [0, 10], e: 10 }, 1, 0.25)],
    anchor: 'footL', ground: ['footL'], az: 75,
    props: [{ type: 'box', at: 'ankleR', kf: 0, top: -0.03, w: 0.5, d: 0.4, dz: -0.08 }],
  },
  // ---------------- GLUTEI ----------------
  clamshell: {
    kf: [K({ rz: -90, h: [45, 0], k: 90, sL: [160, 10], eL: 120, sR: [15, 10], eR: 40 }, 0.8, 0.1),
      K({ rz: -90, hL: [45, 0], kL: 90, hR: [45, 45, 25], kR: 90, sL: [160, 10], eL: 120, sR: [15, 10], eR: 40 }, 0.8, 0.4)],
    az: 0, el: 25, anchor: 'none',
  },
  monster: {
    kf: [K({ rx: 15, h: [50, 10], k: 55, s: [60, 10], e: 70 }, 0.45), K({ rx: 15, hL: [50, 28], hR: [50, 10], k: 55, s: [60, 10], e: 70 }, 0.45),
      K({ rx: 15, h: [50, 10], k: 55, s: [60, 10], e: 70 }, 0.45), K({ rx: 15, hL: [50, 10], hR: [50, 28], k: 55, s: [60, 10], e: 70 }, 0.45)],
    props: ['bandKnees'], az: 10, anchor: 'none',
  },
  kick: { kf: [K(QUAD, 0.8, 0.1), K(P(QUAD, { hR: [-12, 6], kR: 85 }), 0.8, 0.35)], anchor: 'hands', az: 85, el: 18 },
  // ---------------- SPINTA ----------------
  pushup: {
    kf: [K({ rx: 70, s: [70, 10], e: 0, h: [0, 4], k: 0, f: false }, 0.9, 0.15), K({ rx: 84, s: [22, 22], e: 95, h: [0, 4], k: 0, f: false }, 0.9, 0.2)],
    az: 75, el: 15,
  },
  kneepushup: {
    kf: [K({ rx: 58, s: [58, 10], e: 0, h: [0, 4], k: 85, f: false, a: 40 }, 0.9, 0.15), K({ rx: 76, s: [18, 22], e: 95, h: [0, 4], k: 85, f: false, a: 40 }, 0.9, 0.2)],
    az: 75, el: 15,
  },
  incline: {
    kf: [K({ rx: 45, s: [45, 10], e: 0, f: false, a: 15 }, 0.9, 0.15), K({ rx: 58, s: [5, 22], e: 95, f: false, a: 15 }, 0.9, 0.2)],
    ground: ['footL', 'footR'], az: 75, el: 12,
    props: [{ type: 'box', at: 'hands', kf: 0, top: -0.06, w: 0.9, d: 0.4 }],
  },
  wallpush: {
    kf: [K({ rx: 16, s: [106, 10], e: 0, f: true }, 0.9, 0.15), K({ rx: 28, s: [70, 30], e: 100, f: true }, 0.9, 0.2)],
    ground: ['footL', 'footR'], az: 70, props: [{ type: 'wall', at: 'hands', kf: 0, dz: 0.08 }],
  },
  dips: {
    kf: [K({ h: [85, 6], k: 75, s: [-40, 12], e: 0 }, 1, 0.15), K({ h: [85, 6], k: 75, s: [-72, 12], e: 90 }, 1, 0.2)],
    ground: ['handL', 'handR'], groundY: 0.45, anchor: 'hands', az: 70,
    props: [{ type: 'box', at: 'hands', kf: 0, top: -0.05, w: 0.55, d: 0.42, dz: -0.15 }],
  },
  floorpress: {
    kf: [K(P(SUPINE_KNEES, { s: [0, 55, 0], e: 90 }), 0.9, 0.2), K(P(SUPINE_KNEES, { s: [90, 8, 0], e: 0 }), 0.9, 0.2)],
    props: ['db2'], az: 70, el: 25,
  },
  bench: {
    kf: [K({ rx: -90, h: [8, 18], k: 90, s: [0, 55, 0], e: 90 }, 1, 0.2), K({ rx: -90, h: [8, 18], k: 90, s: [90, 10, 0], e: 0 }, 1, 0.2)],
    ground: ['chest', 'pelvis'], groundY: 0.45, anchor: 'none', props: ['barHands', { type: 'box', at: 'chest', kf: 0, top: -0.13, w: 0.32, d: 1.15, dz: 0.25 }], az: 70, el: 22,
  },
  chestpress: {
    kf: [K({ s: [10, 78], e: 95 }, 0.9, 0.15), K({ s: [90, 10], e: 5 }, 0.9, 0.2)],
    props: [{ type: 'band', to: [0, 1.25, -0.6] }], az: 55,
  },
  chestmachine: {
    kf: [K(P(SEATED, { s: [10, 78], e: 95 }), 0.9, 0.15), K(P(SEATED, { s: [90, 10], e: 5 }), 0.9, 0.2)],
    ground: ['pelvis'], groundY: 0.48, props: [{ type: 'box', at: 'pelvis', kf: 0, top: -0.08, w: 0.5, d: 0.45 }], az: 55,
  },
  ohp: { kf: [K({ s: [0, 85, 90], e: 95 }, 0.9, 0.15), K({ s: [0, 168, 90], e: 5 }, 0.9, 0.2)], props: ['db2'], az: 25 },
  ohpband: { kf: [K({ s: [0, 85, 90], e: 95 }, 0.9, 0.15), K({ s: [0, 168, 90], e: 5 }, 0.9, 0.2)], props: [{ type: 'band', to: 'feet' }], az: 25 },
  lateral: { kf: [K({ s: [0, 10, 0], e: 15 }, 0.9, 0.1), K({ s: [5, 85, 0], e: 15 }, 0.9, 0.3)], props: ['db2'], az: 15 },
  pike: {
    kf: [K({ rx: 135, h: [100, 6], k: 0, s: [172, 12], e: 0, f: false, a: 10 }, 1, 0.15), K({ rx: 145, h: [100, 6], k: 0, s: [150, 25], e: 90, f: false, a: 10 }, 1, 0.2)],
    az: 82, el: 12,
  },
  wallslide: { kf: [K({ s: [0, 85, 90], e: 90 }, 1, 0.1), K({ s: [0, 160, 90], e: 20 }, 1, 0.2)], props: [{ type: 'wall', at: 'chest', kf: 0, dz: 0.35 }], az: 150, el: 10 },
  angels: { kf: [K({ s: [0, 85, 90], e: 90 }, 1, 0.1), K({ s: [0, 160, 90], e: 20 }, 1, 0.2)], props: [{ type: 'wall', at: 'chest', kf: 0, dz: -0.16 }], az: 25 },
  // ---------------- TIRATA ----------------
  rowdb: {
    kf: [K({ rx: 70, h: [80, 6], k: 20, sL: [70, 6], eL: 0, sR: [55, 12], eR: 25 }, 0.9, 0.1), K({ rx: 70, h: [80, 6], k: 20, sL: [5, 12], eL: 100, sR: [55, 12], eR: 25 }, 0.9, 0.35)],
    props: ['db1L'], az: 60,
  },
  rowband: { kf: [K({ s: [85, 8], e: 0 }, 0.9, 0.1), K({ s: [-15, 14], e: 100 }, 0.9, 0.35)], props: [{ type: 'band', to: [0, 1.2, 1.3] }], az: 70 },
  rowseated: {
    kf: [K({ rx: -5, h: [85, 8], k: 20, s: [85, 8], e: 0, f: false }, 0.9, 0.1), K({ rx: -14, h: [76, 8], k: 20, s: [-15, 14], e: 100, f: false }, 0.9, 0.35)],
    props: [{ type: 'band', to: [0, 0.5, 1.6] }], az: 70,
  },
  rowinv: {
    kf: [K({ rx: -64, s: [64, 10], e: 0, h: [0, 4], k: 0, f: false }, 0.9, 0.1), K({ rx: -64, s: [0, 25], e: 100, h: [0, 4], k: 0, f: false }, 0.9, 0.35)],
    ground: ['handL', 'handR'], groundY: 0.85, anchor: 'hands', az: 80,
    props: [{ type: 'bar', at: 'hands', kf: 0, dy: -0.03 }],
  },
  rowbar: { kf: [K({ rx: 50, h: [65, 6], k: 25, s: [50, 10], e: 0 }, 0.9, 0.1), K({ rx: 50, h: [65, 6], k: 25, s: [-10, 15], e: 100 }, 0.9, 0.3)], props: ['barHands'], az: 65 },
  ytw: {
    kf: [K({ rx: 90, s: [0, 88], e: 0, f: false, a: 40 }, 0.8, 0.1), K({ rx: 90, s: [-18, 88], e: 0, f: false, a: 40 }, 0.8, 0.4),
      K({ rx: 90, s: [0, 60], e: 90, f: false, a: 40 }, 0.8, 0.1), K({ rx: 90, s: [-18, 60], e: 90, f: false, a: 40 }, 0.8, 0.4)],
    az: 55, el: 30,
  },
  towel: { kf: [K({ s: [55, 12], e: 70 }, 1.4), K({ s: [40, 14], e: 90, sp: [-3] }, 1.4, 1)], props: [{ type: 'band', to: [0, 1.15, 0.85] }], az: 70 },
  latband: { kf: [K({ s: [0, 165, 0], e: 10 }, 0.9, 0.1), K({ s: [0, 45, 90], e: 115 }, 0.9, 0.35)], props: [{ type: 'band', to: [0, 2.4, 0.45] }], az: 25 },
  latmachine: {
    kf: [K(P(SEATED, { s: [0, 165, 0], e: 10 }), 0.9, 0.1), K(P(SEATED, { rx: -10, s: [0, 45, 90], e: 115 }), 0.9, 0.35)],
    ground: ['pelvis'], groundY: 0.48, props: [{ type: 'barHands', plain: true }, { type: 'box', at: 'pelvis', kf: 0, top: -0.08, w: 0.5, d: 0.45 }], az: 25,
  },
  pullup: {
    kf: [K({ s: [0, 168, 0], e: 5, h: [10, 4], k: 35 }, 1, 0.2), K({ s: [0, 40, 90], e: 130, h: [15, 4], k: 40 }, 1, 0.4)],
    ground: ['handL', 'handR'], groundY: 2.4, anchor: 'hands', f: false, a: 20,
    props: [{ type: 'bar', at: 'hands', kf: 0, dy: 0.0 }], az: 30,
  },
  negative: {
    kf: [K({ s: [0, 40, 90], e: 130, h: [15, 4], k: 40 }, 3.2, 0.5), K({ s: [0, 168, 0], e: 5, h: [10, 4], k: 35 }, 0.8, 0.6)],
    ground: ['handL', 'handR'], groundY: 2.4, anchor: 'hands', f: false, a: 20,
    props: [{ type: 'bar', at: 'hands', kf: 1, dy: 0.0 }], az: 30,
  },
  // ---------------- CORE ----------------
  birddog: { kf: [K(QUAD, 0.9, 0.1), K(P(QUAD, { sL: [178, 6], hR: [0, 6], kR: 0, aR: 30 }), 0.9, 0.6)], anchor: 'hands', az: 80, el: 18 },
  deadbug: {
    kf: [K({ rx: -90, s: [90, 8], e: 0, h: [90, 6], k: 90, f: false }, 0.9, 0.1), K({ rx: -90, sL: [172, 8], sR: [90, 8], e: 0, hL: [90, 6], kL: 90, hR: [12, 6], kR: 0, f: false }, 0.9, 0.4)],
    az: 75, el: 20,
  },
  plank: { kf: [K({ rx: 78, s: [78, 10], e: 90, h: [0, 4], k: 0, f: false }, 1.6), K({ rx: 77, sp: [2], s: [77, 10], e: 90, h: [0, 4], k: 0, f: false }, 1.6)], az: 78, el: 15 },
  kneeplank: { kf: [K({ rx: 72, s: [72, 10], e: 90, h: [0, 4], k: 85, f: false, a: 40 }, 1.6), K({ rx: 71, sp: [2], s: [71, 10], e: 90, h: [0, 4], k: 85, f: false, a: 40 }, 1.6)], az: 78, el: 15 },
  sideplank: {
    kf: [K({ rz: -72, sL: [0, 72], eL: 90, sR: [0, 12], eR: 10, h: [0, 0], k: 0, f: false }, 1.6), K({ rz: -74, sL: [0, 74], eL: 90, sR: [0, 12], eR: 10, h: [0, 0], k: 0, f: false }, 1.6)],
    az: 0, el: 12, anchor: 'none',
  },
  pallof: {
    kf: [K({ rx: 5, h: [15, 12], k: 20, s: [25, 12], e: 120 }, 0.9, 0.1), K({ rx: 5, h: [15, 12], k: 20, s: [90, 6], e: 0 }, 0.9, 0.8)],
    props: [{ type: 'band', to: [1.1, 1.15, 0.1] }], az: 20,
  },
  farmer: { kf: gait({ hip: 22, back: 12, knee: 45, arm: 5, elbow: 0, extra: { s: [0, 12] } }), anchor: 'none', props: ['db2'], az: 40 },
  crunch: { kf: [K(P(SUPINE_KNEES, { s: [150, 45], e: 130, nk: [10] }), 0.8, 0.1), K(P(SUPINE_KNEES, { sp: [22], ch: [18], nk: [18], s: [150, 45], e: 130 }), 0.8, 0.3)], az: 75, el: 15 },
  hollow: {
    kf: [K({ rx: -90, sp: [10], ch: [10], nk: [15], s: [160, 10], e: 0, h: [25, 4], k: 0, f: false }, 1.4), K({ rx: -90, sp: [12], ch: [12], nk: [15], s: [158, 10], e: 0, h: [27, 4], k: 0, f: false }, 1.4)],
    az: 80, el: 15,
  },
  calf: { kf: [K(ST, 0.7, 0.1), K(P(ST, { a: 35 }), 0.7, 0.4)], az: 70 },
  // ---------------- CARDIO ----------------
  walk: { kf: gait({}), anchor: 'none', az: 50 },
  hillwalk: { kf: gait({ lean: 10, hip: 32, knee: 60 }), anchor: 'none', az: 60 },
  run: { kf: gait({ hip: 50, back: 22, knee: 105, arm: 45, elbow: 90, lean: 9, lift: 0.07, t: 0.22 }), anchor: 'none', az: 60 },
  march: {
    kf: [K({ hL: [70, 4], kL: 85, sL: [-25, 10], sR: [45, 10], e: 75 }, 0.42), K({ e: 75, s: [10, 10] }, 0.42),
      K({ hR: [70, 4], kR: 85, sR: [-25, 10], sL: [45, 10], e: 75 }, 0.42), K({ e: 75, s: [10, 10] }, 0.42)],
    az: 35,
  },
  bike: {
    kf: [
      K({ rx: 28, s: [75, 8], e: 20, hL: [100, 6], kL: 110, hR: [45, 6], kR: 40, f: false, a: 10 }, 0.25),
      K({ rx: 28, s: [75, 8], e: 20, hL: [80, 6], kL: 60, hR: [70, 6], kR: 100, f: false, a: 10 }, 0.25),
      K({ rx: 28, s: [75, 8], e: 20, hL: [45, 6], kL: 40, hR: [100, 6], kR: 110, f: false, a: 10 }, 0.25),
      K({ rx: 28, s: [75, 8], e: 20, hL: [70, 6], kL: 100, hR: [80, 6], kR: 60, f: false, a: 10 }, 0.25),
    ],
    ground: ['pelvis'], groundY: 0.92, anchor: 'none', props: [{ type: 'bike', at: 'pelvis', kf: 0 }], az: 80, el: 10,
  },
  elliptical: { kf: gait({ hip: 30, back: 15, knee: 40, arm: 35, elbow: 70, t: 0.45 }), anchor: 'none', az: 55 },
  rower: {
    kf: [K({ rx: 20, h: [150, 6], k: 135, s: [110, 8], e: 0, f: false, a: -10 }, 0.55, 0.05), K({ rx: -15, h: [75, 6], k: 3, s: [-25, 14], e: 110, f: false, a: 20 }, 1.1, 0.1)],
    ground: ['pelvis'], groundY: 0.26, props: [{ type: 'rail', at: 'pelvis', kf: 0, dz: 0.4 }], az: 80, el: 12,
  },
  swim: {
    kf: [
      K({ rx: 90, sL: [180, 12], sR: [0, 12], e: 0, hL: [10, 4], hR: [-10, 4], k: 10, f: false, a: 50 }, 0.35),
      K({ rx: 90, sL: [90, 12], sR: [-90, 12], e: 10, hL: [-10, 4], hR: [10, 4], k: 10, f: false, a: 50 }, 0.35),
      K({ rx: 90, sL: [0, 12], sR: [-180, 12], e: 0, hL: [10, 4], hR: [-10, 4], k: 10, f: false, a: 50 }, 0.35),
      K({ rx: 90, sL: [-90, 12], sR: [-270, 12], e: 10, hL: [-10, 4], hR: [10, 4], k: 10, f: false, a: 50 }, 0.35),
      K({ rx: 90, sL: [-180, 12], sR: [-360, 12], e: 0, hL: [10, 4], hR: [-10, 4], k: 10, f: false, a: 50 }, 0),
    ],
    ground: ['pelvis'], groundY: 0.45, anchor: 'none', props: [{ type: 'water', y: 0.52 }], az: 70, el: 25,
  },
  jumprope: {
    kf: [K({ k: 12, s: [10, 28], e: 75, a: 0 }, 0.18), K({ k: 5, s: [10, 28], e: 75, a: 30, y: 0.09 }, 0.18)],
    az: 30,
  },
  jj: {
    kf: [K(ST, 0.18), K(P(ST, { h: [0, 12], s: [0, 80], y: 0.1, a: 25 }), 0.18), K({ h: [0, 22], s: [0, 165], e: 10, k: 8 }, 0.18), K(P(ST, { h: [0, 12], s: [0, 80], y: 0.1, a: 25 }), 0.18)],
    az: 15,
  },
  // ---------------- RISCALDAMENTO / MOBILITÀ ----------------
  armcircles: { kf: [K({ s: [25, 85], e: 5 }, 0.3), K({ s: [0, 100], e: 5 }, 0.3), K({ s: [-25, 85], e: 5 }, 0.3), K({ s: [0, 70], e: 5 }, 0.3)], az: 20 },
  trunkrot: { kf: [K({ h: [0, 10], sp: [0, 0, 35], ch: [0, 0, 18], s: [0, 70], e: 60 }, 0.8), K({ h: [0, 10], sp: [0, 0, -35], ch: [0, 0, -18], s: [0, 70], e: 60 }, 0.8)], az: 10 },
  hipcircles: {
    kf: [K({ h: [0, 10], s: [-15, 35], e: 110, rz: 5, sp: [0, -6] }, 0.45), K({ h: [0, 10], s: [-15, 35], e: 110, rx: -6, sp: [6] }, 0.45),
      K({ h: [0, 10], s: [-15, 35], e: 110, rz: -5, sp: [0, 6] }, 0.45), K({ h: [0, 10], s: [-15, 35], e: 110, rx: 6, sp: [-6] }, 0.45)],
    az: 30,
  },
  catcow: { kf: [K(P(QUAD, { sp: [15], ch: [15], nk: [25] }), 1.3, 0.2), K(P(QUAD, { sp: [-12], ch: [-12], nk: [-22] }), 1.3, 0.2)], anchor: 'hands', az: 85, el: 15 },
  steptouch: { kf: [K({ hL: [5, 20], kL: 10, s: [0, 45], e: 40 }, 0.4), K({ s: [0, 15], e: 40 }, 0.4), K({ hR: [5, 20], kR: 10, s: [0, 45], e: 40 }, 0.4), K({ s: [0, 15], e: 40 }, 0.4)], az: 15 },
  lungerot: {
    kf: [K(ST, 0.9, 0.1), K({ rx: 4, hL: [88, 4], kL: 90, hR: [-15, 4], kR: 88, fR: false, aR: -70, ch: [0, 0, 40], sp: [0, 0, 15], s: [90, 20], e: 90 }, 0.9, 0.4)],
    anchor: 'footL', az: 40,
  },
  ankle: {
    kf: [K({ rx: 8, hL: [40, 4], kL: 40, hR: [-10, 4], kR: 5, s: [100, 10], e: 20 }, 0.9), K({ rx: 12, hL: [55, 4], kL: 75, hR: [-10, 4], kR: 10, s: [95, 10], e: 35 }, 0.9, 0.3)],
    anchor: 'footL', props: [{ type: 'wall', at: 'hands', kf: 0, dz: 0.05 }], az: 70,
  },
  hipflexor: {
    kf: [K({ hL: [85, 5], kL: 90, hR: [-8, 5], kR: 95, fR: false, aR: 75, s: [-20, 40], e: 100 }, 1.5, 0.2),
      K({ hL: [70, 5], kL: 105, hR: [-25, 5], kR: 95, fR: false, aR: 75, s: [-20, 40], e: 100, sp: [-5] }, 1.5, 1)],
    anchor: 'footL', az: 80,
  },
  hamstring: {
    kf: [K({ h: [90, 6], k: 0, hR: [95, 35, 45], kR: 120, s: [40, 10], e: 10, f: false, a: -10 }, 1.6, 0.2),
      K({ rx: 32, hL: [122, 6], kL: 0, hR: [125, 35, 45], kR: 120, s: [120, 10], e: 0, f: false, a: -10, sp: [10] }, 1.6, 1)],
    az: 75, el: 15,
  },
  quad: {
    kf: [K({ hL: [0, 4], kL: 3, hR: [-5, 4], kR: 140, sR: [-30, 15], eR: 30, sL: [0, 40], eL: 10 }, 1.4),
      K({ hL: [0, 4], kL: 3, hR: [-10, 4], kR: 150, sR: [-35, 15], eR: 35, sL: [0, 42], eL: 10 }, 1.4, 1)],
    anchor: 'footL', az: -80,
  },
  pec: {
    kf: [K({ sL: [0, 90, 90], eL: 90, sR: [0, 10], sp: [0, 0, -10] }, 1.4), K({ sL: [0, 90, 90], eL: 90, sR: [0, 10], sp: [0, 0, -28], ch: [0, 0, -12] }, 1.4, 1)],
    props: [{ type: 'wallX', at: 'wristL', kf: 0, dx: 0.06 }], az: -20,
  },
  calfwall: {
    kf: [K({ rx: 22, hL: [40, 4], kL: 45, hR: [-18, 4], kR: 0, s: [112, 10], e: 20 }, 1.4), K({ rx: 26, hL: [50, 4], kL: 60, hR: [-20, 4], kR: 0, s: [112, 10], e: 30 }, 1.4, 1)],
    anchor: 'footL', props: [{ type: 'wall', at: 'hands', kf: 0, dz: 0.06 }], az: 75,
  },
  neck: { kf: [K({ nk: [0, 25, 0] }, 1.2, 0.4), K({ nk: [20, 0, 0] }, 1.2, 0.3), K({ nk: [0, -25, 0] }, 1.2, 0.4), K({ nk: [0, 0, 0] }, 1.2)], az: 20 },
  child: {
    kf: [K({ rx: 118, h: [178, 10], k: 150, s: [172, 10], e: 0, f: false, a: 60, nk: [5] }, 2), K({ rx: 116, h: [176, 10], k: 150, s: [170, 10], e: 0, f: false, a: 60, nk: [5], sp: [-3] }, 2)],
    az: 80, el: 15,
  },
  openbook: {
    kf: [K({ rz: -90, h: [90, 0], k: 90, s: [90, 4], e: 0 }, 1.3, 0.2), K({ rz: -90, h: [90, 0], k: 90, sL: [90, 4], sR: [90, 95], e: 0, ch: [0, 0, -35], sp: [0, 0, -15], nk: [0, 0, -30] }, 1.3, 0.8)],
    anchor: 'none', az: -10, el: 40,
  },
  ninety: {
    kf: [K({ hL: [80, 40, 50], kL: 95, hR: [70, 50, -40], kR: 95, s: [20, 25], e: 30 }, 1.3, 0.3), K({ hL: [70, 50, -40], kL: 95, hR: [80, 40, 50], kR: 95, s: [20, 25], e: 30 }, 1.3, 0.3)],
    az: 20, el: 30,
  },
  figure4: {
    kf: [K({ rx: -90, hR: [80, 5], kR: 90, hL: [75, 40, 60], kL: 100, s: [40, 25], e: 70 }, 1.4), K({ rx: -90, hR: [100, 5], kR: 95, hL: [95, 40, 60], kL: 105, s: [55, 25], e: 80 }, 1.4, 1)],
    az: 60, el: 30,
  },
  cobra: {
    kf: [K({ rx: 90, s: [100, 18], e: 100, h: [0, 6], k: 0, f: false, a: 60 }, 1.3, 0.2), K({ rx: 90, sp: [-18], ch: [-15], nk: [-10], s: [112, 18], e: 75, h: [0, 6], k: 0, f: false, a: 60 }, 1.3, 1)],
    az: 80, el: 15,
  },
  breathe: {
    kf: [K({ h: [85, 45, 70], k: 140, s: [30, 15], e: 40, ch: [-2], f: false }, 2.2, 0.3), K({ h: [85, 45, 70], k: 140, s: [30, 15], e: 40, ch: [4], nk: [-3], f: false }, 2.8, 0.3)],
    az: 25, el: 15,
  },
  balance: { kf: [K({ hR: [70, 6], kR: 90, s: [0, 35], e: 10, rz: 1.5 }, 1.2), K({ hR: [70, 6], kR: 90, s: [0, 38], e: 10, rz: -1.5 }, 1.2)], anchor: 'footL', az: 30 },
  tandem: { kf: gait({ hip: 18, back: 10, knee: 35, arm: 6, t: 0.6, extra: { s: [0, 35], h: [0, -2] } }), anchor: 'none', az: 50 },
};

// esercizio → movimento (+ attrezzi extra)
const MAP = {
  w_marcia: 'march', w_braccia: 'armcircles', w_busto: 'trunkrot', w_anche: 'hipcircles', w_gatto: 'catcow', w_step: 'steptouch',
  w_jj: 'jj', w_squatmob: 'halfsquat', w_affrot: 'lungerot', w_caviglie: 'ankle', w_angeli: 'angels', w_hinge: 'hingebw',
  s_sitstand: 'sitstand', s_squat: 'squat', s_squat_talloni: 'squat', s_squat_el: ['squat', [{ type: 'band', to: 'feet' }]], s_legpress: 'legpress', s_goblet: 'goblet',
  s_wallsit: 'wallsit', s_backsquat: 'backsquat',
  h_ponte: 'bridge', h_ponte1: 'bridge1', h_hipthrust: 'hipthrust', h_rdl_el: 'rdlband', h_rdl: 'rdl', h_superman: 'superman', h_stacco: 'deadlift',
  l_step: 'stepup', l_affind: 'lunge', l_laterale: 'laterallunge', l_affman: 'lungedb', l_bulgaro: 'bulgarian',
  g_clam: 'clamshell', g_abd_el: 'monster', g_kick: 'kick',
  p_muro: 'wallpush', p_ginocchia: 'kneepushup', p_rialzo: 'incline', p_el: 'chestpress', p_floor: 'floorpress', p_machine: 'chestmachine', p_classici: 'pushup',
  p_panca_man: ['floorpress', []], p_dip: 'dips', p_panca: 'bench',
  v_wallslide: 'wallslide', v_el: 'ohpband', v_alzate: 'lateral', v_lento: 'ohp', v_pike: 'pike',
  r_towel: 'towel', r_ytw: 'ytw', r_el: 'rowband', r_man: 'rowdb', r_pulley: 'rowseated', r_tavolo: 'rowinv', r_bil: 'rowbar',
  t_lat_el: 'latband', t_lat: 'latmachine', t_neg: 'negative', t_trazioni: 'pullup',
  c_birddog: 'birddog', c_curlup: 'crunch', c_deadbug: 'deadbug', c_plank_g: 'kneeplank', c_pallof: 'pallof', c_farmer: 'farmer', c_plank: 'plank',
  c_side: 'sideplank', c_crunch: 'crunch', c_hollow: 'hollow',
  k_calf: 'calf',
  x_cammino: 'walk', x_basso: 'march', x_salita: 'hillwalk', x_bici: 'bike', x_ellittica: 'elliptical', x_nuoto: 'swim',
  x_vogatore: 'rower', x_corsa: 'run', x_corda: 'jumprope',
  m_flessori: 'hipflexor', m_femorali: 'hamstring', m_quad: 'quad', m_pett: 'pec', m_polpacci: 'calfwall', m_collo: 'neck',
  m_gatto: 'catcow', m_bambino: 'child', m_openbook: 'openbook', m_9090: 'ninety', m_figura4: 'figure4', m_cobra: 'cobra', m_respiro: 'breathe',
  b_unagamba: 'balance', b_tandem: 'tandem',
};

export function motionFor(exId) {
  const m = MAP[exId] || 'walk';
  const [name, extra] = Array.isArray(m) ? m : [m, null];
  const base = MOTIONS[name];
  return extra ? { ...base, props: [...(base.props || []), ...extra] } : base;
}

export const MOTION_MAP = MAP;

// muscoli → segmenti del manichino da evidenziare
export const MUSCLE_SEGMENTS = {
  quadricipiti: ['thigh'], femorali: ['thigh'], glutei: ['pelvis'], adduttori: ['thigh'], abduttori: ['pelvis'],
  polpacci: ['shin'], tibiali: ['shin'], flessori_anca: ['pelvis', 'thigh'],
  core: ['abs'], addominali: ['abs'], obliqui: ['abs'], lombari: ['abs'],
  pettorali: ['chest'], dorsali: ['chest'], trapezio: ['chest'], romboidi: ['chest'],
  deltoidi: ['shoulder', 'upperArm'], cuffia: ['shoulder'], bicipiti: ['upperArm'], tricipiti: ['upperArm'], avambracci: ['foreArm', 'hand'],
  collo: ['head'], cuore: ['chest', 'thigh', 'shin'], caviglie: ['foot', 'shin'],
};
