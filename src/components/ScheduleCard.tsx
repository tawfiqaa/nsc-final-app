import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { AttendanceStatus, Schedule } from '../types';

interface ScheduleCardProps {
    schedule: Schedule;
    onMark?: (status: AttendanceStatus) => void;
    readOnly?: boolean;
    lessonCount?: number;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({ schedule, onMark, readOnly, lessonCount }) => {
    const { colors, theme, tokens } = useTheme();
    const { radius, interaction } = tokens;

    const cardStyle = [
        styles.card,
        {
            backgroundColor: colors.surface,
            borderRadius: radius.large,
            borderColor: theme === 'light' ? colors.borderSubtle : colors.divider,
            borderWidth: 1,
            // Subtle shadow for light mode
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: theme === 'light' ? 0.05 : 0.1,
            shadowRadius: 10,
            elevation: theme === 'light' ? 2 : 4,
        }
    ];

    return (
        <View style={cardStyle}>
            <View style={styles.header}>
                <Text style={[styles.school, { color: colors.textPrimary }]}>{schedule.school}</Text>
                <Text style={[styles.time, { color: colors.accentPrimary }]}>{schedule.startTime}</Text>
            </View>

            <View style={styles.details}>
                <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{schedule.duration}h</Text>
                </View>
                <View style={styles.detailItem}>
                    <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{schedule.distance}km</Text>
                </View>
                {typeof lessonCount !== 'undefined' && (
                    <View style={styles.detailItem}>
                        <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>{lessonCount} lessons</Text>
                    </View>
                )}
            </View>

            {!readOnly && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.button, { borderColor: colors.danger, backgroundColor: colors.danger + '08' }]}
                        onPress={() => onMark?.('absent')}
                    >
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                        <Text style={[styles.buttonText, { color: colors.danger }]}>Absent</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.button, { borderColor: colors.success, backgroundColor: colors.success + '10' }]}
                        onPress={() => onMark?.('present')}
                    >
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={[styles.buttonText, { color: colors.success }]}>Present</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    school: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    time: {
        fontSize: 16,
        fontWeight: '700',
    },
    details: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    detailText: {
        marginLeft: 4,
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    buttonText: {
        marginLeft: 6,
        fontWeight: '600',
    },
});
