// Štafeta disku přes sekce: kdo stojí v které sekci, jak vypadá a jak hází a chytá.
//
// Úhly kostí: [kolem X, kolem Z, kolem Y] v radiánech, vždy vůči klidovému postoji modelu.
//   X: u končetin záporné = dopředu / nahoru, u kolena kladné = pokrčit;
//      u trupu kladné = předklon; u krku a hlavy kladné = předklon hlavy, záporné = záklon
//   Z: u levé strany kladné = od těla, u pravé záporné = od těla (kladné = přes tělo)
//   Y: kladné = otočení doleva (u trupu rotace ramen)
// Kořen: yaw = natočení celé postavy (0 = čelem k divákovi, kladné = doprava na obrazovce),
//        pitch = náklon dopředu (rybička), zdvih = výška nad zemí v metrech,
//        posun = posun ve směru natočení v metrech, bok = přenesení váhy do strany
//        (kladné = na levou nohu), x = posun doprava po obrazovce v metrech,
//        diskX / diskZ = náklon disku v ruce,
//        pohled = jak moc hlava sleduje disk (0–1).

// ---------------------------------------------------------------- vzhled hráčů podle fotek
export const HRACI_STAFETY = [
  {
    // 1. foto: černý dres se žlutým nápisem, fialová kšiltovka, brýle, červené boty – backhand
    id: 'R1',
    postava: 'muz',
    vzhled: {
      cislo: 69, kuze: '#d9a67c', vlasy: '#141010', oci: '#2a1c12', uces: 'kratke',
      doplnky: ['Ksiltovka', 'Bryle'], ksiltovka: '#5b3a8c',
      kratasy: '#121214', stulpny: '#141416', boty: '#e24a56',
    },
    styl: {
      nazev: 'JOGURTI', podnazev: 'ULTIMATE', dres: '#151517', lem: '#151517', limec: '#151517',
      rukav: '#151517', lemRukavu: '#151517', doplnkova: '#151517', panely: false, vzor: null,
      hrud: 'dvaRadky', cislo: '#f2b632', obrys: '#d0461f', cisloVpredu: [0.165, 0.16, 40],
    },
  },
  {
    // 3. foto: bílý dres bez rukávů s červeným lemem, šedé šortky, dlouhý culík s mašlemi,
    // hvězdičky ve vlasech, barva na tváři, náramky – forehand
    id: 'R2',
    postava: 'zena',
    vzhled: {
      cislo: 7, kuze: '#f1cba9', vlasy: '#5b3b22', oci: '#4d5b3c', uces: 'culik', bezRukavu: true,
      doplnky: ['Masle', 'Hvezdy', 'Barva', 'Naramky'],
      kratasy: '#7c7f86', stulpny: '#f4f4f4', boty: '#f0f0f0',
    },
    styl: {
      nazev: 'Jogurti', dres: '#f7f7f5', lem: '#f7f7f5', limec: '#e0393e', doplnkova: '#f7f7f5',
      panely: false, vzor: null, hrud: 'psaci', nazevBarva: '#1f3f8f', cislo: '#e0393e', obrys: null,
      cisloVpredu: [0.335, 0.6, 72],
    },
  },
  {
    // 4. foto: černý dres s oranžovým logem a číslem 14, bílé potítko, červené kopačky – hammer
    id: 'R3',
    postava: 'muz',
    vzhled: {
      cislo: 14, kuze: '#efc3a0', vlasy: '#6b4a2e', oci: '#3b5a7a', uces: 'ofina',
      doplnky: ['Potitko'], kratasy: '#141416', stulpny: '#f6f6f6', boty: '#d9333f',
    },
    styl: {
      nazev: 'JOGURTI', dres: '#151517', lem: '#151517', limec: '#151517', rukav: '#151517',
      lemRukavu: '#151517', doplnkova: '#151517', panely: false, vzor: null, hrud: 'logo',
      cislo: '#f07a28', obrys: null, cisloVpredu: [0.165, 0.74, 66],
    },
  },
  {
    // 2. foto: modrý dres s růžovou osmičkou, světlé kudrnaté vlasy, třpytivá čelenka,
    // tejpy pod koleny, černé šortky – chytá rybičkou a hází na kelímek
    id: 'R4',
    postava: 'zena',
    vzhled: {
      cislo: 8, kuze: '#a8734f', vlasy: '#eadcbd', oci: '#2a1c12', uces: 'kudrnate',
      doplnky: ['Celenka', 'Tejp', 'Naramky'], kratasy: '#111114', stulpny: '#f2f2f2', boty: '#e8e8e8',
    },
    styl: {
      nazev: 'JOGURTI', dres: '#1f6fa6', lem: '#1f6fa6', limec: '#1f6fa6', rukav: '#1f6fa6',
      lemRukavu: '#1f6fa6', doplnkova: '#1f6fa6', panely: false, vzor: 'svisle-dole', hrud: 'nazev',
      nazevBarva: '#f2d24a', nazevVzadu: 'ramena', cislo: '#ff5fa8', obrys: '#ffffff',
    },
  },
];

