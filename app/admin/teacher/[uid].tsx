import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../../src/components/LogCard';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { AttendanceLog, Schedule, User } from '../../../src/types';
import { exportToExcel, generateMonthlyReportData } from '../../../src/utils/export';

export default function TeacherDetailsScreen() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const router = useRouter();
    const { colors } = useTheme();

    const [teacher, setTeacher] = useState<User | null>(null);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (uid) fetchTeacherData(uid);
    }, [uid]);

    const fetchTeacherData = async (targetUid: string) => {
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
                setLogs(data.attendanceLogs || []);
                setSchedules(data.schedules || []);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load teacher data');
        } finally {
            setLoading(false);
        }
    };

    const handleExportMonthly = async () => {
        if (!teacher) return;
        try {
            const data = generateMonthlyReportData(teacher, logs, schedules);
            const fileName = `${(teacher.name || 'teacher').replace(/\s+/g, '_')}_Monthly_Report.xlsx`;
            await exportToExcel(data, fileName);
        } catch (e) {
            Alert.alert("Export Failed", "Could not generate report");
        }
    };

    const handleExportFullHistory = async () => {
        if (!teacher) return;
        try {
            // For full history we might want all logs flattened
            // Reusing generateSchoolHistoryData logic but for ALL schools?
            // Or just dump all logs into one sheet. 
            // Let's create a generic 'all logs' dump.
            const allData = logs.map(log => {
                const date = new Date(log.dateISO);
                return {
                    "Teacher Name": teacher.name || teacher.email,
                    "School": log.school,
                    "Date": date.toISOString().split('T')[0],
                    "Time": date.toLocaleTimeString(),
                    "Status": log.status,
                    "Duration": log.hours,
                    "Distance": log.distance
                };
            });

            const fileName = `${(teacher.name || 'teacher').replace(/\s+/g, '_')}_Full_History.xlsx`;
            await exportToExcel(allData, fileName);
        } catch (e) {
            Alert.alert("Export Failed", "Could not generate report");
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!teacher) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.text }}>Teacher not found</Text>
            </View>
        );
    }

    // Sort logs by date desc
    const sortedLogs = [...logs].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>{teacher.name || 'Teacher'}</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{teacher.email}</Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleExportMonthly}>
                    <Ionicons name="calendar-outline" size={20} color="#fff" />
                    <Text style={styles.actionText}>Monthly Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={handleExportFullHistory}>
                    <Ionicons name="documents-outline" size={20} color={colors.text} />
                    <Text style={[styles.actionText, { color: colors.text }]}>Full History</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={sortedLogs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <LogCard
                        log={item}
                        onToggle={() => { }} // Read-only in admin view
                        onDelete={() => { }} // Read-only in admin view
                    />
                )}
                contentContainerStyle={styles.list}
                ListHeaderComponent={<Text style={[styles.sectionTitle, { color: colors.text }]}>Recent History</Text>}
                ListEmptyComponent={<Text style={{ color: colors.secondaryText, textAlign: 'center', marginTop: 20 }}>No logs found.</Text>}
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
    },
    actions: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    actionText: {
        color: '#fff',
        fontWeight: '600',
    },
    list: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    }
});
