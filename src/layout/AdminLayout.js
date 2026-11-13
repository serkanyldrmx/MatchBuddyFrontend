import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  CalendarOutlined,
  ControlOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  PlusCircleOutlined,
  ScheduleOutlined,
  WarningOutlined,
  ShopOutlined,
  SolutionOutlined,
  GlobalOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { api, logout } from '../api/config';
import { PlayerAvatar } from '../ui';
import { fullName, isPast } from '../utils/format';
import { Brand, useAppBodyClass, useCurrentUser } from './AppLayout';
import { themeMenuItem } from '../theme/ThemeSwitch';
import './layout.css';
import useEdgeSwipe from './useEdgeSwipe';
import { bizAppsApi } from '../admin/BusinessApplications';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
export const RESERVATIONS_CHANGED = 'mb:reservations-changed';

const BASE = '/adminPanel';

/** Bekleyen (onay bekleyen ve tarihi geçmemiş) rezervasyon sayısı */
/** Bekleyen işletme başvurusu sayısı (menü rozeti) */
function useNewApplications() {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    bizAppsApi.newCount().then(setCount).catch(() => {});
  }, [pathname]);
  return count;
}

function usePendingCount() {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    api
      .get('/api/Match/GetMatchList')
      .then((r) => setCount((r.data || []).filter((m) => m.isActive === 1 && !isPast(m.matchDate)).length))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(RESERVATIONS_CHANGED, load);
    return () => window.removeEventListener(RESERVATIONS_CHANGED, load);
  }, [load]);
  return count;
}

/** Admin panelinin ortak iskeleti */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openNav = useCallback(() => setMobileNavOpen(true), []);
  const user = useCurrentUser();
  useAppBodyClass();
  const pending = usePendingCount();
  const newApps = useNewApplications();
  const { t } = useTranslation();

  useEffect(() => setMobileNavOpen(false), [location.pathname]);
  // Telefonda sol kenardan sağa kaydırma: menüyü aç
  useEdgeSwipe(isMobile, openNav);

  const items = [
    { key: BASE, icon: <AppstoreOutlined />, label: t('layout:admin.menu.overview') },
    {
      key: `${BASE}/reservations`,
      icon: <ScheduleOutlined />,
      label: (
        <span className="mb-menu-badge">
          {t('layout:admin.menu.reservations')} <Badge count={pending} size="small" />
        </span>
      ),
    },
    { key: `${BASE}/matches`, icon: <CalendarOutlined />, label: t('layout:admin.menu.matches') },
    { key: `${BASE}/reports`, icon: <WarningOutlined />, label: t('layout:admin.menu.reports') },
    { key: `${BASE}/businesses`, icon: <ShopOutlined />, label: t('layout:admin.menu.businesses') },
    {
      key: `${BASE}/applications`,
      icon: <SolutionOutlined />,
      label: (
        <span className="mb-menu-badge">
          {t('layout:admin.menu.applications')} <Badge count={newApps} size="small" />
        </span>
      ),
    },
    { key: `${BASE}/email`, icon: <MailOutlined />, label: t('layout:admin.menu.email') },
    { key: `${BASE}/osm`, icon: <GlobalOutlined />, label: t('layout:admin.menu.osm') },
    { key: `${BASE}/leads`, icon: <PhoneOutlined />, label: t('layout:admin.menu.leads') },
    { key: `${BASE}/parameters`, icon: <ControlOutlined />, label: t('layout:admin.menu.parameters') },
    {
      type: 'group',
      label: t('layout:admin.menu.venuesGroup'),
      children: [
        { key: `${BASE}/stadiums`, icon: <EnvironmentOutlined />, label: t('layout:admin.menu.venueList') },
        { key: `${BASE}/stadiums/new`, icon: <PlusCircleOutlined />, label: t('layout:admin.menu.venueAdd') },
      ],
    },
    {
      type: 'group',
      label: t('layout:admin.menu.corporateGroup'),
      children: [
        { key: `${BASE}/about`, icon: <InfoCircleOutlined />, label: t('layout:admin.menu.about') },
        { key: `${BASE}/contact`, icon: <MailOutlined />, label: t('layout:admin.menu.contact') },
      ],
    },
  ];

  // En uzun eşleşen menü anahtarı seçili olur
  const allKeys = [BASE, `${BASE}/reservations`, `${BASE}/matches`, `${BASE}/reports`, `${BASE}/businesses`, `${BASE}/osm`, `${BASE}/leads`, `${BASE}/parameters`, `${BASE}/stadiums`, `${BASE}/stadiums/new`, `${BASE}/about`, `${BASE}/contact`];
  const path = location.pathname.replace(/\/$/, '');
  const selected = allKeys
    .filter((k) => path.toLowerCase() === k.toLowerCase() || path.toLowerCase().startsWith(`${k.toLowerCase()}/`))
    .sort((a, b) => b.length - a.length)[0] || BASE;

  const brand = <Brand to={BASE} badge={t('layout:admin.badge')} />;

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selected]}
      items={items}
      onClick={({ key }) => navigate(key)}
    />
  );

  const userMenu = {
    items: [
      themeMenuItem(),
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('layout:userMenu.logout'),
        danger: true,
        onClick: () => {
          logout();
          window.location.href = '/login'; // çıkıştan sonra giriş ekranı
        },
      },
    ],
  };

  return (
    <Layout className="mb-shell">
      {!isMobile && (
        <Sider width={248} className="mb-sider">
          {brand}
          {menu}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={260}
          closable={false}
          rootClassName="mb-nav-drawer"
          styles={{ body: { padding: 0, background: 'var(--mb-sider-bg)' } }}
        >
          {brand}
          {menu}
        </Drawer>
      )}
      <Layout>
        <Header className="mb-header">
          <div className="mb-header__left">
            {isMobile && (
              <>
                <Button className="mb-icon-btn" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label={t('layout:header.menuAria')} />
                <Brand to={BASE} variant="header" />
              </>
            )}
          </div>
          <div className="mb-header__right">
            <Tooltip title={t('layout:admin.pendingTooltip')}>
              <Badge count={pending} size="small" offset={[-4, 4]}>
                <Button
                  className="mb-icon-btn"
                  icon={<ScheduleOutlined />}
                  onClick={() => navigate(`${BASE}/reservations`)}
                  aria-label={t('layout:admin.reservationsAria')}
                />
              </Badge>
            </Tooltip>
            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="mb-user-button">
                <PlayerAvatar player={user} size={34} />
                {!isMobile && (
                  <span className="mb-user-button__text">
                    <Text strong>{fullName(user)}</Text>
                    <Text type="secondary">{t('layout:admin.role')}</Text>
                  </span>
                )}
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="mb-content">
          <div className="mb-content__inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
