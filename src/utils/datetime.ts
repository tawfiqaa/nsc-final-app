/**
 * datetime.ts — Timezone-safe date/time utilities
 *
 * Core rules:
 *  - DOB is always stored and handled as "YYYY-MM-DD" (string, no time component)
 *  - All displayed dates use DD/MM/YYYY
 *  - All displayed times use 24-hour HH:mm
 *  - Never use new Date("YYYY-MM-DD") for display (causes UTC midnight → local shift)
 */

// ─── DOB helpers (date-only, timezone-safe) ──────────────────────────────────

/**
 * Convert a JS Date to an ISO date-only string "YYYY-MM-DD"
 * using LOCAL date parts (not UTC) to avoid timezone shift.
 */
export function dateToISODateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Parse an ISO date-only string "YYYY-MM-DD" into parts.
 * Do NOT use new Date(iso) — it parses as UTC midnight and shifts in local time.
 */
export function parseISODateOnly(iso: string): { year: number; month: number; day: number } | null {
    if (!iso || typeof iso !== 'string') return null;
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [year, month, day] = parts;
    return { year, month, day };
}

/**
 * Build a local Date from "YYYY-MM-DD" without UTC shift.
 * month is 1-based in the string, but Date() expects 0-based.
 */
export function isoDateOnlyToLocalDate(iso: string): Date | null {
    const parsed = parseISODateOnly(iso);
    if (!parsed) return null;
    return new Date(parsed.year, parsed.month - 1, parsed.day);
}

/**
 * Format an ISO date-only string "YYYY-MM-DD" → "DD/MM/YYYY"
 * without any Date parsing to avoid timezone issues.
 */
export function formatISODateOnlyToDMY(iso: string): string {
    const parsed = parseISODateOnly(iso);
    if (!parsed) return '---';
    const { year, month, day } = parsed;
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}


// ─── General date/time formatters ────────────────────────────────────────────

/**
 * Format any Date to DD/MM/YYYY using local date parts.
 */
export function formatDateDMY(date: Date | number | string | null | undefined): string {
    try {
        if (!date) return '---';
        const d = date instanceof Date ? date : new Date(date as any);
        if (isNaN(d.getTime())) return '---';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return '---';
    }
}

/**
 * Format any Date to 24-hour HH:mm using local time parts.
 */
export function formatTime24(date: Date | number | string | null | undefined): string {
    try {
        if (!date) return '--:--';
        const d = date instanceof Date ? date : new Date(date as any);
        if (isNaN(d.getTime())) return '--:--';
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    } catch {
        return '--:--';
    }
}

/**
 * Format any Date to "DD/MM/YYYY HH:mm" (combined date + time).
 */
export function formatDateTimeDMY(date: Date | number | string | null | undefined): string {
    const d = formatDateDMY(date);
    const t = formatTime24(date);
    if (d === '---') return '---';
    return `${d} ${t}`;
}

/**
 * Convert a legacy Firestore Timestamp DOB (if it exists) to "YYYY-MM-DD" string.
 * Safe to call on already-string values too.
 */
export function migrateDOBToString(rawDOB: any): string | null {
    if (!rawDOB) return null;

    // Already a clean string
    if (typeof rawDOB === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDOB)) {
        return rawDOB;
    }

    // Firestore Timestamp object
    if (rawDOB?.toDate) {
        const d: Date = rawDOB.toDate();
        return dateToISODateOnly(d);
    }

    // Unix seconds number
    if (typeof rawDOB === 'number') {
        const d = new Date(rawDOB * 1000);
        return dateToISODateOnly(d);
    }

    // ISO string with time (e.g. "2000-03-10T00:00:00.000Z") — use local parts after parsing
    if (typeof rawDOB === 'string') {
        try {
            const d = new Date(rawDOB);
            if (!isNaN(d.getTime())) return dateToISODateOnly(d);
        } catch { /* ignore */ }
    }

    return null;
}
