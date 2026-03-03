import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const { user, login, register, loginWithGoogle } = useAuth();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const [isLoading, setIsLoading] = useState(false);

    // Google Sign In Hook
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: '907873961225-hminrogpgrunhgpbu4gnvso2qtcfv879.apps.googleusercontent.com',
        androidClientId: '907873961225-hminrogpgrunhgpbu4gnvso2qtcfv879.apps.googleusercontent.com', // Use Web Client ID for proxy auth
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            if (id_token) {
                setIsLoading(true);
                loginWithGoogle(id_token)
                    .catch(e => {
                        Alert.alert(t('auth.googleSignInFailed'), e.message);
                    })
                    .finally(() => setIsLoading(false));
            }
        }
    }, [response, loginWithGoogle, t]);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert(t('common.error'), t('auth.errorEmptyFields'));
            return;
        }

        if (isRegistering && !name) {
            Alert.alert(t('common.error'), t('auth.errorEmptyName'));
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
            Alert.alert(t('auth.authFailed'), e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={[styles.title, boldStyle]}>{t('common.teacherTracker')}</Text>
                    <ThemeToggle />
                </View>

                <View style={[
                    styles.card,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        borderWidth: 1,
                        borderRadius: radius.large,
                        shadowColor: '#000',
                        shadowOpacity: theme === 'light' ? 0.05 : 0.2,
                        shadowRadius: 15,
                        elevation: 5
                    }
                ]}>
                    <Text style={[styles.subtitle, boldStyle, { color: colors.accentPrimary }]}>
                        {isRegistering ? t('auth.createAccount') : t('auth.welcomeBack')}
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, secondaryStyle]}>{t('auth.email')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.backgroundPrimary,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.medium
                                }
                            ]}
                            placeholder="email@example.com"
                            placeholderTextColor={colors.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, secondaryStyle]}>{t('auth.password')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.backgroundPrimary,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.medium
                                }
                            ]}
                            placeholder="********"
                            placeholderTextColor={colors.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {isRegistering && (
                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, secondaryStyle]}>{t('auth.fullName')}</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: colors.textPrimary,
                                        borderColor: colors.borderSubtle,
                                        backgroundColor: colors.backgroundPrimary,
                                        fontFamily: fonts.regular,
                                        borderRadius: radius.medium
                                    }
                                ]}
                                placeholder={t('auth.fullName')}
                                placeholderTextColor={colors.textSecondary}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.button, { backgroundColor: colors.accentPrimary, borderRadius: radius.large }]}
                        onPress={handleAuth}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={[styles.buttonText, { fontFamily: fonts.bold }]}>{isRegistering ? t('auth.signUp') : t('auth.login')}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[
                            styles.googleButton,
                            {
                                borderColor: colors.borderSubtle,
                                backgroundColor: colors.surface,
                                borderRadius: radius.large
                            }
                        ]}
                        onPress={() => promptAsync()}
                        disabled={!request || isLoading}
                    >
                        <Text style={[styles.googleButtonText, boldStyle, { color: colors.textPrimary }]}>
                            {t('auth.signInGoogle')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchContainer}>
                        <Text style={[styles.switchText, secondaryStyle]}>
                            {isRegistering ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
                            <Text style={{ color: colors.accentSecondary, fontFamily: fonts.bold }}>
                                {isRegistering ? ` ${t('auth.login')}` : ` ${t('auth.signUp')}`}
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
