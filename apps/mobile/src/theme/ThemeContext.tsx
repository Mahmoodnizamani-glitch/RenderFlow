import React, { createContext, useCallback, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { MD3Theme } from 'react-native-paper';
import { lightTheme } from './lightTheme';
import { darkTheme } from './darkTheme';

export interface ThemeContextValue {
    isDark: boolean;
    toggleTheme: () => void;
    setDark: (dark: boolean) => void;
    theme: MD3Theme;
}

export const ThemeContext = createContext<ThemeContextValue>({
    isDark: false,
    toggleTheme: () => { },
    setDark: () => { },
    theme: lightTheme,
});

export function ThemeProvider({ children }: PropsWithChildren) {
    const [isDark, setIsDark] = useState(false);

    const toggleTheme = useCallback(() => {
        setIsDark((prev) => !prev);
    }, []);

    const setDark = useCallback((dark: boolean) => {
        setIsDark(dark);
    }, []);

    const theme = isDark ? darkTheme : lightTheme;

    const value = useMemo<ThemeContextValue>(
        () => ({ isDark, toggleTheme, setDark, theme }),
        [isDark, toggleTheme, setDark, theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
