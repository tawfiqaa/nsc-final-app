import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { exportToExcel, generateSchoolHistoryData } from '../../src/utils/export';

export default function SchoolsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { schedules, logs } = useLesson();
    const router = useRouter();

    const schools = useMemo(() => {
        const schoolMap = new Map<string, { name: string, lessonCount: number }>();

        // Init from schedules
        schedules.forEach(s => {
            if (!schoolMap.has(s.school)) {
                schoolMap.set(s.school, { name: s.school, lessonCount: 0 });
            }
            // Add initial count if exists
            if (s.initialCount) {
                const data = schoolMap.get(s.school)!;
                data.lessonCount = (data.lessonCount || 0) + s.initialCount;
            }
        });

        // Count logs (attended + missed = total lessons 'given' or 'interacted with')
        // Prompt says "how many lessons have we done so far?" -> imply Past lessons.
        // Logic: Total Lessons = Initial Count + All Logs (Present or Absent) for that school.
        logs.forEach(l => {
            if (!schoolMap.has(l.school)) {
                // For one-time events that might not have a schedule anymore
                schoolMap.set(l.school, { name: l.school, lessonCount: 0 });
            }
            const data = schoolMap.get(l.school)!;
            data.lessonCount += 1;
        });

        return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [schedules, logs]);

    const handleExport = async (schoolName: string) => {
        try {
            const data = generateSchoolHistoryData(user!, schoolName, logs);
            await exportToExcel(data, `${schoolName.replace(/\s+/g, '_')}_history.xlsx`);
        } catch (e: any) {
            console.error(e);
            alert("Export failed");
        }
    };

    const renderItem = ({ item }: { item: { name: string, lessonCount: number } }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
                style={styles.cardContent}
                onPress={() => router.push({ pathname: '/school/[id]', params: { id: item.name } })}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="school" size={24} color={colors.primary} />
                </View>
                <View style={styles.info}>
                    <Text style={[styles.schoolName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.stats, { color: colors.secondaryText }]}>{item.lessonCount} Total Lessons</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => handleExport(item.name)}
            >
                <Ionicons name="download-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={schools}
                keyExtractor={item => item.name}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <Text style={[styles.header, { color: colors.text }]}>My Schools</Text>
                }
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No schools found. Add a lesson to see schools here.</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        padding: 20,
        paddingTop: 60,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    exportBtn: {
        padding: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    info: {
        flex: 1,
    },
    schoolName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    stats: {
        fontSize: 14,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    }
});
