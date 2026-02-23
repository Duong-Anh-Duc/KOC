import i18next from 'i18next';
import i18nextMiddleware from 'i18next-http-middleware';
import en from './locales/en.json';
import vi from './locales/vi.json';

i18next.use(i18nextMiddleware.LanguageDetector).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  fallbackLng: 'vi',
  preload: ['en', 'vi'],
  detection: {
    order: ['header'],
    lookupHeader: 'accept-language',
  },
  interpolation: {
    escapeValue: false,
  },
});

export const i18nMiddleware = i18nextMiddleware.handle(i18next);
export default i18next;
