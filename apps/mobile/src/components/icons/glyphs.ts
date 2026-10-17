/**
 * PayTsek glyph set. Every glyph is drawn on a 24-unit grid with one stroke
 * weight, round caps and round joins so the whole app reads as one hand.
 *
 * The vocabulary borrows from the product itself: a receipt with a torn
 * zig-zag edge, the scan aperture corners, and a seal for owner confirmation.
 * Glyphs are pure data so they can be checked without a native renderer.
 */
export type Glyph = {
  /** Stroked paths. */
  d: readonly string[];
  /** Stroked circles as [cx, cy, r]. */
  circles?: readonly (readonly [number, number, number])[];
  /** Solid dots (e.g. the point of an exclamation mark) as [cx, cy, r]. */
  dots?: readonly (readonly [number, number, number])[];
  /** Low-opacity fill shown for the active/tinted variant. */
  tint?: readonly string[];
  /** Fully solid fill regardless of variant (e.g. half of the theme glyph). */
  solid?: readonly string[];
};

export const GLYPH_STROKE = 1.8;
export const GLYPH_TINT_OPACITY = 0.2;

const SLASH = 'M3.5 3.5l17 17';
const RECEIPT = 'M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5Z';
const APERTURE = [
  'M4 8.5v-2A2.5 2.5 0 0 1 6.5 4h2',
  'M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2',
  'M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2',
  'M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2',
] as const;
const DAY_TILE = 'M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v10.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8A1.5 1.5 0 0 1 5 6.5Z';
const BELL = 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z';
const BELL_CLAPPER = 'M10 20.5h4';
const CAMERA = 'M4.5 8.5a2 2 0 0 1 2-2H8l1.5-2h5l1.5 2h1.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z';
const CLOUD = 'M7.5 18.5a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.6-1.3 4.65 4.65 0 0 1-.5 9.25Z';
const WALLET = [
  'M4.5 8.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z',
  'M4.5 8.5l9.8-3.6a1.5 1.5 0 0 1 2 1.4v.2',
  'M15.5 12h4v3.25h-4a1.63 1.63 0 0 1 0-3.25Z',
] as const;
const IMAGE = 'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z';
const IMAGE_HILLS = 'M4.5 16l4.5-4.5 3.5 3.5 2-2 5 5';
const RING: readonly [number, number, number] = [12, 12, 8.5];
const SHIELD = 'M12 3.5l7 2.75v5.5c0 4.4-2.9 7.9-7 9.25-4.1-1.35-7-4.85-7-9.25v-5.5Z';
const PHONE = 'M8.5 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z';
const PHONE_SPEAKER = 'M11 18h2';
const PHONE_LEFT = 'M6.5 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z';
const PERSON_LEFT_HEAD: readonly [number, number, number] = [10, 8.5, 3.25];
const PERSON_LEFT_BODY = 'M3.5 19.5a6.5 6.5 0 0 1 11.5-4.1';
const SEAL = 'M12 3.25L14.58 5.76 18.19 5.81 18.24 9.42 20.75 12 18.24 14.58 18.19 18.19 14.58 18.24 12 20.75 9.42 18.24 5.81 18.19 5.76 14.58 3.25 12 5.76 9.42 5.81 5.81 9.42 5.76Z';
const DOC = 'M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z';
const DOC_FOLD = 'M13.5 3.5V9H19';
const CHECK_SMALL = 'M8.75 12.25l2.25 2.25 4.25-4.5';

