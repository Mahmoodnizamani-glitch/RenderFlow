import { useContext } from 'react';
import { useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { ThemeContext } from './ThemeContext';
import type { ThemeContextValue } from './ThemeContext';

/**
 * Typed hook for accessing the Paper MD3 theme.
 * Prefer this over `useTheme()` directly to get proper typing.
 */
export function useAppTheme(): MD3Theme {
    return useTheme<MD3Theme>();
}

/**
 * Hook for accessing theme context (isDark, toggleTheme, etc.).
 */
export function useThemeContext(): ThemeContextValue {
    return useContext(ThemeContext);
}
