import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardEmptyStateProps {
    icon: keyof typeof Ionicons.glyphMap;
    message: string;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({ icon, message }) => {
    const { colors, fonts } = useTheme();

    return (
        <View style={styles.container}>
            <Ionicons name={icon} size={40} color={colors.textSecondary} style={{ opacity: 0.3 }} />
            <Text style={[styles.text, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {message}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        marginTop: 12,
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.8,
    },
});
