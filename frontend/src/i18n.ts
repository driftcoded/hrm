import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import vi from '@/locales/vi.json';
import en from '@/locales/en.json';
import { useUiStore, type Locale } from '@/store/uiStore';

const SUPPORTED_LOCALES: Locale[] = ['vi', 'en'];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { common: vi },
      en: { common: en },
    },
    ns: ['common'],
    defaultNS: 'common',
    // uiStore (persisted to localStorage) is the source of truth for the
    // user's chosen locale; language-detector only kicks in before uiStore
    // has ever been written (first-ever visit).
    lng: useUiStore.getState().locale,
    fallbackLng: 'vi',
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hrm-i18n-lng',
    },
  });

// Keep i18next <-> uiStore.locale in sync in both directions so either the
// language switcher (writes uiStore) or i18n.changeLanguage() (called
// directly) keeps the other consistent.
i18n.on('languageChanged', (lng) => {
  if ((SUPPORTED_LOCALES as string[]).includes(lng) && useUiStore.getState().locale !== lng) {
    useUiStore.getState().setLocale(lng as Locale);
  }
});

useUiStore.subscribe((state, prevState) => {
  if (state.locale !== prevState.locale && i18n.language !== state.locale) {
    void i18n.changeLanguage(state.locale);
  }
});

export default i18n;
