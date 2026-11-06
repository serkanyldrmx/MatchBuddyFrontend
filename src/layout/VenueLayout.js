import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Select, Tooltip, Typography } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  GiftOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  ScheduleOutlined,
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
  const { openMessages } = useMessages();

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
    const t = setInterval(loadPending, 60000);
    window.addEventListener(OWNER_DATA_CHANGED, loadPending);
    return () => {
      clearInterval(t);
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
    { key: BASE, icon: <AppstoreOutlined />, label: 'Genel Bakış' },
    { key: `${BASE}/calendar`, icon: <CalendarOutlined />, label: 'Rezervasyon Takvimi' },
    {
      key: `${BASE}/reservations`,
      icon: <ScheduleOutlined />,
      label: (
        <span className="mb-menu-badge">
          Talepler <Badge count={pending} size="small" />
        </span>
      ),
    },
    { key: `${BASE}/finance`, icon: <WalletOutlined />, label: 'Gelir & Gider' },
    {
      type: 'group',
      label: 'Tesis',
      children: [
        { key: `${BASE}/facility`, icon: <HomeOutlined />, label: 'Tesis Bilgileri' },
        { key: `${BASE}/pitches`, icon: <BorderOutlined />, label: 'Sahalar' },
        { key: `${BASE}/pricing`, icon: <TagsOutlined />, label: 'Saatler ve Fiyatlar' },
        { key: `${BASE}/campaigns`, icon: <GiftOutlined />, label: 'Kampanyalar' },
        { key: `${BASE}/reviews`, icon: <StarOutlined />, label: 'Yorumlar' },
      ],
    },
  ];
  const allKeys = items.flatMap((i) => (i.children ? i.children.map((c) => c.key) : [i.key]));
  const path = location.pathname.replace(/\/$/, '').toLowerCase();
  const selected =
    allKeys.filter((k) => path === k.toLowerCase() || path.startsWith(`${k.toLowerCase()}/`)).sort((a, b) => b.length - a.length)[0] || BASE;

  const menu = <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items} onClick={({ key }) => navigate(key)} />;
  const brand = <Brand to={BASE} badge="İşletme" />;

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
    <OwnerVenueContext.Provider value={ctx}>
      <Layout className="mb-shell">
        {!isMobile && (
          <Sider width={248} className="mb-sider">
            {brand}
            {menu}
          </Sider>
        )}
        {isMobile && (
          <Drawer placement="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} width={260} closable={false} rootClassName="mb-nav-drawer" styles={{ body: { padding: 0, background: '#05080e' } }}>
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
              <Tooltip title="Mesajlar">
                <Button className="mb-icon-btn" icon={<MessageOutlined />} onClick={() => openMessages()} aria-label="Mesajlar" />
              </Tooltip>
              <NotificationBell />
              <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                <button type="button" className="mb-user-button">
                  <PlayerAvatar player={user} size={34} />
                  {!isMobile && (
                    <span className="mb-user-button__text">
                      <Text strong>{fullName(user)}</Text>
                      <Text type="secondary">İşletme hesabı</Text>
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
                  message="Üyeliğiniz aktif değil"
                  description={`Tesisleriniz oyunculara görünmüyor ve değişiklik yapamazsınız${
                    info.membershipUntil ? ` (bitiş: ${formatDate(info.membershipUntil)})` : ''
                  }. Yenilemek için Match Buddy ile iletişime geçin.`}
                />
              )}
              {!info ? (
                <PageLoader caption="İşletme paneli yükleniyor…" />
              ) : venues.length === 0 ? (
                <Alert type="info" showIcon message="Hesabınıza bağlı bir tesis bulunmuyor. Match Buddy ile iletişime geçin." />
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
