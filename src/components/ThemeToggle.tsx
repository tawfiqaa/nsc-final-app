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
        // In RTL the Switch's visual ON/OFF is mirrored by the OS, so we invert the value
        const newValue = isRTL ? !value : value;
        setTheme(newValue ? 'dark' : 'light');
    };

    // In RTL, pass the inverted value so the thumb sits on the correct side visually
    const switchValue = isRTL ? !isDark : isDark;

    return (
        <View>
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
