import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface StatsWidgetProps {
    title: string;
    value: string | number;
    unit?: string;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({ title, value, unit }) => {
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius } = tokens;

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: colors.surface,
                borderRadius: radius.large,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                // Subtle shadow for light mode
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                shadowRadius: 10,
                elevation: theme === 'light' ? 2 : 4,
            }
        ]}>
            <Text style={[styles.title, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{title}</Text>
            <View style={styles.valueContainer}>
                <Text style={[styles.value, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{value}</Text>
                {unit && <Text style={[styles.unit, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{unit}</Text>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    value: {
        fontSize: 24,
        fontWeight: '700',
    },
    unit: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 2,
    },
});
