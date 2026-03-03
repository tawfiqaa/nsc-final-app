/**
 * Design Tokens for the TeacherTracker app.
 * All measurements and non-color constants go here.
 */

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
};

export const radius = {
    small: 12,
    medium: 16,
    large: 20,
    full: 9999,
};

export const interaction = {
    pressedScale: 0.97,
    pressedOpacity: 0.8,
};

export type ThemeColors = {
    backgroundPrimary: string;
    backgroundSecondary: string;
    surface: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    accentPrimary: string;
    accentSecondary: string;
    borderSubtle: string;
    divider: string;
    success: string;
    warning: string;
    danger: string;
    headerGradient: [string, string];
};
