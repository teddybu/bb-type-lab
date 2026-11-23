/*
 * Rendert Preview-PNGs der generierten Fonts (Node + node-canvas + opentype.js).
 * Nutzt opentype.Font.draw(ctx, text, x, y, fontSize) – damit sehen wir,
 * ob die Glyphen so aussehen wie erwartet.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas } = require('canvas');
const opentype = require('opentype.js');

// Sandbox laden
const sandbox = { window: {}, opentype };
sandbox.window.opentype = opentype;
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'glyphs.js'), 'utf8'), sandbox);
const GlyphEngine = sandbox.window.GlyphEngine;

const PRESETS = {
	'clean-sans':    { fontName: 'Aurora Sans',      weight: 70,  widthScale: 100, contrast: 1.0, slant: 0,  xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none',     serifSize: 40, serifThickness: 20 },
	'rounded':       { fontName: 'Rounded',          weight: 90,  widthScale: 100, contrast: 1.0, slant: 0,  xHeight: 520, capHeight: 720, ascender: 820, descender: 200, aperture: 55, sidebearing: 45, serifStyle: 'none',     serifSize: 40, serifThickness: 20, cornerRadius: 60 },
	'bold-slab':     { fontName: 'Boulder Slab',     weight: 140, widthScale: 105, contrast: 1.0, slant: 0,  xHeight: 500, capHeight: 700, ascender: 780, descender: 200, aperture: 45, sidebearing: 55, serifStyle: 'slab',     serifSize: 60, serifThickness: 40 },
	'thin-elegant':  { fontName: 'Filigree',         weight: 32,  widthScale: 92,  contrast: 3.2, slant: 0,  xHeight: 480, capHeight: 720, ascender: 850, descender: 220, aperture: 60, sidebearing: 40, serifStyle: 'hairline', serifSize: 55, serifThickness: 12 },
	'italic':        { fontName: 'Aurora Italic',    weight: 70,  widthScale: 96,  contrast: 1.4, slant: 12, xHeight: 500, capHeight: 720, ascender: 810, descender: 210, aperture: 55, sidebearing: 45, serifStyle: 'none',     serifSize: 40, serifThickness: 20 },
	'wedge-display': { fontName: 'Kolossos Display', weight: 180, widthScale: 115, contrast: 1.0, slant: 0,  xHeight: 540, capHeight: 780, ascender: 820, descender: 180, aperture: 35, sidebearing: 60, serifStyle: 'wedge',    serifSize: 80, serifThickness: 40 }
};

const outDir = path.join(__dirname, '_test-output');
fs.mkdirSync(outDir, { recursive: true });

function buildFont(s) {
	const params = GlyphEngine.normalizeParams({
		unitsPerEm: 1000, stem: s.weight, widthScale: s.widthScale, contrast: s.contrast,
		slant: s.slant, xHeight: s.xHeight, capHeight: s.capHeight, ascender: s.ascender,
		descender: s.descender, aperture: s.aperture, sidebearing: s.sidebearing,
		serifStyle: s.serifStyle, serifSize: s.serifSize, serifThickness: s.serifThickness,
		cornerRadius: s.cornerRadius || 0,
		bowlRadius: s.bowlRadius != null ? s.bowlRadius : 100
	});
	const glyphs = [new opentype.Glyph({
		name: '.notdef', unicode: 0, advanceWidth: params.stem * 5,
		path: (() => { const p = new opentype.Path(); p.moveTo(50, 0); p.lineTo(50, params.capHeight); p.lineTo(params.stem*3, params.capHeight); p.lineTo(params.stem*3, 0); p.close(); return p; })()
	})];
	for (let cp = 0x20; cp <= 0x7E; cp++) {
		const ch = String.fromCodePoint(cp);
		glyphs.push(GlyphEngine.buildGlyph(ch, cp, ch === ' ' ? 'space' : `u${cp.toString(16).toUpperCase()}`, params));
	}
	for (const ch of ['ä','ö','ü','Ä','Ö','Ü','ß']) {
		const cp = ch.codePointAt(0);
		glyphs.push(GlyphEngine.buildGlyph(ch, cp, `u${cp.toString(16).toUpperCase()}`, params));
	}
	return new opentype.Font({
		familyName: s.fontName, styleName: 'Regular', unitsPerEm: 1000,
		ascender: Math.round(s.ascender), descender: -Math.round(s.descender), glyphs
	});
}

for (const [key, s] of Object.entries(PRESETS)) {
	const font = buildFont(s);
	font.kerningPairs = {};  // opentype.js draw() erwartet ein Objekt (fresh fonts haben undefined)
	const W = 1600, H = 900;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#0f0f18';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#f5f5ff';

	// Font-Name Riesig oben
	font.draw(ctx, s.fontName, 60, 300, 200);
	// Pangram
	font.draw(ctx, 'The quick brown fox', 60, 500, 80);
	font.draw(ctx, 'jumps over the lazy dog', 60, 620, 80);
	// Ziffern
	font.draw(ctx, '0123456789 &@#!?', 60, 780, 60);

	fs.writeFileSync(path.join(outDir, `${key}-preview.png`), canvas.toBuffer('image/png'));
	console.log(`🖼   ${key}-preview.png`);
}

// Zusätzlich: großes Alphabet-Sheet für den clean-sans Font
{
	const font = buildFont(PRESETS['clean-sans']);
	font.kerningPairs = {};
	const W = 1600, H = 1100;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#0f0f18';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#f5f5ff';
	const rows = [
		'ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ',
		'abcdefghijklm', 'nopqrstuvwxyz',
		'0123456789 &@#()',
		'.,;:!?"\'-+=/*',
		'ÄÖÜäöüß'
	];
	let y = 130;
	for (const r of rows) {
		font.draw(ctx, r, 40, y, 110);
		y += 130;
	}
	fs.writeFileSync(path.join(outDir, 'alphabet-sheet.png'), canvas.toBuffer('image/png'));
	console.log('🖼   alphabet-sheet.png');
}

// Alphabet-Sheet für "rounded" (cornerRadius=60)
{
	const font = buildFont(PRESETS['rounded']);
	font.kerningPairs = {};
	const W = 1600, H = 1100;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#0f0f18';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#f5f5ff';
	const rows = [
		'ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ',
		'HELFT ILL',
		'HEFT TIEF',
		'0123456789'
	];
	let y = 130;
	for (const r of rows) {
		font.draw(ctx, r, 40, y, 110);
		y += 130;
	}
	fs.writeFileSync(path.join(outDir, 'rounded-sheet.png'), canvas.toBuffer('image/png'));
	console.log('🖼   rounded-sheet.png');
}

// Bowl-Radius-Vergleich: BPR D in drei Varianten (0% / 50% / 100%)
{
	const W = 1600, H = 900;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#0f0f18';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#f5f5ff';
	const base = Object.assign({}, PRESETS['clean-sans']);
	base.weight = 110;
	const variants = [
		{ label: 'bowlRadius 0%',   bowlRadius: 0 },
		{ label: 'bowlRadius 50%',  bowlRadius: 50 },
		{ label: 'bowlRadius 100%', bowlRadius: 100 }
	];
	let y = 200;
	for (const v of variants) {
		const font = buildFont(Object.assign({}, base, v));
		font.kerningPairs = {};
		ctx.font = '20px sans-serif';
		ctx.fillText(v.label, 40, y - 130);
		font.draw(ctx, 'BPRD OQGC UJ 08 abcdeognqsu', 40, y, 100);
		y += 200;
	}
	fs.writeFileSync(path.join(outDir, 'bowl-radius-compare.png'), canvas.toBuffer('image/png'));
	console.log('🖼   bowl-radius-compare.png');
}

console.log('\nFertig — Bilder in _test-output/');
