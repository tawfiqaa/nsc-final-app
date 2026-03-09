import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { useAuth } from '../src/contexts/AuthContext';
import { useLesson } from '../src/contexts/LessonContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { changeLanguage } from '../src/i18n/i18n';
import { db, functions } from '../src/lib/firebase';
import { handleExportProcess } from '../src/utils/exportExcel';
import { useFormatting } from '../src/utils/formatters';

export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const { schedules, logs } = useLesson();
    const { activeOrg, activeOrgId, membershipRole, userOrgs, switchOrg } = useOrg();
    const { colors, fonts, theme, tokens } = useTheme();
    const { spacing, radius, interaction } = tokens;
    const { t, i18n } = useTranslation();
    const { formatDate } = useFormatting();
    const router = useRouter();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(user?.name || '');
    const [exportDate, setExportDate] = useState(new Date());
    const [exporting, setExporting] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

    // Restricted admins (org admins but not super admins) see a limited UI
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    // Teachers and Super Admins see teacher-specific features
    const showTeacherFeatures = !isOrgAdmin || isSuperAdmin;

    const handleLanguageChange = async (lang: string) => {
        if (i18n.language === lang) return;
        try {
            if (user) {
                await updateDoc(doc(db, 'users', user.uid), {
                    'settings.ui.language': lang
                });
            }
            await changeLanguage(lang);
        } catch (e: any) {
            Alert.alert(t('common.error'), e.message);
        }
    };

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
            Alert.alert(t('settings.exportError'), e.message);
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

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
            Alert.alert(t('common.error'), 'Please type "DELETE MY ACCOUNT" exactly.');
            return;
        }

        setIsDeletingAccount(true);
        try {
            const deleteMyAccountFn = httpsCallable(functions, 'deleteMyAccount');
            await deleteMyAccountFn();

            // On success, sign out and clean up
            await logout();
            setShowDeleteModal(false);
            Alert.alert(t('common.success'), 'Your account and all data have been deleted.');
            router.replace('/login');
        } catch (error: any) {
            console.error('Delete account error:', error);
            Alert.alert(t('common.error'), error.message || 'Failed to delete account.');
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const saveName = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), { name: tempName });
            setEditingName(false);
            Alert.alert(t('common.success'), t('settings.nameUpdated'));
        } catch (error: any) {
            console.error(error);
            Alert.alert(t('common.error'), t('settings.nameUpdateError'));
        }
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    const cardStyle = [
        styles.section,
        {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: radius.large,
            padding: spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: theme === 'light' ? 0.05 : 0.1,
            shadowRadius: 12,
            elevation: theme === 'light' ? 2 : 4,
        }
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <ScrollView contentContainerStyle={styles.content}>

                <View style={cardStyle}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.account')}</Text>

                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.row, { paddingVertical: 8 }]}
                        onPress={() => router.push('/profile' as any)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="person-circle-outline" size={24} color={colors.accentPrimary} style={{ marginRight: 12 }} />
                            <Text style={[styles.label, textStyle]}>{t('profile.title')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('settings.name')}</Text>
                        {editingName ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                            borderColor: colors.borderSubtle,
                                            backgroundColor: colors.backgroundSecondary,
                                            fontFamily: fonts.regular,
                                            borderRadius: radius.small
                                        }
                                    ]}
                                    value={tempName}
                                    onChangeText={setTempName}
                                />
                                <TouchableOpacity
                                    activeOpacity={interaction.pressedOpacity}
                                    onPress={saveName}
                                    style={{ marginLeft: 8 }}
                                >
                                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={interaction.pressedOpacity}
                                    onPress={() => setEditingName(false)}
                                    style={{ marginLeft: 8 }}
                                >
                                    <Ionicons name="close-circle" size={24} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.value, secondaryStyle, { marginRight: 8 }]}>{user?.name || 'N/A'}</Text>
                                <TouchableOpacity
                                    activeOpacity={interaction.pressedOpacity}
                                    onPress={() => { setTempName(user?.name || ''); setEditingName(true); }}
                                >
                                    <Ionicons name="pencil" size={16} color={colors.accentPrimary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('settings.email')}</Text>
                        <Text style={[styles.value, secondaryStyle]}>{user?.email}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('settings.role')}</Text>
                        <Text style={[styles.value, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{user?.role?.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Show Reports only for Teachers & Super Admins */}
                {showTeacherFeatures && (
                    <View style={[cardStyle, { paddingVertical: 16, minHeight: 'auto' }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold, marginBottom: 8 }]}>{t('settings.reports')}</Text>

                        {/* Month Picker */}
                        <View style={[styles.row, { justifyContent: 'center', marginBottom: 12 }]}>
                            <TouchableOpacity activeOpacity={interaction.pressedOpacity} onPress={() => changeMonth(-1)} style={{ padding: 4 }}>
                                <Ionicons name="chevron-back" size={24} color={colors.accentPrimary} />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 18, color: colors.textPrimary, marginHorizontal: 16, fontFamily: fonts.bold }}>
                                {formatDate(exportDate, { month: 'long', year: 'numeric' })}
                            </Text>
                            <TouchableOpacity activeOpacity={interaction.pressedOpacity} onPress={() => changeMonth(1)} style={{ padding: 4 }}>
                                <Ionicons name="chevron-forward" size={24} color={colors.accentPrimary} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.row, { marginBottom: 0, justifyContent: 'center' }]}
                            onPress={handleExportReport}
                            disabled={exporting}
                        >
                            {exporting ? (
                                <ActivityIndicator size="small" color={colors.accentPrimary} />
                            ) : (
                                <>
                                    <Text style={[styles.label, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{t('settings.quickMonthlyExport')}</Text>
                                    <Ionicons name="download-outline" size={24} color={colors.accentPrimary} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={cardStyle}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.preferences')}</Text>
                    <View style={styles.row}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons
                                name={theme === 'dark' ? "moon" : "sunny"}
                                size={22}
                                color={colors.accentPrimary}
                                style={{ marginRight: 12 }}
                            />
                            <Text style={[styles.label, textStyle]}>{t('settings.darkMode')}</Text>
                        </View>
                        <ThemeToggle />
                    </View>

                    <View style={[styles.row, { marginBottom: 0 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="language-outline" size={22} color={colors.accentPrimary} style={{ marginRight: 12 }} />
                            <Text style={[styles.label, textStyle]}>{t('settings.language')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                onPress={() => handleLanguageChange('en')}
                                style={[styles.langButton, { borderColor: colors.borderSubtle }, i18n.language === 'en' && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'en' ? '#fff' : colors.textPrimary, fontFamily: fonts.regular }]}>EN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                onPress={() => handleLanguageChange('he')}
                                style={[styles.langButton, { borderColor: colors.borderSubtle }, i18n.language === 'he' && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'he' ? '#fff' : colors.textPrimary, fontFamily: fonts.regular }]}>עב</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                onPress={() => handleLanguageChange('ar')}
                                style={[styles.langButton, { borderColor: colors.borderSubtle }, i18n.language === 'ar' && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'ar' ? '#fff' : colors.textPrimary, fontFamily: fonts.regular }]}>عر</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Organization Section */}
                <View style={cardStyle}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.organization')}</Text>
                    {activeOrg && (
                        <>
                            <View style={styles.row}>
                                <Text style={[styles.label, textStyle, { paddingRight: 8 }]}>{t('settings.activeOrg')}</Text>
                                <Text style={[styles.value, { color: colors.accentPrimary, fontFamily: fonts.bold, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{activeOrg.name || 'Unknown'}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={[styles.label, textStyle]}>{t('settings.orgRole')}</Text>
                                <Text style={[styles.value, secondaryStyle]}>{membershipRole?.toUpperCase()}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={[styles.label, textStyle]}>{t('settings.orgId')}</Text>
                                <Text style={[styles.value, secondaryStyle, { fontSize: 10 }]} selectable>{activeOrgId}</Text>
                            </View>
                        </>
                    )}
                    {userOrgs.filter(o => o.status === 'approved' && o.orgId !== activeOrgId).length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={[secondaryStyle, { fontSize: 12, marginBottom: 8 }]}>{t('settings.switchOrg')}:</Text>
                            {userOrgs.filter(o => o.status === 'approved' && o.orgId !== activeOrgId).map(org => (
                                <TouchableOpacity
                                    activeOpacity={interaction.pressedOpacity}
                                    key={org.orgId}
                                    style={[styles.row, { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.backgroundSecondary }]}
                                    onPress={() => switchOrg(org.orgId)}
                                >
                                    <Text style={[styles.label, textStyle]}>{org.orgName || org.orgId}</Text>
                                    <Ionicons name="swap-horizontal" size={18} color={colors.accentPrimary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {showTeacherFeatures && (
                        <View style={{ marginTop: 8, gap: 12 }}>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                style={[styles.row, { justifyContent: 'center', marginBottom: 0 }]}
                                onPress={() => router.push('/join-org' as any)}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={colors.accentPrimary} />
                                <Text style={[styles.label, { color: colors.accentPrimary, marginLeft: 6, fontFamily: fonts.regular }]}>{t('settings.joinAnotherOrg')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {isSuperAdmin && (
                    <View style={cardStyle}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.systemAdmin')}</Text>
                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.row, { paddingVertical: 8 }]}
                            onPress={() => router.push('/admin/org-management' as any)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="business" size={24} color={colors.accentPrimary} style={{ marginRight: 12 }} />
                                <Text style={[styles.label, textStyle]}>{t('settings.orgManagement')}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[cardStyle, { borderColor: colors.danger + '40', backgroundColor: theme === 'light' ? colors.danger + '05' : colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.danger, fontFamily: fonts.bold }]}>{t('settings.dangerZone')}</Text>
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.row, { marginBottom: 0 }]}
                        onPress={() => setShowDeleteModal(true)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="trash-outline" size={24} color={colors.danger} style={{ marginRight: 12 }} />
                            <Text style={[styles.label, { color: colors.danger, fontFamily: fonts.regular }]}>{t('settings.deleteAccount')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.danger + '80'} />
                    </TouchableOpacity>
                </View>

                <View style={cardStyle}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.appInfo')}</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('common.version')}</Text>
                        <Text style={[styles.value, secondaryStyle]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>Build Date</Text>
                        <Text style={[styles.value, secondaryStyle]}>{process.env.EXPO_PUBLIC_BUILD_DATE || new Date().toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>Commit</Text>
                        <Text style={[styles.value, secondaryStyle, { fontSize: 10 }]}>{process.env.EXPO_PUBLIC_GIT_COMMIT || 'development'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>Sync Time</Text>
                        <Text style={[styles.value, secondaryStyle, { fontSize: 10 }]}>04/03 02:35</Text>
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.logoutButton, { borderColor: colors.danger }]}
                    onPress={logout}
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                    <Text style={[styles.logoutText, { color: colors.danger, fontFamily: fonts.bold }]}>{t('settings.logout')}</Text>
                </TouchableOpacity>

                {/* Delete Account Modal */}
                <Modal
                    visible={showDeleteModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowDeleteModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.large, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
                            <Text style={[styles.modalTitle, { color: colors.danger, fontFamily: fonts.bold, fontSize: 20 }]}>Delete Your Account?</Text>
                            <Text style={[textStyle, { fontSize: 16, marginBottom: 20, lineHeight: 22 }]}>
                                This action is <Text style={[boldStyle, { color: colors.danger }]}>permanent and cannot be undone</Text>. Your profile, all lessons, schedules, schools, students, and media will be wiped forever.
                            </Text>

                            <Text style={[secondaryStyle, { fontSize: 14, marginBottom: 8 }]}>
                                Type <Text style={{ fontWeight: 'bold' }}>DELETE MY ACCOUNT</Text> to confirm:
                            </Text>

                            <TextInput
                                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.backgroundSecondary, paddingVertical: 12, height: undefined, width: '100%' }]}
                                value={deleteConfirmText}
                                onChangeText={setDeleteConfirmText}
                                autoCapitalize="characters"
                                placeholder="Type confirmation here"
                                placeholderTextColor={colors.textSecondary}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { borderColor: colors.borderSubtle, borderWidth: 1 }]}
                                    onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                                    disabled={isDeletingAccount}
                                >
                                    <Text style={textStyle}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalBtn,
                                        { backgroundColor: colors.danger },
                                        (deleteConfirmText !== 'DELETE MY ACCOUNT' || isDeletingAccount) && { opacity: 0.5 }
                                    ]}
                                    onPress={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || isDeletingAccount}
                                >
                                    {isDeletingAccount ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Wipe All Data</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

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
        paddingTop: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 24,
    },
    section: {
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
    },
    value: {
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 24,
    },
    logoutText: {
        fontSize: 16,
        marginLeft: 8,
    },
    input: {
        borderWidth: 1,
        padding: 4,
        paddingHorizontal: 8,
        width: 150,
        marginRight: 8,
    },
    langButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    langButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
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
    modalTitle: {
        fontSize: 18,
        marginBottom: 16,
    },
    modalBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
});
