import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { Alert, App, Button, Card, Col, Descriptions, Grid, Input, List, Row, Skeleton, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { adminVenuesApi } from '../../api/venues';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import { useThemeMode } from '../../theme/ThemeContext';
import { MbMap, venuePin, venuePinIcon } from '../../ui/map/mapKit';
import './StadiumAdmin.css';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara

/** "lat, lon" metnini [lat, lon] dizisine çevirir; geçersizse null */
export function parseLocation(location) {
  if (typeof location !== 'string') return null;
  const parts = location.split(',').map((c) => parseFloat(c.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  if (Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return parts;
}

/** "08:00:00" → "08:00" */
export const shortTime = (t) => (t ? String(t).slice(0, 5) : '--:--');

/** Haritayı verilen konuma uçurur */
function FlyTo({ position, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 0.8 });
  }, [map, position, zoom]);
  return null;
}

/** Kullanıcı konumundan seçili halı sahaya rota çizer */
function Routing({ from, to }) {
  const map = useMap();
  // Leaflet çizgi rengi SVG niteliğidir (CSS değişkeni çalışmaz): aktif temanın somut rengi
  const routeColor = useThemeMode().palette.primary;
  useEffect(() => {
    if (!from || !to || !L.Routing) return undefined;
    const control = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
      lineOptions: { styles: [{ color: routeColor, weight: 4 }] },
      createMarker: () => null,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
    }).addTo(map);
    return () => {
      try {
        map.removeControl(control);
      } catch (e) {
        // harita zaten kaldırılmış olabilir
      }
    };
  }, [map, from, to, routeColor]);
  return null;
}

