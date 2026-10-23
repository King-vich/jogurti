// Štafeta disku přes stránku: v každé sekci stojí hráč, disk si podle scrollu
// přehazují (backhand → forehand → hammer → chyt rybičkou → scoober na kelímek).
//
// Vše se kreslí do jedné průhledné vrstvy přes celou obrazovku s ortografickou
// kamerou, kde 1 jednotka = 1 CSS pixel. Kreslí se ve stejném snímku, ve kterém
// Lenis posune stránku, takže hráči drží na svých místech a nic necuká.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { nactiModel } from './modely.js';
import { Hrac, pismaNactena } from './hraci.js';
import { HRACI_STAFETY, CASOVANI, USEKY } from './stafeta-data.js';
import { poKazdemSnimku } from './plynuly-scroll.js';
import {
  poza, uhlyPrstu, vytvorUchopy, novyStav, diskVRuce as diskVRuceHrace,
  zarovnejZapesti as zarovnejZapestiHrace, plynule, smichej, omez,
} from './pohyb.js';

const platno = document.getElementById('stafeta');
const kotvyHracu = [...document.querySelectorAll('.hrac-kotva')].sort((a, b) => a.dataset.stanice - b.dataset.stanice);
const kotvaKelimku = document.querySelector('.kelimek-kotva');

const VYSKA_HRACE = 1.92;      // m – kotva je vysoká jako hráč (s malou rezervou nad hlavou)
const DISK = 0.274;            // m – průměr skutečného disku
const ZVETSENI_DISKU = 1.3;    // disk je trochu větší, ať je na stránce vidět (ale pořád padne do ruky)
const PRUMER_VICKA = 1.2;      // průměr víčka v jogurt.glb
const STRED_VICKA = 0.065;     // střed výšky víčka nad spodní hranou okraje
const VICKO_NA_KELIMKU = 0.958;
const NAKLON_KELIMKU = 0.32;
const OKNO = 420;              // px scrollu na hod nebo chyt jednoho hráče


let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: true });
} catch {
  platno.hidden = true;
}
if (renderer) spust();

