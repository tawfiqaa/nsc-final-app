import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { AttendanceLog, Schedule, User } from '../types';

interface ExportRow {
    "Date": string;
    "School": string;
    "Start Time": string;
    "Status": string;
    "Hours": number;
    "Distance (KM)": number;
    "Type": string;
    "Schedule Name/Id": string;
}

interface ExportOptions {
    logs: AttendanceLog[];
    schedules: Schedule[];
    user: User | null;
    month: number;
    year: number;
}

export const buildExportRows = ({ logs, schedules, month, year }: { logs: AttendanceLog[], schedules: Schedule[], month: number, year: number }): ExportRow[] => {
    // Filter logs by month and year
    const monthlyLogs = logs.filter(log => {
        const d = new Date(log.dateISO);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    // Create rows
    return monthlyLogs.map(log => {
        const d = new Date(log.dateISO);
        // Find schedule name if available
        const sched = log.scheduleId ? schedules.find(s => s.id === log.scheduleId) : null;

        return {
            "Date": format(d, 'yyyy-MM-dd'),
            "School": log.school,
            "Start Time": format(d, 'HH:mm'),
            "Status": log.status,
            "Hours": log.hours,
            "Distance (KM)": log.distance,
            "Type": log.isOneTime ? 'One-Time' : 'Scheduled',
            "Schedule Name/Id": log.scheduleId || 'N/A'
        };
    });
};

export const exportToXlsx = async (rows: ExportRow[], fileName: string): Promise<string> => {
    try {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");

        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

        if (Platform.OS === 'web') {
            // Return data URI for web
            return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
        }

        const FS = FileSystem as any;
        let uri = '';

        // Try standard directories
        if (FS.cacheDirectory) {
            uri = FS.cacheDirectory + fileName;
        } else if (FS.documentDirectory) {
            uri = FS.documentDirectory + fileName;
        } else if (FS.Paths && (FS.Paths.document || FS.Paths.cache)) {
            const baseDir = FS.Paths.document || FS.Paths.cache;
            const path = typeof baseDir === 'string' ? baseDir : (baseDir.uri || baseDir.path || String(baseDir));
            // Ensure cleaning up double slashes
            const cleanPath = path.replace(/\/+$/, '');
            uri = `${cleanPath}/${fileName}`;
        } else {
            const debugInfo = `Platform: ${Platform.OS}, FS Keys: ${Object.keys(FS).join(', ')}`;
            console.warn("Standard directories not available.", debugInfo);

            // Fallback for Android: Storage Access Framework
            if (Platform.OS === 'android') {
                if (FS.StorageAccessFramework) {
                    const permissions = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        const createdUri = await FS.StorageAccessFramework.createFileAsync(
                            permissions.directoryUri,
                            fileName,
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        );

                        await FS.writeAsStringAsync(createdUri, wbout, { encoding: 'base64' });
                        return createdUri;
                    } else {
                        throw new Error("SAF Permission denied");
                    }
                } else {
                    throw new Error(`SAF not available on FS object. ${debugInfo}`);
                }
            }

            throw new Error(`No readable directory available. ${debugInfo}`);
        }

        await FS.writeAsStringAsync(uri, wbout, {
            encoding: 'base64'
        });

        return uri;
    } catch (error: any) {
        console.error("Export Error: ", error);
        throw new Error("Failed to create Excel file: " + error.message);
    }
};

export const shareExport = async (fileUri: string, fileName: string = "export.xlsx"): Promise<void> => {
    if (Platform.OS === 'web') {
        const link = document.createElement("a");
        link.href = fileUri;
        link.download = fileName; // Default name if not provided elsewhere, but logic usually handles it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        throw new Error("Sharing is not available on this device");
    }

    await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share Teacher Report',
        UTI: 'com.microsoft.excel.xlsx' // helpful for iOS
    });
};

export const handleExportProcess = async (options: ExportOptions): Promise<void> => {
    const { user, logs, schedules, month, year } = options;

    const rows = buildExportRows({ logs, schedules, month, year });

    if (rows.length === 0) {
        throw new Error("No data found for the selected month.");
    }

    const emailPart = user?.email?.replace('@', '_').replace('.', '_') || 'Unknown';
    const monthStr = (month + 1).toString().padStart(2, '0');
    const fileName = `TeacherTracker_${emailPart}_${year}-${monthStr}.xlsx`;

    const uri = await exportToXlsx(rows, fileName);
    await shareExport(uri, fileName);
};
