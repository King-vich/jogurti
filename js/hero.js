// Úvod: kelímek z boku → kamera najede šikmo, víčko-frisbee se zvedne a roztočí,
// otočí se spodkem s nápisem JOGURTI, přiblíží se a jeho bílá plocha přejde do sekce O nás.
// Celá animace je navázaná na scroll, takže jde přehrát i pozpátku.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { nactiModel } from './modely.js';

// Časová osa úvodu: 0 = začátek sekce, 1 = konec (sekce má 650vh).
const OSA = {
  text: [0.0, 0.1],          // úvodní nadpis zmizí
  zvednuti: [0.04, 0.36],    // kamera z boku do šikma, víčko se zvedá a roztáčí
  roztoceni: [0.05, 0.6],    // víčko se točí a do konce fáze zpomalí
  otoceni: [0.26, 0.6],      // kamera sleduje jen frisbee, to se otočí spodkem
  popisek: [0.58, 0.76],     // pod frisbee se ukáže věta o oddílu
  priblizeni: [0.7, 0.97],   // frisbee se přibližuje, až zaplní obraz
  prechod: [0.9, 0.985],     // dolití barvy sekce O nás
};
const OTACKY = 4;            // kolikrát se víčko otočí, než se zastaví
const ZVEDNUTI = 1.25;       // o kolik se víčko zvedne nad kelímek
const ODSTUP_ODHALENI = 2.7; // vzdálenost kamery od frisbee při čtení nápisu

// Klíčové pohledy kamery (pozice, kam se dívá). Šikmý pohled míří mezi kelímek
// a zvednuté víčko, aby bylo vidět obojí.
const BOK = { pozice: new THREE.Vector3(0, 0.52, 4.6), cil: new THREE.Vector3(0, 0.55, 0) };
const SIKMO = { pozice: new THREE.Vector3(1.3, 3.6, 4.2), cil: new THREE.Vector3(0, 1.3, 0) };
// Bod na spodku víčka (v jeho souřadnicích) pod nápisem, kde je jen bílá plocha.
const BILE_MISTO = new THREE.Vector3(0, 0.105, -0.36);

const sekce = document.getElementById('uvod');
const platno = document.getElementById('heroPlatno');
const heroText = document.getElementById('heroText');
const popisek = document.getElementById('heroPopisek');
const sipka = document.getElementById('heroSipka');
const prechod = document.getElementById('heroPrechod');
const lista = document.getElementById('lista');

const omez = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const faze = (p, [a, b]) => omez((p - a) / (b - a));
const plynule = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const zpomaleni = (t) => 1 - (1 - t) ** 3;
const zrychleni = (t) => t * t * t;

function zaloha() {
  platno.hidden = true;
  document.getElementById('heroZaloha').hidden = false;
  sekce.style.height = '100vh';
  heroText.hidden = true;
  lista.classList.add('lista--odhaleno');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: true });
} catch (e) {
  console.warn('WebGL není k dispozici, úvod se zobrazí bez 3D.', e);
}

if (!renderer) {
  zaloha();
} else {
  spust();
}

