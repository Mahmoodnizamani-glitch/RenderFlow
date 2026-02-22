/**
 * CaptionWizard — Main 4-step wizard for creating caption projects from SRT.
 *
 * Step 1: Import SRT (upload or paste)
 * Step 2: Choose caption style
 * Step 3: Customize appearance
 * Step 4: Preview & create project
 *
 * State is managed locally with a step counter and lifted data.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, ProgressBar } from 'react-native-paper';
import type { SrtFile, CaptionStyleId, CaptionStyleConfig } from '@renderflow/shared';
import { useAppTheme } from '../../theme';
import { DEFAULT_STYLE_CONFIG } from '../../templates/captions';
import { SrtUploadStep } from './SrtUploadStep';
import { StylePickerStep } from './StylePickerStep';
import { AppearanceStep } from './AppearanceStep';
import { PreviewStep } from './PreviewStep';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaptionWizardProps {
    /** Called when the wizard is dismissed */
    onDismiss: () => void;
    /** Called after a project is successfully created */
    onProjectCreated?: (projectId: string) => void;
    testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 4;

const STEP_TITLES: Record<number, string> = {
    0: 'Import Subtitles',
    1: 'Choose Style',
    2: 'Appearance',
    3: 'Preview & Export',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaptionWizard({
    onDismiss,
    onProjectCreated,
    testID = 'caption-wizard',
}: CaptionWizardProps) {
    const theme = useAppTheme();

    // Step tracking
    const [step, setStep] = useState(0);

    // Lifted state across steps
    const [srtFile, setSrtFile] = useState<SrtFile | null>(null);
    const [rawText, setRawText] = useState('');
    const [styleId, setStyleId] = useState<CaptionStyleId>('hormozi');
    const [config, setConfig] = useState<CaptionStyleConfig>(DEFAULT_STYLE_CONFIG);

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------

    const canGoNext = step < TOTAL_STEPS - 1;
    const canGoBack = step > 0;

    const goNext = useCallback(() => {
        if (canGoNext) setStep((s) => s + 1);
    }, [canGoNext]);

    const goBack = useCallback(() => {
        if (canGoBack) {
            setStep((s) => s - 1);
        } else {
            onDismiss();
        }
    }, [canGoBack, onDismiss]);

    // -----------------------------------------------------------------------
    // Step 1 handler
    // -----------------------------------------------------------------------

    const handleSrtParsed = useCallback(
        (parsed: SrtFile, text: string) => {
            setSrtFile(parsed);
            setRawText(text);
            goNext();
        },
        [goNext],
    );

    // -----------------------------------------------------------------------
    // Step 2 handler
    // -----------------------------------------------------------------------

    const handleStyleChange = useCallback((id: CaptionStyleId) => {
        setStyleId(id);
    }, []);

    // -----------------------------------------------------------------------
    // Render current step
    // -----------------------------------------------------------------------

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <SrtUploadStep
                        onParsed={handleSrtParsed}
                        initialSrtFile={srtFile}
                        initialRawText={rawText}
                        testID={`${testID}-step-upload`}
                    />
                );
            case 1:
                return (
                    <StylePickerStep
                        selectedStyle={styleId}
                        onStyleChange={handleStyleChange}
                        testID={`${testID}-step-style`}
                    />
                );
            case 2:
                return (
                    <AppearanceStep
                        config={config}
                        onConfigChange={setConfig}
                        testID={`${testID}-step-appearance`}
                    />
                );
            case 3:
                return srtFile ? (
                    <PreviewStep
                        srtFile={srtFile}
                        styleId={styleId}
                        config={config}
                        onProjectCreated={onProjectCreated}
                        testID={`${testID}-step-preview`}
                    />
                ) : null;
            default:
                return null;
        }
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    const progress = (step + 1) / TOTAL_STEPS;

    return (
        <View style={styles.container} testID={testID}>
            {/* Header */}
            <Appbar.Header
                style={{ backgroundColor: theme.colors.surface }}
                testID={`${testID}-header`}
            >
                <Appbar.BackAction onPress={goBack} testID={`${testID}-back`} />
                <Appbar.Content
                    title={STEP_TITLES[step] ?? ''}
                    titleStyle={styles.headerTitle}
                />
                {step > 0 && step < TOTAL_STEPS - 1 && (
                    <Appbar.Action
                        icon="arrow-right"
                        onPress={goNext}
                        disabled={step === 0 && !srtFile}
                        testID={`${testID}-next`}
                    />
                )}
            </Appbar.Header>

            {/* Progress */}
            <ProgressBar
                progress={progress}
                color={theme.colors.primary}
                style={styles.progressBar}
                testID={`${testID}-progress`}
            />

            {/* Step Content */}
            <View style={styles.stepContent}>
                {renderStep()}
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
    },
    progressBar: {
        height: 3,
    },
    stepContent: {
        flex: 1,
    },
});