// ---------------------------------------------------------------- pózy
// Postupy hodů podle techniky: přenesení váhy na pivotovou nohu, výkrok, natočení
// boků a ramen do nápřahu, tah loktem, švih zápěstím a dokončení směrem k cíli.
const nohy = (stehnoL, stehnoR, lytkoL, lytkoR, chodL = -0.1, chodR = -0.1) => ({
  stehno_L: stehnoL, stehno_R: stehnoR, lytko_L: [lytkoL], lytko_R: [lytkoR],
  chodidlo_L: [chodL], chodidlo_R: [chodR],
});
const po = (zaklad, zmeny) => ({ ...zaklad, ...zmeny });

// --- postoje
const STOJ = {
  ...nohy([-0.12, 0.04], [-0.12, -0.04], 0.24, 0.24, -0.12, -0.12),
  pater: [0.06], rameno_L: [-0.12, -0.12], rameno_R: [-0.12, 0.12], predlokti_L: [-0.35], predlokti_R: [-0.35],
};
// s diskem v pravé ruce u břicha, levá ruka u disku, pokrčená kolena
const PRIPRAVENY = {
  ...nohy([-0.32, 0.1], [-0.32, -0.1], 0.56, 0.56, -0.22, -0.22),
  pater: [0.22], hrudnik: [0.05],
  rameno_R: [-0.6, 0.15], predlokti_R: [-1.05], dlan_R: [0.2],
  rameno_L: [-0.45, 0.1], predlokti_L: [-1.0],
};
// chytající čeká: sportovní postoj, ruce volně před tělem
const CEKA = {
  ...nohy([-0.36, 0.12], [-0.36, -0.12], 0.62, 0.62, -0.25, -0.25),
  pater: [0.26], rameno_L: [-0.4, 0.18], rameno_R: [-0.4, -0.18], predlokti_L: [-0.85], predlokti_R: [-0.85],
};
const PO_HODU = po(CEKA, { rameno_L: [-0.25, 0.15], rameno_R: [-0.3, -0.1], predlokti_L: [-0.6], predlokti_R: [-0.5] });

// --- chytání do obou rukou (palačinka: jedna dlaň shora, druhá zespodu)
const NATAHUJE = po(CEKA, {
  pater: [0.18], rameno_L: [-1.7, -0.22], rameno_R: [-1.45, 0.3], predlokti_L: [-0.35], predlokti_R: [-0.4],
});
const CHYT = po(CEKA, {
  pater: [0.22], rameno_L: [-1.42, -0.36], rameno_R: [-1.28, 0.38], predlokti_L: [-0.45], predlokti_R: [-0.4],
  dlan_L: [0.3], dlan_R: [-0.2],
});
const TLUMI = po(CEKA, {
  pater: [0.32], rameno_L: [-0.85, -0.15], rameno_R: [-0.8, 0.2], predlokti_L: [-1.3], predlokti_R: [-1.25],
});

