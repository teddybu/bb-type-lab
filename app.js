/* =============================================================================
   Font Creator — app.js
   Bindet die UI an die GlyphEngine, generiert Fonts (opentype.js),
   registriert sie live als FontFace und stellt Exporte bereit.
   ============================================================================= */
(() => {
	'use strict';

	/* ---------------------------------------------------------------------- */
	/*  Default-State & Presets                                                */
	/* ---------------------------------------------------------------------- */

	const DEFAULTS = {
		fontName:       'Aurora Sans',
		weight:         80,
		widthScale:     100,
		contrast:       1.0,
		slant:          0,
		xHeight:        500,
		capHeight:      700,
		ascender:       800,
		descender:      200,
		aperture:       50,
		sidebearing:    40,
		cornerRadius:   0,
		bowlRadius:     100,
		fraktur:        0,
		ornament:       0,
		serifStyle:    'none',
		serifSize:      40,
		serifThickness: 20,
		previewText:    'The quick brown fo jumps over the lazy dog',
		previewSize:    72,
		textColor:      '#f5f5ff',
		bgColor:        '#0f0f18',
		mode:           'specimen'
	};

	const STYLE_PRESETS = {
		'clean-sans':    { fontName: 'Aurora Sans',      weight: 70, widthScale: 100, contrast: 1.0, slant: 0, xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none', serifSize: 40, serifThickness: 20 },
		'bold-slab':     { fontName: 'Boulder Slab',     weight: 140, widthScale: 105, contrast: 1.0, slant: 0, xHeight: 500, capHeight: 700, ascender: 780, descender: 200, aperture: 45, sidebearing: 55, serifStyle: 'slab', serifSize: 60, serifThickness: 40 },
		'thin-elegant':  { fontName: 'Filigree',         weight: 32, widthScale: 92, contrast: 3.2, slant: 0, xHeight: 480, capHeight: 720, ascender: 850, descender: 220, aperture: 60, sidebearing: 40, serifStyle: 'hairline', serifSize: 55, serifThickness: 12 },
		'condensed':     { fontName: 'Narrow',           weight: 90, widthScale: 68, contrast: 1.2, slant: 0, xHeight: 550, capHeight: 750, ascender: 820, descender: 200, aperture: 40, sidebearing: 20, serifStyle: 'none', serifSize: 30, serifThickness: 20 },
		'italic':        { fontName: 'Aurora Italic',    weight: 70, widthScale: 96, contrast: 1.4, slant: 12, xHeight: 500, capHeight: 720, ascender: 810, descender: 210, aperture: 55, sidebearing: 45, serifStyle: 'none', serifSize: 40, serifThickness: 20 },
		'display':       { fontName: 'Kolossos Display', weight: 180, widthScale: 115, contrast: 1.0, slant: 0, xHeight: 540, capHeight: 780, ascender: 820, descender: 180, aperture: 35, sidebearing: 60, serifStyle: 'wedge', serifSize: 80, serifThickness: 40 }
	};

	const PRESET_TEXTS = {
		pangram:  'The quick brown fox jumps over the lazy dog',
		alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz',
		numbers:  '0123456789 -+/*=.,!?',
		name:     null // handled dynamically
	};

	// Font-Family-Name für die Live-Vorschau. Jedes Regenerieren erhöht die Revision,
	// so wird der Browser gezwungen, die aktuelle Version zu nutzen.
	const PREVIEW_FAMILY_BASE = 'GeneratedFont';
	let previewRevision = 0;

	/* ---------------------------------------------------------------------- */
	/*  State                                                                  */
	/* ---------------------------------------------------------------------- */

	const state = Object.assign({}, DEFAULTS);

	let currentFont       = null;   // opentype.Font
	let currentBuffer     = null;   // ArrayBuffer der aktuellen Version
	let currentFaceFamily = null;   // aktueller CSS-Familyname (z. B. GeneratedFont-3)
	let regenTimer        = null;

	/* ---------------------------------------------------------------------- */
	/*  DOM                                                                    */
	/* ---------------------------------------------------------------------- */

	const $  = (sel, root = document) => root.querySelector(sel);
	const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

	const dom = {
		fontName:        $('#fontName'),
		weight:          $('#weight'),
		widthScale:      $('#widthScale'),
		contrast:        $('#contrast'),
		slant:           $('#slant'),
		xHeight:         $('#xHeight'),
		capHeight:       $('#capHeight'),
		ascender:        $('#ascender'),
		descender:       $('#descender'),
		aperture:        $('#aperture'),
		sidebearing:     $('#sidebearing'),
		cornerRadius:    $('#cornerRadius'),
		bowlRadius:      $('#bowlRadius'),
		fraktur:         $('#fraktur'),
		ornament:        $('#ornament'),
		serifSize:       $('#serifSize'),
		serifThickness:  $('#serifThickness'),
		previewText:     $('#previewText'),
		previewSize:     $('#previewSize'),
		textColor:       $('#textColor'),
		bgColor:         $('#bgColor'),
		preview:         $('#preview'),
		previewStage:    $('#previewStage'),
		fontStatus:      $('#fontStatus'),
		toast:           $('#toast'),
		outputs: {
			weight:         $('#weightOut'),
			widthScale:     $('#widthScaleOut'),
			contrast:       $('#contrastOut'),
			slant:          $('#slantOut'),
			xHeight:        $('#xHeightOut'),
			capHeight:      $('#capHeightOut'),
			ascender:       $('#ascenderOut'),
			descender:      $('#descenderOut'),
			aperture:       $('#apertureOut'),
			sidebearing:    $('#sidebearingOut'),
			cornerRadius:   $('#cornerRadiusOut'),
			bowlRadius:     $('#bowlRadiusOut'),
			fraktur:        $('#frakturOut'),
			ornament:       $('#ornamentOut'),
			serifSize:      $('#serifSizeOut'),
			serifThickness: $('#serifThicknessOut'),
			previewSize:    $('#previewSizeOut')
		}
	};

	/* ---------------------------------------------------------------------- */
	/*  Utils                                                                  */
	/* ---------------------------------------------------------------------- */

	/* ---------------------------------------------------------------------- */
	/*  Modulare Font-Namensgenerierung aus Parametern + "BB"-Eigennamen       */
	/* ---------------------------------------------------------------------- */

	function generateFontName(s) {
		// --- Bausteine aus meinem Namen: Björn Burkhard ---
		const CORES = ['Björn', 'Burkh', 'Björk', 'Burnh', 'Björg', 'Björk', 'Ørn', 'Bürk'];

		// --- Ein einziger Deskriptor aus dem stärksten Parameter ---
		const weightWord = s.weight <= 50  ? 'Thin'
		                 : s.weight <= 90  ? ''
		                 : s.weight <= 130 ? 'Bold'
		                 :                   'Heavy';

		const widthWord  = s.widthScale <= 78  ? 'Cond'
		                 : s.widthScale >= 115  ? 'Wide'
		                 : '';

		const serifWord  = s.serifStyle === 'none'    ? ''
		                 : s.serifStyle === 'slab'     ? 'Slab'
		                 : s.serifStyle === 'wedge'    ? 'Wedge'
		                 : s.serifStyle === 'hairline' ? 'Hair'
		                 : 'Serif';

		const slantWord  = s.slant !== 0 ? 'Italic' : '';

		const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
		const core = rnd(CORES);

		const descriptors = [widthWord, weightWord, serifWord, slantWord]
			.filter(Boolean).slice(0, 2).join(' ');

		return descriptors ? `${core} ${descriptors}` : core;
	}
	function slugify(str) {
		return String(str).trim().toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'font';
	}

	function showToast(msg, kind = '') {
		dom.toast.textContent = msg;
		dom.toast.className   = 'toast show' + (kind ? ' ' + kind : '');
		clearTimeout(showToast._t);
		showToast._t = setTimeout(() => { dom.toast.className = 'toast'; }, 2400);
	}

	function setStatus(text, kind = '') {
		dom.fontStatus.textContent = text;
		dom.fontStatus.className   = kind ? '' : 'dim';
	}

	function downloadBlob(blob, filename) {
		const url  = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 200);
	}

	function arrayBufferToBase64(buffer) {
		let binary = '';
		const bytes = new Uint8Array(buffer);
		const chunk = 0x8000;
		for (let i = 0; i < bytes.length; i += chunk) {
			binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
		}
		return btoa(binary);
	}

	function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

	// README-Text mit allen aktuellen Parametern und Lizenz
	function generateReadme(fontFilename) {
		const s    = state;
		const date = new Date().toISOString().split('T')[0];
		const serif = s.serifStyle === 'none' ? 'Keine' : s.serifStyle.charAt(0).toUpperCase() + s.serifStyle.slice(1);
		return `# ${s.fontName}

Generiert mit **BB Type Lab** von Björn Burkhard
Datum: ${date}
Datei: ${fontFilename}

---

## Parameter

| Parameter        | Wert         |
|-----------------|-------------|
| Gewicht (stem)  | ${s.weight}  |
| Breite          | ${s.widthScale} % |
| Kontrast        | ${s.contrast} |
| Neigung (Italic)| ${s.slant}°  |
| x-Höhe          | ${s.xHeight}  |
| Cap-Höhe        | ${s.capHeight} |
| Ascender        | ${s.ascender} |
| Descender       | ${s.descender} |
| Öffnung         | ${s.aperture} % |
| Zeichen-Abstand | ${s.sidebearing} |
| Ecken-Radius    | ${s.cornerRadius} |
| Bauch-Radius    | ${s.bowlRadius} % |
| Fraktur         | ${s.fraktur} % |
| Ornamente       | ${s.ornament} % |
| Serifen-Stil    | ${serif}      |
| Serifen-Länge   | ${s.serifSize} |
| Serifen-Dicke   | ${s.serifThickness} |

---

## Lizenz

Dieser Font ist lizenziert unter **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

Du darfst diesen Font:
- **Teilen** — kopieren und weiterverbreiten
- **Anpassen** — remixen, verändern und darauf aufbauen
- **kommerziell nutzen**

Unter der Bedingung:
- **Namensnennung** — „${s.fontName}" von Björn Burkhard (bjornburkhard.de)

Vollständiger Lizenztext: https://creativecommons.org/licenses/by/4.0/

---

Erzeugt mit BB Type Lab · https://bjornburkhard.de
`;
	}

	// Font-Datei + README als ZIP herunterladen
	async function downloadAsZip(fontBuffer, fontFilename, mimeType) {
		const zip = new JSZip();
		zip.file(fontFilename, fontBuffer);
		zip.file('README.md', generateReadme(fontFilename));
		const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
		const zipName = slugify(state.fontName) + '.zip';
		downloadBlob(blob, zipName);
	}

	/* ---------------------------------------------------------------------- */
	/*  Font-Generierung                                                       */
	/* ---------------------------------------------------------------------- */

	/**
	 * Baut ein opentype.Font-Objekt anhand aktueller State-Werte.
	 * Enthält Glyphen für alle unterstützten Codepoints (ASCII + Umlaute).
	 */
	function buildFont() {
		if (!window.opentype || !window.GlyphEngine) {
			throw new Error('Bibliotheken nicht geladen');
		}

		const params = GlyphEngine.normalizeParams({
			unitsPerEm:     1000,
			stem:           state.weight,
			widthScale:     state.widthScale,
			contrast:       state.contrast,
			slant:          state.slant,
			xHeight:        state.xHeight,
			capHeight:      state.capHeight,
			ascender:       state.ascender,
			descender:      state.descender,
			aperture:       state.aperture,
			sidebearing:    state.sidebearing,
			cornerRadius:   state.cornerRadius,
			bowlRadius:     state.bowlRadius,
			fraktur:        state.fraktur,
			ornament:       state.ornament,
			serifStyle:     state.serifStyle,
			serifSize:      state.serifSize,
			serifThickness: state.serifThickness
		});

		// .notdef als Pflicht-Erstglyph
		const notdef = new opentype.Glyph({
			name: '.notdef',
			unicode: 0,
			advanceWidth: Math.round(params.stem * 5),
			path: (() => {
				const path = new opentype.Path();
				path.moveTo(50, 0);
				path.lineTo(50, params.capHeight);
				path.lineTo(params.stem * 3, params.capHeight);
				path.lineTo(params.stem * 3, 0);
				path.close();
				path.moveTo(100, 50);
				path.lineTo(params.stem * 3 - 50, 50);
				path.lineTo(params.stem * 3 - 50, params.capHeight - 50);
				path.lineTo(100, params.capHeight - 50);
				path.close();
				return path;
			})()
		});

		const glyphs = [notdef];

		// ASCII 0x20 (space) bis 0x7E (~)
		for (let cp = 0x20; cp <= 0x7E; cp++) {
			const ch = String.fromCodePoint(cp);
			try {
				glyphs.push(GlyphEngine.buildGlyph(ch, cp, ch === ' ' ? 'space' : `u${cp.toString(16).toUpperCase()}`, params));
			} catch(e) {
				console.warn('[buildFont] skip glyph', JSON.stringify(ch), e.message);
			}
		}
		// Deutsche Umlaute + nordische Buchstaben
		const german = ['ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß', 'Å', 'å', 'Ø', 'ø'];
		for (const ch of german) {
			const cp = ch.codePointAt(0);
			try {
				glyphs.push(GlyphEngine.buildGlyph(ch, cp, `u${cp.toString(16).toUpperCase()}`, params));
			} catch(e) {
				console.warn('[buildFont] skip glyph', JSON.stringify(ch), e.message);
			}
		}

		const year = new Date().getFullYear();
		const rawName = state.fontName || 'Untitled';
		// Für opentype-interne Metadaten: Umlaute + nordische Zeichen ersetzen (ASCII-sicher).
		// CFF Name INDEX erlaubt nur druckbare ASCII-Zeichen (0x21–0x7E) —
		// nicht-ASCII führt zu "Failed to parse Name INDEX data" im OTS-Sanitizer.
		const bbName = rawName
			.replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
			.replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
			.replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
			.replace(/ß/g, 'ss')
			.replace(/ø/g, 'oe').replace(/Ø/g, 'Oe')   // Nordische Zeichen (Ørn etc.)
			.replace(/å/g, 'aa').replace(/Å/g, 'Aa')
			.replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
			.replace(/[^\x20-\x7E]/g, '');              // Catch-all: restliche Non-ASCII entfernen
		return new opentype.Font({
			familyName:  bbName,
			styleName:   'Regular',
			unitsPerEm:  1000,
			ascender:    Math.round(state.ascender),
			descender:  -Math.round(state.descender),
			glyphs,
			names: {
				copyright:          { en: `© ${year} Björn Burkhard (BB). Generated with BB Font Creator.` },
				fontFamily:         { en: bbName },
				fontSubfamily:      { en: 'Regular' },
				uniqueID:           { en: `bb-font-creator:${bbName}:${year}` },
				fullName:           { en: bbName },
				version:            { en: `Version 1.0 · ${year}` },
				description:        { en: `Custom variable font generated by BB Font Creator (https://bjornburkhard.de). Designed by Björn Burkhard.` },
				designer:           { en: 'Björn Burkhard (BB)' },
				designerURL:        { en: 'https://bjornburkhard.de' },
				manufacturer:       { en: 'Björn Burkhard' },
				manufacturerURL:    { en: 'https://bjornburkhard.de' },
				license:            { en: 'This font is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0). You are free to share and adapt this font for any purpose, provided you give appropriate credit to the designer: Björn Burkhard (BB), https://bjornburkhard.de' },
				licenseURL:         { en: 'https://creativecommons.org/licenses/by/4.0/' },
			}
		});
	}

	/* ---------------------------------------------------------------------- */
	/*  Regenerate + Live-Preview via FontFace-API                              */
	/* ---------------------------------------------------------------------- */

	function scheduleRegenerate(delay = 100) {
		clearTimeout(regenTimer);
		regenTimer = setTimeout(() => regenerate().catch(err => {
			console.error('[regen]', err);
			setStatus('Fehler: ' + err.message, 'error');
			showToast('Fehler: ' + err.message, 'error');
		}), delay);
	}

	async function regenerate() {
		setStatus('generiere …');
		try {
			currentFont   = buildFont();
			currentBuffer = currentFont.toArrayBuffer();

			previewRevision++;
			const family = `${PREVIEW_FAMILY_BASE}-${previewRevision}`;

			// Vorherige FontFaces mit gleichem Basisnamen sammeln
			const staleFaces = [];
			document.fonts.forEach(face => {
				if (face.family && face.family.indexOf(PREVIEW_FAMILY_BASE) === 0) {
					staleFaces.push(face);
				}
			});

			// ArrayBuffer in einen Blob wrappen und als Object-URL übergeben.
			// Manche Browser (Safari, Chrome/macOS) lehnen einen rohen ArrayBuffer
			// als FontFace-Quelle ab und werfen "Invalid source buffer" / CFF-Fehler.
			// Mit url(...) + explizitem MIME-Typ ist die Quelle browserübergreifend valide.
			const blob    = new Blob([currentBuffer], { type: 'font/ttf' });
			const blobUrl = URL.createObjectURL(blob);
			let face;
			try {
				face = new FontFace(family, `url(${blobUrl})`);
				await face.load();
			} catch (err) {
				console.error('[FontFace load]', err, 'buffer size:', currentBuffer.byteLength);
				URL.revokeObjectURL(blobUrl);
				throw err;
			}
			URL.revokeObjectURL(blobUrl);   // Daten sind im Face-Speicher – URL kann freigegeben werden
			document.fonts.add(face);

			// Alte Faces entfernen (nach dem Laden der neuen für nahtlose Umschaltung)
			staleFaces.forEach(f => document.fonts.delete(f));

			currentFaceFamily = family;
			updatePreviewStyles();
			setStatus(`${state.fontName} · ${currentFont.glyphs.length} Glyphen · ${(currentBuffer.byteLength / 1024).toFixed(1)} KB`);
		} catch (err) {
			console.error(err);
			setStatus('Fehler: ' + err.message);
			throw err;
		}
	}

	/* ---------------------------------------------------------------------- */
	/*  Preview-Rendering                                                       */
	/* ---------------------------------------------------------------------- */

	/* ---------------------------------------------------------------------- */
	/*  Canvas-Preview: rendert alle Modi direkt via opentype.js + nonzero    */
	/*  → kein iOS CoreText / CFF evenodd Seam-Problem mehr                   */
	/* ---------------------------------------------------------------------- */

	function measureTextWidth(text, fontSize) {
		if (!currentFont || !text) return 0;
		const glyphs = currentFont.stringToGlyphs(text);
		const scale  = fontSize / currentFont.unitsPerEm;
		return glyphs.reduce((s, g) => s + (g.advanceWidth || 0) * scale, 0);
	}

	function drawTextLine(ctx, text, x, y, fontSize, color) {
		if (!currentFont || !text) return 0;
		const glyphs = currentFont.stringToGlyphs(text);
		const scale  = fontSize / currentFont.unitsPerEm;
		let gx = x;
		for (const glyph of glyphs) {
			if (glyph.advanceWidth) {
				drawGlyphSSAA(ctx, glyph, gx, y, fontSize, color);
			}
			gx += (glyph.advanceWidth || 0) * scale;
		}
		return gx - x;
	}

	// Bricht einen Text in Zeilen auf (word-wrap + hard newlines).
	function wrapText(text, fontSize, maxW) {
		const hardLines = text.split('\n');
		const result = [];
		for (const hard of hardLines) {
			if (!hard) { result.push(''); continue; }
			const words = hard.split(' ');
			let line = '';
			for (const word of words) {
				const test = line ? line + ' ' + word : word;
				if (measureTextWidth(test, fontSize) > maxW && line) {
					result.push(line);
					line = word;
				} else {
					line = test;
				}
			}
			if (line) result.push(line);
		}
		return result;
	}

	function updatePreviewStyles() {
		if (!currentFont) return;
		dom.previewStage.style.background = state.bgColor;

		const canvas = document.getElementById('previewCanvas');
		if (!canvas) return;

		const dpr = window.devicePixelRatio || 1;
		const W   = dom.previewStage.clientWidth  || 320;
		const H   = dom.previewStage.clientHeight || 400;

		// Canvas-Größe nur setzen wenn nötig (vermeidet unnötiges Clear)
		const needW = Math.round(W * dpr);
		const needH = Math.round(H * dpr);
		if (canvas.width !== needW || canvas.height !== needH) {
			canvas.width  = needW;
			canvas.height = needH;
		}

		const ctx = canvas.getContext('2d');
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = state.bgColor;
		ctx.fillRect(0, 0, W, H);

		const pad  = Math.min(24, W * 0.04);   // halbes linkes Padding
		const fg   = state.textColor;
		const upm  = currentFont.unitsPerEm  || 1000;
		const casc = currentFont.ascender    || 800;
		const cdsc = Math.abs(currentFont.descender || 200);

		switch (state.mode) {
			case 'free': {
				const sz    = state.previewSize;
				const lineH = sz * 1.2;
				const asc   = casc / upm * sz;
				const lines = wrapText(state.previewText || state.fontName, sz, W - 2 * pad);
				let y = pad + asc;
				for (const line of lines) {
					if (y - asc > H + lineH) break;
					drawTextLine(ctx, line, pad, y, sz, fg);
					y += lineH;
				}
				break;
			}
			case 'waterfall': {
				const sizes  = [14, 18, 24, 32, 48, 64, 96, 128, 180, 240];
				const sample = (state.previewText.split('\n')[0] || state.fontName).slice(0, 28);
				let y = pad;
				for (const sz of sizes) {
					const asc = casc / upm * sz;
					y += asc;
					if (y > H + sz) break;
					// GrößenLabel in Inter, dann Sample in generiertem Font
					ctx.fillStyle = fg;
					ctx.globalAlpha = 0.45;
					ctx.font = `${Math.max(9, sz * 0.22)}px 'Inter', monospace`;
					ctx.fillText(`${sz}px`, pad, y);
					ctx.globalAlpha = 1;
					const labelW = ctx.measureText(`${sz}px  `).width;
					drawTextLine(ctx, sample, pad + labelW, y, sz, fg);
					y += (cdsc / upm * sz) + sz * 0.25;
				}
				break;
			}
			case 'specimen': {
				// Alle Größen linear proportional zu W — kein scale-Faktor, keine Breakpoints.
				// Dadurch ist das Ergebnis deterministisch unabhängig davon wann gezeichnet wird.
				const sPad     = Math.round(W * 0.04);

				// bigSz: proportional zu W, aber Ascender darf maximal 35% von H einnehmen
				const capRatio   = (state.ascender || 800) / upm;    // Ascender begrenzt wie Descender nach unten
				const bigSzByW   = W * 0.14;
				const bigSzByCap = H * 0.35 / capRatio;              // Ascender = max 35% von H
				const bigSz    = Math.max(16, Math.min(bigSzByW, bigSzByCap));

				const metaSz   = Math.max(9,   W * 0.028);
				const sampleSz = Math.max(12,  W * 0.065);
				const alphaSz  = Math.max(10,  W * 0.038);

				const bigAsc = casc / upm * bigSz;
				const bigDsc = cdsc / upm * bigSz;
				// Baseline: voller Ascender + Slant-Puffer + SSAA-interner PAD (4px) der über den Ascender ragt
				const SSAA_PAD  = 4;
				const slantExtra = Math.abs(Math.tan((state.slant || 0) * Math.PI / 180)) * bigAsc;
				const bigFullAsc = Math.max((state.ascender || 0), casc) / upm * bigSz;
				let y = sPad + bigFullAsc + slantExtra + SSAA_PAD;

				// Font-Name: ggf. in mehrere Zeilen umbrechen
				const nameWords = (state.fontName || 'Untitled').split(' ');
				const nameLines = [];
				let curLine = '';
				for (const w of nameWords) {
					const test = curLine ? curLine + ' ' + w : w;
					ctx.font = `${bigSz}px '__previewFont', sans-serif`;
					if (ctx.measureText(test).width > W - sPad * 2 && curLine) {
						nameLines.push(curLine);
						curLine = w;
					} else {
						curLine = test;
					}
				}
				if (curLine) nameLines.push(curLine);
				for (let i = 0; i < nameLines.length; i++) {
					drawTextLine(ctx, nameLines[i], sPad, y, bigSz, fg);
					// Zwischen Zeilen: voller Zeilenabstand; nach letzter Zeile: eng
					y += i < nameLines.length - 1 ? bigAsc + bigDsc : bigAsc * 0.8;
				}

				// Meta-Info
				ctx.fillStyle   = fg;
				ctx.globalAlpha = 0.55;
				ctx.font        = `${metaSz}px 'Inter', sans-serif`;
				const metaStr   = describeParams();
				const metaParts = metaStr.split(' · ');
				const half      = Math.ceil(metaParts.length / 2);
				ctx.fillText(metaParts.slice(0, half).join(' · '), sPad, y);
				y += metaSz * 1.55;
				ctx.fillText(metaParts.slice(half).join(' · '), sPad, y);
				y += metaSz * 1.55 + bigSz * 0.2;
				ctx.globalAlpha = 1;

				// Trenner
				ctx.strokeStyle = fg;
				ctx.globalAlpha = 0.12;
				ctx.lineWidth   = 1;
				ctx.beginPath();
				ctx.moveTo(sPad, y);
				ctx.lineTo(W - sPad, y);
				ctx.stroke();
				ctx.globalAlpha = 1;
				y += bigSz * 0.3;

				// Pangramm
				const sampleLines = ['The quick brown fox', 'jumps over the lazy dog', '0123456789  !?&@#'];
				for (const line of sampleLines) {
					const a = casc / upm * sampleSz;
					y += a;
					if (y > H + sampleSz) break;
					drawTextLine(ctx, line, sPad, y, sampleSz, fg);
					y += (cdsc / upm * sampleSz) + sampleSz * 0.25;
				}

				// Alphabet wenn noch Platz
				const alphaDsc = cdsc / upm * alphaSz;
				if (y < H - alphaSz * 2) {
					y += casc / upm * alphaSz + bigSz * 0.15;
					drawTextLine(ctx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', sPad, y, alphaSz, fg);
					y += alphaDsc + alphaSz * 0.3;
				}
				if (y < H - alphaSz * 2) {
					y += casc / upm * alphaSz;
					drawTextLine(ctx, 'abcdefghijklmnopqrstuvwxyz', sPad, y, alphaSz, fg);
				}
				break;
			}
			case 'characters': {
				const sz    = Math.min(52, W * 0.095);
				const lineH = (casc + cdsc) / upm * sz * 1.25;
				const rows  = [
					'ABCDEFGHIJKLM',
					'NOPQRSTUVWXYZ',
					'abcdefghijklm',
					'nopqrstuvwxyz',
					'0123456789',
					'.,;:!?&@#()[]',
					'+-*/=<>%\'"',
					'ÄÖÜäöüß'
				];
				let y = pad + casc / upm * sz;
				for (const row of rows) {
					if (y > H + lineH) break;
					drawTextLine(ctx, row, pad, y, sz, fg);
					y += lineH;
				}
				break;
			}
		}
	}

	function describeParams() {
		const bits = [
			`Weight ${state.weight}`,
			`Width ${state.widthScale}%`,
			`Contrast ${state.contrast.toFixed(1)}`,
			`Aperture ${state.aperture}%`,
			`Bowl ${state.bowlRadius}%`
		];
		if (state.cornerRadius) bits.push(`Corner ${state.cornerRadius}`);
		if (state.slant !== 0)  bits.push(`Slant ${state.slant}°`);
		if (state.serifStyle !== 'none') bits.push(`Serif: ${state.serifStyle}`);
		bits.push(`x-h ${state.xHeight} / cap ${state.capHeight}`);
		return bits.join(' · ');
	}

	/* ---------------------------------------------------------------------- */
	/*  UI-Sync                                                                 */
	/* ---------------------------------------------------------------------- */

	function syncOutputs() {
		dom.outputs.weight        .textContent = state.weight;
		dom.outputs.widthScale    .textContent = state.widthScale + '%';
		dom.outputs.contrast      .textContent = state.contrast.toFixed(1);
		dom.outputs.slant         .textContent = state.slant + '°';
		dom.outputs.xHeight       .textContent = state.xHeight;
		dom.outputs.capHeight     .textContent = state.capHeight;
		dom.outputs.ascender      .textContent = state.ascender;
		dom.outputs.descender     .textContent = state.descender;
		dom.outputs.aperture      .textContent = state.aperture + '%';
		dom.outputs.sidebearing   .textContent = state.sidebearing;
		dom.outputs.cornerRadius  .textContent = state.cornerRadius;
		dom.outputs.bowlRadius    .textContent = state.bowlRadius + '%';
		dom.outputs.fraktur       .textContent = state.fraktur + '%';
		dom.outputs.ornament      .textContent = state.ornament + '%';
		dom.outputs.serifSize     .textContent = state.serifSize;
		dom.outputs.serifThickness.textContent = state.serifThickness;
		dom.outputs.previewSize   .textContent = state.previewSize + ' px';
	}

	function syncInputs() {
		dom.fontName       .value = state.fontName;
		dom.weight         .value = state.weight;
		dom.widthScale     .value = state.widthScale;
		dom.contrast       .value = state.contrast;
		dom.slant          .value = state.slant;
		dom.xHeight        .value = state.xHeight;
		dom.capHeight      .value = state.capHeight;
		dom.ascender       .value = state.ascender;
		dom.descender      .value = state.descender;
		dom.aperture       .value = state.aperture;
		dom.sidebearing    .value = state.sidebearing;
		dom.cornerRadius   .value = state.cornerRadius;
		dom.bowlRadius     .value = state.bowlRadius;
		dom.fraktur        .value = state.fraktur;
		dom.ornament       .value = state.ornament;
		dom.serifSize      .value = state.serifSize;
		dom.serifThickness .value = state.serifThickness;
		dom.previewText    .value = state.previewText;
		dom.previewSize    .value = state.previewSize;
		dom.textColor      .value = state.textColor;
		dom.bgColor        .value = state.bgColor;
		// Serifen-Buttons
		$$('.seg-large').forEach(b => {
			b.setAttribute('aria-pressed', b.dataset.serif === state.serifStyle ? 'true' : 'false');
		});
		// Mode-Tabs
		$$('.mode-tabs .tab').forEach(b => {
			const active = b.dataset.mode === state.mode;
			b.classList.toggle('active', active);
			b.setAttribute('aria-pressed', active ? 'true' : 'false');
		});
	}

	function applyPreset(name) {
		const preset = STYLE_PRESETS[name];
		if (!preset) return;
		Object.assign(state, preset);
		syncInputs();
		syncOutputs();
		scheduleRegenerate(0);
		showToast(`Preset „${preset.fontName}“ geladen`);
	}

	function randomize() {
		const rnd = (min, max, step = 1) => {
			const raw = min + Math.random() * (max - min);
			return Math.round(raw / step) * step;
		};
		const pick = arr => arr[Math.floor(Math.random() * arr.length)];
		state.weight         = rnd(30, 180);
		state.widthScale     = rnd(70, 130);
		state.contrast       = Math.round(rnd(1, 5, 1) * 10) / 10;
		state.slant          = Math.random() < 0.6 ? 0 : rnd(-12, 12);
		state.xHeight        = rnd(400, 640, 10);
		state.capHeight      = clamp(state.xHeight + rnd(80, 220, 10), 500, 900);
		state.ascender       = clamp(state.capHeight + rnd(20, 130, 10), 600, 950);
		state.descender      = rnd(120, 280, 10);
		state.aperture       = rnd(20, 90);
		state.sidebearing    = rnd(20, 80);
		state.cornerRadius   = dom.cornerRadius.closest('.slider-row')?.style.display === 'none'
		                     ? 0
		                     : Math.random() < 0.5 ? 0 : rnd(0, 60);
		state.bowlRadius     = rnd(0, 100);
		state.fraktur        = Math.random() < 0.7 ? 0 : rnd(0, 80);
		state.ornament       = Math.random() < 0.75 ? 0 : rnd(0, 70);
		const styles         = ['none', 'none', 'slab', 'hairline', 'wedge'];
		state.serifStyle     = pick(styles);
		state.serifSize      = rnd(20, 90);
		state.serifThickness = rnd(10, 45);
		// Font-Name aus neuer modularer Generierung
		state.fontName       = generateFontName(state);
		syncInputs();
		syncOutputs();
		scheduleRegenerate(0);
		showToast('Zufälliger Font gewürfelt ✨');
	}

	function reset() {
		Object.assign(state, DEFAULTS);
		syncInputs();
		syncOutputs();
		scheduleRegenerate(0);
		showToast('Auf Standard zurückgesetzt');
	}

	/* ---------------------------------------------------------------------- */
	/*  Exporter                                                                */
	/* ---------------------------------------------------------------------- */

	// TTF-ArrayBuffer → WOFF-ArrayBuffer (WOFF v1, Tabellen unkomprimiert).
	// WOFF v1 ist ein reiner Wrapper: WOFF-Header + Tabellen-Verzeichnis +
	// dieselben Tabellendaten wie im TTF, nur mit anderem Anfangs-Header.
	// Unkomprimiert (compLength = origLength) ist laut Spec vollständig valide.
	function ttfToWoff(ttfBuffer) {
		const src    = new DataView(ttfBuffer);
		const src8   = new Uint8Array(ttfBuffer);
		const numT   = src.getUint16(4);

		// TTF-Tabellen einlesen
		const tables = [];
		for (let i = 0; i < numT; i++) {
			const o = 12 + i * 16;
			tables.push({
				tag:      src.getUint32(o),
				checkSum: src.getUint32(o + 4),
				offset:   src.getUint32(o + 8),
				length:   src.getUint32(o + 12),
			});
		}

		// WOFF-Größe berechnen: Header(44) + DIR(numT×20) + Tabellendaten(4-Byte-aligned)
		const WOFF_HDR = 44;
		const DIR_ENTRY = 20;
		let totalSize = WOFF_HDR + numT * DIR_ENTRY;
		tables.forEach(t => { totalSize += (t.length + 3) & ~3; });

		const woff  = new ArrayBuffer(totalSize);
		const dst   = new DataView(woff);
		const dst8  = new Uint8Array(woff);

		// WOFF-Header
		dst.setUint32(0,  0x774F4646);          // 'wOFF'
		dst.setUint32(4,  src.getUint32(0));    // flavor (sfVersion aus TTF)
		dst.setUint32(8,  totalSize);
		dst.setUint16(12, numT);
		dst.setUint16(14, 0);                   // reserved
		dst.setUint32(16, ttfBuffer.byteLength);// totalSfntSize
		dst.setUint16(20, 1);                   // majorVersion
		dst.setUint16(22, 0);                   // minorVersion
		dst.setUint32(24, 0);                   // metaOffset
		dst.setUint32(28, 0);                   // metaLength
		dst.setUint32(32, 0);                   // metaOrigLength
		dst.setUint32(36, 0);                   // privOffset
		dst.setUint32(40, 0);                   // privLength

		// Tabellen-Verzeichnis + Daten
		let dataOff = WOFF_HDR + numT * DIR_ENTRY;
		tables.forEach((t, i) => {
			const d = WOFF_HDR + i * DIR_ENTRY;
			dst.setUint32(d,      t.tag);
			dst.setUint32(d + 4,  dataOff);
			dst.setUint32(d + 8,  t.length);   // compLength (unkomprimiert)
			dst.setUint32(d + 12, t.length);   // origLength
			dst.setUint32(d + 16, t.checkSum);
			dst8.set(src8.subarray(t.offset, t.offset + t.length), dataOff);
			dataOff += (t.length + 3) & ~3;
		});

		return woff;
	}

	async function exportTTF() {
		if (!currentBuffer) throw new Error('Kein Font generiert');
		const filename = slugify(state.fontName) + '.ttf';
		await downloadAsZip(currentBuffer, filename, 'font/ttf');
		showToast('TTF + README als ZIP heruntergeladen', 'success');
	}

	async function exportWOFF() {
		if (!currentBuffer) throw new Error('Kein Font generiert');
		const woffBuffer = ttfToWoff(currentBuffer);
		const filename = slugify(state.fontName) + '.woff';
		await downloadAsZip(woffBuffer, filename, 'font/woff');
		showToast('WOFF + README als ZIP heruntergeladen', 'success');
	}

	async function exportOTF() {
		if (!currentBuffer) throw new Error('Kein Font generiert');
		const filename = slugify(state.fontName) + '.otf';
		await downloadAsZip(currentBuffer, filename, 'font/otf');
		showToast('OTF + README als ZIP heruntergeladen', 'success');
	}

	function exportCSS() {
		if (!currentBuffer) throw new Error('Kein Font generiert');
		const woffBuffer = ttfToWoff(currentBuffer);
		const base64ttf  = arrayBufferToBase64(currentBuffer);
		const base64woff = arrayBufferToBase64(woffBuffer);
		const family = state.fontName || 'Untitled';
		const css = `/* --------------------------------------------------------------
 * Font Creator Export
 * Font: ${family}
 * Erzeugt: ${new Date().toISOString()}
 * -------------------------------------------------------------- */

@font-face {
	font-family: '${family}';
	src: url(data:font/woff;base64,${base64woff}) format('woff'),
	     url(data:font/ttf;base64,${base64ttf}) format('truetype');
	font-weight: normal;
	font-style: normal;
	font-display: swap;
}

.custom-type {
	font-family: '${family}', sans-serif;
	font-size: ${state.previewSize}px;
	color: ${state.textColor};
	background: ${state.bgColor};
}
`;
		downloadBlob(new Blob([css], { type: 'text/css;charset=utf-8' }),
			slugify(state.fontName) + '.css');
		showToast('CSS (mit eingebettetem Font) heruntergeladen', 'success');
	}

	async function exportSpecimenPNG() {
		if (!currentFaceFamily) throw new Error('Kein Font generiert');
		const W = 1600, H = 900;
		const canvas = document.createElement('canvas');
		canvas.width  = W * 2;
		canvas.height = H * 2;
		const ctx = canvas.getContext('2d');
		ctx.scale(2, 2);

		ctx.fillStyle = state.bgColor;
		ctx.fillRect(0, 0, W, H);

		ctx.fillStyle = state.textColor;
		ctx.textBaseline = 'alphabetic';

		ctx.font = `260px '${currentFaceFamily}', sans-serif`;
		ctx.fillText(state.fontName, 80, 340);

		ctx.font = "22px 'Inter', sans-serif";
		ctx.globalAlpha = 0.7;
		ctx.fillText(describeParams(), 80, 400);
		ctx.globalAlpha = 1;

		ctx.font = `84px '${currentFaceFamily}', sans-serif`;
		ctx.fillText('The quick brown fox', 80, 560);
		ctx.fillText('jumps over the lazy dog', 80, 680);

		ctx.font = `56px '${currentFaceFamily}', sans-serif`;
		ctx.fillText('0123456789 &@#!?', 80, 810);

		// Wasserzeichen: bb-Branding + CC-Lizenz unten rechts
		const wmText   = `© ${new Date().getFullYear()} Björn Burkhard (BB)  ·  CC BY 4.0  ·  bjornburkhard.de`;
		const wmFont   = "Inter, system-ui, sans-serif";
		ctx.font       = `bold 15px ${wmFont}`;
		const wmW      = ctx.measureText(wmText).width;
		const wmX      = W - wmW - 28;
		const wmY      = H - 20;
		// Hintergrund-Pill für Lesbarkeit
		ctx.globalAlpha = 0.55;
		ctx.fillStyle   = state.bgColor;
		ctx.beginPath();
		ctx.roundRect(wmX - 10, wmY - 18, wmW + 20, 26, 6);
		ctx.fill();
		ctx.globalAlpha = 0.85;
		ctx.fillStyle   = state.textColor;
		ctx.fillText(wmText, wmX, wmY);
		ctx.globalAlpha = 1;

		const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
		downloadBlob(blob, slugify(state.fontName) + '-specimen.png');
		showToast('Specimen (PNG) heruntergeladen', 'success');
	}

	async function handleExport(action, btn) {
		try {
			btn.classList.add('loading');
			btn.disabled = true;
			switch (action) {
				case 'ttf':      await exportTTF();         break;
				case 'woff':     await exportWOFF();        break;
				case 'otf':      await exportOTF();         break;
				case 'css':      exportCSS();               break;
				case 'specimen': await exportSpecimenPNG(); break;
			}
		} catch (err) {
			console.error(err);
			showToast('Fehler: ' + err.message, 'error');
		} finally {
			btn.classList.remove('loading');
			btn.disabled = false;
		}
	}

	/* ---------------------------------------------------------------------- */
	/*  Event-Bindings                                                          */
	/* ---------------------------------------------------------------------- */

	function bindNumericSlider(el, key, parseFn, formatFn, debounce = 120) {
		el.addEventListener('input', () => {
			state[key] = parseFn(el.value);
			if (dom.outputs[key]) dom.outputs[key].textContent = formatFn(state[key]);
			scheduleRegenerate(debounce);
		});
	}

	function bindEvents() {
		// Font-Name
		dom.fontName.addEventListener('input', () => {
			state.fontName = dom.fontName.value;
			scheduleRegenerate(300);
		});

		// Namen aus Parametern generieren
		document.getElementById('generateName').onclick = () => {
			const name = generateFontName(state);
			state.fontName = name;
			dom.fontName.value = name;
			scheduleRegenerate(100);
			showToast(`Name: „${name}"`);
		};

		// Struktur
		bindNumericSlider(dom.weight,      'weight',      v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.widthScale,  'widthScale',  v => parseInt(v, 10),  v => v + '%');
		bindNumericSlider(dom.contrast,    'contrast',    v => parseFloat(v),     v => v.toFixed(1));
		bindNumericSlider(dom.slant,       'slant',       v => parseInt(v, 10),  v => v + '°');
		// Proportionen
		bindNumericSlider(dom.xHeight,     'xHeight',     v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.capHeight,   'capHeight',   v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.ascender,    'ascender',    v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.descender,   'descender',   v => parseInt(v, 10),  v => v);
		// Formsprache
		bindNumericSlider(dom.aperture,    'aperture',    v => parseInt(v, 10),  v => v + '%');
		bindNumericSlider(dom.sidebearing, 'sidebearing', v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.cornerRadius,'cornerRadius',v => parseInt(v, 10),  v => v);
		bindNumericSlider(dom.bowlRadius,  'bowlRadius',  v => parseInt(v, 10),  v => v + '%');
		bindNumericSlider(dom.fraktur,     'fraktur',     v => parseInt(v, 10),  v => v + '%');
		bindNumericSlider(dom.ornament,    'ornament',    v => parseInt(v, 10),  v => v + '%');
		// Serifen
		bindNumericSlider(dom.serifSize,     'serifSize',      v => parseInt(v, 10), v => v);
		bindNumericSlider(dom.serifThickness,'serifThickness', v => parseInt(v, 10), v => v);

		// Serif-Style
		$$('[data-serif]').forEach(btn => {
			btn.addEventListener('click', () => {
				state.serifStyle = btn.dataset.serif;
				$$('[data-serif]').forEach(b => b.setAttribute('aria-pressed',
					b.dataset.serif === state.serifStyle ? 'true' : 'false'));
				scheduleRegenerate(0);
			});
		});

		// Vorschau (kein Regenerate nötig — nur Styles)
		dom.previewText.addEventListener('input', () => {
			state.previewText = dom.previewText.value;
			updatePreviewStyles();
		});
		dom.previewSize.addEventListener('input', () => {
			state.previewSize = parseInt(dom.previewSize.value, 10);
			dom.outputs.previewSize.textContent = state.previewSize + ' px';
			updatePreviewStyles();
		});
		dom.textColor.addEventListener('input',  () => { state.textColor = dom.textColor.value; dom.textColor.closest('.color-swatch').style.background = state.textColor; updatePreviewStyles(); });
		dom.textColor.addEventListener('change', () => { state.textColor = dom.textColor.value; dom.textColor.closest('.color-swatch').style.background = state.textColor; updatePreviewStyles(); });
		dom.bgColor.addEventListener('input',  () => { state.bgColor = dom.bgColor.value; dom.bgColor.closest('.color-swatch').style.background = state.bgColor; updatePreviewStyles(); });
		dom.bgColor.addEventListener('change', () => { state.bgColor = dom.bgColor.value; dom.bgColor.closest('.color-swatch').style.background = state.bgColor; updatePreviewStyles(); });

		// Text-Preset-Chips
		$$('[data-preset]').forEach(chip => {
			chip.addEventListener('click', () => {
				const key = chip.dataset.preset;
				let text = PRESET_TEXTS[key];
				if (key === 'name') text = state.fontName;
				if (text) {
					state.previewText = text;
					dom.previewText.value = text;
					updatePreviewStyles();
				}
			});
		});

		// Font-Stil-Preset-Chips
		$$('[data-preset-style]').forEach(chip => {
			chip.addEventListener('click', () => applyPreset(chip.dataset.presetStyle));
		});

		// Mode-Tabs
		$$('.mode-tabs .tab').forEach(tab => {
			tab.addEventListener('click', () => {
				state.mode = tab.dataset.mode;
				$$('.mode-tabs .tab').forEach(t => {
					const a = t.dataset.mode === state.mode;
					t.classList.toggle('active', a);
					t.setAttribute('aria-pressed', a ? 'true' : 'false');
				});
				updatePreviewStyles();
			});
		});

		// Header-Actions
		$$('[data-action]').forEach(btn => {
			btn.addEventListener('click', () => {
				if (btn.dataset.action === 'randomize') randomize();
				if (btn.dataset.action === 'reset')     reset();
				if (btn.dataset.action === 'showcase')  showcaseStart();
			});
		});

		// Export
		$$('[data-export]').forEach(btn => {
			btn.addEventListener('click', () => handleExport(btn.dataset.export, btn));
		});

		// Tastatur-Shortcuts
		document.addEventListener('keydown', e => {
			if (e.target.matches('input, textarea')) return;
			if (e.key === 'Escape') { showcaseStop(); return; }
			// Showcase-Zeicheneingabe hat Vorrang wenn Overlay offen
			if (_showcaseRunning) return;
			if (e.key === 'r' && !e.metaKey && !e.ctrlKey) randomize();
			if (e.key === 'R' && !e.metaKey && !e.ctrlKey) reset();
			if (e.key === 'f' && !e.metaKey && !e.ctrlKey) showcaseStart();
		});

		// Showcase schließen
		document.getElementById('showcaseClose').addEventListener('click', showcaseStop);
		document.getElementById('showcase').addEventListener('click', e => {
			if (e.target === e.currentTarget) showcaseStop();
		});
	}

	/* ---------------------------------------------------------------------- */
	/*  Showcase-Modus                                                         */
	/* ---------------------------------------------------------------------- */

	let _showcaseTimer  = null;
	let _showcaseRunning = false;

	const SHOWCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&?!';
	const SHOWCASE_PARAM_KEYS = [
		'weight','widthScale','contrast','slant',
		'xHeight','capHeight','ascender','descender',
		'aperture','sidebearing','cornerRadius','bowlRadius',
		'serifSize','serifThickness'
	];

	function showcaseRandTarget() {
		const rnd  = (min, max, step = 1) => Math.round((min + Math.random() * (max - min)) / step) * step;
		const pick = arr => arr[Math.floor(Math.random() * arr.length)];
		const crHidden = document.getElementById('cornerRadius')?.closest('.slider-row')?.style.display === 'none';
		return {
			weight:         rnd(28, 200),
			widthScale:     rnd(65, 135),
			contrast:       Math.round(rnd(1.0, 5.0) * 10) / 10,
			slant:          Math.random() < 0.55 ? 0 : rnd(-14, 14),
			xHeight:        rnd(380, 640, 10),
			capHeight:      rnd(580, 860, 10),
			ascender:       rnd(680, 950, 10),
			descender:      rnd(100, 280, 10),
			aperture:       rnd(15, 95),
			sidebearing:    rnd(10, 70),
			cornerRadius:   crHidden ? 0 : (Math.random() < 0.55 ? 0 : rnd(0, 80)),
			bowlRadius:     rnd(0, 100),
			serifStyle:     pick(['none','none','slab','hairline','wedge']),
			serifSize:      rnd(20, 90),
			serifThickness: rnd(8, 50),
		};
	}

	/* ---------------------------------------------------------------------- */
	/*  Hilfsfunktion: einen opentype-Pfad in einen Canvas-Kontext zeichnen   */
	/* ---------------------------------------------------------------------- */
	function replayPath(ctx, commands) {
		ctx.beginPath();
		for (const cmd of commands) {
			switch (cmd.type) {
				case 'M': ctx.moveTo(cmd.x, cmd.y); break;
				case 'L': ctx.lineTo(cmd.x, cmd.y); break;
				case 'C': ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); break;
				case 'Q': ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); break;
				case 'Z': ctx.closePath(); break;
			}
		}
	}

	/* ---------------------------------------------------------------------- */
	/*  SSAA-Renderer: Glyph bei 2× rendern, 2:1 downscalen.                 */
	/*  Mit korrektem Winding (partialRing/partialStadiumRing = CW Y-up wie  */
	/*  rect) addieren sich Überlappungsbereiche zu -2 → immer gefüllt.      */
	/*  Kein Threshold nötig, da keine Winding-Cancelation mehr auftritt.    */
	/* ---------------------------------------------------------------------- */
	function drawGlyphSSAA(ctx, glyph, ox, oy, fontSize, fillColor) {
		const SSAA = 2;
		const PAD  = 4;
		const upm  = currentFont.unitsPerEm || 1000;
		const asc  = currentFont.ascender   || 800;
		const desc = Math.abs(currentFont.descender || 200);
		const adv  = glyph.advanceWidth || upm * 0.6;
		const gW   = adv / upm * fontSize;
		const gH   = (asc + desc) / upm * fontSize;

		// Slant-Korrektur: slantPath verschiebt Punkte oben/unten horizontal.
		// Negativer Slant → Oberkante nach links → extra Platz links nötig.
		// Positiver Slant → Oberkante nach rechts → extra Platz rechts nötig.
		const slantTan   = Math.tan((state.slant || 0) * Math.PI / 180);
		const slantLeft  = slantTan < 0 ? Math.ceil(Math.abs(slantTan) * gH) : 0;
		const slantRight = slantTan > 0 ? Math.ceil(Math.abs(slantTan) * gH) : 0;

		const ow  = (Math.ceil(gW) + PAD * 2 + slantLeft + slantRight) * SSAA;
		const oh  = (Math.ceil(gH) + PAD * 2) * SSAA;
		const off = document.createElement('canvas');
		off.width  = ow;
		off.height = oh;
		const octx = off.getContext('2d');

		const baselineY = (PAD + asc / upm * fontSize) * SSAA;
		const leftX     = (PAD + slantLeft) * SSAA;
		const opPath    = glyph.getPath(leftX, baselineY, fontSize * SSAA);
		octx.fillStyle  = fillColor;
		replayPath(octx, opPath.commands);
		octx.fill('nonzero');

		// 2:1 Downscale → saubere AA an Außenkanten, keine internen Artefakte
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(off, 0, 0, ow, oh,
			ox - PAD - slantLeft,
			oy - asc / upm * fontSize - PAD,
			ow / SSAA,
			oh / SSAA);
	}

	/* ---------------------------------------------------------------------- */
	/*  Glyph direkt auf Canvas zeichnen (SSAA — keine Render-Seams)          */
	/* ---------------------------------------------------------------------- */

	function drawGlyphOnCanvas(ch, canvas, fillColor) {
		if (!currentFont) return;
		const glyph = currentFont.charToGlyph(ch);
		if (!glyph) return;

		const dpr = window.devicePixelRatio || 1;
		const W   = canvas.offsetWidth  || window.innerWidth;
		const H   = canvas.offsetHeight || window.innerHeight;
		canvas.width  = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);

		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.scale(dpr, dpr);

		const upm  = currentFont.unitsPerEm  || 1000;
		const asc  = currentFont.ascender    || 800;
		const desc = Math.abs(currentFont.descender || 200);
		const adv  = glyph.advanceWidth      || upm * 0.6;

		// Feste Größe: passt capHeight in 70% der Canvas-Höhe — kein dynamisches Rescaling.
		const capH     = state.capHeight || 700;
		const pad      = 0.15;
		// Ascender verwenden (höher als capHeight) damit Oberlängen nicht abgeschnitten werden
		const ascH     = state.ascender || 800;
		const fontSize = H * (1 - 2 * pad) / (ascH / upm) * 0.5;

		const glyphW = adv / upm * fontSize;
		const glyphH = (asc + desc) / upm * fontSize;
		const ox = (W - glyphW) / 2;
		const oy = (H - glyphH) / 2 + asc / upm * fontSize;

		drawGlyphSSAA(ctx, glyph, ox, oy, fontSize, fillColor || '#ffffff');
	}

	async function showcaseStart() {
		const overlay   = document.getElementById('showcase');
		if (!overlay) return;
		overlay.hidden = false;
		document.body.style.overflow = 'hidden';

		_showcaseRunning = true;

		const canvasEl = document.getElementById('showcaseCanvas');
		const metaEl   = document.getElementById('showcaseMeta');
		const hintEl   = document.getElementById('showcaseHint');
		const pick     = arr => arr[Math.floor(Math.random() * arr.length)];

		// Farbpaare: [Hintergrund, Glyphfarbe]
		const COLOR_PAIRS = [
			['#12111a', '#f0eeff'],
			['#0d1a12', '#e8fef0'],
			['#1a0d0d', '#fff0f0'],
			['#0d0d1a', '#e8eeff'],
			['#1a140d', '#fff8e8'],
			['#0d1a1a', '#e8fffe'],
			['#1a0d1a', '#fee8ff'],
			['#f0eeff', '#12111a'],
			['#e8fef0', '#0d1a12'],
			['#fff8e8', '#1a140d'],
			['#e8eeff', '#1a1030'],
		];

		let curColors = pick(COLOR_PAIRS);
		let tgtColors = pick(COLOR_PAIRS);

		function lerpColor(c1, c2, t) {
			const parse = h => [
				parseInt(h.slice(1,3),16),
				parseInt(h.slice(3,5),16),
				parseInt(h.slice(5,7),16)
			];
			const [r1,g1,b1] = parse(c1);
			const [r2,g2,b2] = parse(c2);
			const r = Math.round(r1 + (r2-r1)*t);
			const g = Math.round(g1 + (g2-g1)*t);
			const b = Math.round(b1 + (b2-b1)*t);
			return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
		}

		// Helligkeit eines Hex-Farbwertes (0=dunkel, 1=hell)
		function brightness(hex) {
			const r = parseInt(hex.slice(1,3),16);
			const g = parseInt(hex.slice(3,5),16);
			const b = parseInt(hex.slice(5,7),16);
			return (r * 299 + g * 587 + b * 114) / 255000;
		}
		// true = positiv (heller Hintergrund), false = negativ (dunkler Hintergrund)
		function isPositive(colors) { return brightness(colors[0]) > 0.5; }

		let chars  = [pick(SHOWCASE_CHARS.split(''))];
		let currentChar = chars[0];
		let currentGlyphColor = curColors[1];

		function renderChar() {
			drawGlyphOnCanvas(currentChar, canvasEl, currentGlyphColor);
		}

		// Tastatur-Handler
		function onKey(e) {
			if (!_showcaseRunning) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === 'Escape') return;
			const ch = e.key;
			if (ch.length === 1 && SHOWCASE_CHARS.includes(ch)) {
				currentChar = ch;
				canvasEl.classList.remove('visible');
				setTimeout(() => {
					renderChar();
					canvasEl.classList.add('visible');
				}, 150);
				hintEl.textContent = `„${ch}"`;
				hintEl.style.opacity = '1';
				clearTimeout(_showcaseHintTimer);
				_showcaseHintTimer = setTimeout(() => { hintEl.style.opacity = '0'; }, 1800);
			}
		}
		document.addEventListener('keydown', onKey);

		hintEl.textContent = `„${currentChar}" — tippe einen Buchstaben`;
		hintEl.style.opacity = '1';
		clearTimeout(_showcaseHintTimer);
		_showcaseHintTimer = setTimeout(() => { hintEl.style.opacity = '0'; }, 3500);

		let cur = showcaseRandTarget();
		let tgt = showcaseRandTarget();
		let t   = 0;
		const STEP = 0.05;
		const TICK = 180;

		async function tick() {
			if (!_showcaseRunning) return;

			t += STEP;
			if (t >= 1) {
				cur = tgt;
				tgt = showcaseRandTarget();
				curColors = tgtColors;
				tgtColors = pick(COLOR_PAIRS);
				t   = 0;
			}

			const lerp = (a, b) => a + (b - a) * t;
			const p = {};
			SHOWCASE_PARAM_KEYS.forEach(k => { p[k] = lerp(cur[k], tgt[k]); });
			p.serifStyle = t < 0.5 ? cur.serifStyle : tgt.serifStyle;
			p.fraktur    = 0;
			p.ornament   = 0;
			p.mode       = 'free';
			p.fontName   = 'ShowcaseFont';

			// Farben interpolieren — bei Positiv↔Negativ-Wechsel sofort umschalten (kein Lerp)
			const modeSwitch = isPositive(curColors) !== isPositive(tgtColors);
			const colorT     = modeSwitch ? (t < 0.5 ? 0 : 1) : t;
			const bgColor    = lerpColor(curColors[0], tgtColors[0], colorT);
			const glyphColor = lerpColor(curColors[1], tgtColors[1], colorT);
			overlay.style.background = bgColor;
			// UI-Modus (positiv/negativ) mitschalten
			document.body.classList.toggle('showcase-positive', isPositive(colorT < 0.5 ? curColors : tgtColors));
			currentGlyphColor = glyphColor;

			Object.assign(state, p);

			try {
				await regenerate();
				if (!_showcaseRunning) return;
				renderChar();
				const serif = p.serifStyle === 'none' ? '—' : p.serifStyle;
				metaEl.textContent =
					`wt ${Math.round(p.weight)}  ` +
					`wd ${Math.round(p.widthScale)}%  ` +
					`ct ${p.contrast.toFixed(1)}  ` +
					`${serif}` +
					(Math.abs(p.slant) > 1 ? `  ${Math.round(p.slant)}°` : '');
			} catch(e) { /* ignore */ }

			if (_showcaseRunning) _showcaseTimer = setTimeout(tick, TICK);
		}

		canvasEl.classList.remove('visible');
		await new Promise(r => setTimeout(r, 50));
		renderChar();
		canvasEl.classList.add('visible');
		tick();

		overlay._onKey = onKey;
	}

	let _showcaseHintTimer = null;

	function showcaseStop() {
		_showcaseRunning = false;
		clearTimeout(_showcaseTimer);
		clearTimeout(_showcaseHintTimer);
		const overlay = document.getElementById('showcase');
		if (overlay) {
			const canvasEl = document.getElementById('showcaseCanvas');
			if (canvasEl) canvasEl.classList.remove('visible');
			if (overlay._onKey) {
				document.removeEventListener('keydown', overlay._onKey);
				overlay._onKey = null;
			}
			overlay.hidden = true;
		}
		document.body.style.overflow = '';
		document.body.classList.remove('showcase-positive');
		syncInputs();
		scheduleRegenerate(0);
	}

	/* ---------------------------------------------------------------------- */
	/*  Init                                                                    */
	/* ---------------------------------------------------------------------- */

	async function init() {
		if (!window.opentype) {
			setStatus('opentype.js konnte nicht geladen werden', 'error');
			return;
		}
		// Auf Mobile: Standardgröße auf 37px setzen
		if (window.innerWidth < 600) {
			state.previewSize = 37;
		}
		// Namen beim Start generieren
		state.fontName = generateFontName(state);
		syncInputs();
		syncOutputs();
		bindEvents();
		await regenerate();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
