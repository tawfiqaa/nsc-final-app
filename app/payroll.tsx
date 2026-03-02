import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { db } from '../src/lib/firebase';
import { AttendanceLog, PayrollSettings } from '../src/types';
import { exportPayrollCSV, exportPayrollExcel } from '../src/utils/exportPayroll';

type RangeType = 'this_month' | 'last_month' | 'custom';

const CURRENCIES = [
    { code: 'ILS', symbol: '₪', label: 'ILS (₪)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

export default function PayrollScreen() {
    const { user } = useAuth();
    const { membershipRole } = useOrg();
    const { colors } = useTheme();
    const router = useRouter();

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

    // Data
    const [logs, setLogs] = useState<AttendanceLog[]>([]);

    // Load Settings
    useEffect(() => {
        if (!user || isRestrictedAdmin) return;
        loadSettings();
    }, [user, isRestrictedAdmin]);

    const loadSettings = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
            const docSnap = await getDoc(docRef);
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
        } catch (e) {
            console.error('Failed to load payroll settings', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!user) {
            Alert.alert("Error", "Please sign in to save settings.");
            return;
        }

        const hRate = parseFloat(hourlyRateInput);
        const kRate = parseFloat(kmRateInput);

        if (isNaN(hRate) || isNaN(kRate)) {
            Alert.alert("Invalid Input", "Please enter valid numbers for rates.");
            return;
        }

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
            Alert.alert("Success", "Payroll settings saved.");
            fetchLogsInRange();
        } catch (e: any) {
            console.error('Failed to save payroll settings', e);
            Alert.alert("Save Failed", `Error: ${e.code || 'unknown'}\n${e.message || ''}`);
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

    useEffect(() => {
        if (!user || loading || isRestrictedAdmin) return;
        fetchLogsInRange();
    }, [user, loading, startDate, endDate, isRestrictedAdmin]);

    const fetchLogsInRange = async () => {
        if (!user) return;
        setFetchingLogs(true);
        try {
            const lessonsRef = collection(db, 'users', user.uid, 'lessons');
            const startISO = startDate.toISOString();
            const endISO = endDate.toISOString();

            const q = query(
                lessonsRef,
                where('dateISO', '>=', startISO),
                where('dateISO', '<=', endISO),
                orderBy('dateISO', 'asc')
            );

            const querySnap = await getDocs(q);
            const loadedLogs: AttendanceLog[] = [];
            querySnap.forEach(d => loadedLogs.push(d.data() as AttendanceLog));
            setLogs(loadedLogs);
        } catch (e) {
            console.error('Failed to fetch logs for payroll', e);
        } finally {
            setFetchingLogs(false);
        }
    };

    const summary = useMemo(() => {
        const totalHours = logs.reduce((acc, log) => acc + (log.status === 'present' ? (log.hours || 0) : 0), 0);
        const totalKm = logs.reduce((acc, log) => acc + (log.status === 'present' ? (log.distance || 0) : 0), 0);

        const hRate = settings?.hourlyRate || 0;
        const kRate = settings?.kmRate || 0;

        const hoursPay = totalHours * hRate;
        const kmPay = totalKm * kRate;
        const totalPay = hoursPay + kmPay;

        return { totalHours, totalKm, hoursPay, kmPay, totalPay };
    }, [logs, settings]);

    const handleExport = async (formatType: 'csv' | 'excel') => {
        if (!settings) {
            Alert.alert("Rates Missing", "Please set your payroll rates before exporting.");
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
            Alert.alert("Export Failed", e.message);
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

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const ratesMissing = !settings;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.headerRow, { marginBottom: 20 }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Payroll Report</Text>
                    <TouchableOpacity onPress={() => setShowSettingsModal(true)}>
                        <Ionicons name="settings-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {ratesMissing && (
                    <View style={[styles.warningBox, { backgroundColor: '#332200', borderColor: '#FFCC00' }]}>
                        <Ionicons name="warning-outline" size={24} color="#FFCC00" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: '#FFCC00', fontWeight: 'bold' }}>Rates not configured</Text>
                            <Text style={{ color: '#DDD', fontSize: 13 }}>Set your hourly and KM rates to see pay totals.</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#FFCC00' }]}
                            onPress={() => setShowSettingsModal(true)}
                        >
                            <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>SET RATES</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Date Range</Text>
                    <View style={styles.rangeButtons}>
                        {(['this_month', 'last_month', 'custom'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.rangeBtn,
                                    { borderColor: colors.border, borderWidth: 1, backgroundColor: rangeType === type ? colors.primary : '#1a1a1a' }
                                ]}
                                onPress={() => setRangeType(type)}
                            >
                                <Text style={[styles.rangeBtnText, { color: rangeType === type ? '#fff' : '#888' }]}>
                                    {type.replace('_', ' ').toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {rangeType === 'custom' && (
                        <View style={styles.customDateRow}>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.dateInput, { borderColor: colors.border }]}>
                                <Text style={{ color: colors.text }}>{format(startDate, 'yyyy-MM-dd')}</Text>
                                <Ionicons name="calendar-outline" size={16} color={colors.secondaryText} />
                            </TouchableOpacity>
                            <Text style={{ color: colors.text, marginHorizontal: 8 }}>to</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.dateInput, { borderColor: colors.border }]}>
                                <Text style={{ color: colors.text }}>{format(endDate, 'yyyy-MM-dd')}</Text>
                                <Ionicons name="calendar-outline" size={16} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {showStartPicker && <DateTimePicker value={startDate} mode="date" display="default" onChange={onStartChange} />}
                    {showEndPicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={onEndChange} />}
                </View>

                {fetchingLogs ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
                ) : (
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryRow}>
                            <SummaryCard title="Total Hours" value={summary.totalHours.toFixed(1)} unit="h" color={colors.text} cardColor={colors.card} />
                            <SummaryCard title="Total KM" value={summary.totalKm.toFixed(1)} unit="km" color={colors.text} cardColor={colors.card} />
                        </View>
                        {!ratesMissing && (
                            <>
                                <View style={styles.summaryRow}>
                                    <SummaryCard title="Hours Pay" value={`${settings?.currency || 'ILS'} ${summary.hoursPay.toFixed(2)}`} unit="" color={colors.primary} cardColor={colors.card} />
                                    <SummaryCard title="KM Pay" value={`${settings?.currency || 'ILS'} ${summary.kmPay.toFixed(2)}`} unit="" color={colors.primary} cardColor={colors.card} />
                                </View>
                                <View style={[styles.totalCard, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.totalLabel}>Total Payment</Text>
                                    <Text style={styles.totalValue}>{settings?.currency || 'ILS'} {summary.totalPay.toFixed(2)}</Text>
                                </View>
                            </>
                        )}
                    </View>
                )}

                <View style={styles.exportRow}>
                    <TouchableOpacity
                        style={[styles.exportBtn, { borderColor: colors.primary, borderWidth: 1 }]}
                        onPress={() => handleExport('csv')}
                    >
                        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                        <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export CSV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleExport('excel')}
                    >
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={[styles.exportBtnText, { color: '#fff' }]}>Export Excel</Text>
                    </TouchableOpacity>
                </View>

                <Text style={{ textAlign: 'center', color: colors.secondaryText, fontSize: 12, marginTop: 20 }}>
                    Exports include the full itemized list of lessons within this date range.
                </Text>
            </ScrollView>

            <Modal
                visible={showSettingsModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSettingsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Payroll Rates Configuration</Text>
                            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                                <Ionicons name="close" size={24} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Hourly Rate</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={hourlyRateInput}
                            onChangeText={setHourlyRateInput}
                            keyboardType="numeric"
                            placeholder="e.g. 100"
                            placeholderTextColor={colors.secondaryText}
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 16 }]}>KM Rate</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={kmRateInput}
                            onChangeText={setKmRateInput}
                            keyboardType="numeric"
                            placeholder="e.g. 2.0"
                            placeholderTextColor={colors.secondaryText}
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 16 }]}>Currency</Text>
                        <View style={styles.currencyRow}>
                            {CURRENCIES.map((curr) => (
                                <TouchableOpacity
                                    key={curr.code}
                                    style={[
                                        styles.currencyBtn,
                                        { borderColor: colors.border },
                                        currencyInput === curr.code && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => setCurrencyInput(curr.code)}
                                >
                                    <Text style={[styles.currencyBtnText, { color: currencyInput === curr.code ? '#fff' : colors.text }]}>
                                        {curr.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                            onPress={handleSaveSettings}
                            disabled={savingSettings}
                        >
                            {savingSettings ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Configuration</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function SummaryCard({ title, value, unit, color, cardColor }: any) {
    return (
        <View style={[styles.summaryCard, { backgroundColor: cardColor }]}>
            <Text style={styles.summaryTitle}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[styles.summaryValue, { color }]}>{value}</Text>
                {unit ? <Text style={[styles.summaryUnit, { color }]}>{unit}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
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
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 8, width: 130 },
    summaryContainer: { marginBottom: 24 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryCard: { flex: 1, padding: 16, borderRadius: 16, marginHorizontal: 4, elevation: 2, shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    summaryTitle: { fontSize: 12, color: '#666', marginBottom: 4 },
    summaryValue: { fontSize: 20, fontWeight: 'bold' },
    summaryUnit: { fontSize: 12, marginLeft: 2 },
    totalCard: { padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 12 },
    totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    totalValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
    exportRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginHorizontal: 6 },
    exportBtnText: { fontWeight: 'bold', marginLeft: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 20, padding: 24, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
    currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    currencyBtn: { flex: 1, minWidth: '45%', paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    currencyBtnText: { fontWeight: 'bold', fontSize: 12 },
    saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
