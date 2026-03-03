import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db, functions } from '../../src/lib/firebase';

interface Organization {
    id: string;
    name: string;
    description?: string;
}

export default function OrgManagementScreen() {
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'orgs'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orgsList: Organization[] = [];
            snapshot.forEach((doc) => {
                orgsList.push({ id: doc.id, ...doc.data() } as Organization);
            });
            setOrgs(orgsList.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDeleteOrg = async () => {
        if (!deletingOrg) return;

        const expectedText = `DELETE ${deletingOrg.name.toUpperCase()}`;
        if (confirmText !== expectedText) {
            Alert.alert(t('common.error'), `Please type: ${expectedText}`);
            return;
        }

        setIsDeleting(true);
        try {
            const deleteOrgFn = httpsCallable(functions, 'deleteOrganization');
            await deleteOrgFn({ orgId: deletingOrg.id });
            Alert.alert(t('common.success'), `Organization "${deletingOrg.name}" has been deleted.`);
            setDeletingOrg(null);
            setConfirmText('');
        } catch (error: any) {
            console.error('Delete Org error:', error);
            Alert.alert(t('common.error'), error.message || 'Failed to delete organization.');
        } finally {
            setIsDeleting(false);
        }
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };

    const renderOrgItem = ({ item }: { item: Organization }) => (
        <View style={[styles.orgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.orgName, boldStyle]}>{item.name}</Text>
                <Text style={[styles.orgId, { color: colors.secondaryText }]}>ID: {item.id}</Text>
            </View>
            <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.error + '15' }]}
                onPress={() => setDeletingOrg(item)}
            >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={orgs}
                keyExtractor={(item) => item.id}
                renderItem={renderOrgItem}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <Text style={[styles.header, boldStyle]}>Organization Management</Text>
                }
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.secondaryText }]}>No organizations found.</Text>
                }
            />

            {/* Delete Confirmation Modal */}
            <Modal
                visible={!!deletingOrg}
                transparent
                animationType="fade"
                onRequestClose={() => setDeletingOrg(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>Delete Organization?</Text>
                        <Text style={[styles.modalDesc, textStyle]}>
                            This will permanently delete <Text style={{ color: colors.error, fontWeight: 'bold' }}>{deletingOrg?.name}</Text> and ALL its associated data (schools, lessons, memberships, etc).
                        </Text>

                        <Text style={[styles.confirmPrompt, { color: colors.secondaryText }]}>
                            Type <Text style={{ fontWeight: 'bold' }}>{`DELETE ${deletingOrg?.name.toUpperCase()}`}</Text> to confirm:
                        </Text>

                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            value={confirmText}
                            onChangeText={setConfirmText}
                            autoCapitalize="characters"
                            placeholder="Type confirmation here"
                            placeholderTextColor={colors.secondaryText}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => { setDeletingOrg(null); setConfirmText(''); }}
                                disabled={isDeleting}
                            >
                                <Text style={textStyle}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalBtn,
                                    { backgroundColor: colors.error },
                                    (confirmText !== `DELETE ${deletingOrg?.name.toUpperCase()}` || isDeleting) && { opacity: 0.5 }
                                ]}
                                onPress={handleDeleteOrg}
                                disabled={confirmText !== `DELETE ${deletingOrg?.name.toUpperCase()}` || isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete Permanently</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 20 },
    header: { fontSize: 24, marginBottom: 20 },
    orgCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    orgName: { fontSize: 18 },
    orgId: { fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
    deleteBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    empty: { textAlign: 'center', marginTop: 40 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        elevation: 5,
    },
    modalTitle: { fontSize: 20, marginBottom: 12, color: '#ff4444' },
    modalDesc: { fontSize: 16, marginBottom: 20, lineHeight: 22 },
    confirmPrompt: { fontSize: 14, marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    modalBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
});
