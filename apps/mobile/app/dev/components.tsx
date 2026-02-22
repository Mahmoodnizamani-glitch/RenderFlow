import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Switch, Text } from 'react-native-paper';
import {
    AppButton,
    AppCard,
    AppInput,
    AppHeader,
    AppBottomSheet,
    EmptyState,
    LoadingOverlay,
    StatusChip,
    CodeBlock,
} from '../../src/components';
import { useAppTheme, useThemeContext } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';

const SAMPLE_CODE = `import { Composition } from 'remotion';
import { MyVideo } from './MyVideo';

export const Root: React.FC = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};`;

function SectionTitle({ children }: { children: string }) {
    const theme = useAppTheme();
    return (
        <Text
            variant="titleMedium"
            style={[styles.sectionTitle, { color: theme.colors.primary }]}
        >
            {children}
        </Text>
    );
}

export default function ComponentsDemo() {
    const theme = useAppTheme();
    const { isDark, toggleTheme } = useThemeContext();
    const [inputValue, setInputValue] = useState('');
    const [errorInputValue, setErrorInputValue] = useState('');
    const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
    const [loadingVisible, setLoadingVisible] = useState(false);

    return (
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            <AppHeader
                title="Component Library"
                subtitle="RenderFlow Design System"
                testID="demo-header"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Theme Toggle */}
                <View style={styles.themeToggle}>
                    <Text variant="bodyLarge">Dark Mode</Text>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        testID="theme-toggle"
                    />
                </View>

                <Divider style={styles.divider} />

                {/* Buttons */}
                <SectionTitle>Buttons</SectionTitle>
                <View style={styles.row}>
                    <AppButton label="Primary" onPress={() => { }} testID="btn-primary" />
                    <AppButton label="Secondary" variant="secondary" onPress={() => { }} testID="btn-secondary" />
                </View>
                <View style={styles.row}>
                    <AppButton label="Outline" variant="outline" onPress={() => { }} testID="btn-outline" />
                    <AppButton label="Text" variant="text" onPress={() => { }} testID="btn-text" />
                </View>
                <View style={styles.row}>
                    <AppButton label="Loading" loading onPress={() => { }} testID="btn-loading" />
                    <AppButton label="Disabled" disabled onPress={() => { }} testID="btn-disabled" />
                </View>
                <AppButton label="With Icon" icon="play-circle" onPress={() => { }} testID="btn-icon" />

                <Divider style={styles.divider} />

                {/* Cards */}
                <SectionTitle>Cards</SectionTitle>
                <AppCard variant="elevated" testID="card-elevated">
                    <Text variant="titleSmall">Elevated Card</Text>
                    <Text variant="bodyMedium">This card has a shadow elevation.</Text>
                </AppCard>
                <View style={styles.spacer} />
                <AppCard variant="outlined" testID="card-outlined">
                    <Text variant="titleSmall">Outlined Card</Text>
                    <Text variant="bodyMedium">This card has a border outline.</Text>
                </AppCard>

                <Divider style={styles.divider} />

                {/* Inputs */}
                <SectionTitle>Inputs</SectionTitle>
                <AppInput
                    label="Email"
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    helperText="Enter your email address"
                    testID="input-email"
                />
                <View style={styles.spacer} />
                <AppInput
                    label="Password"
                    value={errorInputValue}
                    onChangeText={setErrorInputValue}
                    secureTextEntry
                    error={errorInputValue.length > 0 && errorInputValue.length < 8 ? 'Password must be at least 8 characters' : undefined}
                    testID="input-password"
                />

                <Divider style={styles.divider} />

                {/* Status Chips */}
                <SectionTitle>Status Chips</SectionTitle>
                <View style={styles.chipRow}>
                    <StatusChip status="queued" testID="chip-queued" />
                    <StatusChip status="rendering" testID="chip-rendering" />
                    <StatusChip status="done" testID="chip-done" />
                    <StatusChip status="failed" testID="chip-failed" />
                </View>

                <Divider style={styles.divider} />

                {/* Code Block */}
                <SectionTitle>Code Block</SectionTitle>
                <CodeBlock
                    code={SAMPLE_CODE}
                    language="tsx"
                    testID="code-block"
                />

                <Divider style={styles.divider} />

                {/* Empty State */}
                <SectionTitle>Empty State</SectionTitle>
                <EmptyState
                    icon="video-off-outline"
                    title="No Videos Yet"
                    subtitle="Create your first video by pasting Remotion code"
                    actionLabel="Create Video"
                    onAction={() => { }}
                    testID="empty-state"
                />

                <Divider style={styles.divider} />

                {/* Bottom Sheet */}
                <SectionTitle>Bottom Sheet</SectionTitle>
                <AppButton
                    label="Open Bottom Sheet"
                    onPress={() => setBottomSheetVisible(true)}
                    variant="outline"
                    testID="open-bottom-sheet"
                />
                <AppBottomSheet
                    visible={bottomSheetVisible}
                    onDismiss={() => setBottomSheetVisible(false)}
                    title="Render Options"
                    testID="bottom-sheet"
                >
                    <Text variant="bodyMedium">
                        Configure your render settings here. Choose resolution, frame rate,
                        and output format before starting the render.
                    </Text>
                    <View style={styles.spacer} />
                    <AppButton
                        label="Start Render"
                        onPress={() => setBottomSheetVisible(false)}
                        testID="bottom-sheet-action"
                    />
                </AppBottomSheet>

                <Divider style={styles.divider} />

                {/* Loading Overlay */}
                <SectionTitle>Loading Overlay</SectionTitle>
                <AppButton
                    label="Show Loading (2s)"
                    onPress={() => {
                        setLoadingVisible(true);
                        setTimeout(() => setLoadingVisible(false), 2000);
                    }}
                    variant="outline"
                    testID="show-loading"
                />
                <LoadingOverlay
                    visible={loadingVisible}
                    message="Rendering your video..."
                    testID="loading-overlay"
                />

                <View style={styles.bottomPadding} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    themeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    divider: {
        marginVertical: spacing['2xl'],
    },
    spacer: {
        height: spacing.md,
    },
    bottomPadding: {
        height: spacing['5xl'],
    },
});
