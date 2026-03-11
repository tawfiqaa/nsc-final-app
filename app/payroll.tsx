import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, I18nManager, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useLesson } from '../src/contexts/LessonContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { db } from '../src/lib/firebase';
import { AttendanceLog, PayrollSettings } from '../src/types';
import { exportPayrollCSV, exportPayrollExcel } from '../src/utils/exportPayroll';
import { useFormatting } from '../src/utils/formatters';
import { computePayrollTotals } from '../src/utils/payroll';

type RangeType = 'this_month' | 'last_month' | 'custom';

const CURRENCIES = [
    { code: 'ILS', symbol: '₪', label: 'ILS (₪)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

export default function PayrollScreen() {
    const { user } = useAuth();
    const { activeOrgId, membershipRole } = useOrg();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { t } = useTranslation();
    const { formatNumber, formatDate, formatCurrency } = useFormatting();
    const router = useRouter();
    const isFocused = useIsFocused();
    const { logs: contextLogs } = useLesson();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    if (isRestrictedAdmin) return null;

    const [loading, setLoading] = useState(true);
    const [fetchingLogs, setFetchingLogs] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Range Selection
    const [rangeType, setRangeType] = useState<RangeType>('this_month');
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(endOfMonth(new Date()));
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Settings
    const [settings, setSettings] = useState<PayrollSettings | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // UI State for editing rates
    const [hourlyRateInput, setHourlyRateInput] = useState('');
    const [kmRateInput, setKmRateInput] = useState('');
    const [currencyInput, setCurrencyInput] = useState('ILS');

    const [hourlyError, setHourlyError] = useState('');
    const [kmError, setKmError] = useState('');

    // Data
    const [logs, setLogs] = useState<AttendanceLog[]>([]);

    // Load Settings
    useEffect(() => {
        if (!user || isRestrictedAdmin) return;

        const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as PayrollSettings;
                setSettings(data);
                setHourlyRateInput(String(data.hourlyRate || ''));
                setKmRateInput(String(data.kmRate || ''));
                setCurrencyInput(data.currency || 'ILS');
            } else {
                setSettings(null);
                setShowSettingsModal(true);
            }
            setLoading(false);
        }, (err) => {
            console.error('Failed to listen to payroll settings', err);
            setLoading(false);
        });

        return () => unsub();
    }, [user, isRestrictedAdmin]);

    const handleSaveSettings = async () => {
        if (!user) {
            Alert.alert(t('common.error'), t('auth.authFailed'));
            return;
        }

        const hRateStr = hourlyRateInput.trim();
        const kRateStr = kmRateInput.trim();
        let hasError = false;

        if (!hRateStr || isNaN(parseFloat(hRateStr))) {
            setHourlyError(t('payroll.invalidNumber'));
            hasError = true;
        } else {
            setHourlyError('');
        }

        if (!kRateStr || isNaN(parseFloat(kRateStr))) {
            setKmError(t('payroll.invalidNumber'));
            hasError = true;
        } else {
            setKmError('');
        }

        if (hasError) return;

        const hRate = parseFloat(hRateStr);
        const kRate = parseFloat(kRateStr);

        setSavingSettings(true);
        try {
            const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
            const dataToSave = {
                hourlyRate: hRate,
                kmRate: kRate,
                currency: currencyInput,
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, dataToSave, { merge: true });
            setSettings(dataToSave as any);
            setShowSettingsModal(false);
            Alert.alert(t('common.success'), t('payroll.saveSuccess'));
        } catch (e: any) {
            console.error('Failed to save payroll settings', e);
            Alert.alert(t('payroll.saveFailed'), `Error: ${e.code || 'unknown'}\n${e.message || ''}`);
        } finally {
            setSavingSettings(false);
        }
    };

    useEffect(() => {
        if (rangeType === 'this_month') {
            setStartDate(startOfMonth(new Date()));
            setEndDate(endOfMonth(new Date()));
        } else if (rangeType === 'last_month') {
            const lastMonth = subMonths(new Date(), 1);
            setStartDate(startOfMonth(lastMonth));
            setEndDate(endOfMonth(lastMonth));
        }
    }, [rangeType]);

    // Fetch logs in range (Real-time)
    useEffect(() => {
        if (!user || loading || isRestrictedAdmin || !isFocused) return;

        setFetchingLogs(true);

        // Determine correct collection path (Org vs Personal)
        const lessonsRef = activeOrgId
            ? collection(db, 'orgs', activeOrgId, 'lessons')
            : collection(db, 'users', user.uid, 'lessons');

        // Start and End of days to be inclusive
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const startISO = start.toISOString();
        const endISO = end.toISOString();

        let q;
        if (activeOrgId) {
            // Org-mode lessons use 'createdBy' filter
            q = query(
                lessonsRef,
                where('createdBy', '==', user.uid),
                where('dateISO', '>=', startISO),
                where('dateISO', '<=', endISO),
                orderBy('dateISO', 'asc')
            );
        } else {
            q = query(
                lessonsRef,
                where('dateISO', '>=', startISO),
                where('dateISO', '<=', endISO),
                orderBy('dateISO', 'asc')
            );
        }

        const unsub = onSnapshot(q, (snap) => {
            const loadedLogs: AttendanceLog[] = [];
            snap.forEach(d => loadedLogs.push(d.data() as AttendanceLog));
            setLogs(loadedLogs);
            setFetchingLogs(false);
        }, (err) => {
            console.error('Failed to fetch logs for payroll', err);
            setFetchingLogs(false);
        });

        return () => unsub();
    }, [user, loading, startDate, endDate, isRestrictedAdmin, activeOrgId, isFocused]);

    const summary = useMemo(() => {
        return computePayrollTotals(logs, settings);
    }, [logs, settings]);

    const handleExport = async (formatType: 'csv' | 'excel') => {
        if (!settings) {
            Alert.alert(t('payroll.ratesMissing'), t('payroll.setRatesBeforeExport'));
            return;
        }
        try {
            const options = {
                logs,
                hourlyRate: settings.hourlyRate,
                kmRate: settings.kmRate,
                currency: settings.currency || 'ILS',
                startDate,
                endDate,
                teacherName: user?.name || user?.email?.split('@')[0]
            };

            if (formatType === 'csv') {
                await exportPayrollCSV(options);
            } else {
                await exportPayrollExcel(options);
            }
        } catch (e: any) {
            Alert.alert(t('payroll.saveFailed'), e.message);
        }
    };

    const onStartChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowStartPicker(false);
        if (selectedDate) setStartDate(selectedDate);
    };

    const onEndChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowEndPicker(false);
        if (selectedDate) setEndDate(selectedDate);
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
            </View>
        );
    }

    const ratesMissing = !settings;

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.headerRow, { marginBottom: 20 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginRight: 15, padding: 5 }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.title, boldStyle]}>{t('payroll.title')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowSettingsModal(true)}>
                        <FontAwesome5 name="coins" size={24} color={colors.accentPrimary} />
                    </TouchableOpacity>
                </View>

                {ratesMissing && (
                    <View style={[styles.warningBox, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                        <Ionicons name="warning-outline" size={24} color={colors.warning} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: colors.warning, fontWeight: 'bold', fontFamily: fonts.bold }}>{t('payroll.ratesNotConfigured')}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.regular }}>{t('payroll.setRatesToSeeTotals')}</Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.smallBtn, { backgroundColor: colors.warning }]}
                            onPress={() => setShowSettingsModal(true)}
                        >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, fontFamily: fonts.bold }}>{t('dashboard.setRates')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: radius.large }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold, marginBottom: 0 }]}>{t('payroll.dateRange')}</Text>
                    </View>
                    <View style={styles.rangeButtons}>
                        {(['this_month', 'last_month', 'custom'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                activeOpacity={interaction.pressedOpacity}
                                style={[
                                    styles.rangeBtn,
                                    {
                                        borderColor: rangeType === type ? 'transparent' : colors.borderSubtle,
                                        borderWidth: 1,
                                        backgroundColor: rangeType === type ? colors.accentPrimary : colors.backgroundSecondary,
                                        borderRadius: radius.medium
                                    }
                                ]}
                                onPress={() => setRangeType(type)}
                            >
                                <Text style={[styles.rangeBtnText, { color: rangeType === type ? '#fff' : colors.textSecondary, fontFamily: fonts.bold }]}>
                                    {t(`payroll.${type === 'this_month' ? 'thisMonth' : type === 'last_month' ? 'lastMonth' : 'custom'}`).toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {rangeType === 'custom' && (
                        <View style={styles.customDateRow}>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.dateInput, { borderColor: colors.borderSubtle, borderRadius: radius.small, backgroundColor: colors.backgroundSecondary }]}>
                                <Text style={textStyle}>{formatDate(startDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</Text>
                                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <Text style={[textStyle, { marginHorizontal: 8 }]}>-</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.dateInput, { borderColor: colors.borderSubtle, borderRadius: radius.small, backgroundColor: colors.backgroundSecondary }]}>
                                <Text style={textStyle}>{formatDate(endDate, { year: 'numeric', month: '2-digit', day: '2-digit' })}</Text>
                                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {showStartPicker && <DateTimePicker value={startDate} mode="date" display="default" onChange={onStartChange} />}
                    {showEndPicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={onEndChange} />}
                </View>

                {fetchingLogs ? (
                    <ActivityIndicator size="large" color={colors.accentPrimary} style={{ marginVertical: 20 }} />
                ) : (
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryRow}>
                            <SummaryCard title={t('payroll.totalHours')} value={formatNumber(summary.totalHours, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit={t('payroll.unitHours')} color={colors.textPrimary} cardColor={colors.surface} font={fonts} radius={radius.large} border={colors.borderSubtle} theme={theme} divider={colors.divider} />
                            <SummaryCard title={t('payroll.totalKm')} value={formatNumber(summary.totalDistance, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit={t('payroll.unitKm')} color={colors.textPrimary} cardColor={colors.surface} font={fonts} radius={radius.large} border={colors.borderSubtle} theme={theme} divider={colors.divider} />
                        </View>
                        {!ratesMissing && (
                            <>
                                <View style={styles.summaryRow}>
                                    <SummaryCard title={t('payroll.hoursPay')} value={formatCurrency(summary.hoursPay, settings?.currency || 'ILS')} unit="" color={colors.accentPrimary} cardColor={colors.surface} font={fonts} radius={radius.large} border={colors.borderSubtle} theme={theme} divider={colors.divider} />
                                    <SummaryCard title={t('payroll.kmPay')} value={formatCurrency(summary.kmPay, settings?.currency || 'ILS')} unit="" color={colors.accentPrimary} cardColor={colors.surface} font={fonts} radius={radius.large} border={colors.borderSubtle} theme={theme} divider={colors.divider} />
                                </View>
                                <View style={[styles.totalCard, { backgroundColor: colors.accentPrimary, borderRadius: radius.large }]}>
                                    <Text style={[styles.totalLabel, { fontFamily: fonts.bold }]}>{t('payroll.totalPayment')}</Text>
                                    <Text style={[styles.totalValue, { fontFamily: fonts.bold }]}>{formatCurrency(summary.totalPay, settings?.currency || 'ILS')}</Text>
                                </View>
                            </>
                        )}
                    </View>
                )}

                <View style={styles.exportRow}>
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.exportBtn, { borderColor: colors.accentPrimary, borderWidth: 1, borderRadius: radius.medium }]}
                        onPress={() => handleExport('csv')}
                    >
                        <Ionicons name="document-text-outline" size={20} color={colors.accentPrimary} />
                        <Text style={[styles.exportBtnText, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{t('payroll.exportCsv')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        style={[styles.exportBtn, { borderColor: colors.accentPrimary, borderWidth: 1, borderRadius: radius.medium }]}
                        onPress={() => handleExport('excel')}
                    >
                        <Ionicons name="download-outline" size={20} color={colors.accentPrimary} />
                        <Text style={[styles.exportBtnText, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>{t('payroll.exportExcel')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 12, marginTop: 20, fontFamily: fonts.regular }}>
                    {t('payroll.exportNotice')}
                </Text>
            </ScrollView>

            <Modal
                visible={showSettingsModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSettingsModal(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.large }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, boldStyle]}>{t('payroll.configTitle')}</Text>
                            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            {t('payroll.configSubtitle')}
                        </Text>

                        <Text style={[styles.inputLabel, { color: colors.textPrimary, fontFamily: fonts.bold }]}>
                            {t('payroll.hourlyRate')} <Text style={{ color: colors.warning }}>*</Text>
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: hourlyError ? colors.warning : colors.borderSubtle,
                                    backgroundColor: colors.backgroundSecondary,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.medium,
                                    textAlign: I18nManager.isRTL ? 'right' : 'left'
                                }
                            ]}
                            value={hourlyRateInput}
                            onChangeText={(text) => {
                                setHourlyRateInput(text);
                                if (hourlyError) setHourlyError('');
                            }}
                            keyboardType="decimal-pad"
                            placeholder={t('payroll.hourlyPlaceholder')}
                            placeholderTextColor={colors.textSecondary}
                        />
                        {hourlyError ? (
                            <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4, fontFamily: fonts.regular, textAlign: 'left' }}>
                                {hourlyError}
                            </Text>
                        ) : null}

                        <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 16, fontFamily: fonts.bold }]}>
                            {t('payroll.kmRate')} <Text style={{ color: colors.warning }}>*</Text>
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: kmError ? colors.warning : colors.borderSubtle,
                                    backgroundColor: colors.backgroundSecondary,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.medium,
                                    textAlign: I18nManager.isRTL ? 'right' : 'left'
                                }
                            ]}
                            value={kmRateInput}
                            onChangeText={(text) => {
                                setKmRateInput(text);
                                if (kmError) setKmError('');
                            }}
                            keyboardType="decimal-pad"
                            placeholder={t('payroll.kmPlaceholder')}
                            placeholderTextColor={colors.textSecondary}
                        />
                        {kmError ? (
                            <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4, fontFamily: fonts.regular, textAlign: 'left' }}>
                                {kmError}
                            </Text>
                        ) : null}

                        <Text style={[
                            styles.inputLabel,
                            {
                                color: colors.textPrimary,
                                marginTop: 24,
                                fontFamily: fonts.regular,
                                textAlign: 'left'
                            }
                        ]}>
                            {t('payroll.currencyInstruction')}
                        </Text>
                        <View style={styles.currencyRow}>
                            {CURRENCIES.map((curr) => (
                                <TouchableOpacity
                                    key={curr.code}
                                    activeOpacity={interaction.pressedOpacity}
                                    style={[
                                        styles.currencyBtn,
                                        {
                                            borderColor: currencyInput === curr.code ? 'transparent' : colors.borderSubtle,
                                            backgroundColor: currencyInput === curr.code ? colors.accentPrimary : colors.backgroundSecondary,
                                            borderRadius: radius.medium
                                        }
                                    ]}
                                    onPress={() => setCurrencyInput(curr.code)}
                                >
                                    <Text style={[styles.currencyBtnText, { color: currencyInput === curr.code ? '#fff' : colors.textPrimary, fontFamily: fonts.bold }]}>
                                        {curr.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[styles.saveBtn, { backgroundColor: colors.accentPrimary, marginTop: 24, borderRadius: radius.medium }]}
                            onPress={handleSaveSettings}
                            disabled={savingSettings}
                        >
                            {savingSettings ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, { fontFamily: fonts.bold }]}>{t('payroll.saveConfig')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function SummaryCard({ title, value, unit, color, cardColor, font, radius, border, theme, divider }: any) {
    return (
        <View style={[
            styles.summaryCard,
            {
                backgroundColor: cardColor,
                borderRadius: radius,
                borderColor: theme === 'light' ? border : divider,
                borderWidth: 1
            }
        ]}>
            <Text style={[styles.summaryTitle, { fontFamily: font.regular, color: '#888' }]}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                <Text style={[styles.summaryValue, { color, fontFamily: font.bold }]}>{value}</Text>
                {unit ? <Text style={[styles.summaryUnit, { color, fontFamily: font.regular }]}>{unit}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold' },
    warningBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1 },
    smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    section: { borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 16 },
    rangeButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
    rangeBtnText: { fontSize: 10, fontWeight: '800' },
    customDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 8, width: 140 },
    summaryContainer: { marginBottom: 24 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryCard: { flex: 1, padding: 16, borderRadius: 16, marginHorizontal: 4, elevation: 2, shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, alignItems: 'center', justifyContent: 'center' },
    summaryTitle: { fontSize: 12, color: '#666', marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: 'bold' },
    summaryUnit: { fontSize: 12 },
    totalCard: { padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 12 },
    totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    totalValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
    exportRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginHorizontal: 6 },
    exportBtnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 20, padding: 24, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalSubtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
    inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
    currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    currencyBtn: { flex: 1, minWidth: '45%', paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    currencyBtnText: { fontWeight: 'bold', fontSize: 12 },
    saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
