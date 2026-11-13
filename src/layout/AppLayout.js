import React, { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Tooltip, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
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
import { usePlayerPreferencesSync } from '../api/playerSettings';
import { useMessages } from '../messaging/MessagesContext';
import { PlayerAvatar } from '../ui';
import { fullName, getCurrentUser } from '../utils/format';
import NotificationBell from './NotificationBell';
import InvitesButton from './InvitesButton';
import { themeMenuItem } from '../theme/ThemeSwitch';
import Logo from '../images/logo.png';
import './layout.css';
import useEdgeSwipe from './useEdgeSwipe';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
export const USER_CHANGED = 'mb:user-changed';

// labelKey: render anında t() ile çevrilir
const MENU = [
  { key: '/home', icon: <HomeOutlined />, labelKey: 'layout:nav.matches' },
  { key: '/feed', icon: <ThunderboltOutlined />, labelKey: 'layout:nav.feed' },
  { key: '/calendar', icon: <CalendarOutlined />, labelKey: 'layout:nav.calendar' },
  { key: '/friends', icon: <UserOutlined />, labelKey: 'layout:nav.friends' },
  { key: '/team', icon: <TeamOutlined />, labelKey: 'layout:nav.teams' },
  { key: '/tournaments', icon: <FlagOutlined />, labelKey: 'layout:nav.tournaments' },
  { key: '/leaderboard', icon: <TrophyOutlined />, labelKey: 'layout:nav.leaderboard' },
  { key: '/venues', icon: <EnvironmentOutlined />, labelKey: 'layout:nav.venues' },
  { key: '/teamAICreate', icon: <RobotOutlined />, labelKey: 'layout:nav.aiTeam' },
];

const MESSAGES_KEY = '__messages';

// Detay sayfaları hangi menü öğesine ait?
const activeKey = (path) => {
  if (path.startsWith('/match-details')) return '/home';
  if (path.startsWith('/create-team')) return '/team';
  if (path.startsWith('/player/')) return '/friends';
  if (path.startsWith('/matches/new')) return '/home';
  const p = path.toLowerCase();
  return MENU.find((m) => p === m.key.toLowerCase() || p.startsWith(`${m.key.toLowerCase()}/`))?.key;
};

/** Uygulama kabukları açıkken body'ye sınıf ekler: telefon için global kurallar (mobile.css) giriş ekranlarına dokunmaz */
export function useAppBodyClass() {
  useEffect(() => {
    document.body.classList.add('mb-app');
    return () => document.body.classList.remove('mb-app');
  }, []);
}

/** Telefonda alt sekme çubuğu: Maçlar · Akış · (+) Maç oluştur · Mesajlar · Profil */
const TAB_PATHS = {
  home: ['/home', '/match-details'],
  feed: ['/feed'],
  profile: ['/user', '/userupdate'],
};
const tabActive = (path, key) => TAB_PATHS[key].some((p) => path === p || path.startsWith(`${p}/`));

function BottomTabBar({ hidden }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openMessages, isOpen, unread } = useMessages();
  const { t } = useTranslation();
  const path = location.pathname.toLowerCase();
  const tab = (key, to, icon, label) => (
    <button
      type="button"
      className={`mb-tabbar__item ${tabActive(path, key) ? 'is-active' : ''}`}
      aria-current={tabActive(path, key) ? 'page' : undefined}
      onClick={() => navigate(to)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className={`mb-tabbar ${hidden ? 'is-hidden' : ''}`} aria-label={t('layout:tabbar.ariaLabel')}>
      {tab('home', '/home', <HomeOutlined />, t('layout:tabbar.matches'))}
      {tab('feed', '/feed', <ThunderboltOutlined />, t('layout:tabbar.feed'))}
      <button
        type="button"
        className={`mb-tabbar__create ${path.startsWith('/matches/new') ? 'is-active' : ''}`}
        onClick={() => navigate('/matches/new')}
        aria-label={t('layout:tabbar.createAria')}
      >
        <span className="mb-tabbar__plus">
          <PlusOutlined />
        </span>
        <span>{t('layout:tabbar.create')}</span>
      </button>
      <button type="button" className={`mb-tabbar__item ${isOpen ? 'is-active' : ''}`} onClick={() => openMessages()}>
        <Badge count={unread} size="small" overflowCount={99} offset={[2, 0]}>
          <MessageOutlined />
        </Badge>
        <span>{t('layout:tabbar.messages')}</span>
      </button>
      {tab('profile', '/user', <UserOutlined />, t('layout:tabbar.profile'))}
    </nav>
  );
}

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

/**
 * Logo + MATCBUDDY yazısı. variant="header": telefon/tablet üst barında kompakt sürüm;
 * markOnly: sadece logo kutusu (yer dar olduğunda, ör. işletme panelinde tesis adının yanında)
 */
export function Brand({ to = '/home', badge, variant, markOnly }) {
  const header = variant === 'header';
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      className={`mb-brand${header ? ' mb-brand--header' : ''}${markOnly ? ' mb-brand--mark-only' : ''}`}
      aria-label={header ? t('layout:brand.homeAria') : undefined}
    >
      <span className="mb-brand__mark">
        <img src={Logo} alt="" />
      </span>
      {!markOnly && (
        <span className="mb-brand__name">
          Matc<em>Buddy</em>
        </span>
      )}
      {badge && !header && <span className="mb-brand__badge">{badge}</span>}
    </Link>
  );
}

