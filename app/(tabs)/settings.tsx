import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { changeLanguage } from '../../src/i18n/i18n';
import { db } from '../../src/lib/firebase';
import { handleExportProcess } from '../../src/utils/exportExcel';
import { useFormatting } from '../../src/utils/formatters';

export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const { schedules, logs } = useLesson();
    const { activeOrg, activeOrgId, membershipRole, userOrgs, switchOrg } = useOrg();
    const { colors, fonts } = useTheme();
    const { t, i18n } = useTranslation();
    const { formatDate } = useFormatting();
    const router = useRouter();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(user?.name || '');
    const [exportDate, setExportDate] = useState(new Date());
    const [exporting, setExporting] = useState(false);

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

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, boldStyle]}>{t('settings.title')}</Text>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('settings.account')}</Text>

                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('settings.name')}</Text>
                        {editingName ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }]}
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
                                <Text style={[styles.value, secondaryStyle, { marginRight: 8 }]}>{user?.name || 'N/A'}</Text>
                                <TouchableOpacity onPress={() => { setTempName(user?.name || ''); setEditingName(true); }}>
                                    <Ionicons name="pencil" size={16} color={colors.primary} />
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
                        <Text style={[styles.value, { color: colors.primary, fontFamily: fonts.bold }]}>{user?.role?.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Organization Section */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('settings.organization')}</Text>
                    {activeOrg && (
                        <>
                            <View style={styles.row}>
                                <Text style={[styles.label, textStyle]}>{t('settings.activeOrg')}</Text>
                                <Text style={[styles.value, { color: colors.primary, fontFamily: fonts.bold }]}>{activeOrg.name || 'Unknown'}</Text>
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
                                    key={org.orgId}
                                    style={[styles.row, { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.background }]}
                                    onPress={() => switchOrg(org.orgId)}
                                >
                                    <Text style={[styles.label, textStyle]}>{org.orgName || org.orgId}</Text>
                                    <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {showTeacherFeatures && (
                        <View style={{ marginTop: 8, gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.row, { justifyContent: 'center', marginBottom: 0 }]}
                                onPress={() => router.push('/join-org' as any)}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                                <Text style={[styles.label, { color: colors.primary, marginLeft: 6, fontFamily: fonts.regular }]}>{t('settings.joinAnotherOrg')}</Text>
                            </TouchableOpacity>

                            {isSuperAdmin && (
                                <TouchableOpacity
                                    style={[styles.row, { justifyContent: 'center', marginBottom: 0 }]}
                                    onPress={() => router.push('/create-org' as any)}
                                >
                                    <Ionicons name="business-outline" size={18} color={colors.primary} />
                                    <Text style={[styles.label, { color: colors.primary, marginLeft: 6, fontFamily: fonts.regular }]}>{t('settings.createNewOrg')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Show Reports only for Teachers & Super Admins */}
                {showTeacherFeatures && (
                    <View style={[styles.section, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('settings.reports')}</Text>

                        {/* Month Picker */}
                        <View style={[styles.row, { justifyContent: 'center', marginBottom: 24 }]}>
                            <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 8 }}>
                                <Ionicons name="chevron-back" size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginHorizontal: 16, fontFamily: fonts.bold }}>
                                {formatDate(exportDate, { month: 'long', year: 'numeric' })}
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
                                    <Text style={[styles.label, { color: colors.primary, fontFamily: fonts.bold }]}>{t('settings.quickMonthlyExport')}</Text>
                                    <Ionicons name="download-outline" size={24} color={colors.primary} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('settings.preferences')}</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('settings.theme')}</Text>
                        <ThemeToggle />
                    </View>

                    <View style={[styles.row, { marginTop: 16 }]}>
                        <Text style={[styles.label, textStyle]}>{t('settings.language')}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => handleLanguageChange('en')}
                                style={[styles.langButton, i18n.language === 'en' && { backgroundColor: colors.primary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'en' ? '#fff' : colors.text, fontFamily: fonts.regular }]}>EN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleLanguageChange('he')}
                                style={[styles.langButton, i18n.language === 'he' && { backgroundColor: colors.primary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'he' ? '#fff' : colors.text, fontFamily: fonts.regular }]}>עב</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleLanguageChange('ar')}
                                style={[styles.langButton, i18n.language === 'ar' && { backgroundColor: colors.primary }]}
                            >
                                <Text style={[styles.langButtonText, { color: i18n.language === 'ar' ? '#fff' : colors.text, fontFamily: fonts.regular }]}>عر</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('settings.appInfo')}</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, textStyle]}>{t('common.version')}</Text>
                        <Text style={[styles.value, secondaryStyle]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: colors.error }]}
                    onPress={logout}
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={[styles.logoutText, { color: colors.error, fontFamily: fonts.bold }]}>{t('settings.logout')}</Text>
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
    langButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    langButtonText: {
        fontSize: 14,
        fontWeight: '500',
    }
});
