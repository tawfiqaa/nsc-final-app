import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { User, UserRole } from '../../src/types';

export default function AdminScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!user) return;

        // Query users
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userList: User[] = [];
            snapshot.forEach((doc) => {
                userList.push(doc.data() as User);
            });
            setUsers(userList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleApprove = async (targetUid: string) => {
        try {
            await updateDoc(doc(db, 'users', targetUid), {
                role: 'teacher',
                isApproved: true,
                updatedAt: Date.now()
            });
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const handleChangeRole = async (targetUid: string) => {
        if (user?.role !== 'super_admin') return;

        Alert.alert(
            "Change Role",
            "Select new role:",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Make Admin", onPress: () => updateRole(targetUid, 'admin') },
                { text: "Make Teacher", onPress: () => updateRole(targetUid, 'teacher') },
                { text: "Make Pending", onPress: () => updateRole(targetUid, 'pending') },
            ]
        );
    };

    const updateRole = async (uid: string, newRole: UserRole) => {
        try {
            await updateDoc(doc(db, 'users', uid), {
                role: newRole,
                isApproved: newRole !== 'pending',
                updatedAt: Date.now()
            });
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        const isPending = item.role === 'pending';
        const isMe = item.uid === user?.uid;

        return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.userInfo}>
                    <Text style={[styles.email, { color: colors.text }]}>
                        {item.name || item.email}
                        {isMe && " (You)"}
                    </Text>
                    <View style={styles.badges}>
                        <View style={[styles.badge, { backgroundColor: isPending ? colors.error + '20' : colors.success + '20' }]}>
                            <Text style={{ color: isPending ? colors.error : colors.success, fontSize: 10, fontWeight: 'bold' }}>
                                {item.role.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actions}>
                    {isPending && (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={() => handleApprove(item.uid)}
                        >
                            <Text style={styles.buttonText}>Approve</Text>
                        </TouchableOpacity>
                    )}

                    {!isPending && !isMe && (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                            onPress={() => router.push({ pathname: '/admin/teacher/[uid]', params: { uid: item.uid } })}
                        >
                            <Text style={[styles.buttonText, { color: colors.text }]}>View</Text>
                        </TouchableOpacity>
                    )}

                    {user?.role === 'super_admin' && !isMe && (
                        <TouchableOpacity
                            style={[styles.iconButton]}
                            onPress={() => handleChangeRole(item.uid)}
                        >
                            <Ionicons name="ellipsis-vertical" size={20} color={colors.secondaryText} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.header, { color: colors.text }]}>User Administration</Text>

            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={item => item.uid}
                    renderItem={renderUser}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={{ color: colors.secondaryText }}>No users found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 20,
        marginBottom: 20,
    },
    list: {
        padding: 20,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
    },
    email: {
        fontSize: 14,
        fontWeight: '600',
    },
    badges: {
        flexDirection: 'row',
        marginTop: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    button: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
    },
    iconButton: {
        padding: 8,
    }
});
