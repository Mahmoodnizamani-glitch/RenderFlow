/**
 * Auth group layout.
 *
 * Headerless Stack for login and register screens.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        />
    );
}
