import React from 'react';
import { Platform, Switch } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = () => {
    const { theme, setTheme, colors } = useTheme();

    const isDark = theme === 'dark';

    const toggleSwitch = (value: boolean) => {
        setTheme(value ? 'dark' : 'light');
    };

    return (
        <Switch
            value={isDark}
            onValueChange={toggleSwitch}
            trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
            thumbColor={Platform.OS === 'ios' ? undefined : (isDark ? colors.accentSecondary : '#f4f3f4')}
            ios_backgroundColor={colors.borderSubtle}
        />
    );
};
