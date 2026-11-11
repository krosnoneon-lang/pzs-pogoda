// Paleta "ciemna telewizyjna". Zmień tutaj, a zmieni się w całej mapie.
export const THEME = {
	bg: '#060b16',
	outsideMask: '#03060d',
	outsideMaskOpacity: 0.62,

	hillShadow: '#010309',
	hillHighlight: '#4a6c9e',
	hillAccent: '#0c1a33',

	water: '#16477a',
	waterFill: '#0d2c52',

	wojLine: '#8c9cc0',
	countryLine: '#c3cde3',
	podkGlow: '#3fb8ff',
	podkCore: '#cdeeff',

	dw: '#55678a',
	dk: '#93a3c4',
	a4: '#f2f5fb',
	a4Glow: '#7fa7ff',

	s19: {
		oddane: '#20e3a2',
		budowa: '#ffb21e',
		przygotowanie: '#d6dcea',
	},
	tunnel: '#ff4f8b',
	rail: '#8f86d9',
	railBudowa: '#c77dff',
	trasa: '#ff7062', // koral z logo PzS
	miejsce: '#ff7062',

	text: '#f4f7fc',
	textDim: '#9fb0cf',
	panel: 'rgba(6, 12, 26, 0.78)',
	panelBorder: 'rgba(140, 170, 220, 0.25)',

	// Polskie oznakowanie dróg
	shieldExpress: '#d6232a', // A / S – czerwone tło, biały napis
	shieldDK: '#d6232a',
	shieldDW: '#f4c400', // DW – żółte tło, czarny napis
} as const;

export const FONT_DISPLAY = 'Barlow Condensed';
export const FONT_TEXT = 'Barlow';
