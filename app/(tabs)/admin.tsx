import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { OrgMembership } from '../../src/types';

export default function AdminScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { activeOrgId, activeOrg, membershipRole } = useOrg();

    const [pendingMembers, setPendingMembers] = useState<OrgMembership[]>([]);
    const [approvedMembers, setApprovedMembers] = useState<OrgMembership[]>([]);
    const [orgStats, setOrgStats] = useState({ totalHours: 0, teacherCount: 0 });
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

        // Fetch Org Stats (Lessons this month)
        const startOfMo = new Date();
        startOfMo.setDate(1);
        startOfMo.setHours(0, 0, 0, 0);

        const lessonsRef = collection(db, 'orgs', activeOrgId, 'lessons');
        const statsUnsub = onSnapshot(
            query(lessonsRef, where('createdAt', '>=', startOfMo.getTime())),
            (snap) => {
                let hours = 0;
                snap.forEach(d => {
                    const data = d.data();
                    if (data.status === 'present') hours += (data.hours || 0);
                });
                setOrgStats(prev => ({ ...prev, totalHours: hours }));
            }
        );

        return () => {
            pendingUnsub();
            approvedUnsub();
            statsUnsub();
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
        <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.text }]}>{item.displayName || item.email || item.uid}</Text>
                <Text style={[styles.memberEmail, { color: colors.secondaryText }]}>{item.email}</Text>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#34C759' }]} onPress={() => handleApprove(item.uid)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: '#FF3B30' }]} onPress={() => handleReject(item.uid)}>
                    <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderApprovedItem = ({ item }: { item: OrgMembership }) => (
        <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.text }]}>{item.displayName || item.email || item.uid}</Text>
                <View style={styles.roleContainer}>
                    <Text style={[styles.memberRole, { color: colors.primary }]}>{roleLabel(item.role)}</Text>
                    {item.uid === user?.uid && <Text style={[styles.youBadge, { backgroundColor: colors.primary + '20', color: colors.primary }]}>YOU</Text>}
                </View>
            </View>
            <View style={styles.actionRow}>
                {isOwner && item.uid !== user?.uid && item.role !== 'owner' && (
                    <TouchableOpacity
                        style={[styles.roleBtn, { borderColor: colors.primary }]}
                        onPress={() => handleChangeRole(item.uid, item.role === 'admin' ? 'teacher' : 'admin')}
                    >
                        <Text style={[styles.roleBtnText, { color: colors.primary }]}>
                            {item.role === 'admin' ? 'Demote' : 'Promote'}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.detailsBtn, { backgroundColor: colors.primary }]}
                    onPress={() => router.push(`/admin/teacher/${item.uid}`)}
                >
                    <Ionicons name="eye-outline" size={16} color="#fff" />
                    <Text style={styles.detailsBtnText}>Details</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator size="large" /></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>

            <FlatList
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={
                    <>
                        {!activeOrgId && (
                            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="business-outline" size={48} color={colors.secondaryText} />
                                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Active Organization</Text>
                                <Text style={[styles.emptyStateText, { color: colors.secondaryText }]}>
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
                                    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <Text style={[styles.statValue, { color: colors.primary }]}>{orgStats.teacherCount}</Text>
                                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Teachers</Text>
                                    </View>
                                    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <Text style={[styles.statValue, { color: colors.primary }]}>{orgStats.totalHours.toFixed(1)}h</Text>
                                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Hours (Month)</Text>
                                    </View>
                                </View>

                                {/* Pending Requests */}
                                {pendingMembers.length > 0 && (
                                    <>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                            Pending Requests ({pendingMembers.length})
                                        </Text>
                                        {pendingMembers.map(item => (
                                            <View key={item.uid}>{renderPendingItem({ item })}</View>
                                        ))}
                                    </>
                                )}

                                {/* Org Members */}
                                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
                                    Organization Members ({approvedMembers.length})
                                </Text>
                                {approvedMembers.map(item => (
                                    <View key={item.uid}>{renderApprovedItem({ item })}</View>
                                ))}

                                <View style={[styles.orgIdSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 32 }]}>
                                    <Text style={[styles.orgIdLabel, { color: colors.secondaryText }]}>Organization Join ID (Share with teachers)</Text>
                                    <Text style={[styles.orgIdText, { color: colors.primary }]} selectable>{activeOrgId}</Text>
                                </View>
                            </>
                        )}

                        {/* Super Admin Actions */}
                        {isSuperAdmin && (
                            <View style={[styles.superAdminSection, { backgroundColor: colors.card, borderColor: colors.primary + '40', marginTop: 24 }]}>
                                <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>Super Admin Controls</Text>
                                <TouchableOpacity
                                    style={[styles.createOrgBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => router.push('/create-org' as any)}
                                >
                                    <Ionicons name="business-outline" size={20} color="#fff" />
                                    <Text style={styles.createOrgBtnText}>Create New Organization</Text>
                                </TouchableOpacity>
                            </View>
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
    statLabel: { fontSize: 12, marginTop: 4, textTransform: 'uppercase', fontWeight: '600' },
    superAdminSection: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
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
    createOrgBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 10,
        gap: 10,
    },
    createOrgBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