export const GLYPHS = {
  // Navigation
  today: { d: [DAY_TILE, 'M8.5 4v4.5', 'M15.5 4v4.5', 'M8.75 14.25l2.25 2.25 4.25-4.5'], tint: [DAY_TILE] },
  receipt: { d: [RECEIPT, 'M9 8h6', 'M9 11.5h6', 'M9 15h3.5'], tint: [RECEIPT] },
  'receipt-check': { d: [RECEIPT, 'M9 7.5h6', 'M9.25 12.75l2 2 3.75-4'], tint: [RECEIPT] },
  'receipt-total': { d: [RECEIPT, 'M9 7.5h6', 'M9 10.5h4', 'M8.5 14h7', 'M8.5 15.75h7'], tint: [RECEIPT] },
  'receipt-alert': { d: [RECEIPT, 'M12 7.5v4.5'], dots: [[12, 15, 0.95]], tint: [RECEIPT] },
  aperture: { d: [...APERTURE, 'M9 8h6v8.5l-1.5-1-1.5 1-1.5-1-1.5 1Z'] },
  'aperture-line': { d: [...APERTURE, 'M3.5 12h17'] },
  'aperture-text': { d: [...APERTURE, 'M8.5 9.5h7', 'M8.5 12h7', 'M8.5 14.5h4'] },
  analytics: {
    d: [
      'M3.5 20h17',
      'M5.5 20v-6.25a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20',
      'M10.25 20V9.75a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20',
      'M15 20V5.75a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20',
    ],
    tint: [
      'M5.5 20v-6.25a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20Z',
      'M10.25 20V9.75a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20Z',
      'M15 20V5.75a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V20Z',
    ],
  },
  sliders: {
    d: ['M4 6h9', 'M17 6h3', 'M4 12h2', 'M10 12h10', 'M4 18h7', 'M15 18h5'],
    circles: [[15, 6, 2], [8, 12, 2], [13, 18, 2]],
    tint: [
      'M13 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z',
      'M6 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z',
      'M11 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z',
    ],
  },

  // Directional
  'chevron-right': { d: ['M9.5 6l6 6-6 6'] },
  'chevron-left': { d: ['M14.5 6l-6 6 6 6'] },
  'chevron-down': { d: ['M6 9.5l6 6 6-6'] },
  'chevron-up': { d: ['M6 14.5l6-6 6 6'] },
  'arrow-right': { d: ['M4.5 12H19', 'M13.5 6.5L19 12l-5.5 5.5'] },
  'arrow-left': { d: ['M19.5 12H5', 'M10.5 6.5L5 12l5.5 5.5'] },
  swap: { d: ['M4.5 8.5h14', 'M15 5l3.5 3.5L15 12', 'M19.5 15.5h-14', 'M9 12l-3.5 3.5L9 19'] },

  // Actions
  close: { d: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'] },
  check: { d: ['M5 12.5l4.5 4.5L19 7.5'] },
  plus: { d: ['M12 5v14', 'M5 12h14'] },
  refresh: { d: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'] },
  restore: { d: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4.5v4h4'] },
  history: { d: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4.5v4h4', 'M12 8v4l2.75 2'] },
  download: { d: ['M12 4v11', 'M7 10.5l5 5 5-5', 'M5 19.5h14'] },
  share: { d: ['M12 3.5v11', 'M8 7.5l4-4 4 4', 'M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5'] },
  pencil: { d: ['M14.5 5.5l4 4L9 19H5v-4Z', 'M12.5 7.5l4 4'] },
  trash: {
    d: [
      'M5 7h14',
      'M9.5 7V5.25A1.25 1.25 0 0 1 10.75 4h2.5a1.25 1.25 0 0 1 1.25 1.25V7',
      'M7 7l.8 11.2A2 2 0 0 0 9.8 20h4.4a2 2 0 0 0 2-1.8L17 7',
      'M10.5 10.5v6',
      'M13.5 10.5v6',
    ],
  },
  email: { d: ['M5.5 6.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z', 'M4 8l8 5.5L20 8'], tint: ['M5.5 6.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z'] },
  logout: { d: ['M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10', 'M10 12h10', 'M16.5 8.5L20 12l-3.5 3.5'] },
  search: { d: ['M15 15l5 5'], circles: [[10.5, 10.5, 6]] },
  'search-text': { d: ['M4.5 6h10', 'M4.5 10h6', 'M4.5 14h4', 'M18 17l2.5 2.5'], circles: [[15.5, 14.5, 3.5]] },
  filter: { d: ['M4 5.5h16l-6 7.5v5.5l-4 2v-7.5Z'] },
  sparkle: {
    d: [
      'M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6Z',
      'M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z',
    ],
  },
  eye: { d: ['M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12Z'], circles: [[12, 12, 3]] },
  'eye-off': { d: ['M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12Z', SLASH], circles: [[12, 12, 3]] },

  // Status
  'alert-circle': { d: ['M12 7.75v5'], circles: [RING], dots: [[12, 16, 0.95]], tint: ['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0Z'] },
  'alert-octagon': { d: ['M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7Z', 'M12 7.75v5'], dots: [[12, 16, 0.95]] },
  'alert-triangle': { d: ['M10.3 4.5a2 2 0 0 1 3.4 0l7 12a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3Z', 'M12 9.5v4'], dots: [[12, 16.5, 0.95]] },
  info: { d: ['M12 11v5.25'], circles: [RING], dots: [[12, 7.9, 0.95]] },
  help: { d: ['M9.75 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.35-1.15.9-1.15 1.65v.4'], circles: [RING], dots: [[12, 16.6, 0.95]] },
  'check-circle': { d: ['M8.25 12.25l2.5 2.5 5-5'], circles: [RING] },
  seal: { d: [SEAL, CHECK_SMALL], tint: [SEAL] },
  void: { d: ['M6 18L18 6'], circles: [RING] },
  pulse: { d: ['M3.5 12.5h4l2-4.5 3.5 9 2.5-6 1.25 1.5h3.75'] },
  'test-tube': { d: ['M14.5 3.5v12a2.5 2.5 0 0 1-5 0v-12', 'M8.5 3.5h7', 'M9.5 11h5'] },

  // People
  'account-circle': { d: ['M6.5 18.2a6.5 6.5 0 0 1 11 0'], circles: [[12, 12, 8.75], [12, 10, 3]] },
  'account-check': { d: [PERSON_LEFT_BODY, 'M15 17.5l1.75 1.75 3.5-3.5'], circles: [PERSON_LEFT_HEAD] },
  'account-multiple': { d: ['M3 19.5a6 6 0 0 1 12 0', 'M15.5 5.75a3 3 0 0 1 0 5.5', 'M17 14a6 6 0 0 1 4 5.5'], circles: [[9, 8.5, 3]] },
  'account-cog': { d: [PERSON_LEFT_BODY, 'M15 15.5h6', 'M15 19h6'], circles: [PERSON_LEFT_HEAD], dots: [[17, 15.5, 1.2], [19.25, 19, 1.2]] },
  'account-remove': { d: [PERSON_LEFT_BODY, 'M16 17.5h5'], circles: [PERSON_LEFT_HEAD] },
  'account-off': { d: ['M5 20a7 7 0 0 1 14 0', SLASH], circles: [[12, 8.5, 3.5]] },
  building: {
    d: [
      'M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v15.5',
      'M15 9.5h3a1.5 1.5 0 0 1 1.5 1.5v9.5',
      'M3.5 20.5h17',
      'M8.5 7.5h3',
      'M8.5 11h3',
      'M8.5 14.5h3',
    ],
  },

  // Security
  'shield-check': { d: [SHIELD, 'M9 12.25l2.25 2.25 4-4.25'] },
  'shield-lock': { d: [SHIELD, 'M10 12.5h4a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5V13a.5.5 0 0 1 .5-.5Z', 'M10.5 12.5v-1.25a1.5 1.5 0 0 1 3 0v1.25'] },

  // Money & evidence
  wallet: { d: [...WALLET] },
  'wallet-off': { d: [...WALLET, SLASH] },
  bell: { d: [BELL, BELL_CLAPPER] },
  'bell-check': { d: [BELL, BELL_CLAPPER, 'M9.5 12l1.75 1.75 3.25-3.25'] },
  'bell-off': { d: [BELL, BELL_CLAPPER, SLASH] },
  'bell-badge': { d: [BELL, BELL_CLAPPER], dots: [[18, 5.5, 2.25]] },
  'bell-ring': { d: [BELL, BELL_CLAPPER, 'M3.5 9.5a8 8 0 0 1 2.5-5', 'M20.5 9.5a8 8 0 0 0-2.5-5'] },

  // Capture
  camera: { d: [CAMERA], circles: [[12, 13, 3.25]] },
  'camera-auto': { d: [CAMERA, 'M12 11.25V13l1.25 1.25'], circles: [[12, 13, 3.25]] },
  'camera-off': { d: [CAMERA, SLASH], circles: [[12, 13, 3.25]] },
  flash: { d: ['M13 3.5L6.5 13.5h5l-1 7 7-10.5h-5Z'], tint: ['M13 3.5L6.5 13.5h5l-1 7 7-10.5h-5Z'] },
  'flash-off': { d: ['M13 3.5L6.5 13.5h5l-1 7 7-10.5h-5Z', SLASH] },
  image: { d: [IMAGE, IMAGE_HILLS], circles: [[15, 9, 1.5]] },
  'image-off': { d: [IMAGE, IMAGE_HILLS, SLASH] },
  'image-stack': {
    d: [
      'M8.5 7.5h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
      'M3.5 15.5v-9a2 2 0 0 1 2-2h10',
      'M7 17l3.5-3.5 3 3 1.5-1.5 3.5 3.5',
    ],
    circles: [[15.75, 11, 1.25]],
  },

  // Sync
  'cloud-upload': { d: [CLOUD, 'M12 16.25v-4.5', 'M9.75 13.75L12 11.5l2.25 2.25'] },
  'cloud-check': { d: [CLOUD, 'M9.5 14l1.75 1.75 3.5-3.5'] },
  'cloud-off': { d: [CLOUD, SLASH] },
  'cloud-alert': { d: [CLOUD, 'M12 11v2.5'], dots: [[12, 16, 0.9]] },

  // Devices
  phone: { d: [PHONE, PHONE_SPEAKER] },
  'phone-link': { d: [PHONE_LEFT, 'M8 18h2', 'M16.5 9a4.5 4.5 0 0 1 0 6', 'M19 6.5a8 8 0 0 1 0 11'] },
  'phone-off': { d: [PHONE, PHONE_SPEAKER, SLASH] },
  'phone-check': { d: [PHONE, PHONE_SPEAKER, 'M9.5 10.75l1.75 1.75 3.25-3.5'] },
  'phone-update': { d: [PHONE, PHONE_SPEAKER, 'M12 7v6.5', 'M9.5 11L12 13.5l2.5-2.5'] },
  'phone-alert': { d: [PHONE, PHONE_SPEAKER, 'M12 7.5v4.5'], dots: [[12, 14.75, 0.9]] },
  battery: { d: ['M7 6.5h10a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V8A1.5 1.5 0 0 1 7 6.5Z', 'M10 6.5v-2h4v2', 'M9 13.5l2 2 4-4'] },
  plug: { d: ['M9 3.5v4', 'M15 3.5v4', 'M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0Z', 'M12 16v4.5'] },
  'server-off': {
    d: [
      'M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 9V6A1.5 1.5 0 0 1 6 4.5Z',
      'M6 13.5h12a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18v-3A1.5 1.5 0 0 1 6 13.5Z',
      SLASH,
    ],
  },
  link: { d: ['M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1', 'M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1'] },
  'link-off': { d: ['M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1', 'M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1', SLASH] },

  // Files & places
  calendar: { d: [DAY_TILE, 'M8.5 4v4.5', 'M15.5 4v4.5', 'M8 13h8', 'M8 16.5h5'] },
  'file-export': { d: ['M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7', 'M13.5 3.5L18 8v3', 'M13.5 3.5V8H18', 'M12 16h8.5', 'M17.5 13l3 3-3 3'] },
  'file-doc': { d: [DOC, DOC_FOLD, 'M8.5 13h7', 'M8.5 16.5h5'] },
  'file-check': { d: [DOC, DOC_FOLD, 'M9 14.5l2 2 4-4'] },
  'file-alert': { d: [DOC, DOC_FOLD, 'M12 11.5v3'], dots: [[12, 17, 0.9]] },
  folder: { d: ['M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z'] },
  inbox: { d: ['M4 13.5l2.2-7.4A1.5 1.5 0 0 1 7.65 5h8.7a1.5 1.5 0 0 1 1.45 1.1l2.2 7.4V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M4 13.5h4.5l1.25 2h4.5l1.25-2H20'] },
  'inbox-in': { d: ['M4 13.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5', 'M4 13.5h4.5l1.25 2h4.5l1.25-2H20', 'M12 3.5v8', 'M9 8.5l3 3 3-3'] },

  // Appearance
  'theme-auto': { d: [], circles: [[12, 12, 8]], solid: ['M12 4a8 8 0 0 1 0 16Z'] },
  sun: { d: ['M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2', 'M5.6 5.6L7 7', 'M17 17l1.4 1.4', 'M5.6 18.4L7 17', 'M17 7l1.4-1.4'], circles: [[12, 12, 3.75]] },
  moon: { d: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z'] },
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof GLYPHS;

/**
 * Icon names used across the app (Material Community naming, which Paper's
 * components also use internally) mapped onto PayTsek glyphs. Names that end
 * in a "filled" variant resolve to the tinted glyph used for active states.
 * Brand marks (e.g. Google) are intentionally absent and keep their own art.
 */
export const ICON_ALIASES: Record<string, { glyph: GlyphName; tinted?: boolean }> = {
  'home-variant': { glyph: 'today', tinted: true },
  'home-variant-outline': { glyph: 'today' },
  'receipt-text': { glyph: 'receipt', tinted: true },
  'receipt-text-outline': { glyph: 'receipt' },
  'receipt-text-check-outline': { glyph: 'receipt-check' },
  'clipboard-list-outline': { glyph: 'receipt-total' },
  'clipboard-alert-outline': { glyph: 'receipt-alert' },
  'qrcode-scan': { glyph: 'aperture' },
  'line-scan': { glyph: 'aperture-line' },
  'text-recognition': { glyph: 'aperture-text' },
  'chart-box': { glyph: 'analytics', tinted: true },
  'chart-box-outline': { glyph: 'analytics' },
  cog: { glyph: 'sliders', tinted: true },
  'cog-outline': { glyph: 'sliders' },

  'chevron-right': { glyph: 'chevron-right' },
  'chevron-left': { glyph: 'chevron-left' },
  'chevron-down': { glyph: 'chevron-down' },
  'chevron-up': { glyph: 'chevron-up' },
  'menu-down': { glyph: 'chevron-down' },
  'menu-up': { glyph: 'chevron-up' },
  'arrow-right': { glyph: 'arrow-right' },
  'arrow-left': { glyph: 'arrow-left' },
  'swap-horizontal': { glyph: 'swap' },

  close: { glyph: 'close' },
  'close-circle': { glyph: 'void' },
  check: { glyph: 'check' },
  plus: { glyph: 'plus' },
  refresh: { glyph: 'refresh' },
  restore: { glyph: 'restore' },
  history: { glyph: 'history' },
  download: { glyph: 'download' },
  'share-variant': { glyph: 'share' },
  'pencil-outline': { glyph: 'pencil' },
  'email-outline': { glyph: 'email' },
  'delete-outline': { glyph: 'trash' },
  logout: { glyph: 'logout' },
  magnify: { glyph: 'search' },
  'text-search': { glyph: 'search-text' },
  'filter-outline': { glyph: 'filter' },
  broom: { glyph: 'sparkle' },
  'eye-outline': { glyph: 'eye' },
  'eye-off-outline': { glyph: 'eye-off' },

  'alert-circle': { glyph: 'alert-circle', tinted: true },
  'alert-circle-outline': { glyph: 'alert-circle' },
  'alert-octagon-outline': { glyph: 'alert-octagon' },
  'alert-outline': { glyph: 'alert-triangle' },
  'information-outline': { glyph: 'info' },
  'help-circle-outline': { glyph: 'help' },
  'check-circle-outline': { glyph: 'check-circle' },
  'check-decagram-outline': { glyph: 'seal' },
  cancel: { glyph: 'void' },
  'heart-pulse': { glyph: 'pulse' },
  'test-tube-outline': { glyph: 'test-tube' },

  'account-circle-outline': { glyph: 'account-circle' },
  'account-check-outline': { glyph: 'account-check' },
  'account-multiple-outline': { glyph: 'account-multiple' },
  'account-cog-outline': { glyph: 'account-cog' },
  'account-remove-outline': { glyph: 'account-remove' },
  'account-off-outline': { glyph: 'account-off' },
  'office-building-outline': { glyph: 'building' },

  'shield-check-outline': { glyph: 'shield-check' },
  'shield-lock-outline': { glyph: 'shield-lock' },

  'wallet-outline': { glyph: 'wallet' },
  'wallet-off-outline': { glyph: 'wallet-off' },
  'bell-outline': { glyph: 'bell' },
  'bell-check-outline': { glyph: 'bell-check' },
  'bell-off-outline': { glyph: 'bell-off' },
  'bell-badge-outline': { glyph: 'bell-badge' },
  'bell-alert-outline': { glyph: 'bell-badge' },
  'bell-ring-outline': { glyph: 'bell-ring' },

  'camera-outline': { glyph: 'camera' },
  'camera-timer': { glyph: 'camera-auto' },
  'camera-off-outline': { glyph: 'camera-off' },
  flash: { glyph: 'flash', tinted: true },
  'flash-off': { glyph: 'flash-off' },
  'image-outline': { glyph: 'image' },
  'image-off-outline': { glyph: 'image-off' },
  'image-multiple-outline': { glyph: 'image-stack' },

  'cloud-upload-outline': { glyph: 'cloud-upload' },
  'cloud-check-outline': { glyph: 'cloud-check' },
  'cloud-off-outline': { glyph: 'cloud-off' },
  'cloud-alert-outline': { glyph: 'cloud-alert' },

  cellphone: { glyph: 'phone' },
  'cellphone-link': { glyph: 'phone-link' },
  'cellphone-off': { glyph: 'phone-off' },
  'cellphone-check': { glyph: 'phone-check' },
  'cellphone-arrow-down': { glyph: 'phone-update' },
  'cellphone-alert': { glyph: 'phone-alert' },
  'battery-check-outline': { glyph: 'battery' },
  connection: { glyph: 'plug' },
  'server-off': { glyph: 'server-off' },
  'link-variant': { glyph: 'link' },
  'link-off': { glyph: 'link-off' },

  'calendar-range': { glyph: 'calendar' },
  'file-export-outline': { glyph: 'file-export' },
  'file-document-outline': { glyph: 'file-doc' },
  'file-check-outline': { glyph: 'file-check' },
  'file-alert-outline': { glyph: 'file-alert' },
  'folder-outline': { glyph: 'folder' },
  'inbox-outline': { glyph: 'inbox' },
  'inbox-arrow-down-outline': { glyph: 'inbox-in' },

  'theme-light-dark': { glyph: 'theme-auto' },
  'weather-sunny': { glyph: 'sun' },
  'weather-night': { glyph: 'moon' },
};

/** Brand marks keep their owners' artwork instead of a PayTsek redraw. */
export const BRAND_ICONS = new Set(['google']);

export function resolveIcon(name: string): { glyph: GlyphName; tinted: boolean } | null {
  if (Object.hasOwn(GLYPHS, name)) return { glyph: name as GlyphName, tinted: false };
  const alias = ICON_ALIASES[name];
  return alias ? { glyph: alias.glyph, tinted: alias.tinted ?? false } : null;
}
