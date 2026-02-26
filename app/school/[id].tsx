import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function SchoolDetailsScreen() {
    const { id } = useLocalSearchParams();
    const schoolName = Array.isArray(id) ? id[0] : id;
    const { colors } = useTheme();
    const { schedules, logs, deleteSchedule, toggleLogStatus, deleteLog, updateLogNotes } = useLesson();
    const router = useRouter();

    const [editingLog, setEditingLog] = React.useState<typeof logs[0] | null>(null);
    const [notesInput, setNotesInput] = React.useState('');

    const handleEditNote = (log: typeof logs[0]) => {
        setEditingLog(log);
        setNotesInput(log.notes || '');
    };

    const confirmEditNote = async () => {
        if (!editingLog) return;
        await updateLogNotes(editingLog.id, notesInput.trim());
        setEditingLog(null);
    };

    const stats = useMemo(() => {
        // strict filter
        const schoolSchedules = schedules.filter(s => s.school === schoolName);
        const schoolLogs = logs
            .filter(l => l.school === schoolName)
            .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 }}>
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, flex: 1 }}>{schoolName}</Text>
                    <TouchableOpacity
                        style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={() => router.push({ pathname: '/add-lesson', params: { school: schoolName, mode: 'log' } })}
                    >
                        <Ionicons name="add-circle" size={20} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Add Past Lesson</Text>
                    </TouchableOpacity>
                </View>

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
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: 'bold' }}>
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sched.dayOfWeek]}
                                    {sched.isActive === false && <Text style={{ color: colors.error }}> (Inactive)</Text>}
                                </Text>
                                <Text style={{ color: colors.text }}>{sched.startTime} ({sched.duration}h)</Text>
                                <Text style={{ color: colors.secondaryText }}>{sched.distance}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <TouchableOpacity onPress={() => router.push({ pathname: '/add-lesson', params: { scheduleId: sched.id } })}>
                                    <Ionicons name="pencil" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    Alert.alert(
                                        "Delete Schedule",
                                        "Are you sure you want to delete this schedule? Past attendance logs will be preserved.",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            { text: "Delete", style: "destructive", onPress: () => deleteSchedule(sched.id) }
                                        ]
                                    );
                                }}>
                                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}

                {/* Recent Logs Section */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Recent History</Text>
                {stats.schoolLogs.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No history yet.</Text>
                ) : (
                    stats.schoolLogs.map(log => (
                        <LogCard
                            key={log.id}
                            log={log}
                            onDelete={() => {
                                Alert.alert("Confirm Deletion", "Are you sure you want to delete this log?", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => deleteLog(log.id) }
                                ]);
                            }}
                            onEditNote={() => handleEditNote(log)}
                            deleteType="icon"
                        />
                    ))
                )}

            </ScrollView>

            {/* Modal for Edit Note */}
            <Modal
                visible={!!editingLog}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditingLog(null)}
            >
                <View style={[styles.modalOverlay, { padding: 20 }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: undefined }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{editingLog?.notes ? 'Edit Note' : 'Add Note'}</Text>

                        <TextInput
                            style={[
                                styles.textInput,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }
                            ]}
                            placeholder="e.g. Covered Chapter 3, student was late..."
                            placeholderTextColor={colors.secondaryText}
                            value={notesInput}
                            onChangeText={setNotesInput}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => setEditingLog(null)}
                            >
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={confirmEditNote}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 40,
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        minHeight: 100,
        fontSize: 16,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
});
