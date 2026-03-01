import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { db } from '../src/lib/firebase';
import { AttendanceLog, PayrollSettings } from '../src/types';
import { exportPayrollCSV, exportPayrollExcel } from '../src/utils/exportPayroll';

type RangeType = 'this_month' | 'last_month' | 'custom';

export default function PayrollScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();

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
    const [settings, setSettings] = useState<PayrollSettings>({
        hourlyRate: 100,
        kmRate: 2,
        currency: 'ILS'
    });

    // Data
    const [logs, setLogs] = useState<AttendanceLog[]>([]);

    // Load Settings
    useEffect(() => {
        if (!user) return;
        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as PayrollSettings);
                }
            } catch (e) {
                console.error('Failed to load payroll settings', e);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, [user]);

    // Handle Range Type Changes
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

    // Fetch Logs when range changes
    useEffect(() => {
        if (!user || loading) return;
        fetchLogsInRange();
    }, [user, loading, startDate, endDate]);

    const fetchLogsInRange = async () => {
        if (!user) return;
        setFetchingLogs(true);
        try {
            // Requirement says V2: users/{uid}/lessons
            const lessonsRef = collection(db, 'users', user.uid, 'lessons');

            // Use dateISO for filtering as requested (createdAt is numeric, but dateISO represents the lesson's logical date)
            // Range scan on dateISO string: "yyyy-MM-dd" to "yyyy-MM-dd-T" for end of day if needed
            // Actually, endOfMonth returns date with time 23:59:59... so ISO string will be correct.
            const startISO = startDate.toISOString();
            const endISO = endDate.toISOString();

            // Direct query for correct range
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
            // If query fails (could be index missing), fallback to all logs in context if within 90 days?
            // For now, assume indexes are handled or user defines them on first load.
            Alert.alert("Query Error", "If this is your first time, Firestore may be creating an index. Please check the logs.");
        } finally {
            setFetchingLogs(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        setSavingSettings(true);
        try {
            const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
            const dataToSave: PayrollSettings = {
                ...settings,
                updatedAt: Date.now() // Simple numeric timestamp or serverTimestamp() if imported
            };
            await setDoc(docRef, dataToSave, { merge: true });
            Alert.alert("Success", "Payroll settings saved.");
        } catch (e) {
            Alert.alert("Error", "Failed to save settings.");
        } finally {
            setSavingSettings(false);
        }
    };

    // Aggregates
    const summary = useMemo(() => {
        const totalHours = logs.reduce((acc, log) => acc + (log.status === 'present' ? (log.hours || 0) : 0), 0);
        const totalKm = logs.reduce((acc, log) => acc + (log.status === 'present' ? (log.distance || 0) : 0), 0);
        const hoursPay = totalHours * settings.hourlyRate;
        const kmPay = totalKm * settings.kmRate;
        const totalPay = hoursPay + kmPay;

        return { totalHours, totalKm, hoursPay, kmPay, totalPay };
    }, [logs, settings]);

    const handleExport = async (formatType: 'csv' | 'excel') => {
        try {
            const options = {
                logs,
                hourlyRate: settings.hourlyRate,
                kmRate: settings.kmRate,
                currency: settings.currency,
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

    // Date Picker Callbacks
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

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>Payroll Report</Text>

                {/* Date Selection Section */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Date Range</Text>
                    <View style={styles.rangeButtons}>
                        {(['this_month', 'last_month', 'custom'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.rangeBtn,
                                    rangeType === type && { backgroundColor: colors.primary }
                                ]}
                                onPress={() => setRangeType(type)}
                            >
                                <Text style={[
                                    styles.rangeBtnText,
                                    { color: rangeType === type ? '#fff' : colors.text }
                                ]}>
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

                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display="default"
                            onChange={onStartChange}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display="default"
                            onChange={onEndChange}
                        />
                    )}
                </View>

                {/* Rates Section */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Rates</Text>
                    <View style={styles.rateInputsRow}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Hourly Rate</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={String(settings.hourlyRate)}
                                onChangeText={(val) => setSettings({ ...settings, hourlyRate: parseFloat(val) || 0 })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>KM Rate</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={String(settings.kmRate)}
                                onChangeText={(val) => setSettings({ ...settings, kmRate: parseFloat(val) || 0 })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSaveSettings}
                        disabled={savingSettings}
                    >
                        {savingSettings ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Rates</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Summary Cards */}
                {fetchingLogs ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
                ) : (
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryRow}>
                            <SummaryCard title="Total Hours" value={summary.totalHours.toFixed(1)} unit="h" color={colors.text} cardColor={colors.card} />
                            <SummaryCard title="Total KM" value={summary.totalKm.toFixed(1)} unit="km" color={colors.text} cardColor={colors.card} />
                        </View>
                        <View style={styles.summaryRow}>
                            <SummaryCard title="Hours Pay" value={`${settings.currency} ${summary.hoursPay.toFixed(2)}`} unit="" color={colors.primary} cardColor={colors.card} />
                            <SummaryCard title="KM Pay" value={`${settings.currency} ${summary.kmPay.toFixed(2)}`} unit="" color={colors.primary} cardColor={colors.card} />
                        </View>
                        <View style={[styles.totalCard, { backgroundColor: colors.primary }]}>
                            <Text style={styles.totalLabel}>Total Payment</Text>
                            <Text style={styles.totalValue}>{settings.currency} {summary.totalPay.toFixed(2)}</Text>
                        </View>
                    </View>
                )}

                {/* Export Buttons */}
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

                {/* Optional Lessons list preview */}
                <Text style={[styles.previewTitle, { color: colors.text }]}>Lessons List Preview</Text>
                {logs.length === 0 ? (
                    <Text style={{ color: colors.secondaryText, fontStyle: 'italic', textAlign: 'center' }}>No lessons found for this range.</Text>
                ) : (
                    logs.map((log) => (
                        <View key={log.id} style={[styles.logItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.logMain}>
                                <Text style={[styles.logDate, { color: colors.text }]}>{format(new Date(log.dateISO), 'MMM d, yyyy')}</Text>
                                <Text style={[styles.logSchool, { color: colors.secondaryText }]}>{log.school}</Text>
                            </View>
                            <View style={styles.logDetails}>
                                <Text style={[styles.logStat, { color: colors.text }]}>{log.hours}h • {log.distance}km</Text>
                                <Text style={[styles.logPay, { color: colors.primary, fontWeight: 'bold' }]}>
                                    {settings.currency} {((log.hours * settings.hourlyRate) + (log.distance * settings.kmRate)).toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
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
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 24 },
    section: { borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 16 },
    rangeButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginHorizontal: 4, backgroundColor: '#f0f0f0' },
    rangeBtnText: { fontSize: 10, fontWeight: '700' },
    customDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 8, width: 130 },
    rateInputsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    inputGroup: { flex: 1, marginHorizontal: 4 },
    inputLabel: { fontSize: 12, marginBottom: 4 },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
    saveBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold' },
    summaryContainer: { marginBottom: 24 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryCard: { flex: 1, padding: 16, borderRadius: 16, marginHorizontal: 4, elevation: 2, shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    summaryTitle: { fontSize: 12, color: '#666', marginBottom: 4 },
    summaryValue: { fontSize: 20, fontWeight: 'bold' },
    summaryUnit: { fontSize: 12, marginLeft: 2 },
    totalCard: { padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 12 },
    totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    totalValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
    exportRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
    exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginHorizontal: 6 },
    exportBtnText: { fontWeight: 'bold', marginLeft: 8 },
    previewTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    logItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 8, borderLeftWidth: 4 },
    logMain: { flex: 1 },
    logDate: { fontSize: 14, fontWeight: '600' },
    logSchool: { fontSize: 12 },
    logDetails: { alignItems: 'flex-end' },
    logStat: { fontSize: 12 },
    logPay: { fontSize: 14, marginTop: 2 }
});
