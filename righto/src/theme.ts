// Best of You design tokens — lifted exactly from reference/Best of You App v2.dc.html
// Hex with 8 digits = #RRGGBBAA.

export const colors = {
  navy: '#0F2746',        // ink: all primary text, primary buttons, selected states, filled dots
  cream: '#FBF8F1',       // page ground, text on navy
  sand: '#F6E7D6',        // warm tint: "Suggested"/"Partly" pills, highlighted words on navy
  champagne: '#D8B48E',   // logo dot, "new" dot
  champagneLight: '#E6C7A3', // logo dot on navy, kicker on navy
  slate: '#4B5B70',       // secondary text
  slateLight: '#5f6c7d',  // tertiary text, small meta
  steel: '#5E7C96',       // icons in light style, "Fill example" links
  mist: '#e3eaf0',        // "Done" pill bg
  cardOnNavy: '#E9DFD2',  // secondary text on navy cards
  partlyText: '#7a5a36',  // text on sand pills
  partlyIcon: '#a87d52',
  placeholder: '#8a919b',
  hairline: '#0f274612',  // row dividers (also #0f274614)
  lockClock: '#0a1a2a',   // dynamic island
};

// Frosted-glass surfaces (use expo-blur BlurView, tint "light", intensity ~40, plus an overlay View with these)
export const glass = {
  card: {
    gradient: ['#fbf8f142', '#f6e7d61f', '#fbf8f133'], // 115deg, stops 0 / 60% / 100%
    border: '#ffffffa8', borderWidth: 1, radius: 22, // calm Home cards use radius 26
    blur: 24, saturate: 1.5,
    innerHighlight: 'inset 0 1px 1px #ffffffe0, inset 0 -1px 1px #ffffff40',
    shadow: { color: '#0F2746', opacity: 0.08, radius: 35, y: 8 },
  },
  tabBar: { gradient: ['#fbf8f170', '#f6e7d638'], border: '#ffffffa8', blur: 13, radius: 60 },
  sheet: { gradient: ['#fbf8f1f4', '#f6e7d6f0'], border: '#ffffffa8', blur: 20, radius: 30, shadow: { color: '#0F2746', opacity: 0.15, radius: 40, y: -8 } },
  toast: { gradient: ['#fbf8f1e8', '#f6e7d6d0'], blur: 16, radius: 22 },
  lockNotification: { gradient: ['#fbf8f1e0', '#f6e7d6c8'], blur: 20, radius: 24 },
  input: { bg: '#ffffff4d', border: '#ffffffc4', radius: 14, minHeight: 46, padH: 14, padV: 12 },
  secondaryButton: { bg: '#fbf8f170', border: '#0F274640' },
  chipUnselected: { bg: '#fbf8f170', border: '#0F274633' },
};

// Navy "feature" cards (new homework, plan preview, commitment, suggestion)
export const navyCard = {
  overlay: ['#0f2746e8', '#0f2746c4'], // 120deg over background photo, center 45%, cover
  radius: 22, padding: 18, shadow: { color: '#0F2746', opacity: 0.19, radius: 30, y: 10 },
};

// App background (every screen)
export const background = {
  image: 'assets/background-coast.webp', blur: 3, // photo, slightly blurred, inset -12 to hide blur edges
  photoTint: ['#fbf8f180', '#f6e7d6a8', '#0f274670'], // vertical, stops 0 / 65% / 100%
  wash: ['#fbf8f1b0', '#fbf8f138', '#fbf8f158'],      // vertical, stops 0 / 45% / 100%
  lockScreenTint: ['#0f274640', '#0f274610', '#0f274699'], // stops 0 / 40% / 100%
  splashTint: ['#fbf8f1f0', '#fbf8f1c0', '#fbf8f100'],    // stops 0 / 38% / 70%, photo at center 60%
};

export const fonts = {
  serif: 'Newsreader',      // 400, 500, 400 italic — headings AND body
  sans: 'DMSans',           // 500 only — small uppercase kickers, status bar
  script: 'MsMadi',         // 400 — logo, "Sam.", "I commit,", celebratory lines
};

export const type = {
  logoSplash: { font: 'script', size: 104, lineHeight: 104, letterSpacing: -1 },
  logoHeader: { font: 'script', size: 30, lineHeight: 30 },   // 34 on psychologist screens
  nameScript: { font: 'script', size: 66, lineHeight: 66 },   // "Sam."
  scriptCelebrate: { font: 'script', size: 46, lineHeight: 48 },
  tagline: { font: 'sans', weight: '500', size: 12, letterSpacing: 4, uppercase: true, lineHeight: 24 },
  h1: { font: 'serif', size: 34, lineHeight: 37, letterSpacing: -1 },   // screen titles
  h2: { font: 'serif', size: 28, lineHeight: 32, letterSpacing: -0.5 }, // greeting, next-step title
  cardTitle: { font: 'serif', size: 25, lineHeight: 29, letterSpacing: -0.4 },
  routineName: { font: 'serif', size: 21, lineHeight: 23 },
  prompt: { font: 'serif', size: 22, lineHeight: 27 },
  body: { font: 'serif', size: 17, lineHeight: 25 },
  bodySmall: { font: 'serif', size: 16, lineHeight: 24 },
  italicNote: { font: 'serif', style: 'italic', size: 16, lineHeight: 23 },
  meta: { font: 'serif', size: 14, lineHeight: 19 },
  kicker: { font: 'sans', weight: '500', size: 11, letterSpacing: 2.2, uppercase: true },
  button: { font: 'serif', weight: '500', size: 17 },
  buttonSmall: { font: 'serif', weight: '500', size: 16 },
  pill: { font: 'serif', size: 13 },
};

export const radius = { pill: 40, card: 22, cardCalm: 26, sheet: 30, input: 14, chip: 24, dateBlock: 14, appIcon: 10, phone: 52 };

export const space = {
  screenPadH: 18,        // most screens; calm Home uses 26
  headerTop: 52,         // back-button row top (below status bar); Home header 56–58
  cardPad: 18,           // calm Home step card: 26 top / 24 sides / 22 bottom
  gapList: 12, gapSection: 22, gapCalm: 30,
  bottomBar: { padTop: 12, padH: 18, padBottom: 34 },
  tabBarBottom: 28, scrollBottomInset: 120,
};

export const sizes = {
  primaryButton: 54, primaryButtonLarge: 58, secondaryButton: 48, minTouch: 44,
  dot: 22, dotSmall: 20, infoButton: 22 /* visual */, infoHit: 44,
  timerRing: 150, timerRingInset: 6,
  dayCircle: 40, apptBlock: 52,
};

export const outcomes = {
  done: { label: 'Done', bg: '#e3eaf0', fg: '#0F2746', dot: '#0F2746' },
  partial: { label: 'Partly', bg: '#F6E7D6', fg: '#7a5a36', dot: 'half' }, // left half navy
  missed: { label: 'Not today', bg: '#ffffff80', fg: '#4B5B70', dot: '#0f274626', dotOpacity: 0.45 },
  todo: { dot: 'dashed' }, // 1.25px dashed navy outline
};