function SiderCta() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mb-sider-cta mb-pitch-bg">
      <h4>{t('layout:siderCta.title')}</h4>
      <p>{t('layout:siderCta.text')}</p>
      <Button type="primary" block icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
        {t('layout:siderCta.button')}
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
  // Alt sekme çubuğu sadece telefonlarda (< 768 px)
  const isPhone = screens.md === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openNav = useCallback(() => setMobileNavOpen(true), []);
  const user = useCurrentUser();
  const { openMessages, isOpen: messagesOpen, unread } = useMessages();
  const { t } = useTranslation();
  useAppBodyClass();
  // Sunucudaki tema/dil tercihini uygula, tema değişikliklerini PlayerSettings'e kaydet
  usePlayerPreferencesSync();

  // Eski /chat bağlantısı: mesaj panelini aç
  useEffect(() => {
    if (location.pathname.toLowerCase() === '/chat' || location.pathname.toLowerCase() === '/chatwindow') {
      openMessages();
      navigate('/home', { replace: true });
    }
  }, [location.pathname, openMessages, navigate]);

  // Mesaj bildirimi / push: ?messages=1 mesaj panelini açar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('messages') === '1') {
      openMessages();
      params.delete('messages');
      const rest = params.toString();
      navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
    }
  }, [location.search, location.pathname, openMessages, navigate]);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);
  // Telefonda sol kenardan sağa kaydırma: menüyü aç
  useEdgeSwipe(isMobile, openNav);

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[activeKey(location.pathname)]}
      items={[
        ...MENU.slice(0, 1).map(({ labelKey, ...m }) => ({ ...m, label: t(labelKey) })),
        // Mesajlar: sayfa değil panel; okunmamış sayısıyla menüde görünür olsun
        {
          key: MESSAGES_KEY,
          icon: <MessageOutlined />,
          label: (
            <span className="mb-menu-messages">
              {t('layout:header.messages')}
              {unread > 0 && <Badge count={unread} size="small" overflowCount={99} />}
            </span>
          ),
        },
        ...MENU.slice(1).map(({ labelKey, ...m }) => ({ ...m, label: t(labelKey) })),
      ]}
      onClick={({ key }) => {
        if (key === MESSAGES_KEY) {
          setMobileNavOpen(false);
          openMessages();
          return;
        }
        navigate(key);
      }}
    />
  );

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: t('layout:userMenu.profile'), onClick: () => navigate('/user') },
      { key: 'edit', icon: <EditOutlined />, label: t('layout:userMenu.editProfile'), onClick: () => navigate('/userUpdate') },
      { key: 'invites', icon: <InboxOutlined />, label: t('layout:userMenu.invites'), onClick: () => navigate('/invites') },
      { key: 'team', icon: <UsergroupAddOutlined />, label: t('layout:userMenu.myTeams'), onClick: () => navigate('/team') },
      { key: 'settings', icon: <SettingOutlined />, label: t('layout:userMenu.settings'), onClick: () => navigate('/settings') },
      { type: 'divider' },
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
    <Layout className={`mb-shell ${isPhone ? 'has-tabbar' : ''}`}>
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
          rootClassName="mb-nav-drawer"
          styles={{ body: { padding: 0, background: 'var(--mb-sider-bg)' } }}
        >
          <Brand />
          {menu}
        </Drawer>
      )}

      <Layout>
        <Header className="mb-header">
          <div className="mb-header__left">
            {isMobile ? (
              <>
                <Button className="mb-icon-btn" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label={t('layout:header.menuAria')} />
                <Brand variant="header" />
              </>
            ) : (
              <span className="mb-header__greeting">
                <Trans
                  i18nKey="layout:header.greeting"
                  values={{ name: user?.playerName ?? '' }}
                  components={{ strong: <strong /> }}
                />
              </span>
            )}
          </div>
          <div className="mb-header__right">
            {!isPhone && (
              <Tooltip title={t('layout:header.messages')}>
                <Badge count={unread} size="small" overflowCount={99} offset={[-4, 4]}>
                  <Button
                    className="mb-icon-btn"
                    icon={<MessageOutlined />}
                    onClick={() => openMessages()}
                    aria-label={t('layout:header.messages')}
                  />
                </Badge>
              </Tooltip>
            )}
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
      {isPhone && <BottomTabBar hidden={messagesOpen || mobileNavOpen} />}
    </Layout>
  );
}
