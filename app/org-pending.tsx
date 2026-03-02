import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function OrgPendingScreen() {
    const { colors } = useTheme();
    const { user, logout } = useAuth();
    const { activeOrg, membershipStatus, userOrgs, switchOrg } = useOrg();
    const router = useRouter();
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

    const isRejected = membershipStatus === 'rejected';
    const approvedOrgs = userOrgs.filter(o => o.status === 'approved');

    const handleSwitchOrg = async (orgId: string) => {
        try {
            await switchOrg(orgId);
        } catch (e: any) {
            console.error('Switch failed:', e);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: isRejected ? colors.error + '15' : colors.primary + '15' }]}>
                    <Ionicons
                        name={isRejected ? 'close-circle-outline' : 'hourglass-outline'}
                        size={48}
                        color={isRejected ? colors.error : colors.primary}
                    />
                </View>

                <Text style={[styles.title, { color: colors.text }]}>
                    {isRejected ? 'Request Rejected' : 'Awaiting Approval'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    {isRejected
                        ? `Your request to join "${activeOrg?.name || 'the organization'}" was rejected. Contact the admin or try another org.`
                        : `Your request to join "${activeOrg?.name || 'the organization'}" is pending. An admin will approve it soon.`
                    }
                </Text>

                {approvedOrgs.length > 0 && (
                    <View style={styles.switchSection}>
                        <Text style={[styles.switchLabel, { color: colors.secondaryText }]}>Switch to an approved org:</Text>
                        {approvedOrgs.map(org => (
                            <TouchableOpacity
                                key={org.orgId}
                                style={[styles.orgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => handleSwitchOrg(org.orgId)}
                            >
                                <Text style={[styles.orgBtnText, { color: colors.text }]}>{org.orgName || org.orgId}</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                    onPress={() => router.push('/join-org' as any)}
                >
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Join Another Org</Text>
                </TouchableOpacity>

                {isSuperAdmin && (
                    <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: colors.primary, marginTop: 8 }]}
                        onPress={() => router.push('/create-org' as any)}
                    >
                        <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Create New Org</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <Text style={[styles.logoutText, { color: colors.secondaryText }]}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { width: '100%', maxWidth: 400, paddingHorizontal: 32, alignItems: 'center' },
    iconCircle: {
        width: 96, height: 96, borderRadius: 48,
        justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    },
    title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    switchSection: { width: '100%', marginBottom: 20 },
    switchLabel: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
    orgBtn: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8,
    },
    orgBtnText: { fontSize: 15, fontWeight: '500' },
    secondaryBtn: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12,
        width: '100%', alignItems: 'center', borderWidth: 2,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },
    logoutBtn: { marginTop: 24, padding: 12 },
    logoutText: { fontSize: 14 },
});
