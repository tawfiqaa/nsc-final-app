import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function SchoolHistoryScreen() {
    const { logs, deleteLog, updateLogNotes } = useLesson();
    const { colors } = useTheme();
    const params = useLocalSearchParams();

    // Note: params.teacherUid might be passed if Admin is viewing, 
    // but useLesson context should already be set to that teacherUid by the Admin screen logic.
    // We'll trust the context is correct.

    const initialSchoolFilter = typeof params.school === 'string' ? params.school : 'All Schools';
    const [selectedSchool, setSelectedSchool] = useState(initialSchoolFilter);
    const [showFilter, setShowFilter] = useState(false);

    const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
    const [notesInput, setNotesInput] = useState('');

    const handleEditNote = (log: typeof logs[0]) => {
        setEditingLog(log);
        setNotesInput(log.notes || '');
    };

    const confirmEditNote = async () => {
        if (!editingLog) return;
        await updateLogNotes(editingLog.id, notesInput.trim());
        setEditingLog(null);
    };

    const schools = useMemo(() => {
        const schoolSet = new Set(logs.map(l => l.school));
        return ['All Schools', ...Array.from(schoolSet).sort()];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        let filtered = logs;
        if (selectedSchool !== 'All Schools') {
            filtered = filtered.filter(l => l.school === selectedSchool);
        }
        return [...filtered].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
    }, [logs, selectedSchool]);

    const totalLessons = filteredLogs.filter(l => l.status === 'present').length;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>History</Text>
                    <TouchableOpacity onPress={() => setShowFilter(true)} style={styles.filterButton}>
                        <Text style={[styles.filterText, { color: colors.primary }]}>
                            {selectedSchool}  <Ionicons name="chevron-down" size={12} />
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.stats}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{totalLessons}</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Lessons</Text>
                </View>
            </View>

            <FlatList
                data={filteredLogs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <LogCard
                        log={item}
                        onDelete={() => deleteLog(item.id)}
                        onEditNote={() => handleEditNote(item)}
                    />
                )}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No history found.</Text>
                }
            />

            <Modal visible={showFilter} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFilter(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by School</Text>
                        {schools.map(school => (
                            <TouchableOpacity
                                key={school}
                                style={[styles.filterItem, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    setSelectedSchool(school);
                                    setShowFilter(false);
                                }}
                            >
                                <Text style={[
                                    styles.filterItemText,
                                    { color: school === selectedSchool ? colors.primary : colors.text }
                                ]}>{school}</Text>
                                {school === selectedSchool && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

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
    header: {
        padding: 20,
        paddingTop: 60, // Safe area
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    filterButton: {
        marginTop: 4,
    },
    filterText: {
        fontSize: 16,
        fontWeight: '600',
    },
    stats: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
    },
    list: {
        padding: 20,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
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
        maxHeight: 400,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    filterItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    filterItemText: {
        fontSize: 16,
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
