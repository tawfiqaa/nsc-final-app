import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';

export default function AwaitingApprovalScreen() {
    const { logout } = useAuth();
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <ThemeToggle />
            </View>

            <View style={styles.content}>
                <Ionicons name="hourglass-outline" size={80} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>Awaiting Approval</Text>
                <Text style={[styles.message, { color: colors.secondaryText }]}>
                    Your account has been created and is pending approval from an administrator.
                    Please check back later or contact your admin.
                </Text>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={logout}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        alignItems: 'flex-end',
        marginTop: 40,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        borderWidth: 1,
    },
    buttonText: {
        fontWeight: '600',
        fontSize: 16,
    },
});
