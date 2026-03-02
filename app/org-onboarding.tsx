import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function OrgOnboardingScreen() {
    const { colors } = useTheme();
    const { user, logout } = useAuth();
    const router = useRouter();

    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="business-outline" size={48} color={colors.primary} />
                </View>

                <Text style={[styles.title, { color: colors.text }]}>Welcome to TeacherTracker</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    {isSuperAdmin
                        ? 'Create a new organization or join an existing one with an invite code.'
                        : 'Join an organization using the invite code provided by your admin.'}
                </Text>

                {isSuperAdmin && (
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/create-org' as any)}
                    >
                        <Ionicons name="add-circle-outline" size={22} color="#fff" />
                        <Text style={styles.primaryBtnText}>Create Organization</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                    onPress={() => router.push('/join-org' as any)}
                >
                    <Ionicons name="enter-outline" size={22} color={colors.primary} />
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Join with Org ID</Text>
                </TouchableOpacity>

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
    title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12,
        width: '100%', justifyContent: 'center', marginBottom: 14,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    secondaryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12,
        width: '100%', justifyContent: 'center', borderWidth: 2,
    },
    secondaryBtnText: { fontSize: 16, fontWeight: '600' },
    logoutBtn: { marginTop: 32, padding: 12 },
    logoutText: { fontSize: 14 },
});
