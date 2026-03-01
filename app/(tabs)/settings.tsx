import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { handleExportProcess } from '../../src/utils/exportExcel';

export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const { schedules, logs } = useLesson();
    const { colors } = useTheme();
    const router = useRouter();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(user?.name || '');
    const [exportDate, setExportDate] = useState(new Date());
    const [exporting, setExporting] = useState(false);

    const handleExportReport = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            await handleExportProcess({
                user,
                logs,
                schedules,
                month: exportDate.getMonth(),
                year: exportDate.getFullYear()
            });
        } catch (e: any) {
            Alert.alert("Export Error", e.message);
        } finally {
            setExporting(false);
        }
    };

    const changeMonth = (delta: number) => {
        setExportDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + delta);
            return d;
        });
    };

    const saveName = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), { name: tempName });
            setEditingName(false);
            Alert.alert("Success", "Name updated successfully");
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", "Could not update name");
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Account</Text>

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
                        {editingName ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                    value={tempName}
                                    onChangeText={setTempName}
                                />
                                <TouchableOpacity onPress={saveName} style={{ marginLeft: 8 }}>
                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingName(false)} style={{ marginLeft: 8 }}>
                                    <Ionicons name="close-circle" size={24} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.value, { color: colors.secondaryText, marginRight: 8 }]}>{user?.name || 'N/A'}</Text>
                                <TouchableOpacity onPress={() => { setTempName(user?.name || ''); setEditingName(true); }}>
                                    <Ionicons name="pencil" size={16} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>Email</Text>
                        <Text style={[styles.value, { color: colors.secondaryText }]}>{user?.email}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>Role</Text>
                        <Text style={[styles.value, { color: colors.primary }]}>{user?.role?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>User ID</Text>
                        <Text style={[styles.value, { color: colors.secondaryText, fontSize: 10 }]}>{user?.uid}</Text>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Reports</Text>

                    {/* Month Picker */}
                    <View style={[styles.row, { justifyContent: 'center', marginBottom: 24 }]}>
                        <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 8 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginHorizontal: 16 }}>
                            {format(exportDate, 'MMMM yyyy')}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 8 }}>
                            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.row, { marginBottom: 0, justifyContent: 'center' }]}
                        onPress={handleExportReport}
                        disabled={exporting}
                    >
                        {exporting ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                <Text style={[styles.label, { color: colors.primary, fontWeight: 'bold' }]}>Quick Monthly Export</Text>
                                <Ionicons name="download-outline" size={24} color={colors.primary} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Preferences</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>Theme</Text>
                        <ThemeToggle />
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>App Info</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text }]}>Version</Text>
                        <Text style={[styles.value, { color: colors.secondaryText }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: colors.error }]}
                    onPress={logout}
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={[styles.logoutText, { color: colors.error }]}>Log Out</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingTop: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 24,
    },
    section: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
    value: {
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 24,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 4,
        paddingHorizontal: 8,
        width: 150,
        marginRight: 8,
    },
});
