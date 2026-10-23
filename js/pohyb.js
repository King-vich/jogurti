// Pohyb hráčů štafety (stafeta.js):
// plynulé pózy z klíčových snímků, sevření prstů a disk v dlani podle úchopu.

import * as THREE from 'three';

const omez = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const plynule = (t) => t * t * (3 - 2 * t);
export const smichej = (a, b, t) => a + (b - a) * t;
export { omez };

// ---------------------------------------------------------- póza z klíčových snímků
// Každá hodnota (úhel kosti, natočení kořene…) je plynulá křivka přes všechny klíče
// (Hermitův spline). Tělo tak klíčovými pózami „protéká“ a nezastavuje se v nich.
// V krajních bodech pohybu (obrat nápřahu) je rychlost nulová, takže křivka nepřestřelí.
const VYCHOZI_KOREN = { yaw: 0, pitch: 0, zdvih: 0, posun: 0, bok: 0, x: 0, diskX: 0.3, diskZ: 0.15, pohled: 1 };
const stopy = new WeakMap();

function pripravStopy(klice) {
  const casy = klice.map((kl) => kl[0]);
  const kosti = new Set(klice.flatMap((kl) => Object.keys(kl[1])));
  const kanaly = [];
  for (const kost of kosti) {
    for (let j = 0; j < 3; j++) kanaly.push({ kost, j, h: klice.map((kl) => kl[1][kost]?.[j] || 0) });
  }
  for (const klic of Object.keys(VYCHOZI_KOREN)) {
    kanaly.push({ koren: klic, h: klice.map((kl) => kl[2][klic] ?? VYCHOZI_KOREN[klic]) });
  }
  return { casy, kanaly };
}

function krivka(casy, h, u) {
  const n = casy.length - 1;
  if (u <= casy[0] || n === 0) return h[0];
  if (u >= casy[n]) return h[n];
  let i = 0;
  while (casy[i + 1] < u) i++;
  const tecna = (j) => {
    if (j <= 0 || j >= n) return 0;
    const pred = h[j] - h[j - 1];
    const za = h[j + 1] - h[j];
    if (pred * za <= 0) return 0;                       // obrat pohybu
    return (h[j + 1] - h[j - 1]) / (casy[j + 1] - casy[j - 1]);
  };
  const d = casy[i + 1] - casy[i];
  const s = (u - casy[i]) / d;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * h[i] + (s3 - 2 * s2 + s) * d * tecna(i)
    + (-2 * s3 + 3 * s2) * h[i + 1] + (s3 - s2) * d * tecna(i + 1);
}

export function poza(klice, u) {
  if (!stopy.has(klice)) stopy.set(klice, pripravStopy(klice));
  const { casy, kanaly } = stopy.get(klice);
  const uhly = {};
  const koren = {};
  for (const kanal of kanaly) {
    const v = krivka(casy, kanal.h, u);
    if (kanal.koren) koren[kanal.koren] = v;
    else (uhly[kanal.kost] ||= [0, 0, 0])[kanal.j] = v;
  }
  return { uhly, koren };
}

// sevření prstů: 1 = kolem okraje disku, ~0,35 = uvolněná ruka, záporné = roztažené k chytání
export function uhlyPrstu(u, strana) {
  return {
    [`prst1_${strana}`]: [1.05 * u, 0, 0],
    [`prst2_${strana}`]: [Math.max(0, u) * 1.0 + Math.min(0, u) * 0.3, 0, 0],
    [`palec1_${strana}`]: [0.32 * u, 0, 0],
    [`palec2_${strana}`]: [0.35 * Math.max(0, u), 0, 0],
  };
}

// ---------------------------------------------------------- disk v dlani
// Úchopy v souřadnicích kosti dlaně (z Blenderu/Rigify): +Y = od zápěstí ke kloubům,
// −X = dlaň, +Z = strana palce. Každý úchop říká, kde je okraj disku sevřený (bod),
// kam míří vršek disku (nahoru) a kterým směrem od úchopu leží jeho střed (kStredu).
const DEFINICE_UCHOPU = {
  // backhand (power grip): palec nahoře na disku, čtyři prsty sevřené pod okrajem
  backhand: { bod: [-0.018, 0.105, 0.012], nahoru: [0, 0, 1], kStredu: [-1, 0.15, 0] },
  // forehand a hammer: dlaň vzhůru, prostředníček zespodu uvnitř okraje, palec nahoře
  forehand: { bod: [-0.02, 0.1, 0.01], nahoru: [0, 0, 1], kStredu: [-0.55, 0.85, 0] },
  // scoober: obrácený úchop, disk vzhůru nohama, palec pod diskem
  scoober: { bod: [-0.018, 0.105, -0.008], nahoru: [0, 0, -1], kStredu: [-1, 0.2, 0] },
};
DEFINICE_UCHOPU.hammer = DEFINICE_UCHOPU.forehand;

