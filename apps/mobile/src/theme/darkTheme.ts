import {
    MD3DarkTheme,
    configureFonts,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { palette } from './tokens';

const fontConfig = configureFonts({ config: {} });

export const darkTheme: MD3Theme = {
    ...MD3DarkTheme,
    fonts: fontConfig,
    roundness: 12,
    colors: {
        ...MD3DarkTheme.colors,
        primary: palette.primaryLight,
        primaryContainer: palette.primaryDark,
        onPrimary: palette.primaryDark,
        onPrimaryContainer: palette.primaryLight,

        secondary: palette.accentLight,
        secondaryContainer: palette.accentDark,
        onSecondary: palette.accentDark,
        onSecondaryContainer: palette.accentLight,

        tertiary: palette.info,
        tertiaryContainer: '#004A77',
        onTertiary: '#004A77',
        onTertiaryContainer: '#D6EEFF',

        background: palette.surfaceDark,
        onBackground: palette.gray100,

        surface: palette.surfaceDark,
        onSurface: palette.gray100,
        surfaceVariant: palette.surfaceDarkElevated,
        onSurfaceVariant: palette.gray400,
        surfaceDisabled: palette.surfaceDarkHighest,
        onSurfaceDisabled: palette.gray600,

        outline: palette.gray700,
        outlineVariant: palette.gray800,

        error: '#FF8A75',
        errorContainer: '#5C1A0A',
        onError: '#5C1A0A',
        onErrorContainer: '#FFEAE4',

        inverseSurface: palette.gray100,
        inverseOnSurface: palette.gray900,
        inversePrimary: palette.primary,

        shadow: palette.black,
        scrim: palette.black,

        backdrop: 'rgba(0, 0, 0, 0.7)',
        elevation: {
            level0: 'transparent',
            level1: palette.surfaceDarkElevated,
            level2: palette.surfaceDarkHighest,
            level3: '#333333',
            level4: '#383838',
            level5: '#3D3D3D',
        },
    },
};
