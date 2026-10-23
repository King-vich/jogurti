// Hráči štafety: vzhled (kůže, vlasy, doplňky), dres s číslem a zápis pózy do kostí.
// Model a kosti pocházejí z blender/hrac.py. Hráč se dívá do +Z, jeho levá strana je +X.

import * as THREE from 'three';
import { clone as klonujSKostrou } from 'three/addons/utils/SkeletonUtils.js';

const UCESY = ['kratke', 'kudrnate', 'ofina', 'culik'];
const DOPLNKY = ['Strniste', 'Vousy', 'Ksiltovka', 'Kselt', 'Bryle', 'Celenka', 'Masle', 'Hvezdy', 'Barva',
  'Tejp', 'Potitko', 'Naramky'];
const PISMO = '"Bricolage Grotesque", "Arial Black", Impact, sans-serif';
const PISMO_PSACI = '"Segoe Script", "Brush Script MT", "Segoe Print", cursive';

/**
 * Textura dresu: válec kolem těla. u = 0,25 je střed hrudi, u = 0,75 střed zad,
 * kolem u = 0 a 0,5 jsou boky, v jde od krku (nahoře) k lemu (dole).
 * 1 px ≈ 1 mm, aby písmo nebylo zdeformované.
 *
 * styl: dres, lem, doplnkova, cislo, obrys, nazev a volitelně
 *   vzor: 'sikme' | 'svisle-dole' | null    – sublimovaný vzor
 *   panely: true/false                       – barevné boční panely
 *   hrud: 'nazev' | 'dvaRadky' | 'psaci' | 'logo'
 *   cisloVpredu: [u, v, velikost]            – kde je malé číslo na hrudi
 *   nazevVzadu: 'nad' | 'ramena'             – jméno týmu nad číslem nebo přes ramena
 */
