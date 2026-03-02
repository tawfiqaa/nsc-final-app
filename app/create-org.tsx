import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function CreateOrgScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { createOrg, membershipRole } = useOrg();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    React.useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    const [orgName, setOrgName] = useState('');
    const [saving, setSaving] = useState(false);
    const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

    if (isRestrictedAdmin) return null;

    const handleCreate = async () => {
        const name = orgName.trim();
        if (!name) {
            Alert.alert('Error', 'Please enter an organization name.');
            return;
        }
        if (name.length < 2) {
            Alert.alert('Error', 'Organization name must be at least 2 characters.');
            return;
        }

        setSaving(true);
        try {
            const orgId = await createOrg(name);
            setCreatedOrgId(orgId);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to create organization.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyCode = () => {
        if (createdOrgId) {
            if (Platform.OS === 'web') {
                navigator.clipboard?.writeText(createdOrgId);
            } else {
                Clipboard.setString(createdOrgId);
            }
            Alert.alert('Copied!', 'Organization ID copied to clipboard. Share it with your team.');
        }
    };

    if (createdOrgId) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.content}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>Organization Created!</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                        Share this ID with your team so they can join:
                    </Text>

                    <TouchableOpacity
                        style={[styles.codeBox, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={handleCopyCode}
                    >
                        <Text style={[styles.codeText, { color: colors.primary }]} selectable>{createdOrgId}</Text>
                        <Ionicons name="copy-outline" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text style={styles.primaryBtnText}>Continue to App</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>Create Organization</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    You'll be the owner and can invite others to join.
                </Text>

                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    placeholder="Organization Name"
                    placeholderTextColor={colors.secondaryText}
                    value={orgName}
                    onChangeText={setOrgName}
                    autoFocus
                    editable={!saving}
                />

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
                    onPress={handleCreate}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryBtnText}>Create</Text>
                    )}
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
    input: { width: '100%', height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, fontSize: 16, marginBottom: 16 },
    codeBox: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 16, borderRadius: 10, borderWidth: 1,
        width: '100%', justifyContent: 'center', marginBottom: 24,
    },
    codeText: { fontSize: 14, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    primaryBtn: {
        paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12,
        width: '100%', alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
