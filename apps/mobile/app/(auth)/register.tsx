/**
 * Register screen.
 *
 * Display name, email, password, confirm password, and terms checkbox.
 * Zod validation with password match refinement. Loading states prevent
 * double-tap. Terms must be accepted before submission.
 */
import { useState, useCallback, useContext } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Pressable,
} from 'react-native';
import { Text, TextInput, Button, HelperText, Checkbox, Snackbar, Surface, Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { ThemeContext } from '../../src/theme';
import { useAuthStore } from '../../src/stores';
import { spacing, radii } from '../../src/theme/tokens';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const RegisterSchema = z
    .object({
        displayName: z
            .string()
            .min(1, 'Display name is required')
            .max(255, 'Display name is too long')
            .transform((v) => v.trim()),
        email: z
            .string()
            .min(1, 'Email is required')
            .email('Please enter a valid email address')
            .transform((v) => v.toLowerCase().trim()),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters'),
        confirmPassword: z
            .string()
            .min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

type RegisterForm = z.infer<typeof RegisterSchema>;
type RegisterFieldKeys = 'displayName' | 'email' | 'password' | 'confirmPassword';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterScreen() {
    const { theme } = useContext(ThemeContext);
    const router = useRouter();
    const { register, continueAsGuest, isLoading, error, clearError } = useAuthStore();

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [termsError, setTermsError] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterFieldKeys, string>>>({});

    const clearFieldError = useCallback((field: RegisterFieldKeys) => {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }, []);

    const validate = useCallback((): RegisterForm | null => {
        const result = RegisterSchema.safeParse({
            displayName,
            email,
            password,
            confirmPassword,
        });

        if (!result.success) {
            const errors: Partial<Record<RegisterFieldKeys, string>> = {};
            for (const issue of result.error.issues) {
                const field = issue.path[0] as RegisterFieldKeys;
                if (!errors[field]) {
                    errors[field] = issue.message;
                }
            }
            setFieldErrors(errors);
            return null;
        }

        setFieldErrors({});
        return result.data;
    }, [displayName, email, password, confirmPassword]);

    const handleRegister = useCallback(async () => {
        if (!acceptedTerms) {
            setTermsError(true);
            return;
        }
        setTermsError(false);

        const data = validate();
        if (!data) return;

        const success = await register(data.email, data.password, data.displayName);
        if (success) {
            router.replace('/(tabs)' as never);
        }
    }, [acceptedTerms, validate, register, router]);

    const navigateToLogin = useCallback(() => {
        router.back();
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
                        Create Account
                    </Text>
                    <Text
                        variant="bodyLarge"
                        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                        Start creating stunning renders
                    </Text>
                </View>

                <Surface style={styles.surfaceCard} elevation={2}>
                    <View style={styles.form}>
                        {/* Display Name */}
                        <TextInput
                            testID="register-name-input"
                            label="Display Name"
                            value={displayName}
                            onChangeText={(text) => {
                                setDisplayName(text);
                                clearFieldError('displayName');
                            }}
                            autoCapitalize="words"
                            autoComplete="name"
                            importantForAutofill="no"
                            mode="outlined"
                            error={!!fieldErrors.displayName}
                            disabled={isLoading}
                            left={<TextInput.Icon icon="account-outline" />}
                        />
                        {fieldErrors.displayName && (
                            <HelperText type="error" visible testID="register-name-error">
                                {fieldErrors.displayName}
                            </HelperText>
                        )}

                        {/* Email */}
                        <TextInput
                            testID="register-email-input"
                            label="Email"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                clearFieldError('email');
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
                            style={styles.inputSpacing}
                        />
                        {fieldErrors.email && (
                            <HelperText type="error" visible testID="register-email-error">
                                {fieldErrors.email}
                            </HelperText>
                        )}

                        {/* Password */}
                        <TextInput
                            testID="register-password-input"
                            label="Password"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                clearFieldError('password');
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
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
                            style={styles.inputSpacing}
                        />
                        {fieldErrors.password && (
                            <HelperText type="error" visible testID="register-password-error">
                                {fieldErrors.password}
                            </HelperText>
                        )}

                        {/* Confirm Password */}
                        <TextInput
                            testID="register-confirm-password-input"
                            label="Confirm Password"
                            value={confirmPassword}
                            onChangeText={(text) => {
                                setConfirmPassword(text);
                                clearFieldError('confirmPassword');
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            importantForAutofill="no"
                            mode="outlined"
                            error={!!fieldErrors.confirmPassword}
                            disabled={isLoading}
                            left={<TextInput.Icon icon="lock-check-outline" />}
                            style={styles.inputSpacing}
                        />
                        {fieldErrors.confirmPassword && (
                            <HelperText type="error" visible testID="register-confirm-error">
                                {fieldErrors.confirmPassword}
                            </HelperText>
                        )}

                        {/* Terms of Service */}
                        <Pressable
                            testID="register-terms-checkbox"
                            onPress={() => {
                                setAcceptedTerms(!acceptedTerms);
                                setTermsError(false);
                            }}
                            style={styles.termsRow}
                        >
                            <View style={[
                                styles.checkboxContainer,
                                {
                                    borderColor: acceptedTerms ? theme.colors.primary : theme.colors.outline,
                                    backgroundColor: acceptedTerms ? theme.colors.primary : 'transparent'
                                }
                            ]}>
                                {acceptedTerms && (
                                    <Icon source="check" size={16} color={theme.colors.onPrimary} />
                                )}
                            </View>
                            <Text
                                variant="bodyMedium"
                                style={[
                                    styles.termsText,
                                    { color: termsError ? theme.colors.error : theme.colors.onSurface },
                                ]}
                            >
                                I agree to the Terms of Service and Privacy Policy
                            </Text>
                        </Pressable>
                        {termsError && (
                            <HelperText type="error" visible testID="register-terms-error">
                                You must accept the terms to continue
                            </HelperText>
                        )}

                        {/* Submit */}
                        <Button
                            testID="register-submit-button"
                            mode="contained"
                            onPress={handleRegister}
                            loading={isLoading}
                            disabled={isLoading}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            {isLoading ? 'Creating account…' : 'Create Account'}
                        </Button>

                        <View style={styles.footer}>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Already have an account?{' '}
                            </Text>
                            <Pressable onPress={navigateToLogin}>
                                <Text
                                    variant="bodyMedium"
                                    style={{ color: theme.colors.primary, fontWeight: '600' }}
                                >
                                    Sign In
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
                            testID="register-guest-mode"
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
        paddingVertical: spacing['3xl'],
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['3xl'],
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
    inputSpacing: {
        marginTop: spacing.md,
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.md,
        paddingVertical: spacing.xs,
    },
    checkboxContainer: {
        width: 24,
        height: 24,
        borderRadius: radii.sm,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    termsText: {
        flex: 1,
    },
    button: {
        marginTop: spacing.lg,
        borderRadius: radii.md,
    },
    buttonContent: {
        height: 52,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing['3xl'],
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
        padding: spacing.sm,
    },
});
