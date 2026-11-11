// Strefy bezpieczne: w tych obszarach nie ma napisów ani grafik (przyciski/opisy FB, IG, YT).
export const safeZones = (width: number, height: number) => {
	const portrait = width < height;
	const s = portrait ? width / 1080 : height / 1080;
	return portrait
		? {logoTop: 50 * s, logoH: 150 * s, top: 250 * s, bottom: 400 * s, right: 150 * s, left: 50 * s, s}
		: {logoTop: 36 * s, logoH: 96 * s, top: 0, bottom: 150 * s, right: 60 * s, left: 60 * s, s};
};

/** 0..1 – czy punkt ekranu leży w dozwolonym obszarze (1) czy w strefie zakazanej (0), z łagodnym brzegiem */
export const safeFactor = (x: number, y: number, width: number, height: number) => {
	const z = safeZones(width, height);
	const portrait = width < height;
	const edge = 30 * z.s;
	const f = (d: number) => Math.min(1, Math.max(0, d / edge));
	let o = f(height - z.bottom - y);
	if (portrait) {
		o = Math.min(o, f(y - z.top), f(width - z.right - x));
	} else {
		// prawy górny róg zajmuje logo
		if (x > width - 520 * z.s) o = Math.min(o, f(y - (z.logoTop + z.logoH + 20 * z.s)));
	}
	return o;
};