// --- backhand: pravé rameno míří k cíli, disk přes tělo k levému boku a švih ven
const BH_KROK = {
  ...nohy([-0.36, 0.12], [-0.55, -0.3], 0.66, 0.95, -0.22, -0.4),
  pater: [0.3, 0, 0.2], hrudnik: [0.08, 0, 0.4],
  rameno_R: [-0.95, 0.7], predlokti_R: [-1.45], dlan_R: [0.35], rameno_L: [-0.55, 0.25], predlokti_L: [-0.9],
};
const BH_NAPRAH = {
  ...nohy([-0.3, 0.22], [-0.45, -0.6], 0.8, 0.75, -0.35, -0.3),
  pater: [0.45, 0, 0.35], hrudnik: [0.15, 0, 0.6], krk: [0, 0, -0.55],
  rameno_R: [-1.15, 1.0], predlokti_R: [-1.3], dlan_R: [0.5], rameno_L: [-0.35, 0.65], predlokti_L: [-0.5],
};
const BH_TAH = po(BH_NAPRAH, {
  pater: [0.42, 0, 0.05], hrudnik: [0.12, 0, 0.05], krk: [0, 0, -0.3],
  rameno_R: [-1.4, 0.25], predlokti_R: [-0.75], dlan_R: [0.45],
});
const BH_PUSTENI = po(BH_NAPRAH, {
  ...nohy([-0.3, 0.22], [-0.45, -0.6], 0.55, 0.85, -0.25, -0.3),
  pater: [0.38, 0, -0.2], hrudnik: [0.1, 0, -0.45], krk: [0, 0, 0],
  rameno_R: [-1.45, -0.85], predlokti_R: [-0.1], dlan_R: [-0.45], rameno_L: [-0.15, 0.95], predlokti_L: [-0.3],
});
const BH_DOJEZD = po(BH_PUSTENI, {
  ...nohy([-0.15, 0.2], [-0.45, -0.6], 0.4, 0.85, -0.15, -0.3),
  pater: [0.35, 0, -0.3], hrudnik: [0.08, 0, -0.65],
  rameno_R: [-1.25, -1.3], predlokti_R: [-0.25], dlan_R: [-0.5],
});

// --- forehand (flick): výpad pravou nohou do strany, loket u těla, švih zápěstím
const FH_KROK = {
  ...nohy([-0.35, 0.1], [-0.5, -0.45], 0.7, 0.95, -0.22, -0.4),
  pater: [0.3, 0, -0.1], hrudnik: [0.06, 0, -0.15],
  rameno_R: [-0.35, -0.55], predlokti_R: [-1.35], dlan_R: [0.55], rameno_L: [-0.5, 0.6], predlokti_L: [-0.6],
};
const FH_VYPAD = {
  ...nohy([0.0, 0.3], [-0.6, -0.75], 0.55, 0.9, -0.2, -0.35),
  pater: [0.5, 0, -0.3], hrudnik: [0.1, 0, -0.35],
  rameno_R: [0.1, -0.7], predlokti_R: [-1.4], dlan_R: [0.75], rameno_L: [-0.6, 1.25], predlokti_L: [-0.15],
};
const FH_SVIH = po(FH_VYPAD, { hrudnik: [0.1, 0, -0.05], rameno_R: [-0.55, -0.85], predlokti_R: [-0.95], dlan_R: [0.6] });
const FH_PUSTENI = po(FH_VYPAD, { hrudnik: [0.08, 0, 0.15], rameno_R: [-0.95, -0.85], predlokti_R: [-0.2], dlan_R: [-0.65] });
const FH_DOJEZD = po(FH_VYPAD, {
  hrudnik: [0.05, 0, 0.3], rameno_R: [-1.15, -0.4], predlokti_R: [-0.25], dlan_R: [-0.55],
  rameno_L: [-0.35, 0.95],
});

