import { Ionicons } from '@expo/vector-icons';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { Announcement } from '../../src/types';

// ─── Date helper ─────────────────────────────────────────────────────────────
function formatDate(ts: any): string {
    if (!ts) return '';
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function AnnouncementCard({ item, colors, fonts, theme, canManage, onDelete }: {
    item: Announcement; colors: any; fonts: any; theme: string; canManage: boolean; onDelete: (id: string, title: string) => void;
}) {
    return (
        <View style={[
            cardStyles.card,
            {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                shadowColor: '#000',
                shadowOpacity: theme === 'light' ? 0.05 : 0.12,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 8,
                elevation: theme === 'light' ? 2 : 4,
            }
        ]}>
            <View style={cardStyles.header}>
                <View style={[cardStyles.dot, { backgroundColor: colors.accentPrimary }]} />
                <View style={{ flex: 1 }}>
                    <Text style={[cardStyles.title, { color: colors.textPrimary, fontFamily: fonts.bold }]} numberOfLines={2}>
                        {item.title}
                    </Text>
                </View>
                {canManage && (
                    <TouchableOpacity
                        onPress={() => onDelete(item.id, item.title)}
                        style={{ padding: 4, marginLeft: 'auto' }}
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.error || '#ef4444'} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={[cardStyles.content, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {item.content}
            </Text>
            <View style={[cardStyles.footer, { borderTopColor: colors.borderSubtle }]}>
                <Text style={[cardStyles.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {item.authorName}
                </Text>
                <Text style={[cardStyles.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {formatDate(item.createdAt)}
                </Text>
            </View>
        </View>
    );
}

const cardStyles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        paddingBottom: 10,
        gap: 10,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        flexShrink: 0,
    },
    title: {
        fontSize: 16,
        flex: 1,
        lineHeight: 22,
    },
    content: {
        fontSize: 14,
        lineHeight: 20,
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    meta: {
        fontSize: 12,
    },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AnnouncementsScreen() {
    const { colors, fonts, tokens, theme } = useTheme();
    const { activeOrgId, membershipRole } = useOrg();
    const { user } = useAuth();

    // Auth logic
    const isOwner = membershipRole === 'owner';
    const isAdmin = membershipRole === 'admin' || isOwner;
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const canManage = isAdmin || isSuperAdmin;

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annSaving, setAnnSaving] = useState(false);

    useEffect(() => {
        if (!activeOrgId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'orgs', activeOrgId, 'announcements'),
            orderBy('createdAt', 'desc'),
            limit(20),
        );

        const unsub = onSnapshot(q, (snap) => {
            const items: Announcement[] = snap.docs.map(d => ({
                id: d.id,
                ...(d.data() as Omit<Announcement, 'id'>),
            }));
            setAnnouncements(items);
            setLoading(false);
        }, () => setLoading(false));

        return unsub;
    }, [activeOrgId]);

    const handleCreateAnnouncement = async () => {
        if (!activeOrgId || !user) return;
        if (!annTitle.trim() || !annContent.trim()) {
            Alert.alert('Incomplete', 'Please fill in both title and content.');
            return;
        }

        setAnnSaving(true);
        try {
            const authorName = user.displayName || user.email?.split('@')[0] || 'Admin';
            await addDoc(collection(db, 'orgs', activeOrgId, 'announcements'), {
                title: annTitle.trim(),
                content: annContent.trim(),
                authorName,
                createdAt: serverTimestamp(),
            });
            setShowModal(false);
            setAnnTitle('');
            setAnnContent('');
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to post announcement.');
        } finally {
            setAnnSaving(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        const deleteAction = async () => {
            if (!activeOrgId) return;
            try {
                await deleteDoc(doc(db, 'orgs', activeOrgId, 'announcements', id));
            } catch (e: any) {
                if (Platform.OS === 'web') {
                    console.error('Failed to delete announcement:', e);
                    alert('Error: ' + (e.message || 'Failed to delete announcement.'));
                } else {
                    Alert.alert('Error', e.message || 'Failed to delete announcement.');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
                await deleteAction();
            }
        } else {
            Alert.alert(
                'Delete Announcement',
                `Are you sure you want to delete "${title}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: deleteAction }
                ]
            );
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.accentPrimary} />
            ) : (
                <FlatList
                    data={announcements}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <AnnouncementCard
                            item={item}
                            colors={colors}
                            fonts={fonts}
                            theme={theme}
                            canManage={canManage}
                            onDelete={handleDelete}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                                No announcements yet.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Fab for creating announcements */}
            {canManage && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
                    onPress={() => setShowModal(true)}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            )}

            {/* ── Create Announcement Modal ── */}
            <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
                <View style={[modalStyles.container, { backgroundColor: colors.backgroundPrimary }]}>
                    <View style={[modalStyles.header, { borderBottomColor: colors.borderSubtle }]}>
                        <TouchableOpacity onPress={() => setShowModal(false)}>
                            <Text style={{ color: colors.accentPrimary, fontFamily: fonts.regular, fontSize: 16 }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[modalStyles.headerTitle, { color: colors.textPrimary, fontFamily: fonts.bold }]}>New Announcement</Text>
                        <TouchableOpacity onPress={handleCreateAnnouncement} disabled={annSaving}>
                            {annSaving
                                ? <ActivityIndicator size="small" color={colors.accentPrimary} />
                                : <Text style={{ color: colors.accentPrimary, fontFamily: fonts.bold, fontSize: 16 }}>Post</Text>
                            }
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={modalStyles.body}>
                        <Text style={[modalStyles.label, { color: colors.textSecondary, fontFamily: fonts.bold }]}>TITLE</Text>
                        <TextInput
                            style={[modalStyles.input, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surface, fontFamily: fonts.regular }]}
                            placeholder="e.g. School holiday next week"
                            placeholderTextColor={colors.textSecondary}
                            value={annTitle}
                            onChangeText={setAnnTitle}
                            maxLength={120}
                        />
                        <Text style={[modalStyles.label, { color: colors.textSecondary, fontFamily: fonts.bold, marginTop: 20 }]}>CONTENT</Text>
                        <TextInput
                            style={[modalStyles.input, modalStyles.contentInput, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surface, fontFamily: fonts.regular }]}
                            placeholder="Write your announcement here..."
                            placeholderTextColor={colors.textSecondary}
                            value={annContent}
                            onChangeText={setAnnContent}
                            multiline
                            textAlignVertical="top"
                        />
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 16, paddingBottom: 100 },
    empty: { alignItems: 'center', marginTop: 80, gap: 12 },
    emptyText: { fontSize: 15 },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 6,
    },
});

const modalStyles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 18 },
    body: { padding: 20, paddingBottom: 40 },
    label: { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        minHeight: 54,
    },
    contentInput: {
        height: 180,
    },
});
