/* =============================================================================
   Variable Font Creator — glyphs.js
   Prozedurale Glyph-Engine: erzeugt Vektorpfade für Buchstaben, Ziffern
   und Interpunktion basierend auf einem Parameter-Objekt (`p`).

   Koordinaten-System: Y-nach-oben (Font-Konvention).
   Ursprung jedes Glyphs = (0, baseline). Ink wird von x=0 bis x=letterW gezeichnet.
   Fill-Konvention: Alle geschlossenen Konturen im Uhrzeigersinn (CW in Y-up),
   Löcher gegen den Uhrzeigersinn (CCW). Non-zero winding rule.
   ============================================================================= */
(function (global) {
	'use strict';

	const KAPPA_BASE = 0.5522847498307936;  // Bezier-Circle-Approximation
	let   KAPPA      = KAPPA_BASE;           // wird per fraktur dynamisch reduziert
	const TAU   = Math.PI * 2;

	/* ---------------------------------------------------------------------- */
	/* Basis-Primitiven                                                       */
	/* ---------------------------------------------------------------------- */

	// Rechteck als CW-Kontur (Y-up): BL → TL → TR → BR
	function rect(path, x, y, w, h) {
		if (w <= 0 || h <= 0) return;
		path.moveTo(x, y);
		path.lineTo(x, y + h);
		path.lineTo(x + w, y + h);
		path.lineTo(x + w, y);
		path.close();
	}

	// Rechteck als CCW-Kontur (Loch, Non-zero Winding).
	function rectHole(path, x, y, w, h) {
		if (w <= 0 || h <= 0) return;
		path.moveTo(x, y);
		path.lineTo(x + w, y);
		path.lineTo(x + w, y + h);
		path.lineTo(x, y + h);
		path.close();
	}

	// Rechteck mit runden Ecken (Y-up, CW).
	// r: gewünschter Radius (wird auf min(w,h)/2 begrenzt).
	// corners: {tl, tr, br, bl} — je 1 = rund, 0 = eckig (default: alle 1).
	// Reihenfolge CW in Y-up: BL → TL → TR → BR
	function roundRect(path, x, y, w, h, r, corners) {
		if (w <= 0 || h <= 0) return;
		const c = corners || { tl: 1, tr: 1, br: 1, bl: 1 };
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		if (r < 0.5) { rect(path, x, y, w, h); return; }
		const rTL = c.tl ? r : 0;
		const rTR = c.tr ? r : 0;
		const rBR = c.br ? r : 0;
		const rBL = c.bl ? r : 0;
		const k = KAPPA;
		path.moveTo(x, y + rBL);
		path.lineTo(x, y + h - rTL);
		if (rTL > 0) path.curveTo(x, y+h-rTL+rTL*k, x+rTL-rTL*k, y+h, x+rTL, y+h);
		else         path.lineTo(x, y+h);
		path.lineTo(x + w - rTR, y + h);
		if (rTR > 0) path.curveTo(x+w-rTR+rTR*k, y+h, x+w, y+h-rTR+rTR*k, x+w, y+h-rTR);
		else         path.lineTo(x+w, y+h);
		path.lineTo(x + w, y + rBR);
		if (rBR > 0) path.curveTo(x+w, y+rBR-rBR*k, x+w-rBR+rBR*k, y, x+w-rBR, y);
		else         path.lineTo(x+w, y);
		path.lineTo(x + rBL, y);
		if (rBL > 0) path.curveTo(x+rBL-rBL*k, y, x, y+rBL-rBL*k, x, y+rBL);
		else         path.lineTo(x, y);
		path.close();
	}

	// Dickes Diagonalen-Segment (Parallelogramm) — Endkappen SENKRECHT zur
	// Diagonalen-Richtung. Für einzelne Diagonalen ohne Junction (z. B. der
	// Schwanz des Q).
	function diag(path, x1, y1, x2, y2, thickness) {
		const dx = x2 - x1, dy = y2 - y1;
		const len = Math.hypot(dx, dy);
		if (len < 0.001) return;
		const nx = -dy / len * (thickness / 2);
		const ny =  dx / len * (thickness / 2);
		path.moveTo(x1 + nx, y1 + ny);
		path.lineTo(x2 + nx, y2 + ny);
		path.lineTo(x2 - nx, y2 - ny);
		path.lineTo(x1 - nx, y1 - ny);
		path.close();
	}

	// Diagonaler Strich mit HORIZONTALEN Endkappen bei y1 und y2. Die
	// perpendikuläre Strichdicke ist `stemWidth`; die horizontale Breite
	// wird daraus geometrisch abgeleitet. So können sich mehrere Diagonalen,
	// die an gemeinsamen y-Werten enden (Baseline, x-Höhe, Cap-Höhe),
	// SAUBER überlappen — jede Endkappe ist eine horizontale Linie, keine
	// schräge. Nutzung: V, W, A, M, X, Y, N, K, k, v, w, x, y usw.
	//
	// opts.anchor1 / opts.anchor2: 'center' (default) | 'left' | 'right'.
	// 'left' → Endkappe liegt rechts vom Endpunkt (Endpunkt = linke Kante),
	// 'right' → Endkappe liegt links vom Endpunkt (Endpunkt = rechte Kante).
	function diagH(path, x1, y1, x2, y2, stemWidth, opts) {
		opts = opts || {};
		const dy = y2 - y1;
		if (Math.abs(dy) < 1e-3) {
			// Fast horizontal — degeneriere zu einem Rechteck
			rect(path, Math.min(x1, x2), Math.min(y1, y2) - stemWidth / 2,
			     Math.abs(x2 - x1), stemWidth);
			return;
		}
		const dx = x2 - x1;
		const L  = Math.hypot(dx, dy);
		// Horizontale Breite so, dass die perpendikuläre Dicke = stemWidth
		const hW = stemWidth * L / Math.abs(dy);
		const hw = hW / 2;
		const anchor1 = opts.anchor1 || 'center';
		const anchor2 = opts.anchor2 || 'center';

		const [x1L, x1R] =
			anchor1 === 'left'  ? [x1, x1 + hW] :
			anchor1 === 'right' ? [x1 - hW, x1] :
			                      [x1 - hw, x1 + hw];
		const [x2L, x2R] =
			anchor2 === 'left'  ? [x2, x2 + hW] :
			anchor2 === 'right' ? [x2 - hW, x2] :
			                      [x2 - hw, x2 + hw];

		// Winding normalisieren: alle diagH-Formen müssen CW in Y-up sein (= -1 in
		// Canvas), damit sie sich mit rect/vStem/hBar (-1) addieren (→ -2, gefüllt)
		// statt aufheben (→ 0, Loch/Seam). dy<0 (abwärts) ist von Natur aus CCW (+1)
		// und muss umgekehrt werden; dy>0 (aufwärts) ist von Natur aus CW (-1).
		if (dy < 0) {
			path.moveTo(x1R, y1);
			path.lineTo(x2R, y2);
			path.lineTo(x2L, y2);
			path.lineTo(x1L, y1);
		} else {
			path.moveTo(x1L, y1);
			path.lineTo(x2L, y2);
			path.lineTo(x2R, y2);
			path.lineTo(x1R, y1);
		}
		path.close();
	}

	// Elliptischer Bogen von startAngle bis endAngle. Richtung
	// ergibt sich aus dem Vorzeichen von (endAngle - startAngle).
	// mode: 'move' = beginnt mit moveTo, 'line' = beginnt mit lineTo.
	function arc(path, cx, cy, rx, ry, startAngle, endAngle, mode) {
		const total = endAngle - startAngle;
		if (Math.abs(total) < 1e-6) return;
		const nSeg = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 4)));
		const dT   = total / nSeg;
		// KAPPA skaliert die Bézier-Krümmung: 0 → spitze Ecken, KAPPA_BASE → runder Bogen
		const h    = (4 / 3 * Math.tan(dT / 4)) * (KAPPA / KAPPA_BASE);
		const sx = cx + rx * Math.cos(startAngle);
		const sy = cy + ry * Math.sin(startAngle);
		if (mode === 'move') path.moveTo(sx, sy);
		else                 path.lineTo(sx, sy);
		let a = startAngle;
		for (let i = 0; i < nSeg; i++) {
			const b   = a + dT;
			const c1x = cx + rx * (Math.cos(a) - h * Math.sin(a));
			const c1y = cy + ry * (Math.sin(a) + h * Math.cos(a));
			const c2x = cx + rx * (Math.cos(b) + h * Math.sin(b));
			const c2y = cy + ry * (Math.sin(b) - h * Math.cos(b));
			const ex  = cx + rx * Math.cos(b);
			const ey  = cy + ry * Math.sin(b);
			path.curveTo(c1x, c1y, c2x, c2y, ex, ey);
			a = b;
		}
	}

	// Volle Ellipse (CW-Kontur, Y-up: 0 → -π/2 → -π → -3π/2 → -2π).
	function ellipse(path, cx, cy, rx, ry) {
		arc(path, cx, cy, rx, ry, 0, -TAU, 'move');
		path.close();
	}

	// Ellipse als CCW-Kontur (Loch).
	function ellipseHole(path, cx, cy, rx, ry) {
		arc(path, cx, cy, rx, ry, 0, TAU, 'move');
		path.close();
	}

	// Ring: außen gefüllt + innen Loch (klassische Ellipse, Legacy).
	function ring(path, cx, cy, rx, ry, thickH, thickV) {
		ellipse(path, cx, cy, rx, ry);
		const ix = rx - thickH, iy = ry - thickV;
		if (ix > 2 && iy > 2) ellipseHole(path, cx, cy, ix, iy);
	}

	// Stadion-Ring (geschlossen, hohl): horizontal orientiertes Stadion
	// bei radius01 < 1, klassische Ellipse bei radius01 >= 1.
	//   cx, cy         Zentrum
	//   rx, ry         Halb-Achsen (Bounding-Box-Radius)
	//   thickH, thickV Wandstärke horizontal / vertikal
	//   radius01       0..1 — 1 = Ellipse, 0 = reines Rechteck.
	//                  Werte dazwischen: Rechteck mit Halbkreis-Kappen links & rechts.
	// Kappenradius R = ry * radius01. Bei R < rx entstehen gerade oberer/unterer Balken.
	function stadiumRing(path, cx, cy, rx, ry, thickH, thickV, radius01) {
		radius01 = (radius01 == null) ? 1 : Math.max(0, Math.min(1, radius01));
		if (radius01 > 0.999) { ring(path, cx, cy, rx, ry, thickH, thickV); return; }
		const R  = Math.min(rx, ry) * radius01;        // Ecken-Radius
		const w  = 2 * rx, h = 2 * ry;
		const x  = cx - rx, y = cy - ry;
		// Außen: roundRect mit Radius=R (auf allen 4 Ecken)
		roundRect(path, x, y, w, h, R, { tl: 1, tr: 1, br: 1, bl: 1 });
		// Innen: analog, kleiner um Wandstärke; Innen-Radius = R - min(thickH, thickV)
		const iw = w - 2 * thickH;
		const ih = h - 2 * thickV;
		if (iw > 4 && ih > 4) {
			const iR = Math.max(0, R - Math.min(thickH, thickV));
			roundRectHole(path, x + thickH, y + thickV, iw, ih, iR);
		}
	}

	// Rundes Rechteck als CCW-Kontur (Loch). Alle vier Ecken rund mit Radius r.
	function roundRectHole(path, x, y, w, h, r) {
		if (w <= 0 || h <= 0) return;
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		const k = KAPPA;
		path.moveTo(x + r, y);
		path.lineTo(x + w - r, y);
		if (r > 0) path.curveTo(x+w-r+r*k, y, x+w, y+r-r*k, x+w, y+r);
		else       path.lineTo(x+w, y);
		path.lineTo(x + w, y + h - r);
		if (r > 0) path.curveTo(x+w, y+h-r+r*k, x+w-r+r*k, y+h, x+w-r, y+h);
		else       path.lineTo(x+w, y+h);
		path.lineTo(x + r, y + h);
		if (r > 0) path.curveTo(x+r-r*k, y+h, x, y+h-r+r*k, x, y+h-r);
		else       path.lineTo(x, y+h);
		path.lineTo(x, y + r);
		if (r > 0) path.curveTo(x, y+r-r*k, x+r-r*k, y, x+r, y);
		else       path.lineTo(x, y);
		path.close();
	}

	// Halb-Ring, "aufgemacht" auf einer Seite: von Winkel a1 bis a2, delta > 0 = CCW.
	// Wird als geschlossene Kontur gezeichnet: äußerer Bogen + Linie nach innen
	// + innerer Bogen (rückwärts) + Linie zurück.
	function partialRing(path, cx, cy, rx, ry, thickH, thickV, a1, a2) {
		const ix = Math.max(2, rx - thickH);
		const iy = Math.max(2, ry - thickV);
		// Winding muss mit rect übereinstimmen (CW in Y-up = CCW in screen = -1).
		// Outer arc: a2→a1 (abnehmend = CW in Y-up). Inner arc: a1→a2 (CCW in Y-up).
		// Im Überlappungsbereich mit rect: -1 + -1 = -2 ≠ 0 → gefüllt (kein Seam/Loch).
		arc(path, cx, cy, rx, ry, a2, a1, 'move');   // outer CW: start bei outer(a2)
		path.lineTo(cx + ix * Math.cos(a1), cy + iy * Math.sin(a1)); // outer(a1) → inner(a1)
		arc(path, cx, cy, ix, iy, a1, a2, 'line');   // inner CCW: a1→a2
		path.close();
	}

	/* ---------------------------------------------------------------------- */
	/* Stadion-Geometrie: horizontal orientiertes Stadion.                    */
	/* Kappenradius R = min(rx, ry) * radius01 (mit Clamp).                   */
	/* Bei radius01 = 1 und rx = ry: Kreis. Bei radius01 = 0: reines Rechteck.*/
	/* ---------------------------------------------------------------------- */

	// Mapping: Ellipsen-Winkel a → Stadion-Punkt (relativ zum Zentrum).
	// Modell: Bounding-Box 2rx × 2ry (fest). R = Ecken-Radius (gleich in x und y).
	// Vier Ecken bei (±(rx-R), ±(ry-R)); zwischen den Ecken laufen 4 gerade
	// Kanten. Der "Ellipsen-Winkel" a wählt die Ecke (Quadrant nach Vorzeichen
	// von cos/sin), und positioniert den Punkt auf dem Kappen-Kreis mit Radius R.
	function stadiumPoint(rx, ry, R, a) {
		const c = Math.cos(a), s = Math.sin(a);
		if (R < 0.5) {
			// R≈0: Rechteck — Schnittpunkt des Strahls mit der Rechteck-Grenze
			const tx = Math.abs(c) > 1e-9 ? rx / Math.abs(c) : Infinity;
			const ty = Math.abs(s) > 1e-9 ? ry / Math.abs(s) : Infinity;
			const t  = Math.min(tx, ty);
			return { x: t * c, y: t * s };
		}
		const signX = c >= 0 ? 1 : -1;
		const signY = s >= 0 ? 1 : -1;
		const cornerX = signX * Math.max(0, rx - R);
		const cornerY = signY * Math.max(0, ry - R);
		return { x: cornerX + R * c, y: cornerY + R * s };
	}

	// Zeichnet einen Stadion-Bogen zwischen Ellipsen-Winkeln a1 und a2. mode:
	// 'move' = beginnt mit moveTo, 'line' = mit lineTo. Sprungstellen (gerade
	// Kanten) sind bei den 4 Achsen a = k·π/2. Zwischen zwei Achsen liegt eine
	// Ecken-Kappe (Kreisbogen). Zwischen zwei aufeinanderfolgenden Kappen wird
	// per lineTo die gerade Kante überbrückt.
	function arcStadium(path, cx, cy, rx, ry, R, a1, a2, mode) {
		if (R >= Math.min(rx, ry) - 0.5) {
			// Ecken-Radius ≥ min(rx,ry) → keine geraden Kanten → klassische Ellipse
			arc(path, cx, cy, rx, ry, a1, a2, mode);
			return;
		}
		const total = a2 - a1;
		if (Math.abs(total) < 1e-6) return;
		const dir = total > 0 ? 1 : -1;
		// Sprungstellen: alle k·π/2 zwischen a1 (exkl.) und a2 (exkl.)
		const breaks = [];
		const step = Math.PI / 2;
		if (dir > 0) {
			let k = Math.ceil(a1 / step + 1e-9);
			let b = k * step;
			while (b < a2 - 1e-9) { breaks.push(b); b += step; }
		} else {
			let k = Math.floor(a1 / step - 1e-9);
			let b = k * step;
			while (b > a2 + 1e-9) { breaks.push(b); b -= step; }
		}
		// Unterhalb 6 % des Bogen-Radius → sauberes Rechteck statt winziger Kurve
		const minR = Math.min(rx, ry) * 0.06;
		if (R < minR) {
			// R≈0: reines Rechteck.
			// Die 4 Basis-Eckenwinkel des Rechtecks (für eine Umdrehung CCW):
			const ca = Math.atan2(ry, rx);
			const baseAngles = [ca, Math.PI - ca, Math.PI + ca, TAU - ca];
			const basePoints = [
				{ x:  rx, y:  ry },
				{ x: -rx, y:  ry },
				{ x: -rx, y: -ry },
				{ x:  rx, y: -ry },
			];
			// Generiere alle Ecken im Bereich [min(a1,a2)-2π, max(a1,a2)+2π]
			// durch Hinzufügen von ±k*2π-Versätzen
			const aMin = Math.min(a1, a2) - 1e-9;
			const aMax = Math.max(a1, a2) + 1e-9;
			const cycles = Math.ceil((aMax - aMin) / TAU) + 1;
			const allCorners = [];
			for (let k = -1; k <= cycles; k++) {
				for (let i = 0; i < 4; i++) {
					const a = baseAngles[i] + k * TAU;
					if (a > aMin && a < aMax) {
						allCorners.push({ a, x: basePoints[i].x, y: basePoints[i].y });
					}
				}
			}
			allCorners.sort((a, b) => dir > 0 ? a.a - b.a : b.a - a.a);
			// Startpunkt auf Rechteck-Grenze
			const p0 = stadiumPoint(rx, ry, 0, a1);
			if (mode === 'move') path.moveTo(cx + p0.x, cy + p0.y);
			else                 path.lineTo(cx + p0.x, cy + p0.y);
			for (const c of allCorners) path.lineTo(cx + c.x, cy + c.y);
			// Endpunkt auf Rechteck-Grenze
			const pEnd = stadiumPoint(rx, ry, 0, a2);
			path.lineTo(cx + pEnd.x, cy + pEnd.y);
			return;
		}
		// Startpunkt
		const p0 = stadiumPoint(rx, ry, R, a1);
		if (mode === 'move') path.moveTo(cx + p0.x, cy + p0.y);
		else                 path.lineTo(cx + p0.x, cy + p0.y);
		// Zeichne Kappen-Segmente + zwischendrin lineTo (gerade Kante)
		let prev = a1;
		for (const brk of breaks) {
			const midA = (prev + brk) / 2;
			const cSign = Math.cos(midA) >= 0 ? 1 : -1;
			const sSign = Math.sin(midA) >= 0 ? 1 : -1;
			const capCx = cx + cSign * Math.max(0, rx - R);
			const capCy = cy + sSign * Math.max(0, ry - R);
			arc(path, capCx, capCy, R, R, prev, brk, 'line');
			// Sprung: kurz jenseits der Achse ist der Quadrant anders → neuer Kappen-Punkt
			const pNext = stadiumPoint(rx, ry, R, brk + dir * 1e-6);
			path.lineTo(cx + pNext.x, cy + pNext.y);
			prev = brk + dir * 1e-6;
		}
		// Letztes Segment
		const midA = (prev + a2) / 2;
		const cSign = Math.cos(midA) >= 0 ? 1 : -1;
		const sSign = Math.sin(midA) >= 0 ? 1 : -1;
		const capCx = cx + cSign * Math.max(0, rx - R);
		const capCy = cy + sSign * Math.max(0, ry - R);
		arc(path, capCx, capCy, R, R, prev, a2, 'line');
		// Kappen-Bogen endet am Kappen-Rand — geraden Abschluss zum echten Endpunkt ergänzen
		const pEnd = stadiumPoint(rx, ry, R, a2);
		path.lineTo(cx + pEnd.x, cy + pEnd.y);
	}

	// Partieller Stadion-Ring (mit Öffnung), signatur-kompatibel zu partialRing.
	// radius01 optional: bei >= 0.999 (default) delegiere an partialRing.
	function partialStadiumRing(path, cx, cy, rx, ry, thickH, thickV, a1, a2, radius01) {
		radius01 = (radius01 == null) ? 1 : Math.max(0, Math.min(1, radius01));
		if (radius01 > 0.999) { partialRing(path, cx, cy, rx, ry, thickH, thickV, a1, a2); return; }
		const R  = Math.min(rx, ry) * radius01;
		const ix = Math.max(2, rx - thickH);
		const iy = Math.max(2, ry - thickV);
		const iR = Math.max(0, Math.min(ix, R - Math.min(thickH, thickV)));

		const outerStart = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) };
		const outerEnd   = { x: cx + rx * Math.cos(a2), y: cy + ry * Math.sin(a2) };
		const innerStart = { x: cx + ix * Math.cos(a1), y: cy + iy * Math.sin(a1) };
		const innerEnd   = { x: cx + ix * Math.cos(a2), y: cy + iy * Math.sin(a2) };

		// Winding mit rect kompatibel (CW Y-up): Outer a2→a1, Inner a1→a2.
		path.moveTo(outerEnd.x, outerEnd.y);          // start bei outer(a2)
		arcStadium(path, cx, cy, rx, ry, R, a2, a1, 'line'); // outer CW: a2→a1
		path.lineTo(outerStart.x, outerStart.y);
		path.lineTo(innerStart.x, innerStart.y);      // outer(a1) → inner(a1)
		arcStadium(path, cx, cy, ix, iy, iR, a1, a2, 'line'); // inner CCW: a1→a2
		path.lineTo(innerEnd.x, innerEnd.y);
		path.close();
	}

	// Stadion-Bauch für B/P/R/D: an einem Stem angeklebt.
	// Der Bauch belegt (x, y, w, h). Links = eckig (an Stem angesetzt),
	// rechts = gerundete Kappe mit Radius r (0 = Rechteck, h/2 = voller Halbkreis).
	// stemThick = horizontale Wandstärke links (Überlappung mit Stem),
	// thin = vertikale Wandstärke der oberen/unteren Balken.
	// Ergibt eine gefüllte Wand + hohles Inneres (Non-zero winding).
	function bowlStadium(path, x, y, w, h, r, stemThick, thin) {
		if (w <= 0 || h <= 0) return;
		r = Math.max(0, Math.min(r, w, h / 2));
		const k = KAPPA;
		// Äußere Kontur CW
		path.moveTo(x, y);
		path.lineTo(x, y + h);
		path.lineTo(x + w - r, y + h);
		if (r > 0) path.curveTo(x+w-r+r*k, y+h, x+w, y+h-r+r*k, x+w, y+h-r);
		path.lineTo(x + w, y + r);
		if (r > 0) path.curveTo(x+w, y+r-r*k, x+w-r+r*k, y, x+w-r, y);
		path.lineTo(x, y);
		path.close();
		// Inneres Loch (CCW)
		const hx = x + stemThick, hy = y + thin;
		const hw = w - stemThick - thin, hh = h - 2 * thin;
		if (hw > 4 && hh > 4) {
			const hr = Math.max(0, Math.min(r - thin, hw / 2, hh / 2));
			path.moveTo(hx, hy);
			path.lineTo(hx + hw - hr, hy);
			if (hr > 0) path.curveTo(hx+hw-hr+hr*k, hy, hx+hw, hy+hr-hr*k, hx+hw, hy+hr);
			path.lineTo(hx + hw, hy + hh - hr);
			if (hr > 0) path.curveTo(hx+hw, hy+hh-hr+hr*k, hx+hw-hr+hr*k, hy+hh, hx+hw-hr, hy+hh);
			path.lineTo(hx, hy + hh);
			path.close();
		}
	}

	/* ---------------------------------------------------------------------- */
	/* Serifen                                                                */
	/* ---------------------------------------------------------------------- */

	// Fügt eine Serife an das Ende eines vertikalen Stems.
	// stemX, stemW: X-Position und Breite des Stems.
	// edgeY: Y-Koordinate der Kante (Baseline bei bottom, capHeight bei top).
	// edge: 'bottom' | 'top'.
	// sides: 'both' | 'left' | 'right'.
	function stemSerif(path, stemX, stemW, edgeY, edge, sides, p) {
		if (p.serifStyle === 'none') return;
		const size = p.serifSize, thick = p.serifThickness;
		if (size <= 0 || thick <= 0) return;

		let l = size, r = size;
		if (sides === 'left')  r = 0;
		if (sides === 'right') l = 0;

		const x = stemX - l;
		const w = stemW + l + r;
		if (w <= 0) return;

		if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
			const t = p.serifStyle === 'hairline' ? Math.max(2, thick * 0.4) : thick;
			if (edge === 'bottom') rect(path, x, edgeY,       w, t);
			else                   rect(path, x, edgeY - t,   w, t);
			return;
		}

		if (p.serifStyle === 'wedge') {
			// Dreieckige Wedges links und rechts vom Stem
			if (edge === 'bottom') {
				if (l > 0) {
					// (x, edgeY) → (stemX, edgeY + thick) → (stemX, edgeY) — CW
					path.moveTo(x, edgeY);
					path.lineTo(stemX, edgeY + thick);
					path.lineTo(stemX, edgeY);
					path.close();
				}
				if (r > 0) {
					path.moveTo(stemX + stemW, edgeY);
					path.lineTo(stemX + stemW, edgeY + thick);
					path.lineTo(stemX + stemW + r, edgeY);
					path.close();
				}
			} else {
				if (l > 0) {
					path.moveTo(x, edgeY);
					path.lineTo(stemX, edgeY);
					path.lineTo(stemX, edgeY - thick);
					path.close();
				}
				if (r > 0) {
					path.moveTo(stemX + stemW, edgeY);
					path.lineTo(stemX + stemW + r, edgeY);
					path.lineTo(stemX + stemW, edgeY - thick);
					path.close();
				}
			}
		}
	}

	// Vertikaler Stem mit Serifen an beiden Enden (Standard).
	function vStem(path, x, y, w, h, p, opts) {
		opts = opts || {};
		// SEAM: verlängert Stem in angrenzende Bowl (nur nach innen – kein sichtbares Artefakt).
		// 50 Units damit bei allen Font-Größen mindestens 1 px Overlap entsteht.
		const SEAM_BOWL = 50;
		const eTop = opts.extendTop    ? SEAM_BOWL : 0;
		const eBot = opts.extendBottom ? SEAM_BOWL : 0;
		const drawY = y - eBot;
		const drawH = h + eTop + eBot;

		const r = (p.serifStyle === 'none') ? (p.cornerRadius || 0) : 0;

		if (r > 0) {
			const tr = opts.topRound    !== false;
			const br = opts.bottomRound !== false;
			const tc = opts.topCorners    || { l: 1, r: 1 };
			const bc = opts.bottomCorners || { l: 1, r: 1 };
			roundRect(path, x, drawY, w, drawH, r, {
				tl: tr && tc.l ? 1 : 0,
				tr: tr && tc.r ? 1 : 0,
				br: br && bc.r ? 1 : 0,
				bl: br && bc.l ? 1 : 0
			});
		} else {
			rect(path, x, drawY, w, drawH);
		}
		const sides = opts.sides || 'both';
		if (opts.bottomSerif !== false) stemSerif(path, x, w, y,       'bottom', sides, p);
		if (opts.topSerif    !== false) stemSerif(path, x, w, y + h,   'top',    sides, p);
	}

	// Horizontaler Balken mit optional runden Enden (nur wenn keine Serifen).
	// endLeft/endRight = true → das Ende (auf jener Seite) wird rund gemacht.
	function hBar(path, x, y, w, h, p, endLeft, endRight) {
		const r = (p.serifStyle === 'none') ? (p.cornerRadius || 0) : 0;

		// SEAM: eckige Enden in die Nachbarform verlängern (Anti-AA-Gap).
		// Begrenzt auf p.stem damit in Light-Gewichten kein Überschuss ausserhalb der Stems.
		const SEAM = Math.min(50, p.stem || 50);
		let sx = x, sw = w;
		if (!endLeft)  { sx -= SEAM; sw += SEAM; }
		if (!endRight) { sw += SEAM; }

		if (r > 0) {
			roundRect(path, sx, y, sw, h, r, {
				tl: endLeft  ? 1 : 0,
				bl: endLeft  ? 1 : 0,
				tr: endRight ? 1 : 0,
				br: endRight ? 1 : 0
			});
		} else {
			rect(path, sx, y, sw, h);
		}
	}

	// Rechteck mit wählbaren gerundeten Ecken (analog zu hBar / vStem).
	// corners = { tl, tr, br, bl } — 1 = gerundet, 0 = eckig.
	// Fehlt corners, werden alle Ecken gerundet.
	function rectR(path, x, y, w, h, p, corners) {
		const r = (p && p.serifStyle === 'none') ? (p.cornerRadius || 0) : 0;
		if (r > 0) {
			const c = corners || { tl: 1, tr: 1, br: 1, bl: 1 };
			roundRect(path, x, y, w, h, r, c);
		} else {
			rect(path, x, y, w, h);
		}
	}

	// Horizontales Terminal (für Bar-Enden bei E, F, T, L, Z etc.):
	// leichte Ausdehnung der Bar zu einer kleinen Serife am Ende.
	function barSerif(path, x, y, thick, edge, p, opts) {
		// x = Ende-Punkt der Bar, y = untere Kante der Bar,
		// edge = 'left'  → x ist der RECHTE Rand, Spitze zeigt nach rechts (auswärts)
		// edge = 'right' → x ist der LINKE Rand,  Spitze zeigt nach links  (auswärts)
		// opts.clipTop = true → oberen Eckpunkt auf y+thick begrenzen
		// opts.clipBot = true → unteren Eckpunkt auf y begrenzen
		if (p.serifStyle === 'none') return;
		const size = p.serifSize * 0.55, sw = p.serifThickness;
		if (size <= 0 || sw <= 0) return;
		opts = opts || {};

		if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
			const t    = p.serifStyle === 'hairline' ? Math.max(2, sw * 0.4) : sw;
			const yTop = opts.clipTop ? y + thick : y + thick + size;
			const yBot = opts.clipBot ? y         : y - size;
			if (edge === 'right') rect(path, x - t, yBot, t, yTop - yBot);
			else                  rect(path, x,     yBot, t, yTop - yBot);
			return;
		}

		if (p.serifStyle === 'wedge') {
			const mid  = y + thick / 2;
			const yTop = opts.clipTop ? y + thick : y + thick + size * 0.5;
			const yBot = opts.clipBot ? y         : y - size * 0.5;
			if (edge === 'right') {
				path.moveTo(x + size, mid);
				path.lineTo(x, yBot);
				path.lineTo(x, yTop);
				path.close();
			} else {
				path.moveTo(x - size, mid);
				path.lineTo(x, yTop);
				path.lineTo(x, yBot);
				path.close();
			}
		}
	}

	// Serife am Ende eines horizontalen Balkens, 90° gedreht wie stemSerif (→ senkrechte Serife).
	// Entspricht der stemSerif-Logik rotiert um 90°: statt waagrechter Füße am Vertikalstrich
	// entstehen senkrechte Füße an den Enden des Horizontalbalkens.
	// x:      x-Position des Balken-Endes
	// barY:   y-Unterkante des Balkens
	// barH:   Balkenhöhe
	// xSide:  'left'  → x ist linkes Ende  (Serife nach außen links)
	//         'right' → x ist rechtes Ende (Serife nach außen rechts)
	// ySide:  'top'   → Serife ragt oben heraus  (oberer Balken)
	//         'bottom'→ Serife ragt unten heraus (unterer Balken)
	function vBarEndSerif(path, x, barY, barH, xSide, ySide, p, clipY, sizeScale) {
		// clipY: begrenzt die Außenkante — für 'top' = Max-Y, für 'bottom' = Min-Y
		if (p.serifStyle === 'none') return;
		const size  = p.serifSize * (sizeScale !== undefined ? sizeScale : 1);
		const thick = p.serifThickness;
		if (size <= 0 || thick <= 0) return;

		const tBase = p.serifStyle === 'hairline' ? Math.max(2, thick * 0.4) : thick;
		const tRaw  = tBase * (sizeScale !== undefined ? sizeScale : 1);
		const t     = sizeScale !== undefined ? Math.min(tRaw, barH / 2) : tRaw;

		if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
			// Senkrechtes Rechteck nach innen (links-Seite → rechts, rechts-Seite → links)
			const rx = xSide === 'left' ? x : x - t;
			const ry = ySide === 'top'  ? barY + barH : barY - size;
			const rh = Math.min(size, barH);
			rect(path, rx, ry, t, rh);
			return;
		}

		if (p.serifStyle === 'wedge') {
			// outerY: bei sizeScale = kein Überstand über den Balken hinaus
			const topOuter = sizeScale !== undefined ? barY + barH : barY + barH + t;
			const botOuter = sizeScale !== undefined ? barY         : barY - t;
			if (xSide === 'left' && ySide === 'top') {
				path.moveTo(x,        topOuter);
				path.lineTo(x + size, barY + barH);
				path.lineTo(x,        barY + barH);
				path.close();
			} else if (xSide === 'right' && ySide === 'top') {
				path.moveTo(x,        topOuter);
				path.lineTo(x,        barY + barH);
				path.lineTo(x - size, barY + barH);
				path.close();
			} else if (xSide === 'left' && ySide === 'bottom') {
				path.moveTo(x,        botOuter);
				path.lineTo(x,        barY);
				path.lineTo(x + size, barY);
				path.close();
			} else {
				path.moveTo(x,        botOuter);
				path.lineTo(x - size, barY);
				path.lineTo(x,        barY);
				path.close();
			}
		}
	}

	// Serife an einem Bogenterminal (C, c, S, s, e).
	// cx, cy:   Mittelpunkt des Strichendes (Außenkante der Ellipse).
	// thick:    Strichbreite am Terminal — bestimmt die Basisbreite des Wedge.
	// tipAngle: Tangentialwinkel am Terminal (zeigt nach außen aus dem Buchstaben).
	function arcTerminalSerif(path, cx, cy, thick, tipAngle, p) {
		if (p.serifStyle === 'none') return;
		const size = p.serifSize;        // Breite: wie weit die Serife seitlich auslädt
		const sw   = p.serifThickness;  // Tiefe: wie weit die Spitze herausragt
		if (size <= 0 || sw <= 0) return;

		const tx = Math.cos(tipAngle), ty = Math.sin(tipAngle);
		const nx = -ty, ny = tx;

		const mx = cx, my = cy;  // Ankerpunkt direkt vom Caller übergeben

		const hw    = Math.max(thick * 0.5, size * 0.75);
		const depth = sw * 1.1;

		if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
			const t = p.serifStyle === 'hairline' ? Math.max(2, depth * 0.4) : depth;
			const p0x = mx - nx * hw - tx * (t / 2), p0y = my - ny * hw - ty * (t / 2);
			const p1x = mx + nx * hw - tx * (t / 2), p1y = my + ny * hw - ty * (t / 2);
			const p2x = mx + nx * hw + tx * (t / 2), p2y = my + ny * hw + ty * (t / 2);
			const p3x = mx - nx * hw + tx * (t / 2), p3y = my - ny * hw + ty * (t / 2);
			path.moveTo(p3x, p3y); path.lineTo(p0x, p0y);
			path.lineTo(p1x, p1y); path.lineTo(p2x, p2y);
			path.close();
			return;
		}

		if (p.serifStyle === 'wedge') {
			path.moveTo(mx + tx * depth, my + ty * depth); // Spitze
			path.lineTo(mx - nx * hw,    my - ny * hw);    // Basis links
			path.lineTo(mx + nx * hw,    my + ny * hw);    // Basis rechts
			path.close();
		}
	}

	// Serife am horizontalen Endkappen-Abschluss eines diagonalen Strichs.
	// x, hW:    linke Kante und Breite der horizontalen Endkappe
	// edgeY:    Y-Position der Endkappe
	// edge:     'top' | 'bottom'
	// side:     'left'  → Spitze ragt nach links  (Außenseite linker Arm)
	//           'right' → Spitze ragt nach rechts (Außenseite rechter Arm)
	// Alle vier Fälle sind explizit CW in Y-up.
	function diagCapSerif(path, x, hW, edgeY, edge, side, p) {
		if (p.serifStyle === 'none') return;
		const size = p.serifSize, thick = p.serifThickness;
		if (size <= 0 || thick <= 0) return;

		if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
			const t = p.serifStyle === 'hairline' ? Math.max(2, thick * 0.4) : thick;
			if (side === 'left') {
				if (edge === 'top')    rect(path, x - size, edgeY - t, size + hW, t);
				else                   rect(path, x - size, edgeY,     size + hW, t);
			} else {
				if (edge === 'top')    rect(path, x,        edgeY - t, hW + size, t);
				else                   rect(path, x,        edgeY,     hW + size, t);
			}
			return;
		}

		if (p.serifStyle === 'wedge') {
			// Alle vier Varianten sind CW in Y-up:
			// Innenseite (x+hW für 'left', x für 'right') liegt im Diagonalkörper → kein Gap.
			if (side === 'left') {
				if (edge === 'top') {
					// Spitze links, taucht rechts in Strich ein (nach unten)
					path.moveTo(x - size, edgeY);
					path.lineTo(x + hW,   edgeY);
					path.lineTo(x + hW,   edgeY - thick);
					path.close();
				} else {
					// Spitze links, taucht rechts in Strich ein (nach oben) — war CCW, korrigiert
					path.moveTo(x - size, edgeY);
					path.lineTo(x + hW,   edgeY + thick);
					path.lineTo(x + hW,   edgeY);
					path.close();
				}
			} else { // 'right'
				if (edge === 'top') {
					// Spitze rechts, taucht links in Strich ein (nach unten) — war CCW, korrigiert
					path.moveTo(x + hW + size, edgeY);
					path.lineTo(x,             edgeY - thick);
					path.lineTo(x,             edgeY);
					path.close();
				} else {
					// Spitze rechts, taucht links in Strich ein (nach oben) — CW
					path.moveTo(x + hW + size, edgeY);
					path.lineTo(x,             edgeY);
					path.lineTo(x,             edgeY + thick);
					path.close();
				}
			}
		}
	}

	/* ---------------------------------------------------------------------- */
	/* Metrik-Helper                                                          */
	/* ---------------------------------------------------------------------- */

	// Buchstabenbreite: allein durch capHeight × ratio × widthScale bestimmt.
	// Eine kleine Absolut-Untergrenze verhindert nur, dass extreme Kombis
	// (sehr schmal + sehr klein) die Glyphs komplett kollabieren lassen.
	function capW(p, ratio) {
		return Math.max(60, Math.round(p.capHeight * ratio * p.widthScale));
	}
	function xW(p, ratio) {
		return Math.max(50, Math.round(p.xHeight * ratio * p.widthScale));
	}

	/* ---------------------------------------------------------------------- */
	/* Font-Metriken aus Nutzer-Parametern normalisieren                      */
	/* ---------------------------------------------------------------------- */

	function normalizeParams(raw) {
		if (raw.__normalized) return raw;   // idempotent
		const p = Object.assign({}, raw);
		p.slantRad = (p.slant || 0) * Math.PI / 180;
		p.widthScale = (p.widthScale || 100) / 100;

		// Effektiver Stem: darf nicht mehr als ~42 % der Standard-Cap-Breite
		// belegen, sonst wachsen fette Gewichte in die Breite und "fressen"
		// den Breiten-Slider auf. So bleibt "Gewicht" und "Breite" wirklich
		// unabhängig.
		const typicalCapW = p.capHeight * 0.72 * p.widthScale;
		const maxStem     = Math.max(20, typicalCapW * 0.42);
		p.stem = Math.min(raw.stem, maxStem);

		p.thin = p.stem / Math.max(1, p.contrast);
		p.cornerRadius = Math.max(0, +raw.cornerRadius || 0);
		p.bowlRadius   = raw.bowlRadius != null ? Math.max(0, Math.min(100, +raw.bowlRadius)) / 100 : 1;
		p.fraktur      = raw.fraktur    != null ? Math.max(0, Math.min(100, +raw.fraktur))    / 100 : 0;
		p.ornament     = raw.ornament   != null ? Math.max(0, Math.min(100, +raw.ornament))   / 100 : 0;
		p.__normalized = true;
		return p;
	}

	/* ---------------------------------------------------------------------- */
	/* Ornamentale Elemente (Buchinitialen-Stil)                              */
	/* Wächst AUS den Strichenden heraus und arbeitet mit den Gegenräumen.    */
	/* ---------------------------------------------------------------------- */

	// Kleines Rautensymbol (Diamant) an (cx, cy).
	function diamond(path, cx, cy, rx, ry) {
		path.moveTo(cx, cy - ry);
		path.lineTo(cx + rx, cy);
		path.lineTo(cx, cy + ry);
		path.lineTo(cx - rx, cy);
		path.close();
	}

	// Blattform (Mandel-/Tropfenform) an (cx, cy), Spitze in Richtung `angle` (Bogenmass).
	function leaf(path, cx, cy, size, angle) {
		if (size < 1) return;
		const c  = Math.cos(angle), s  = Math.sin(angle);
		const nx = -s, ny = c;
		const hw = size * 0.38;
		const tx = cx + c * size, ty = cy + s * size;
		path.moveTo(cx, cy);
		path.curveTo(
			cx + nx * hw + c * size * 0.35, cy + ny * hw + s * size * 0.35,
			tx + nx * hw * 0.35,            ty + ny * hw * 0.35,
			tx, ty
		);
		path.curveTo(
			tx - nx * hw * 0.35,            ty - ny * hw * 0.35,
			cx - nx * hw + c * size * 0.35, cy - ny * hw + s * size * 0.35,
			cx, cy
		);
		path.close();
	}

	// Verjüngende Bezier-Ranke von (sx, sy) nach (ex, ey) mit Kontrollpunkten.
	function tendril(path, sx, sy, ex, ey, cx1, cy1, cx2, cy2, halfW) {
		const dx  = ex - sx, dy = ey - sy;
		const len = Math.hypot(dx, dy);
		if (len < 1) return;
		const nx = -dy / len, ny = dx / len;
		path.moveTo(sx + nx * halfW, sy + ny * halfW);
		path.curveTo(
			cx1 + nx * halfW * 0.55, cy1 + ny * halfW * 0.55,
			cx2 + nx * halfW * 0.15, cy2 + ny * halfW * 0.15,
			ex, ey
		);
		path.curveTo(
			cx2 - nx * halfW * 0.15, cy2 - ny * halfW * 0.15,
			cx1 - nx * halfW * 0.55, cy1 - ny * halfW * 0.55,
			sx - nx * halfW, sy - ny * halfW
		);
		path.close();
	}

	// Dreipass (Trefoil) — historisch korrekte 3-Blatt-Form.
	function trefoil(path, cx, cy, size) {
		if (size < 2) return;
		for (let i = 0; i < 3; i++) {
			const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
			leaf(path, cx, cy, size, a);
		}
		diamond(path, cx, cy, size * 0.2, size * 0.2);
	}

	// Vierpass (Quaterfoil) — 4-Blatt-Form + Mittelraute.
	function quaterfoil(path, cx, cy, size) {
		if (size < 2) return;
		for (let i = 0; i < 4; i++) {
			leaf(path, cx, cy, size, Math.PI / 4 + (Math.PI / 2) * i);
		}
		diamond(path, cx, cy, size * 0.18, size * 0.18);
	}

	/**
	 * Kalligraphischer Schwung — wächst aus einem Strichende (sx, sy) heraus,
	 * dreht sich geschwungen in `angle`-Richtung und endet in einem Blatt-Terminus.
	 * Wirkt wie eine natürliche Verlängerung des Buchstabenstriches.
	 */
	function swashCurl(path, sx, sy, size, angle, tw) {
		if (size < 3 || tw < 0.5) return;
		// Kontrollpunkte erzeugen eine S-ähnliche Kurve
		const c1x = sx + Math.cos(angle) * size * 0.28 + Math.sin(angle) * size * 0.32;
		const c1y = sy + Math.sin(angle) * size * 0.28 - Math.cos(angle) * size * 0.32;
		const c2x = sx + Math.cos(angle) * size * 0.72 - Math.sin(angle) * size * 0.22;
		const c2y = sy + Math.sin(angle) * size * 0.72 + Math.cos(angle) * size * 0.22;
		const ex  = sx + Math.cos(angle) * size;
		const ey  = sy + Math.sin(angle) * size;
		tendril(path, sx, sy, ex, ey, c1x, c1y, c2x, c2y, tw);
		// Blatt-Terminus: aus der Endrichtung des Schwungs herauswachsend
		const endA = Math.atan2(ey - c2y, ex - c2x);
		leaf(path, ex, ey, tw * 2.8, endA + Math.PI * 0.5);
		leaf(path, ex, ey, tw * 2.0, endA - Math.PI * 0.5);
	}

	/**
	 * Schlängelnde Ranke durch den Gegenraum (Counter) des Buchstabens.
	 * Verläuft vertikal durch die Mitte, mit wechselseitig abstehenden Blättern —
	 * wie Akanthusblätter, die einen Initialbuchstaben umschlingen.
	 */
	function counterVine(path, x, y0, y1, leafSize, tw, count) {
		if (y1 - y0 < leafSize || count < 1) return;
		const segH = (y1 - y0) / count;
		for (let i = 0; i < count; i++) {
			const ya   = y0 + segH * i;
			const ym   = ya + segH * 0.5;
			const side = (i % 2 === 0) ? 1 : -1;
			const wx   = leafSize * 0.65 * side;
			// Wellenförmiger Stengel zur Seite
			tendril(path,
				x, ya,
				x + wx, ym,
				x + wx * 0.25, ya + segH * 0.2,
				x + wx * 0.85, ya + segH * 0.38,
				tw * 0.45
			);
			// Abstehend Blatt (Akanthus-Motiv)
			const leafAngle = side > 0 ? Math.PI * 0.12 : Math.PI * 0.88;
			leaf(path, x + wx, ym, leafSize, leafAngle);
			// Sekundäres Miniblatt an der Basis des Stiels
			leaf(path, x + wx * 0.5, ya + segH * 0.28, leafSize * 0.45,
			     leafAngle + Math.PI * side * 0.35);
			// Kleiner Diamant-Knotenpunkt
			diamond(path, x + wx * 0.45, ya + segH * 0.5, tw * 0.55, tw * 0.55);
		}
	}

	/**
	 * Inline-Dekoration: Reihe kleiner Diamanten entlang der vertikalen Mittelachse
	 * eines Stammes — typisch für illuminierte Handschriften (Goldinitialen).
	 */
	function stemDots(path, cx, y0, y1, count, r) {
		if (r < 0.8 || count < 1) return;
		const step = (y1 - y0) / (count + 1);
		for (let i = 1; i <= count; i++) {
			diamond(path, cx, y0 + step * i, r, r * 1.35);
		}
	}

	/**
	 * Fügt Buchinitialen-artige Ornamente ein.
	 *
	 * Die Ornamente wachsen AUS den Strichenden heraus (approximiert als Mitte
	 * des linken/rechten Stammes am Ober-/Unterlinienpunkt) und interagieren
	 * mit dem Gegenraum des Buchstabens. Vier Intensitätsstufen:
	 *
	 *   0–30 %  Kalligraphische Schwünge an den 4 Stammenden
	 *  30–50 %  Akanthus-Ranke durch den Buchstaben-Innenraum
	 *  50–70 %  Trefoil über dem Buchstaben + seitliche Blätter
	 *  70–100 % Inline-Diamanten im Stamm + Quaterfoil unter dem Buchstaben
	 */
	function addOrnaments(path, p, letterW) {
		const orn = p.ornament;
		if (!orn || orn < 0.01) return;

		const capH  = p.capHeight;
		const stem  = p.stem;
		// Gesamtausdehnung wächst progressiv — bei Maximum deutlich opulenter
		const sz    = Math.pow(orn, 0.62) * stem * 5.4;
		const tw    = Math.max(1.5, stem * 0.22 * Math.pow(orn, 0.7));

		// Stammenden: approximiert als Mitte des linken/rechten Stammes.
		const lx = stem * 0.5;              // Mitte linker Stamm
		const rx = letterW - stem * 0.5;   // Mitte rechter Stamm

		// ── LEVEL 1: Calligraphische Schwünge (immer aktiv) ─────────────────
		// Oben-links: Hauptschwung — dreht nach links-oben
		swashCurl(path, lx, capH, sz * 0.95, Math.PI * 0.72, tw);
		// Oben-rechts: Gegenschwung
		swashCurl(path, rx, capH, sz * 0.68, Math.PI * 0.28, tw * 0.75);
		// Unten-links: Abstrich nach links-unten
		swashCurl(path, lx, 0,    sz * 0.80, Math.PI * 1.28, tw * 0.88);
		// Unten-rechts: auslaufender Schwung nach rechts-unten
		swashCurl(path, rx, 0,    sz * 0.64, Math.PI * 1.72, tw * 0.70);

		// ── LEVEL 2: Akanthus-Ranke durch den Innenraum (ab 30 %) ───────────
		if (orn > 0.3) {
			const t         = (orn - 0.3) / 0.7;
			const leafSz    = Math.max(4, stem * 0.75 * t);
			const numLeaves = Math.max(2, Math.round(t * 7));
			// Ranke vertikal durch den mittleren Freiraum des Buchstabens
			counterVine(path,
				letterW * 0.5,
				capH * 0.08, capH * 0.92,
				leafSz, tw * 0.58, numLeaves
			);
		}

		// ── LEVEL 3: Trefoil + seitliche Blattpaare (ab 50 %) ───────────────
		if (orn > 0.5) {
			const t    = (orn - 0.5) / 0.5;
			const midY = capH * 0.5;
			// Trefoil mittig über dem Buchstaben (Oberzeile)
			trefoil(path, letterW * 0.5, capH + sz * 0.17, sz * 0.25 * t);
			// Trefoil gespiegelt unter dem Buchstaben
			trefoil(path, letterW * 0.5, -sz * 0.17 * t, sz * 0.18 * t);
			// Seitliche Blätter links — obere und untere Paare
			leaf(path, lx - sz * 0.42 * t, midY + capH * 0.12, sz * 0.29 * t, Math.PI * 1.05);
			leaf(path, lx - sz * 0.30 * t, midY - capH * 0.08, sz * 0.21 * t, Math.PI * 0.78);
			leaf(path, lx - sz * 0.38 * t, midY + capH * 0.35, sz * 0.20 * t, Math.PI * 1.15);
			// Seitliche Blätter rechts
			leaf(path, rx + sz * 0.42 * t, midY + capH * 0.12, sz * 0.29 * t, Math.PI * (-0.05));
			leaf(path, rx + sz * 0.30 * t, midY - capH * 0.08, sz * 0.21 * t, Math.PI * 0.22);
			leaf(path, rx + sz * 0.38 * t, midY + capH * 0.35, sz * 0.20 * t, Math.PI * (-0.15));
		}

		// ── LEVEL 4: Inline-Dekoration + Quaterfoil (ab 70 %) ───────────────
		if (orn > 0.7) {
			const t    = (orn - 0.7) / 0.3;
			const dotR = Math.max(1.5, stem * 0.14 * t);
			// Diamant-Punkte vertikal im linken Stamm (Goldinitial-Motiv)
			stemDots(path, lx, capH * 0.15, capH * 0.85,
			         Math.max(3, Math.round(t * 7)), dotR);
			// Diamant-Punkte auch im rechten Stamm
			stemDots(path, rx, capH * 0.15, capH * 0.85,
			         Math.max(3, Math.round(t * 7)), dotR);
			// Großes Quaterfoil unter dem Buchstaben (Fuß-Ornament)
			quaterfoil(path, letterW * 0.5, -sz * 0.30 * t, sz * 0.24 * t);
			// Tertiäre Blätter an Enden des Hauptschwungs (oben-links)
			const swEx = lx  + Math.cos(Math.PI * 0.72) * sz * 0.95;
			const swEy = capH + Math.sin(Math.PI * 0.72) * sz * 0.95;
			leaf(path, swEx, swEy, sz * 0.18 * t, Math.PI * 0.72 + Math.PI * 0.45);
			leaf(path, swEx, swEy, sz * 0.14 * t, Math.PI * 0.72 - Math.PI * 0.45);
			leaf(path, swEx, swEy, sz * 0.11 * t, Math.PI * 0.72 + Math.PI * 0.75);
			// Sekundärranke außen an der linken Seite
			const sideY = capH * 0.62;
			tendril(path,
				lx, sideY,
				lx - sz * 0.52 * t, sideY + sz * 0.35 * t,
				lx - sz * 0.14 * t, sideY + sz * 0.12 * t,
				lx - sz * 0.42 * t, sideY + sz * 0.26 * t,
				tw * 0.50 * t
			);
			leaf(path, lx - sz * 0.52 * t, sideY + sz * 0.35 * t,
			     sz * 0.16 * t, Math.PI * 1.15);
			// Sekundärranke außen an der rechten Seite (gespiegelt)
			tendril(path,
				rx, sideY,
				rx + sz * 0.52 * t, sideY + sz * 0.35 * t,
				rx + sz * 0.14 * t, sideY + sz * 0.12 * t,
				rx + sz * 0.42 * t, sideY + sz * 0.26 * t,
				tw * 0.50 * t
			);
			leaf(path, rx + sz * 0.52 * t, sideY + sz * 0.35 * t,
			     sz * 0.16 * t, Math.PI * (-0.15));
		}

		// ── LEVEL 5: Kronenwerk — maximale Opulenz (ab 85 %) ────────────────
		if (orn > 0.85) {
			const t    = (orn - 0.85) / 0.15;
			const dotR = Math.max(1.5, stem * 0.14);
			// Trefoils auf beiden Stammköpfen — wie Kronen-Pinnakeln
			trefoil(path, lx, capH + sz * 0.28 * t, sz * 0.14 * t);
			trefoil(path, rx, capH + sz * 0.28 * t, sz * 0.14 * t);
			// Kleine Quaterfoils an den Fußpunkten beider Stämme
			quaterfoil(path, lx, -sz * 0.18 * t, sz * 0.11 * t);
			quaterfoil(path, rx, -sz * 0.18 * t, sz * 0.11 * t);
			// Zusätzliche Blätter an den Schwungenden rechts-oben
			const swRx = rx + Math.cos(Math.PI * 0.28) * sz * 0.68;
			const swRy = capH + Math.sin(Math.PI * 0.28) * sz * 0.68;
			leaf(path, swRx, swRy, sz * 0.15 * t, Math.PI * 0.28 + Math.PI * 0.45);
			leaf(path, swRx, swRy, sz * 0.11 * t, Math.PI * 0.28 - Math.PI * 0.45);
			// Diamant-Akzente auf halber Höhe beider Außenseiten
			const midY = capH * 0.5;
			diamond(path, lx - sz * 0.25 * t, midY, dotR * 1.8 * t, dotR * 2.4 * t);
			diamond(path, rx + sz * 0.25 * t, midY, dotR * 1.8 * t, dotR * 2.4 * t);
			// Diagonale Ranken von den oberen Ecken zur Mitte
			tendril(path,
				lx, capH,
				letterW * 0.35, capH + sz * 0.22 * t,
				lx + sz * 0.12 * t, capH + sz * 0.06 * t,
				letterW * 0.35 - sz * 0.05 * t, capH + sz * 0.18 * t,
				tw * 0.38 * t
			);
			tendril(path,
				rx, capH,
				letterW * 0.65, capH + sz * 0.22 * t,
				rx - sz * 0.12 * t, capH + sz * 0.06 * t,
				letterW * 0.65 + sz * 0.05 * t, capH + sz * 0.18 * t,
				tw * 0.38 * t
			);
		}
	}

	/* ---------------------------------------------------------------------- */
	/* ---------------------------------------------------------------------- */
	/* Hilfsfunktion für S/s: zeichnet einen C-Arm als roundRect-Außen +      */
	/* CCW-Innenloch.                                                          */
	/*   path                   opentype.Path                                  */
	/*   x, y, w, h             Bounding-Box des Arms (Y-up, BL-Ursprung)     */
	/*   r                      äußerer Eck-Radius (geclampt auf min(w,h)/2)  */
	/*   s                      vertikale Balkenstärke (geschlossene Seite)    */
	/*   t                      horizontale Balkenstärke (Ober-/Unterkante)   */
	/*   roundTop / roundBot    true = äußere Ecken dieser Seite runden        */
	/*   openRight               true = rechte Seite offen, false = linke      */
	/* ---------------------------------------------------------------------- */
	function sArm(path, x, y, w, h, r, s, t, roundTop, roundBot, openRight) {
		const k  = KAPPA;
		r  = Math.max(0, Math.min(r, w / 2, h / 2));
		const ri = Math.max(0, r - Math.min(s, t));

		// Äußeres Rechteck: nur die vorgesehenen Ecken runden
		const corners = {
			tl: roundTop ? 1 : 0,
			tr: roundTop ? 1 : 0,
			bl: roundBot ? 1 : 0,
			br: roundBot ? 1 : 0,
		};
		roundRect(path, x, y, w, h, r, corners);

		// Inneres C-Loch (CCW)
		if (openRight) {
			// Loch: x+s … x+w, y+t … y+h-t  — rechte Seite offen
			const xi = x + s, yi0 = y + t, yi1 = y + h - t;
			if (xi < x + w - 4 && yi0 < yi1 - 4) {
				path.moveTo(x + w,   yi0);
				path.lineTo(xi + ri, yi0);
				if (ri > 0) path.curveTo(xi+ri-ri*k, yi0, xi, yi0+ri-ri*k, xi, yi0+ri);
				else        path.lineTo(xi, yi0);
				path.lineTo(xi,      yi1 - ri);
				if (ri > 0) path.curveTo(xi, yi1-ri+ri*k, xi+ri-ri*k, yi1, xi+ri, yi1);
				else        path.lineTo(xi, yi1);
				path.lineTo(x + w,   yi1);
				path.lineTo(x + w,   yi0);
				path.close();
			}
		} else {
			// Loch: x … x+w-s, y+t … y+h-t  — linke Seite offen
			const xi = x + w - s, yi0 = y + t, yi1 = y + h - t;
			if (xi > x + 4 && yi0 < yi1 - 4) {
				path.moveTo(x,       yi1);
				path.lineTo(xi - ri, yi1);
				if (ri > 0) path.curveTo(xi-ri+ri*k, yi1, xi, yi1-ri+ri*k, xi, yi1-ri);
				else        path.lineTo(xi, yi1);
				path.lineTo(xi,      yi0 + ri);
				if (ri > 0) path.curveTo(xi, yi0+ri-ri*k, xi-ri+ri*k, yi0, xi-ri, yi0);
				else        path.lineTo(xi, yi0);
				path.lineTo(x,       yi0);
				path.lineTo(x,       yi1);
				path.close();
			}
		}
	}

	/* ---------------------------------------------------------------------- */
	/* S/s als "oben und unten geöffnete 8":                                  */
	/*   SCHRITT 1: reine 8 — zwei gestapelte gerundete Ring-Bowls.  ✓        */
	/*   SCHRITT 2: Slots durch Ober-/Unterkante einfügen.                    */
	/*     2a (aktuell): oberer Slot rechts (obere Bowl öffnet oben-rechts)   */
	/*     2b (folgt):   unterer Slot links                                   */
	/* ---------------------------------------------------------------------- */

	// Ein einzelner Bowl = gerundetes Rechteck mit gerundetem Innenloch,
	// optional mit einem Cut durch eine Ecke (echte S-Öffnung).
	//   x, y, w, h  Bounding-Box (Y-up, BL-Ursprung)
	//   r           äußerer Eckradius
	//   s           vertikale Balken-Dicke (Wanddicke links/rechts)
	//   t           horizontale Balken-Dicke (Wanddicke oben/unten)
	//   slot        null oder { edge, side, cutW, cutH }
	function sBowl(path, x, y, w, h, r, s, t, slot) {
		const rC = Math.max(0, Math.min(r, w / 2, h / 2));
		const ri = Math.max(0, rC - Math.min(s, t));
		const xi0 = x + s, xi1 = x + w - s;
		const yi0 = y + t, yi1 = y + h - t;
		const iw  = w - 2 * s, ih = h - 2 * t;

		if (!slot || iw < 4 || ih < 4) {
			// Kein Slot: einfacher Ring.
			roundRect(path, x, y, w, h, rC);
			if (iw > 4 && ih > 4) roundRectHole(path, xi0, yi0, iw, ih, ri);
			return;
		}

		// Cut-Dimensionen clampen
		const cutW = Math.max(s, Math.min(slot.cutW || s, w - rC));
		const cutH = Math.max(t, Math.min(slot.cutH || t, h - rC));

		// EINHEITLICHER Cut-Innenecken-Radius für Outer↔Inner-Berührung.
		// Auf 0 gesetzt (scharfe Ecke), damit keine Kurven-Alignment-Artefakte
		// zwischen Outer-Kontur und L-Hole entstehen können.
		const riCut = 0;

		// 1) Außenkontur mit ausgesparter Ecke
		outerRectOpenCorner(path, x, y, w, h, rC, s, t, slot.edge, slot.side, cutW, cutH, riCut);

		// 2) Restliches Innenraum-Loch
		const penetrates = (cutW > s + 0.5) && (cutH > t + 0.5);
		const fullSwallow = (cutW >= w - s - 0.5) && (cutH >= h - t - 0.5);
		if (fullSwallow) return;
		if (!penetrates) {
			roundRectHole(path, xi0, yi0, iw, ih, ri);
			return;
		}
		// L-förmiges Loch (CCW) — verwendet ri für reguläre Innenecken,
		// riCut für die Cut-Innenecke (muss mit Outer-Kontur übereinstimmen).
		innerLHole(path, xi0, yi0, xi1, yi1, ri, riCut, slot.edge, slot.side, cutW, cutH, x, y, w, h);
	}

	// L-förmiges Loch (CCW) für den Fall, dass der Cut in den Innenraum
	// eindringt. Der Cut belegt eine Ecke des Innenraums; das L ist der Rest.
	//
	// Wichtig für Artefakt-Freiheit: die 3 Ecken, die an die Outer-Kontur
	// grenzen (Cut-Innenecke + 2 Berührungspunkte mit Cut-Kanten), müssen
	// SCHARF (radius 0) sein — sonst entstehen ungefüllte Zwickel zwischen
	// L-Fillet und Outer-Kante. Nur die 3 "reinen" Innen-Ecken (fern vom Cut)
	// werden mit ri gerundet.
	function innerLHole(path, xi0, yi0, xi1, yi1, ri, riCut, edge, side, cutW, cutH, x, y, w, h) {
		const k = KAPPA;
		const cxCut = (side === 'right') ? (x + w - cutW) : (x + cutW);
		const cyCut = (edge === 'top')   ? (y + h - cutH) : (y + cutH);

		if (edge === 'top' && side === 'right') {
			// L: bottom [xi0..xi1]×[yi0..cyCut]  +  left [xi0..cxCut]×[cyCut..yi1]
			// Ecken: BL(ri), BR(ri), Cut-Berühr(0), Cut(0), Cut-Berühr(0), TL(ri)
			path.moveTo(xi0 + ri, yi0);
			path.lineTo(xi1 - ri, yi0);
			path.curveTo(xi1 - ri + ri*k, yi0, xi1, yi0 + ri - ri*k, xi1, yi0 + ri);
			path.lineTo(xi1, cyCut);                    // Berührung mit Outer (scharf)
			path.lineTo(cxCut, cyCut);                  // Cut-Ecke (scharf)
			path.lineTo(cxCut, yi1);                    // Berührung mit Outer (scharf)
			path.lineTo(xi0 + ri, yi1);
			path.curveTo(xi0 + ri - ri*k, yi1, xi0, yi1 - ri + ri*k, xi0, yi1 - ri);
			path.lineTo(xi0, yi0 + ri);
			path.curveTo(xi0, yi0 + ri - ri*k, xi0 + ri - ri*k, yi0, xi0 + ri, yi0);
			path.close();
			return;
		}
		if (edge === 'top' && side === 'left') {
			// L: bottom [xi0..xi1]×[yi0..cyCut]  +  right [cxCut..xi1]×[cyCut..yi1]
			path.moveTo(xi0 + ri, yi0);
			path.lineTo(xi1 - ri, yi0);
			path.curveTo(xi1 - ri + ri*k, yi0, xi1, yi0 + ri - ri*k, xi1, yi0 + ri);
			path.lineTo(xi1, yi1 - ri);
			path.curveTo(xi1, yi1 - ri + ri*k, xi1 - ri + ri*k, yi1, xi1 - ri, yi1);
			path.lineTo(cxCut, yi1);                    // Berührung (scharf)
			path.lineTo(cxCut, cyCut);                  // Cut-Ecke (scharf)
			path.lineTo(xi0, cyCut);                    // Berührung (scharf)
			path.lineTo(xi0, yi0 + ri);
			path.curveTo(xi0, yi0 + ri - ri*k, xi0 + ri - ri*k, yi0, xi0 + ri, yi0);
			path.close();
			return;
		}
		if (edge === 'bottom' && side === 'left') {
			// L: top [xi0..xi1]×[cyCut..yi1]  +  right [cxCut..xi1]×[yi0..cyCut]
			path.moveTo(cxCut, yi0);                    // Berührung (scharf)
			path.lineTo(xi1 - ri, yi0);
			path.curveTo(xi1 - ri + ri*k, yi0, xi1, yi0 + ri - ri*k, xi1, yi0 + ri);
			path.lineTo(xi1, yi1 - ri);
			path.curveTo(xi1, yi1 - ri + ri*k, xi1 - ri + ri*k, yi1, xi1 - ri, yi1);
			path.lineTo(xi0 + ri, yi1);
			path.curveTo(xi0 + ri - ri*k, yi1, xi0, yi1 - ri + ri*k, xi0, yi1 - ri);
			path.lineTo(xi0, cyCut);                    // Berührung (scharf)
			path.lineTo(cxCut, cyCut);                  // Cut-Ecke (scharf)
			path.lineTo(cxCut, yi0);                    // zurück zum Start
			path.close();
			return;
		}
		if (edge === 'bottom' && side === 'right') {
			// L: top [xi0..xi1]×[cyCut..yi1]  +  left [xi0..cxCut]×[yi0..cyCut]
			path.moveTo(xi0 + ri, yi0);
			path.lineTo(cxCut, yi0);                    // Berührung (scharf)
			path.lineTo(cxCut, cyCut);                  // Cut-Ecke (scharf)
			path.lineTo(xi1, cyCut);                    // Berührung (scharf)
			path.lineTo(xi1, yi1 - ri);
			path.curveTo(xi1, yi1 - ri + ri*k, xi1 - ri + ri*k, yi1, xi1 - ri, yi1);
			path.lineTo(xi0 + ri, yi1);
			path.curveTo(xi0 + ri - ri*k, yi1, xi0, yi1 - ri + ri*k, xi0, yi1 - ri);
			path.lineTo(xi0, yi0 + ri);
			path.curveTo(xi0, yi0 + ri - ri*k, xi0 + ri - ri*k, yi0, xi0 + ri, yi0);
			path.close();
			return;
		}
	}

	// Gerundetes Rechteck als CW-Außenkontur mit einer offenen Ecke.
	// Der Cut ist ein RECHTECKIGER Ausschnitt der Größe cW × cH an der
	// betreffenden Ecke. Slot-Kanten sind flach (wie beim `e`-Terminal).
	// Die Innen-Ecke des Cuts ist mit ri gerundet.
	//
	//   edge  'top'|'bottom'   Kante, durch die der Slot geht
	//   side  'left'|'right'   welche Ecke ist offen
	//   cW    Cut-Breite entlang der Ober-/Unterkante
	//   cH    Cut-Höhe entlang der Seitenkante
	function outerRectOpenCorner(path, x, y, w, h, rC, s, t, edge, side, cW, cH, riCut) {
		const k = KAPPA;
		// Cut-Innenecken-Radius: entweder explizit (für Berührung mit L-Hole)
		// oder Fallback wenn nicht übergeben.
		const ri = (riCut != null) ? riCut : Math.max(0, Math.min(rC, cW / 2, cH / 2));

		if (edge === 'top' && side === 'right') {
			// Cut oben-rechts: Rechteck (x+w-cW, y+h-cH) bis (x+w, y+h) fehlt.
			// Innen-Ecke des Cuts: (x+w-cW, y+h-cH), Rundung geht nach außen.
			const cx1 = x + w - cW;                     // linke Kante des Cuts
			const cy1 = y + h - cH;                     // untere Kante des Cuts
			path.moveTo(x + rC, y);
			path.lineTo(x + w - rC, y);
			path.curveTo(x + w - rC + rC*k, y, x + w, y + rC - rC*k, x + w, y + rC);
			path.lineTo(x + w, cy1);                                              // rechte Kante hoch bis Cut-Boden
			path.lineTo(cx1 + ri, cy1);                                           // Cut-Boden nach links bis Rundung
			path.curveTo(cx1 + ri - ri*k, cy1, cx1, cy1 + ri - ri*k, cx1, cy1 + ri);
			path.lineTo(cx1, y + h);                                              // linke Cut-Wand hoch
			path.lineTo(x + rC, y + h);                                           // obere Kante nach links
			path.curveTo(x + rC - rC*k, y + h, x, y + h - rC + rC*k, x, y + h - rC);
			path.lineTo(x, y + rC);
			path.curveTo(x, y + rC - rC*k, x + rC - rC*k, y, x + rC, y);
			path.close();
			return;
		}
		if (edge === 'top' && side === 'left') {
			// Cut oben-links: (x, y+h-cH) bis (x+cW, y+h) fehlt.
			const cx1 = x + cW;                         // rechte Kante des Cuts
			const cy1 = y + h - cH;
			path.moveTo(x + rC, y);
			path.lineTo(x + w - rC, y);
			path.curveTo(x + w - rC + rC*k, y, x + w, y + rC - rC*k, x + w, y + rC);
			path.lineTo(x + w, y + h - rC);
			path.curveTo(x + w, y + h - rC + rC*k, x + w - rC + rC*k, y + h, x + w - rC, y + h);
			path.lineTo(cx1, y + h);                                              // obere Kante bis rechte Cut-Wand
			path.lineTo(cx1, cy1 + ri);                                           // Cut-Wand runter bis Rundung
			path.curveTo(cx1, cy1 + ri - ri*k, cx1 - ri + ri*k, cy1, cx1 - ri, cy1);
			path.lineTo(x, cy1);                                                  // Cut-Boden nach links
			path.lineTo(x, y + rC);
			path.curveTo(x, y + rC - rC*k, x + rC - rC*k, y, x + rC, y);
			path.close();
			return;
		}
		if (edge === 'bottom' && side === 'left') {
			// Cut unten-links: (x, y) bis (x+cW, y+cH) fehlt.
			const cx1 = x + cW;
			const cy1 = y + cH;
			path.moveTo(x + w - rC, y + h);
			path.lineTo(x + rC, y + h);
			path.curveTo(x + rC - rC*k, y + h, x, y + h - rC + rC*k, x, y + h - rC);
			path.lineTo(x, cy1);                                                  // linke Kante runter bis Cut-Deckel
			path.lineTo(cx1 - ri, cy1);                                           // Cut-Deckel nach rechts bis Rundung
			path.curveTo(cx1 - ri + ri*k, cy1, cx1, cy1 - ri + ri*k, cx1, cy1 - ri);
			path.lineTo(cx1, y);                                                  // Cut-Wand runter
			path.lineTo(x + w - rC, y);
			path.curveTo(x + w - rC + rC*k, y, x + w, y + rC - rC*k, x + w, y + rC);
			path.lineTo(x + w, y + h - rC);
			path.curveTo(x + w, y + h - rC + rC*k, x + w - rC + rC*k, y + h, x + w - rC, y + h);
			path.close();
			return;
		}
		if (edge === 'bottom' && side === 'right') {
			// Cut unten-rechts: (x+w-cW, y) bis (x+w, y+cH) fehlt.
			const cx1 = x + w - cW;
			const cy1 = y + cH;
			path.moveTo(x + rC, y + h);
			path.lineTo(x + w - rC, y + h);
			path.curveTo(x + w - rC + rC*k, y + h, x + w, y + h - rC + rC*k, x + w, y + h - rC);
			path.lineTo(x + w, cy1);                                              // rechte Kante runter bis Cut-Deckel
			path.lineTo(cx1 + ri, cy1);                                           // Cut-Deckel nach links bis Rundung
			path.curveTo(cx1 + ri - ri*k, cy1, cx1, cy1 - ri + ri*k, cx1, cy1 - ri);
			path.lineTo(cx1, y);                                                  // Cut-Wand runter
			path.lineTo(x + rC, y);
			path.curveTo(x + rC - rC*k, y, x, y + rC - rC*k, x, y + rC);
			path.lineTo(x, y + h - rC);
			path.curveTo(x, y + h - rC + rC*k, x + rC - rC*k, y + h, x + rC, y + h);
			path.close();
			return;
		}
	}

	function sShape(path, w, H, s, t, r, aperture, y0) {
		// Zwei Bowls, um genau t überlappend.
		// y0: vertikaler Ursprung (default 0). Wird für Overshoot benutzt.
		y0 = y0 || 0;
		const half = H / 2;
		const overlap = t;
		const bowlH   = half + overlap / 2;
		const a = Math.max(0, Math.min(1, (aperture || 0) / 100));
		const cutW = s + a * (w - 2 * s);
		const cutH = t + a * (bowlH - 2 * t);
		const yUp  = y0 + half - overlap / 2;
		const yLo  = y0;
		sBowl(path, 0, yUp, w, bowlH, r, s, t,
			  { edge: 'bottom', side: 'right', cutW, cutH }); // obere Bowl: Cut unten-rechts
		sBowl(path, 0, yLo, w, bowlH, r, s, t,
			  { edge: 'top',    side: 'left',  cutW, cutH }); // untere Bowl: Cut oben-links

		// Mittelbalken: voller Rect überdeckt Hairlines, dann Aperture-Öffnungen herausschneiden.
		const cutWEff = Math.min(cutW, w - r);
		// Voller Rect über Überlappungszone
		rect(path, 0, yUp, w, overlap);
		// Linke Öffnung (untere Bowl, Cut oben-links): geht bis zur Außenkante (x=0)
		if (cutWEff > 0.5) rectHole(path, 0, yUp, cutWEff, overlap);
		// Rechte Öffnung (obere Bowl, Cut unten-rechts): geht bis zur Außenkante (x=w)
		if (cutWEff > 0.5) rectHole(path, w - cutWEff, yUp, cutWEff, overlap);
	}

	/* ---------------------------------------------------------------------- */
	/* Glyph-Erzeugung: alle Builder erhalten normalisiertes p                */
	/* Rückgabe: { width, path }  — width ist die reine Ink-Breite            */
	/* ---------------------------------------------------------------------- */

	const B = {};

	/* -------- Whitespace ------------------------------------------------- */

	B[' '] = (p) => ({ width: p.stem * 3.5, path: new opentype.Path() });

	/* -------- UPPERCASE A–Z --------------------------------------------- */

	B['H'] = (p) => {
		const w = capW(p, 0.72);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p);
		vStem(path, w - p.stem, 0, p.stem, p.capHeight, p);
		// Crossbar: Enden berühren stems → keine runden Enden
		hBar(path, p.stem, p.capHeight / 2 - p.thin / 2, w - 2 * p.stem, p.thin, p, false, false);
		return { width: w, path };
	};

	B['I'] = (p) => {
		const w = Math.max(p.stem, capW(p, 0.14));
		const path = new opentype.Path();
		const x = (w - p.stem) / 2;
		vStem(path, x, 0, p.stem, p.capHeight, p);
		return { width: w, path };
	};

	B['T'] = (p) => {
		const w = capW(p, 0.68);
		const path = new opentype.Path();
		// Obere Bar: freie Enden links + rechts → rund
		hBar(path, 0, p.capHeight - p.thin, w, p.thin, p, true, true);
		const x = (w - p.stem) / 2;
		// Stem: oben verbunden mit Bar → nicht rund; unten frei → rund
		vStem(path, x, 0, p.stem, p.capHeight - p.thin, p, { topRound: false, topSerif: false });
		// Optionale Serifen an Balken-Enden
		if (p.serifStyle !== 'none') {
			const bar = p.thin;
			const sz  = Math.min(p.serifSize * 1.1, (p.capHeight - bar) * 0.8);
			const th  = Math.min(p.serifThickness * 1.0, bar * 0.9);
			if (sz > 0 && th > 0) {
				const inner = p.capHeight - bar;
				if (p.serifStyle === 'wedge') {
					path.moveTo(0, inner); path.lineTo(th,     inner); path.lineTo(0, inner - sz); path.close();
					path.moveTo(w, inner); path.lineTo(w,      inner - sz); path.lineTo(w - th, inner); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, 0,      inner - sz, th, sz);
					rect(path, w - th, inner - sz, th, sz);
				} else if (p.serifStyle === 'hairline') {
					const hw = Math.max(2, th * 0.4);
					rect(path, 0,      inner - sz, hw, sz);
					rect(path, w - hw, inner - sz, hw, sz);
				}
			}
		}
		return { width: w, path };
	};

	B['L'] = (p) => {
		const w = capW(p, 0.6);
		const path = new opentype.Path();
		// Stem: unten verbunden mit Bar → nicht rund
		vStem(path, 0, 0, p.stem, p.capHeight, p, { sides: 'both', bottomRound: false });
		// Bottom bar: links verbunden mit stem, rechts frei
		hBar(path, p.stem, 0, w - p.stem, p.thin, p, false, true);
		if (p.serifStyle !== 'none') {
			const sz = Math.min(p.serifSize * 1.1, (p.capHeight - p.thin) * 0.4);
			const th = Math.min(p.serifThickness * 1.0, p.thin * 0.9);
			if (sz > 0 && th > 0) {
				// Unten-rechts: wie Z unten-rechts
				if (p.serifStyle === 'wedge') {
					path.moveTo(w, p.thin); path.lineTo(w - th, p.thin); path.lineTo(w, p.thin + sz); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, w - th, p.thin, th, sz);
				} else if (p.serifStyle === 'hairline') {
					rect(path, w - Math.max(2, th * 0.4), p.thin, Math.max(2, th * 0.4), sz);
				}
			}
		}
		return { width: w, path };
	};

	B['E'] = (p) => {
		const w = capW(p, 0.62);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p, { topRound: false, bottomRound: false });
		hBar(path, p.stem, p.capHeight - p.thin, w - p.stem, p.thin, p, false, true);
		hBar(path, p.stem, 0,                     w - p.stem, p.thin, p, false, true);
		hBar(path, p.stem, p.capHeight / 2 - p.thin / 2, (w - p.stem) * 0.85, p.thin, p, false, true);
		if (p.serifStyle !== 'none') {
			const midBarEnd = Math.round(p.stem + (w - p.stem) * 0.85);
			const midBarBot = p.capHeight / 2 - p.thin / 2;
			const midBarTop = p.capHeight / 2 + p.thin / 2;
			const sz = Math.min(p.serifSize * 1.1, (p.capHeight - p.thin) * 0.4);
			const th = Math.min(p.serifThickness * 1.0, p.thin * 0.9);
			// Mittel-Serife: Keile OBERHALB und UNTERHALB des Balkenendes (im Weißraum)
			if (sz > 0 && th > 0) {
				if (p.serifStyle === 'wedge') {
					// Oben: von Oberkante nach oben
					path.moveTo(midBarEnd, midBarTop); path.lineTo(midBarEnd - th, midBarTop); path.lineTo(midBarEnd, midBarTop + sz); path.close();
					// Unten: von Unterkante nach unten
					path.moveTo(midBarEnd, midBarBot); path.lineTo(midBarEnd, midBarBot - sz); path.lineTo(midBarEnd - th, midBarBot); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, midBarEnd - th, midBarTop, th, sz);
					rect(path, midBarEnd - th, midBarBot - sz, th, sz);
				} else if (p.serifStyle === 'hairline') {
					const hw = Math.max(2, th * 0.4);
					rect(path, midBarEnd - hw, midBarTop, hw, sz);
					rect(path, midBarEnd - hw, midBarBot - sz, hw, sz);
				}
			}
			const topInner = p.capHeight - p.thin; // Unterkante des oberen Balkens
			const botInner = p.thin;               // Oberkante des unteren Balkens
			// Oben-rechts: wie Z oben-links, gespiegelt
			if (p.serifStyle === 'wedge') {
					path.moveTo(w, topInner); path.lineTo(w, topInner - sz); path.lineTo(w - th, topInner); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, w - th, topInner - sz, th, sz);
				} else if (p.serifStyle === 'hairline') {
					rect(path, w - Math.max(2, th * 0.4), topInner - sz, Math.max(2, th * 0.4), sz);
				}
				// Unten-rechts: wie Z unten-rechts
				if (p.serifStyle === 'wedge') {
					path.moveTo(w, botInner); path.lineTo(w - th, botInner); path.lineTo(w, botInner + sz); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, w - th, botInner, th, sz);
				} else if (p.serifStyle === 'hairline') {
					rect(path, w - Math.max(2, th * 0.4), botInner, Math.max(2, th * 0.4), sz);
				}
		}
		return { width: w, path };
	};

	B['F'] = (p) => {
		const w = capW(p, 0.6);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p, { topRound: false });
		hBar(path, p.stem, p.capHeight - p.thin, w - p.stem, p.thin, p, false, true);
		hBar(path, p.stem, p.capHeight / 2 - p.thin / 2, (w - p.stem) * 0.85, p.thin, p, false, true);
		if (p.serifStyle !== 'none') {
			const midBarEnd = Math.round(p.stem + (w - p.stem) * 0.85);
			const midBarBot = p.capHeight / 2 - p.thin / 2;
			const midBarTop = p.capHeight / 2 + p.thin / 2;
			const sz = Math.min(p.serifSize * 1.1, (p.capHeight - p.thin) * 0.4);
			const th = Math.min(p.serifThickness * 1.0, p.thin * 0.9);
			// Mittel-Serife: Keile OBERHALB und UNTERHALB des Balkenendes (im Weißraum)
			if (sz > 0 && th > 0) {
				if (p.serifStyle === 'wedge') {
					path.moveTo(midBarEnd, midBarTop); path.lineTo(midBarEnd - th, midBarTop); path.lineTo(midBarEnd, midBarTop + sz); path.close();
					path.moveTo(midBarEnd, midBarBot); path.lineTo(midBarEnd, midBarBot - sz); path.lineTo(midBarEnd - th, midBarBot); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, midBarEnd - th, midBarTop, th, sz);
					rect(path, midBarEnd - th, midBarBot - sz, th, sz);
				} else if (p.serifStyle === 'hairline') {
					const hw = Math.max(2, th * 0.4);
					rect(path, midBarEnd - hw, midBarTop, hw, sz);
					rect(path, midBarEnd - hw, midBarBot - sz, hw, sz);
				}
				const topInner = p.capHeight - p.thin;
				if (p.serifStyle === 'wedge') {
					path.moveTo(w, topInner); path.lineTo(w, topInner - sz); path.lineTo(w - th, topInner); path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, w - th, topInner - sz, th, sz);
				} else if (p.serifStyle === 'hairline') {
					rect(path, w - Math.max(2, th * 0.4), topInner - sz, Math.max(2, th * 0.4), sz);
				}
			}
		}
		return { width: w, path };
	};

	B['O'] = (p) => {
		const w = capW(p, 0.78);
		const path = new opentype.Path();
		stadiumRing(path, w / 2, p.capHeight / 2, w / 2, p.capHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['C'] = (p) => {
		const w = capW(p, 0.76);
		const path = new opentype.Path();
		const α = 0.08 + (p.aperture / 100) * 0.85;
		const cx = w / 2, cy = p.capHeight / 2;
		const rx = w / 2, ry = p.capHeight / 2;
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin, α, TAU - α, p.bowlRadius);
		// Terminal-Serifen: beide mittig auf dem Strich (Außenpunkt − stem/2 radial)
		if (p.serifStyle !== 'none') {
			const inR = p.stem / 2;
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(α), cy + (ry - inR) * Math.sin(α),
				p.stem,  α + Math.PI / 2, p);
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(α), cy - (ry - inR) * Math.sin(α),
				p.stem, -α - Math.PI / 2, p);
		}
		return { width: w, path };
	};

	B['G'] = (p) => {
		const w = capW(p, 0.78);
		const cH = p.capHeight;
		const path = new opentype.Path();
		const cx = w / 2, cy = cH / 2;
		// Öffnung oben wie beim S, aber halb so groß
		const gap = Math.PI * (0.15 + (p.aperture / 100) * 0.225);
		// Start bewegt sich mit gap (oben), fester Terminal bei TAU (= rechts-unten-Mitte)
		partialStadiumRing(path, cx, cy, w / 2, cH / 2, p.stem, p.thin,
			gap, TAU, p.bowlRadius);
		// Rechter Zapfen-Stem: von Baseline bis Mitte (+thin/2 für sauberen Bar-Anschluss)
		vStem(path, w - p.stem, 0, p.stem, cy + p.thin / 2, p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, 0, 'bottom', 'right', p);
		// Horizontaler Balken auf halber Höhe: von Glyphmitte bis Stem
		const barW = w / 2 - p.stem;
		if (barW > 0) hBar(path, cx, cy - p.thin / 2, barW, p.thin, p, true, false);
		// Serife am oberen Terminal wie beim C
		if (p.serifStyle !== 'none') {
			const rx = w / 2, ry = cH / 2;
			const inR = p.stem / 2;
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(gap), cy + (ry - inR) * Math.sin(gap),
				p.stem, gap + Math.PI / 2, p);
		}
		return { width: w, path };
	};

	B['Q'] = (p) => {
		const w = capW(p, 0.78);
		const path = new opentype.Path();
		stadiumRing(path, w / 2, p.capHeight / 2, w / 2, p.capHeight / 2, p.stem, p.thin, p.bowlRadius);
		// Diagonale Schwanz-Linie unten rechts
		diag(path, w * 0.6, p.capHeight * 0.18, w * 1.0, -p.capHeight * 0.06, p.thin * 1);
		return { width: w, path };
	};

	B['D'] = (p) => {
		const w    = capW(p, 0.75);
		const H    = p.capHeight;
		const path = new opentype.Path();
		// Linker Stem
		vStem(path, 0, 0, p.stem, H, p, { topRound: false, bottomRound: false });
		// Bowl: öffnet links, rx = ry → regelmäßiger Halbkreis
		const cx = p.stem / 2;
		const cy = H / 2;
		const rx = w - p.stem / 2;
		const ry = H / 2;
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin,
			-Math.PI / 2, Math.PI / 2, p.bowlRadius);
		return { width: w, path };
	};

	B['P'] = (p) => {
		const w = capW(p, 0.62);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p, { topRound: false });
		const bowlH = p.capHeight * 0.55;
		const bowlW = w;
		const rMax  = Math.min(bowlW - p.stem, bowlH / 2);
		const r     = rMax * p.bowlRadius;
		bowlStadium(path, 0, p.capHeight - bowlH, bowlW, bowlH, r, p.stem, p.thin);
		return { width: w, path };
	};

	B['R'] = (p) => {
		const w = capW(p, 0.68);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p, { topRound: false, bottomRound: false });
		const bowlH = p.capHeight * 0.52;
		const bowlW = w;
		const rMax  = Math.min(bowlW - p.stem, bowlH / 2);
		const r     = rMax * p.bowlRadius;
		const bowlY = p.capHeight - bowlH;
		bowlStadium(path, 0, bowlY, bowlW, bowlH, r, p.stem, p.thin);
		// Bein: horizontale Endkappe oben für saubere Verbindung an der Bowl-Unterkante (wie K)
		const legT  = p.thin * 0.8;
		const legX1 = w * 0.38;
		const legDy = bowlY;                               // von bowlY nach 0 → dy = -bowlY
		const legDx = w - legX1;
		const legL  = Math.hypot(legDx, legDy);
		const legHW = legT * legL / legDy;                 // horiz. Kappenbreite am Ende
		diagH(path, legX1, bowlY, w, 0, legT, { anchor1: 'left', anchor2: 'right' });
		if (p.serifStyle !== 'none') {
			diagCapSerif(path, w - legHW, legHW, 0, 'bottom', 'right', p);
		}
		return { width: w, path };
	};

	B['B'] = (p) => {
		// B: linker Stem + zwei Bowls, die sich um t (Balken-Dicke) überlappen
		// → gemeinsamer Mittelbalken bleibt genau t dick (wie bei 8/S).
		// Bei Kontrast (thin ≪ stem) folgt der Mittelbalken automatisch.
		const w    = capW(p, 0.72);
		const path = new opentype.Path();
		const t    = p.thin;
		const H    = p.capHeight;
		vStem(path, 0, 0, p.stem, H, p, { topRound: false, bottomRound: false });
		// Teilungslinie: oberer Bowl etwas kleiner (klassisch)
		const midY = H * 0.52;                 // Trennung nominal
		// Bowls überlappen um t → gemeinsame Mittellinie ist midY,
		// jede Bowl reicht t/2 in die andere Hälfte hinein.
		const topY = midY - t / 2;
		const topH = H - topY;
		const botH = midY + t / 2;             // (untere Bowl: 0…midY+t/2)
		// Obere Bowl (etwas schmaler)
		{
			const bowlW = w * 0.94;
			const rMax  = Math.min(bowlW - p.stem, topH / 2);
			const r     = rMax * p.bowlRadius;
			bowlStadium(path, 0, topY, bowlW, topH, r, p.stem, t);
		}
		// Untere Bowl (volle Breite)
		{
			const bowlW = w;
			const rMax  = Math.min(bowlW - p.stem, botH / 2);
			const r     = rMax * p.bowlRadius;
			bowlStadium(path, 0, 0, bowlW, botH, r, p.stem, t);
		}
		return { width: w, path };
	};

	B['U'] = (p) => {
		const w = capW(p, 0.72);
		const path = new opentype.Path();
		const arcH = w / 2;
		// Zwei vertikale Stems ab der Kurve
		vStem(path, 0,             arcH, p.stem, p.capHeight - arcH, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		vStem(path, w - p.stem,    arcH, p.stem, p.capHeight - arcH, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		// Serifen nur oben
		stemSerif(path, 0,          p.stem, p.capHeight, 'top', 'both', p);
		stemSerif(path, w - p.stem, p.stem, p.capHeight, 'top', 'both', p);
		// Unterer Halbring
		partialStadiumRing(path, w / 2, arcH, w / 2, arcH, p.stem, p.thin, Math.PI, TAU, p.bowlRadius);
		return { width: w, path };
	};

	B['N'] = (p) => {
		const w = capW(p, 0.74);
		const path = new opentype.Path();
		// Stems kontrastunabhängig (p.stem), Diagonale dünn
		vStem(path, 0, 0, p.stem, p.capHeight, p, { sides: 'left' });
		vStem(path, w - p.stem, 0, p.stem, p.capHeight, p, { sides: 'right' });
		// Diagonale vom Kontrast beeinflusst (p.thin)
		diagH(path, p.stem, p.capHeight, w - p.stem, 0, p.stem * 0.9);
		return { width: w, path };
	};

	B['M'] = (p) => {
		const w = capW(p, 0.88);
		const path = new opentype.Path();
		// Linker Stem = Aufstrich → dünn; rechter Stem = Abstrich → dick
		vStem(path, 0, 0, p.thin, p.capHeight, p, { sides: 'left' });
		vStem(path, w - p.stem, 0, p.stem, p.capHeight, p, { sides: 'right' });
		const midX = w / 2;
		const midY = p.capHeight * 0.2;
		// Diagonalen von Innenkante der Stems — links = Aufstrich (thin), rechts = Abstrich (stem)
		// Linke Diagonale: Abstrich (dick) = p.stem; Rechte: Aufstrich (dünn) = p.thin
		diagH(path, p.thin,     p.capHeight, midX, midY, p.stem);
		diagH(path, w - p.stem, p.capHeight, midX, midY, p.thin);
		return { width: w, path };
	};

	B['V'] = (p) => {
		const w = capW(p, 0.74);
		const path = new opentype.Path();
		// Linker Arm (\) = dick, rechter Arm (/) = dünn
		diagH(path, 0, p.capHeight, w / 2, 0, p.stem, { anchor1: 'left'  });
		diagH(path, w, p.capHeight, w / 2, 0, p.thin,  { anchor1: 'right' });
		// Kopfserifen an den oberen Diagonalenden (gap-frei)
		const hyp = Math.hypot(w / 2, p.capHeight);
		const hWS = p.stem * hyp / p.capHeight;
		const hWT = p.thin * hyp / p.capHeight;
		diagCapSerif(path, 0,       hWS, p.capHeight, 'top', 'left',  p);
		diagCapSerif(path, w - hWT, hWT, p.capHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['W'] = (p) => {
		const w = capW(p, 1.02);
		const path = new opentype.Path();
		const midDropY = p.capHeight * 0.35;
		// \=dick, /=dünn — wie VV: außen dick-dünn, innen dünn-dick
		diagH(path, 0,        p.capHeight, w * 0.28, 0,        p.stem,        { anchor1: 'left'  }); // \ dick
		diagH(path, w * 0.28, 0,           w * 0.5,  midDropY, p.thin + 0.01);                       // / dünn
		diagH(path, w * 0.5,  midDropY,    w * 0.72, 0,        p.stem * 0.85);                       // \ dick
		diagH(path, w,        p.capHeight, w * 0.72, 0,        p.thin + 0.01, { anchor1: 'right' }); // / dünn
		// Äußere Kopfserifen gap-frei
		const hypL = Math.hypot(w * 0.28, p.capHeight);
		const hWL  = p.stem * hypL / p.capHeight;
		const hWR  = p.thin * hypL / p.capHeight;
		diagCapSerif(path, 0,       hWL, p.capHeight, 'top', 'left',  p);
		diagCapSerif(path, w - hWR, hWR, p.capHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['X'] = (p) => {
		const w = capW(p, 0.72);
		const path = new opentype.Path();
		// / = dünn, \ = dick
		diagH(path, 0, 0,           w, p.capHeight, p.thin,  { anchor1: 'left',  anchor2: 'right' }); // /
		diagH(path, 0, p.capHeight, w, 0,           p.stem,  { anchor1: 'left',  anchor2: 'right' }); // \
		// Serifen an allen vier Ecken (gap-frei)
		const hyp  = Math.hypot(w, p.capHeight);
		const hWT  = p.thin * hyp / p.capHeight;
		const hWS  = p.stem * hyp / p.capHeight;
		diagCapSerif(path, 0,       hWT, p.capHeight, 'top',    'left',  p); // / oben-links
		diagCapSerif(path, w - hWS, hWS, p.capHeight, 'top',    'right', p); // \ oben-rechts
		diagCapSerif(path, 0,       hWS, 0,           'bottom', 'left',  p); // \ unten-links
		diagCapSerif(path, w - hWT, hWT, 0,           'bottom', 'right', p); // / unten-rechts
		return { width: w, path };
	};

	B['Y'] = (p) => {
		const w = capW(p, 0.7);
		const path = new opentype.Path();
		const midY = p.capHeight * 0.48;
		// Linker Arm (\) = dick, rechter (/) = dünn
		diagH(path, 0, p.capHeight, w / 2, midY, p.stem, { anchor1: 'left'  });
		diagH(path, w, p.capHeight, w / 2, midY, p.thin,  { anchor1: 'right' });
		vStem(path, (w - p.stem) / 2, 0, p.stem, midY + p.stem / 2, p, { topRound: false, topSerif: false });
		// Kopfserifen gap-frei
		const armH = p.capHeight - midY;
		const hyp  = Math.hypot(w / 2, armH);
		const hWS  = p.stem * hyp / armH;
		const hWT  = p.thin * hyp / armH;
		diagCapSerif(path, 0,       hWS, p.capHeight, 'top', 'left',  p);
		diagCapSerif(path, w - hWT, hWT, p.capHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['A'] = (p) => {
		const w = capW(p, 0.78);
		const path = new opentype.Path();
		// Linke Diagonale (\) = dünn, rechte (/) = dick
		diagH(path, 0, 0, w / 2, p.capHeight, p.thin,  { anchor1: 'left'  });
		diagH(path, w, 0, w / 2, p.capHeight, p.stem,  { anchor1: 'right' });
		// Querbalken: Innenkanten der Schenkel (links: thin-breit, rechts: stem-breit)
		const hWL = p.thin  * Math.hypot(w / 2, p.capHeight) / p.capHeight;
		const hWR = p.stem  * Math.hypot(w / 2, p.capHeight) / p.capHeight;
		const y  = p.capHeight * 0.36;
		const t  = y / p.capHeight;
		const barLeft  = hWL       * (1 - t) + (w / 2) * t;
		const barRight = (w - hWR) * (1 - t) + (w / 2) * t;
		// Querbalken exakt bis zu den Schenkel-Innenkanten, SEAM-Overlap verhindert Lücken
		const barW = (barRight - barLeft) * 0.9;
		const barMid = (barLeft + barRight) / 2;
		if (barRight > barLeft) hBar(path, barMid - barW / 2, y, barW, p.thin, p, false, false);
		// Fußserifen gap-frei (diagCapSerif statt stemSerif)
		diagCapSerif(path, 0,       hWL, 0, 'bottom', 'left',  p);
		diagCapSerif(path, w - hWR, hWR, 0, 'bottom', 'right', p);
		return { width: w, path };
	};

	B['Z'] = (p) => {
		const w = capW(p, 0.66);
		const path = new opentype.Path();
		const bar = p.thin;  // wie H-Querbalken
		const diagW = p.stem * 0.8;  // kontrastunabhängig
		rectR(path, 0, p.capHeight - bar, w, bar, p, { tl: 1, tr: 1, bl: 0, br: 0 });
		rectR(path, 0, 0, w, bar, p, { tl: 0, tr: 0, bl: 1, br: 1 });
		diagH(path, w, p.capHeight - bar, 0, bar, diagW, { anchor1: 'right', anchor2: 'left' });
		if (p.serifStyle !== 'none') {
			const sz = Math.min(p.serifSize * 1.1, (p.capHeight - bar) * 0.8);
			const th = Math.min(p.serifThickness * 1.0, bar * 0.9);
			if (sz > 0 && th > 0) {
				const cH = p.capHeight;
				const inner = cH - bar;
				if (p.serifStyle === 'wedge') {
					path.moveTo(0, inner); path.lineTo(th,     inner); path.lineTo(0, inner - sz); path.close();
					path.moveTo(w, bar);   path.lineTo(w - th, bar);   path.lineTo(w, bar + sz);   path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, 0,      inner - sz, th, sz);
					rect(path, w - th, bar,        th, sz);
				} else if (p.serifStyle === 'hairline') {
					const hw = Math.max(2, th * 0.4);
					rect(path, 0,      inner - sz, hw, sz);
					rect(path, w - hw, bar,        hw, sz);
				}
			}
		}
		return { width: w, path };
	};

	B['K'] = (p) => {
		const w = capW(p, 0.7);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.capHeight, p);
		const PHI   = (1 + Math.sqrt(5)) / 2;           // ≈ 1.618
		const joinY = p.capHeight / PHI;                 // ≈ capHeight × 0.618
		const diagW = w - p.stem;
		const dyU   = p.capHeight - joinY;
		const dyL   = joinY;
		const LU    = Math.hypot(diagW, dyU);
		const LL    = Math.hypot(diagW, dyL);
		const sinU  = dyU / LU;
		const sinL  = dyL / LL;
		const tU    = p.thin * 0.8;
		const tL    = p.thin * 0.8;
		// Horizontale Breite des oberen Arms am Stem
		const hWU   = tU * LU / dyU;
		// Horizontale Breite der Enden (anchor2='right') für diagCapSerif
		const hWU_cap = tU * LU / dyU;                              // = hWU (oben-rechts)
		const dxL   = w - (p.stem + hWU);
		const LL_actual = Math.hypot(dxL, dyL);
		const hWL_cap = tL * LL_actual / dyL;                       // unten-rechts
		// Oberer Arm: startet am Stem-Innenrand
		diagH(path, p.stem, joinY, w, p.capHeight, tU, { anchor1: 'left', anchor2: 'right' });
		// Unterer Arm: startet an der Unterkante des oberen Arms (kommt aus ihm heraus)
		diagH(path, p.stem + hWU, joinY, w, 0, tL, { anchor1: 'left', anchor2: 'right' });
		if (p.serifStyle !== 'none') {
			diagCapSerif(path, w - hWU_cap, hWU_cap, p.capHeight, 'top',    'right', p);
			diagCapSerif(path, w - hWL_cap, hWL_cap, 0,           'bottom', 'right', p);
		}
		return { width: w, path };
	};

	B['J'] = (p) => {
		const w = capW(p, 0.45);
		const path = new opentype.Path();
		const stemX = w - p.stem;
		const curveH = w * 0.5;
		// Vertikaler Stem bis oberhalb des Bogens
		vStem(path, stemX, curveH, p.stem, p.capHeight - curveH, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, stemX, p.stem, p.capHeight, 'top', 'both', p);
		// Unterer Bogen (offene Ellipse links unten)
		partialStadiumRing(path, w / 2, curveH, w / 2, curveH, p.stem, p.thin, Math.PI, TAU + 0.001, p.bowlRadius);
		// Kappe rechts nach oben zum Stem
		rectR(path, w - p.stem, curveH, p.stem, Math.max(0, p.thin), p, { tl: 0, tr: 0, bl: 0, br: 0 });
		return { width: w, path };
	};

	B['S'] = (p) => {
		const w    = capW(p, 0.72);
		const over = p.capHeight * 0.02;
		const y0   = -over;
		const H    = p.capHeight + 2 * over;
		const cx   = w / 2;
		// Bowl-Größen wie bei B: obere Bowl etwas kleiner, untere etwas größer
		const rx_top = w * 0.47,  ry_top = H * 0.24 + p.thin / 4;
		const rx_bot = w / 2,     ry_bot = H * 0.26 + p.thin / 4;
		const cy_top = y0 + H - ry_top;
		const cy_bot = y0 + ry_bot;
		// Öffnungswinkel wie bei C/e
		const α = 0.08 + (p.aperture / 100) * 0.85;
		const gap = Math.PI * (0.30 + (p.aperture / 100) * 0.45);
		const path = new opentype.Path();

		// Obere Bowl: fester End-Terminal bei 3π/2+TAU, Start bewegt sich mit gap — gespiegelt zur unteren
		partialStadiumRing(path, cx, cy_top, rx_top, ry_top, p.stem, p.thin,
			3 * Math.PI / 2 + gap, 3 * Math.PI / 2 + TAU, p.bowlRadius);
		// Untere Bowl: fester End-Terminal bei π/2+TAU, Start bewegt sich mit gap
		partialStadiumRing(path, cx, cy_bot, rx_bot, ry_bot, p.stem, p.thin,
			Math.PI / 2 + gap, Math.PI / 2 + TAU, p.bowlRadius);

		// Terminal-Serifen: Strichmitte = Außenpunkt − stem/2 in Radialrichtung
		if (p.serifStyle !== 'none') {
			const sg = Math.sin(gap), cg = Math.cos(gap);
			const inR = p.stem / 2;
			const aU = Math.atan2(-cg, sg);
			arcTerminalSerif(path,
				cx + rx_top * sg - sg * inR,
				cy_top - ry_top * cg + cg * inR,
				p.stem, aU + Math.PI / 2, p);
			const aL = Math.atan2(cg, -sg);
			arcTerminalSerif(path,
				cx - rx_bot * sg + sg * inR,
				cy_bot + ry_bot * cg - cg * inR,
				p.stem, aL + Math.PI / 2, p);
		}

		return { width: w, path };
	};

	B['0'] = (p) => B['O'](p);

	B['1'] = (p) => {
		const w = capW(p, 0.42);
		const path = new opentype.Path();
		const x = (w - p.stem) / 2;
		// Stem
		vStem(path, x, 0, p.stem, p.capHeight, p, { topSerif: false, bottomRound: false });
		// Schräger Flag oben links (sauber mit diagH)
		diagH(path, x - p.stem * 0.9, p.capHeight * 0.72, x + p.stem, p.capHeight, p.thin * 1.1,
			{ anchor1: 'left', anchor2: 'right' });
		return { width: w, path };
	};

	B['2'] = (p) => {
		const w = capW(p, 0.64);
		const path = new opentype.Path();
		const H = p.capHeight;
		const s = p.stem, t = p.thin;

		// Bowl: partialRing (reine Ellipse) — kein Artefakt durch Stadium-Ecken-Mismatch
		const cx = w * 0.5;
		const cy = H * 0.78;
		const rx = w * 0.48;
		const ry = H * 0.22;

		// Apertur steuert Startwinkel: a2 (rechts/unten) fest bei 0, a1 bewegt sich mit Apertur
		const openAngle = (p.aperture / 100) * Math.PI * 0.45;
		partialRing(path, cx, cy, rx, ry, s, t,
			Math.PI + openAngle, 0);

		// Terminal-Punkt der Öffnung (rechts, Winkel 0)
		const ex = cx + rx;
		const ey = cy;

		// Diagonale ragt bis zur inneren Unterkante des Rings hinein → keine Lücke
		const diagStartX = cx - s / 2 + s * 0.02;   // knapp links von Mitte
		const diagStartY = cy - ry + t;              // innere Unterkante
		diagH(path, ex - s * 0.02, ey, 0, t, s * 0.7, { anchor1: 'right', anchor2: 'left' });

		// Fußbalken
		rectR(path, 0, 0, w, t, p, { tl: 0, tr: 0, bl: 1, br: 1 });
		return { width: w, path };
	};

	B['3'] = (p) => {
		const w    = capW(p, 0.72);
		const over = p.capHeight * 0.02;
		const y0   = -over;
		const H    = p.capHeight + 2 * over;
		const cx   = w / 2;
		// Bowl-Größen wie bei B: obere Bowl etwas kleiner, untere etwas größer
		const rx_top = w * 0.47,  ry_top = H * 0.24 + p.thin / 4;
		const rx_bot = w / 2,     ry_bot = H * 0.26 + p.thin / 4;
		const cy_top = y0 + H - ry_top;
		const cy_bot = y0 + ry_bot;
		// Öffnungswinkel wie bei C/e
		const α = 0.08 + (p.aperture / 100) * 0.85;
		const gap = Math.PI * (0.30 + (p.aperture / 100) * 0.45);
		const path = new opentype.Path();

		// Obere Bowl: fester Start bei 3π/2, Ende bewegt sich — gespiegelt zur unteren
		partialStadiumRing(path, cx, cy_top, rx_top, ry_top, p.stem, p.thin,
			3 * Math.PI / 2, 3 * Math.PI / 2 + TAU - gap, p.bowlRadius);
		// Untere Bowl: fester End-Terminal bei π/2+TAU, Start bewegt sich mit gap
		partialStadiumRing(path, cx, cy_bot, rx_bot, ry_bot, p.stem, p.thin,
			Math.PI / 2 + gap, Math.PI / 2 + TAU, p.bowlRadius);

		return { width: w, path };
	};

	B['4'] = (p) => {
		const w = capW(p, 0.68);
		const path = new opentype.Path();
		const H = p.capHeight;
		const barY = H * 0.35;
		const stemX = w - p.stem;
		// Diagonaldicke wie beim K: optisch korrigiert über Winkel
		// Diagonal: von oben-rechts (Stem-Außenkante, ganz oben) nach unten-links (x=0, barY)
		const dx = w - 0;           // horizontal: volle Breite
		const dy = H - barY;        // vertikal
		const L  = Math.hypot(dx, dy);
		const sinA = dy / L;
		const diagThick = p.stem * sinA * 1.35;
		// hW: horizontale Breite des Diagonalstrichs
		const hW = diagThick * L / dy;
		// Rechter Stem (volle Höhe)
		vStem(path, stemX, 0, p.stem, H, p, { topSerif: false, bottomRound: false });
		// Diagonale: von (w, H) oben-rechts nach (0, barY) unten-links
		diagH(path, w, H, 0, barY, diagThick,
			{ anchor1: 'right', anchor2: 'left' });
		// Horizontaler Balken: beginnt rechts der Diagonale (bei hW), endet am Stem
		// Overlap nach links (false) und nach rechts (false) → SEAM-Extension übernimmt hBar
		hBar(path, hW, barY, stemX - hW, p.thin, p, false, false);
		return { width: w, path };
	};

	B['5'] = (p) => {
		const w    = capW(p, 0.72);   // gleiche Breite wie 3
		const path = new opentype.Path();
		const H = p.capHeight;
		// Untere Bowl — identische Parameter wie untere Bowl der 3
		const over = H * 0.02;
		const y0   = -over;
		const bowlH = H + 2 * over;
		const rx_bot = w / 2,  ry_bot = bowlH * 0.26 + p.thin / 4;
		const cy_bot = y0 + ry_bot;
		const gap = Math.PI * (0.30 + (p.aperture / 100) * 0.45);
		partialStadiumRing(path, w / 2, cy_bot, rx_bot, ry_bot, p.stem, p.thin,
			Math.PI / 2 + gap, Math.PI / 2 + TAU, p.bowlRadius);
		// Mittlerer Querbalken: Unterkante bündig auf Außenoberkante der Bowl
		const midY = cy_bot + ry_bot - p.thin;
		hBar(path, 0, midY, w * 0.6, p.thin, p, true, false);
		// Linker Stem: von Oberkante Balken bis Unterseite des oberen Balkens
		rectR(path, 0, midY + p.thin, p.stem, H - p.thin - (midY + p.thin), p, { tl: 1, tr: 1, bl: 0, br: 0 });
		// Oberer Querbalken
		rectR(path, 0, H - p.thin, w * 0.88, p.thin, p, { tl: 1, tr: 1, bl: 0, br: 0 });
		return { width: w, path };
	};

	B['6'] = (p) => {
		// Spiegelung der 9 um 180°: unterer Ring + linker Stem + U-Hook oben
		const w  = capW(p, 0.72);
		const H  = p.capHeight;
		const path = new opentype.Path();
		const gap = Math.PI * (p.aperture / 100) * 0.20;
		// Unterer Ring: untere 60% der Versalhöhe
		const bowlH = H * 0.6;
		const bowlCy = bowlH / 2;
		stadiumRing(path, w / 2, bowlCy, w / 2, bowlH / 2, p.stem, p.thin, p.bowlRadius);
		// U-Hook oben: sitzt oberhalb des Rings bis Oberkante
		const hookRx = w / 2;
		const hookRy = Math.min((H - bowlH) * 0.85, hookRx);
		const hookCy = H - hookRy;
		// Linker Stem: von Oberkante des Rings (bowlCy) bis Mitte Hook
		vStem(path, 0, bowlCy, p.stem, hookCy - bowlCy, p, { topRound: false, bottomRound: false, topSerif: false, bottomSerif: false });
		// U-Hook: CW (π → gap), von links durch die Oberseite, öffnet rechts
		partialStadiumRing(path, w / 2, hookCy, hookRx, hookRy,
			p.stem, p.thin, Math.PI, gap, p.bowlRadius);
		return { width: w, path };
	};

	B['7'] = (p) => {
		const w = capW(p, 0.62);
		const path = new opentype.Path();
		const H = p.capHeight;
		// Oberer Querbalken — hBar mit SEAM an beiden eckigen Enden
		hBar(path, 0, H - p.thin, w, p.thin, p, true, true);
		// Diagonale von oben-rechts nach unten-links — Dicke kontrastunabhängig
		diagH(path, w, H - p.thin, p.stem * 0.5, 0, p.stem * 0.8,
			{ anchor1: 'right', anchor2: 'left' });
		// Optionaler kurzer Mittel-Querbalken
		rectR(path, w * 0.2, H * 0.48, w * 0.45, p.thin, p);
		return { width: w, path };
	};

	B['8'] = (p) => {
		// Konstruktion wie bei 3/S: zwei partialStadiumRing-Bowls mit B-Proportionen,
		// aber ohne Lücke (gap = 0 → voller Ring = stadiumRing)
		const w    = capW(p, 0.72);
		const path = new opentype.Path();
		const H    = p.capHeight;
		const over = H * 0.02;
		const y0   = -over;
		const Hx   = H + 2 * over;
		const cx   = w / 2;
		// Obere Bowl etwas kleiner, untere etwas größer — wie bei B/S/3
		const rx_top = w * 0.47,  ry_top = Hx * 0.24 + p.thin / 4;
		const rx_bot = w / 2,     ry_bot = Hx * 0.26 + p.thin / 4;
		const cy_top = y0 + Hx - ry_top;
		const cy_bot = y0 + ry_bot;
		// Voller Ring = partialStadiumRing über TAU (keine Lücke)
		stadiumRing(path, cx, cy_top, rx_top, ry_top, p.stem, p.thin, p.bowlRadius);
		stadiumRing(path, cx, cy_bot, rx_bot, ry_bot, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['9'] = (p) => {
		// Wie g, aber alles innerhalb Versalhöhe (kein Descender)
		const w  = capW(p, 0.72);
		const H  = p.capHeight;
		const path = new opentype.Path();
		const gap = Math.PI * (p.aperture / 100) * 0.20;
		// Oberer Ring: obere 60% der Versalhöhe
		const bowlH = H * 0.6;
		const bowlCy = H - bowlH / 2;
		stadiumRing(path, w / 2, bowlCy, w / 2, bowlH / 2, p.stem, p.thin, p.bowlRadius);
		// U-Hook unten: sitzt unterhalb des Rings bis Baseline
		const hookRx = w / 2;
		const hookRy = Math.min((H - bowlH) * 0.85, hookRx);
		const hookCy = hookRy;
		// Rechter Stem: startet in der Mitte der oberen Bowl (bowlCy), geht nach unten bis Hook
		vStem(path, w - p.stem, hookCy, p.stem, bowlCy - hookCy, p, { topRound: false, bottomRound: false, topSerif: false, bottomSerif: false });
		// U-Hook: CW, fester Terminal links (-π), öffnet rechts mit gap (0 → -π + gap ... -π)
		partialStadiumRing(path, w / 2, hookCy, hookRx, hookRy,
			p.stem, p.thin, 0, -(Math.PI - gap), p.bowlRadius);
		return { width: w, path };
	};

	/* -------- LOWERCASE a–z --------------------------------------------- */

	B['l'] = (p) => {
		const w = Math.max(p.stem, capW(p, 0.14));
		const path = new opentype.Path();
		const x = (w - p.stem) / 2;
		vStem(path, x, 0, p.stem, p.ascender, p);
		return { width: w, path };
	};

	B['i'] = (p) => {
		const w = Math.max(p.stem, capW(p, 0.14));
		const path = new opentype.Path();
		const x = (w - p.stem) / 2;
		vStem(path, x, 0, p.stem, p.xHeight, p);
		// Punkt darüber (i-Tüttel)
		const dotSize = p.stem * 1.1;
		rectR(path, x + (p.stem - dotSize) / 2, p.xHeight + p.stem * 1.2,
			dotSize, dotSize, p);
		return { width: w, path };
	};

	B['j'] = (p) => {
		const lsb  = -p.stem * 0.5;   // negativer linker Rand → unterschneidet vorh. Buchstaben
		const w    = Math.max(p.stem * 2.2, xW(p, 0.28));
		const path = new opentype.Path();
		// Stem: lsb nach links verschoben
		const stemX = w - p.stem * 1.3 + lsb;
		// Hook-Radius: unabhängig vom lsb-Versatz berechnen
		const stemXBase = w - p.stem * 1.3;  // ohne lsb
		const hookR = Math.min(p.stem * 1.4, p.descender * 0.75, (stemXBase + p.stem) / 2);
		const stemBottomY = -p.descender + hookR;
		// Vertikaler Stem (unten am Hook → bottomRound:false)
		vStem(path, stemX, stemBottomY, p.stem, p.xHeight - stemBottomY, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, stemX, p.stem, p.xHeight, 'top', 'both', p);
		// U-Hook
		const cx = stemX + p.stem - hookR;
		partialStadiumRing(path, cx, stemBottomY, hookR, hookR, p.stem, p.thin, 0, -Math.PI, p.bowlRadius);
		// i-Punkt oben
		const dotSize = p.stem * 1.1;
		rectR(path, stemX + (p.stem - dotSize) / 2, p.xHeight + p.stem * 1.2, dotSize, dotSize, p);
		return { width: w + lsb, path };
	};

	B['n'] = (p) => {
		const w  = xW(p, 1.16);
		const path = new opentype.Path();
		const R         = w / 2;
		const shoulderY = p.xHeight - R;

		vStem(path, 0, 0, p.stem, p.xHeight, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.xHeight, 'top',    'both', p);
		stemSerif(path, 0, p.stem, 0,         'bottom', 'both', p);
		vStem(path, w - p.stem, 0, p.stem, shoulderY, p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, 0, 'bottom', 'both', p);
		partialStadiumRing(path, w / 2, shoulderY, R, R, p.stem, p.thin, 0, Math.PI, p.bowlRadius);
		return { width: w, path };
	};

	B['h'] = (p) => {
		const w  = xW(p, 1.16);
		const path = new opentype.Path();
		const R         = w / 2;
		const shoulderY = p.xHeight - R;

		vStem(path, 0, 0, p.stem, p.ascender, p, { topSerif: true, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.ascender, 'top', 'both', p);
		stemSerif(path, 0, p.stem, 0, 'bottom', 'both', p);
		vStem(path, w - p.stem, 0, p.stem, shoulderY, p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, 0, 'bottom', 'both', p);
		partialStadiumRing(path, w / 2, shoulderY, R, R, p.stem, p.thin, 0, Math.PI, p.bowlRadius);
		return { width: w, path };
	};

	B['m'] = (p) => {
		const w  = xW(p, 1.9);
		const path = new opentype.Path();
		const mX = w / 2 - p.stem / 2;

		const R  = (mX + p.stem) / 2;
		const shoulderY = p.xHeight - R;

		vStem(path, 0,           0, p.stem, p.xHeight,        p, { topSerif: false, bottomSerif: false });
		stemSerif(path, 0,           p.stem, p.xHeight, 'top',    'both', p);
		stemSerif(path, 0,           p.stem, 0,         'bottom', 'both', p);
		vStem(path, mX,          0, p.stem, shoulderY,   p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, mX,          p.stem, 0, 'bottom', 'both', p);
		vStem(path, w - p.stem,  0, p.stem, shoulderY,   p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem,  p.stem, 0, 'bottom', 'both', p);

		partialStadiumRing(path, R,      shoulderY, R, R, p.stem, p.thin, 0, Math.PI, p.bowlRadius);
		partialStadiumRing(path, mX + R, shoulderY, R, R, p.stem, p.thin, 0, Math.PI, p.bowlRadius);
		return { width: w, path };
	};

	B['u'] = (p) => {
		const w = xW(p, 1.16);
		const path = new opentype.Path();
		const R         = w / 2;
		const shoulderY = R;

		vStem(path, 0, shoulderY, p.stem, p.xHeight - shoulderY, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.xHeight, 'top', 'both', p);
		vStem(path, w - p.stem, 0, p.stem, p.xHeight, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, 0, 'bottom', 'both', p);
		stemSerif(path, w - p.stem, p.stem, p.xHeight, 'top', 'both', p);
		partialStadiumRing(path, w / 2, shoulderY, R, R, p.stem, p.thin, Math.PI, TAU, p.bowlRadius);
		return { width: w, path };
	};

	B['o'] = (p) => {
		const w = xW(p, 1.16);
		const path = new opentype.Path();
		stadiumRing(path, w / 2, p.xHeight / 2, w / 2, p.xHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['c'] = (p) => {
		const w = xW(p, 1.1);
		const path = new opentype.Path();
		const α = 0.1 + (p.aperture / 100) * 0.85;
		const cx = w / 2, cy = p.xHeight / 2;
		const rx = w / 2, ry = p.xHeight / 2;
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin, α, TAU - α, p.bowlRadius);
		// Terminal-Serifen: beide mittig auf dem Strich (Außenpunkt − stem/2 radial)
		if (p.serifStyle !== 'none') {
			const inR = p.stem / 2;
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(α), cy + (ry - inR) * Math.sin(α),
				p.stem,  α + Math.PI / 2, p);
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(α), cy - (ry - inR) * Math.sin(α),
				p.stem, -α - Math.PI / 2, p);
		}
		return { width: w, path };
	};

	B['e'] = (p) => {
		const w = xW(p, 1.14);
		const path = new opentype.Path();
		const cx = w / 2, cy = p.xHeight / 2;
		const rx = w / 2, ry = p.xHeight / 2;
		// stem für Ring deckeln damit innere Ellipse nicht negativ wird
		const stem = Math.min(p.stem, rx - 1, ry - 1);
		// Balken nicht dicker als bei stem=120
		const thinAtCap = 120 / p.contrast;
		const thin = Math.min(p.thin, thinAtCap, stem);

		const α_top = Math.asin(Math.min(0.85, thin / (2 * ry)));
		const α_bot = 0.45 + (p.aperture / 100) * 0.45;

		// Ring: C-Shape, Aperture rechts unten
		partialStadiumRing(path, cx, cy, rx, ry, stem, thin, α_top, TAU - α_bot, p.bowlRadius);

		// Querbalken: beginnt an der linken Außenkante des Rings
		const barLeft  = cx - rx;
		const barRight = cx + rx * Math.cos(α_top);
		const barY     = cy - thin / 2;
		if (barRight > barLeft) rect(path, barLeft, barY, barRight - barLeft, thin);

		// Terminal-Serife: Strichmitte = Außenpunkt − thin/2 radial nach innen (wie c unten)
		if (p.serifStyle !== 'none') {
			const inR = thin / 2;
			arcTerminalSerif(path,
				cx + (rx - inR) * Math.cos(α_bot),
				cy - (ry - inR) * Math.sin(α_bot),
				thin, -α_bot - Math.PI / 2, p);
		}
		return { width: w, path };
	};

	B['b'] = (p) => {
		const w = xW(p, 1.18);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.ascender, p);
		stadiumRing(path, w / 2, p.xHeight / 2, w / 2, p.xHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['d'] = (p) => {
		const w = xW(p, 1.18);
		const path = new opentype.Path();
		vStem(path, w - p.stem, 0, p.stem, p.ascender, p);
		stadiumRing(path, w / 2, p.xHeight / 2, w / 2, p.xHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['p'] = (p) => {
		const w = xW(p, 1.18);
		const path = new opentype.Path();
		vStem(path, 0, -p.descender, p.stem, p.xHeight + p.descender, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.xHeight,   'top',    'both', p);
		stemSerif(path, 0, p.stem, -p.descender,'bottom', 'both', p);
		stadiumRing(path, w / 2, p.xHeight / 2, w / 2, p.xHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['q'] = (p) => {
		const w = xW(p, 1.18);
		const path = new opentype.Path();
		vStem(path, w - p.stem, -p.descender, p.stem, p.xHeight + p.descender, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, p.xHeight,   'top',    'both', p);
		stemSerif(path, w - p.stem, p.stem, -p.descender,'bottom', 'both', p);
		stadiumRing(path, w / 2, p.xHeight / 2, w / 2, p.xHeight / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['g'] = (p) => {
		const w = xW(p, 1.18);
		const xH = p.xHeight;
		const path = new opentype.Path();
		// Bowl: voller Ring über x-Höhe
		stadiumRing(path, w / 2, xH / 2, w / 2, xH / 2, p.stem, p.thin, p.bowlRadius);
		// Descender: J-Hook (wie j, aber volle Glyphbreite)
		const hookRx = w / 2;
		const hookRy = Math.min(p.descender * 0.75, hookRx);
		const hookCy = -p.descender + hookRy;
		// Rechter Stem: von Hook-Top - 50 bis x-Höhe (Overlap in Hook-Bowl)
		vStem(path, w - p.stem, hookCy, p.stem, xH - hookCy, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, xH, 'top', 'both', p);
		// U-Hook: kleiner Öffnungswinkel, Terminal leicht diagonal
		const hookGap = Math.PI * (0.05 + (p.aperture / 100) * 0.15);
		const hookEnd = -Math.PI + hookGap;
		partialStadiumRing(path, w / 2, hookCy, hookRx, hookRy,
			p.stem, p.thin, 0, hookEnd, p.bowlRadius);
		if (p.serifStyle !== 'none') {
			const cosE = Math.cos(hookEnd), sinE = Math.sin(hookEnd);
			// Exakte Außen- und Innenkante + seitliche Erweiterung durch serifSize
			const spread = p.serifSize * 0.5;
			// Normale zum Bogen: senkrecht zur Tangente
			const normX = -cosE, normY = -sinE;
			const outerX = w / 2 + hookRx * cosE - normX * spread;
			const outerY = hookCy + hookRy * sinE - normY * spread;
			const innerX = w / 2 + (hookRx - p.stem) * cosE + normX * spread;
			const innerY = hookCy + (hookRy - p.thin) * sinE + normY * spread;
			const midX   = (outerX + innerX) / 2;
			const midY   = (outerY + innerY) / 2;
			// Tangente am Bogenende (CW): (sinE, -cosE) — umgekehrt für Spitze nach außen
			const tanX = -sinE, tanY = cosE;
			const sz = p.serifSize;
			const sw = p.serifStyle === 'hairline' ? Math.max(2, p.serifThickness * 0.4) : p.serifThickness;
			if (p.serifStyle === 'wedge') {
				path.moveTo(outerX, outerY);
				path.lineTo(midX + tanX * sw, midY + tanY * sw);
				path.lineTo(innerX, innerY);
				path.close();
			} else if (p.serifStyle === 'slab' || p.serifStyle === 'hairline') {
				path.moveTo(outerX, outerY);
				path.lineTo(outerX + tanX * sw, outerY + tanY * sw);
				path.lineTo(innerX + tanX * sw, innerY + tanY * sw);
				path.lineTo(innerX, innerY);
				path.close();
			}
		}
		return { width: w, path };
	};

	B['a'] = (p) => {
		// Single-Storey a — Ring + Stem, Bowl = volle x-Höhe
		const w = xW(p, 1.18);
		const xH = p.xHeight;
		const path = new opentype.Path();
		// Stem rechts, volle x-Höhe
		vStem(path, w - p.stem, 0, p.stem, xH, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, w - p.stem, p.stem, xH, 'top',    'both',  p);
		stemSerif(path, w - p.stem, p.stem, 0,  'bottom', 'right', p);
		// Bowl — voller Ring auf x-Höhe
		stadiumRing(path, w / 2, xH / 2, w / 2, xH / 2, p.stem, p.thin, p.bowlRadius);
		return { width: w, path };
	};

	B['s'] = (p) => {
		const w    = xW(p, 1.20);
		const over = p.xHeight * 0.02;
		const y0   = -over;
		const H    = p.xHeight + 2 * over;
		const cx   = w / 2;
		// Bowl-Größen wie bei B: obere Bowl etwas kleiner, untere etwas größer
		const rx_top = w * 0.47,  ry_top = H * 0.24 + p.thin / 4;
		const rx_bot = w / 2,     ry_bot = H * 0.26 + p.thin / 4;
		const cy_top = y0 + H - ry_top;
		const cy_bot = y0 + ry_bot;
		const α = 0.08 + (p.aperture / 100) * 0.85;
		const gap = Math.PI * (0.30 + (p.aperture / 100) * 0.45);
		const path = new opentype.Path();

		partialStadiumRing(path, cx, cy_top, rx_top, ry_top, p.stem, p.thin,
			3 * Math.PI / 2 + gap, 3 * Math.PI / 2 + TAU, p.bowlRadius);
		partialStadiumRing(path, cx, cy_bot, rx_bot, ry_bot, p.stem, p.thin,
			Math.PI / 2 + gap, Math.PI / 2 + TAU, p.bowlRadius);

		// Terminal-Serifen: Strichmitte = Außenpunkt − stem/2 in Radialrichtung
		if (p.serifStyle !== 'none') {
			const sg = Math.sin(gap), cg = Math.cos(gap);
			const inR = p.stem / 2;
			arcTerminalSerif(path,
				cx + rx_top * sg - sg * inR,
				cy_top - ry_top * cg + cg * inR,
				p.stem, Math.atan2(-cg,  sg) + Math.PI / 2, p);
			arcTerminalSerif(path,
				cx - rx_bot * sg + sg * inR,
				cy_bot + ry_bot * cg - cg * inR,
				p.stem, Math.atan2( cg, -sg) + Math.PI / 2, p);
		}

		return { width: w, path };
	};

	B['t'] = (p) => {
		const hookRx = Math.max(p.stem * 1.8, p.xHeight * 0.4);
		const w = Math.max(hookRx * 2, xW(p, 0.75));
		const path = new opentype.Path();
		const rx = hookRx;
		const ry = rx;         // kreisrund
		// cy = ry → Unterkante des Bogens liegt exakt auf Baseline (y=0)
		const cx = rx;
		const cy = ry;
		// Stem von Baseline bis Bogenmitte, -50 Overlap in Bowl
		vStem(path, 0, cy, p.stem, p.ascender - cy, p, { bottomRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.ascender, 'top', 'both', p);
		// Hook: von π (Stem-Kante) nach unten-rechts
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin, Math.PI, Math.PI + Math.PI * 3 / 4, p.bowlRadius);
		// Cross-Balken bei xHeight
		rectR(path, 0, p.xHeight - p.thin / 2, w * 0.65, p.thin, p, { tl: 0, tr: 1, bl: 0, br: 1 });
		return { width: w * 0.85, path };
	};

	B['f'] = (p) => {
		// Halbkreis-Bogen: rx = ry → echter Halbkreis
		const r  = Math.max(p.stem * 1.5, (p.ascender - p.xHeight) * 0.6);
		const cx = r;                          // Mittelpunkt bündig am Stem-Innenrand
		const cy = p.ascender - r;             // Mitte des Halbkreises
		const path = new opentype.Path();
		// Stem von Baseline bis Bogenmitte + 50 Overlap
		vStem(path, 0, 0, p.stem, cy, p, { topRound: false, topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, 0, 'bottom', 'both', p);
		// Echter Halbkreis: π → 0 (oben rum nach rechts)
		partialStadiumRing(path, cx, cy, r, r, p.stem, p.thin, Math.PI, 0, p.bowlRadius);
		// Querbalken: gleiche Länge wie beim t (w_t * 0.65, wobei w_t = hookRx*2*0.85)
		const w      = cx + r + p.thin / 2;
		const w_t    = Math.max(p.stem * 1.8, p.xHeight * 0.4) * 2 * 0.85;
		const barY   = p.xHeight * 0.8 - p.thin / 2;
		const barW   = w_t * 0.75;
		hBar(path, p.stem, barY, barW - p.stem, p.thin, p, false, true);
		return { width: w * 0.85, path };
	};

	B['r'] = (p) => {
		// r = linke Hälfte von n: Stem überdeckt die linke Bogenhälfte (wie bei n).
		const R         = p.xHeight * 0.45;
		const shoulderY = p.xHeight - R;
		// cx = R → outer(π) = 0 (linke Kante), Stem von 0..p.stem überdeckt Bogenhälfte
		const cx        = R;
		// Tinte reicht rechts bis x=R (Bogenpunkt bei π/2) + kleines Sidebearing
		const w         = R - p.stem * 0.3;
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.xHeight, p, { topSerif: false, bottomSerif: false });
		stemSerif(path, 0, p.stem, p.xHeight, 'top',    'both', p);
		stemSerif(path, 0, p.stem, 0,         'bottom', 'both', p);
		partialStadiumRing(path, cx, shoulderY, R, R, p.stem, p.thin, Math.PI / 2, Math.PI, p.bowlRadius);
		return { width: w, path };
	};

	B['v'] = (p) => {
		const w = xW(p, 1.1);
		const path = new opentype.Path();
		// Linker Arm (\) = dick, rechter (/) = dünn
		diagH(path, 0, p.xHeight, w / 2, 0, p.stem, { anchor1: 'left'  });
		diagH(path, w, p.xHeight, w / 2, 0, p.thin,  { anchor1: 'right' });
		// Kopfserifen gap-frei
		const hyp = Math.hypot(w / 2, p.xHeight);
		const hWS = p.stem * hyp / p.xHeight;
		const hWT = p.thin * hyp / p.xHeight;
		diagCapSerif(path, 0,       hWS, p.xHeight, 'top', 'left',  p);
		diagCapSerif(path, w - hWT, hWT, p.xHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['w'] = (p) => {
		const w = xW(p, 1.6);
		const path = new opentype.Path();
		const midY = p.xHeight * 0.35;
		// \=dick, /=dünn — wie v: außen stem/thin, innen schmaler
		diagH(path, 0,        p.xHeight, w * 0.28, 0,    p.stem,         { anchor1: 'left'  }); // \ dick
		diagH(path, w * 0.28, 0,         w * 0.5,  midY, p.thin * 0.7);                         // / dünn innen
		diagH(path, w * 0.5,  midY,      w * 0.72, 0,    p.thin * 0.7);                         // \ dünn innen
		diagH(path, w,        p.xHeight, w * 0.72, 0,    p.thin,         { anchor1: 'right' }); // / dünn
		// Äußere Kopfserifen gap-frei
		const hypL = Math.hypot(w * 0.28, p.xHeight);
		const hWL  = p.stem * hypL / p.xHeight;
		const hWR  = p.thin * hypL / p.xHeight;
		diagCapSerif(path, 0,       hWL, p.xHeight, 'top', 'left',  p);
		diagCapSerif(path, w - hWR, hWR, p.xHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['x'] = (p) => {
		const w = xW(p, 1.1);
		const path = new opentype.Path();
		// / = dünn, \ = dick
		diagH(path, 0, 0,         w, p.xHeight, p.thin,  { anchor1: 'left', anchor2: 'right' }); // /
		diagH(path, 0, p.xHeight, w, 0,         p.stem,  { anchor1: 'left', anchor2: 'right' }); // \
		// Serifen an allen vier Ecken gap-frei
		const hyp  = Math.hypot(w, p.xHeight);
		const hWT  = p.thin * hyp / p.xHeight;
		const hWS  = p.stem * hyp / p.xHeight;
		diagCapSerif(path, 0,       hWT, p.xHeight, 'top',    'left',  p); // / oben-links
		diagCapSerif(path, w - hWS, hWS, p.xHeight, 'top',    'right', p); // \ oben-rechts
		diagCapSerif(path, 0,       hWS, 0,         'bottom', 'left',  p); // \ unten-links
		diagCapSerif(path, w - hWT, hWT, 0,         'bottom', 'right', p); // / unten-rechts
		return { width: w, path };
	};

	B['y'] = (p) => {
		const w  = xW(p, 1.1);
		const path = new opentype.Path();
		const x1L = 0,   y1L = p.xHeight, x2L = w * 0.55, y2L = 0;
		const x1R = w,   y1R = p.xHeight, x2R = w * 0.2,  y2R = -p.descender;
		const dxL = x2L - x1L, dyL = y2L - y1L;
		const dxR = x2R - x1R, dyR = y2R - y1R;
		const denom = dxL * dyR - dyL * dxR;
		const t = ((x1R - x1L) * dyR - (y1R - y1L) * dxR) / denom;
		const mx = x1L + t * dxL;
		const my = y1L + t * dyL;
		// Linker Arm (\) = dick, rechter Arm (/) = dünn, Descender = dünn
		diagH(path, x1L, y1L, mx, my, p.stem, { anchor1: 'left',   anchor2: 'center' }); // \ dick
		diagH(path, x1R, y1R, mx, my, p.thin,  { anchor1: 'right',  anchor2: 'center' }); // / dünn
		diagH(path, mx, my, x2R, y2R, p.thin,  { anchor1: 'center', anchor2: 'left'   }); // dünn
		// Kopfserifen oben gap-frei
		const armH = p.xHeight - my;
		const hypL = Math.hypot(mx,     armH);
		const hypR = Math.hypot(w - mx, armH);
		diagCapSerif(path, 0,                         p.stem * hypL / armH, p.xHeight, 'top', 'left',  p);
		diagCapSerif(path, w - p.thin * hypR / armH,  p.thin * hypR / armH, p.xHeight, 'top', 'right', p);
		return { width: w, path };
	};

	B['k'] = (p) => {
		const w = xW(p, 1.05);
		const path = new opentype.Path();
		vStem(path, 0, 0, p.stem, p.ascender, p);
		const PHI    = (1 + Math.sqrt(5)) / 2;          // ≈ 1.618
		const joinY  = p.xHeight / PHI;                  // ≈ xHeight × 0.618
		const diagW  = w - p.stem;
		const dyU    = p.xHeight - joinY;
		const dyL    = joinY;
		const LU     = Math.hypot(diagW, dyU);
		const LL     = Math.hypot(diagW, dyL);
		const sinU   = dyU / LU;
		const sinL   = dyL / LL;
		const tU     = p.thin * 0.8;
		const tL     = p.thin * 0.8;
		const hWU    = tU * LU / dyU;
		// Oberer Arm am Stem-Innenrand, unterer kommt aus dem oberen heraus
		diagH(path, p.stem,       joinY, w, p.xHeight, tU, { anchor1: 'left', anchor2: 'right' });
		diagH(path, p.stem + hWU, joinY, w, 0,          tL, { anchor1: 'left', anchor2: 'right' });
		if (p.serifStyle !== 'none') {
			const dxL_k   = w - (p.stem + hWU);
			const hWL_cap = tL * Math.hypot(dxL_k, dyL) / dyL;
			diagCapSerif(path, w - tU * LU / dyU, tU * LU / dyU, p.xHeight, 'top',    'right', p);
			diagCapSerif(path, w - hWL_cap,        hWL_cap,        0,         'bottom', 'right', p);
		}
		return { width: w, path };
	};

	B['z'] = (p) => {
		const w = xW(p, 1.0);
		const path = new opentype.Path();
		const bar = p.thin;  // wie H-Querbalken
		// Bei hohem Kontrast (stem >> thin) wird die Diagonale dicker
		const contrast = Math.max(0, p.stem - p.thin);
		const diagW = Math.min(p.stem, 118) * 0.8 + contrast * 0.25;
		rectR(path, 0, p.xHeight - bar, w, bar, p, { tl: 1, tr: 1, bl: 0, br: 0 });
		rectR(path, 0, 0, w, bar, p, { tl: 0, tr: 0, bl: 1, br: 1 });
		diagH(path, w, p.xHeight - bar, 0, bar, diagW, { anchor1: 'right', anchor2: 'left' });
		if (p.serifStyle !== 'none') {
			const sz = Math.min(p.serifSize * 1.1, (p.xHeight - bar) * 0.8);
			const th = Math.min(p.serifThickness * 1.0, bar * 0.9);
			if (sz > 0 && th > 0) {
				const inner = p.xHeight - bar;
				if (p.serifStyle === 'wedge') {
					path.moveTo(0, inner); path.lineTo(th,     inner); path.lineTo(0, inner - sz); path.close();
					path.moveTo(w, bar);   path.lineTo(w - th, bar);   path.lineTo(w, bar + sz);   path.close();
				} else if (p.serifStyle === 'slab') {
					rect(path, 0,      inner - sz, th, sz);
					rect(path, w - th, bar,        th, sz);
				} else if (p.serifStyle === 'hairline') {
					const hw = Math.max(2, th * 0.4);
					rect(path, 0,      inner - sz, hw, sz);
					rect(path, w - hw, bar,        hw, sz);
				}
			}
		}
		return { width: w, path };
	};

	/* -------- Punctuation ----------------------------------------------- */

	B['.'] = (p) => {
		const w = p.stem * 2.4;
		const path = new opentype.Path();
		const d = p.stem * 1.15;
		rectR(path, (w - d) / 2, 0, d, d, p);
		return { width: w, path };
	};

	B[','] = (p) => {
		const w = p.stem * 2.4;
		const path = new opentype.Path();
		const d = p.stem * 1.15;
		rectR(path, (w - d) / 2, 0, d, d, p);
		// Fahne: startet in der Mitte des Punkts, endet leicht unter Baseline
		diag(path, w / 2 + p.stem * 0.3, d / 2, w / 2 - p.stem * 0.5, -p.descender * 0.5, p.stem * 0.7);
		return { width: w, path };
	};

	B[':'] = (p) => {
		const w = p.stem * 2.4;
		const path = new opentype.Path();
		const d = p.stem * 1.15;
		rectR(path, (w - d) / 2, 0, d, d, p);
		rectR(path, (w - d) / 2, p.xHeight - d, d, d, p);
		return { width: w, path };
	};

	B[';'] = (p) => {
		const w = p.stem * 2.4;
		const path = new opentype.Path();
		const d = p.stem * 1.15;
		rectR(path, (w - d) / 2, 0, d, d, p);
		diag(path, w / 2 + p.stem * 0.3, d / 2, w / 2 - p.stem * 0.5, -p.descender * 0.5, p.stem * 0.7);
		rectR(path, (w - d) / 2, p.xHeight - d, d, d, p);
		return { width: w, path };
	};

	B['!'] = (p) => {
		const w = Math.max(p.stem, capW(p, 0.2));
		const path = new opentype.Path();
		const x = (w - p.stem) / 2;
		// Kegel: oben breiter als unten (Vereinfachung: Rechteck)
		rect(path, x, p.stem * 2, p.stem, p.capHeight - p.stem * 2);
		rectR(path, x, 0, p.stem, p.stem, p);
		return { width: w, path };
	};

	B['?'] = (p) => {
		const w    = capW(p, 0.64);
		const path = new opentype.Path();
		const H    = p.capHeight;

		// Bowl wie 'c', aber um -90° gedreht → Öffnung unten (statt rechts).
		// c: α … TAU-α  →  ?: α-π/2 … TAU-α-π/2
		const cx = w / 2;
		const cy = H * 0.72;
		const rx = w / 2;
		const ry = H * 0.26;
		const stem = Math.min(p.stem, rx - 2, ry - 2);
		const thin = Math.min(p.thin, stem);
		const α = 0.15 + (p.aperture / 100) * 0.6;

		// partialRing (reine Ellipse) vermeidet Winding-Artefakte:
		// partialStadiumRing erzeugt bei a1=-π/2 (Stadion-Ecke) ungewollte
		// horizontale Segmente die sich mit dem Steg überschneiden.
		partialRing(path, cx, cy, rx, ry, stem, thin,
			-Math.PI / 2, TAU - α - Math.PI * 3 / 4);

		// Steg: bis innere Unterkante des Rings (cy - ry + thin) → ragt in Bowl → keine Lücke
		const stemX  = cx - stem / 2;
		const stemY1 = cy - ry + thin;   // innere Unterkante des Rings
		const stemY2 = stem * 1.6;
		if (stemY1 > stemY2) {
			rect(path, stemX, stemY2, stem, stemY1 - stemY2);
		}

		// Punkt
		rectR(path, cx - stem / 2, 0, stem, stem, p);
		return { width: w, path };
	};

	B['-'] = (p) => {
		const w = capW(p, 0.4);
		const path = new opentype.Path();
		hBar(path, 0, p.xHeight / 2 - p.thin / 2, w, p.thin, p, true, true);
		return { width: w, path };
	};

	B['_'] = (p) => {
		const w = capW(p, 0.6);
		const path = new opentype.Path();
		hBar(path, 0, -p.descender * 0.6, w, p.thin, p, true, true);
		return { width: w, path };
	};

	B['/'] = (p) => {
		const w = capW(p, 0.5);
		const path = new opentype.Path();
		diagH(path, 0, 0, w, p.capHeight, p.stem, { anchor1: 'left', anchor2: 'right' });
		return { width: w, path };
	};

	B['\\'] = (p) => {
		const w = capW(p, 0.5);
		const path = new opentype.Path();
		diagH(path, 0, p.capHeight, w, 0, p.stem, { anchor1: 'left', anchor2: 'right' });
		return { width: w, path };
	};

	B['('] = (p) => {
		const w = capW(p, 0.32);
		const path = new opentype.Path();
		const cx = w * 1.2, cy = p.capHeight / 2;
		const rx = w * 1.1, ry = p.capHeight / 2 + p.thin;
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin, Math.PI * 0.65, Math.PI * 1.35, p.bowlRadius);
		return { width: w, path };
	};

	B[')'] = (p) => {
		const w = capW(p, 0.32);
		const path = new opentype.Path();
		const cx = -w * 0.2, cy = p.capHeight / 2;
		const rx = w * 1.1, ry = p.capHeight / 2 + p.thin;
		partialStadiumRing(path, cx, cy, rx, ry, p.stem, p.thin, -Math.PI * 0.35, Math.PI * 0.35, p.bowlRadius);
		return { width: w, path };
	};

	B['['] = (p) => {
		const w = capW(p, 0.3);
		const path = new opentype.Path();
		rect(path, 0, 0, p.stem, p.capHeight);
		rect(path, 0, p.capHeight - p.thin, w, p.thin);
		rect(path, 0, 0, w, p.thin);
		return { width: w, path };
	};

	B[']'] = (p) => {
		const w = capW(p, 0.3);
		const path = new opentype.Path();
		rect(path, w - p.stem, 0, p.stem, p.capHeight);
		rect(path, 0, p.capHeight - p.thin, w, p.thin);
		rect(path, 0, 0, w, p.thin);
		return { width: w, path };
	};

	B["'"] = (p) => {
		const w = p.stem * 2;
		const path = new opentype.Path();
		rect(path, (w - p.stem) / 2, p.capHeight * 0.7, p.stem, p.capHeight * 0.3);
		return { width: w, path };
	};

	B['"'] = (p) => {
		const w = p.stem * 3.6;
		const path = new opentype.Path();
		rect(path, p.stem * 0.6, p.capHeight * 0.7, p.stem, p.capHeight * 0.3);
		rect(path, p.stem * 2, p.capHeight * 0.7, p.stem, p.capHeight * 0.3);
		return { width: w, path };
	};

	B['&'] = (p) => {
		const w    = capW(p, 0.72);
		const H    = p.capHeight;
		const path = new opentype.Path();
		// Stem bei 198 deckeln — darüber ändert sich das Aussehen nicht mehr
		const stem = Math.min(p.stem, 198);
		const thin = Math.min(p.thin, stem);
		const over = H * 0.02;
		const y0   = -over;
		const Hx   = H + 2 * over;
		const cx   = w * 0.46;
		const rx_top = w * 0.42,  ry_top = Hx * 0.24 + thin / 4;
		const rx_bot = w * 0.46,  ry_bot = Hx * 0.26 + thin / 4;
		const cy_top = y0 + Hx - ry_top;
		const cy_bot = y0 + ry_bot;
		stadiumRing(path, cx, cy_top, rx_top, ry_top, stem, thin, p.bowlRadius);
		const gapBot = Math.PI / 4 * 1.0;  // fixer Wert, nicht apertur-gekoppelt
		partialStadiumRing(path, cx, cy_bot, rx_bot, ry_bot, stem, thin,
			Math.PI / 4 + gapBot, Math.PI / 4 + TAU - gapBot, p.bowlRadius);
		diag(path, cx - rx_bot * 0.4, cy_bot + ry_bot, w, 0, stem);
		return { width: w, path };
	};

	B['@'] = (p) => {
		const w  = capW(p, 1.05);
		const H  = p.capHeight;
		const path = new opentype.Path();
		const cy = H / 2;

		// --- Äußerer Ring: größer und nach rechts verschoben ---
		const rShift = w * 0.02;
		const rcx = w / 2 + rShift;
		const rx = w * 0.5, ry = H * 0.55;

		const gap = Math.PI * 0.20;  // fixer Wert, nicht apertur-gekoppelt
		const ringStart = -Math.PI / 2 + gap;
		const ringEnd   = -Math.PI / 2 - gap + TAU;
		partialStadiumRing(path, rcx, cy, rx, ry, p.stem, p.thin,
			ringStart, ringEnd, p.bowlRadius);

		// Ring rechter Endpunkt → Stem-Position
		const exR  = rcx + rx * Math.cos(ringStart);
		const eyR  = cy  + ry * Math.sin(ringStart);
		const stemX = exR - p.stem;

		// --- Innere Bowl: voller Kreis wie beim a ---
		const ir  = w * 0.26;
		const iry = H * 0.25;
		const icx = stemX - ir + p.stem * 1.0;
		const icy = cy;
		stadiumRing(path, icx, icy, ir, iry, p.stem, p.thin, p.bowlRadius);

		// --- Vertikaler Stem ---
		const stemTop = icy + iry;
		rect(path, stemX, eyR, p.stem, stemTop - eyR);

		return { width: w + p.stem, path };
	};

	B['#'] = (p) => {
		const w = capW(p, 0.72);
		const path = new opentype.Path();
		const th = p.thin * 0.9;
		rect(path, 0, p.capHeight * 0.28 - th / 2, w, th);
		rect(path, 0, p.capHeight * 0.62 - th / 2, w, th);
		diag(path, w * 0.28, 0, w * 0.2, p.capHeight, th * 1.1);
		diag(path, w * 0.72, 0, w * 0.64, p.capHeight, th * 1.1);
		return { width: w, path };
	};

	B['+'] = (p) => {
		const w = capW(p, 0.6);
		const path = new opentype.Path();
		const cy = p.xHeight / 2;
		rect(path, 0, cy - p.thin / 2, w, p.thin);
		rect(path, w / 2 - p.thin / 2, cy - w / 2, p.thin, w);
		return { width: w, path };
	};

	B['='] = (p) => {
		const w = capW(p, 0.6);
		const path = new opentype.Path();
		const cy = p.xHeight / 2;
		rect(path, 0, cy + p.thin * 0.9 - p.thin / 2, w, p.thin);
		rect(path, 0, cy - p.thin * 0.9 - p.thin / 2, w, p.thin);
		return { width: w, path };
	};

	B['*'] = (p) => {
		const w = capW(p, 0.5);
		const path = new opentype.Path();
		const cx = w / 2, cy = p.capHeight * 0.7;
		const r = w * 0.4;
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * TAU;
			diag(path, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, p.thin * 0.9);
		}
		return { width: w, path };
	};

	B['%'] = (p) => {
		const w = capW(p, 0.9);
		const path = new opentype.Path();
		const r = p.capHeight * 0.18;
		stadiumRing(path, r + p.stem * 0.2, p.capHeight - r, r, r, p.stem * 0.7, p.thin * 0.7, p.bowlRadius);
		stadiumRing(path, w - r - p.stem * 0.2, r, r, r, p.stem * 0.7, p.thin * 0.7, p.bowlRadius);
		diag(path, w * 0.15, 0, w * 0.85, p.capHeight, p.stem * 0.9);
		return { width: w, path };
	};

	B['<'] = (p) => {
		const w = capW(p, 0.55);
		const path = new opentype.Path();
		const cy = p.xHeight / 2;
		diag(path, w, cy + w / 2, 0, cy, p.thin);
		diag(path, 0, cy, w, cy - w / 2, p.thin);
		return { width: w, path };
	};

	B['>'] = (p) => {
		const w = capW(p, 0.55);
		const path = new opentype.Path();
		const cy = p.xHeight / 2;
		diag(path, 0, cy + w / 2, w, cy, p.thin);
		diag(path, w, cy, 0, cy - w / 2, p.thin);
		return { width: w, path };
	};

	/* Fallback für nicht-implementierte Codepoints: kleines Rechteck */
	const fallback = (p) => {
		const w = p.stem * 3;
		const path = new opentype.Path();
		rect(path, p.stem * 0.5, p.stem, p.stem * 2, p.xHeight - p.stem * 2);
		rect(path, p.stem * 0.5 + p.stem * 0.3, p.stem + p.stem * 0.3,
		     p.stem * 1.4, p.xHeight - p.stem * 2.6);
		return { width: w, path };
	};

	/* Umlaute – als Basisbuchstabe + Punkte darüber */
	function addUmlautDots(built, p, isCap) {
		const y = (isCap ? p.capHeight : p.xHeight) + p.stem * 1.2;
		const d = p.stem * 1.05;
		const w = built.width;
		const gap = p.stem * 1.0;
		const totalDots = d * 2 + gap;
		const startX = (w - totalDots) / 2;
		rect(built.path, startX, y, d, d);
		rect(built.path, startX + d + gap, y, d, d);
		return built;
	}
	B['ä'] = (p) => addUmlautDots(B['a'](p), p, false);
	B['ö'] = (p) => addUmlautDots(B['o'](p), p, false);
	B['ü'] = (p) => addUmlautDots(B['u'](p), p, false);
	B['Ä'] = (p) => addUmlautDots(B['A'](p), p, true);
	B['Ö'] = (p) => addUmlautDots(B['O'](p), p, true);
	B['Ü'] = (p) => addUmlautDots(B['U'](p), p, true);

	/* Å / å – wie A/a + kleiner Ring oben */
	function addRingAbove(built, p, isCap) {
		const baseY = (isCap ? p.capHeight : p.xHeight) + p.stem * 0.9;
		const rr = p.stem * 0.75;
		const cx = built.width / 2;
		const cy = baseY + rr;
		stadiumRing(built.path, cx, cy, rr, rr, Math.max(p.thin * 0.8, 1), Math.max(p.thin * 0.8, 1), p.bowlRadius);
		return built;
	}
	B['Å'] = (p) => addRingAbove(B['A'](p), p, true);
	B['å'] = (p) => addRingAbove(B['a'](p), p, false);

	/* Ø / ø – Strich, dessen 4 Ecken exakt auf die innere Ellipse projiziert werden */
	function addStroke(built, p, isCap) {
		const H = isCap ? p.capHeight : p.xHeight;
		const w = built.width;
		const cx = w / 2, cy = H / 2;
		const irx = w / 2 - p.stem;
		const iry = H / 2 - p.thin;
		if (irx <= 1 || iry <= 1) return built;

		// Endpunkte der Diagonalen auf der inneren Ellipse
		const t   = Math.atan2(irx * H, iry * w);
		const ex  = irx * Math.cos(t);
		const ey  = iry * Math.sin(t);

		// Senkrechter Vektor zur Diagonalen
		const len = Math.hypot(2*ex, 2*ey);
		const nx  = -2*ey/len, ny = 2*ex/len;
		const hw  = p.thin / 2;

		// 4 Ecken des Balkens (relativ zu Zentrum)
		const corners = [
			[-ex + hw*nx, -ey + hw*ny],
			[ ex + hw*nx,  ey + hw*ny],
			[ ex - hw*nx,  ey - hw*ny],
			[-ex - hw*nx, -ey - hw*ny],
		];

		// Jede Ecke auf die innere Ellipse projizieren falls außerhalb
		const clamped = corners.map(([px, py]) => {
			const r = Math.sqrt((px/irx)**2 + (py/iry)**2);
			return r <= 1 ? [px, py] : [px/r, py/r];
		});

		built.path.moveTo(cx + clamped[0][0], cy + clamped[0][1]);
		built.path.lineTo(cx + clamped[1][0], cy + clamped[1][1]);
		built.path.lineTo(cx + clamped[2][0], cy + clamped[2][1]);
		built.path.lineTo(cx + clamped[3][0], cy + clamped[3][1]);
		built.path.close();
		return built;
	}
	B['Ø'] = (p) => addStroke(B['O'](p), p, true);
	B['ø'] = (p) => addStroke(B['o'](p), p, false);
	B['ß'] = (p) => {
		// Vereinfachung: wie B, aber Höhe bis Ascender links
		const built = B['B'](p);
		return built;
	};

	/* ---------------------------------------------------------------------- */
	/* Post-processing: Slant                                                 */
	/* ---------------------------------------------------------------------- */

	function slantPath(path, angleRad) {
		if (Math.abs(angleRad) < 1e-6) return;
		const t = Math.tan(angleRad);
		for (const cmd of path.commands) {
			if (typeof cmd.x  === 'number' && typeof cmd.y  === 'number') cmd.x  += cmd.y  * t;
			if (typeof cmd.x1 === 'number' && typeof cmd.y1 === 'number') cmd.x1 += cmd.y1 * t;
			if (typeof cmd.x2 === 'number' && typeof cmd.y2 === 'number') cmd.x2 += cmd.y2 * t;
		}
	}

	/* ---------------------------------------------------------------------- */
	/* Public API                                                              */
	/* ---------------------------------------------------------------------- */

	global.GlyphEngine = {
		normalizeParams,
		builders: B,
		fallback,
		slantPath,
		/**
		 * Baut einen einzelnen opentype.Glyph.
		 */
		buildGlyph(char, unicode, name, params) {
			const p = params.__normalized ? params : normalizeParams(params);
			p.__normalized = true;
			// Fraktur: KAPPA global reduzieren → alle Bögen werden kantiger
			KAPPA = KAPPA_BASE * (1 - (p.fraktur || 0) * 0.88);
			const builder = B[char] || fallback;
			const built = builder(p);
			// Ornamente: nur für Majuskeln (A–Z) und bei ornament > 0
			if (p.ornament > 0 && char >= 'A' && char <= 'Z') {
				addOrnaments(built.path, p, built.width);
			}
			// Sidebearing anwenden: Ink von x=sb bis x=sb+width, advance = width + 2*sb
			const sb = p.sidebearing || 0;
			for (const cmd of built.path.commands) {
				if (typeof cmd.x  === 'number') cmd.x  += sb;
				if (typeof cmd.x1 === 'number') cmd.x1 += sb;
				if (typeof cmd.x2 === 'number') cmd.x2 += sb;
			}
			slantPath(built.path, p.slantRad);
			return new opentype.Glyph({
				name,
				unicode,
				advanceWidth: Math.round(built.width + sb * 2),
				path: built.path
			});
		}
	};

})(typeof window !== 'undefined' ? window : globalThis);
