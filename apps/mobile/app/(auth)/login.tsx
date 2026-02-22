/**
 * Login screen.
 *
 * Email + password form with Zod validation, loading states,
 * inline error display, and navigation to register.
 */
import { useState, useCallback, useContext } from 'react';
import {
    Alert,
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Pressable,
} from 'react-native';
import { Text, TextInput, Button, HelperText, Snackbar, Icon, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { ThemeContext } from '../../src/theme';
import { useAuthStore } from '../../src/stores';
import { spacing, radii } from '../../src/theme/tokens';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const LoginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform((v) => v.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof LoginSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginScreen() {
    const { theme } = useContext(ThemeContext);
    const router = useRouter();
    const { login, continueAsGuest, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});

    const validate = useCallback((): LoginForm | null => {
        const result = LoginSchema.safeParse({ email, password });
        if (!result.success) {
            const errors: Partial<Record<keyof LoginForm, string>> = {};
            for (const issue of result.error.issues) {
                const field = issue.path[0] as keyof LoginForm;
                if (!errors[field]) {
                    errors[field] = issue.message;
                }
            }
            setFieldErrors(errors);
            return null;
        }
        setFieldErrors({});
        return result.data;
    }, [email, password]);

    const handleLogin = useCallback(async () => {
        const data = validate();
        if (!data) return;

        const success = await login(data.email, data.password);
        if (success) {
            router.replace('/(tabs)' as never);
        }
    }, [validate, login, router]);

    const navigateToRegister = useCallback(() => {
        router.push('/(auth)/register' as never);
    }, [router]);

    const handleGuestMode = useCallback(() => {
        continueAsGuest();
        router.replace('/(tabs)' as never);
    }, [continueAsGuest, router]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <Icon source="animation-play" size={64} color={theme.colors.primary} />
                    <Text
                        variant="headlineLarge"
                        style={[styles.title, { color: theme.colors.primary, marginTop: spacing.md }]}
                    >
                        RenderFlow
                    </Text>
                    <Text
                        variant="bodyLarge"
                        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                        Sign in to your account
                    </Text>
                </View>

                <Surface style={styles.surfaceCard} elevation={2}>
                    <View style={styles.form}>
                        <TextInput
                            testID="login-email-input"
                            label="Email"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                if (fieldErrors.email) {
                                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                                }
                            }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            importantForAutofill="no"
                            autoCorrect={false}
                            mode="outlined"
                            error={!!fieldErrors.email}
                            disabled={isLoading}
                            left={<TextInput.Icon icon="email-outline" />}
                        />
                        {fieldErrors.email && (
                            <HelperText type="error" visible testID="login-email-error">
                                {fieldErrors.email}
                            </HelperText>
                        )}

                        <TextInput
                            testID="login-password-input"
                            label="Password"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (fieldErrors.password) {
                                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                                }
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password"
                            importantForAutofill="no"
                            mode="outlined"
                            error={!!fieldErrors.password}
                            disabled={isLoading}
                            left={<TextInput.Icon icon="lock-outline" />}
                            right={
                                <TextInput.Icon
                                    icon={showPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowPassword(!showPassword)}
                                />
                            }
                            style={styles.passwordInput}
                        />
                        {fieldErrors.password && (
                            <HelperText type="error" visible testID="login-password-error">
                                {fieldErrors.password}
                            </HelperText>
                        )}

                        <Pressable
                            onPress={() => {
                                Alert.alert(
                                    'Password Reset',
                                    'Password reset is not yet available. Please contact support at support@renderflow.app.',
                                );
                            }}
                            testID="login-forgot-password"
                            style={styles.forgotPassword}
                        >
                            <Text
                                variant="bodySmall"
                                style={{ color: theme.colors.primary }}
                            >
                                Forgot password?
                            </Text>
                        </Pressable>

                        <Button
                            testID="login-submit-button"
                            mode="contained"
                            onPress={handleLogin}
                            loading={isLoading}
                            disabled={isLoading}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            {isLoading ? 'Signing in…' : 'Sign In'}
                        </Button>

                        <View style={styles.footer}>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Don't have an account?{' '}
                            </Text>
                            <Pressable onPress={navigateToRegister}>
                                <Text
                                    variant="bodyMedium"
                                    style={{ color: theme.colors.primary, fontWeight: '600' }}
                                >
                                    Register
                                </Text>
                            </Pressable>
                        </View>

                        <View style={styles.dividerRow}>
                            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginHorizontal: spacing.sm }}>
                                or
                            </Text>
                            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
                        </View>

                        <Pressable
                            onPress={handleGuestMode}
                            style={styles.guestLink}
                            testID="login-guest-mode"
                        >
                            <Text
                                variant="bodyMedium"
                                style={{ color: theme.colors.onSurfaceVariant }}
                            >
                                Continue without account
                            </Text>
                        </Pressable>
                    </View>
                </Surface>
            </ScrollView>

            <Snackbar
                visible={!!error}
                onDismiss={clearError}
                duration={4000}
                action={{ label: 'Dismiss', onPress: clearError }}
            >
                {error ?? ''}
            </Snackbar>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
        paddingVertical: spacing['4xl'],
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['4xl'],
    },
    title: {
        fontWeight: '700',
        marginBottom: spacing.sm,
    },
    subtitle: {
        textAlign: 'center',
    },
    surfaceCard: {
        padding: spacing['2xl'],
        borderRadius: radii.xl,
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    form: {
        width: '100%',
    },
    passwordInput: {
        marginTop: spacing.md,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        padding: spacing.xs,
    },
    button: {
        borderRadius: radii.md,
    },
    buttonContent: {
        height: 48,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing['2xl'],
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    guestLink: {
        alignSelf: 'center',
        marginTop: spacing.md,
        padding: spacing.xs,
    },
});
