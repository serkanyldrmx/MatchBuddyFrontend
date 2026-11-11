import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Select, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  CalendarOutlined,
  GiftOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  ScheduleOutlined,
  SettingOutlined,
  StarOutlined,
  TagsOutlined,
  BorderOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { logout } from '../api/config';
import { ownerApi } from '../api/venues';
import { useMessages } from '../messaging/MessagesContext';
import { PageLoader, PlayerAvatar } from '../ui';
import { fullName, formatDate } from '../utils/format';
import { Brand, useAppBodyClass, useCurrentUser } from './AppLayout';
import { themeMenuItem } from '../theme/ThemeSwitch';
import NotificationBell from './NotificationBell';
import './layout.css';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
const BASE = '/venue';
const STORAGE_KEY = 'mb.owner.venueId';
export const OWNER_DATA_CHANGED = 'mb:owner-data-changed';

/**
 * İşletme panelinde seçili tesis.
 * const { venue, venueId, venues, membershipActive, reload } = useOwnerVenue();
 */
const OwnerVenueContext = createContext({ venues: [], venue: null, venueId: null, membershipActive: true, reload: () => {} });
export const useOwnerVenue = () => useContext(OwnerVenueContext);

export default function VenueLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useCurrentUser();
  useAppBodyClass();
  const { openMessages, unread } = useMessages();
  const { t } = useTranslation();

  const [info, setInfo] = useState(null);
  const [venueId, setVenueId] = useState(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [pending, setPending] = useState(0);

  const reload = useCallback(async () => {
    try {
      const res = await ownerApi.myVenues();
      setInfo(res);
      const ids = (res?.venues || []).map((v) => v.stadiumId);
      setVenueId((cur) => (cur && ids.includes(cur) ? cur : ids[0] || null));
    } catch {
      setInfo({ venues: [], membershipActive: false });
    }
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(OWNER_DATA_CHANGED, reload);
    return () => window.removeEventListener(OWNER_DATA_CHANGED, reload);
  }, [reload]);

  useEffect(() => {
    if (!venueId) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(venueId));
    } catch {
      /* yoksay */
    }
    const loadPending = () =>
      ownerApi
        .reservations({ stadiumId: venueId, status: 1 })
        .then((r) => setPending((r || []).length))
        .catch(() => {});
    loadPending();
    const timer = setInterval(loadPending, 60000);
    window.addEventListener(OWNER_DATA_CHANGED, loadPending);
    return () => {
      clearInterval(timer);
      window.removeEventListener(OWNER_DATA_CHANGED, loadPending);
    };
  }, [venueId]);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  const venues = useMemo(() => info?.venues || [], [info]);
  const venue = venues.find((v) => v.stadiumId === venueId) || null;
  const ctx = useMemo(
    () => ({ venues, venue, venueId, membershipActive: info?.membershipActive !== false, membershipUntil: info?.membershipUntil, reload }),
    [venues, venue, venueId, info, reload]
  );

  const items = [
    { key: BASE, icon: <AppstoreOutlined />, label: t('layout:venue.menu.overview') },
    { key: `${BASE}/calendar`, icon: <CalendarOutlined />, label: t('layout:venue.menu.calendar') },
    {
      key: `${BASE}/reservations`,
      icon: <ScheduleOutlined />,
      label: (
        <span className="mb-menu-badge">
          {t('layout:venue.menu.requests')} <Badge count={pending} size="small" />
        </span>
      ),
    },
    { key: `${BASE}/finance`, icon: <WalletOutlined />, label: t('layout:venue.menu.finance') },
    {
      type: 'group',
      label: t('layout:venue.menu.facilityGroup'),
      children: [
        { key: `${BASE}/facility`, icon: <HomeOutlined />, label: t('layout:venue.menu.facility') },
        { key: `${BASE}/pitches`, icon: <BorderOutlined />, label: t('layout:venue.menu.pitches') },
        { key: `${BASE}/pricing`, icon: <TagsOutlined />, label: t('layout:venue.menu.pricing') },
        { key: `${BASE}/campaigns`, icon: <GiftOutlined />, label: t('layout:venue.menu.campaigns') },
        { key: `${BASE}/reviews`, icon: <StarOutlined />, label: t('layout:venue.menu.reviews') },
        { key: `${BASE}/settings`, icon: <SettingOutlined />, label: t('layout:venue.menu.settings') },
      ],
    },
  ];
  const allKeys = items.flatMap((i) => (i.children ? i.children.map((c) => c.key) : [i.key]));
  const path = location.pathname.replace(/\/$/, '').toLowerCase();
  const selected =
    allKeys.filter((k) => path === k.toLowerCase() || path.startsWith(`${k.toLowerCase()}/`)).sort((a, b) => b.length - a.length)[0] || BASE;

  const menu = <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items} onClick={({ key }) => navigate(key)} />;
  const brand = <Brand to={BASE} badge={t('layout:venue.badge')} />;

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
          window.location.href = '/';
        },
      },
    ],
  };

  return (
    <OwnerVenueContext.Provider value={ctx}>
      <Layout className="mb-shell">
        {!isMobile && (
          <Sider width={248} className="mb-sider">
            {brand}
            {menu}
          </Sider>
        )}
        {isMobile && (
          <Drawer placement="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} width={260} closable={false} rootClassName="mb-nav-drawer" styles={{ body: { padding: 0, background: 'var(--mb-sider-bg)' } }}>
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
                  {/* Dar ekranda tesis adı için yer kalsın: sadece logo; tesis yoksa tam marka */}
                  <Brand to={BASE} variant="header" markOnly={venues.length > 0} />
                </>
              )}
              {venues.length > 1 ? (
                <Select
                  value={venueId}
                  onChange={setVenueId}
                  className="mb-header__venue-select"
                  style={{ minWidth: isMobile ? 0 : 240 }}
                  options={venues.map((v) => ({ value: v.stadiumId, label: v.name }))}
                />
              ) : (
                venue && <Text strong ellipsis className="mb-header__venue-name">{venue.name}</Text>
              )}
            </div>
            <div className="mb-header__right">
              <Tooltip title={t('layout:header.messages')}>
                <Badge count={unread} size="small" overflowCount={99} offset={[-4, 4]}>
                  <Button className="mb-icon-btn" icon={<MessageOutlined />} onClick={() => openMessages()} aria-label={t('layout:header.messages')} />
                </Badge>
              </Tooltip>
              <NotificationBell />
              <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                <button type="button" className="mb-user-button">
                  <PlayerAvatar player={user} size={34} />
                  {!isMobile && (
                    <span className="mb-user-button__text">
                      <Text strong>{fullName(user)}</Text>
                      <Text type="secondary">{t('layout:venue.role')}</Text>
                    </span>
                  )}
                </button>
              </Dropdown>
            </div>
          </Header>
          <Content className="mb-content">
            <div className="mb-content__inner">
              {info && !ctx.membershipActive && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('layout:venue.membershipInactive')}
                  description={
                    info.membershipUntil
                      ? t('layout:venue.membershipInactiveDescUntil', { date: formatDate(info.membershipUntil) })
                      : t('layout:venue.membershipInactiveDesc')
                  }
                />
              )}
              {!info ? (
                <PageLoader caption={t('layout:venue.loading')} />
              ) : venues.length === 0 ? (
                <Alert type="info" showIcon message={t('layout:venue.noVenue')} />
              ) : (
                <Outlet />
              )}
            </div>
          </Content>
        </Layout>
      </Layout>
    </OwnerVenueContext.Provider>
  );
}
