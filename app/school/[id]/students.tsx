import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useLesson } from '../../../src/contexts/LessonContext';
import { useOrg } from '../../../src/contexts/OrgContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { Student } from '../../../src/types';

export default function ManageStudentsScreen() {
    const { id } = useLocalSearchParams();
    const schoolId = Array.isArray(id) ? id[0] : id;
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { activeOrgId, membershipStatus, membershipRole } = useOrg();
    const { deleteStudent } = useLesson();
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

    const orgMode = useMemo(() => !!activeOrgId && membershipStatus === 'approved', [activeOrgId, membershipStatus]);

    const [students, setStudents] = useState<Student[]>([]);
    const [newStudentName, setNewStudentName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    useEffect(() => {
        if (!user || !schoolId || isRestrictedAdmin) return;

        let studentsRef;
        if (orgMode && activeOrgId) {
            studentsRef = collection(db, 'orgs', activeOrgId, 'schools', schoolId, 'students');
        } else if (user.migratedToV2) {
            studentsRef = collection(db, 'users', user.uid, 'schools', schoolId, 'students');
        } else {
            return;
        }

        const unsub = onSnapshot(studentsRef, (snap) => {
            const loadedStudents: Student[] = [];
            snap.forEach(d => {
                loadedStudents.push(d.data() as Student);
            });
            loadedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStudents(loadedStudents);
        });

        return () => unsub();
    }, [user, schoolId, orgMode, activeOrgId, isRestrictedAdmin]);

    if (isRestrictedAdmin) return null;

    const handleAddStudent = async () => {
        const name = newStudentName.trim();
        if (!name) return;
        if (!user || !schoolId) return;
        if (!orgMode && !user.migratedToV2) return;

        setIsSaving(true);
        try {
            const studentsCol = orgMode && activeOrgId
                ? collection(db, 'orgs', activeOrgId, 'schools', schoolId, 'students')
                : collection(db, 'users', user.uid, 'schools', schoolId, 'students');
            const studentRef = doc(studentsCol);
            const newStudent: Student = {
                id: studentRef.id,
                fullName: name,
                isActive: true,
                createdAt: Date.now(),
            };
            await setDoc(studentRef, newStudent);
            setNewStudentName('');
        } catch (error) {
            console.error('Failed to add student', error);
            Alert.alert(t('common.error'), t('students.addFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStudent = async (studentId: string, studentName: string) => {
        if (!user || !schoolId) return;
        if (!orgMode && !user.migratedToV2) return;
        Alert.alert(
            t('students.deleteStudent'),
            t('students.deleteStudentConfirm', { studentName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('schools.deleteSchool'), style: 'destructive', onPress: async () => {
                        try {
                            await deleteStudent(schoolId, studentId);
                        } catch (error) {
                            console.error('Failed to delete student', error);
                            Alert.alert(t('common.error'), t('students.deleteFailed'));
                        }
                    }
                }
            ]
        );
    };

    const activeStudents = students.filter(s => s.isActive);
    const archivedStudents = students.filter(s => !s.isActive);

    const renderStudent = ({ item }: { item: Student }) => (
        <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.studentName, { color: colors.text, fontFamily: fonts.bold }]}>{item.fullName}</Text>
            <TouchableOpacity onPress={() => handleDeleteStudent(item.id, item.fullName)}>
                <Ionicons name="trash-outline" size={20} color={colors.error || '#ff4444'} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.headerRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, boldStyle]}>{t('students.title')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.addSection}>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, fontFamily: fonts.regular }]}
                    placeholder={t('students.newName')}
                    placeholderTextColor={colors.secondaryText}
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                    onSubmitEditing={handleAddStudent}
                />
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }, (!newStudentName.trim() || isSaving) && { opacity: 0.5 }]}
                    onPress={handleAddStudent}
                    disabled={!newStudentName.trim() || isSaving}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={activeStudents}
                keyExtractor={item => item.id}
                renderItem={renderStudent}
                ListHeaderComponent={<Text style={[styles.sectionTitle, boldStyle]}>{t('students.activeRoster')}</Text>}
                ListEmptyComponent={<Text style={[styles.empty, secondaryStyle]}>{t('students.noActive')}</Text>}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={
                    archivedStudents.length > 0 ? (
                        <View style={{ marginTop: 24 }}>
                            <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('students.archived')}</Text>
                            {archivedStudents.map(student => (
                                <View key={student.id}>{renderStudent({ item: student })}</View>
                            ))}
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    addSection: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 12,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    addBtn: {
        height: 50,
        width: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    studentCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 8,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '600',
    },
    empty: {
        fontStyle: 'italic',
    },
});
