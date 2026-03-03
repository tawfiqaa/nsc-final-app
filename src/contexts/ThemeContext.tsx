import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    colors: {
        background: string;
        card: string;
        text: string;
        secondaryText: string;
        primary: string;
        border: string;
        error: string;
        success: string;
    };
    fonts: {
        regular: string;
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
    const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app_theme');
            if (savedTheme) {
                setTheme(savedTheme as Theme);
            }
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const colors = {
        light: {
            background: '#FFFFFF',
            card: '#FFFFFF',
            text: '#1F2937',
            secondaryText: '#6B7280',
            primary: '#4F46E5',
            border: '#E5E7EB',
            error: '#EF4444',
            success: '#10B981',
        },
        dark: {
            background: '#111827',
            card: '#1F2937',
            text: '#F9FAFB',
            secondaryText: '#9CA3AF',
            primary: '#6366F1',
            border: '#374151',
            error: '#F87171',
            success: '#34D399',
        },
    };

    const { i18n } = useTranslation();

    const fonts = {
        regular: i18n.language === 'ar' ? 'NotoSansArabic_400Regular' :
            i18n.language === 'he' ? 'NotoSansHebrew_400Regular' :
                'NotoSans_400Regular',
        bold: i18n.language === 'ar' ? 'NotoSansArabic_700Bold' :
            i18n.language === 'he' ? 'NotoSansHebrew_700Bold' :
                'NotoSans_700Bold',
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, colors: colors[theme], fonts }}>
            {children}
        </ThemeContext.Provider>
    );
};
