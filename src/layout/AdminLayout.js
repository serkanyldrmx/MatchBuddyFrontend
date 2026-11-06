import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Tooltip, Typography } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  PlusCircleOutlined,
  ScheduleOutlined,
  WarningOutlined,
  ShopOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { api, logout } from '../api/config';
import { PlayerAvatar } from '../ui';
import { fullName, isPast } from '../utils/format';
import { Brand, useAppBodyClass, useCurrentUser } from './AppLayout';
import './layout.css';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
export const RESERVATIONS_CHANGED = 'mb:reservations-changed';

const BASE = '/adminPanel';

/** Bekleyen (onay bekleyen ve tarihi geçmemiş) rezervasyon sayısı */
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
  const user = useCurrentUser();
  useAppBodyClass();
  const pending = usePendingCount();

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  const items = [
    { key: BASE, icon: <AppstoreOutlined />, label: 'Genel Bakış' },
    {
      key: `${BASE}/reservations`,
      icon: <ScheduleOutlined />,
      label: (
        <span className="mb-menu-badge">
          Rezervasyonlar <Badge count={pending} size="small" />
        </span>
      ),
    },
    { key: `${BASE}/matches`, icon: <CalendarOutlined />, label: 'Tüm Maçlar' },
    { key: `${BASE}/reports`, icon: <WarningOutlined />, label: 'Şikayetler' },
    { key: `${BASE}/businesses`, icon: <ShopOutlined />, label: 'İşletmeler' },
    { key: `${BASE}/osm`, icon: <GlobalOutlined />, label: 'Aday Tesis Bul' },
    {
      type: 'group',
      label: 'Halı Sahalar',
      children: [
        { key: `${BASE}/stadiums`, icon: <EnvironmentOutlined />, label: 'Halı Saha Listesi' },
        { key: `${BASE}/stadiums/new`, icon: <PlusCircleOutlined />, label: 'Halı Saha Ekle' },
      ],
    },
    {
      type: 'group',
      label: 'Kurumsal',
      children: [
        { key: `${BASE}/about`, icon: <InfoCircleOutlined />, label: 'Hakkımızda' },
        { key: `${BASE}/contact`, icon: <MailOutlined />, label: 'İletişim' },
      ],
    },
  ];

  // En uzun eşleşen menü anahtarı seçili olur
  const allKeys = [BASE, `${BASE}/reservations`, `${BASE}/matches`, `${BASE}/reports`, `${BASE}/businesses`, `${BASE}/osm`, `${BASE}/stadiums`, `${BASE}/stadiums/new`, `${BASE}/about`, `${BASE}/contact`];
  const path = location.pathname.replace(/\/$/, '');
  const selected = allKeys
    .filter((k) => path.toLowerCase() === k.toLowerCase() || path.toLowerCase().startsWith(`${k.toLowerCase()}/`))
    .sort((a, b) => b.length - a.length)[0] || BASE;

  const brand = <Brand to={BASE} badge="Admin" />;

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
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Çıkış yap',
        danger: true,
        onClick: () => {
          logout();
          window.location.href = '/';
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
          styles={{ body: { padding: 0, background: '#05080e' } }}
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
                <Button className="mb-icon-btn" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label="Menü" />
                <Brand to={BASE} variant="header" />
              </>
            )}
          </div>
          <div className="mb-header__right">
            <Tooltip title="Onay bekleyen rezervasyonlar">
              <Badge count={pending} size="small" offset={[-4, 4]}>
                <Button
                  className="mb-icon-btn"
                  icon={<ScheduleOutlined />}
                  onClick={() => navigate(`${BASE}/reservations`)}
                  aria-label="Rezervasyonlar"
                />
              </Badge>
            </Tooltip>
            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="mb-user-button">
                <PlayerAvatar player={user} size={34} />
                {!isMobile && (
                  <span className="mb-user-button__text">
                    <Text strong>{fullName(user)}</Text>
                    <Text type="secondary">Yönetici</Text>
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
