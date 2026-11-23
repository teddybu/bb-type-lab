# Font Creator

Ein Web-Tool, das aus einer Handvoll Parametern einen **komplett neuen Font**
prozedural erzeugt und als echte **`.ttf`**- oder **`.otf`**-Datei zum
Download anbietet.

Die Glyphen (A–Z, a–z, 0–9, Punktuation, ÄÖÜäöüß) werden zur Laufzeit aus
Grundformen konstruiert – Rechtecke, Ellipsen-Bögen, dicke Diagonalen und
Serifen-Bausteine. Alle Parameter fließen in die Geometrie ein, es wird nichts
aus einer bestehenden Schrift kopiert.

Öffne `index.html` in einem Browser oder liefere den Ordner über einen kleinen
HTTP-Server aus. Zusätzliche Installation ist nicht nötig – `opentype.js` wird
per CDN geladen.

---

## Parameter

### Identität
- **Font-Name** — Name der Familie (fließt in die TTF-Metadaten)
- **Style-Presets** — Clean Sans · Bold Slab · Thin Elegant · Condensed · Italic · Display

### Struktur
- **Gewicht (`stem`)** — Dicke der vertikalen Balken (20–200 units)
- **Breite** — horizontale Skalierung (60–140 %)
- **Kontrast** — Verhältnis dick/dünn (1 = monolineare Grotesk · 3–6 = Didone-artig)
- **Neigung** — Italic-Winkel (−15° bis +15°)

### Proportionen
- **x-Höhe · Cap-Höhe · Ascender · Descender** — alle in units-per-em (1000)

### Formsprache
- **Öffnung / Apertur** — steuert, wie weit Buchstaben wie C, G, S, c, e, s geöffnet sind
- **Zeichen-Abstand (Side-Bearing)** — horizontaler Freiraum auf beiden Seiten jedes Glyphs

### Serifen
- **Stil**: Keine · Slab (rechteckig) · Hairline (feine Balken) · Wedge (Dreieck)
- **Länge** und **Dicke** der Serifen

---

## Export-Formate

| Format | Beschreibung |
|---|---|
| **TTF** | Echte TrueType-Font-Datei – kann direkt installiert, in Design-Software genutzt oder auf einer Website eingebunden werden |
| **OTF** | Byte-identischer SFNT mit `.otf`-Endung |
| **CSS (embed)** | `.css`-Datei mit `@font-face` und **base64-eingebettetem Font** – vollständig portabel, keine externe Datei nötig |
| **Specimen PNG** | Hochauflösendes Muster-Bild (3200 × 1800) für Portfolios / Sozialmedien |

Der Download-Dateiname ergibt sich aus dem eingegebenen Font-Namen
(z. B. `Aurora Sans` → `aurora-sans.ttf`).

---

## Bedienung

1. **Style-Preset** wählen oder frei loslegen
2. **Font-Namen** vergeben
3. Über die Slider den Font formen — die Vorschau **regeneriert live**
4. Preview-Modus wechseln:
	- **Frei** — dein Text
	- **Waterfall** — dieselbe Zeile in vielen Größen
	- **Specimen** — kombiniertes Muster für Präsentation
	- **Zeichen** — kompletter Zeichensatz
5. **TTF herunterladen** (oder OTF / CSS / Specimen PNG)

**Tastatur-Shortcuts** (außerhalb von Textfeldern):
- `r` → zufällige Parameter würfeln
- `R` → auf Standard zurücksetzen

---

## Dateien

```
var-font-creator/
├── index.html         # Layout & Struktur
├── styles.css         # Dark-Theme, Slider-Design
├── glyphs.js          # Prozedurale Glyph-Engine
├── app.js             # State, Live-Preview, Exporte
└── README.md
```

Für Entwicklung / Tests:
```
├── _test-generate.js  # Node-Script: baut alle Presets als .ttf
├── _test-render.js    # Node-Script: rendert Preview-PNGs
├── _test-output/      # Test-Artefakte
├── package.json
└── node_modules/
```

Die `_test-*`-Dateien sind ausschließlich zum lokalen Prüfen – nicht Teil der
Web-App.

---

## Technische Notizen

- **Font-Erzeugung** über [`opentype.js`](https://opentype.js.org/) – erzeugt
  ein valides SFNT/TTF im Browser
- **Live-Preview** via `FontFace`-API: jeder Slider-Änderung wird nach ~120 ms
  Debounce ein neuer Font gebaut, als `FontFace` registriert und der vorherige
  entfernt – kein Rendering-Blitzen
- **Koordinatensystem** in `glyphs.js`: Y-up (Font-Konvention), Ursprung auf
  Baseline; Konturen im Uhrzeigersinn, Löcher gegen den Uhrzeigersinn
  (non-zero winding)
- **Slant** wird als affine Transformation direkt auf die Path-Kommandos
  angewendet (Shear entlang X)
- **Serifen** werden nach dem Zeichnen des Stems modular ergänzt — jeder
  Stil (`slab`, `hairline`, `wedge`) verwendet eigene Kontur-Bausteine

### Was der Generator (noch) nicht macht

- Keine **Kerning-Paare**, keine **OpenType-Features** (Ligaturen etc.)
- Keine Hinting-Instruktionen (Rendering im kleinen Größenbereich <14 px kann
  daher etwas unscharf wirken)
- Buchstabenkonstruktionen sind **stilisiert**, keine kalligrafisch perfekten
  Bézier-Kurven — der Fokus liegt auf schneller, plausibler Parametrisierung

## Erweiterungsideen

- URL-State: alle Parameter im Query-String für Sharing / Bookmarks
- Weitere Glyphen (kyrillisch, griechisch, mathematische Symbole)
- Echter **Variable-Font-Export** mit `wght`/`wdth`/`slnt`-Achsen
- Kerning-Tabelle generieren aus Buchstaben-Nachbarschaften
- Bézier-basierte Serifen und Ink-Traps