function spust() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scena.environmentIntensity = 0.75;

  const kamera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

  const slunce = new THREE.DirectionalLight(0xffffff, 1.7);
  slunce.position.set(2.5, 5, 3.5);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(1024, 1024);
  Object.assign(slunce.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 15 });
  slunce.shadow.radius = 6;
  slunce.shadow.bias = -0.0005;
  scena.add(slunce, new THREE.HemisphereLight(0xffffff, 0xd9edfc, 0.6));

  const podlaha = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.13 })
  );
  podlaha.rotation.x = -Math.PI / 2;
  podlaha.receiveShadow = true;
  scena.add(podlaha);

  const model = new THREE.Group();
  scena.add(model);
  let vicko = null;
  let vickoKlid = new THREE.Vector3();

  nactiModel('models/jogurt.glb').then((gltf) => {
    const kopie = gltf.scene.clone(true);
    kopie.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mapa = o.material.map;
      if (mapa) mapa.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    model.add(kopie);
    vicko = kopie.getObjectByName('Lid');
    vickoKlid = vicko.position.clone();
    // Víčko se hýbe nezávisle na kelímku, proto ho přesuneme rovnou do scény.
    scena.attach(vicko);
    prepocitej();
  }).catch((chyba) => {
    console.error('Model jogurtu se nenačetl.', chyba);
    zaloha();
  });

  // ---------------------------------------------------------- velikost a scroll
  let k = 1;             // na úzkých displejích kameru oddálíme
  let siroky = true;
  let odhaleni = null;   // pohled kamery a natočení víčka v okamžiku čtení nápisu

  function velikost() {
    const w = platno.clientWidth;
    const h = platno.clientHeight;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    // na výšku kameru oddálíme (telefon víc, tablet méně), aby se kelímek vešel pod nadpis
    k = Math.max(1, (kamera.aspect < 0.6 ? 0.75 : 0.9) / kamera.aspect);
    siroky = kamera.aspect > 1.15;
    prepocitej();
  }

  // Natočení frisbee spodkem ke kameře v okamžiku odhalení. Počítá se předem,
  // aby se kamera a víčko při animaci navzájem „nehonily“.
  function prepocitej() {
    if (!vicko) return;
    const stredVicka = vickoKlid.clone().add(new THREE.Vector3(0, ZVEDNUTI, 0));
    const smer = SIKMO.pozice.clone().sub(SIKMO.cil).normalize();
    // na úzkém displeji kamera ustoupí tak, aby frisbee zabralo nejvýš 88 % šířky
    const polovinaSirky = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)) * kamera.aspect;
    const odstup = Math.max(ODSTUP_ODHALENI * k, (1.2 / 0.88) / 2 / polovinaSirky);
    const pozice = stredVicka.clone().addScaledVector(smer, odstup);
    const pomocna = new THREE.PerspectiveCamera();
    pomocna.position.copy(pozice);
    pomocna.lookAt(stredVicka);
    pomocna.updateMatrixWorld();
    const vpravo = new THREE.Vector3().setFromMatrixColumn(pomocna.matrixWorld, 0);
    const nahoru = new THREE.Vector3().setFromMatrixColumn(pomocna.matrixWorld, 1);
    const kKamere = new THREE.Vector3().setFromMatrixColumn(pomocna.matrixWorld, 2);
    // osy víčka: X = vpravo, Y (horní strana) = od kamery, Z = nahoru → spodek míří na kameru
    const baze = new THREE.Matrix4().makeBasis(vpravo, kKamere.clone().negate(), nahoru);
    odhaleni = {
      pozice,
      cil: stredVicka,
      natoceni: new THREE.Quaternion().setFromRotationMatrix(baze),
    };
  }

  let cilovyPostup = 0;
  let postup = null;
  function zmerScroll() {
    const delka = sekce.offsetHeight - innerHeight;
    cilovyPostup = delka > 0 ? omez(-sekce.getBoundingClientRect().top / delka) : 0;
  }
  addEventListener('scroll', zmerScroll, { passive: true });
  addEventListener('resize', () => { velikost(); zmerScroll(); });

  // Odkaz s #p=0.6 skočí rovnou do dané části animace (hodí se při ladění).
  const ladeni = location.hash.match(/^#p=([\d.]+)/);
  if (ladeni) {
    const delka = sekce.offsetHeight - innerHeight;
    scrollTo({ top: sekce.offsetTop + omez(parseFloat(ladeni[1])) * delka, behavior: 'instant' });
  }

  // ---------------------------------------------------------- animace
  const pom = {
    pozice: new THREE.Vector3(),
    cil: new THREE.Vector3(),
    posun: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    naklon: new THREE.Quaternion(),
    otacka: new THREE.Quaternion(),
    osaY: new THREE.Vector3(0, 1, 0),
    euler: new THREE.Euler(),
    bod: new THREE.Vector3(),
    normala: new THREE.Vector3(),
  };

  function snimek(p, cas) {
    const eZved = plynule(faze(p, OSA.zvednuti));
    const eOtoc = plynule(faze(p, OSA.otoceni));
    const ePribl = zrychleni(faze(p, OSA.priblizeni));

    // texty a lišta
    const tText = faze(p, OSA.text);
    heroText.style.opacity = String(1 - tText);
    heroText.style.translate = `0 ${-tText * 40}px`;
    sipka.style.opacity = String(1 - faze(p, [0, 0.03]));
    const [pa, pb] = OSA.popisek;
    popisek.style.opacity = String(Math.min(faze(p, [pa, pa + 0.04]), 1 - faze(p, [pb - 0.04, pb])));
    prechod.style.opacity = String(faze(p, OSA.prechod));
    lista.classList.toggle('lista--odhaleno', p > 0.6);

    if (!vicko || !odhaleni) return;

    // kelímek se v klidu lehce vznáší
    model.position.y = Math.sin(cas * 1.3) * 0.015 * (1 - eZved);

    // ---- víčko: poloha
    vicko.position.copy(vickoKlid);
    vicko.position.y += ZVEDNUTI * eZved + model.position.y;

    // ---- kamera: z boku → šikmo → k frisbee
    pom.pozice.lerpVectors(BOK.pozice, SIKMO.pozice, eZved);
    pom.cil.lerpVectors(BOK.cil, SIKMO.cil, eZved);
    // na začátku posuneme kelímek stranou, ať nepřekáží nadpisu
    if (siroky) pom.posun.set(-0.75, 0, 0); else pom.posun.set(0, 0.5, 0);
    pom.posun.multiplyScalar(1 - eZved);
    // oddálení na úzkých displejích
    pom.pozice.sub(pom.cil).multiplyScalar(k).add(pom.cil);
    pom.pozice.add(pom.posun);
    pom.cil.add(pom.posun);
    pom.pozice.lerp(odhaleni.pozice, eOtoc);
    pom.cil.lerp(odhaleni.cil, eOtoc);

    // ---- víčko: natočení
    const roztoceni = zpomaleni(faze(p, OSA.roztoceni)) * OTACKY * Math.PI * 2;
    const naklon = Math.sin(eZved * Math.PI) * 0.35;     // při zvedání se zakymácí
    pom.naklon.setFromEuler(pom.euler.set(naklon * 0.6, 0, naklon));
    pom.q.slerpQuaternions(pom.naklon, odhaleni.natoceni, eOtoc);
    const doklepnuti = ePribl * 0.5;                     // při přiblížení se ještě pootočí
    pom.otacka.setFromAxisAngle(pom.osaY, roztoceni + doklepnuti);
    vicko.quaternion.copy(pom.q).multiply(pom.otacka);
    vicko.updateMatrixWorld();

    // ---- přiblížení k bílému místu na spodku frisbee
    if (ePribl > 0) {
      pom.bod.copy(BILE_MISTO);
      vicko.localToWorld(pom.bod);
      pom.normala.set(0, -1, 0).applyQuaternion(vicko.quaternion);
      const konecPozice = pom.bod.clone().addScaledVector(pom.normala, 0.12);
      pom.pozice.lerp(konecPozice, ePribl);
      pom.cil.lerp(pom.bod, ePribl);
    }

    kamera.position.copy(pom.pozice);
    kamera.lookAt(pom.cil);
  }

  // Vykreslujeme jen, když je úvod vidět.
  let videt = true;
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; }).observe(sekce);

  const hodiny = new THREE.Clock();
  function smycka() {
    requestAnimationFrame(smycka);
    if (!videt) return;
    const dt = Math.min(hodiny.getDelta(), 0.1);
    if (postup === null) postup = cilovyPostup;           // při načtení uprostřed nepřehrávat od nuly
    postup += (cilovyPostup - postup) * Math.min(1, dt * 7);
    snimek(postup, hodiny.elapsedTime);
    renderer.render(scena, kamera);
  }

  velikost();
  zmerScroll();
  smycka();
}
