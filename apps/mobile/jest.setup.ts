/* eslint-disable no-console */

/**
 * Jest setup file for @renderflow/mobile.
 * Runs before the test framework is installed — NO jest.mock() here.
 */

// Silence noisy RN logs during tests
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (
        message.includes('act(...)') ||
        message.includes('Warning:') ||
        message.includes('NativeAnimatedHelper') ||
        message.includes('loadedNativeFonts')
    ) {
        return;
    }
    originalError.call(console, ...args);
};

console.warn = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (message.includes('Animated:') || message.includes('deprecated')) {
        return;
    }
    originalWarn.call(console, ...args);
};
