import { theme as antdTheme } from 'antd';

// Match Buddy tasarım sistemi — "gece maçı" teması.
// Renk değişiklikleri sadece buradan ve App.css'teki :root değişkenlerinden yapılmalıdır.
export const colors = {
  primary: '#c6f432', // neon çim yeşili (CTA, vurgular)
  primaryText: '#0b1405', // primary zemin üstündeki yazı
  pitch: '#22c55e', // saha yeşili
  gold: '#fbbf24', // MVP, puan
  danger: '#f43f5e',
  info: '#38bdf8',
  bg: '#070b12',
  surface: '#0e1520',
  surface2: '#141d2b',
  border: 'rgba(148, 163, 184, 0.14)',
  text: '#e8eef6',
  textSecondary: '#8b9bb0',
  home: '#c6f432',
  away: '#38bdf8',
};

export const appTheme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: colors.primary,
    colorSuccess: colors.pitch,
    colorWarning: colors.gold,
    colorError: colors.danger,
    colorInfo: colors.info,
    colorLink: colors.primary,
    colorBgBase: colors.bg,
    colorBgLayout: colors.bg,
    colorBgContainer: colors.surface,
    colorBgElevated: colors.surface2,
    colorBorder: 'rgba(148, 163, 184, 0.22)',
    colorBorderSecondary: colors.border,
    colorText: colors.text,
    colorTextSecondary: colors.textSecondary,
    borderRadius: 10,
    borderRadiusLG: 16,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    controlHeight: 38,
  },
  components: {
    Layout: {
      siderBg: '#05080e',
      headerBg: 'rgba(7, 11, 18, 0.72)',
      bodyBg: colors.bg,
      headerHeight: 68,
      headerPadding: '0 28px',
    },
    Menu: {
      darkItemBg: '#05080e',
      darkSubMenuItemBg: '#05080e',
      darkItemSelectedBg: 'rgba(198, 244, 50, 0.12)',
      darkItemSelectedColor: colors.primary,
      darkItemColor: 'rgba(232, 238, 246, 0.62)',
      darkItemHoverColor: '#ffffff',
      darkGroupTitleColor: 'rgba(232, 238, 246, 0.35)',
      itemBorderRadius: 10,
      itemMarginInline: 12,
      itemHeight: 44,
    },
    Button: {
      primaryColor: colors.primaryText,
      fontWeight: 600,
      primaryShadow: '0 6px 20px rgba(198, 244, 50, 0.25)',
    },
    Card: {
      headerFontSize: 15,
    },
    Table: {
      headerBg: colors.surface2,
      rowHoverBg: 'rgba(198, 244, 50, 0.04)',
    },
    Segmented: {
      itemSelectedBg: colors.primary,
      itemSelectedColor: colors.primaryText,
      trackBg: colors.surface2,
    },
    Drawer: {
      colorBgElevated: colors.surface,
    },
    Modal: {
      contentBg: colors.surface,
      headerBg: colors.surface,
    },
    Tag: {
      defaultBg: colors.surface2,
    },
  },
};
