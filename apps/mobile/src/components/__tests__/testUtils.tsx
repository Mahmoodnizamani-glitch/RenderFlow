import React from 'react';
import type { PropsWithChildren } from 'react';
import { PaperProvider } from 'react-native-paper';
import { lightTheme, ThemeProvider } from '../../theme';

/**
 * Wraps components with PaperProvider + ThemeProvider for testing.
 */
export function TestWrapper({ children }: PropsWithChildren) {
    return (
        <ThemeProvider>
            <PaperProvider theme={lightTheme}>{children}</PaperProvider>
        </ThemeProvider>
    );
}
