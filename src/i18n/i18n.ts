import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';

import ar from './locales/ar.json';
import en from './locales/en.json';
import he from './locales/he.json';

const resources = {
    en: { translation: en },
    he: { translation: he },
    ar: { translation: ar },
};

export const LANGUAGE_KEY = 'user-language';

const initI18n = async () => {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (!savedLanguage) {
        const locales = Localization.getLocales();
        savedLanguage = locales && locales.length > 0 ? locales[0].languageCode : 'en';
    }

    if (!savedLanguage || !['en', 'he', 'ar'].includes(savedLanguage)) {
        savedLanguage = 'en';
    }

    await i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: savedLanguage,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false,
            },
            react: {
                useSuspense: false,
            },
        });

    applyRTLLogic(savedLanguage);
};

export const applyRTLLogic = (lang: string) => {
    const isRTL = lang === 'he' || lang === 'ar';

    if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.documentElement.lang = lang;
        }
    } else {
        if (I18nManager.isRTL !== isRTL) {
            I18nManager.allowRTL(isRTL);
            I18nManager.forceRTL(isRTL);
        }
    }
};

export const changeLanguage = async (lang: string, skipReload = false) => {
    const currentIsRTL = i18n.language === 'he' || i18n.language === 'ar';
    const newIsRTL = lang === 'he' || lang === 'ar';

    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    applyRTLLogic(lang);

    if (!skipReload && Platform.OS !== 'web' && currentIsRTL !== newIsRTL) {
        // Force reload for RTL changes
        await Updates.reloadAsync();
    }
};

// Only initialize if not in a static rendering environment or if we are on native
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
    initI18n().catch(err => console.error('i18n init failed', err));
}

export default i18n;
