import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { buildGoogleMapsUrl, openWaze } from '../../src/utils/navigationLinks';

const DAYS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function SchoolDetailsScreen() {
    const { id } = useLocalSearchParams();
    const schoolName = Array.isArray(id) ? id[0] : id;
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { membershipRole, activeOrgId } = useOrg();
    const { schedules, logs, schools, deleteSchedule, deleteLog, updateLogNotes, deleteSchool, updateSchoolLocation } = useLesson();
    const { t } = useTranslation();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    const [editingLog, setEditingLog] = React.useState<typeof logs[0] | null>(null);
    const [notesInput, setNotesInput] = React.useState('');

    // Location State
    const [showLocationModal, setShowLocationModal] = React.useState(false);
    const [addrInput, setAddrInput] = React.useState('');
    const [latInput, setLatInput] = React.useState('');
    const [lngInput, setLngInput] = React.useState('');
    const [savingLocation, setSavingLocation] = React.useState(false);

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
        const schoolSchedules = schedules.filter(s => s.school === schoolName);
        const schoolLogs = logs
            .filter(l => l.school === schoolName)
            .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

        const schoolDoc = schools.find(s => s.name === schoolName);

        const initialCountTotal = schoolSchedules.reduce((acc, curr) => acc + (curr.initialCount || 0), 0);
        const attendedCount = schoolLogs.filter(l => l.status === 'present').length;
        const missedCount = schoolLogs.filter(l => l.status === 'absent').length;
        const totalLessons = initialCountTotal + attendedCount + missedCount;

        return {
            initialCountTotal,
            attendedCount,
            missedCount,
            totalLessons,
            schoolSchedules,
            schoolLogs,
            schoolDoc
        };
    }, [schedules, logs, schools, schoolName]);

    const handleOpenEditLocation = () => {
        setAddrInput(stats.schoolDoc?.addressLabel || '');
        setLatInput(stats.schoolDoc?.location?.lat?.toString() || '');
        setLngInput(stats.schoolDoc?.location?.lng?.toString() || '');
        setShowLocationModal(true);
    };

    const handleSaveLocation = async () => {
        if (!addrInput.trim()) {
            Alert.alert(t('common.error'), t('addLesson.schoolRequired'));
            return;
        }

        let location = null;
        if (latInput.trim() || lngInput.trim()) {
            const lat = parseFloat(latInput);
            const lng = parseFloat(lngInput);
            if (isNaN(lat) || isNaN(lng)) {
                Alert.alert(t('common.error'), t('addLesson.invalidDistance') || "Invalid coordinates");
                return;
            }
            location = { lat, lng };
        }

        setSavingLocation(true);
        try {
            // Find the correct school doc to get its ID (though name is often used as ID)
            const schoolId = stats.schoolDoc?.id || schoolName!;
            await updateSchoolLocation(schoolId, { addressLabel: addrInput.trim(), location });
            setShowLocationModal(false);
        } catch (e) {
            Alert.alert(t('common.error'), "Failed to save location");
        } finally {
            setSavingLocation(false);
        }
    };

    const handleDeleteSchool = () => {
        Alert.alert(
            t('schools.deleteSchool'),
            t('schoolDetails.deleteSchoolConfirmLong', { schoolName }),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('schoolDetails.deleteEverything'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteSchool(schoolName!);
                            router.replace('/(tabs)/schools');
                        } catch (e) {
                            Alert.alert(t('common.error'), t('common.deleteFailed') || "Failed");
                        }
                    }
                }
            ]
        );
    };

    if (isRestrictedAdmin) return null;

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={{ marginBottom: 20, marginTop: 20 }}>
                    <Text style={[boldStyle, { fontSize: 28, marginBottom: 12 }]}>{schoolName}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <TouchableOpacity
                            style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border }}
                            onPress={() => router.push({ pathname: '/school/[id]/gallery' as any, params: { id: schoolName } })}
                        >
                            <Ionicons name="images-outline" size={18} color={colors.text} />
                            <Text style={[boldStyle, { fontSize: 14 }]}>{t('schoolDetails.gallery')}</Text>
                        </TouchableOpacity>
                        {user?.migratedToV2 && (
                            <TouchableOpacity
                                style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border }}
                                onPress={() => router.push({ pathname: '/school/[id]/students' as any, params: { id: schoolName } })}
                            >
                                <Ionicons name="people-outline" size={18} color={colors.text} />
                                <Text style={[boldStyle, { fontSize: 14 }]}>{t('schoolDetails.students')}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => router.push({ pathname: '/add-lesson', params: { school: schoolName, mode: 'log' } })}
                        >
                            <Ionicons name="add-circle" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, fontFamily: fonts.bold }}>{t('schoolDetails.addPastLesson')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ backgroundColor: '#440000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#ff4444' }}
                            onPress={handleDeleteSchool}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ff4444" />
                            <Text style={{ color: '#ff4444', fontWeight: '600', fontSize: 14, fontFamily: fonts.bold }}>{t('schools.deleteSchool')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.grid}>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statValue, { color: colors.primary, fontFamily: fonts.bold }]}>{stats.attendedCount}</Text>
                        <Text style={[secondaryStyle, { fontSize: 12 }]}>{t('history.lessons')}</Text>
                    </View>
                </View>

                {/* Location Section */}
                <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.locationHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.sectionTitle, boldStyle, { marginBottom: 4 }]}>{t('schoolDetails.location')}</Text>
                            <Text style={[textStyle, { fontSize: 14 }]} numberOfLines={2}>
                                {stats.schoolDoc?.addressLabel || t('schoolDetails.noLocationSet')}
                            </Text>
                        </View>
                        {(isOrgAdmin || isSuperAdmin || !activeOrgId) && (
                            <TouchableOpacity
                                style={[styles.editLocBtn, { backgroundColor: colors.background }]}
                                onPress={handleOpenEditLocation}
                            >
                                <Ionicons name="location-outline" size={18} color={colors.primary} />
                                <Text style={[boldStyle, { color: colors.primary, fontSize: 12 }]}>{t('common.edit')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.navButtons}>
                        <TouchableOpacity
                            style={[styles.navBtn, { borderColor: colors.border }]}
                            onPress={() => {
                                const url = buildGoogleMapsUrl({
                                    addressLabel: stats.schoolDoc?.addressLabel,
                                    location: stats.schoolDoc?.location
                                });
                                if (url) Linking.openURL(url);
                            }}
                        >
                            <Ionicons name="map-outline" size={18} color={colors.text} />
                            <Text style={[textStyle, { fontSize: 13 }]}>{t('schoolDetails.openInGoogleMaps')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.navBtn, { borderColor: colors.border }]}
                            onPress={() => openWaze({
                                addressLabel: stats.schoolDoc?.addressLabel,
                                location: stats.schoolDoc?.location
                            })}
                        >
                            <Ionicons name="navigate-outline" size={18} color={colors.text} />
                            <Text style={[textStyle, { fontSize: 13 }]}>{t('schoolDetails.openInWaze')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Schedules Section */}
                <Text style={[boldStyle, { fontSize: 18, marginBottom: 12 }]}>{t('schoolDetails.weeklySchedule')}</Text>
                {stats.schoolSchedules.length === 0 ? (
                    <Text style={[styles.empty, secondaryStyle]}>{t('schoolDetails.noRecurringSchedules')}</Text>
                ) : (
                    stats.schoolSchedules.map(sched => (
                        <View key={sched.id} style={[styles.scheduleItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[boldStyle]}>
                                    {t(`days.${DAYS_KEYS[sched.dayOfWeek]}`)}
                                    {sched.isActive === false && <Text style={{ color: colors.error, fontFamily: fonts.bold }}> ({t('schoolDetails.inactive')})</Text>}
                                </Text>
                                <Text style={textStyle}>{sched.startTime} ({sched.duration}h)</Text>
                                <Text style={secondaryStyle}>{sched.distance}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <TouchableOpacity onPress={() => router.push({ pathname: '/add-lesson', params: { scheduleId: sched.id } })}>
                                    <Ionicons name="pencil" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    Alert.alert(
                                        t('editLesson.deleteSchedule'),
                                        t('editLesson.deleteScheduleConfirm'),
                                        [
                                            { text: t('common.cancel'), style: "cancel" },
                                            { text: t('common.delete'), style: "destructive", onPress: () => deleteSchedule(sched.id) }
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
                <Text style={[boldStyle, { fontSize: 18, marginBottom: 12, marginTop: 24 }]}>{t('schoolDetails.recentHistory')}</Text>
                {stats.schoolLogs.length === 0 ? (
                    <Text style={[styles.empty, secondaryStyle]}>{t('schoolDetails.noHistoryYet')}</Text>
                ) : (
                    stats.schoolLogs.map(log => (
                        <LogCard
                            key={log.id}
                            log={log}
                            onDelete={() => {
                                Alert.alert(t('schoolDetails.confirmDeletion'), t('schoolDetails.deleteLogConfirm'), [
                                    { text: t('common.cancel'), style: "cancel" },
                                    { text: t('common.delete'), style: "destructive", onPress: () => deleteLog(log.id) }
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
                        <Text style={[styles.modalTitle, boldStyle]}>{editingLog?.notes ? t('dashboard.editNote') : t('dashboard.addNote')}</Text>

                        <TextInput
                            style={[
                                styles.textInput,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                            ]}
                            placeholder={t('dashboard.notesPlaceholder')}
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
                                <Text style={[boldStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={confirmEditNote}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal for Location */}
            <Modal
                visible={showLocationModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <View style={[styles.modalOverlay, { padding: 20 }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{t('schoolDetails.editLocation')}</Text>

                        <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.addressLabel')}</Text>
                        <TextInput
                            style={[
                                styles.textInputSingle,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                            ]}
                            placeholder="e.g. 123 Main St, Haifa"
                            placeholderTextColor={colors.secondaryText}
                            value={addrInput}
                            onChangeText={setAddrInput}
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.latitude')}</Text>
                                <TextInput
                                    style={[
                                        styles.textInputSingle,
                                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                                    ]}
                                    placeholder="32.1234"
                                    placeholderTextColor={colors.secondaryText}
                                    value={latInput}
                                    onChangeText={setLatInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.longitude')}</Text>
                                <TextInput
                                    style={[
                                        styles.textInputSingle,
                                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                                    ]}
                                    placeholder="34.1234"
                                    placeholderTextColor={colors.secondaryText}
                                    value={lngInput}
                                    onChangeText={setLngInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => setShowLocationModal(false)}
                            >
                                <Text style={[boldStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSaveLocation}
                                disabled={savingLocation}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>
                                    {savingLocation ? t('common.saving') : t('common.save')}
                                </Text>
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
    locationCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 24,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    editLocBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    navButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    navBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    textInputSingle: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
    }
});
