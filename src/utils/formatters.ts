import i18n from '../i18n/i18n';

/**
 * Hook for formatting numbers, dates, and currencies according to the current locale
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
     * Format a date according to the current locale
     */
    const formatDate = (date: Date | number, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, options).format(d);
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
        } catch (e) {
            return `${amount} ${currency}`;
        }
    };

    /**
     * Format time according to the current locale
     */
    const formatTime = (date: Date | number) => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    };

    return { formatNumber, formatDate, formatCurrency, formatTime };
};

/**
 * Static formatters for cases where hooks cannot be used (e.g. outside of components)
 */
export const staticFormatters = {
    formatDate: (date: Date | number, locale = 'en') => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
    },
    formatTime: (date: Date | number, locale = 'en') => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    }
};
