import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { interaction, radius, spacing, ThemeColors, themes, ThemeType } from '../theme';

interface ThemeContextType {
    theme: ThemeType;
    toggleTheme: () => void;
    setTheme: (theme: ThemeType) => void;
    // Core color tokens for quick access (compat + semantic)
    colors: ThemeColors & {
        // Compatibility aliases
        background: string;
        card: string;
        text: string;
        secondaryText: string;
        primary: string;
        border: string;
        error: string;
    };
    // Shared constants
    tokens: {
        spacing: typeof spacing;
        radius: typeof radius;
        interaction: typeof interaction;
    };
    fonts: {
        regular: string;
        medium: string;
        bold: string;
    };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>(systemScheme === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app_theme');
            // Validate that the saved theme is one of our supported themes
            if (savedTheme === 'light' || savedTheme === 'dark') {
                setThemeState(savedTheme as ThemeType);
            } else if (savedTheme) {
                // If it's a legacy value like 'system', default to light and clear it
                setThemeState('light');
                await AsyncStorage.setItem('app_theme', 'light');
            }
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    const currentColors = themes[theme];

    // Create the extended colors object with aliases
    const colors: any = {
        ...currentColors,
        background: currentColors.backgroundPrimary,
        card: currentColors.surface,
        text: currentColors.textPrimary,
        secondaryText: currentColors.textSecondary,
        primary: currentColors.accentPrimary,
        border: currentColors.borderSubtle,
        error: currentColors.danger,
    };

    const { i18n } = useTranslation();

    const fonts = {
        regular: i18n.language === 'ar' ? 'NotoSansArabic_400Regular' :
            i18n.language === 'he' ? 'NotoSansHebrew_400Regular' :
                'NotoSans_400Regular',
        medium: i18n.language === 'ar' ? 'NotoSansArabic_500Medium' :
            i18n.language === 'he' ? 'NotoSansHebrew_500Medium' :
                'NotoSans_500Medium',
        bold: i18n.language === 'ar' ? 'NotoSansArabic_700Bold' :
            i18n.language === 'he' ? 'NotoSansHebrew_700Bold' :
                'NotoSans_700Bold',
    };

    const tokens = {
        spacing,
        radius,
        interaction,
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            setTheme,
            colors: colors as ThemeContextType['colors'],
            fonts,
            tokens
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
