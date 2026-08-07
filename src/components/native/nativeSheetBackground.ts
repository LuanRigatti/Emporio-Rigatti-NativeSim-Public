import { DynamicColorIOS, PlatformColor } from 'react-native';

/** Shared opaque, dynamic iOS surface for native Bottom Sheets. */
export const NATIVE_SHEET_PRESENTATION_BACKGROUND = PlatformColor(
  'systemBackground',
) as unknown as string;

/** Shared subtle grouped surface used inside native Bottom Sheets. */
export const NATIVE_SHEET_CARD_BACKGROUND = DynamicColorIOS({
  dark: '#181818',
  light: '#EFEFED',
}) as unknown as string;
