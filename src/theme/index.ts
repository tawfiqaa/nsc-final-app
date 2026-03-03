import { darkColors } from './dark';
import { lightColors } from './light';
import { interaction, radius, spacing, ThemeColors } from './tokens';

export { interaction, radius, spacing, ThemeColors };

export const themes = {
    light: lightColors,
    dark: darkColors,
};

export type ThemeType = 'light' | 'dark';
