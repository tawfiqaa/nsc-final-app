import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { exportToExcel, generateMonthlyReportData } from '../../src/utils/export';

export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const { schedules, logs } = useLesson();
    const { colors } = useTheme();

    const handleExportReport = async () => {
        try {
            if (!user) return;
            const data = generateMonthlyReportData(user, logs, schedules);
            const fileName = `${(user.name || 'my').replace(/\s+/g, '_')}_Monthly_Report.xlsx`;
            await exportToExcel(data, fileName);
        } catch (e: any) {
            Alert.alert("Export Failed", "Could not generate report");
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
                        <Text style={[styles.value, { color: colors.secondaryText }]}>{user?.name || 'N/A'}</Text>
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
                    <TouchableOpacity
                        style={[styles.row, { marginBottom: 0 }]}
                        onPress={handleExportReport}
                    >
                        <Text style={[styles.label, { color: colors.text }]}>Export Monthly Report</Text>
                        <Ionicons name="download-outline" size={24} color={colors.primary} />
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
});
