// Sekce Fotky: kelímky jogurtu, každý = jedna kategorie fotek („příchuť“).
// Najetí: víčko se vyklopí, na jeho spodku je fotka a pod kelímkem se ukáže popis.
// Kliknutí: víčko odletí, kamera se ponoří do kelímku a stránka přejde do galerie.
//
// Všechny kelímky kreslí jedno plátno přes celou obrazovku – každý do výřezu
// svého odkazu (scissor), takže při ponoření stačí výřez roztáhnout na celý obraz.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { nactiModel } from './modely.js';
import { lenis, poKazdemSnimku } from './plynuly-scroll.js';
import { vyjedPriVstupu } from './main.js';
import { PRICHUTE } from './prichute.js';

const seznam = document.getElementById('prichute');
const platno = document.getElementById('kelimkyPlatno');
const ponorVrstva = document.getElementById('ponor');
const ponorKonec = document.getElementById('ponorKonec');   // zalití barvou jogurtu nad 3D
const malyPohyb = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dotyk = matchMedia('(hover: none)');

const ROZESTUP = 10;        // kelímky stojí ve scéně daleko od sebe, každý má svou kameru
const R_PANT = 0.585;       // pant víčka na zadním okraji (poloměr víčka je 0,6)
const OTEVRENI = 1.9;       // o kolik se víčko vyklopí (rad), spodek pak míří ke kameře
const DELKA_PONORU = 1.9;   // s
const NAD_BUNKOU = 0.85;    // kolik výšky buňky se kreslí nad ní (místo pro vyklopené víčko)

const omez = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const plynule = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const zrychleni = (t) => t * t * t;
const escapuj = (t) => t.replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
const fotek = (n) => (n === 1 ? 'fotka' : n >= 2 && n <= 4 ? 'fotky' : 'fotek');

// ---------------------------------------------------------- odkazy (fungují i bez 3D)
const kelimky = PRICHUTE.map((p, i) => {
  const li = document.createElement('li');
  li.className = 'prichut';
  li.style.cssText = `--barva:${p.barva};--tmava:${p.tmava};--svetla:${p.svetla};--jogurt:${p.jogurt}`;
  const n = p.fotky.length;
  li.innerHTML = `
    <a class="prichut__odkaz" href="galerie.html?prichut=${p.id}">
      <span class="prichut__kelimek" aria-hidden="true">
        <span class="prichut__etiketa"><small>s příchutí</small><strong>${escapuj(p.prichut)}</strong></span>
      </span>
      <span class="prichut__nazev">${escapuj(p.nazev)}<span class="prichut__pocet">${n ? `${n} ${fotek(n)}` : 'brzy'}</span></span>
      <span class="prichut__popis">${escapuj(p.popis)}</span>
    </a>`;
  seznam.append(li);
  vyjedPriVstupu(li, i);
  return {
    p, li,
    odkaz: li.querySelector('a'),
    bunka: li.querySelector('.prichut__kelimek'),
    otevreni: 0, rychlost: 0,       // pružina víčka
    mys: 0, natoceni: 0,            // natočení ke kurzoru
    objeveni: 0,                    // vyjetí kelímku při prvním zobrazení
  };
});

let aktivni = -1;
let ponor = null;                   // { i, start, ... } během ponoření
let pripraveno = false;
let ponorDo = () => {};             // nastaví se, až je připravené 3D

function nastavAktivni(i) {
  aktivni = i;
  kelimky.forEach((k, j) => k.li.classList.toggle('prichut--otevrena', j === i));
}

