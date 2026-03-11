import React from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Platform, Switch, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = () => {
    const { theme, setTheme, colors } = useTheme();
    const { i18n } = useTranslation();

    const isDark = theme === 'dark';

    // On web, I18nManager.isRTL is always false and unreliable.
    // Instead, derive RTL status from the actual i18n language.
    const isRTL = Platform.OS === 'web'
        ? (i18n.language === 'he' || i18n.language === 'ar')
        : I18nManager.isRTL;

    const toggleSwitch = (value: boolean) => {
        // In native RTL the Switch's visual ON/OFF is mirrored by the OS, so we invert the value
        // On Web, do not invert to prevent the ball from being outside the switch area
        const newValue = (isRTL && Platform.OS !== 'web') ? !value : value;
        setTheme(newValue ? 'dark' : 'light');
    };

    // In RTL, pass the inverted value so the thumb sits on the correct side visually
    const switchValue = (isRTL && Platform.OS !== 'web') ? !isDark : isDark;

    return (
        <View style={Platform.OS === 'web' && isRTL ? { direction: 'ltr' } as any : undefined}>
            <Switch
                value={switchValue}
                onValueChange={toggleSwitch}
                trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
                thumbColor={Platform.OS === 'ios' ? undefined : (isDark ? colors.accentSecondary : '#f4f3f4')}
                ios_backgroundColor={colors.borderSubtle}
            />
        </View>
    );
};