// --- hammer: disk nad hlavu na výšku, záklon, výkrok levou a švih přes hlavu
const HM_ZVEDA = {
  ...nohy([-0.45, 0.12], [0.1, -0.12], 0.35, 0.45),
  pater: [0.02], rameno_R: [-2.0, -0.55], predlokti_R: [-1.1], dlan_R: [0.3],
  rameno_L: [-1.0, 0.2], predlokti_L: [-0.4],
};
const HM_NAPRAH = {
  ...nohy([-0.5, 0.1], [0.25, -0.12], 0.3, 0.5),
  pater: [-0.15, 0, -0.2], hrudnik: [-0.05, 0, -0.5], krk: [-0.1],
  rameno_R: [-2.85, -0.5], predlokti_R: [-1.6], dlan_R: [0.6], rameno_L: [-1.4, 0.25], predlokti_L: [-0.2],
};
const HM_SVIH = {
  ...nohy([-0.55, 0.1], [0.4, -0.1], 0.55, 0.35),
  pater: [0.1], hrudnik: [0.05, 0, -0.05],
  rameno_R: [-2.75, -0.35], predlokti_R: [-0.9], dlan_R: [0.4], rameno_L: [-0.9, 0.35], predlokti_L: [-0.3],
};
const HM_PUSTENI = po(HM_SVIH, {
  pater: [0.3, 0, 0.15], hrudnik: [0.12, 0, 0.3],
  rameno_R: [-2.4, -0.25], predlokti_R: [-0.15], dlan_R: [-0.55], rameno_L: [-0.5, 0.55],
});
const HM_DOJEZD = {
  ...nohy([-0.5, 0.1], [-0.3, -0.1], 0.6, 0.7),
  pater: [0.45, 0, 0.2], hrudnik: [0.15, 0, 0.45],
  rameno_R: [-1.2, 0.25], predlokti_R: [-0.3], dlan_R: [-0.4], rameno_L: [-0.2, 0.45], predlokti_L: [-0.4],
};

// --- rybička: dva kroky rozběhu, odraz z levé, let s nataženýma rukama, dopad na hrudník a skluz
const BEH_1 = po(CEKA, {
  ...nohy([-0.75, 0.05], [0.35, -0.05], 0.6, 0.95, -0.2, 0.2),
  pater: [0.35], rameno_R: [-0.7, -0.1], rameno_L: [0.4, 0.15], predlokti_L: [-1.1], predlokti_R: [-1.1],
});
const BEH_2 = po(CEKA, {
  ...nohy([0.35, 0.05], [-0.75, -0.05], 0.95, 0.6, 0.2, -0.2),
  pater: [0.4], rameno_L: [-0.7, 0.1], rameno_R: [0.4, -0.15], predlokti_L: [-1.1], predlokti_R: [-1.1],
});
const ODRAZ = {
  ...nohy([-0.5, 0.1], [-0.9, -0.05], 1.1, 1.2, -0.3, 0.1),
  pater: [0.55], krk: [-0.3],
  rameno_L: [-2.0, -0.1], rameno_R: [-2.0, 0.1], predlokti_L: [-0.3], predlokti_R: [-0.3],
};
const VZLET = {
  ...nohy([0.2, 0.05], [-0.2, -0.05], 0.4, 0.7, 0.2, 0.1),
  pater: [0.1], krk: [-0.45], hlava: [-0.2],
  rameno_L: [-2.7, -0.12], rameno_R: [-2.7, 0.12], predlokti_L: [-0.15], predlokti_R: [-0.15],
};
const RYBICKA = {
  ...nohy([0.15, 0.05], [0.3, -0.05], 0.9, 0.5, 0.3, 0.3),
  pater: [-0.1], krk: [-0.55], hlava: [-0.3],
  rameno_L: [-2.95, -0.15], rameno_R: [-2.95, 0.15], predlokti_L: [-0.1], predlokti_R: [-0.1],
};
const DOPAD = po(RYBICKA, {
  ...nohy([0.25, 0.08], [0.35, -0.05], 1.25, 0.9, 0.4, 0.3),
  pater: [-0.2], krk: [-0.65], rameno_L: [-2.8, -0.25], rameno_R: [-2.8, 0.25],
});
const LEZI = po(DOPAD, { krk: [-0.45], lytko_L: [0.6], lytko_R: [0.35] });
const OPRENI = {
  ...nohy([0.1, 0.1], [0.2, -0.1], 0.6, 0.4),
  pater: [-0.15], krk: [-0.5], rameno_L: [-1.1, 0.3], rameno_R: [-1.0, -0.25], predlokti_L: [-0.2], predlokti_R: [-0.5],
};
const DREP = {
  ...nohy([-1.25, 0.15], [-1.25, -0.15], 1.9, 1.9, -0.5, -0.5),
  pater: [0.55], rameno_R: [-0.9, -0.05], predlokti_R: [-0.8], rameno_L: [-0.6, 0.2], predlokti_L: [-0.6],
};

