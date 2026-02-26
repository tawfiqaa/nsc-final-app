import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const { login, register, loginWithGoogle } = useAuth();
    const { colors } = useTheme();
    const [isLoading, setIsLoading] = useState(false);

    // Google Sign In Hook
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: '907873961225-hminrogpgrunhgpbu4gnvso2qtcfv879.apps.googleusercontent.com',
        androidClientId: '907873961225-hminrogpgrunhgpbu4gnvso2qtcfv879.apps.googleusercontent.com', // Use Web Client ID for proxy auth
    });

    useEffect(() => {
        if (request) {
            console.log("DEBUG: Google Auth Redirect URI:", request.redirectUri);
        }
    }, [request]);

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            if (id_token) {
                setIsLoading(true);
                loginWithGoogle(id_token)
                    .then(() => {
                        // Success handled by auth state change
                    })
                    .catch(e => {
                        Alert.alert("Google Sign In Failed", e.message);
                    })
                    .finally(() => setIsLoading(false));
            }
        }
    }, [response, loginWithGoogle]);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (isRegistering && !name) {
            Alert.alert('Error', 'Please enter your full name');
            return;
        }

        setIsLoading(true);
        try {
            if (isRegistering) {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (e: any) {
            Alert.alert('Authentication Failed', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text }]}>Teacher Tracker</Text>
                    <ThemeToggle />
                </View>

                <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
                    <Text style={[styles.subtitle, { color: colors.text }]}>
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Email</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            placeholder="email@example.com"
                            placeholderTextColor={colors.secondaryText}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Password</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            placeholder="********"
                            placeholderTextColor={colors.secondaryText}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {isRegistering && (
                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: colors.secondaryText }]}>Full Name</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                placeholder="Your Name"
                                placeholderTextColor={colors.secondaryText}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={handleAuth}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{isRegistering ? 'Sign Up' : 'Sign In'}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.googleButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                        onPress={() => promptAsync()}
                        disabled={!request || isLoading}
                    >
                        <Text style={[styles.googleButtonText, { color: colors.text }]}>
                            Sign in with Google
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchContainer}>
                        <Text style={[styles.switchText, { color: colors.secondaryText }]}>
                            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                                {isRegistering ? 'Sign In' : 'Sign Up'}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    card: {
        padding: 24,
        borderRadius: 16,
        elevation: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    subtitle: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 24,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    button: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
    switchText: {
        fontSize: 14,
    },
    googleButton: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
