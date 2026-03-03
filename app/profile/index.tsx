import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db, storage } from '../../src/lib/firebase';

export default function ProfileScreen() {
    const { user } = useAuth();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { t } = useTranslation();
    const router = useRouter();

    const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [contactEmail, setContactEmail] = useState(user?.contactEmail || '');
    const [dob, setDob] = useState<Date>(user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date(1990, 0, 1));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [emailError, setEmailError] = useState('');

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || user.name || '');
            setUsername(user.username || '');
            setPhone(user.phone || '');
            setContactEmail(user.contactEmail || '');
            if (user.dateOfBirth) {
                // Handle local date string correctly
                const [year, month, day] = user.dateOfBirth.split('-').map(Number);
                setDob(new Date(year, month - 1, day));
            }
            setPhotoURL(user.photoURL || '');
        }
    }, [user]);

    const validateEmail = (email: string) => {
        if (!email) {
            setEmailError('');
            return true;
        }
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(email)) {
            setEmailError(t('profile.invalidEmail'));
            return false;
        }
        setEmailError('');
        return true;
    };

    const handleSave = async () => {
        if (!user) return;
        if (!validateEmail(contactEmail)) return;

        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                displayName,
                name: displayName, // Keep legacy field in sync
                username,
                phone,
                contactEmail,
                dateOfBirth: dob.toISOString().split('T')[0], // YYYY-MM-DD
                photoURL,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            Alert.alert(t('common.success'), t('profile.saveSuccess'));
            router.back();
        } catch (error: any) {
            console.error('Error updating profile:', error);
            Alert.alert(t('common.error'), t('profile.saveError'));
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('gallery.permissionRequired'), t('gallery.permissionMsg'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5, // Compression
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        if (!user) return;
        setUploading(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const storageRef = ref(storage, `userAvatars/${user.uid}/avatar.jpg`);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            setPhotoURL(downloadURL);
        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert(t('common.error'), t('gallery.uploadError'));
        } finally {
            setUploading(false);
        }
    };

    if (!user) {
        return (
            <View style={[styles.container, { backgroundColor: colors.backgroundPrimary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.regular }}>{t('profile.pleaseSignIn')}</Text>
            </View>
        );
    }

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const labelStyle = { fontFamily: fonts.bold, color: colors.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
    const inputStyle = [
        styles.input,
        {
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            fontFamily: fonts.regular,
            borderRadius: radius.large
        }
    ];

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <Stack.Screen options={{ title: t('profile.title'), headerTitleStyle: { fontFamily: fonts.bold } }} />
            <ScrollView style={[styles.container, { backgroundColor: colors.backgroundPrimary }]} contentContainerStyle={styles.content}>

                {/* Avatar Section */}
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={pickImage} disabled={uploading}>
                        <View style={styles.avatarWrapper}>
                            {photoURL ? (
                                <Image
                                    source={{ uri: photoURL }}
                                    style={[styles.avatar, { borderColor: colors.surface }]}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface, borderColor: colors.surface }]}>
                                    <Ionicons name="person" size={60} color={colors.textSecondary} />
                                </View>
                            )}
                            <View style={[styles.editBadge, { backgroundColor: colors.accentPrimary, borderColor: colors.surface }]}>
                                <Ionicons name="camera" size={18} color="#fff" />
                            </View>
                            {uploading && (
                                <View style={styles.uploadOverlay}>
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                    <Text style={[textStyle, { marginTop: 12, fontSize: 14, color: colors.accentPrimary, fontFamily: fonts.bold }]}>
                        {uploading ? t('profile.uploading') : t('profile.changePhoto')}
                    </Text>
                </View>

                {/* Form Fields */}
                <View style={styles.form}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                            {t('settings.account')}
                        </Text>
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.displayName')}</Text>
                        <TextInput
                            style={inputStyle}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder={t('profile.displayName')}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.username')}</Text>
                        <TextInput
                            style={inputStyle}
                            value={username}
                            onChangeText={setUsername}
                            placeholder={t('profile.username')}
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.sectionHeader}>
                        <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                            {t('profile.phone')} & {t('profile.dateOfBirth')}
                        </Text>
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.phone')}</Text>
                        <TextInput
                            style={inputStyle}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder={t('profile.phone')}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.dateOfBirth')}</Text>
                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[
                                styles.dateSelector,
                                {
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.surface,
                                    borderRadius: radius.large
                                }
                            ]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={textStyle}>{dob.toISOString().split('T')[0]}</Text>
                            <Ionicons name="calendar-outline" size={20} color={colors.accentPrimary} />
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={dob}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (selectedDate) setDob(selectedDate);
                                }}
                                maximumDate={new Date()}
                            />
                        )}
                    </View>

                    <View style={styles.sectionHeader}>
                        <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                            {t('settings.email')}
                        </Text>
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.contactEmail')}</Text>
                        <TextInput
                            style={[inputStyle, emailError ? { borderColor: colors.danger } : {}]}
                            value={contactEmail}
                            onChangeText={(val) => {
                                setContactEmail(val);
                                validateEmail(val);
                            }}
                            placeholder={t('profile.contactEmail')}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        {emailError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, fontFamily: fonts.regular }}>{emailError}</Text> : null}
                    </View>

                    <View style={styles.field}>
                        <Text style={labelStyle}>{t('profile.authEmail')}</Text>
                        <View style={[
                            styles.readOnlyField,
                            {
                                backgroundColor: colors.backgroundSecondary,
                                borderColor: colors.borderSubtle,
                                opacity: 0.8,
                                borderRadius: radius.large
                            }
                        ]}>
                            <Text style={[textStyle, { fontSize: 14 }]}>{user.authEmail || user.email}</Text>
                            <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            {t('profile.authEmail')} (Read-only)
                        </Text>
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[
                        styles.saveButton,
                        { backgroundColor: colors.accentPrimary, borderRadius: radius.large },
                        (loading || !!emailError) && { opacity: 0.6 }
                    ]}
                    onPress={handleSave}
                    disabled={loading || !!emailError}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={styles.buttonContent}>
                            <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={[styles.saveButtonText, { fontFamily: fonts.bold }]}>{t('profile.save')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarWrapper: {
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    avatar: {
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 4,
        borderColor: '#fff',
    },
    avatarPlaceholder: {
        width: 130,
        height: 130,
        borderRadius: 65,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    editBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    uploadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 65,
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        marginTop: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    sectionHeaderText: {
        fontSize: 14,
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    field: {
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    readOnlyField: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateSelector: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    helperText: {
        fontSize: 12,
        marginTop: 6,
        marginLeft: 4,
    },
    saveButton: {
        marginTop: 12,
        padding: 18,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
