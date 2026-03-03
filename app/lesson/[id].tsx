import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { AttendanceLog, AttendanceRecord, AttendanceRecordStatus, Student } from '../../src/types';

export default function LessonDetailsScreen() {
    const { id } = useLocalSearchParams();
    const lessonId = Array.isArray(id) ? id[0] : id;
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { activeOrgId, membershipStatus, membershipRole } = useOrg();
    const { logs, saveAttendance } = useLesson();
    const { t } = useTranslation();
    const router = useRouter();

    const orgMode = useMemo(() => !!activeOrgId && membershipStatus === 'approved', [activeOrgId, membershipStatus]);
    const isAdmin = useMemo(() => membershipRole === 'admin' || membershipRole === 'owner', [membershipRole]);

    const [lessonLog, setLessonLog] = useState<AttendanceLog | null>(null);

    // Load Lesson Log from context or firestore (for admins/other teachers)
    useEffect(() => {
        if (!lessonId) return;
        const local = logs.find(l => l.id === lessonId);
        if (local) {
            setLessonLog(local);
        } else if (orgMode && activeOrgId) {
            // Admin or other view: fetch from org lessons
            getDoc(doc(db, 'orgs', activeOrgId, 'lessons', lessonId)).then(snap => {
                if (snap.exists()) setLessonLog(snap.id ? { id: snap.id, ...snap.data() } as AttendanceLog : null);
            });
        }
    }, [lessonId, logs, orgMode, activeOrgId]);

    const schoolId = lessonLog?.school;
    const isOurLesson = lessonLog?.createdBy === user?.uid;
    const canEdit = isOurLesson || (isAdmin && !lessonLog?.createdBy); // Allow admin to edit if owner missing or it's ours

    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
    // Track dirty local modifications before save
    const [dirtyRecords, setDirtyRecords] = useState<Record<string, AttendanceRecord>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Validate School ID state early so we don't start needless listeners
    const isSchoolValid = !!schoolId;

    useEffect(() => {
        if (!user || !lessonId || !schoolId) return;
        if (!orgMode && !user.migratedToV2) return;

        const studentsRef = orgMode && activeOrgId
            ? collection(db, 'orgs', activeOrgId, 'schools', schoolId, 'students')
            : collection(db, 'users', user.uid, 'schools', schoolId, 'students');
        const attendanceRef = orgMode && activeOrgId
            ? collection(db, 'orgs', activeOrgId, 'lessons', lessonId, 'attendance')
            : collection(db, 'users', user.uid, 'lessons', lessonId, 'attendance');
        const unsubStudents = onSnapshot(studentsRef, (snap) => {
            const activeStudents: Student[] = [];
            snap.forEach(d => {
                const s = d.data() as Student;
                if (s.isActive) activeStudents.push(s);
            });
            activeStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStudents(activeStudents);
        });

        const unsubAttendance = onSnapshot(attendanceRef, (snap) => {
            const recordsMap: Record<string, AttendanceRecord> = {};
            snap.forEach(d => {
                const r = d.data() as AttendanceRecord;
                recordsMap[d.id] = { ...r, id: d.id };
            });
            setAttendanceRecords(recordsMap);
            setDirtyRecords({});
        });

        return () => {
            unsubStudents();
            unsubAttendance();
        };
    }, [user, schoolId, lessonId, orgMode, activeOrgId]);

    // Merge students with their attendance status
    const mergedList = useMemo(() => {
        return students.map(student => {
            const baseRecord = attendanceRecords[student.id];
            const dirtyRecord = dirtyRecords[student.id];

            let status: AttendanceRecordStatus = 'unmarked';
            let note = undefined;

            if (dirtyRecord) {
                status = dirtyRecord.status;
                note = dirtyRecord.note;
            } else if (baseRecord) {
                status = baseRecord.status;
                note = baseRecord.note;
            }

            return {
                studentId: student.id,
                fullName: student.fullName,
                status,
                note,
                isDirty: !!dirtyRecord
            };
        });
    }, [students, attendanceRecords, dirtyRecords]);

    const cycleStatus = (currentStatus: AttendanceRecordStatus): AttendanceRecordStatus => {
        const order: AttendanceRecordStatus[] = ['unmarked', 'present', 'absent', 'late', 'excused'];
        const idx = order.indexOf(currentStatus);
        return order[(idx + 1) % order.length];
    };

    const handleTapStatus = (studentId: string, currentStatus: AttendanceRecordStatus) => {
        const nextStatus = cycleStatus(currentStatus);
        const originalStatus = attendanceRecords[studentId]?.status || 'unmarked';

        setDirtyRecords(prev => {
            const newDirty = { ...prev };
            if (nextStatus === originalStatus && prev[studentId]?.note === attendanceRecords[studentId]?.note) {
                delete newDirty[studentId]; // Restored to original
            } else {
                newDirty[studentId] = {
                    id: studentId,
                    status: nextStatus,
                    note: prev[studentId]?.note || attendanceRecords[studentId]?.note,
                    updatedAt: Date.now()
                };
            }
            return newDirty;
        });
    };

    const markAllPresent = () => {
        setDirtyRecords(prev => {
            const newDirty = { ...prev };
            students.forEach(s => {
                const originalStatus = attendanceRecords[s.id]?.status || 'unmarked';
                if (originalStatus !== 'present') {
                    newDirty[s.id] = {
                        id: s.id,
                        status: 'present',
                        note: prev[s.id]?.note || attendanceRecords[s.id]?.note,
                        updatedAt: Date.now()
                    };
                }
            });
            return newDirty;
        });
    };

    const handleSave = async () => {
        const dirtyValues = Object.values(dirtyRecords);
        if (dirtyValues.length === 0) {
            Alert.alert(t('attendance.noChanges'), t('attendance.noChangesMsg'));
            return;
        }

        setIsSaving(true);
        try {
            await saveAttendance(lessonId as string, dirtyValues);
            Alert.alert(t('common.success'), t('attendance.saveSuccess'));
        } catch (error) {
            Alert.alert(t('common.error'), t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusColor = (status: AttendanceRecordStatus) => {
        switch (status) {
            case 'present': return colors.success;
            case 'absent': return colors.error;
            case 'late': return '#FF9500'; // Orange
            case 'excused': return colors.primary;
            case 'unmarked': default: return colors.secondaryText;
        }
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    if (!orgMode && !user?.migratedToV2) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Text style={textStyle}>{t('attendance.v2Required')}</Text>
            </View>
        );
    }

    if (!isSchoolValid) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
                <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="warning" size={32} color={colors.error} />
                    <Text style={[styles.errorText, textStyle]}>
                        {t('attendance.noSchoolAssigned')}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, boldStyle]}>{t('attendance.title')}</Text>
                {canEdit && (
                    <TouchableOpacity onPress={markAllPresent} style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>{t('attendance.markAllPresent')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={mergedList}
                keyExtractor={item => item.studentId}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: item.isDirty ? colors.primary : colors.border }]}>
                        <View style={styles.studentInfo}>
                            <Text style={[styles.studentName, boldStyle]}>{item.fullName}</Text>
                            {item.note && <Text style={[styles.studentNote, secondaryStyle]}>{item.note}</Text>}
                        </View>

                        <TouchableOpacity
                            style={[styles.statusBtn, { borderColor: getStatusColor(item.status) }]}
                            onPress={() => canEdit && handleTapStatus(item.studentId, item.status)}
                            disabled={!canEdit}
                        >
                            <Text style={{ color: getStatusColor(item.status), fontFamily: fonts.bold, textTransform: 'capitalize' }}>
                                {t(`attendance.status.${item.status}`)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={[styles.empty, secondaryStyle]}>{t('attendance.noStudents')}</Text>}
            />

            {canEdit && (
                <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: colors.primary }, (Object.keys(dirtyRecords).length === 0 || isSaving) && { opacity: 0.5 }]}
                        onPress={handleSave}
                        disabled={Object.keys(dirtyRecords).length === 0 || isSaving}
                    >
                        <Text style={[styles.saveBtnText, { fontFamily: fonts.bold }]}>{isSaving ? t('common.saving') : t('attendance.saveAttendance')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    quickBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 8,
    },
    studentInfo: { flex: 1, marginRight: 16 },
    studentName: { fontSize: 16, fontWeight: '600' },
    studentNote: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
    statusBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 100,
        alignItems: 'center'
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    saveBtn: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    errorBox: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    empty: {
        fontStyle: 'italic',
        marginTop: 20,
    }
});
