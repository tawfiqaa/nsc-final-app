import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { exportToExcel, generateSchoolHistoryData } from '../../src/utils/export';

export default function SchoolsScreen() {
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { user } = useAuth();
    const { schedules, logs, deleteSchool } = useLesson();
    const { membershipRole } = useOrg();
    const { t } = useTranslation();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    React.useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    if (isRestrictedAdmin) return null;

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

        // Count logs (attended only)
        logs.forEach(l => {
            if (l.status === 'present') {
                if (!schoolMap.has(l.school)) {
                    schoolMap.set(l.school, { name: l.school, lessonCount: 0 });
                }
                const data = schoolMap.get(l.school)!;
                data.lessonCount += 1;
            }
        });

        return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [schedules, logs]);

    const handleExport = async (schoolName: string) => {
        try {
            const data = generateSchoolHistoryData(user!, schoolName, logs);
            await exportToExcel(data, `${schoolName.replace(/\s+/g, '_')}_history.xlsx`);
        } catch (e: any) {
            console.error(e);
            Alert.alert(t('common.error'), t('schools.exportFailed'));
        }
    };

    const handleDeleteSchool = (schoolName: string) => {
        Alert.alert(
            t('schools.deleteSchool'),
            t('schools.deleteSchoolConfirm', { schoolName }),
            [
                { text: t('common.cancel'), style: "cancel" },
                { text: t('common.delete'), style: "destructive", onPress: () => deleteSchool(schoolName) }
            ]
        );
    };

    const renderItem = ({ item }: { item: { name: string, lessonCount: number } }) => (
        <View style={[
            styles.card,
            {
                backgroundColor: colors.surface,
                borderColor: theme === 'light' ? colors.borderSubtle : colors.divider,
                borderRadius: radius.large,
                borderWidth: 1,
                // Subtle shadow for light mode
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                shadowRadius: 10,
                elevation: theme === 'light' ? 2 : 4,
            }
        ]}>
            <TouchableOpacity
                style={styles.cardContent}
                onPress={() => router.push({ pathname: '/school/[id]', params: { id: item.name } })}
            >
                <View style={[styles.iconContainer, { backgroundColor: colors.accentPrimary + '10' }]}>
                    <Ionicons name="school" size={24} color={colors.accentPrimary} />
                </View>
                <View style={styles.info}>
                    <Text style={[styles.schoolName, { color: colors.textPrimary, fontFamily: fonts.bold }]}>{item.name}</Text>
                    <Text style={[styles.stats, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                        {t('schools.lessonCount', { count: item.lessonCount })}
                    </Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={interaction.pressedOpacity}
                style={styles.exportBtn}
                onPress={() => handleExport(item.name)}
            >
                <Ionicons name="download-outline" size={24} color={colors.accentPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={interaction.pressedOpacity}
                style={styles.exportBtn}
                onPress={() => handleDeleteSchool(item.name)}
            >
                <Ionicons name="trash-outline" size={24} color={colors.danger} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <FlatList
                data={schools}
                keyExtractor={item => item.name}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('schools.noSchoolsFound')}</Text>
                }
            />
            <TouchableOpacity
                activeOpacity={interaction.pressedOpacity}
                style={[styles.fab, { backgroundColor: colors.accentPrimary, borderRadius: radius.full, width: 64, height: 64, elevation: 8, shadowOpacity: 0.3 }]}
                onPress={() => router.push('/add-lesson' as any)}
            >
                <Ionicons name="add" size={36} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        padding: 20,
        paddingTop: 10,
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
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    }
});