kelimky.forEach((k, i) => {
  const { odkaz } = k;
  odkaz.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') nastavAktivni(i); });
  odkaz.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && aktivni === i) nastavAktivni(-1); });
  odkaz.addEventListener('pointermove', (e) => {
    const r = k.bunka.getBoundingClientRect();
    k.mys = omez((e.clientX - r.left) / r.width, 0, 1) - 0.5;
  });
  odkaz.addEventListener('focus', () => nastavAktivni(i));
  odkaz.addEventListener('blur', () => { if (aktivni === i && !ponor) nastavAktivni(-1); });
  odkaz.addEventListener('click', (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // nová karta apod.
    // na dotyku první klepnutí jen otevře víčko a ukáže popis, druhé vstoupí dovnitř
    if (dotyk.matches && aktivni !== i) {
      e.preventDefault();
      nastavAktivni(i);
      return;
    }
    if (!pripraveno || malyPohyb || ponor) return;   // obyčejný přechod na stránku galerie
    e.preventDefault();
    ponorDo(i);
  });
});
// klepnutí mimo kelímky víčko zase zavře
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' && !e.target.closest('.prichut')) nastavAktivni(-1);
});

// ---------------------------------------------------------- etiketa a fotka pod víčkem
/** Etiketa kelímku: dva stejné panely kolem dokola (jako u kelímku v úvodu). */
function nakresliEtiketu(p) {
  const W = 2048, H = 556, P = W / 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const pozadi = g.createLinearGradient(0, 0, 0, H);
  pozadi.addColorStop(0, p.svetla);
  pozadi.addColorStop(0.32, p.barva);
  pozadi.addColorStop(1, p.tmava);
  g.fillStyle = pozadi;
  g.fillRect(0, 0, W, H);

  for (let ox = 0; ox < W; ox += P) {
    // lesk uprostřed panelu a tmavnutí k bokům kelímku
    const lesk = g.createRadialGradient(ox + P / 2, H * 0.3, 0, ox + P / 2, H * 0.3, P * 0.55);
    lesk.addColorStop(0, 'rgba(255,255,255,0.22)');
    lesk.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lesk;
    g.fillRect(ox, 0, P, H);
    const boky = g.createLinearGradient(ox, 0, ox + P, 0);
    boky.addColorStop(0, 'rgba(0,0,0,0.2)');
    boky.addColorStop(0.3, 'rgba(0,0,0,0)');
    boky.addColorStop(0.7, 'rgba(0,0,0,0)');
    boky.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = boky;
    g.fillRect(ox, 0, P, H);
  }

  // vlna ochuceného jogurtu dole (celé násobky frekvence → bez švu mezi panely)
  const vlna = (x) => {
    const u = (x / P) * 2 * Math.PI;
    return H * 0.72 + 16 * Math.sin(u) + 11 * Math.sin(2 * u + 1.1) + 6 * Math.sin(5 * u);
  };
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, vlna(x));
  g.lineTo(W, H);
  g.closePath();
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowBlur = 18;
  g.shadowOffsetY = -4;
  g.fillStyle = p.jogurt;
  g.fill();
  g.restore();
  const krem = g.createLinearGradient(0, H * 0.7, 0, H);
  krem.addColorStop(0, 'rgba(255,255,255,0.65)');
  krem.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = krem;
  g.fill();

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (let ox = 0; ox < W; ox += P) {
    const cx = ox + P / 2;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = '800 40px "Bricolage Grotesque", sans-serif';
    g.letterSpacing = '10px';
    g.fillText('JOGURTI', cx + 5, 78);
    g.letterSpacing = '0px';
    g.fillRect(cx - 34, 96, 68, 4);

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.fillStyle = '#fff';
    g.font = 'italic 500 68px "Bricolage Grotesque", sans-serif';
    g.fillText('s příchutí', cx, 182);
    // velký název – zmenší se, aby se vešel na přední stranu kelímku
    let velikost = 176;
    g.font = `800 ${velikost}px "Bricolage Grotesque", sans-serif`;
    const sirka = g.measureText(p.prichut).width;
    if (sirka > 600) velikost = Math.floor((velikost * 600) / sirka);
    g.font = `800 ${velikost}px "Bricolage Grotesque", sans-serif`;
    g.letterSpacing = '-2px';
    g.fillText(p.prichut, cx, 236 + velikost * 0.68);
    g.letterSpacing = '0px';
    g.restore();

    g.fillStyle = p.tmava;
    g.font = '600 38px "Inter", sans-serif';
    g.fillText(p.slogan, cx, H - 46);
  }
  return c;
}

