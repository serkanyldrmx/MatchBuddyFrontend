import React, { createContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ConfigProvider, Grid } from 'antd';
import { getAntdTheme, palettes, themeColorMeta } from './theme';

/**
 * Açık / koyu tema.
 * - mode: kullanıcının seçimi — 'system' (işletim sistemine uyar) | 'light' | 'dark'. Varsayılan 'dark'.
 * - resolvedTheme: uygulanan tema — 'light' | 'dark'.
 * Seçim localStorage'da `mb.theme` anahtarında tutulur. public/index.html'deki küçük betik aynı
 * anahtarı React yüklenmeden okuyup <html data-theme> değerini ayarlar (ilk açılışta yanıp sönme olmaz).
 * Durum modül düzeyinde tutulur: useThemeMode() ThemeProvider dışında da çalışır.
 */
export const THEME_STORAGE_KEY = 'mb.theme';
export const THEME_MODES = ['system', 'light', 'dark'];
export const DEFAULT_THEME_MODE = 'dark';

const isMode = (v) => THEME_MODES.includes(v);

/**
 * Sunucudan (PlayerSettings.Theme) gelebilecek değerleri normalize eder:
 * 'System' | 'Light' | 'Dark', 0 | 1 | 2 (System, Light, Dark) veya küçük harfli adlar.
 */
export function normalizeThemeMode(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return THEME_MODES[value] ?? null;
  const v = String(value).trim().toLowerCase();
  if (/^\d+$/.test(v)) return THEME_MODES[Number(v)] ?? null;
  return isMode(v) ? v : null;
}

const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const systemTheme = () => (mql && !mql.matches ? 'light' : 'dark');

function readStoredMode() {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isMode(v) ? v : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

const resolve = (mode) => (mode === 'system' ? systemTheme() : mode);

let state = { mode: readStoredMode() };
state.resolvedTheme = resolve(state.mode);

const listeners = new Set(); // React aboneleri (useSyncExternalStore)
const changeListeners = new Set(); // kullanıcı değişikliği aboneleri (sunucu senkronu)

function applyToDocument(resolved, animate) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add('mb-theme-anim');
    window.clearTimeout(applyToDocument.t);
    applyToDocument.t = window.setTimeout(() => root.classList.remove('mb-theme-anim'), 350);
  }
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColorMeta[resolved]);
}

function setState(next, animate) {
  if (next.mode === state.mode && next.resolvedTheme === state.resolvedTheme) return;
  const themeChanged = next.resolvedTheme !== state.resolvedTheme;
  state = next;
  if (themeChanged) applyToDocument(state.resolvedTheme, animate);
  listeners.forEach((l) => l());
}

// İlk yükleme: index.html betiği zaten uyguladı; yine de (betik yoksa / eskiyse) eşitle
applyToDocument(state.resolvedTheme, false);

/**
 * Tema seçimini değiştirir ve localStorage'a yazar.
 * options.silent: true ise sunucu-senkron dinleyicileri tetiklenmez (ör. değer zaten sunucudan geldiyse).
 */
export function setThemeMode(mode, { silent = false } = {}) {
  const m = normalizeThemeMode(mode);
  if (!m) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, m);
  } catch {
    /* gizli sekme vb.: sadece bu oturumda geçerli */
  }
  const changed = m !== state.mode;
  setState({ mode: m, resolvedTheme: resolve(m) }, true);
  if (changed && !silent) changeListeners.forEach((l) => l(m));
}

/** Kullanıcının tema seçimi değiştiğinde çağrılır; aboneliği kaldıran fonksiyon döner. */
export function onThemeModeChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

// İşletim sistemi teması değişince ('system' modunda) ve başka sekmede seçim değişince güncelle
if (mql) {
  const onSystemChange = () => {
    if (state.mode === 'system') setState({ mode: 'system', resolvedTheme: systemTheme() }, true);
  };
  if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
  else if (mql.addListener) mql.addListener(onSystemChange);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    const m = isMode(e.newValue) ? e.newValue : DEFAULT_THEME_MODE;
    setState({ mode: m, resolvedTheme: resolve(m) }, true);
  });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

const ThemeContext = createContext(null);

const toValue = (s) => ({
  mode: s.mode,
  resolvedTheme: s.resolvedTheme,
  isDark: s.resolvedTheme === 'dark',
  setMode: setThemeMode,
  palette: palettes[s.resolvedTheme],
});

/**
 * { mode, resolvedTheme, isDark, setMode, palette }
 * palette: uygulanan temanın somut renkleri (CSS değişkeni kullanılamayan Leaflet/SVG nitelikleri için).
 * Modül düzeyindeki durumu okur: ThemeProvider dışında da çalışır.
 */
export function useThemeMode() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => toValue(s), [s]);
}

/**
 * Sunucudaki tercihle eşitleme (PlayerSettings.Theme alanı eklendiğinde):
 *   useThemePreferenceSync(settings?.theme, (mode) => api.put('/api/PlayerSettings', { ...settings, theme: mode }));
 * - serverMode gelince (ve değişince) yerel seçime uygulanır (sunucuya geri yazılmaz).
 * - Kullanıcı seçici ile değiştirince save(mode) çağrılır.
 */
export function useThemePreferenceSync(serverMode, save) {
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const m = normalizeThemeMode(serverMode);
    if (m) setThemeMode(m, { silent: true });
  }, [serverMode]);
  useEffect(() => onThemeModeChange((m) => saveRef.current?.(m)), []);
}

/**
 * Uygulamanın kökü: antd ConfigProvider'ı aktif temaya (ve telefon kırılımına) göre kurar.
 * Diğer prop'lar (locale vb.) ConfigProvider'a aktarılır.
 */
export function ThemeProvider({ children, ...configProps }) {
  const value = useThemeMode();
  // Telefonlarda (md altı) dokunmaya uygun kontrol boyları; masaüstü teması aynen kalır
  const screens = Grid.useBreakpoint();
  const antTheme = getAntdTheme(value.resolvedTheme, screens.md === false);
  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider {...configProps} theme={antTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
