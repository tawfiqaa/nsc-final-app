import { AttendanceLog, PayrollSettings } from '../types';

/**
 * Shared logic for calculating payroll totals from a set of lesson logs.
 */
export const computePayrollTotals = (
    logs: AttendanceLog[],
    settings: PayrollSettings | null,
    startDate?: Date,
    endDate?: Date
) => {
    // Filter by date range if provided
    let filteredLogs = logs;
    if (startDate && endDate) {
        filteredLogs = logs.filter(log => {
            const d = new Date(log.dateISO);
            return d >= startDate && d <= endDate;
        });
    }

    // Only count "present" logs for payment
    const presentLogs = filteredLogs.filter(log => log.status === 'present');

    const totalHours = presentLogs.reduce((acc, log) => acc + (log.hours || 0), 0);
    const totalDistance = presentLogs.reduce((acc, log) => acc + (log.distance || 0), 0);

    const hourlyRate = settings?.hourlyRate || 0;
    const kmRate = settings?.kmRate || 0;

    const hoursPay = totalHours * hourlyRate;
    const kmPay = totalDistance * kmRate;
    const totalPay = hoursPay + kmPay;

    return {
        totalHours,
        totalDistance,
        hoursPay,
        kmPay,
        totalPay,
        lessonsCount: presentLogs.length,
        totalLessonsCount: filteredLogs.length,
        ratesMissing: !settings || (hourlyRate === 0 && kmRate === 0)
    };
};
