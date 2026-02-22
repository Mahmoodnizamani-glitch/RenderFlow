import React from 'react';
import type { ErrorInfo, PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { AppButton } from './AppButton';
import { spacing, palette } from '../theme/tokens';

export interface ErrorBoundaryProps extends PropsWithChildren {
    fallback?: ReactNode;
    testID?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, info.componentStack);
    }

    private handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View
                    style={styles.container}
                    testID={this.props.testID ?? 'error-boundary'}
                    accessibilityRole="alert"
                >
                    <Icon source="alert-circle-outline" size={64} color={palette.error} />
                    <Text variant="titleLarge" style={styles.title}>
                        Something went wrong
                    </Text>
                    <Text variant="bodyMedium" style={styles.message}>
                        {this.state.error?.message ?? 'An unexpected error occurred'}
                    </Text>
                    <AppButton
                        label="Try Again"
                        onPress={this.handleReset}
                        variant="primary"
                        style={styles.button}
                        testID="error-boundary-retry"
                    />
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['3xl'],
        paddingVertical: spacing['5xl'],
    },
    title: {
        marginTop: spacing.lg,
        fontWeight: '600',
        textAlign: 'center',
    },
    message: {
        marginTop: spacing.sm,
        textAlign: 'center',
        color: palette.gray600,
        lineHeight: 22,
    },
    button: {
        marginTop: spacing['2xl'],
    },
});
