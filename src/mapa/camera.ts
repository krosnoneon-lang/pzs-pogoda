import {Easing, interpolate} from 'remotion';

export type Cam = {
	lng: number;
	lat: number;
	zoom: number;
	pitch: number;
	bearing: number;
};

export type Keyframe = {t: number; cam: Cam};

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Interpolacja kamery między klatkami kluczowymi (t w zakresie 0..1). */
export const camAt = (kfs: Keyframe[], t: number): Cam => {
	if (t <= kfs[0].t) return kfs[0].cam;
	const last = kfs[kfs.length - 1];
	if (t >= last.t) return last.cam;
	let i = 0;
	while (i < kfs.length - 2 && t > kfs[i + 1].t) i++;
	const a = kfs[i];
	const b = kfs[i + 1];
	const p = ease((t - a.t) / (b.t - a.t));
	const lerp = (x: number, y: number) => x + (y - x) * p;
	let db = b.cam.bearing - a.cam.bearing;
	if (db > 180) db -= 360;
	if (db < -180) db += 360;
	return {
		lng: lerp(a.cam.lng, b.cam.lng),
		lat: lerp(a.cam.lat, b.cam.lat),
		zoom: lerp(a.cam.zoom, b.cam.zoom),
		pitch: lerp(a.cam.pitch, b.cam.pitch),
		bearing: a.cam.bearing + db * p,
	};
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const progress = (frame: number, from: number, to: number, easing = true) =>
	interpolate(frame, [from, to], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: easing ? ease : undefined,
	});

/** Zoom, przy którym odcinek o rozpiętości `meters` zajmie `fraction` szerokości kadru. */
export const zoomForExtent = (meters: number, lat: number, widthPx: number, fraction: number) => {
	const worldMeters = 40075016.686 * Math.cos((lat * Math.PI) / 180);
	return Math.log2((worldMeters * fraction * widthPx) / (512 * Math.max(meters, 200)));
};

/** Przesunięcie zoomu dla formatu pionowego – kadr jest węższy. */
export const aspectZoomOffset = (width: number, height: number) => (width < height ? -0.62 : 0);
