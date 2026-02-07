import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = () => {
    const { theme, toggleTheme, colors } = useTheme();

    return (
        <TouchableOpacity onPress={toggleTheme} style={styles.container}>
            <Ionicons
                name={theme === 'light' ? 'moon' : 'sunny'}
                size={24}
                color={colors.text}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
    },
});
