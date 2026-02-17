import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { AttendanceLog, Schedule, User } from '../types';

export const exportToExcel = async (data: any[], fileName: string) => {
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");

        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

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
        } else if (FS.Paths && (FS.Paths.document || FS.Paths.cache)) {
            // Support for new FileSystem API
            const baseDir = FS.Paths.document || FS.Paths.cache;
            const basePath = typeof baseDir === 'string' ? baseDir : (baseDir.uri || baseDir.path || baseDir.toString());
            uri = basePath.replace(/\/$/, '') + '/' + fileName;
        } else {
            const debugInfo = `Platform: ${Platform.OS}, FS Keys: ${Object.keys(FS).join(', ')}`;
            console.log("Debug FS:", debugInfo);

            // Fallback for Android: Storage Access Framework
            if (Platform.OS === 'android') {
                const SAF = FS.StorageAccessFramework;
                if (SAF) {
                    const permissions = await SAF.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        const createdUri = await SAF.createFileAsync(
                            permissions.directoryUri,
                            fileName,
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        );

                        await FS.writeAsStringAsync(createdUri, wbout, { encoding: 'base64' });
                        await Sharing.shareAsync(createdUri, {
                            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            dialogTitle: 'Export Report'
                        });
                        return;
                    } else {
                        throw new Error("SAF Permission denied");
                    }
                } else {
                    // If SAF is missing, we might fail here, but let's see if we fall through to generic error.
                }
            }
            throw new Error(`No directory available. ${debugInfo}`);
        }

        await FS.writeAsStringAsync(uri, wbout, {
            encoding: 'base64'
        });

        await Sharing.shareAsync(uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Report'
        });

    } catch (e: any) {
        console.error("Export failed", e);
        throw new Error(e.message || "Export failed");
    }
};

export const generateMonthlyReportData = (user: User, logs: AttendanceLog[], schedules: Schedule[]) => {
    // Filter logs for current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyLogs = logs.filter(log => {
        const logDate = new Date(log.dateISO);
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    });

    // Map to simple object
    return monthlyLogs.map(log => {
        const date = new Date(log.dateISO);
        // Find distance if not in log (it should be in log for 'present', 0 for 'absent')
        // For report, we might want "Potential" if they were absent? 
        // User asked: "how many lessons? when was every lesson? the length... and distance".
        // Use log values.

        return {
            "Teacher Name": user.name || user.email,
            "School": log.school,
            "Date": format(date, 'yyyy-MM-dd'),
            "Time": format(date, 'HH:mm'),
            "Status": log.status,
            "Duration (hrs)": log.hours,
            "Distance (km)": log.distance
        };
    });
};

export const generateSchoolHistoryData = (user: User, schoolName: string, logs: AttendanceLog[]) => {
    const schoolLogs = logs.filter(l => l.school === schoolName);

    return schoolLogs.map(log => {
        const date = new Date(log.dateISO);
        return {
            "Teacher Name": user.name || user.email,
            "School": log.school,
            "Date": format(date, 'yyyy-MM-dd'),
            "Time": format(date, 'HH:mm'),
            "Status": log.status,
            "Duration (hrs)": log.hours,
            "Distance (km)": log.distance
        };
    });
};