// --- scoober: obrácený úchop u pravého ramene, krátké postrčení přes rameno
const SC_NAPRAH = po(PRIPRAVENY, {
  hrudnik: [0, 0, 0.35], rameno_R: [-2.05, 0.5], predlokti_R: [-2.05], dlan_R: [0.4], rameno_L: [-0.6, 0.3],
});
const SC_TLAK = po(SC_NAPRAH, { hrudnik: [0, 0, 0.05], rameno_R: [-2.25, 0.15], predlokti_R: [-1.2] });
const SC_PUSTENI = po(SC_NAPRAH, {
  hrudnik: [0, 0, -0.3], rameno_R: [-2.05, -0.3], predlokti_R: [-0.25], dlan_R: [-0.45],
});
const SC_DOJEZD = po(SC_PUSTENI, { rameno_R: [-1.5, -0.4], predlokti_R: [-0.3], rameno_L: [-0.4, 0.3] });

// ---------------------------------------------------------------- časování
// Házející i chytající mají každý své okno scrollu (asi 420 px), aby se hod i chyt
// odehrály, když je hráč na obrazovce, i když je mezi sekcemi dlouhá stránka.
//   hazeni:  u = 0 kotva házejícího uprostřed obrazovky … 1 = konec jeho okna
//   chytani: u = 0 začátek okna chytajícího … 1 = kotva chytajícího uprostřed obrazovky
// pusteni / chyceni jsou ve stejných jednotkách; mezi nimi disk letí.
// Pohyb mezi klíči je plynulá křivka (stafeta.js), takže tělo neustává v každé póze.
// Klíč: [u, póza, kořen]
const k = (yaw, extra = {}) => ({ yaw, ...extra });
const DISK_BH = { diskX: 0.2, diskZ: 0.3 };
const DISK_FH = { diskX: 0.15, diskZ: -0.2 };
const DISK_SC = { diskX: 2.9, diskZ: 0.1 };

export const USEKY = [
  { pusteni: 0.28, chyceni: 0.72, oblouk: 1, druh: 'backhand' },
  { pusteni: 0.28, chyceni: 0.72, oblouk: -1, druh: 'forehand' },
  { pusteni: 0.28, chyceni: 0.6, oblouk: 1, druh: 'hammer' },
  { pusteni: 0.72, chyceni: 0.95, oblouk: -1, druh: 'scoober', naKelimku: true },
];

const chytani = (yawStart, yawChyt, yawKonec) => [
  [0, CEKA, k(yawStart)],
  [0.3, CEKA, k(yawStart + (yawChyt - yawStart) * 0.6, { posun: 0.12 })],
  [0.6, NATAHUJE, k(yawChyt, { posun: 0.25 })],
  [0.72, CHYT, k(yawChyt, { posun: 0.28 })],
  [0.86, TLUMI, k(yawChyt + (yawKonec - yawChyt) * 0.4, { posun: 0.25 })],
  [1, PRIPRAVENY, k(yawKonec, { posun: 0.2 })],
];

