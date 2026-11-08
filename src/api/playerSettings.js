import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { App } from 'antd';
import i18n, { changeLanguage, SUPPORTED_LANGS } from '../i18n';
import { useThemePreferenceSync } from '../theme/ThemeContext';
import { apiErrorMessage } from '../utils/format';
import { getToken } from './config';
import { socialApi } from './social';

/**
 * Oyuncu tercihleri (PlayerSettings) — sözleşme: MatchBuddy/docs/social-api.md + platform-api.md §6
 * GET/POST /api/Social/Settings: gizlilik, bildirimler, theme ('system' | 'light' | 'dark'), language ('tr' …).
 *
 * Ayarlar modül düzeyinde tek kaynakta tutulur: Ayarlar sayfası, tema seçici ve dil seçici aynı veriyi kullanır,
 * böylece bir kaydetme diğerinin değerini eski hâliyle ezmez.
 */

let state = { settings: null, loading: false, loaded: false, error: null };
let inflight = null;
const listeners = new Set();
const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

/** Ayarları sunucudan yükler (eşzamanlı çağrılar aynı isteği paylaşır). */
export function loadPlayerSettings({ force = false } = {}) {
  if (state.loaded && !force) return Promise.resolve(state.settings);
  if (inflight) return inflight;
  setState({ loading: true, error: null });
  inflight = socialApi
    .getSettings()
    .then((settings) => {
      setState({ settings: settings || {}, loading: false, loaded: true, error: null });
      return state.settings;
    })
    .catch((e) => {
      setState({ loading: false, error: e });
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Değişikliği hemen uygular (iyimser) ve sunucuya kaydeder; hata olursa yalnızca değiştirilen alanlar geri alınır.
 * POST gövdesi mevcut tüm ayarları içerir (sunucu eksik alanları korusa da güvenli taraf).
 */
export async function savePlayerSettings(patch) {
  const before = state.settings || {};
  const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k]]));
  setState({ settings: { ...before, ...patch } });
  try {
    return await socialApi.saveSettings({ ...state.settings });
  } catch (e) {
    setState({ settings: { ...(state.settings || {}), ...previous } });
    throw e;
  }
}

/** { settings, loading, loaded, error, reload, save } */
export function usePlayerSettings() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const reload = useCallback(() => loadPlayerSettings({ force: true }).catch(() => null), []);
  return { ...s, reload, save: savePlayerSettings };
}

const baseLang = (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase().split('-')[0] : null);

/** Bu istemcide kullanılabilen diller: [{ value, label }] — etiket her dilin kendi common:languageName metni */
export const availableLanguages = () =>
  SUPPORTED_LANGS.map((lng) => ({
    value: lng,
    label: i18n.getResource(lng, 'common', 'languageName') || lng,
  }));

/** Arayüz dilini değiştirir ve PlayerSettings.language olarak kaydeder (oturum açıksa). */
export async function changePlayerLanguage(lng) {
  const lang = baseLang(lng);
  if (!lang || !SUPPORTED_LANGS.includes(lang)) return;
  await changeLanguage(lang);
  if (getToken()) await savePlayerSettings({ language: lang });
}

/**
 * Oturum açmış oyuncunun sunucudaki tema/dil tercihini uygular ve tema değişikliklerini sunucuya yazar.
 * Oyuncu kabuğunda (AppLayout) bir kez çağrılır.
 *  - Açılışta ayarlar yüklenir; theme → ThemeProvider (useThemePreferenceSync), language → i18n.
 *  - Kullanıcı temayı (ayarlar sayfası ya da kullanıcı menüsü) değiştirince PlayerSettings.theme kaydedilir.
 */
export function usePlayerPreferencesSync() {
  const { message } = App.useApp();
  const { settings } = usePlayerSettings();
  const appliedLang = useRef(null);

  useEffect(() => {
    if (getToken()) loadPlayerSettings().catch(() => {});
  }, []);

  useThemePreferenceSync(settings?.theme, (mode) => {
    if (!getToken()) return;
    savePlayerSettings({ theme: mode }).catch((e) => message.error(apiErrorMessage(e, i18n.t('settings:saveError'))));
  });

  const serverLang = baseLang(settings?.language);
  useEffect(() => {
    // Sunucudaki dil bu istemcide varsa uygula (yoksa — ör. henüz çevirisi eklenmemiş bir dil — mevcut dilde kal)
    if (!serverLang || appliedLang.current === serverLang || !SUPPORTED_LANGS.includes(serverLang)) return;
    appliedLang.current = serverLang;
    if (baseLang(i18n.language) !== serverLang) changeLanguage(serverLang);
  }, [serverLang]);
}
