import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

/**
 * Material Design 3 theme (React Native Paper) for consistent look on Android
 * and iOS, light and dark. Status colors are ALWAYS paired with text/icons —
 * never color alone.
 *
 * The palette is a full MD3 tonal set derived from the brand blue so that
 * Paper's surface elevation, containers and outlines all land on the same
 * hue instead of falling back to Paper's default purple.
 */

/** Shared radii. `roundness` is Paper's base unit; components scale from it. */
export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

/** Vertical/horizontal rhythm used across screens. */
export const SPACING = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xlg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;

/** Minimum touch target per accessibility guidance. */
export const TOUCH_TARGET = 48;

/** Space tab screens reserve for the inset navigation dock. */
export const TAB_BAR_CLEARANCE = 108;

/**
 * Keep the platform-native typeface so text feels at home on both platforms,
 * while applying one deliberate scale everywhere. The tighter display styles
 * establish hierarchy; body styles stay relaxed and readable for payment data.
 */
const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const mediumFontFamily = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

const fonts = configureFonts({
  config: {
    displayLarge: { fontFamily, fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: -1.4 },
    displayMedium: { fontFamily, fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: -1.1 },
    displaySmall: { fontFamily, fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -0.9 },
    headlineLarge: { fontFamily, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.7 },
    headlineMedium: { fontFamily, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.55 },
    headlineSmall: { fontFamily, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.35 },
    titleLarge: { fontFamily: mediumFontFamily, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.25 },
    titleMedium: { fontFamily: mediumFontFamily, fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: -0.1 },
    titleSmall: { fontFamily: mediumFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
    bodyLarge: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
    bodyMedium: { fontFamily, fontSize: 14, lineHeight: 21, fontWeight: '400', letterSpacing: 0.1 },
    bodySmall: { fontFamily, fontSize: 12, lineHeight: 18, fontWeight: '400', letterSpacing: 0.15 },
    labelLarge: { fontFamily: mediumFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
    labelMedium: { fontFamily: mediumFontFamily, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.25 },
    labelSmall: { fontFamily: mediumFontFamily, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3 },
  },
});

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: RADIUS.md / 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#155EEF',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EAF0FF',
    onPrimaryContainer: '#102A56',
    secondary: '#155EEF',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#EAF0FF',
    onSecondaryContainer: '#102A56',
    tertiary: '#7A4D00',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFDDB3',
    onTertiaryContainer: '#281900',
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    background: '#F7F8FB',
    onBackground: '#101828',
    surface: '#FFFFFF',
    onSurface: '#101828',
    surfaceVariant: '#EEF1F5',
    onSurfaceVariant: '#475467',
    outline: '#667085',
    outlineVariant: '#E4E7EC',

    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#F4F6F9',
      level3: '#EEF1F5',
      level4: '#E9EDF3',
      level5: '#E4E8EF',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  roundness: RADIUS.md / 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#B2CCFF',
    onPrimary: '#102A56',
    primaryContainer: '#194185',
    onPrimaryContainer: '#D1E0FF',
    secondary: '#B2CCFF',
    onSecondary: '#102A56',
    secondaryContainer: '#194185',
    onSecondaryContainer: '#D1E0FF',
    tertiary: '#F2BB6E',
    onTertiary: '#442B00',
    tertiaryContainer: '#5C3900',
    onTertiaryContainer: '#FFDDB3',
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',

    background: '#0C111D',
    onBackground: '#F2F4F7',
    surface: '#161B26',
    onSurface: '#F2F4F7',
    surfaceVariant: '#1F2633',
    onSurfaceVariant: '#CED3DC',
    outline: '#98A2B3',
    outlineVariant: '#344054',

    elevation: {
      level0: 'transparent',
      level1: '#1B1E25',
      level2: '#1F232B',
      level3: '#242832',
      level4: '#262A34',
      level5: '#2A2E39',
    },
  },
};

/**
 * Semantic colors for evidence states; used together with labels/icons.
 * Both schemes are defined so a chip keeps its meaning in dark mode instead
 * of staying a bright card on a dark surface.
 */
const lightStates = {
  UNVERIFIED: { bg: '#EEF0F4', fg: '#3C4451', icon: 'clock-outline' },
  REVIEW_REQUIRED: { bg: '#FFF1D6', fg: '#7A4D00', icon: 'alert-circle-outline' },
  MATCHED_AUTO: { bg: '#DDF5EE', fg: '#00513F', icon: 'bell-check-outline' },
  MATCHED_BY_USER: { bg: '#DDF5EE', fg: '#00513F', icon: 'account-check-outline' },
  CONFIRMED_MANUALLY: { bg: '#E3EEFF', fg: '#0B3D91', icon: 'check-decagram-outline' },
  VOIDED: { bg: '#F3E5E5', fg: '#7A1F1F', icon: 'cancel' },
} as const;

const darkStates = {
  UNVERIFIED: { bg: '#333840', fg: '#CBD2DD', icon: 'clock-outline' },
  REVIEW_REQUIRED: { bg: '#4A3200', fg: '#FFDDB3', icon: 'alert-circle-outline' },
  MATCHED_AUTO: { bg: '#0B4438', fg: '#8FE3CE', icon: 'bell-check-outline' },
  MATCHED_BY_USER: { bg: '#0B4438', fg: '#8FE3CE', icon: 'account-check-outline' },
  CONFIRMED_MANUALLY: { bg: '#123566', fg: '#C6DBFF', icon: 'check-decagram-outline' },
  VOIDED: { bg: '#5A2222', fg: '#FFCFCB', icon: 'cancel' },
} as const;

export type StateColor = { bg: string; fg: string; icon: string };

export const stateColorsFor = (dark: boolean): Record<keyof typeof lightStates, StateColor> =>
  dark ? darkStates : lightStates;
