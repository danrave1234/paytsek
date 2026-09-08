import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

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
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 28 } as const;

/** Vertical/horizontal rhythm used across screens. */
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target per accessibility guidance. */
export const TOUCH_TARGET = 48;

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: RADIUS.md / 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0B5FFF',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DCE6FF',
    onPrimaryContainer: '#001A4D',
    secondary: '#006B5F',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#B8F2E6',
    onSecondaryContainer: '#00201B',
    tertiary: '#7A4D00',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFDDB3',
    onTertiaryContainer: '#281900',
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    background: '#FBFAFD',
    onBackground: '#1A1C1E',
    surface: '#FBFAFD',
    onSurface: '#1A1C1E',
    surfaceVariant: '#E1E2EC',
    onSurfaceVariant: '#44474F',
    outline: '#74777F',
    outlineVariant: '#C4C6D0',

    elevation: {
      level0: 'transparent',
      level1: '#F2F3FA',
      level2: '#EDEFF8',
      level3: '#E7EAF5',
      level4: '#E5E8F4',
      level5: '#E1E5F2',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: RADIUS.md / 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#ADC6FF',
    onPrimary: '#002E6B',
    primaryContainer: '#004494',
    onPrimaryContainer: '#D8E2FF',
    secondary: '#7ED6C6',
    onSecondary: '#003731',
    secondaryContainer: '#005047',
    onSecondaryContainer: '#B8F2E6',
    tertiary: '#F2BB6E',
    onTertiary: '#442B00',
    tertiaryContainer: '#5C3900',
    onTertiaryContainer: '#FFDDB3',
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',

    background: '#111318',
    onBackground: '#E3E2E6',
    surface: '#111318',
    onSurface: '#E3E2E6',
    surfaceVariant: '#44474F',
    onSurfaceVariant: '#C4C6D0',
    outline: '#8E9099',
    outlineVariant: '#44474F',

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
