/**
 * Design tokens for the RenderFlow design system.
 * All visual values flow through these tokens — never hard-code colors or spacing.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const palette = {
    // Brand
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    primaryDark: '#4A3DB8',

    accent: '#00D2D3',
    accentLight: '#55EFC4',
    accentDark: '#00A3A3',

    // Neutrals
    white: '#FFFFFF',
    black: '#000000',
    gray50: '#FAFAFA',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray300: '#E0E0E0',
    gray400: '#BDBDBD',
    gray500: '#9E9E9E',
    gray600: '#757575',
    gray700: '#616161',
    gray800: '#424242',
    gray900: '#212121',

    // Semantic
    success: '#00B894',
    warning: '#FDCB6E',
    error: '#E17055',
    info: '#74B9FF',

    // Surfaces (dark mode)
    surfaceDark: '#121212',
    surfaceDarkElevated: '#1E1E1E',
    surfaceDarkHighest: '#2C2C2C',
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px grid)
// ---------------------------------------------------------------------------

export const spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const radii = {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Typography scale
// ---------------------------------------------------------------------------

export const fontSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
} as const;

export const fontWeights = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
};

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const shadows = {
    sm: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const layout = {
    minTouchTarget: 48,
    screenPaddingHorizontal: spacing.lg,
    maxContentWidth: 600,
} as const;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const animation = {
    fast: 150,
    normal: 250,
    slow: 400,
} as const;
