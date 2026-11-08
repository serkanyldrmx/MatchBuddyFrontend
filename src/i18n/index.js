import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import relativeTime from 'dayjs/plugin/relativeTime';
import trTR from 'antd/locale/tr_TR';

/**
 * Çoklu dil (i18n) kurulumu.
 * Metinler src/locales/<dil>/<namespace>.json dosyalarındadır; bu klasördeki tüm JSON'lar otomatik yüklenir.
 * Yeni dil eklemek için: src/locales/<dil>/ altına aynı namespace dosyalarını ekleyin,
 * aşağıdaki DAYJS_LOCALES / ANTD_LOCALES tablolarına dilin dayjs ve antd yerel ayarlarını ekleyin.
 */

export const LANG_STORAGE_KEY = 'mb.lang';
export const DEFAULT_LANG = 'tr';

// src/locales/<lang>/<ns>.json → { [lang]: { [ns]: {...} } }
const resources = {};
const ctx = require.context('../locales', true, /^\.\/[a-zA-Z-]+\/[a-zA-Z]+\.json$/);
ctx.keys().forEach((path) => {
  const [, lang, ns] = path.match(/^\.\/([a-zA-Z-]+)\/([a-zA-Z]+)\.json$/);
  resources[lang] = resources[lang] || {};
  resources[lang][ns] = ctx(path);
});

export const SUPPORTED_LANGS = Object.keys(resources);
export const NAMESPACES = Object.keys(resources[DEFAULT_LANG] || {});

// dayjs yerel ayarları (yeni dil eklenince 'dayjs/locale/<dil>' import edilip buraya eklenir)
const DAYJS_LOCALES = { tr: 'tr' };
// antd bileşen metinleri (DatePicker, Table, Pagination vb.)
const ANTD_LOCALES = { tr: trTR };
// Sayı/para biçimlendirme için Intl yerel ayarı
const INTL_LOCALES = { tr: 'tr-TR' };

dayjs.extend(relativeTime);

const readStoredLang = () => {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
};

const initialLang = (() => {
  const stored = readStoredLang();
  return stored && SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
})();

const applyLanguage = (lng) => {
  const lang = (lng || DEFAULT_LANG).split('-')[0];
  dayjs.locale(DAYJS_LOCALES[lang] || DAYJS_LOCALES[DEFAULT_LANG]);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
};

i18n.on('languageChanged', applyLanguage);

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED_LANGS,
  ns: NAMESPACES,
  defaultNS: 'common',
  initAsync: false,
  returnNull: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

applyLanguage(i18n.language);

/** Dili değiştirir ve tercihi saklar */
export const changeLanguage = (lng) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* depolama yoksa yalnızca oturum için değişir */
  }
  return i18n.changeLanguage(lng);
};

const baseLang = (lng) => (lng || i18n.language || DEFAULT_LANG).split('-')[0];

/** Dile göre antd locale nesnesi */
export const antdLocaleFor = (lng) => ANTD_LOCALES[baseLang(lng)] || ANTD_LOCALES[DEFAULT_LANG];

/** Dile göre Intl yerel ayarı (toLocaleString vb. için) */
export const intlLocale = (lng) => INTL_LOCALES[baseLang(lng)] || INTL_LOCALES[DEFAULT_LANG];

/**
 * Sabit etiket tabloları için: erişildiği anda (render sırasında) çevrilen nesne.
 *   const SURFACE = localizedMap({ 1: 'venues:surface.artificial', ... });  SURFACE[1] → çevrilmiş metin
 */
export const localizedMap = (keys) => {
  const out = {};
  Object.entries(keys).forEach(([k, key]) => {
    Object.defineProperty(out, k, { enumerable: true, get: () => i18n.t(key) });
  });
  return out;
};

/** Sabit etiket dizileri için: elemanlar erişildiği anda çevrilir (map/filter/[i] çalışır). */
export const localizedList = (keys) => {
  const out = new Array(keys.length);
  keys.forEach((key, i) => {
    Object.defineProperty(out, i, { enumerable: true, get: () => i18n.t(key) });
  });
  return out;
};

export default i18n;