/** Matice úchopů pro disk o poloměru polomer (m), jehož model má průměr prumerModelu. */
export function vytvorUchopy(polomer, prumerModelu) {
  const uchopy = {};
  for (const [druh, u] of Object.entries(DEFINICE_UCHOPU)) {
    const y = new THREE.Vector3(...u.nahoru).normalize();
    const x = new THREE.Vector3(...u.kStredu);
    x.addScaledVector(y, -x.dot(y)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const stred = new THREE.Vector3(...u.bod).addScaledVector(x, polomer);
    const m = (2 * polomer) / prumerModelu;
    uchopy[druh] = new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(m, m, m)).setPosition(stred);
  }
  return uchopy;
}

const maticeRuky = new THREE.Matrix4();
/** Poloha, natočení a velikost disku v pravé ruce hráče (cil = {pozice, natoceni, meritko}). */
export function diskVRuce(hrac, uchop, cil) {
  const kost = hrac.kosti.dlan_R;
  kost.updateWorldMatrix(true, false);
  maticeRuky.copy(kost.matrixWorld).multiply(uchop);
  maticeRuky.decompose(cil.pozice, cil.natoceni, cil.meritko);
  return cil;
}
export const novyStav = () => ({
  pozice: new THREE.Vector3(), natoceni: new THREE.Quaternion(), meritko: new THREE.Vector3(),
});

// Natočení zápěstí, aby disk ležel jako při skutečném hodu: ruka se pootočí kolem
// předloktí (pronace/supinace) a zbytek dorovná ohnutím zápěstí (nejvýš ~40°).
// Cílový sklon disku je v klíčových snímcích (diskX = předklon, diskZ = náklon do strany).
const zap = {
  m: new THREE.Matrix4(), osa: new THREE.Vector3(), n: new THREE.Vector3(), cil: new THREE.Vector3(),
  a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(),
  qKost: new THREE.Quaternion(), qRodic: new THREE.Quaternion(), e: new THREE.Euler(),
};
const NAHORU = new THREE.Vector3(0, 1, 0);

export function zarovnejZapesti(hrac, uchop, koren, vaha = 1) {
  const kost = hrac.kosti.dlan_R;
  zap.cil.copy(NAHORU).applyEuler(zap.e.set(koren.diskX, koren.yaw, koren.diskZ, 'YXZ'));
  kost.updateWorldMatrix(true, false);
  zap.osa.setFromMatrixColumn(kost.matrixWorld, 1).normalize();          // podél ruky
  zap.m.copy(kost.matrixWorld).multiply(uchop);
  zap.n.setFromMatrixColumn(zap.m, 1).normalize();                        // vršek disku
  // 1) otočení kolem předloktí
  zap.a.copy(zap.n).addScaledVector(zap.osa, -zap.n.dot(zap.osa));
  zap.b.copy(zap.cil).addScaledVector(zap.osa, -zap.cil.dot(zap.osa));
  let uhel = 0;
  if (zap.a.lengthSq() > 1e-6 && zap.b.lengthSq() > 1e-6) {
    zap.a.normalize();
    zap.b.normalize();
    uhel = Math.atan2(zap.osa.dot(zap.a.clone().cross(zap.b)), zap.a.dot(zap.b));
  }
  zap.q.setFromAxisAngle(zap.osa, uhel);
  // 2) dorovnání ohnutím zápěstí
  zap.n.applyQuaternion(zap.q);
  zap.q2.setFromUnitVectors(zap.n, zap.cil);
  const zbytek = 2 * Math.acos(Math.min(1, Math.abs(zap.q2.w)));
  if (zbytek > 0.7) zap.q2.slerp(zap.q.clone().identity(), 1 - 0.7 / zbytek);
  zap.q.premultiply(zap.q2);
  if (vaha < 1) zap.q.slerp(zap.q2.identity(), 1 - vaha);
  // otočení ve světě → lokální otočení kosti
  kost.getWorldQuaternion(zap.qKost);
  kost.parent.getWorldQuaternion(zap.qRodic);
  zap.qKost.premultiply(zap.q);
  kost.quaternion.copy(zap.qRodic.invert().multiply(zap.qKost));
  kost.updateWorldMatrix(false, true);
}