function texturaDresu(styl, cislo) {
  const W = 1024;
  const H = 620;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = styl.dres;
  g.fillRect(0, 0, W, H);

  const vzor = styl.vzor === undefined ? 'sikme' : styl.vzor;
  g.save();
  if (vzor === 'sikme') {
    g.globalAlpha = 0.06;
    g.strokeStyle = styl.lem;
    g.lineWidth = 14;
    for (let x = -H; x < W + H; x += 46) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H * 0.7, 0);
      g.stroke();
    }
  } else if (vzor === 'svisle-dole') {
    // tenké bílé proužky ve spodní části (jako na dresu hráčky v rybičce)
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 3;
    for (let x = 0; x < W; x += 22) {
      const vyska = 140 + 60 * Math.sin(x * 0.013);
      g.beginPath();
      g.setLineDash([16, 9]);
      g.moveTo(x, H);
      g.lineTo(x + 8, H - vyska);
      g.stroke();
    }
  }
  g.restore();

  if (styl.panely !== false) {
    for (const stred of [0, 0.5, 1]) {
      const x = stred * W;
      g.fillStyle = styl.lem;
      g.fillRect(x - 70, 0, 140, H);
      g.fillStyle = styl.doplnkova;
      g.fillRect(x - 78, 0, 6, H);
      g.fillRect(x + 72, 0, 6, H);
    }
  }

  const text = (obsah, x, y, velikost, barva, obrys, pismo = PISMO, vaha = 800, otoceni = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(otoceni);
    g.font = `${vaha} ${velikost}px ${pismo}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (obrys) {
      g.lineJoin = 'round';
      g.lineWidth = velikost * 0.09;
      g.strokeStyle = obrys;
      g.strokeText(obsah, 0, 0);
    }
    g.fillStyle = barva;
    g.fillText(obsah, 0, 0);
    g.restore();
  };

  // hruď
  const hrud = styl.hrud || 'nazev';
  const barvaNazvu = styl.nazevBarva || styl.cislo;
  const xh = 0.25 * W;
  if (hrud === 'nazev') {
    text(styl.nazev, xh, H * 0.3, 58, barvaNazvu);
  } else if (hrud === 'dvaRadky') {
    text(styl.nazev, xh, H * 0.3, 64, styl.cislo, styl.obrys);
    text(styl.podnazev || 'ULTIMATE', xh, H * 0.42, 52, styl.cislo, styl.obrys);
  } else if (hrud === 'psaci') {
    text(styl.nazev, xh, H * 0.36, 92, barvaNazvu, null, PISMO_PSACI, 700, -0.32);
  } else if (hrud === 'logo') {
    // kulaté logo: disk s kelímkem
    g.save();
    g.translate(xh, H * 0.33);
    g.fillStyle = styl.cislo;
    g.beginPath();
    g.arc(0, 0, 70, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = styl.dres;
    g.beginPath();
    g.moveTo(-30, -34);
    g.lineTo(30, -34);
    g.lineTo(22, 38);
    g.lineTo(-22, 38);
    g.closePath();
    g.fill();
    g.fillStyle = styl.cislo;
    g.fillRect(-38, -46, 76, 12);
    g.restore();
    text(styl.nazev, xh, H * 0.5, 30, styl.cislo);
  }
  const [cu, cv, cvel] = styl.cisloVpredu || [0.25 + 70 / W, 0.47, 54];
  text(String(cislo), cu * W, cv * H, cvel, styl.cislo, styl.obrys);

  // záda
  if (styl.nazevVzadu === 'ramena') text(styl.nazev, 0.75 * W, H * 0.1, 40, barvaNazvu);
  else text(styl.nazev, 0.75 * W, H * 0.14, 34, barvaNazvu, null, styl.hrud === 'psaci' ? PISMO_PSACI : PISMO, styl.hrud === 'psaci' ? 700 : 800);
  text(String(cislo), 0.75 * W, H * 0.47, 250, styl.cislo, styl.obrys);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;   // UV z glTF mají počátek nahoře, stejně jako canvas
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Písmo pro čísla na dresech: počkáme, až se načte, jinak by se kreslilo náhradním.
export const pismaNactena = document.fonts
  ? Promise.race([document.fonts.load(`800 60px ${PISMO}`), new Promise((r) => setTimeout(r, 2500))])
  : Promise.resolve();

const OSA_X = new THREE.Vector3(1, 0, 0);   // do strany: předklon/záklon končetin
const OSA_Y = new THREE.Vector3(0, 1, 0);   // svislá: rotace trupu
const OSA_Z = new THREE.Vector3(0, 0, 1);   // dopředu: upažení
const LOKALNI_X = new THREE.Vector3(1, 0, 0);
const LOKALNI_Z = new THREE.Vector3(0, 0, 1);

// Vlastnosti povrchů. MeshPhysicalMaterial umí „sheen“ – jemné prosvětlení na okrajích,
// které u kůže napodobí prosvítání světla (podpovrchový rozptyl) a u látky vlákna.
// Stínování v záhybech je zapečené v barvě vrcholů modelu (blender/hrac.py).
const POVRCHY = {
  Kuze: { roughness: 0.52, sheen: 0.45, sheenColor: '#ff8f7a', sheenRoughness: 0.45, specularIntensity: 0.55 },
  Rty: { roughness: 0.35, sheen: 0.4, sheenColor: '#ff8f7a', sheenRoughness: 0.4 },
  Dres: { roughness: 0.82, sheen: 0.6, sheenColor: '#ffffff', sheenRoughness: 0.7 },
  Rukav: { roughness: 0.82, sheen: 0.6, sheenColor: '#ffffff', sheenRoughness: 0.7 },
  Lem: { roughness: 0.75, sheen: 0.4, sheenColor: '#ffffff', sheenRoughness: 0.7 },
  LemRukavu: { roughness: 0.75, sheen: 0.4, sheenColor: '#ffffff', sheenRoughness: 0.7 },
  Kratasy: { roughness: 0.66, sheen: 0.45, sheenColor: '#ffffff', sheenRoughness: 0.6 },
  Stulpny: { roughness: 0.9, sheen: 0.8, sheenColor: '#ffffff', sheenRoughness: 0.8 },
  Boty: { roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.35 },
  Vlasy: { roughness: 0.48, sheen: 0.7, sheenColor: '#ffe9c9', sheenRoughness: 0.35 },
  Ksiltovka: { roughness: 0.85, sheen: 0.5, sheenColor: '#ffffff', sheenRoughness: 0.7 },
  Oci: { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
  Duhovka: { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 },
  Zornice: { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 },
};

function realistickyMaterial(nazev, zdroj) {
  const m = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(m, zdroj);   // barvy, mapy, barva vrcholů z modelu
  Object.assign(m, POVRCHY[nazev] || {});
  if (m.sheenColor && typeof m.sheenColor === 'string') m.sheenColor = new THREE.Color(m.sheenColor);
  return m;
}

export class Hrac {
  /**
   * vzhled: barvy kůže, vlasů, očí, účes, vousy, doplňky, číslo (viz stafeta-data.js)
   * styl:   styl dresu a barvy oblečení (viz texturaDresu)
   */
  constructor(sablona, id, vzhled, styl) {
    this.id = id;
    this.tym = id[0];
    this.koren = new THREE.Group();
    this.model = klonujSKostrou(sablona);
    this.koren.add(this.model);

    const kuze = new THREE.Color(vzhled.kuze);
    const rukav = vzhled.bezRukavu ? kuze : (styl.rukav || styl.lem);
    const barvy = {
      Dres: '#ffffff', Lem: styl.limec || styl.lem,
      Rukav: rukav, LemRukavu: vzhled.bezRukavu ? kuze : (styl.lemRukavu || styl.lem),
      Kratasy: vzhled.kratasy || styl.kratasy, Stulpny: vzhled.stulpny || styl.stulpny,
      Boty: vzhled.boty || styl.boty, Podrazka: vzhled.podrazka || '#f2f2f2',
      Kuze: kuze, Rty: kuze.clone().lerp(new THREE.Color('#a4524c'), 0.38),
      Strniste: kuze.clone().lerp(new THREE.Color(vzhled.vlasy), 0.42),
      Duhovka: vzhled.oci, Vlasy: vzhled.vlasy, Ksiltovka: vzhled.ksiltovka || '#6d6259',
    };
    const materialy = new Map();
    this.kosti = {};
    this.model.traverse((o) => {
      if (o.isBone) this.kosti[o.name] = o;
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;   // kostrou pohnutá síť má jinou obálku než v klidu
      const nazev = o.material.name;
      if (!materialy.has(nazev)) {
        const m = realistickyMaterial(nazev, o.material);
        if (barvy[nazev]) m.color.set(barvy[nazev]);
        if (nazev === 'Dres') m.map = texturaDresu(styl, vzhled.cislo);
        materialy.set(nazev, m);
      }
      o.material = materialy.get(nazev);
    });
    // účes, vousy, pokrývka hlavy a další doplňky podle hráče
    const viditelne = new Set([`Vlasy_${vzhled.uces}`, ...(vzhled.doplnky || [])]);
    if (vzhled.vousy === 'strniste') viditelne.add('Strniste');
    if (vzhled.vousy === 'vousy') viditelne.add('Vousy');
    if (vzhled.doplnek === 'ksiltovka') viditelne.add('Ksiltovka');
    if (vzhled.doplnek === 'kselt') viditelne.add('Kselt');
    for (const nazev of [...UCESY.map((u) => `Vlasy_${u}`), ...DOPLNKY]) {
      const o = this.model.getObjectByName(nazev);
      if (o) o.visible = viditelne.has(nazev);
    }

    // Klidové natočení kostí a osy otáčení v jejich vlastních souřadnicích.
    this.model.updateMatrixWorld(true);
    this.klid = {};
    this.osy = {};
    const q = new THREE.Quaternion();
    for (const [nazev, kost] of Object.entries(this.kosti)) {
      this.klid[nazev] = kost.quaternion.clone();
      kost.getWorldQuaternion(q).invert();
      this.osy[nazev] = {
        x: OSA_X.clone().applyQuaternion(q),
        y: OSA_Y.clone().applyQuaternion(q),
        z: OSA_Z.clone().applyQuaternion(q),
      };
    }
    this._q = new THREE.Quaternion();
  }

  /** Zapíše pózu do kostí.
   *  uhly: { kost: [kolem X (předklon), kolem Z (upažení), kolem Y (rotace)] }
   *  Otáčí se kolem os v klidové poloze, takže hodnoty odpovídají pohybu „od těla“. */
  nastavUhly(uhly) {
    for (const [nazev, kost] of Object.entries(this.kosti)) {
      kost.quaternion.copy(this.klid[nazev]);
      const u = uhly[nazev];
      if (!u) continue;
      if (nazev.startsWith('prst') || nazev.startsWith('palec')) {
        // prsty a palec se ohýbají kolem vlastní osy X (natočení kostí převzaté z Rigify):
        // kladné = sevřít, záporné = natáhnout
        if (u[0]) kost.quaternion.multiply(this._q.setFromAxisAngle(LOKALNI_X, u[0]));
        if (u[2]) kost.quaternion.multiply(this._q.setFromAxisAngle(LOKALNI_Z, u[2]));
        continue;
      }
      const osy = this.osy[nazev];
      if (u[2]) kost.quaternion.multiply(this._q.setFromAxisAngle(osy.y, u[2]));
      if (u[1]) kost.quaternion.multiply(this._q.setFromAxisAngle(osy.z, u[1]));
      if (u[0]) kost.quaternion.multiply(this._q.setFromAxisAngle(osy.x, u[0]));
    }
  }
}
