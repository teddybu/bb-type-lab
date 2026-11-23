/*
 * Node-Testrunner:
 *  - lädt opentype.js und glyphs.js in eine Sandbox,
 *  - baut einen Font mit Default-Parametern,
 *  - schreibt Sample-TTFs zum manuellen Prüfen,
 *  - prüft, dass jeder Glyph valide Konturen liefert.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const opentype = require('opentype.js');

// glyphs.js in einer Sandbox laden, damit `window.GlyphEngine = ...` funktioniert
const sandbox = { window: {}, opentype };
sandbox.window.opentype = opentype;
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, 'glyphs.js'), 'utf8');
vm.runInContext(code, sandbox);

const GlyphEngine = sandbox.window.GlyphEngine;
if (!GlyphEngine) throw new Error('GlyphEngine wurde nicht global gesetzt');

// Presets, die getestet werden
const PRESETS = {
	'clean-sans':    { fontName: 'Aurora Sans',      weight: 70,  widthScale: 100, contrast: 1.0, slant: 0,  xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none',    serifSize: 40, serifThickness: 20 },
	'rounded':       { fontName: 'Rounded',          weight: 90,  widthScale: 100, contrast: 1.0, slant: 0,  xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none',    serifSize: 40, serifThickness: 20, cornerRadius: 60 },
	'bold-slab':     { fontName: 'Boulder Slab',     weight: 140, widthScale: 105, contrast: 1.0, slant: 0,  xHeight: 500, capHeight: 700, ascender: 780, descender: 200, aperture: 45, sidebearing: 55, serifStyle: 'slab',    serifSize: 60, serifThickness: 40 },
	'thin-elegant':  { fontName: 'Filigree',         weight: 32,  widthScale: 92,  contrast: 3.2, slant: 0,  xHeight: 480, capHeight: 720, ascender: 850, descender: 220, aperture: 60, sidebearing: 40, serifStyle: 'hairline',serifSize: 55, serifThickness: 12 },
	'italic':        { fontName: 'Aurora Italic',    weight: 70,  widthScale: 96,  contrast: 1.4, slant: 12, xHeight: 500, capHeight: 720, ascender: 810, descender: 210, aperture: 55, sidebearing: 45, serifStyle: 'none',    serifSize: 40, serifThickness: 20 },
	'wedge-display': { fontName: 'Kolossos Display', weight: 180, widthScale: 115, contrast: 1.0, slant: 0,  xHeight: 540, capHeight: 780, ascender: 820, descender: 180, aperture: 35, sidebearing: 60, serifStyle: 'wedge',   serifSize: 80, serifThickness: 40 }
};

const outDir = path.join(__dirname, '_test-output');
fs.mkdirSync(outDir, { recursive: true });

const summary = [];

for (const [key, s] of Object.entries(PRESETS)) {
	const params = GlyphEngine.normalizeParams({
		unitsPerEm: 1000,
		stem: s.weight,
		widthScale: s.widthScale,
		contrast: s.contrast,
		slant: s.slant,
		xHeight: s.xHeight,
		capHeight: s.capHeight,
		ascender: s.ascender,
		descender: s.descender,
		aperture: s.aperture,
		sidebearing: s.sidebearing,
		serifStyle: s.serifStyle,
		serifSize: s.serifSize,
		serifThickness: s.serifThickness,
		cornerRadius: s.cornerRadius || 0,
		bowlRadius: s.bowlRadius != null ? s.bowlRadius : 100
	});

	const notdef = new opentype.Glyph({
		name: '.notdef',
		unicode: 0,
		advanceWidth: Math.round(params.stem * 5),
		path: (() => {
			const p = new opentype.Path();
			p.moveTo(50, 0); p.lineTo(50, params.capHeight);
			p.lineTo(params.stem * 3, params.capHeight); p.lineTo(params.stem * 3, 0); p.close();
			return p;
		})()
	});

	const glyphs = [notdef];
	let brokenCount = 0;
	const broken = [];
	for (let cp = 0x20; cp <= 0x7E; cp++) {
		const ch = String.fromCodePoint(cp);
		const g = GlyphEngine.buildGlyph(ch, cp, ch === ' ' ? 'space' : `u${cp.toString(16).toUpperCase()}`, params);
		// Sanity: keine NaN
		for (const cmd of g.path.commands) {
			for (const k of ['x','y','x1','y1','x2','y2']) {
				if (typeof cmd[k] === 'number' && !Number.isFinite(cmd[k])) {
					brokenCount++;
					broken.push(`${ch} (${cp.toString(16)}): ${k}=${cmd[k]}`);
					break;
				}
			}
		}
		glyphs.push(g);
	}
	for (const ch of ['ä','ö','ü','Ä','Ö','Ü','ß']) {
		const cp = ch.codePointAt(0);
		glyphs.push(GlyphEngine.buildGlyph(ch, cp, `u${cp.toString(16).toUpperCase()}`, params));
	}

	const font = new opentype.Font({
		familyName: s.fontName,
		styleName: 'Regular',
		unitsPerEm: 1000,
		ascender: Math.round(s.ascender),
		descender: -Math.round(s.descender),
		glyphs
	});

	let buffer;
	try {
		buffer = font.toArrayBuffer();
	} catch (err) {
		console.error(`❌ Konnte ${key} nicht in ArrayBuffer serialisieren:`, err.message);
		summary.push({ key, ok: false, error: err.message });
		continue;
	}

	const outPath = path.join(outDir, `${key}.ttf`);
	fs.writeFileSync(outPath, Buffer.from(buffer));
	summary.push({
		key,
		ok: brokenCount === 0,
		glyphs: glyphs.length,
		bytes: buffer.byteLength,
		broken: brokenCount,
		file: path.relative(__dirname, outPath),
		brokenSample: broken.slice(0, 5)
	});
}

console.log('=== Font-Generierung — Ergebnisse ===\n');
for (const row of summary) {
	if (row.ok) {
		console.log(`✅ ${row.key.padEnd(15)}  ${row.glyphs} Glyphs  ${(row.bytes/1024).toFixed(1)} KB  → ${row.file}`);
	} else {
		console.log(`⚠️  ${row.key.padEnd(15)}  ${row.broken} broken commands`);
		row.brokenSample.forEach(s => console.log(`     · ${s}`));
	}
}

// Round-trip: eine TTF wieder laden und Glyphs prüfen
const first = summary.find(s => s.ok);
if (first) {
	const buf = fs.readFileSync(path.join(__dirname, first.file));
	const loaded = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
	console.log(`\n🔁 Roundtrip ${first.file}:  ${loaded.glyphs.length} Glyphs geladen`);
	// Stichprobe: 3 Zeichen
	for (const ch of ['A', 'a', '&']) {
		const g = loaded.charToGlyph(ch);
		console.log(`   ${ch} → advance=${g.advanceWidth}, commands=${g.path.commands.length}`);
	}
}
