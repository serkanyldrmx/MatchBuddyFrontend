import { theme as antdTheme } from 'antd';

// MatcBuddy tasarım sistemi — koyu ("gece maçı") ve açık ("gündüz maçı") tema.
// Renk değişiklikleri sadece buradan ve App.css'teki --mb-* değişkenlerinden yapılmalıdır.
// İki dosyadaki değerler birbiriyle eşleşmelidir.

/** Koyu tema: somut renkler (antd token'ları, Leaflet gibi CSS değişkeni okuyamayan yerler) */
export const darkPalette = {
  primary: '#c6f432', // neon çim yeşili (CTA, vurgular)
  primaryFill: '#c6f432', // dolgu (üstünde primaryText)
  primaryText: '#0b1405', // primary zemin üstündeki yazı
  pitch: '#22c55e', // saha yeşili
  gold: '#fbbf24', // MVP, puan
  danger: '#f43f5e',
  info: '#38bdf8',
  bg: '#070b12',
  surface: '#0e1520',
  surface2: '#141d2b',
  sider: '#05080e',
  border: 'rgba(148, 163, 184, 0.14)',
  borderStrong: 'rgba(148, 163, 184, 0.22)',
  text: '#e8eef6',
  textSecondary: '#8b9bb0',
  home: '#c6f432',
  away: '#38bdf8',
};

/**
 * Açık tema: kireç yeşili sadece koyu yazılı dolgu olarak kalır;
 * açık zeminde yazı/bağlantı/çizgi için koyu yeşil (#467211, beyaz üstünde ~5.7:1).
 */
export const lightPalette = {
  primary: '#467211',
  primaryFill: '#c6f432',
  primaryText: '#0b1405',
  pitch: '#15803d',
  gold: '#b45309',
  danger: '#e11d48',
  info: '#0369a1',
  bg: '#f3f6f1',
  surface: '#ffffff',
  surface2: '#eef2ea',
  sider: '#ffffff',
  border: 'rgba(22, 38, 26, 0.11)',
  borderStrong: 'rgba(22, 38, 26, 0.18)',
  text: '#111a14',
  textSecondary: '#4a5a50',
  home: '#467211',
  away: '#0369a1',
};

export const palettes = { dark: darkPalette, light: lightPalette };

/** <meta name="theme-color"> değerleri (public/index.html'deki açılış betiğiyle aynı) */
export const themeColorMeta = { dark: darkPalette.bg, light: lightPalette.bg };

/**
 * Bileşenlerin style/prop'larında kullanılacak renkler: CSS değişkenleri olduğu için
 * tema değişince yeniden render gerekmeden güncellenir. (SVG/Leaflet niteliklerinde
 * CSS değişkeni çalışmaz; orada useThemeMode().palette kullanın.)
 */
export const colors = {
  primary: 'var(--mb-primary)',
  primaryFill: 'var(--mb-primary-fill)',
  primaryText: 'var(--mb-primary-ink)',
  pitch: 'var(--mb-pitch)',
  gold: 'var(--mb-gold)',
  danger: 'var(--mb-danger)',
  info: 'var(--mb-info)',
  bg: 'var(--mb-bg)',
  surface: 'var(--mb-surface)',
  surface2: 'var(--mb-surface-2)',
  border: 'var(--mb-border)',
  text: 'var(--mb-text)',
  textSecondary: 'var(--mb-text-2)',
  home: 'var(--mb-home)',
  away: 'var(--mb-away)',
};

