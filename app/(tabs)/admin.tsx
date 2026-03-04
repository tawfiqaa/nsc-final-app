import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Added this import based on the instruction's intent
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { OrgMembership } from '../../src/types';

export default function AdminScreen() {
    const router = useRouter();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { user } = useAuth();
    const { activeOrgId, activeOrg, membershipRole } = useOrg();
    const { t } = useTranslation();

    const [pendingMembers, setPendingMembers] = useState<OrgMembership[]>([]);
    const [approvedMembers, setApprovedMembers] = useState<OrgMembership[]>([]);
    const [orgStats, setOrgStats] = useState({ schoolCount: 0, teacherCount: 0 });
    const [loading, setLoading] = useState(true);

    const isOwner = membershipRole === 'owner';
    const isAdmin = membershipRole === 'admin' || isOwner;
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

    // Listen to org members
    useEffect(() => {
        if (!activeOrgId || (!isAdmin && !isSuperAdmin)) {
            setLoading(false);
            return;
        }

        const membersRef = collection(db, 'orgs', activeOrgId, 'members');

        const pendingUnsub = onSnapshot(
            query(membersRef, where('status', '==', 'pending')),
            (snap) => {
                const items: OrgMembership[] = [];
                snap.forEach(d => items.push({ uid: d.id, ...d.data() } as OrgMembership));
                setPendingMembers(items);
                setLoading(false);
            }
        );

        const approvedUnsub = onSnapshot(
            query(membersRef, where('status', '==', 'approved')),
            (snap) => {
                const items: OrgMembership[] = [];
                snap.forEach(d => items.push({ uid: d.id, ...d.data() } as OrgMembership));
                setApprovedMembers(items);
                setOrgStats(prev => ({ ...prev, teacherCount: items.length }));
            }
        );

        // Fetch Org Stats (Schools count)
        const schoolsRef = collection(db, 'orgs', activeOrgId, 'schools');
        const schedulesRef = collection(db, 'orgs', activeOrgId, 'schedules');
        const lessonsRef = collection(db, 'orgs', activeOrgId, 'lessons');

        let schoolDocs = new Set<string>();
        let scheduleSchools = new Set<string>();
        let lessonSchools = new Set<string>();

        const updateTotalSchools = () => {
            const combined = new Set([
                ...Array.from(schoolDocs),
                ...Array.from(scheduleSchools),
                ...Array.from(lessonSchools)
            ]);
            setOrgStats(prev => ({ ...prev, schoolCount: combined.size }));
        };

        const schoolsUnsub = onSnapshot(schoolsRef, (snap) => {
            const names = new Set<string>();
            snap.forEach(d => names.add(d.id));
            schoolDocs = names;
            updateTotalSchools();
        });

        const schedulesUnsub = onSnapshot(schedulesRef, (snap) => {
            const names = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                if (data.school) names.add(data.school);
            });
            scheduleSchools = names;
            updateTotalSchools();
        });

        const lessonsUnsub = onSnapshot(lessonsRef, (snap) => {
            const names = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                if (data.school) names.add(data.school);
            });
            lessonSchools = names;
            updateTotalSchools();
        });

        return () => {
            pendingUnsub();
            approvedUnsub();
            schoolsUnsub();
            schedulesUnsub();
            lessonsUnsub();
        };
    }, [activeOrgId, isAdmin, isSuperAdmin]);

    const handleApprove = async (targetUid: string) => {
        if (!activeOrgId || !user) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'orgs', activeOrgId, 'members', targetUid), {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: user.uid,
                updatedAt: serverTimestamp(),
            });
            batch.update(doc(db, 'users', targetUid, 'orgMemberships', activeOrgId), {
                status: 'approved',
                updatedAt: serverTimestamp(),
            });
            await batch.commit();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to approve');
        }
    };

    const handleReject = async (targetUid: string) => {
        if (!activeOrgId || !user) return;
        Alert.alert('Reject Request', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject', style: 'destructive', onPress: async () => {
                    try {
                        const batch = writeBatch(db);
                        batch.update(doc(db, 'orgs', activeOrgId, 'members', targetUid), {
                            status: 'rejected',
                            updatedAt: serverTimestamp(),
                        });
                        batch.update(doc(db, 'users', targetUid, 'orgMemberships', activeOrgId), {
                            status: 'rejected',
                            updatedAt: serverTimestamp(),
                        });
                        await batch.commit();
                    } catch (e: any) {
                        Alert.alert('Error', e.message || 'Failed to reject');
                    }
                }
            },
        ]);
    };

    const handleChangeRole = async (targetUid: string, newRole: 'admin' | 'teacher') => {
        if (!activeOrgId || !isOwner) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'orgs', activeOrgId, 'members', targetUid), {
                role: newRole,
                updatedAt: serverTimestamp(),
            });
            batch.update(doc(db, 'users', targetUid, 'orgMemberships', activeOrgId), {
                role: newRole,
                updatedAt: serverTimestamp(),
            });
            await batch.commit();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to change role');
        }
    };

    const roleLabel = (role: string) => {
        switch (role) {
            case 'owner': return '👑 Owner';
            case 'admin': return '🛡️ Admin';
            case 'teacher': return '👩‍🏫 Teacher';
            default: return role;
        }
    };

    const renderPendingItem = ({ item }: { item: OrgMembership }) => (
        <View style={[
            styles.memberCard,
            {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.medium,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                shadowRadius: 4,
                elevation: theme === 'light' ? 1 : 2,
            }
        ]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: fonts.bold }]}>{item.displayName || item.email || item.uid}</Text>
                <Text style={[styles.memberEmail, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{item.email}</Text>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.approveBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleApprove(item.uid)}
                >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.rejectBtn, { backgroundColor: colors.danger }]}
                    onPress={() => handleReject(item.uid)}
                >
                    <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderApprovedItem = ({ item }: { item: OrgMembership }) => (
        <View style={[
            styles.memberCard,
            {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.medium,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                shadowRadius: 4,
                elevation: theme === 'light' ? 1 : 2,
            }
        ]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: fonts.bold }]}>{item.displayName || item.email || item.uid}</Text>
                <View style={styles.roleContainer}>
                    <Text style={[styles.memberRole, { color: colors.accentPrimary, fontFamily: fonts.regular }]}>{roleLabel(item.role)}</Text>
                    {item.uid === user?.uid && <Text style={[styles.youBadge, { backgroundColor: colors.accentPrimary + '15', color: colors.accentPrimary }]}>YOU</Text>}
                </View>
            </View>
            <View style={styles.actionRow}>
                {isOwner && item.uid !== user?.uid && item.role !== 'owner' && (
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.roleBtn, { borderColor: colors.accentPrimary, borderRadius: radius.small }]}
                        onPress={() => handleChangeRole(item.uid, item.role === 'admin' ? 'teacher' : 'admin')}
                    >
                        <Text style={[styles.roleBtnText, { color: colors.accentPrimary }]}>
                            {item.role === 'admin' ? 'Demote' : 'Promote'}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.detailsBtn, { backgroundColor: colors.accentPrimary, borderRadius: radius.small }]}
                    onPress={() => router.push(`/admin/teacher/${item.uid}`)}
                >
                    <Ionicons name="eye-outline" size={16} color="#fff" />
                    <Text style={styles.detailsBtnText}>Details</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}><ActivityIndicator size="large" color={colors.accentPrimary} /></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <FlatList
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={
                    <>
                        {!activeOrgId && (
                            <View style={[
                                styles.emptyState,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.borderSubtle,
                                    borderRadius: radius.large,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                                    shadowRadius: 12,
                                    elevation: theme === 'light' ? 2 : 4,
                                }
                            ]}>
                                <Ionicons name="business-outline" size={48} color={colors.textSecondary} />
                                <Text style={[styles.emptyStateTitle, { color: colors.textPrimary, fontFamily: fonts.bold }]}>No Active Organization</Text>
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                                    {isSuperAdmin
                                        ? "You aren't managing a specific organization yet. Use the controls below to create one or join an existing one."
                                        : "You aren't a member of any organization. Contact your administrator for a join code."}
                                </Text>
                            </View>
                        )}

                        {/* Org Overview Stats & Member Lists */}
                        {activeOrgId && (
                            <>
                                <View style={styles.statsRow}>
                                    <View style={[
                                        styles.statCard,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.borderSubtle,
                                            borderRadius: radius.large,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                                            shadowRadius: 12,
                                            elevation: theme === 'light' ? 2 : 4,
                                        }
                                    ]}>
                                        <Text style={[styles.statValue, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{orgStats.teacherCount}</Text>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('admin.activeTeachers')}</Text>
                                    </View>
                                    <View style={[
                                        styles.statCard,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.borderSubtle,
                                            borderRadius: radius.large,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                                            shadowRadius: 12,
                                            elevation: theme === 'light' ? 2 : 4,
                                        }
                                    ]}>
                                        <Text style={[styles.statValue, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{orgStats.schoolCount}</Text>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('admin.stats.activeSchools')}</Text>
                                    </View>
                                </View>

                                {/* Pending Requests */}
                                {pendingMembers.length > 0 && (
                                    <>
                                        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.bold }]}>
                                            {t('admin.teacherRequests')} ({pendingMembers.length})
                                        </Text>
                                        {pendingMembers.map(item => (
                                            <View key={item.uid}>{renderPendingItem({ item })}</View>
                                        ))}
                                    </>
                                )}

                                {/* Org Members */}
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 24, fontFamily: fonts.bold }]}>
                                    {t('admin.manageTeachers')} ({approvedMembers.length})
                                </Text>
                                {approvedMembers.map(item => (
                                    <View key={item.uid}>{renderApprovedItem({ item })}</View>
                                ))}

                                <View style={[
                                    styles.orgIdSection,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.accentPrimary + '30',
                                        borderRadius: radius.large,
                                        marginTop: 32,
                                        shadowColor: colors.accentPrimary,
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 2,
                                    }
                                ]}>
                                    <Text style={[styles.orgIdLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('admin.orgJoinId')}</Text>
                                    <Text style={[styles.orgIdText, { color: colors.accentPrimary, fontFamily: fonts.bold }]} selectable>{activeOrgId}</Text>
                                </View>
                            </>
                        )}
                    </>
                }
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingTop: 50, borderBottomWidth: 1 },
    headerTitle: { fontSize: 24, fontWeight: '700' },
    orgName: { fontSize: 14, marginTop: 4 },
    list: { padding: 16, paddingTop: 8, paddingBottom: 32 },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
    emptyText: { fontSize: 14, marginBottom: 16, fontStyle: 'italic' },
    memberCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8,
    },
    memberName: { fontSize: 15, fontWeight: '600' },
    memberEmail: { fontSize: 13, marginTop: 2 },
    memberRole: { fontSize: 13, marginTop: 2, fontWeight: '500' },
    actionRow: { flexDirection: 'row', gap: 8 },
    approveBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    rejectBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    roleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginRight: 8 },
    roleBtnText: { fontSize: 13, fontWeight: '600' },
    detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    detailsBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    roleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    youBadge: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    orgIdSection: {
        marginTop: 24, padding: 16, borderRadius: 10, borderWidth: 1, alignItems: 'center',
    },
    orgIdLabel: { fontSize: 13, marginBottom: 6 },
    orgIdText: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
    summaryContainer: { marginBottom: 20 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold' },
    statLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
    emptyState: {
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
