import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function SchoolHistoryScreen() {
    const { logs, deleteLog, updateLogNotes } = useLesson();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { user } = useAuth();
    const { membershipRole } = useOrg();
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    // ALL hooks MUST be called before any conditional return (React Rules of Hooks)
    const initialSchoolFilter = typeof params.school === 'string' ? params.school : t('history.allSchools');
    const [selectedSchool, setSelectedSchool] = useState(initialSchoolFilter);
    const [showFilter, setShowFilter] = useState(false);
    const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
    const [notesInput, setNotesInput] = useState('');

    const schools = useMemo(() => {
        const schoolSet = new Set(logs.map(l => l.school));
        return [t('history.allSchools'), ...Array.from(schoolSet).sort()];
    }, [logs, t]);

    const filteredLogs = useMemo(() => {
        let filtered = logs;
        if (selectedSchool !== t('history.allSchools')) {
            filtered = filtered.filter(l => l.school === selectedSchool);
        }
        return [...filtered].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
    }, [logs, selectedSchool, t]);

    const totalLessons = filteredLogs.filter(l => l.status === 'present').length;

    React.useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    // Conditional return AFTER all hooks
    if (isRestrictedAdmin) return null;

    const handleEditNote = (log: typeof logs[0]) => {
        setEditingLog(log);
        setNotesInput(log.notes || '');
    };

    const confirmEditNote = async () => {
        if (!editingLog) return;
        await updateLogNotes(editingLog.id, notesInput.trim());
        setEditingLog(null);
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <View style={[
                styles.header,
                {
                    backgroundColor: colors.surface,
                    borderBottomColor: theme === 'light' ? colors.borderSubtle : colors.divider
                }
            ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            onPress={() => setShowFilter(true)}
                            style={styles.filterButton}
                        >
                            <Text style={[styles.filterText, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>
                                {selectedSchool}  <Ionicons name="chevron-down" size={12} />
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.stats}>
                        <Text style={[styles.statValue, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{totalLessons}</Text>
                        <Text style={[styles.statLabel, secondaryStyle]}>{t('history.lessons')}</Text>
                    </View>
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
                    <Text style={[styles.empty, secondaryStyle]}>{t('history.noHistoryFound')}</Text>
                }
            />

            <Modal visible={showFilter} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFilter(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.large }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{t('history.filterBySchool')}</Text>
                        {schools.map(school => (
                            <TouchableOpacity
                                key={school}
                                style={[styles.filterItem, { borderBottomColor: colors.divider }]}
                                onPress={() => {
                                    setSelectedSchool(school);
                                    setShowFilter(false);
                                }}
                            >
                                <Text style={[
                                    styles.filterItemText,
                                    { color: school === selectedSchool ? colors.accentPrimary : colors.textPrimary, fontFamily: fonts.regular }
                                ]}>{school}</Text>
                                {school === selectedSchool && <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />}
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
                    <View style={[
                        styles.modalContent,
                        {
                            backgroundColor: colors.surface,
                            borderRadius: radius.large,
                            maxHeight: undefined
                        }
                    ]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{editingLog?.notes ? t('dashboard.editNote') : t('dashboard.addNote')}</Text>

                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.backgroundSecondary,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.medium
                                }
                            ]}
                            placeholder={t('dashboard.notesPlaceholder')}
                            placeholderTextColor={colors.textSecondary}
                            value={notesInput}
                            onChangeText={setNotesInput}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                style={[styles.modalBtn, { borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: radius.medium }]}
                                onPress={() => setEditingLog(null)}
                            >
                                <Text style={[textStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                style={[styles.modalBtn, { backgroundColor: colors.accentPrimary, borderRadius: radius.medium }]}
                                onPress={confirmEditNote}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>{t('common.save')}</Text>
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
        paddingTop: 10, // Safe area handled by native header
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