const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function baseTheme(mode) {
  const c = palettes[mode];
  const light = mode === 'light';
  return {
    algorithm: light ? antdTheme.defaultAlgorithm : antdTheme.darkAlgorithm,
    token: {
      colorPrimary: c.primary,
      colorSuccess: light ? '#16a34a' : c.pitch,
      colorWarning: light ? '#d97706' : c.gold,
      colorError: c.danger,
      colorInfo: light ? '#0284c7' : c.info,
      colorLink: c.primary,
      ...(light ? { colorLinkHover: '#3a5f0d', colorTextBase: c.text } : {}),
      colorBgBase: light ? '#ffffff' : c.bg,
      colorBgLayout: c.bg,
      colorBgContainer: c.surface,
      colorBgElevated: light ? '#ffffff' : c.surface2,
      colorBorder: c.borderStrong,
      colorBorderSecondary: c.border,
      colorText: c.text,
      colorTextSecondary: c.textSecondary,
      ...(light
        ? {
            colorTextTertiary: '#66756c',
            colorTextQuaternary: 'rgba(17, 26, 20, 0.32)',
            boxShadowSecondary: '0 12px 32px rgba(22, 38, 26, 0.12), 0 2px 6px rgba(22, 38, 26, 0.06)',
          }
        : {}),
      borderRadius: 10,
      borderRadiusLG: 16,
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      controlHeight: 38,
    },
    components: {
      Layout: {
        siderBg: c.sider,
        headerBg: light ? 'rgba(255, 255, 255, 0.8)' : 'rgba(7, 11, 18, 0.72)',
        bodyBg: c.bg,
        headerHeight: 68,
        headerPadding: '0 28px',
      },
      // Kabuklardaki menüler theme="dark" kullanır; açık temada "dark*" token'ları açık renklere döner
      Menu: light
        ? {
            darkItemBg: c.sider,
            darkSubMenuItemBg: c.sider,
            darkPopupBg: c.sider,
            darkItemSelectedBg: 'rgba(70, 114, 17, 0.1)',
            darkItemSelectedColor: '#3a5f0d',
            darkItemColor: 'rgba(17, 26, 20, 0.7)',
            darkItemHoverColor: '#111a14',
            darkItemHoverBg: 'rgba(17, 26, 20, 0.05)',
            darkGroupTitleColor: 'rgba(17, 26, 20, 0.45)',
            darkDangerItemColor: c.danger,
            itemBorderRadius: 10,
            itemMarginInline: 12,
            itemHeight: 44,
          }
        : {
            darkItemBg: c.sider,
            darkSubMenuItemBg: c.sider,
            darkItemSelectedBg: 'rgba(198, 244, 50, 0.12)',
            darkItemSelectedColor: c.primary,
            darkItemColor: 'rgba(232, 238, 246, 0.62)',
            darkItemHoverColor: '#ffffff',
            darkGroupTitleColor: 'rgba(232, 238, 246, 0.35)',
            itemBorderRadius: 10,
            itemMarginInline: 12,
            itemHeight: 44,
          },
      Button: {
        // Birincil buton her iki temada da kireç yeşili dolgu + koyu yazı
        primaryColor: c.primaryText,
        fontWeight: 600,
        primaryShadow: light ? '0 6px 18px rgba(120, 160, 20, 0.28)' : '0 6px 20px rgba(198, 244, 50, 0.25)',
        ...(light
          ? {
              colorPrimary: c.primaryFill,
              colorPrimaryHover: '#b9ea1f',
              colorPrimaryActive: '#a8d614',
              defaultHoverColor: c.primary,
              defaultHoverBorderColor: c.primary,
              defaultActiveColor: '#3a5f0d',
              defaultActiveBorderColor: '#3a5f0d',
              colorLink: c.primary,
              colorLinkHover: '#3a5f0d',
              colorLinkActive: '#2f4d0a',
            }
          : {}),
      },
      Card: {
        headerFontSize: 15,
      },
      Table: {
        headerBg: c.surface2,
        rowHoverBg: light ? 'rgba(70, 114, 17, 0.05)' : 'rgba(198, 244, 50, 0.04)',
      },
      Segmented: {
        itemSelectedBg: c.primaryFill,
        itemSelectedColor: c.primaryText,
        trackBg: c.surface2,
        ...(light ? { itemColor: c.textSecondary, itemHoverColor: c.text } : {}),
      },
      Drawer: {
        colorBgElevated: c.surface,
      },
      Modal: {
        contentBg: c.surface,
        headerBg: c.surface,
      },
      Tag: {
        defaultBg: c.surface2,
      },
      // Spin göstergesi futbol topu (src/ui/BallLoader): kutu boyutları top boyutlarıyla eşleşir
      Spin: {
        dotSizeSM: 26,
        dotSize: 54,
        dotSizeLG: 96,
      },
    },
  };
}

// Telefon (< 768 px): parmakla dokunmaya uygun, en az 44 px yüksekliğinde kontroller.
// Masaüstü görünümü değişmesin diye sadece md kırılımının altında kullanılır.
function withMobile(base) {
  return {
    ...base,
    token: {
      ...base.token,
      controlHeight: 44,
      controlHeightLG: 50,
      controlHeightSM: 30,
    },
    components: {
      ...base.components,
      Layout: {
        ...base.components.Layout,
        headerHeight: 60,
        headerPadding: '0 12px',
      },
      // iOS Safari 16px'ten küçük yazılı alana odaklanınca sayfayı yakınlaştırır
      Input: { inputFontSize: 16 },
      InputNumber: { inputFontSize: 16 },
      DatePicker: { fontSize: 16 },
      Mentions: { fontSize: 16 },
      Select: { fontSize: 16 },
      Cascader: { fontSize: 16 },
      TreeSelect: { fontSize: 16 },
    },
  };
}

const themeCache = {};

/** antd ConfigProvider teması: mode = 'light' | 'dark', mobile = telefon (< 768 px) */
export function getAntdTheme(mode = 'dark', mobile = false) {
  const m = mode === 'light' ? 'light' : 'dark';
  const key = `${m}:${mobile ? 'm' : 'd'}`;
  if (!themeCache[key]) themeCache[key] = mobile ? withMobile(baseTheme(m)) : baseTheme(m);
  return themeCache[key];
}

// Geriye dönük uyumluluk (koyu tema)
export const appTheme = getAntdTheme('dark', false);
export const mobileTheme = getAntdTheme('dark', true);
