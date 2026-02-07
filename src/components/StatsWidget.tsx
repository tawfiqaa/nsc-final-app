import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface StatsWidgetProps {
    title: string;
    value: string | number;
    unit?: string;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({ title, value, unit }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.secondaryText }]}>{title}</Text>
            <View style={styles.valueContainer}>
                <Text style={[styles.value, { color: colors.primary }]}>{value}</Text>
                {unit && <Text style={[styles.unit, { color: colors.secondaryText }]}>{unit}</Text>}
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
        textTransform: 'uppercase',
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
