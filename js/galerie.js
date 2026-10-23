// Stránka galerie jedné příchutě (galerie.html?prichut=treninky).
// Hlavička vypadá jako etiketa kelímku, fotky jsou ve sloupcích a otevírají se v prohlížeči.

import { lenis } from './plynuly-scroll.js';
import { vyjedPriVstupu } from './main.js';
import { PRICHUTE, najdiPrichut } from './prichute.js';

const escapuj = (t) => t.replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
const fotek = (n) => (n === 1 ? 'fotka' : n >= 2 && n <= 4 ? 'fotky' : 'fotek');
const barvy = (p) => `--barva:${p.barva};--tmava:${p.tmava};--svetla:${p.svetla};--jogurt:${p.jogurt}`;

const id = new URLSearchParams(location.search).get('prichut');
const p = najdiPrichut(id) || PRICHUTE[0];

// ---------------------------------------------------------- hlavička
document.title = `${p.nazev} · Fotky · Jogurti`;
document.body.style.cssText = barvy(p);
document.getElementById('gNazev').textContent = p.prichut;
document.getElementById('gNazev').setAttribute('aria-label', `${p.nazev} – fotky`);
document.getElementById('gPopis').textContent = p.popis;
document.getElementById('gPocet').textContent = p.fotky.length
  ? `${p.fotky.length} ${fotek(p.fotky.length)}`
  : 'Fotky se teprve plní';
document.getElementById('gSlogan').textContent = p.slogan;

// ---------------------------------------------------------- fotky
const mrizka = document.getElementById('gMrizka');
if (p.fotky.length) {
  mrizka.innerHTML = p.fotky.map((f, i) => `
    <li class="g-foto">
      <button type="button" data-i="${i}" aria-label="Zvětšit fotku${f.popis ? `: ${escapuj(f.popis)}` : ''}">
        <img src="${f.src}" alt="${escapuj(f.popis || p.nazev)}" loading="lazy" decoding="async">
      </button>
      ${f.popis ? `<p class="g-foto__popis">${escapuj(f.popis)}</p>` : ''}
    </li>`).join('');
} else {
  // místa pro fotky v různých poměrech stran, ať je vidět, jak bude galerie vypadat
  const pomery = ['4 / 5', '1', '3 / 4', '4 / 3', '5 / 4', '3 / 4', '1', '4 / 5', '4 / 3'];
  mrizka.innerHTML = pomery.map((pomer, i) => `
    <li class="g-foto g-foto--misto" style="--pomer:${pomer};--odstin:${(i % 3) * 0.12}">
      <span>sem přijde fotka</span>
    </li>`).join('');
  const prazdno = document.getElementById('gPrazdno');
  prazdno.hidden = false;
  prazdno.innerHTML = `Fotky nahraj do složky <code>fotky/${p.id}/</code> a&nbsp;zapiš je do <code>js/prichute.js</code>.`;
}
mrizka.querySelectorAll('.g-foto').forEach(vyjedPriVstupu);

// ---------------------------------------------------------- další příchutě
const dalsi = document.getElementById('gDalsi');
dalsi.innerHTML = PRICHUTE.filter((q) => q !== p).map((q) => `
  <li style="${barvy(q)}">
    <a class="g-dalsi__karta" href="galerie.html?prichut=${q.id}">
      <small>s příchutí</small>
      <strong>${escapuj(q.prichut)}</strong>
      <span>${escapuj(q.nazev)} <span aria-hidden="true">→</span></span>
    </a>
  </li>`).join('');
dalsi.querySelectorAll('li').forEach(vyjedPriVstupu);

// ---------------------------------------------------------- prohlížeč
const prohlizec = document.getElementById('prohlizec');
const obr = document.getElementById('prohlizecObr');
const popis = document.getElementById('prohlizecPopis');
let aktualni = 0;

function ukaz(i) {
  aktualni = (i + p.fotky.length) % p.fotky.length;
  const f = p.fotky[aktualni];
  obr.src = f.src;
  obr.alt = f.popis || p.nazev;
  popis.textContent = `${f.popis ? `${f.popis} · ` : ''}${aktualni + 1} / ${p.fotky.length}`;
}
mrizka.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  ukaz(Number(b.dataset.i));
  prohlizec.showModal();
  lenis?.stop();
});
prohlizec.addEventListener('close', () => lenis?.start());
document.getElementById('prohlizecZavrit').addEventListener('click', () => prohlizec.close());
document.getElementById('prohlizecZpet').addEventListener('click', () => ukaz(aktualni - 1));
document.getElementById('prohlizecDal').addEventListener('click', () => ukaz(aktualni + 1));
prohlizec.addEventListener('click', (e) => { if (e.target === prohlizec) prohlizec.close(); });
prohlizec.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') ukaz(aktualni - 1);
  else if (e.key === 'ArrowRight') ukaz(aktualni + 1);
});

// ---------------------------------------------------------- vstup z kelímku
// Jogurt, do kterého se kamera ponořila, se rozestoupí a odhalí stránku.
if (document.documentElement.classList.contains('vstup')) {
  try { sessionStorage.removeItem('jogurti-ponor'); } catch {}
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.add('vstup--hotovo');
  }));
  setTimeout(() => {
    document.documentElement.classList.remove('vstup', 'vstup--hotovo');
    document.documentElement.style.background = '';
  }, 1700);
}
