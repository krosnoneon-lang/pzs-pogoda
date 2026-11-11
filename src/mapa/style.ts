import type {StyleSpecification, ExpressionSpecification} from 'maplibre-gl';
import {THEME} from './theme';

export type Manifest = {
	dem: boolean;
	demMaxZoom: number;
	roads: boolean;
	water: boolean;
	s19: boolean;
};

const zw = (pairs: [number, number][]): ExpressionSpecification =>
	['interpolate', ['exponential', 1.6], ['zoom'], ...pairs.flat()] as unknown as ExpressionSpecification;

/**
 * Buduje kompletny styl MapLibre z lokalnych plików (bez zewnętrznych serwerów).
 * base – bezwzględny URL do folderu public (np. http://localhost:3000/public/)
 */
export const buildStyle = (base: string, m: Manifest): StyleSpecification => {
	const d = (f: string) => `${base}data/${f}`;

	const sources: StyleSpecification['sources'] = {
		mask: {type: 'geojson', data: d('mask.geojson')},
		podk: {type: 'geojson', data: d('podkarpackie.geojson')},
		podkLine: {type: 'geojson', data: d('podkarpackie_line.geojson')},
		woj: {type: 'geojson', data: d('woj_lines.geojson')},
		countries: {type: 'geojson', data: d('countries_lines.geojson')},
	};

	if (m.dem) {
		const dem = {
			type: 'raster-dem' as const,
			tiles: [`${base}dem/{z}/{x}/{y}.png`],
			encoding: 'terrarium' as const,
			tileSize: 256,
			maxzoom: m.demMaxZoom,
		};
		sources.dem = dem;
		sources.demShade = {...dem};
	}
	if (m.water) {
		sources.rivers = {type: 'geojson', data: d('rivers.geojson')};
		sources.lakes = {type: 'geojson', data: d('lakes.geojson')};
	}
	if (m.roads) {
		sources.roads = {type: 'geojson', data: d('roads.geojson')};
		sources.roadsOuter = {type: 'geojson', data: d('roads_outer.geojson')};
	}
	if (m.s19) {
		sources.s19 = {type: 'geojson', data: d('s19_sections.geojson')};
		sources.s19reveal = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
		// tunele i postęp drążenia ustawiane po załadowaniu (patrz prepareS19 w data.ts)
		sources.tunnels = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
		sources.tunnelProgress = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
	}
	sources.focus = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
	sources.rail = {type: 'geojson', data: d('rail.geojson')};
	sources.trasa = {type: 'geojson', data: {type: 'FeatureCollection', features: []}, lineMetrics: true};

	const layers: StyleSpecification['layers'] = [
		{id: 'bg', type: 'background', paint: {'background-color': THEME.bg}},
	];

	if (m.dem) {
		layers.push(
			{
				id: 'relief',
				type: 'color-relief',
				source: 'demShade',
				paint: {
					'color-relief-opacity': 0.9,
					'color-relief-color': [
						'interpolate',
						['linear'],
						['elevation'],
						0, '#07101e',
						180, '#0a172b',
						350, '#0f2039',
						550, '#152b4b',
						800, '#1d3a62',
						1100, '#29507f',
						1500, '#3a679c',
					],
				},
			} as never,
			{
				id: 'hillshade',
				type: 'hillshade',
				source: 'demShade',
				paint: {
					'hillshade-method': 'multidirectional',
					'hillshade-illumination-direction': [270, 315, 0, 45],
					'hillshade-illumination-altitude': [30, 30, 30, 30],
					'hillshade-highlight-color': ['#6f97d1', '#4a6fa6', '#3b5a8c', '#2c4673'],
					'hillshade-shadow-color': [THEME.hillShadow, THEME.hillShadow, '#020611', '#020611'],
					'hillshade-exaggeration': 0.8,
				},
			} as never,
		);
	}

	if (m.water) {
		layers.push(
			{
				id: 'lakes',
				type: 'fill',
				source: 'lakes',
				paint: {'fill-color': '#1d5fa3', 'fill-opacity': 0.95, 'fill-outline-color': '#5fb0ff'},
			},
			{
				id: 'rivers',
				type: 'line',
				source: 'rivers',
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': '#2f7fd0',
					'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['case', ['get', 'big'], 1, 0.4], 9, ['case', ['get', 'big'], 2, 1], 12, ['case', ['get', 'big'], 4.5, 2.5]] as unknown as ExpressionSpecification,
					'line-opacity': ['case', ['get', 'big'], 1, 0.8],
				},
			},
		);
	}

	// Przyciemnienie wszystkiego poza Podkarpaciem
	layers.push({
		id: 'mask',
		type: 'fill',
		source: 'mask',
		paint: {'fill-color': THEME.outsideMask, 'fill-opacity': THEME.outsideMaskOpacity},
	});

	// Granice województw i państw – kreski
	layers.push(
		{
			id: 'woj-lines',
			type: 'line',
			source: 'woj',
			layout: {'line-join': 'round'},
			paint: {
				'line-color': THEME.wojLine,
				'line-width': zw([[5, 0.8], [8, 1.4], [11, 2.2]]),
				'line-dasharray': [3, 2.5],
				'line-opacity': 0.55,
			},
		},
		{
			id: 'country-lines',
			type: 'line',
			source: 'countries',
			layout: {'line-join': 'round'},
			paint: {
				'line-color': THEME.countryLine,
				'line-width': zw([[5, 1], [8, 1.8], [11, 2.8]]),
				'line-dasharray': [5, 2, 1, 2],
				'line-opacity': 0.6,
			},
		},
	);

	if (m.roads) {
		// Drogi poza Podkarpaciem (tylko A4 i S19, bardzo delikatnie)
		layers.push({
			id: 'roads-outer',
			type: 'line',
			source: 'roadsOuter',
			layout: {'line-cap': 'round', 'line-join': 'round'},
			paint: {
				'line-color': THEME.textDim,
				'line-width': zw([[5, 0.8], [8, 1.5], [11, 3]]),
				'line-opacity': 0.35,
			},
		});
		layers.push(
			{
				id: 'dw',
				type: 'line',
				source: 'roads',
				filter: ['==', ['get', 'cls'], 'dw'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.dw,
					'line-width': zw([[6, 0.5], [8, 0.9], [10, 1.6], [13, 3.5]]),
					'line-opacity': 0.95,
				},
			},
			{
				id: 'dk',
				type: 'line',
				source: 'roads',
				filter: ['==', ['get', 'cls'], 'dk'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.dk,
					'line-width': zw([[6, 0.9], [8, 1.5], [10, 2.4], [13, 5]]),
				},
			},
			{
				id: 'a4-glow',
				type: 'line',
				source: 'roads',
				filter: ['==', ['get', 'cls'], 'a4'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.a4Glow,
					'line-width': zw([[6, 5], [8, 8], [10, 12], [13, 22]]),
					'line-blur': zw([[6, 4], [10, 8], [13, 14]]),
					'line-opacity': 0.45,
				},
			},
			{
				id: 'a4',
				type: 'line',
				source: 'roads',
				filter: ['==', ['get', 'cls'], 'a4'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.a4,
					'line-width': zw([[6, 1.6], [8, 2.6], [10, 3.6], [13, 7]]),
				},
			},
		);
	}

	// Kolej
	layers.push(
		{
			id: 'rail-czynna',
			type: 'line',
			source: 'rail',
			filter: ['==', ['get', 'status'], 'czynna'],
			paint: {'line-color': THEME.rail, 'line-width': zw([[6, 0.8], [9, 1.6], [12, 3]]), 'line-opacity': 0.9},
		},
		{
			id: 'rail-czynna-podklady',
			type: 'line',
			source: 'rail',
			filter: ['==', ['get', 'status'], 'czynna'],
			minzoom: 9,
			paint: {'line-color': '#e9e4ff', 'line-width': zw([[9, 0.8], [12, 1.6]]), 'line-dasharray': [2, 4]},
		},
		{
			id: 'rail-budowa',
			type: 'line',
			source: 'rail',
			filter: ['==', ['get', 'status'], 'budowa'],
			paint: {'line-color': THEME.railBudowa, 'line-width': zw([[6, 2], [9, 3.2], [12, 5.5]]), 'line-dasharray': [2, 1]},
		},
		{
			id: 'rail-planowana',
			type: 'line',
			source: 'rail',
			filter: ['==', ['get', 'status'], 'planowana'],
			layout: {'line-cap': 'round'},
			paint: {'line-color': THEME.railBudowa, 'line-width': zw([[6, 1.8], [9, 2.8], [12, 4.5]]), 'line-dasharray': [0.1, 1.8]},
		},
	);

	// Granica Podkarpacia – świecąca
	layers.push(
		{
			id: 'podk-glow',
			type: 'line',
			source: 'podkLine',
			layout: {'line-join': 'round'},
			paint: {
				'line-color': THEME.podkGlow,
				'line-width': zw([[5, 6], [8, 12], [11, 20]]),
				'line-blur': zw([[5, 5], [8, 10], [11, 16]]),
				'line-opacity': 0.55,
			},
		},
		{
			id: 'podk-core',
			type: 'line',
			source: 'podkLine',
			layout: {'line-join': 'round'},
			paint: {
				'line-color': THEME.podkCore,
				'line-width': zw([[5, 1.2], [8, 2], [11, 3]]),
				'line-opacity': 0.95,
			},
		},
	);

	if (m.s19) {
		const statusColor: ExpressionSpecification = [
			'match',
			['get', 'status'],
			'oddane', THEME.s19.oddane,
			'budowa', THEME.s19.budowa,
			THEME.s19.przygotowanie,
		];
		// S19 jest rysowana ze źródła "s19reveal" – pozwala animować dorysowywanie trasy.
		layers.push(
			{
				id: 's19-glow',
				type: 'line',
				source: 's19reveal',
				filter: ['!=', ['get', 'status'], 'przygotowanie'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': statusColor,
					'line-width': zw([[6, 8], [8, 14], [10, 22], [13, 40]]),
					'line-blur': zw([[6, 6], [10, 14], [13, 24]]),
					'line-opacity': 0.5,
				},
			},
			{
				id: 's19-casing',
				type: 'line',
				source: 's19reveal',
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': '#02050c',
					'line-width': zw([[6, 6], [8, 8.6], [10, 10.5], [13, 17]]),
					'line-opacity': 0.85,
				},
			},
			{
				id: 's19-oddane',
				type: 'line',
				source: 's19reveal',
				filter: ['==', ['get', 'status'], 'oddane'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.s19.oddane,
					'line-width': zw([[6, 3.4], [8, 5.6], [10, 7], [13, 12]]),
				},
			},
			{
				id: 's19-budowa',
				type: 'line',
				source: 's19reveal',
				filter: ['==', ['get', 'status'], 'budowa'],
				layout: {'line-cap': 'butt', 'line-join': 'round'},
				paint: {
					'line-color': THEME.s19.budowa,
					'line-width': zw([[6, 3.4], [8, 5.6], [10, 7], [13, 12]]),
					'line-dasharray': [2.2, 0.9],
				},
			},
			{
				id: 's19-przygotowanie',
				type: 'line',
				source: 's19reveal',
				filter: ['==', ['get', 'status'], 'przygotowanie'],
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.s19.przygotowanie,
					'line-width': zw([[6, 3.2], [8, 5], [10, 6.4], [13, 11]]),
					'line-dasharray': [0.1, 1.6],
				},
			},
			// Tunele: "rura" – szeroka obwódka + jaśniejszy środek
			{
				id: 'tunnel-casing',
				type: 'line',
				source: 'tunnels',
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': THEME.tunnel,
					'line-width': zw([[6, 6], [8, 9], [10, 13], [13, 24]]),
					'line-opacity': ['match', ['get', 'state'], 'planowany', 0.55, 0.95],
				},
			},
			{
				id: 'tunnel-inner',
				type: 'line',
				source: 'tunnels',
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': '#1a0710',
					'line-width': zw([[6, 3], [8, 5], [10, 7.5], [13, 14]]),
				},
			},
			{
				id: 'tunnel-progress',
				type: 'line',
				source: 'tunnelProgress',
				layout: {'line-cap': 'butt', 'line-join': 'round'},
				paint: {
					'line-color': '#ffd1e1',
					'line-width': zw([[6, 1.6], [8, 2.5], [10, 3.6], [13, 6.5]]),
				},
			},
			{
				id: 'tunnel-planned',
				type: 'line',
				source: 'tunnels',
				filter: ['==', ['get', 'state'], 'planowany'],
				layout: {'line-cap': 'butt', 'line-join': 'round'},
				paint: {
					'line-color': THEME.tunnel,
					'line-width': zw([[6, 1.4], [8, 2.2], [10, 3], [13, 5]]),
					'line-dasharray': [1.2, 1.2],
				},
			},
			// Podświetlenie wybranego odcinka (zbliżenia)
			{
				id: 'focus-glow',
				type: 'line',
				source: 'focus',
				layout: {'line-cap': 'round', 'line-join': 'round'},
				paint: {
					'line-color': '#ffffff',
					'line-width': zw([[6, 14], [10, 30], [13, 56]]),
					'line-blur': zw([[6, 10], [10, 20], [13, 34]]),
					'line-opacity': 0,
				},
			},
		);
	}

	// Animowana trasa A → B
	layers.push(
		{
			id: 'trasa-glow',
			type: 'line',
			source: 'trasa',
			layout: {'line-cap': 'round', 'line-join': 'round'},
			paint: {'line-color': THEME.trasa, 'line-width': zw([[6, 10], [10, 22], [13, 40]]), 'line-blur': zw([[6, 8], [13, 24]]), 'line-opacity': 0.6},
		},
		{
			id: 'trasa-line',
			type: 'line',
			source: 'trasa',
			layout: {'line-cap': 'round', 'line-join': 'round'},
			paint: {'line-color': '#ffffff', 'line-width': zw([[6, 3], [10, 5], [13, 9]])},
		},
	);

	const style: StyleSpecification = {
		version: 8,
		name: 'Podkarpacie – S19',
		sources,
		layers,
		sky: {
			'sky-color': '#071226',
			'horizon-color': '#12305a',
			'fog-color': '#060b16',
			'sky-horizon-blend': 0.6,
			'horizon-fog-blend': 0.7,
			'fog-ground-blend': 0.85,
			'atmosphere-blend': 0,
		},
	};
	if (m.dem) {
		style.terrain = {source: 'dem', exaggeration: 1.6};
	}
	return style;
};