/** Spodek víčka: dokud tam není fotka, kreslí se místo pro ni. */
function nakresliFotku(p) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const pozadi = g.createLinearGradient(0, 0, S, S);
  pozadi.addColorStop(0, p.svetla);
  pozadi.addColorStop(1, p.barva);
  g.fillStyle = pozadi;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.lineWidth = 3;
  for (const r of [300, 340, 380]) {
    g.beginPath();
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = '500 64px "Inter", sans-serif';
  g.fillText('sem přijde', S / 2, S / 2 - 30);
  g.font = '800 150px "Bricolage Grotesque", sans-serif';
  g.fillText('fotka', S / 2, S / 2 + 110);

  if (p.vicko) {
    const obr = new Image();
    obr.onload = () => {
      // vyplní čtverec a ořízne přesahy (object-fit: cover)
      const m = Math.max(S / obr.naturalWidth, S / obr.naturalHeight);
      const w = obr.naturalWidth * m;
      const h = obr.naturalHeight * m;
      g.drawImage(obr, (S - w) / 2, (S - h) / 2, w, h);
      c.dispatchEvent(new Event('zmena'));
    };
    obr.src = p.vicko;
  }
  return c;
}

// ---------------------------------------------------------- 3D
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: true });
} catch (e) {
  console.warn('WebGL není k dispozici, kelímky zůstanou jako obrázky z CSS.', e);
}
if (renderer) spust();

