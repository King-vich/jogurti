// Kategorie fotek = příchutě jogurtu. Data sdílí kelímky na hlavní stránce
// (kelimky.js) i stránka galerie (galerie.js).
//
// Jak přidat fotky:
//   1. Nahraj je do složky fotky/<id příchutě>/, např. fotky/treninky/rozcvicka.jpg
//   2. Zapiš je do pole `fotky` níže: { src: 'fotky/treninky/rozcvicka.jpg', popis: 'Rozcvička' }
//   3. `vicko` je fotka pod víčkem kelímku (ukáže se, když na kelímek najedeš myší).
// Prohlížeč sám obsah složky nevidí, proto se fotky musí vypsat sem.

export const PRICHUTE = [
  {
    id: 'treninky',
    nazev: 'Tréninky',
    prichut: 'TRÉNINKU',           // velký nápis na etiketě: „s příchutí TRÉNINKU“
    popis: 'Rozcvičky, drilly, hra do tmy a první chycené disky nováčků.',
    slogan: '100 % potu',
    barva: '#2f9e5b',              // etiketa
    tmava: '#14603a',
    svetla: '#8fdc9e',
    jogurt: '#e3f4dc',             // barva jogurtu uvnitř kelímku
    vicko: null,
    fotky: [],
  },
  {
    id: 'zavody',
    nazev: 'Závody',
    prichut: 'ZÁVODŮ',
    popis: 'Turnaje, skluzy pro disk, nervy v posledním bodě i radost z výhry.',
    slogan: 'obsahuje adrenalin',
    barva: '#e3172f',
    tmava: '#9d0a1f',
    svetla: '#ff8a96',
    jogurt: '#fbe1e4',
    vicko: null,
    fotky: [],
  },
  {
    id: 'tymove-foto',
    nazev: 'Týmové foto',
    prichut: 'TÝMOVKY',
    popis: 'Celá parta pohromadě. Dresy, úsměvy a pokaždé někdo se zavřenýma očima.',
    slogan: 'bez filtru',
    barva: '#0a4fa3',
    tmava: '#06306a',
    svetla: '#62c4f7',
    jogurt: '#e4e9fa',
    vicko: null,
    fotky: [],
  },
  {
    id: 'backstage',
    nazev: 'Backstage',
    prichut: 'BACKSTAGE',
    popis: 'Cesty na turnaje, spaní v tělocvičně a všechno, co se nevešlo do hry.',
    slogan: 'nefiltrováno',
    barva: '#6b3fa0',
    tmava: '#3c1f63',
    svetla: '#c4a1f0',
    jogurt: '#ede4f7',
    vicko: null,
    fotky: [],
  },
];

export const najdiPrichut = (id) => PRICHUTE.find((p) => p.id === id);
