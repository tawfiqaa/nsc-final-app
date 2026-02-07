import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function SchoolDetailsScreen() {
    const { id } = useLocalSearchParams();
    const schoolName = Array.isArray(id) ? id[0] : id;
    const { colors } = useTheme();
    const { schedules, logs } = useLesson();

    const stats = useMemo(() => {
        // strict filter
        const schoolSchedules = schedules.filter(s => s.school === schoolName);
        const schoolLogs = logs.filter(l => l.school === schoolName);

        const initialCountTotal = schoolSchedules.reduce((acc, curr) => acc + (curr.initialCount || 0), 0);

        // "Attended" means status 'present'
        const attendedCount = schoolLogs.filter(l => l.status === 'present').length;

        // "Missed" means status 'absent'
        const missedCount = schoolLogs.filter(l => l.status === 'absent').length;

        // Total = Initial + Attended + Missed (all logs)
        // Note: If a schedule has initialCount=10, and you log 1 present, total is 11? 
        // Yes, assuming initialCount represents "legacy" lessons before app usage.
        const totalLessons = initialCountTotal + attendedCount + missedCount;

        return {
            initialCountTotal,
            attendedCount,
            missedCount,
            totalLessons,
            schoolSchedules,
            schoolLogs
        };
    }, [schedules, logs, schoolName]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.header, { color: colors.text }]}>{schoolName}</Text>

                {/* Stats Grid */}
                <View style={styles.grid}>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalLessons}</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Total Lessons</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{stats.attendedCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Attended</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statValue, { color: colors.error }]}>{stats.missedCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Missed</Text>
                    </View>
                </View>

                {/* Schedules Section */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Schedule</Text>
                {stats.schoolSchedules.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No recurring schedules.</Text>
                ) : (
                    stats.schoolSchedules.map(sched => (
                        <View key={sched.id} style={[styles.scheduleItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={{ color: colors.text, fontWeight: 'bold' }}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sched.dayOfWeek]}
                            </Text>
                            <Text style={{ color: colors.text }}>{sched.startTime} ({sched.duration}h)</Text>
                            <Text style={{ color: colors.secondaryText }}>{sched.distance}km</Text>
                        </View>
                    ))
                )}

                {/* Recent Logs Section */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Recent History</Text>
                {stats.schoolLogs.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No history yet.</Text>
                ) : (
                    stats.schoolLogs.map(log => (
                        <LogCard key={log.id} log={log} />
                    ))
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 20,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 30,
    },
    statBox: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    scheduleItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    empty: {
        fontStyle: 'italic',
    }
});
