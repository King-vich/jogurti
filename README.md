# Jogurti – web oddílu ultimate frisbee

Statický web bez buildu: HTML, CSS a JavaScript, 3D přes Three.js z CDN.

- `index.html` – hlavní stránka (úvod s kelímkem, O nás, Tréninky, Fotky, Kontakt)
- `galerie.html?prichut=<id>` – fotky jedné kategorie
- `js/prichute.js` – kategorie fotek; nové fotky nahraj do `fotky/<id>/` a zapiš sem
- `models/` – 3D modely (`.glb` pro web, `.blend` ke úpravám)
- `blender/` – skripty, které modely vytvářejí (`blender -b -P blender/jogurt.py`)

Lokálně spusť přes libovolný server (moduly nefungují z `file://`), např.:

```
python -m http.server 5530
```
