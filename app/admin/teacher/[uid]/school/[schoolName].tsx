import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../../../../src/components/LogCard';
import { useTheme } from '../../../../../src/contexts/ThemeContext';
import { db } from '../../../../../src/lib/firebase';
import { AttendanceLog, User } from '../../../../../src/types';

export default function SchoolLessonsScreen() {
    const { uid, schoolName } = useLocalSearchParams<{ uid: string, schoolName: string }>();
    const router = useRouter();
    const { colors } = useTheme();

    const [teacher, setTeacher] = useState<User | null>(null);
    const [schoolLogs, setSchoolLogs] = useState<AttendanceLog[]>([]);
    const [schoolPhotos, setSchoolPhotos] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const decodedSchoolName = schoolName ? decodeURIComponent(schoolName) : '';

    useEffect(() => {
        if (uid && decodedSchoolName) {
            fetchSchoolData(uid, decodedSchoolName);
        }
    }, [uid, decodedSchoolName]);

    const fetchSchoolData = async (targetUid: string, targetSchool: string) => {
        try {
            setLoading(true);
            // Fetch User Profile
            const userSnap = await getDoc(doc(db, 'users', targetUid));
            if (userSnap.exists()) {
                setTeacher(userSnap.data() as User);
            }

            // Fetch Teacher Data
            const dataSnap = await getDoc(doc(db, 'teacherData', targetUid));
            if (dataSnap.exists()) {
                const data = dataSnap.data();
                const allLogs = (data.attendanceLogs || []) as AttendanceLog[];
                // Filter logs for the specific school
                const filtered = allLogs.filter(log => log.school === targetSchool);
                // Sort by date desc
                filtered.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
                setSchoolLogs(filtered);

                const galleries = data.schoolGalleries || {};
                setSchoolPhotos(galleries[targetSchool] || []);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load school data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.text }]}>{decodedSchoolName}</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                        {teacher ? `Lessons by ${teacher.name || teacher.email}` : 'Loading...'}
                    </Text>
                </View>
                {schoolPhotos.length > 0 && (
                    <TouchableOpacity
                        style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border }}
                        onPress={() => router.push({ pathname: '/admin/teacher/[uid]/school/[schoolName]/gallery' as any, params: { uid, schoolName } })}
                    >
                        <Ionicons name="images-outline" size={20} color={colors.text} />
                        <Text style={{ color: colors.text, fontWeight: '600' }}>Gallery ({schoolPhotos.length})</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={schoolLogs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <LogCard
                        log={item}
                        readOnly={true}
                    />
                )}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.summaryContainer}>
                        <Text style={[styles.summaryText, { color: colors.text }]}>
                            Values: {schoolLogs.length} lessons found
                        </Text>
                    </View>
                }
                ListEmptyComponent={<Text style={{ color: colors.secondaryText, textAlign: 'center', marginTop: 20 }}>No lessons found for this school.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 50, // SafeArea
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    list: {
        padding: 16,
    },
    summaryContainer: {
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    summaryText: {
        fontSize: 16,
        fontWeight: '600',
    }
});