/** Admin: halı saha listesi + harita */
function Stadium() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isPhone = Grid.useBreakpoint().md === false;
  const mapCardRef = useRef(null);
  const [userPosition, setUserPosition] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [owners, setOwners] = useState([]);
  const [listedBusy, setListedBusy] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
    api
      .get('/api/Stadium/GetStadiumList')
      .then((r) =>
        setStadiums((Array.isArray(r.data) ? r.data : []).map((s) => ({ ...s, coords: parseLocation(s.location) })))
      )
      .catch((e) => message.error(apiErrorMessage(e, t('venues:stadium.list.loadError'))))
      .finally(() => setLoading(false));
    adminVenuesApi
      .owners()
      .then((list) => setOwners(Array.isArray(list) ? list : []))
      .catch(() => setOwners([]));
  }, [message, t]);

  // stadiumId → { owner, membershipActive, isVisible }
  const ownerByStadium = useMemo(() => {
    const map = {};
    owners.forEach((o) =>
      (o.venues || []).forEach((v) => {
        map[v.stadiumId] = { owner: o.owner, membershipActive: o.membershipActive, isVisible: v.isVisible };
      })
    );
    return map;
  }, [owners]);

  const isListed = (s) => s.isListed ?? true;

  const toggleListed = async (s, value) => {
    setListedBusy(s.stadiumId);
    try {
      await adminVenuesApi.setListed(s.stadiumId, value);
      setStadiums((list) => list.map((x) => (x.stadiumId === s.stadiumId ? { ...x, isListed: value } : x)));
      message.success(value ? t('venues:stadium.list.listedOn') : t('venues:stadium.list.listedOff'));
    } catch (e) {
      message.error(apiErrorMessage(e, t('venues:stadium.list.listedError')));
    } finally {
      setListedBusy(null);
    }
  };

  const ownerTag = (s) => {
    const o = ownerByStadium[s.stadiumId];
    if (!o) return <Tag color="warning">{t('venues:stadium.list.noOwner')}</Tag>;
    return (
      <Tooltip title={o.membershipActive ? t('venues:stadium.list.activeOwner') : t('venues:stadium.list.membershipInactive')}>
        <Tag icon={<ShopOutlined />} color={o.membershipActive ? 'green' : 'default'}>
          {o.owner?.name || o.owner?.userName || t('venues:stadium.list.ownerFallback')}
        </Tag>
      </Tooltip>
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return stadiums;
    return stadiums.filter((s) =>
      [s.stadiumName, s.address, s.description].some((v) => (v || '').toLocaleLowerCase('tr').includes(q))
    );
  }, [stadiums, search]);

  const selected = stadiums.find((s) => s.stadiumId === selectedId) || null;
  const initialCenter = userPosition || DEFAULT_CENTER;

  return (
    <>
      <PageHeader
        title={t('venues:stadium.list.title')}
        subtitle={t('venues:stadium.list.subtitle')}
        icon={<EnvironmentOutlined />}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/adminPanel/stadiums/new')}>
            {t('venues:stadium.list.add')}
          </Button>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('venues:stadium.list.visibilityInfo')}
        description={
          <Trans i18nKey="venues:stadium.list.newVenueHint" components={{ link: <Link to="/adminPanel/businesses?new=1" /> }} />
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card
            bordered={false}
            title={t('venues:stadium.list.cardTitle', { count: stadiums.length })}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ padding: 16, paddingBottom: 8 }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('venues:stadium.list.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mb-stadium-list">
              {loading ? (
                <div style={{ padding: 16 }}>
                  <Skeleton active />
                </div>
              ) : (
                <List
                  dataSource={filtered}
                  locale={{ emptyText: <EmptyState description={t('venues:stadium.list.empty')} /> }}
                  renderItem={(s) => (
                    <List.Item
                      key={s.stadiumId}
                      className={`mb-stadium-item${s.stadiumId === selectedId ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedId(s.stadiumId);
                        // Telefonda harita listenin altında kalır; seçimi görmek için haritaya kaydır
                        if (isPhone) mapCardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                      }}
                    >
                      <List.Item.Meta
                        title={s.stadiumName}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {s.address || '-'}
                            </Text>
                            <Space size={4} wrap>
                              <Tag icon={<ClockCircleOutlined />}>
                                {shortTime(s.openingTime)} – {shortTime(s.closingTime)}
                              </Tag>
                              {!s.coords && <Tag color="warning">{t('venues:stadium.list.noLocation')}</Tag>}
                              {ownerTag(s)}
                              {!isListed(s) && <Tag>{t('venues:stadium.list.notListed')}</Tag>}
                              {ownerByStadium[s.stadiumId]?.isVisible && <Tag color="lime">{t('venues:stadium.list.visible')}</Tag>}
                            </Space>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card bordered={false} styles={{ body: { padding: 8 } }} ref={mapCardRef}>
              <MbMap
                center={initialCenter}
                zoom={userPosition ? 13 : 6}
                className="mb-map"
                userLocation={userPosition ? { latlng: userPosition } : null}
                onLocate={(loc) => setUserPosition(loc.latlng)}
              >
                {selected?.coords ? (
                  <FlyTo position={selected.coords} zoom={15} />
                ) : (
                  userPosition && <FlyTo position={userPosition} zoom={12} />
                )}
                {stadiums
                  .filter((s) => s.coords)
                  .map((s) => (
                    <Marker
                      key={s.stadiumId}
                      position={s.coords}
                      icon={s.stadiumId === selectedId ? venuePinIcon({ active: true }) : venuePin}
                      zIndexOffset={s.stadiumId === selectedId ? 1000 : 0}
                      title={s.stadiumName}
                      eventHandlers={{ click: () => setSelectedId(s.stadiumId) }}
                    >
                      <Popup>
                        <strong>{s.stadiumName}</strong>
                        <br />
                        {s.address}
                        <br />
                        {shortTime(s.openingTime)} – {shortTime(s.closingTime)}
                      </Popup>
                    </Marker>
                  ))}
                {userPosition && selected?.coords && <Routing from={userPosition} to={selected.coords} />}
              </MbMap>
            </Card>
            <Card bordered={false} title={t('venues:stadium.list.selectedTitle')}>
              {selected ? (
                <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label={t('venues:stadium.list.fields.name')}>{selected.stadiumName}</Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.owner')}>
                    {ownerByStadium[selected.stadiumId] ? (
                      <Space direction="vertical" size={0}>
                        {ownerTag(selected)}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {[ownerByStadium[selected.stadiumId].owner?.email, ownerByStadium[selected.stadiumId].owner?.phoneNumber]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </Space>
                    ) : (
                      <Space size={4} wrap>
                        {ownerTag(selected)}
                        <Button size="small" type="link" onClick={() => navigate('/adminPanel/businesses')}>
                          {t('venues:stadium.list.linkOwner')}
                        </Button>
                      </Space>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.listed')}>
                    <Space size={8}>
                      <Switch
                        size="small"
                        checked={isListed(selected)}
                        loading={listedBusy === selected.stadiumId}
                        onChange={(v) => toggleListed(selected, v)}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {ownerByStadium[selected.stadiumId]?.isVisible ? t('venues:stadium.list.visible') : t('venues:stadium.list.notVisible')}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.hours')}>
                    {shortTime(selected.openingTime)} – {shortTime(selected.closingTime)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.address')} span="filled">
                    {selected.address || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.location')} span="filled">
                    {selected.coords ? selected.coords.map((n) => n.toFixed(6)).join(', ') : t('venues:stadium.list.invalidLocation')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('venues:stadium.list.fields.description')} span="filled">
                    {selected.description || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">{t('venues:stadium.list.selectHint')}</Text>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}

export default Stadium;
