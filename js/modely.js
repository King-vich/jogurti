// Společné načítání 3D modelů. Každý soubor se stáhne jen jednou, i když ho
// používá víc částí stránky (úvod, létající frisbee, hřiště).

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');

const nacitac = new GLTFLoader();
nacitac.setDRACOLoader(draco);

const rozpracovane = new Map();

/** Vrátí Promise s načteným glTF. Výsledek je sdílený – scénu si před úpravou naklonuj. */
export function nactiModel(cesta) {
  if (!rozpracovane.has(cesta)) {
    rozpracovane.set(cesta, new Promise((hotovo, chyba) => nacitac.load(cesta, hotovo, undefined, chyba)));
  }
  return rozpracovane.get(cesta);
}
