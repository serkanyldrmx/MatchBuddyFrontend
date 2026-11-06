import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Dropdown, Grid, Layout, Menu, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  EditOutlined,
  FlagOutlined,
  InboxOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  TrophyOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { logout } from '../api/config';
import { useMessages } from '../messaging/MessagesContext';
import { PlayerAvatar } from '../ui';
import { fullName, getCurrentUser } from '../utils/format';
import NotificationBell from './NotificationBell';
import InvitesButton from './InvitesButton';
import Logo from '../images/mutch_buddy_Logo.png';
import './layout.css';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
export const USER_CHANGED = 'mb:user-changed';

const MENU = [
  { key: '/home', icon: <HomeOutlined />, label: 'Maçlar' },
  { key: '/feed', icon: <ThunderboltOutlined />, label: 'Akış' },
  { key: '/calendar', icon: <CalendarOutlined />, label: 'Takvimim' },
  { key: '/friends', icon: <UserOutlined />, label: 'Arkadaşlar' },
  { key: '/team', icon: <TeamOutlined />, label: 'Takımlar' },
  { key: '/tournaments', icon: <FlagOutlined />, label: 'Turnuvalar' },
  { key: '/leaderboard', icon: <TrophyOutlined />, label: 'Sıralama' },
  { key: '/venues', icon: <EnvironmentOutlined />, label: 'Halı Sahalar' },
  { key: '/teamAICreate', icon: <RobotOutlined />, label: 'AI Takım Kur' },
];

// Detay sayfaları hangi menü öğesine ait?
const activeKey = (path) => {
  if (path.startsWith('/match-details')) return '/home';
  if (path.startsWith('/create-team')) return '/team';
  if (path.startsWith('/player/')) return '/friends';
  if (path.startsWith('/matches/new')) return '/home';
  const p = path.toLowerCase();
  return MENU.find((m) => p === m.key.toLowerCase() || p.startsWith(`${m.key.toLowerCase()}/`))?.key;
};

export function useCurrentUser() {
  const [user, setUser] = useState(getCurrentUser);
  useEffect(() => {
    const update = () => setUser(getCurrentUser());
    window.addEventListener(USER_CHANGED, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(USER_CHANGED, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return user;
}

export function Brand({ to = '/home', badge }) {
  return (
    <Link to={to} className="mb-brand">
      <span className="mb-brand__mark">
        <img src={Logo} alt="" />
      </span>
      <span className="mb-brand__name">
        Match<em>Buddy</em>
      </span>
      {badge && <span className="mb-brand__badge">{badge}</span>}
    </Link>
  );
}

function SiderCta() {
  const navigate = useNavigate();
  return (
    <div className="mb-sider-cta mb-pitch-bg">
      <h4>Kadro eksik mi?</h4>
      <p>Maçını kur, oyuncular katılsın.</p>
      <Button type="primary" block icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
        Maç oluştur
      </Button>
    </div>
  );
}

/** Oyuncu tarafının ortak iskeleti: yan menü + üst bar + içerik */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useCurrentUser();
  const { openMessages } = useMessages();

  // Eski /chat bağlantısı: mesaj panelini aç
  useEffect(() => {
    if (location.pathname.toLowerCase() === '/chat' || location.pathname.toLowerCase() === '/chatwindow') {
      openMessages();
      navigate('/home', { replace: true });
    }
  }, [location.pathname, openMessages, navigate]);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[activeKey(location.pathname)]}
      items={MENU}
      onClick={({ key }) => navigate(key)}
    />
  );

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Profilim', onClick: () => navigate('/user') },
      { key: 'edit', icon: <EditOutlined />, label: 'Profili düzenle', onClick: () => navigate('/userUpdate') },
      { key: 'invites', icon: <InboxOutlined />, label: 'Davetler', onClick: () => navigate('/invites') },
      { key: 'team', icon: <UsergroupAddOutlined />, label: 'Takımlarım', onClick: () => navigate('/team') },
      { key: 'settings', icon: <SettingOutlined />, label: 'Ayarlar', onClick: () => navigate('/settings') },
      { type: 'divider' },
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
        <Sider width={240} className="mb-sider">
          <Brand />
          {menu}
          <SiderCta />
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={260}
          closable={false}
          styles={{ body: { padding: 0, background: '#05080e' } }}
        >
          <Brand />
          {menu}
        </Drawer>
      )}

      <Layout>
        <Header className="mb-header">
          <div className="mb-header__left">
            {isMobile ? (
              <Button className="mb-icon-btn" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label="Menü" />
            ) : (
              <span className="mb-header__greeting">
                Hoş geldin, <strong>{user?.playerName}</strong> · Bugün sahada mısın?
              </span>
            )}
          </div>
          <div className="mb-header__right">
            <Tooltip title="Mesajlar">
              <Button
                className="mb-icon-btn"
                icon={<MessageOutlined />}
                onClick={() => openMessages()}
                aria-label="Mesajlar"
              />
            </Tooltip>
            <InvitesButton />
            <NotificationBell />
            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="mb-user-button">
                <PlayerAvatar player={user} size={34} />
                {!isMobile && (
                  <span className="mb-user-button__text">
                    <Text strong>{fullName(user)}</Text>
                    <Text type="secondary">@{user?.userName}</Text>
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
