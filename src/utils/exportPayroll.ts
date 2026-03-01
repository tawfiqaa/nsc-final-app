import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { AttendanceLog } from '../types';

export interface PayrollRow {
    "Date": string;
    "School": string;
    "Hours": number;
    "Distance (KM)": number;
    "Hours Pay": string;
    "KM Pay": string;
    "Total Pay": string;
    "Notes": string;
}

interface PayrollExportOptions {
    logs: AttendanceLog[];
    hourlyRate: number;
    kmRate: number;
    currency: string;
    startDate: Date;
    endDate: Date;
    teacherName?: string;
}

export const buildPayrollRows = (options: PayrollExportOptions): PayrollRow[] => {
    const { logs, hourlyRate, kmRate, currency, startDate, endDate } = options;

    // Filter logs by date range and status
    const filteredLogs = logs.filter(log => {
        const d = new Date(log.dateISO);
        return d >= startDate && d <= endDate && log.status === 'present';
    });

    // Sort by date ascending
    const sorted = [...filteredLogs].sort(
        (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );

    return sorted.map(log => {
        const hours = log.hours || 0;
        const distance = log.distance || 0;
        const hoursPay = hours * hourlyRate;
        const kmPay = distance * kmRate;
        const totalPay = hoursPay + kmPay;

        return {
            "Date": format(new Date(log.dateISO), 'yyyy-MM-dd'),
            "School": log.school,
            "Hours": hours,
            "Distance (KM)": distance,
            "Hours Pay": `${currency} ${hoursPay.toFixed(2)}`,
            "KM Pay": `${currency} ${kmPay.toFixed(2)}`,
            "Total Pay": `${currency} ${totalPay.toFixed(2)}`,
            "Notes": log.notes || '',
        };
    });
};

export const buildPayrollSummaryRow = (
    rows: PayrollRow[],
    currency: string
): PayrollRow => {
    let totalHours = 0;
    let totalKm = 0;
    let totalHoursPay = 0;
    let totalKmPay = 0;
    let totalPay = 0;

    rows.forEach(row => {
        totalHours += row["Hours"];
        totalKm += row["Distance (KM)"];
        // Parse pay values from formatted strings
        totalHoursPay += parseFloat(row["Hours Pay"].replace(currency, '').trim());
        totalKmPay += parseFloat(row["KM Pay"].replace(currency, '').trim());
        totalPay += parseFloat(row["Total Pay"].replace(currency, '').trim());
    });

    return {
        "Date": "TOTAL",
        "School": "",
        "Hours": totalHours,
        "Distance (KM)": totalKm,
        "Hours Pay": `${currency} ${totalHoursPay.toFixed(2)}`,
        "KM Pay": `${currency} ${totalKmPay.toFixed(2)}`,
        "Total Pay": `${currency} ${totalPay.toFixed(2)}`,
        "Notes": "",
    };
};

export const exportPayrollCSV = async (options: PayrollExportOptions): Promise<void> => {
    const rows = buildPayrollRows(options);
    if (rows.length === 0) {
        throw new Error("No data found for the selected date range.");
    }

    const summaryRow = buildPayrollSummaryRow(rows, options.currency);
    const allRows = [...rows, summaryRow];

    // Build CSV string
    const headers = Object.keys(allRows[0]);
    const csvLines = [
        headers.join(','),
        ...allRows.map(row =>
            headers.map(h => {
                const val = String((row as any)[h]);
                // Escape commas and quotes in values
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',')
        ),
    ];
    const csvContent = csvLines.join('\n');

    const startStr = format(options.startDate, 'yyyy-MM-dd');
    const endStr = format(options.endDate, 'yyyy-MM-dd');
    const teacherPart = options.teacherName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Teacher';
    const fileName = `Payroll_${teacherPart}_${startStr}_to_${endStr}.csv`;

    if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
    }

    // Mobile: write to file system and share
    const FS = FileSystem as any;
    let uri = '';

    if (FS.cacheDirectory) {
        uri = FS.cacheDirectory + fileName;
    } else if (FS.documentDirectory) {
        uri = FS.documentDirectory + fileName;
    } else {
        throw new Error("No file directory available for export.");
    }

    await FS.writeAsStringAsync(uri, csvContent, { encoding: 'utf8' });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Payroll Report',
        });
    }
};

export const exportPayrollExcel = async (options: PayrollExportOptions): Promise<void> => {
    const rows = buildPayrollRows(options);
    if (rows.length === 0) {
        throw new Error("No data found for the selected date range.");
    }

    const summaryRow = buildPayrollSummaryRow(rows, options.currency);
    const allRows = [...rows, summaryRow];

    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const startStr = format(options.startDate, 'yyyy-MM-dd');
    const endStr = format(options.endDate, 'yyyy-MM-dd');
    const teacherPart = options.teacherName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Teacher';
    const fileName = `Payroll_${teacherPart}_${startStr}_to_${endStr}.xlsx`;

    if (Platform.OS === 'web') {
        const uri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
        const link = document.createElement("a");
        link.href = uri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    const FS = FileSystem as any;
    let uri = '';

    if (FS.cacheDirectory) {
        uri = FS.cacheDirectory + fileName;
    } else if (FS.documentDirectory) {
        uri = FS.documentDirectory + fileName;
    } else if (Platform.OS === 'android' && FS.StorageAccessFramework) {
        const permissions = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
            const createdUri = await FS.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                fileName,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            await FS.writeAsStringAsync(createdUri, wbout, { encoding: 'base64' });
            await Sharing.shareAsync(createdUri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Export Payroll Report',
            });
            return;
        }
        throw new Error("Permission denied");
    } else {
        throw new Error("No file directory available for export.");
    }

    await FS.writeAsStringAsync(uri, wbout, { encoding: 'base64' });

    await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Payroll Report',
    });
};