function spust() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;            // postavy stíní samy sebe (paže na trup, kšilt na obličej)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scena = new THREE.Scene();
  scena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scena.environmentIntensity = 0.55;
  // hlavní světlo zleva shora (teplé), protisvětlo zezadu (studené) a měkké světlo oblohy
  const slunce = new THREE.DirectionalLight(0xfff1e2, 2.1);
  slunce.position.set(-0.55, 0.9, 1).multiplyScalar(3000);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(2048, 2048);
  slunce.shadow.radius = 4;
  slunce.shadow.bias = -0.0004;
  slunce.shadow.normalBias = 1.5;
  const protisvetlo = new THREE.DirectionalLight(0xcfe6ff, 1.4);
  protisvetlo.position.set(0.7, 0.5, -1).multiplyScalar(3000);
  scena.add(slunce, slunce.target, protisvetlo, new THREE.HemisphereLight(0xf4f8ff, 0x8a9bb0, 0.55));

  const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  kamera.position.z = 2000;

  // stín pod hráčem: rozmazaná elipsa v rovině obrazovky
  const stinTextura = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(11,31,58,0.32)');
    grad.addColorStop(1, 'rgba(11,31,58,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  let hraci = [];
  let disk = null;
  let kelimek = null;
  const ramecek = { w: 1, h: 1, cx: 0, cy: 0 };   // výřez kelímku v jednotkách modelu
  let nacteno = false;

  // postavy z figurín BodyKun (muž) a BodyChan (žena), viz blender/hrac.py
  Promise.all([nactiModel('models/hrac_muz.glb'), nactiModel('models/hrac_zena.glb'),
    nactiModel('models/jogurt.glb'), pismaNactena])
    .then(([muz, zena, jogurt]) => {
      hraci = HRACI_STAFETY.map((h) => {
        const p = new Hrac((h.postava === 'zena' ? zena : muz).scene, h.id, h.vzhled, h.styl);
        const stin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: stinTextura, transparent: true, depthWrite: false }));
        stin.renderOrder = -1;
        scena.add(p.koren, stin);
        return { hrac: p, stin, casovani: CASOVANI[h.id] };
      });

      // disk = víčko z jogurtu (stejné frisbee), střed posunutý do počátku
      const vicko = jogurt.scene.getObjectByName('Lid').clone();
      vicko.position.set(0, -STRED_VICKA, 0);
      disk = new THREE.Group();
      disk.add(vicko);
      scena.add(disk);

      kelimek = new THREE.Group();
      for (const n of ['Cup', 'Yogurt']) kelimek.add(jogurt.scene.getObjectByName(n).clone());
      kelimek.rotation.x = NAKLON_KELIMKU;
      const slot = new THREE.Object3D();
      slot.position.y = VICKO_NA_KELIMKU + STRED_VICKA;
      kelimek.add(slot);
      kelimek.userData.slot = slot;
      scena.add(kelimek);
      // výřez kelímku i s víčkem → poměr stran kotvy v Kontaktu
      kelimek.updateMatrixWorld(true);
      const obalka = new THREE.Box3().setFromObject(kelimek);
      const vrch = slot.getWorldPosition(new THREE.Vector3());
      obalka.expandByPoint(vrch.clone().add(new THREE.Vector3(PRUMER_VICKA / 2, 0.08, 0)));
      obalka.expandByPoint(vrch.clone().add(new THREE.Vector3(-PRUMER_VICKA / 2, 0.08, 0)));
      ramecek.w = obalka.max.x - obalka.min.x + 0.08;
      ramecek.h = obalka.max.y - obalka.min.y + 0.08;
      ramecek.cx = (obalka.max.x + obalka.min.x) / 2;
      ramecek.cy = (obalka.max.y + obalka.min.y) / 2;
      kotvaKelimku.style.aspectRatio = `${ramecek.w} / ${ramecek.h}`;
      nacteno = true;
    })
    .catch((chyba) => console.error('Štafeta se nenačetla.', chyba));

  // ---------------------------------------------------------- velikost
  let sirka = 1;
  let vyska = 1;
  function velikost() {
    sirka = innerWidth;
    vyska = innerHeight;
    renderer.setSize(sirka, vyska, false);
    Object.assign(kamera, { left: -sirka / 2, right: sirka / 2, top: vyska / 2, bottom: -vyska / 2 });
    kamera.updateProjectionMatrix();
    // stínová kamera pokrývá celou obrazovku (scéna je v pixelech)
    const okraj = 1.25;
    Object.assign(slunce.shadow.camera, {
      left: -sirka / 2 * okraj, right: sirka / 2 * okraj, top: vyska / 2 * okraj, bottom: -vyska / 2 * okraj,
      near: 1, far: 7000,
    });
    slunce.shadow.camera.updateProjectionMatrix();
  }
  addEventListener('resize', velikost);
  velikost();

  // Kotva → umístění hráče v pixelech (nohy uprostřed spodní hrany kotvy).
  function zakladHrace(kotva) {
    const r = kotva.getBoundingClientRect();
    // u široké kotvy stojí hráč u jejího okraje, zbytek je místo na pohyb
    const s = r.height / VYSKA_HRACE;
    const xPaty = kotva.dataset.pata === 'vlevo' ? r.left + 0.4 * s : r.left + r.width / 2;
    return {
      x: xPaty - sirka / 2,
      y: -(r.bottom - vyska / 2),
      s,                                  // pixelů na metr
      vidi: r.bottom > -r.height && r.top < vyska + r.height,
      stredY: r.top + r.height / 2,
    };
  }

  // cilPohledu: bod (px), kam se má hráč dívat; hlava a krk se k němu natočí
  const mistni = new THREE.Vector3();
  function postav(h, zaklad, p, cilPohledu = null) {
    const { hrac, stin } = h;
    const { koren } = p;
    hrac.koren.scale.setScalar(zaklad.s);
    hrac.koren.rotation.set(koren.pitch, koren.yaw, 0, 'YXZ');
    // posun dopředu ve směru natočení a přenesení váhy do strany (levá strana hráče = +X)
    const dx = (Math.sin(koren.yaw) * koren.posun + Math.cos(koren.yaw) * koren.bok + koren.x) * zaklad.s;
    hrac.koren.position.set(zaklad.x + dx, zaklad.y + koren.zdvih * zaklad.s, 0);
    hrac.koren.updateMatrixWorld(true);

    let uhly = p.uhly;
    if (cilPohledu && koren.pohled > 0) {
      // směr k cíli v souřadnicích hráče (metry), od výšky očí
      hrac.koren.worldToLocal(mistni.copy(cilPohledu));
      mistni.y -= 1.62;
      // odečteme natočení a předklon trupu, který hlavu už nese s sebou
      const trupY = (uhly.pater?.[2] || 0) + (uhly.hrudnik?.[2] || 0);
      const predklon = (uhly.pater?.[0] || 0) + (uhly.hrudnik?.[0] || 0);
      const w = koren.pohled;
      const yaw = omez(Math.atan2(mistni.x, mistni.z) - trupY, -1.25, 1.25);
      const nahoru = omez(Math.atan2(mistni.y, Math.hypot(mistni.x, mistni.z)) + 0.8 * predklon, -0.5, 0.9);
      const krk = uhly.krk || [0, 0, 0];
      const hlava = uhly.hlava || [0, 0, 0];
      uhly = {
        ...uhly,
        krk: [smichej(krk[0], -0.4 * nahoru, w), krk[1], smichej(krk[2], 0.45 * yaw, w)],
        hlava: [smichej(hlava[0], -0.5 * nahoru, w), hlava[1], smichej(hlava[2], 0.55 * yaw, w)],
      };
    }
    if (p.uchop) uhly = { ...uhly, ...uhlyPrstu(p.uchop[0], 'L'), ...uhlyPrstu(p.uchop[1], 'R') };
    hrac.nastavUhly(uhly);
    hrac.koren.updateMatrixWorld(true);
    // stín: pod těžištěm, u ležícího hráče protáhlý
    const lezi = Math.sin(koren.pitch);
    const stredTela = dx + Math.sin(koren.yaw) * lezi * 0.9 * zaklad.s;
    stin.position.set(zaklad.x + stredTela, zaklad.y + 0.02 * zaklad.s, -400);
    const vyskaNad = Math.max(0, koren.zdvih);
    stin.scale.set((0.9 + 1.2 * lezi) * zaklad.s * (1 - vyskaNad * 0.5), 0.2 * zaklad.s, 1);
    stin.material.opacity = 1 - vyskaNad * 0.9;
  }

  // ---------------------------------------------------------- disk v dlani (pohyb.js)
  const UCHOPY = vytvorUchopy((DISK * ZVETSENI_DISKU) / 2, PRUMER_VICKA);
  const uchopHrace = (i) => UCHOPY[USEKY[i].druh] || UCHOPY.backhand;
  const diskVRuce = (i, cil) => diskVRuceHrace(hraci[i].hrac, uchopHrace(i), cil);
  const zarovnejZapesti = (i, p, vaha = 1) => zarovnejZapestiHrace(hraci[i].hrac, uchopHrace(i), p.koren, vaha);

  // ---------------------------------------------------------- jeden snímek
  const start = new THREE.Vector3();
  const konec = new THREE.Vector3();
  const qDisk = new THREE.Quaternion();
  const qPom = new THREE.Quaternion();
  const qStart = new THREE.Quaternion();
  const qCil = new THREE.Quaternion();
  const zRuky = novyStav();
  const doRuky = novyStav();
  const euler = new THREE.Euler();
  const posledniDisk = new THREE.Vector3();
  const pohled = new THREE.Vector3();
  const osaY = new THREE.Vector3(0, 1, 0);
  const osaX = new THREE.Vector3(1, 0, 0);
  let prazdno = true;
  let otacka = 0;

  poKazdemSnimku((cas, dt) => {
    if (!nacteno) return;
    otacka += dt * 14;

    const zaklady = kotvyHracu.map(zakladHrace);
    const rk = kotvaKelimku.getBoundingClientRect();
    const mKel = rk.height / ramecek.h;
    kelimek.scale.setScalar(mKel);
    kelimek.position.set(rk.left + rk.width / 2 - sirka / 2 - ramecek.cx * mKel,
      -(rk.top + rk.height / 2 - vyska / 2) - ramecek.cy * mKel, 0);
    kelimek.updateMatrixWorld(true);
    const kelimekVidi = rk.bottom > 0 && rk.top < vyska;
    const stredy = [...zaklady.map((z) => z.stredY), rk.top + rk.height / 2];

    // průběh úseků v pixelech: p = o kolik je stránka odrolovaná za okamžik, kdy byla
    // kotva házejícího uprostřed obrazovky; D = vzdálenost ke kotvě chytajícího
    const useky = USEKY.map((U, i) => {
      const D = Math.max(1, stredy[i + 1] - stredy[i]);
      const p = vyska / 2 - stredy[i];
      const okno = Math.min(0.45 * D, OKNO);
      const pPusteni = U.pusteni * okno;
      const pChyceni = Math.max(pPusteni + 1, D - okno * (1 - U.chyceni));
      return {
        hazeni: p / okno,                       // čas házejícího
        chytani: 1 - (D - p) / okno,            // čas chytajícího
        let: (p - pPusteni) / (pChyceni - pPusteni),
      };
    });

    // pózy hráčů
    const pozy = hraci.map((h, i) => {
      const c = h.casovani;
      if (useky[i].hazeni > 0 || !c.chytani) return poza(c.hazeni || c.pred, omez(useky[i].hazeni));
      if (i > 0) return poza(c.chytani, omez(useky[i - 1].chytani));
      return poza(c.pred, 0);
    });

    // kde je disk: najdeme úsek, ve kterém letí, jinak komu patří
    let drzitel = 0;
    let usek = -1;
    for (let i = 0; i < USEKY.length; i++) {
      if (useky[i].let >= 0) {
        drzitel = i + 1;
        if (useky[i].let < 1) usek = i;
      }
    }

    disk.visible = true;
    let naKelimku = false;

    // sevření prstů každého hráče v tomto snímku: [levá, pravá]
    const VOLNE = 0.35;
    hraci.forEach((h, i) => { pozy[i].uchop = [VOLNE, VOLNE]; });
    if (usek >= 0) {
      const e = useky[usek].let;
      // házející: v okamžiku puštění prsty povolí a disk se odvalí z ruky
      pozy[usek].uchop = [0.45, smichej(1, 0.1, plynule(omez(e / 0.1)))];
      if (usek + 1 < hraci.length) {
        // chytající: ruce se roztáhnou proti disku a v posledním okamžiku se zavřou
        const roztazeni = smichej(VOLNE, -0.35, plynule(omez((e - 0.45) / 0.35)));
        const sevreni = plynule(omez((e - 0.9) / 0.1));
        const u = smichej(roztazeni, 1, sevreni);
        pozy[usek + 1].uchop = [smichej(roztazeni, 0.8, sevreni), u];
      }
    } else if (drzitel < hraci.length) {
      pozy[drzitel].uchop = [0.5, 1];
    }

    if (usek >= 0) {
      const U = USEKY[usek];
      const odkud = hraci[usek];
      // start: ruka házejícího v okamžiku puštění
      const relPoza = poza(odkud.casovani.hazeni, U.pusteni);
      relPoza.uchop = [0.45, 1];
      postav(odkud, zaklady[usek], relPoza);
      zarovnejZapesti(usek, relPoza);
      diskVRuce(usek, zRuky);
      start.copy(zRuky.pozice);
      qStart.copy(zRuky.natoceni);
      const msStart = zRuky.meritko.x;
      let msKonec;
      if (U.naKelimku) {
        kelimek.userData.slot.getWorldPosition(konec);
        msKonec = mKel;
        qCil.copy(kelimek.quaternion);
      } else {
        const kam = hraci[usek + 1];
        const chytPoza = poza(kam.casovani.chytani, U.chyceni);
        chytPoza.uchop = [0.8, 1];
        postav(kam, zaklady[usek + 1], chytPoza);
        zarovnejZapesti(usek + 1, chytPoza);
        diskVRuce(usek + 1, doRuky);
        konec.copy(doRuky.pozice);
        qCil.copy(doRuky.natoceni);
        msKonec = doRuky.meritko.x;
      }
      const e = plynule(useky[usek].let);
      disk.position.lerpVectors(start, konec, e);
      const dx = konec.x - start.x;
      const dy = konec.y - start.y;
      const delka = Math.hypot(dx, dy) || 1;
      const oblouk = Math.sin(e * Math.PI) * Math.min(260, delka * 0.28) * U.oblouk;
      disk.position.x += (-dy / delka) * oblouk;
      disk.position.y += (dx / delka) * oblouk;
      disk.position.z = 300 * Math.sin(e * Math.PI);
      // Dlouhý let (přes celou sekci) by visel přes obsah – disk proto uhne
      // k okraji stránky, kde je volné místo, a trochu se zmenší.
      const dlouhy = omez((delka - 1000) / 800);
      const vOkraji = Math.pow(Math.sin(e * Math.PI), 0.6) * dlouhy;
      const okraj = Math.max(0, (sirka - 1160) / 2);
      const xOkraj = U.oblouk * (sirka / 2 - Math.max(34, okraj / 2));
      disk.position.x = smichej(disk.position.x, xOkraj, vOkraji);
      // kde je okraj úzký (sekce Jak hrát, telefon), disk uprostřed letu zmizí v dálce
      const mizi = okraj < 140 ? 1 : 0.4;
      disk.scale.setScalar(smichej(msStart, msKonec, e) * (1 + 0.45 * Math.sin(e * Math.PI)) * (1 - mizi * vOkraji));
      disk.visible = disk.scale.x > 0.5;
      // natočení: z ruky plynule do letové polohy (placka s náklonem; hammer a scoober
      // letí vzhůru nohama) a na konci do ruky chytajícího nebo na kelímek. Roztočení
      // se rozjede až po puštění a před chycením dozní, ať disk z ruky „nesklouzne“.
      const naruby = U.druh === 'hammer' || U.druh === 'scoober';
      qDisk.setFromEuler(euler.set(naruby ? Math.PI - 0.3 : 0.35 - 0.25 * e, 0, dx > 0 ? -0.25 : 0.25, 'YXZ'));
      const rotace = Math.min(plynule(omez(e / 0.15)), 1 - plynule(omez((e - 0.85) / 0.15)));
      qDisk.multiply(qPom.setFromAxisAngle(osaY, otacka * rotace));
      if (e < 0.2) qDisk.slerpQuaternions(qStart, qDisk, plynule(e / 0.2));
      else if (e > 0.8) qDisk.slerpQuaternions(qDisk, qCil, plynule((e - 0.8) / 0.2));
      disk.quaternion.copy(qDisk);
    } else if (drzitel >= hraci.length) {
      // disk dosedl na kelímek jako víčko
      naKelimku = true;
      kelimek.userData.slot.getWorldPosition(disk.position);
      disk.scale.setScalar(mKel);
      disk.quaternion.copy(kelimek.quaternion);
    }

    // finální pózy a vykreslení hráčů. Kam se kdo dívá: kdo drží disk, sleduje
    // spoluhráče, kterému bude házet; ostatní sledují disk (z minulého snímku).
    let neco = kelimekVidi;
    hraci.forEach((h, i) => {
      const z = zaklady[i];
      h.hrac.koren.visible = z.vidi;
      h.stin.visible = z.vidi;
      if (!z.vidi && i !== drzitel) return;
      let cil = posledniDisk;
      if (usek < 0 && i === drzitel) {
        if (i + 1 < hraci.length) {
          const dalsi = zaklady[i + 1];
          cil = pohled.set(dalsi.x, dalsi.y + 1.3 * dalsi.s, 0);
        } else {
          cil = kelimek.userData.slot.getWorldPosition(pohled);
        }
      }
      postav(h, z, pozy[i], cil);
      // kdo drží disk (nebo ho právě pouští), má zápěstí natočené podle disku;
      // při puštění se ruka plynule vrátí do přirozené polohy
      if (usek < 0 && i === drzitel && !naKelimku) zarovnejZapesti(i, pozy[i]);
      if (usek >= 0) {
        const e = useky[usek].let;
        if (i === usek) zarovnejZapesti(i, pozy[i], 1 - plynule(omez(e / 0.25)));
        if (i === usek + 1) zarovnejZapesti(i, pozy[i], plynule(omez((e - 0.7) / 0.3)));
      }
      if (z.vidi) neco = true;
    });

    if (usek < 0 && !naKelimku) {
      // disk v ruce držitele, náklon podle fáze hodu (hammer na výšku, scoober vzhůru nohama)
      const h = hraci[drzitel];
      const z = zaklady[drzitel];
      diskVRuce(drzitel, zRuky);
      disk.position.copy(zRuky.pozice);
      disk.quaternion.copy(zRuky.natoceni);
      disk.scale.copy(zRuky.meritko);
      disk.visible = z.vidi;
    }
    posledniDisk.copy(disk.position);
    if (usek >= 0) neco = true;

    if (neco) {
      renderer.render(scena, kamera);
      prazdno = false;
    } else if (!prazdno) {
      renderer.clear();
      prazdno = true;
    }
  });
}
