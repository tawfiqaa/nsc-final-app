import { Ionicons } from '@expo/vector-icons';
import { endOfMonth, startOfMonth } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DashboardEmptyState } from '../../../../src/components/DashboardEmptyState';
import { LogCard } from '../../../../src/components/LogCard';
import { ScheduleCard } from '../../../../src/components/ScheduleCard';
import { SectionContainer } from '../../../../src/components/SectionContainer';
import { useOrg } from '../../../../src/contexts/OrgContext';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { db } from '../../../../src/lib/firebase';
import { AttendanceLog, OrgMembership, PayrollSettings, Schedule, User } from '../../../../src/types';
import { exportToExcel } from '../../../../src/utils/export';
import { useFormatting } from '../../../../src/utils/formatters';
import { computePayrollTotals } from '../../../../src/utils/payroll';

export default function TeacherDetailsScreen() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const router = useRouter();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, spacing, interaction } = tokens;
    const { activeOrgId } = useOrg();
    const { t } = useTranslation();
    const { formatNumber, formatCurrency } = useFormatting();

    const [teacher, setTeacher] = useState<User | null>(null);
    const [membership, setMembership] = useState<OrgMembership | null>(null);
    const [teacherPayrollSettings, setTeacherPayrollSettings] = useState<PayrollSettings | null>(null);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (uid) fetchTeacherData(uid);
    }, [uid, activeOrgId]);

    const fetchTeacherData = async (targetUid: string) => {
        try {
            setLoading(true);
            // Fetch User Profile
            const userSnap = await getDoc(doc(db, 'users', targetUid));
            if (userSnap.exists()) {
                setTeacher(userSnap.data() as User);
            }

            // Fetch Teacher Payroll Settings
            const payrollSnap = await getDoc(doc(db, 'users', targetUid, 'settings', 'payroll'));
            if (payrollSnap.exists()) {
                setTeacherPayrollSettings(payrollSnap.data() as PayrollSettings);
            }

            // Fetch Data
            if (activeOrgId) {
                // Fetch Membership
                const memberSnap = await getDoc(doc(db, 'orgs', activeOrgId, 'members', targetUid));
                if (memberSnap.exists()) {
                    setMembership(memberSnap.data() as OrgMembership);
                }

                // Org Mode: Fetch from org collections
                const logsRef = collection(db, 'orgs', activeOrgId, 'lessons');
                const schedulesRef = collection(db, 'orgs', activeOrgId, 'schedules');

                const [logsSnap, schedulesSnap] = await Promise.all([
                    getDocs(query(logsRef, where('createdBy', '==', targetUid))),
                    getDocs(query(schedulesRef, where('createdBy', '==', targetUid)))
                ]);

                const loadedLogs: AttendanceLog[] = [];
                logsSnap.forEach(d => loadedLogs.push(d.data() as AttendanceLog));

                const loadedSchedules: Schedule[] = [];
                schedulesSnap.forEach(d => loadedSchedules.push(d.data() as Schedule));

                setLogs(loadedLogs);
                setSchedules(loadedSchedules);
            } else {
                // Legacy / V2 fallback
                const dataSnap = await getDoc(doc(db, 'teacherData', targetUid));
                if (dataSnap.exists()) {
                    const data = dataSnap.data();
                    setLogs(data.attendanceLogs || []);
                    setSchedules(data.schedules || []);
                }
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load teacher data');
        } finally {
            setLoading(false);
        }
    };

    const handleExportFullHistory = async () => {
        if (!teacher) return;
        try {
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
        } catch (error) {
            console.error(error);
            Alert.alert("Export Failed", "Could not generate report");
        }
    };

    const handleToggleStatus = async () => {
        if (!teacher || !uid) return;
        try {
            setUpdating(true);
            const newStatus = !teacher.isApproved;
            await updateDoc(doc(db, 'users', uid), { isApproved: newStatus });
            setTeacher(prev => prev ? ({ ...prev, isApproved: newStatus }) : null);
            Alert.alert("Success", `Teacher ${newStatus ? 'activated' : 'disabled'}`);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to update status");
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteTeacher = async () => {
        if (!teacher || !uid) return;
        Alert.alert(
            "Delete Teacher",
            "Are you sure you want to delete this teacher permanently? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setUpdating(true);
                            await deleteDoc(doc(db, 'users', uid));
                            router.back();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete");
                        } finally {
                            setUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    const stats = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);

        const payrollStats = computePayrollTotals(logs, teacherPayrollSettings, start, end);

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const recentLogs = logs.filter(log => new Date(log.dateISO) >= last30Days);
        const presentCount = recentLogs.filter(l => l.status === 'present').length;
        const attendanceRate = recentLogs.length > 0 ? (presentCount / recentLogs.length) * 100 : 100;

        return {
            totalHours: payrollStats.totalHours,
            totalDistance: payrollStats.totalDistance,
            totalPay: payrollStats.totalPay,
            attendanceRate
        };
    }, [logs, teacherPayrollSettings]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.backgroundPrimary, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
            </View>
        );
    }

    if (!teacher) {
        return (
            <View style={[styles.container, { backgroundColor: colors.backgroundPrimary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textPrimary }}>Teacher not found</Text>
            </View>
        );
    }

    const StatCard = ({ label, value, unit, icon }: { label: string, value: string, unit?: string, icon: any }) => (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: radius.medium }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.accentPrimary + '15' }]}>
                <Ionicons name={icon} size={16} color={colors.accentPrimary} />
            </View>
            <View>
                <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: fonts.bold }]}>
                    {value}<Text style={{ fontSize: 10, fontFamily: fonts.regular, opacity: 0.7 }}> {unit}</Text>
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <Stack.Screen options={{
                headerShown: true,
                title: 'Teacher Profile',
                headerStyle: { backgroundColor: colors.backgroundPrimary },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { fontFamily: fonts.bold },
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                )
            }} />

            {updating && (
                <View style={styles.updatingOverlay}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Header Card */}
                <View style={[styles.profileCard, { backgroundColor: colors.surface, borderRadius: radius.large, borderColor: colors.borderSubtle, borderWidth: 1, overflow: 'hidden' }]}>
                    {/* Subtle Gradient Hint */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: colors.accentPrimary, opacity: 0.03 }} />

                    <View style={styles.profileHeaderRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.accentPrimary + '15' }]}>
                            <Ionicons name="person" size={40} color={colors.accentPrimary} />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.textPrimary, fontFamily: fonts.bold }]}>{teacher.name || teacher.displayName || 'Teacher'}</Text>
                            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{teacher.email || teacher.authEmail}</Text>

                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, { backgroundColor: colors.accentPrimary + '15' }]}>
                                    <View style={[styles.badgeDot, { backgroundColor: colors.accentPrimary }]} />
                                    <Text style={[styles.badgeText, { color: colors.accentPrimary }]}>
                                        {membership?.role?.toUpperCase() || 'TEACHER'}
                                    </Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: teacher.isApproved ? colors.success + '15' : colors.danger + '15' }]}>
                                    <View style={[styles.badgeDot, { backgroundColor: teacher.isApproved ? colors.success : colors.danger }]} />
                                    <Text style={[styles.badgeText, { color: teacher.isApproved ? colors.success : colors.danger }]}>
                                        {teacher.isApproved ? 'ACTIVE' : 'SUSPENDED'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Quick Stats Row */}
                <View style={styles.statsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
                        <StatCard label={t('teacherDetails.stats.monthlyHours')} value={formatNumber(stats.totalHours, { maximumFractionDigits: 1 })} unit="h" icon="time-outline" />
                        <StatCard label={t('teacherDetails.stats.monthlyKm')} value={formatNumber(stats.totalDistance, { maximumFractionDigits: 1 })} unit="km" icon="car-outline" />
                        <StatCard label={t('teacherDetails.stats.attendance')} value={formatNumber(stats.attendanceRate, { maximumFractionDigits: 0 })} unit="%" icon="checkmark-circle-outline" />
                        <StatCard label={t('teacherDetails.stats.estPayroll')} value={formatCurrency(stats.totalPay, teacherPayrollSettings?.currency || 'ILS')} icon="cash-outline" />
                    </ScrollView>
                </View>

                {/* Active Schedules Section */}
                <SectionContainer
                    title={t('teacherDetails.activeSchedules')}
                    subtitle={`${schedules.length} ${t('teacherDetails.ongoingWorkloads')}`}
                >
                    {schedules.length === 0 ? (
                        <DashboardEmptyState icon="calendar-outline" message={t('teacherDetails.noSchedules')} />
                    ) : (
                        schedules.map((schedule, idx) => (
                            <TouchableOpacity
                                key={schedule.id}
                                activeOpacity={interaction.pressedOpacity}
                                onPress={() => router.push(`/admin/teacher/${uid}/school/${encodeURIComponent(schedule.school)}`)}
                                style={{ marginBottom: idx === schedules.length - 1 ? 0 : 12 }}
                            >
                                <ScheduleCard schedule={schedule} readOnly={true} compact={true} />
                            </TouchableOpacity>
                        ))
                    )}
                </SectionContainer>

                {/* Recent Activity Section */}
                <SectionContainer
                    title={t('teacherDetails.recentActivity')}
                    rightAction={
                        <TouchableOpacity onPress={handleExportFullHistory}>
                            <Text style={{ color: colors.accentPrimary, fontFamily: fonts.bold, fontSize: 13 }}>{t('teacherDetails.exportAll')}</Text>
                        </TouchableOpacity>
                    }
                >
                    {logs.length === 0 ? (
                        <DashboardEmptyState icon="flash-outline" message={t('teacherDetails.noActivity')} />
                    ) : (
                        logs.slice(0, 5).map((log, idx) => (
                            <View key={log.id} style={{ marginBottom: idx === 4 || idx === logs.length - 1 ? 0 : 12 }}>
                                <LogCard log={log} readOnly={true} />
                            </View>
                        ))
                    )}
                </SectionContainer>

                {/* Admin Actions Section */}
                <View style={[styles.adminActions, { backgroundColor: colors.surface, borderRadius: radius.large, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.bold }]}>{t('teacherDetails.management')}</Text>

                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: colors.accentPrimary }]}>
                            <Ionicons name="create-outline" size={18} color="#fff" />
                            <Text style={styles.mainActionText}>{t('teacherDetails.editProfile')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
                            <Ionicons name="swap-horizontal-outline" size={18} color={colors.textPrimary} />
                            <Text style={[styles.mainActionText, { color: colors.textPrimary }]}>{t('teacherDetails.reassign')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.dangerZone, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
                        <Text style={[styles.dangerTitle, { color: colors.danger, fontFamily: fonts.bold }]}>{t('teacherDetails.dangerZone')}</Text>

                        <TouchableOpacity
                            onPress={handleToggleStatus}
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.dangerActionBtn, { borderColor: colors.danger, borderWidth: 1 }]}
                        >
                            <Ionicons name={teacher.isApproved ? "pause-circle-outline" : "play-circle-outline"} size={18} color={colors.danger} />
                            <Text style={[styles.dangerActionText, { color: colors.danger }]}>
                                {teacher.isApproved ? t('teacherDetails.suspendAccess') : t('teacherDetails.restoreAccess')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDeleteTeacher}
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.dangerActionBtn, { backgroundColor: colors.danger, marginTop: 12 }]}
                        >
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                            <Text style={[styles.dangerActionText, { color: '#fff' }]}>{t('teacherDetails.permanentDelete')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    updatingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.1)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileCard: {
        padding: 20,
        marginBottom: 20,
    },
    profileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 22,
        marginBottom: 2,
    },
    profileEmail: {
        fontSize: 14,
        marginBottom: 12,
        opacity: 0.8,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 6,
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    statsContainer: {
        marginBottom: 24,
    },
    statsScroll: {
        paddingRight: 16,
        gap: 12,
    },
    statCard: {
        padding: 14,
        width: 140,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
    },
    statLabel: {
        fontSize: 11,
        marginTop: 1,
        opacity: 0.8,
    },
    adminActions: {
        padding: 20,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 16,
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    mainActionBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        gap: 8,
    },
    mainActionText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#fff',
    },
    dangerZone: {
        marginTop: 4,
        paddingTop: 20,
    },
    dangerTitle: {
        fontSize: 14,
        marginBottom: 12,
        opacity: 0.9,
    },
    dangerActionBtn: {
        flexDirection: 'row',
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        gap: 8,
    },
    dangerActionText: {
        fontWeight: '600',
        fontSize: 14,
    }
});
