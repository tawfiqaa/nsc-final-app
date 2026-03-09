import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardEmptyStateProps {
    icon: keyof typeof Ionicons.glyphMap;
    message: string;
    action?: () => void;
    actionText?: string;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({ icon, message, action, actionText }) => {
    const { colors, fonts, tokens } = useTheme();

    return (
        <View style={styles.container}>
            <Ionicons name={icon} size={32} color={colors.textSecondary} style={{ opacity: 0.3 }} />
            <Text style={[styles.text, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {message}
            </Text>
            {action && actionText && (
                <TouchableOpacity
                    onPress={action}
                    style={[
                        styles.actionButton,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            borderColor: colors.borderSubtle,
                            borderRadius: tokens.radius.medium
                        }
                    ]}
                >
                    <Text style={[styles.actionText, { color: colors.accentPrimary, fontFamily: fonts.medium }]}>
                        {actionText}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.8,
    },
    actionButton: {
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderWidth: 1,
    },
    actionText: {
        fontSize: 13,
    },
});
