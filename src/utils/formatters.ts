import i18n from '../i18n/i18n';
import { formatDateDMY, formatTime24 } from './datetime';

export { formatDateDMY, formatTime24 } from './datetime';

/**
 * Hook for formatting numbers, dates, and currencies according to the current locale.
 * All dates → DD/MM/YYYY. All times → 24-hour HH:mm.
 */
export const useFormatting = () => {
    const locale = i18n.language || 'en';

    /**
     * Format a number according to the current locale
     */
    const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(locale, options).format(num);
    };

    /**
     * Format a date as DD/MM/YYYY (ignores Intl options for safety).
     * If you need Intl formatting (e.g., "Monday, 3 March"), pass `useIntl: true`
     * and provide options — used only for human-readable subtitles.
     */
    const formatDate = (
        date: Date | number,
        options?: Intl.DateTimeFormatOptions,
    ) => {
        try {
            const d = (typeof date === 'number' || typeof date === 'string') ? new Date(date as any) : date;
            if (!d || isNaN(d.getTime())) return '---';

            // If caller wants weekday/month-name style (dashboard subtitle etc.), use Intl
            if (options && (options.weekday || options.month === 'long' || options.month === 'short')) {
                return new Intl.DateTimeFormat(locale, options).format(d);
            }

            // Default: DD/MM/YYYY
            return formatDateDMY(d);
        } catch {
            return '---';
        }
    };

    /**
     * Format currency according to the current locale
     */
    const formatCurrency = (amount: number, currency = 'ILS') => {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
            }).format(amount);
        } catch {
            return `${amount} ${currency}`;
        }
    };

    /**
     * Format time as 24-hour HH:mm (always, regardless of locale)
     */
    const formatTime = (date: Date | number) => {
        return formatTime24(date);
    };

    return { formatNumber, formatDate, formatCurrency, formatTime };
};

/**
 * Static formatters for cases where hooks cannot be used (e.g. outside of components)
 */
export const staticFormatters = {
    formatDate: (date: Date | number, _locale = 'en') => {
        return formatDateDMY(date);
    },
    formatTime: (date: Date | number, _locale = 'en') => {
        return formatTime24(date);
    }
};
