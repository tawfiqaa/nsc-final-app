import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function JoinOrgScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { joinOrg, membershipRole } = useOrg();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    React.useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    const [orgCode, setOrgCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (isRestrictedAdmin) return null;

    const handleJoin = async () => {
        const code = orgCode.trim();
        if (!code) {
            Alert.alert('Error', 'Please enter an Organization ID.');
            return;
        }

        setSaving(true);
        try {
            await joinOrg(code);
            setSubmitted(true);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to join organization.');
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.content}>
                    <Text style={[styles.title, { color: colors.text }]}>Request Sent!</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                        Your join request has been submitted. An admin will review and approve it.
                        You'll get access once approved.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>Join Organization</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    Enter the Organization ID shared by your admin or team lead.
                </Text>

                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    placeholder="Organization ID"
                    placeholderTextColor={colors.secondaryText}
                    value={orgCode}
                    onChangeText={setOrgCode}
                    autoFocus
                    autoCapitalize="none"
                    editable={!saving}
                />

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
                    onPress={handleJoin}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryBtnText}>Join</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { width: '100%', maxWidth: 400, paddingHorizontal: 32, alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    input: { width: '100%', height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, fontSize: 16, marginBottom: 16 },
    primaryBtn: {
        paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12,
        width: '100%', alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
