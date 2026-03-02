import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useLesson } from '../../../src/contexts/LessonContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { Student } from '../../../src/types';

export default function ManageStudentsScreen() {
    const { id } = useLocalSearchParams();
    const schoolId = Array.isArray(id) ? id[0] : id;
    const { colors } = useTheme();
    const { user } = useAuth();
    const { deleteStudent } = useLesson();
    const router = useRouter();

    const [students, setStudents] = useState<Student[]>([]);
    const [newStudentName, setNewStudentName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user || !user.migratedToV2 || !schoolId) return;

        const studentsRef = collection(db, 'users', user.uid, 'schools', schoolId, 'students');
        const unsub = onSnapshot(studentsRef, (snap) => {
            const loadedStudents: Student[] = [];
            snap.forEach(d => {
                loadedStudents.push(d.data() as Student);
            });
            // Sort by createdAt ascending or name. Let's do name for easier scanning.
            loadedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStudents(loadedStudents);
        });

        return () => unsub();
    }, [user, schoolId]);

    const handleAddStudent = async () => {
        const name = newStudentName.trim();
        if (!name) return;
        if (!user || !user.migratedToV2 || !schoolId) return;

        setIsSaving(true);
        try {
            const studentRef = doc(collection(db, 'users', user.uid, 'schools', schoolId, 'students'));
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
            Alert.alert('Error', 'Failed to add student');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStudent = async (studentId: string, studentName: string) => {
        if (!user || !user.migratedToV2 || !schoolId) return;
        Alert.alert(
            'Delete Student',
            `Are you sure you want to permanently delete ${studentName}? This will remove all their data from this school's roster.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await deleteStudent(schoolId, studentId);
                        } catch (error) {
                            console.error('Failed to delete student', error);
                            Alert.alert('Error', 'Failed to delete student');
                        }
                    }
                }
            ]
        );
    };

    // We render both active and archived for transparency, maybe separate sections.
    const activeStudents = students.filter(s => s.isActive);
    const archivedStudents = students.filter(s => !s.isActive);

    const renderStudent = ({ item }: { item: Student }) => (
        <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.studentName, { color: colors.text }]}>{item.fullName}</Text>
            <TouchableOpacity onPress={() => handleDeleteStudent(item.id, item.fullName)}>
                <Ionicons name="trash-outline" size={20} color={colors.error || '#ff4444'} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.addSection}>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    placeholder="New Student Name..."
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
                ListHeaderComponent={<Text style={[styles.sectionTitle, { color: colors.text }]}>Active Roster</Text>}
                ListEmptyComponent={<Text style={[styles.empty, { color: colors.secondaryText }]}>No active students.</Text>}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={
                    archivedStudents.length > 0 ? (
                        <View style={{ marginTop: 24 }}>
                            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Archived</Text>
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
        padding: 20,
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
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
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
