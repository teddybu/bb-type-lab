/*
 * Rendert einen Vergleich der optimierten Glyphen (e A G a f g j m) und ihrer
 * Nachbarn (n h für Konsistenz) über verschiedene Weight/Width-Kombinationen.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas } = require('canvas');
const opentype = require('opentype.js');

const sandbox = { window: {}, opentype };
sandbox.window.opentype = opentype;
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'glyphs.js'), 'utf8'), sandbox);
const GlyphEngine = sandbox.window.GlyphEngine;

function buildFont(s) {
	const params = GlyphEngine.normalizeParams({
		unitsPerEm: 1000, stem: s.weight, widthScale: s.widthScale, contrast: s.contrast,
		slant: s.slant || 0, xHeight: s.xHeight, capHeight: s.capHeight,
		ascender: s.ascender, descender: s.descender, aperture: s.aperture,
		sidebearing: s.sidebearing, serifStyle: s.serifStyle, serifSize: s.serifSize,
		serifThickness: s.serifThickness
	});
	const glyphs = [new opentype.Glyph({
		name: '.notdef', unicode: 0, advanceWidth: params.stem * 5,
		path: (() => { const p = new opentype.Path(); p.moveTo(50, 0); p.lineTo(50, params.capHeight); p.lineTo(params.stem*3, params.capHeight); p.lineTo(params.stem*3, 0); p.close(); return p; })()
	})];
	for (let cp = 0x20; cp <= 0x7E; cp++) {
		const ch = String.fromCodePoint(cp);
		glyphs.push(GlyphEngine.buildGlyph(ch, cp, ch === ' ' ? 'space' : `u${cp.toString(16).toUpperCase()}`, params));
	}
	return new opentype.Font({
		familyName: s.fontName, styleName: 'Regular', unitsPerEm: 1000,
		ascender: Math.round(s.ascender), descender: -Math.round(s.descender), glyphs
	});
}

const outDir = path.join(__dirname, '_test-output');

// Testreihe: die 8 optimierten Glyphen bei verschiedenen Gewichten/Breiten
const VARIANTS = [
	{ label: 'clean-sans (w70 s100)', s: { fontName: 'Aurora Sans', weight: 70, widthScale: 100, contrast: 1.0, xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none', serifSize: 40, serifThickness: 20 } },
	{ label: 'bold-slab (w140 s105)', s: { fontName: 'Boulder', weight: 140, widthScale: 105, contrast: 1.0, xHeight: 500, capHeight: 700, ascender: 780, descender: 200, aperture: 45, sidebearing: 55, serifStyle: 'slab', serifSize: 60, serifThickness: 40 } },
	{ label: 'thin (w32 s92 c3.2)',   s: { fontName: 'Filigree', weight: 32, widthScale: 92, contrast: 3.2, xHeight: 480, capHeight: 720, ascender: 850, descender: 220, aperture: 60, sidebearing: 40, serifStyle: 'hairline', serifSize: 55, serifThickness: 12 } },
	{ label: 'heavy narrow (w200 s60)', s: { fontName: 'Compact', weight: 200, widthScale: 60, contrast: 1.0, xHeight: 520, capHeight: 720, ascender: 800, descender: 200, aperture: 40, sidebearing: 30, serifStyle: 'none', serifSize: 30, serifThickness: 20 } },
];

const W = 1800, H = 1000;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#0f0f18';
ctx.fillRect(0, 0, W, H);

let y = 60;
for (const v of VARIANTS) {
	const font = buildFont(v.s);
	font.kerningPairs = {};
	ctx.fillStyle = '#8090c0';
	ctx.font = '14px sans-serif';
	ctx.fillText(v.label, 40, y);
	ctx.fillStyle = '#f5f5ff';
	// Uppercase A G — dann lowercase e a f g h j m n
	font.draw(ctx, 'A G  e a f g h j m n', 40, y + 145, 140);
	y += 240;
}

fs.writeFileSync(path.join(outDir, 'focus-glyphs.png'), canvas.toBuffer('image/png'));
console.log('🖼   focus-glyphs.png');
