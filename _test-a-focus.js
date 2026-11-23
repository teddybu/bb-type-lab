/*
 * Fokus-Test für 'a': verschiedene Weight/Width-Kombinationen um zu prüfen,
 * ob Bowl und Stem nahtlos verschmelzen und der Balken sauber sitzt.
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
		unitsPerEm: 1000, stem: s.weight, widthScale: s.widthScale || 100,
		contrast: s.contrast || 1.0, slant: s.slant || 0,
		xHeight: s.xHeight || 500, capHeight: s.capHeight || 720,
		ascender: s.ascender || 800, descender: s.descender || 200,
		aperture: s.aperture || 55, sidebearing: s.sidebearing || 50,
		serifStyle: s.serifStyle || 'none', serifSize: s.serifSize || 40,
		serifThickness: s.serifThickness || 20
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
		familyName: 'a-focus', styleName: 'Regular', unitsPerEm: 1000,
		ascender: Math.round(params.ascender), descender: -Math.round(params.descender), glyphs
	});
}

const CASES = [
	{ label: 'w=32 c=3.2 (thin)',   weight:  32, contrast: 3.2 },
	{ label: 'w=70 (regular)',      weight:  70 },
	{ label: 'w=140 (bold)',        weight: 140 },
	{ label: 'w=200 narrow (s60)',  weight: 200, widthScale: 60 },
	{ label: 'w=100 wide (s140)',   weight: 100, widthScale: 140 },
	{ label: 'w=180 wedge display', weight: 180, widthScale: 115, serifStyle: 'wedge', serifSize: 80, serifThickness: 40 },
];

const outDir = path.join(__dirname, '_test-output');
const W = 1800, H = 700;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#0f0f18';
ctx.fillRect(0, 0, W, H);

const cellW = W / 3;
const cellH = H / 2;

CASES.forEach((c, i) => {
	const row = Math.floor(i / 3);
	const col = i % 3;
	const cx = col * cellW;
	const cy = row * cellH;
	const font = buildFont(c);
	font.kerningPairs = {};
	ctx.fillStyle = '#8090c0';
	ctx.font = '14px sans-serif';
	ctx.fillText(c.label, cx + 20, cy + 25);
	ctx.fillStyle = '#f5f5ff';
	font.draw(ctx, 'aaa', cx + 30, cy + cellH - 40, 220);
});

fs.writeFileSync(path.join(outDir, 'a-focus.png'), canvas.toBuffer('image/png'));
console.log('🖼   a-focus.png');