export const CASOVANI = {
  R1: {
    pred: [[0, PRIPRAVENY, k(0)]],
    hazeni: [[0, PRIPRAVENY, k(0)],
      [0.08, BH_KROK, k(0, { bok: 0.08, ...DISK_BH })],
      [0.17, BH_NAPRAH, k(0, { zdvih: -0.06, ...DISK_BH })],
      [0.24, BH_TAH, k(0, { zdvih: -0.06, bok: -0.12, ...DISK_BH })],
      [0.28, BH_PUSTENI, k(0, { zdvih: -0.06, bok: -0.2 })],
      [0.4, BH_DOJEZD, k(-0.1, { zdvih: -0.05, bok: -0.22 })],
      [0.7, PO_HODU, k(-0.2, { bok: -0.1 })], [1, STOJ, k(-0.2)]],
  },
  R2: {
    chytani: chytani(0.4, 0.65, 1.2),
    hazeni: [[0, PRIPRAVENY, k(1.2, { posun: 0.2 })],
      [0.08, FH_KROK, k(2.0, { posun: 0.2, bok: 0.06, ...DISK_FH })],
      [0.17, FH_VYPAD, k(2.4, { posun: 0.2, bok: -0.22, zdvih: -0.1, ...DISK_FH })],
      [0.24, FH_SVIH, k(2.4, { posun: 0.2, bok: -0.22, zdvih: -0.1, ...DISK_FH })],
      [0.28, FH_PUSTENI, k(2.4, { posun: 0.2, bok: -0.22, zdvih: -0.1 })],
      [0.4, FH_DOJEZD, k(2.4, { posun: 0.2, bok: -0.2, zdvih: -0.08 })],
      [0.7, PO_HODU, k(2.1, { posun: 0.2 })], [1, STOJ, k(1.9, { posun: 0.2 })]],
  },
  R3: {
    chytani: chytani(-0.4, -0.65, -0.9),
    hazeni: [[0, PRIPRAVENY, k(-0.9, { posun: 0.2 })],
      [0.08, HM_ZVEDA, k(-1.1, { posun: 0.2, diskX: 1.0, diskZ: 0 })],
      [0.17, HM_NAPRAH, k(-1.2, { posun: 0.2, diskX: 1.45, diskZ: 0 })],
      [0.24, HM_SVIH, k(-1.2, { posun: 0.25, diskX: 1.5, diskZ: 0 })],
      [0.28, HM_PUSTENI, k(-1.2, { posun: 0.3, diskX: 1.6, diskZ: 0 })],
      [0.4, HM_DOJEZD, k(-1.15, { posun: 0.38 })],
      [0.7, PO_HODU, k(-1.0, { posun: 0.38 })], [1, STOJ, k(-0.8, { posun: 0.38 })]],
  },
  R4: {
    chytani: [[0, CEKA, k(0.8)],
      [0.12, BEH_1, k(1.1, { posun: 0.15 })],
      [0.22, BEH_2, k(1.2, { posun: 0.35 })],
      [0.3, ODRAZ, k(1.25, { pitch: 0.35, posun: 0.4, pohled: 0.7 })],
      [0.42, VZLET, k(1.3, { pitch: 0.85, zdvih: 0.35, posun: 0.6, pohled: 0.6 })],
      [0.6, RYBICKA, k(1.3, { pitch: 1.45, zdvih: 0.55, posun: 0.8, pohled: 0.6 })],
      [0.72, DOPAD, k(1.3, { pitch: 1.5, zdvih: 0.2, posun: 1.0, pohled: 0.4 })],
      [0.86, LEZI, k(1.3, { pitch: 1.52, zdvih: 0.13, posun: 1.15, pohled: 0.3 })],
      [1, LEZI, k(1.3, { pitch: 1.52, zdvih: 0.13, posun: 1.15, pohled: 0.3 })]],
    // po dopadu se opře o ruce, vstane tam, kde dopadla, otočí se ke kelímku a hodí scoober.
    // Vstává v místě boků: paty leží asi 1,1 m od startu, boky asi o metr dál (x = 1,8 m).
    hazeni: [[0, LEZI, k(1.3, { pitch: 1.52, zdvih: 0.13, posun: 1.15, pohled: 0.3 })],
      [0.14, OPRENI, k(1.25, { pitch: 1.1, zdvih: 0.2, posun: 1.55, pohled: 0.5 })],
      [0.26, DREP, k(1.0, { pitch: 0.15, zdvih: -0.05, x: 1.8 })],
      [0.42, PRIPRAVENY, k(0.5, { x: 1.8 })],
      [0.56, SC_NAPRAH, k(0.45, { x: 1.8, ...DISK_SC })],
      [0.66, SC_TLAK, k(0.45, { x: 1.8, ...DISK_SC })],
      [0.72, SC_PUSTENI, k(0.45, { x: 1.8, ...DISK_SC })],
      [0.85, SC_DOJEZD, k(0.4, { x: 1.8 })], [1, STOJ, k(0.35, { x: 1.8 })]],
  },
};