function spust() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const scena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scena.environmentIntensity = 0.8;
  const slunce = new THREE.DirectionalLight(0xffffff, 1.5);
  slunce.position.set(2.5, 5, 4);
  scena.add(slunce, new THREE.HemisphereLight(0xffffff, 0xd9edfc, 0.6));

  // měkký stín pod kelímkem
  const stinPlatno = document.createElement('canvas');
  stinPlatno.width = stinPlatno.height = 128;
  const sg = stinPlatno.getContext('2d');
  const sp = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  sp.addColorStop(0, 'rgba(11,31,58,0.42)');
  sp.addColorStop(0.55, 'rgba(11,31,58,0.16)');
  sp.addColorStop(1, 'rgba(11,31,58,0)');
  sg.fillStyle = sp;
  sg.fillRect(0, 0, 128, 128);
  const stinMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(stinPlatno), transparent: true, depthWrite: false,
  });

  const fonty = Promise.all([
    document.fonts.load('800 100px "Bricolage Grotesque"'),
    document.fonts.load('italic 500 60px "Bricolage Grotesque"'),
    document.fonts.load('600 40px "Inter"'),
  ]).catch(() => {});

  Promise.all([nactiModel('models/jogurt.glb'), fonty]).then(([gltf]) => {
    const zdroj = gltf.scene;
    const anizotropie = renderer.capabilities.getMaxAnisotropy();
    const bila = new THREE.Color('#ffffff');

    kelimky.forEach((k, i) => {
      const { p } = k;
      const skupina = new THREE.Group();
      skupina.position.x = i * ROZESTUP;
      scena.add(skupina);
      const telo = new THREE.Group();
      skupina.add(telo);

      const etiketa = new THREE.CanvasTexture(nakresliEtiketu(p));
      etiketa.flipY = false;                      // UV z glTF mají počátek nahoře
      etiketa.colorSpace = THREE.SRGBColorSpace;
      etiketa.anisotropy = anizotropie;
      const kelimek = zdroj.getObjectByName('Cup').clone();
      kelimek.traverse((o) => {
        if (o.isMesh && o.material.name === 'Etiketa') {
          o.material = o.material.clone();
          o.material.map = etiketa;
        }
      });

      const jogurt = zdroj.getObjectByName('Yogurt').clone();
      jogurt.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.color.set(p.jogurt);
      });

      // víčko (frisbee v barvě příchuti) visí na pantu na zadním okraji
      const vicko = zdroj.getObjectByName('Lid').clone();
      const vyskaVicka = vicko.position.y;
      vicko.position.set(0, 0, R_PANT);
      vicko.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material.name.startsWith('Napis')) {
          o.visible = false;                      // nápis JOGURTI nahradí fotka
        } else {
          o.material = o.material.clone();
          o.material.color.set(p.barva).lerp(bila, 0.12);
          o.material.roughness = 0.32;
        }
      });
      const fotoPlatno = nakresliFotku(p);
      const foto = new THREE.CanvasTexture(fotoPlatno);
      foto.colorSpace = THREE.SRGBColorSpace;
      foto.anisotropy = anizotropie;
      fotoPlatno.addEventListener('zmena', () => { foto.needsUpdate = true; });
      const fotka = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 72),
        new THREE.MeshStandardMaterial({
          map: foto, roughness: 0.6, emissive: 0xffffff, emissiveMap: foto, emissiveIntensity: 0.35,
        })
      );
      fotka.rotation.x = Math.PI / 2;               // líc dolů, horní okraj fotky u předního okraje víčka
      fotka.position.y = 0.101;                     // těsně pod spodní plochou víčka
      vicko.add(fotka);
      const pant = new THREE.Group();
      pant.position.set(0, vyskaVicka, -R_PANT);
      pant.add(vicko);

      telo.add(kelimek, jogurt, pant);

      const stin = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.2), stinMaterial.clone());
      stin.rotation.x = -Math.PI / 2;
      stin.position.y = 0.002;
      skupina.add(stin);

      k.skupina = skupina;
      k.telo = telo;
      k.pant = pant;
      k.vicko = vicko;
      k.stin = stin;
      k.kamera = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
    });

    pripraveno = true;
    seznam.classList.add('prichute--3d');
  }).catch((chyba) => {
    console.error('Kelímky příchutí se nenačetly.', chyba);
  });

  // ---------------------------------------------------------- záběr kamery
  const STRED = new THREE.Vector3(0, 0.56, 0.05);         // střed zavřeného kelímku
  const SMER = new THREE.Vector3(0, 0.3, 1).normalize();   // kamera mírně shora
  const cil = new THREE.Vector3();
  const poloha = new THREE.Vector3();

  /** Kamera v klidu: zavřený kelímek vyplní buňku (víčko se pak vyklopí nad ni). */
  function zaber(k, aspect, vystup) {
    const t = Math.tan(THREE.MathUtils.degToRad(k.kamera.fov / 2));
    const d = Math.max(0.6 / t, 0.6 / (t * aspect)) + 0.6;
    vystup.cil.copy(STRED);
    vystup.poloha.copy(STRED).addScaledVector(SMER, d);
  }
  const zaberKlid = { cil: new THREE.Vector3(), poloha: new THREE.Vector3() };
  // nad kelímkem a těsně nad hladinou jogurtu
  const NAD = { cil: new THREE.Vector3(0, 0.92, 0), poloha: new THREE.Vector3(0, 2.7, 0.55) };
  const HLADINA = { cil: new THREE.Vector3(0, 0.9, -0.02), poloha: new THREE.Vector3(0, 1.05, 0.03) };

  // ---------------------------------------------------------- ponoření
  ponorDo = (i) => {
    const k = kelimky[i];
    nastavAktivni(i);
    ponor = { i, start: performance.now(), uhel: k.pant.rotation.x, pantY: k.pant.position.y };
    document.documentElement.classList.add('ponoreni');
    ponorVrstva.style.cssText = k.li.style.cssText;
    ponorKonec.style.cssText = k.li.style.cssText;
    lenis?.stop();
    try {
      sessionStorage.setItem('jogurti-ponor', JSON.stringify({ id: k.p.id, barva: k.p.jogurt }));
    } catch {}
  };

  // návrat tlačítkem Zpět: stránka se obnoví z mezipaměti v půlce ponoru
  addEventListener('pageshow', (e) => {
    if (!e.persisted || !ponor) return;
    const k = kelimky[ponor.i];
    k.pant.position.set(0, ponor.pantY, -R_PANT);
    k.pant.visible = true;
    k.otevreni = k.rychlost = 0;
    ponor = null;
    nastavAktivni(-1);
    document.documentElement.classList.remove('ponoreni');
    ponorVrstva.style.opacity = '';
    ponorKonec.style.opacity = '';
    lenis?.start();
  });

  // ---------------------------------------------------------- snímek
  let sirka = 0;
  let vyska = 0;
  let kreslilo = false;
  let hodiny = 0;

  poKazdemSnimku((cas, dt) => {
    if (!pripraveno) return;
    hodiny += dt;
    if (innerWidth !== sirka || innerHeight !== vyska) {
      sirka = innerWidth;
      vyska = innerHeight;
      renderer.setSize(sirka, vyska, false);
    }

    const ramecky = kelimky.map((k) => k.bunka.getBoundingClientRect());
    const vidi = ramecky.map((r) => r.bottom > 0 && r.top - r.height * NAD_BUNKOU < vyska && r.width > 0);
    if (!ponor && !vidi.some(Boolean)) {
      if (kreslilo) {
        renderer.setScissorTest(false);
        renderer.clear();
        kreslilo = false;
      }
      return;
    }
    kreslilo = true;

    // průběh ponoru 0..1
    let e = 0;
    if (ponor) {
      e = omez((cas - ponor.start) / 1000 / DELKA_PONORU);
      ponorVrstva.style.opacity = String(plynule(omez((e - 0.12) / 0.45)));
      // těsně nad hladinou se obraz zalije přesně tou barvou, kterou začíná galerie
      ponorKonec.style.opacity = String(plynule(omez((e - 0.8) / 0.18)));
    }

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    // ponořovaný kelímek se kreslí poslední, aby byl navrchu
    const poradi = kelimky.map((_, i) => i);
    if (ponor) poradi.push(poradi.splice(ponor.i, 1)[0]);

    for (const i of poradi) {
      const k = kelimky[i];
      const nori = ponor?.i === i;
      if (!vidi[i] && !nori) continue;
      if (ponor && !nori && e > 0.22) continue;   // při ponoru zůstane jen vybraný kelímek

      // vyjetí při prvním zobrazení (spolu s textem pod kelímkem)
      const cilObjeveni = k.li.classList.contains('videt') ? 1 : 0;
      k.objeveni = malyPohyb ? cilObjeveni : omez(k.objeveni + Math.sign(cilObjeveni - k.objeveni) * dt / 0.8);
      const o = k.objeveni;
      if (o <= 0) continue;
      const vyjeti = 1 - (1 - o) ** 3;

      // pružina víčka: v klidu zavřené, při najetí vyklopené (s lehkým překmitem)
      const cilOtevreni = aktivni === i ? 1 : 0;
      if (malyPohyb) {
        k.otevreni += (cilOtevreni - k.otevreni) * Math.min(1, dt * 10);
      } else {
        k.rychlost += ((cilOtevreni - k.otevreni) * 90 - k.rychlost * 14) * dt;
        k.otevreni += k.rychlost * dt;
        // zavírání: víčko dosedne na okraj a jen lehce odskočí, nikdy nepropadne do kelímku
        if (k.otevreni < 0) {
          k.otevreni = 0;
          k.rychlost = Math.abs(k.rychlost) * 0.18;
        }
      }
      // natočení ke kurzoru, v klidu jen jemné pohupování
      const cilNatoceni = aktivni === i ? k.mys * 0.55 : Math.sin(hodiny * 0.7 + i * 1.7) * 0.1;
      k.natoceni += (cilNatoceni - k.natoceni) * Math.min(1, dt * 5);

      k.telo.rotation.y = k.natoceni;
      k.telo.position.y = -(1 - vyjeti) * 0.35;
      // ostatní kelímky se na začátku ponoru plynule zmenší a zmizí
      const ustup = ponor && !nori ? 1 - plynule(omez(e / 0.2)) : 1;
      k.telo.scale.setScalar((0.7 + 0.3 * vyjeti) * Math.max(ustup, 0.001));
      k.stin.scale.setScalar(Math.max(ustup, 0.001));
      k.stin.material.opacity = vyjeti * (1 - 0.25 * omez(k.otevreni));
      k.pant.rotation.x = -OTEVRENI * k.otevreni;

      // výřez = buňka odkazu; kamera míří tak, aby kelímek seděl přesně v ní
      const { left: x, top: y, width: w, height: h } = ramecky[i];
      const kam = k.kamera;
      // při ponoru se kreslí přes celou obrazovku: „virtuální okno“ kamery se z buňky
      // plynule roztáhne na celý obraz, takže kelímek roste bez ořezu na hraně buňky
      let okno = { w, h, x: 0, y: 0 };
      if (nori) {
        const r = plynule(omez((e - 0.08) / 0.55));
        okno = { w: w + (sirka - w) * r, h: h + (vyska - h) * r, x: -x * (1 - r), y: -y * (1 - r) };
      }
      zaber(k, okno.w / okno.h, zaberKlid);
      cil.copy(zaberKlid.cil);
      poloha.copy(zaberKlid.poloha);

      if (nori) {
        // víčko odletí dozadu nahoru
        const v = omez(e / 0.4);
        k.pant.rotation.x = ponor.uhel + (-2.9 - ponor.uhel) * plynule(v);
        k.pant.position.set(0, ponor.pantY + zrychleni(v) * 2.2, -R_PANT - zrychleni(v) * 0.8);
        k.pant.visible = v < 1;
        // kamera: nad kelímek a pak střemhlav do jogurtu
        const a = plynule(omez((e - 0.05) / 0.5));
        const b = zrychleni(omez((e - 0.5) / 0.5));
        cil.lerp(NAD.cil, a).lerp(HLADINA.cil, b);
        poloha.lerp(NAD.poloha, a).lerp(HLADINA.poloha, b);
        k.telo.rotation.y *= 1 - a;
      }

      // v klidu se kreslí i pruh nad buňkou, aby se vyklopené víčko neořízlo
      const nad = Math.round(h * NAD_BUNKOU);
      kam.aspect = okno.w / okno.h;
      if (nori) kam.setViewOffset(okno.w, okno.h, okno.x, okno.y, sirka, vyska);
      else kam.setViewOffset(w, h, 0, -nad, w, h + nad);
      kam.updateProjectionMatrix();
      kam.position.copy(poloha).add(k.skupina.position);
      kam.lookAt(cil.x + k.skupina.position.x, cil.y, cil.z);

      if (nori) {
        // celá obrazovka: ostatní kelímky by se do rozšířeného záběru mohly dostat
        kelimky.forEach((j) => { j.skupina.visible = j === k; });
        renderer.setViewport(0, 0, sirka, vyska);
        renderer.setScissor(0, 0, sirka, vyska);
        renderer.render(scena, kam);
        kelimky.forEach((j) => { j.skupina.visible = true; });
      } else {
        const yGl = vyska - (y + h);
        renderer.setViewport(x, yGl, w, h + nad);
        renderer.setScissor(x, yGl, w, h + nad);
        renderer.render(scena, kam);
      }
    }

    if (ponor && e >= 1 && !ponor.odchod) {
      ponor.odchod = true;
      location.href = kelimky[ponor.i].odkaz.href;
    }
  });
}
