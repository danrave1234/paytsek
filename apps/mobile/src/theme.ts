import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Material Design 3 theme (React Native Paper) for consistent look on Android
 * and iOS, light and dark. Status colors are ALWAYS paired with text/icons —
 * never color alone.
 */
const brand = {
  primary: '#0B5FFF',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DCE6FF',
  onPrimaryContainer: '#001A4D',
  secondary: '#006B5F',
  secondaryContainer: '#B8F2E6',
  tertiary: '#7A4D00',
  tertiaryContainer: '#FFDDB3',
  error: '#B3261E',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: { ...MD3LightTheme.colors, ...brand },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#ADC6FF',
    onPrimary: '#002E6B',
    primaryContainer: '#004494',
    onPrimaryContainer: '#D8E2FF',
    secondary: '#7ED6C6',
    secondaryContainer: '#005047',
    tertiary: '#F2BB6E',
    tertiaryContainer: '#5C3900',
  },
};

/** Semantic colors for evidence states; used together with labels/icons. */
export const stateColors = {
  UNVERIFIED: { bg: '#EEF0F4', fg: '#3C4451', icon: 'clock-outline' },
  REVIEW_REQUIRED: { bg: '#FFF1D6', fg: '#7A4D00', icon: 'alert-circle-outline' },
  MATCHED_AUTO: { bg: '#DDF5EE', fg: '#00513F', icon: 'bell-check-outline' },
  MATCHED_BY_USER: { bg: '#DDF5EE', fg: '#00513F', icon: 'account-check-outline' },
  CONFIRMED_MANUALLY: { bg: '#E3EEFF', fg: '#0B3D91', icon: 'check-decagram-outline' },
  VOIDED: { bg: '#F3E5E5', fg: '#7A1F1F', icon: 'cancel' },
} as const;

/** Minimum touch target per accessibility guidance. */
export const TOUCH_TARGET = 48;
