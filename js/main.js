// Lišta, mobilní menu a jemné vyjíždění obsahu (hlavní stránka i galerie).
// 3D části jsou v hero.js, stafeta.js a kelimky.js.

import './plynuly-scroll.js';

const lista = document.getElementById('lista');
const menu = document.getElementById('menu');
const menuTlacitko = document.getElementById('menuTlacitko');
const oNas = document.getElementById('o-nas');

menuTlacitko.addEventListener('click', () => {
  const otevrit = !menu.classList.contains('otevreno');
  menu.classList.toggle('otevreno', otevrit);
  menuTlacitko.setAttribute('aria-expanded', String(otevrit));
});
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    menu.classList.remove('otevreno');
    menuTlacitko.setAttribute('aria-expanded', 'false');
  }
});

// Lišta dostane pozadí, až úvod skončí a začne obsah (stránka galerie úvod nemá).
function aktualizujListu() {
  lista.classList.toggle('lista--pevna', !oNas || oNas.getBoundingClientRect().top < 80);
}
addEventListener('scroll', aktualizujListu, { passive: true });
aktualizujListu();

// Obsah sekcí vyjede, když se dostane do obrazu.
const vyjizdejici = document.querySelectorAll(
  '.sekce h2, .sekce .perex, .karta-hodnota, .cisla > div, .rozvrh__karta, .prubeh li, .sebou'
);
const pozorovatel = new IntersectionObserver((zaznamy) => {
  for (const z of zaznamy) {
    if (z.isIntersecting) {
      z.target.classList.add('videt');
      pozorovatel.unobserve(z.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px' });
/** Prvek vyjede, až se dostane do obrazu (i pro obsah, který vytvoří jiné moduly). */
export function vyjedPriVstupu(el, i = 0) {
  el.classList.add('vyjet');
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  pozorovatel.observe(el);
}
vyjizdejici.forEach(vyjedPriVstupu);

// Ukazatel přečtené části stránky (tenká lišta nahoře).
const postupStranky = document.getElementById('postupStranky');
let cekaNaSnimek = false;
addEventListener('scroll', () => {
  if (cekaNaSnimek) return;
  cekaNaSnimek = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    postupStranky.style.setProperty('--postup', max > 0 ? (scrollY / max).toFixed(4) : 0);
    cekaNaSnimek = false;
  });
}, { passive: true });

// Nadpisy sekcí vyjíždějí po slovech (zalomení <br> a barevné části zůstanou).
function rozdelNaSlova(el) {
  let i = 0;
  const projdi = (uzel) => {
    for (const dite of [...uzel.childNodes]) {
      if (dite.nodeType === Node.TEXT_NODE) {
        const kusy = dite.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const kus of kusy) {
          if (!kus) continue;
          if (/^\s+$/.test(kus)) {
            frag.append(kus);
          } else {
            const span = document.createElement('span');
            span.className = 'slovo';
            span.style.setProperty('--i', i++);
            span.textContent = kus;
            frag.append(span);
          }
        }
        dite.replaceWith(frag);
      } else if (dite.nodeType === Node.ELEMENT_NODE && dite.tagName !== 'BR') {
        projdi(dite);
      }
    }
  };
  projdi(el);
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
}
for (const h2 of document.querySelectorAll('.sekce h2')) {
  h2.classList.remove('vyjet');
  h2.style.transitionDelay = '';
  rozdelNaSlova(h2);
  h2.classList.add('slova');
}

// Karty: světlo sleduje kurzor. Jeden posluchač na celé stránce
// místo posluchače na každé kartě.
const KARTY = '.karta-hodnota, .rozvrh__karta, .prubeh li';
document.addEventListener('pointermove', (e) => {
  const k = e.target.closest?.(KARTY);
  if (!k) return;
  k.classList.add('svetlo');
  const r = k.getBoundingClientRect();
  k.style.setProperty('--mx', `${e.clientX - r.left}px`);
  k.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });
