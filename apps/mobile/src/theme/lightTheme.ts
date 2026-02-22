import {
    MD3LightTheme,
    configureFonts,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { palette } from './tokens';

const fontConfig = configureFonts({ config: {} });

export const lightTheme: MD3Theme = {
    ...MD3LightTheme,
    fonts: fontConfig,
    roundness: 12,
    colors: {
        ...MD3LightTheme.colors,
        primary: palette.primary,
        primaryContainer: palette.primaryLight,
        onPrimary: palette.white,
        onPrimaryContainer: palette.primaryDark,

        secondary: palette.accent,
        secondaryContainer: palette.accentLight,
        onSecondary: palette.white,
        onSecondaryContainer: palette.accentDark,

        tertiary: palette.info,
        tertiaryContainer: '#D6EEFF',
        onTertiary: palette.white,
        onTertiaryContainer: '#004A77',

        background: palette.gray50,
        onBackground: palette.gray900,

        surface: palette.white,
        onSurface: palette.gray900,
        surfaceVariant: palette.gray100,
        onSurfaceVariant: palette.gray700,
        surfaceDisabled: palette.gray200,
        onSurfaceDisabled: palette.gray400,

        outline: palette.gray300,
        outlineVariant: palette.gray200,

        error: palette.error,
        errorContainer: '#FFEAE4',
        onError: palette.white,
        onErrorContainer: '#93000A',

        inverseSurface: palette.gray900,
        inverseOnSurface: palette.gray100,
        inversePrimary: palette.primaryLight,

        shadow: palette.black,
        scrim: palette.black,

        backdrop: 'rgba(0, 0, 0, 0.5)',
        elevation: {
            level0: 'transparent',
            level1: palette.gray50,
            level2: palette.gray100,
            level3: palette.gray200,
            level4: palette.gray200,
            level5: palette.gray300,
        },
    },
};
