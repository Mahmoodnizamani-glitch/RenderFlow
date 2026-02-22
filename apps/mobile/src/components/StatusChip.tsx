import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

export type RenderStatus = 'queued' | 'rendering' | 'done' | 'failed';

export interface StatusChipProps {
    status: RenderStatus;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

interface StatusConfig {
    label: string;
    icon: string;
    backgroundColor: string;
    textColor: string;
}

function useStatusConfig(status: RenderStatus): StatusConfig {
    const theme = useAppTheme();

    return useMemo(() => {
        const configs: Record<RenderStatus, StatusConfig> = {
            queued: {
                label: 'Queued',
                icon: 'clock-outline',
                backgroundColor: theme.dark ? '#3D3500' : '#FFF8E1',
                textColor: theme.dark ? '#FDCB6E' : '#866A00',
            },
            rendering: {
                label: 'Rendering',
                icon: 'cog-outline',
                backgroundColor: theme.dark ? '#002D4A' : '#E3F2FD',
                textColor: theme.dark ? '#74B9FF' : '#0D47A1',
            },
            done: {
                label: 'Done',
                icon: 'check-circle-outline',
                backgroundColor: theme.dark ? '#003D2E' : '#E8F5E9',
                textColor: theme.dark ? '#00B894' : '#1B5E20',
            },
            failed: {
                label: 'Failed',
                icon: 'alert-circle-outline',
                backgroundColor: theme.dark ? '#4A1C0A' : '#FFEAE4',
                textColor: theme.dark ? '#FF8A75' : '#93000A',
            },
        };

        return configs[status];
    }, [status, theme.dark]);
}

export function StatusChip({ status, style, testID }: StatusChipProps) {
    const config = useStatusConfig(status);

    return (
        <Chip
            icon={config.icon}
            style={[
                styles.chip,
                { backgroundColor: config.backgroundColor },
                style,
            ]}
            textStyle={[styles.text, { color: config.textColor }]}
            testID={testID}
            accessibilityLabel={`Status: ${config.label}`}
            accessibilityRole="text"
        >
            {config.label}
        </Chip>
    );
}

const styles = StyleSheet.create({
    chip: {
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
});
