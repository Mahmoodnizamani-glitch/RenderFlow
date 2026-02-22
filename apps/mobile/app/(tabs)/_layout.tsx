/**
 * Tab layout for the main app navigation.
 *
 * Three tabs: Home, Projects, Settings.
 * Uses Material Community Icons and Paper theme colors.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { House, Folder, Film, Settings } from 'lucide-react-native';
import { useAppTheme } from '../../src/theme';

export default function TabLayout() {
    const theme = useAppTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.outlineVariant,
                    borderTopWidth: 0.5,
                    elevation: 0,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
                    tabBarAccessibilityLabel: 'Home tab',
                }}
            />
            <Tabs.Screen
                name="projects"
                options={{
                    title: 'Projects',
                    tabBarIcon: ({ color, size }) => <Folder size={size} color={color} />,
                    tabBarAccessibilityLabel: 'Projects tab',
                }}
            />
            <Tabs.Screen
                name="renders"
                options={{
                    title: 'Renders',
                    tabBarIcon: ({ color, size }) => <Film size={size} color={color} />,
                    tabBarAccessibilityLabel: 'Renders tab',
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
                    tabBarAccessibilityLabel: 'Settings tab',
                }}
            />
        </Tabs>
    );
}
