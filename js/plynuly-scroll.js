// Plynulý a pomalejší scroll (knihovna Lenis) a jedna společná smyčka snímků.
//
// Proč jedna smyčka: Lenis posune stránku a hned potom v tom samém snímku
// se kreslí 3D vrstva se štafetou. Obraz a stránka jsou tak vždy v zákrytu
// a nic necuká. Kdo chce kreslit podle scrollu, přihlásí se přes poKazdemSnimku().

import Lenis from 'lenis';

const POMALOST = {
  lerp: 0.075,           // čím menší, tím déle stránka dojíždí
  wheelMultiplier: 0.7,  // jedno cvaknutí kolečka posune stránku o 70 %
  touchMultiplier: 1,
};

const malyPohyb = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const lenis = malyPohyb ? null : new Lenis({
  ...POMALOST,
  syncTouch: true,       // i na dotyku řídí scroll Lenis, takže 3D vrstva sedí
  syncTouchLerp: 0.09,
  anchors: { offset: -64 },   // odkazy #sekce jedou plynule a nezajedou pod lištu
});
if (lenis) document.documentElement.classList.add('lenis');

const odberatele = [];
/** Zavolá fn(cas, dt) v každém snímku, vždy až po posunu stránky. */
export function poKazdemSnimku(fn) {
  odberatele.push(fn);
}

/** Plynule odroluje na prvek nebo pozici (bez Lenisu skočí rovnou). */
export function odroluj(cil, volby = {}) {
  if (lenis) {
    lenis.scrollTo(cil, { offset: -64, ...volby });
  } else if (typeof cil === 'number') {
    scrollTo(0, cil);
  } else {
    (typeof cil === 'string' ? document.querySelector(cil) : cil)?.scrollIntoView();
  }
}

let posledni = performance.now();
function snimek(cas) {
  requestAnimationFrame(snimek);
  lenis?.raf(cas);
  const dt = Math.min((cas - posledni) / 1000, 0.05);
  posledni = cas;
  for (const fn of odberatele) fn(cas, dt);
}
requestAnimationFrame(snimek);
