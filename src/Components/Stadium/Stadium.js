import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { Alert, App, Button, Card, Col, Descriptions, Input, List, Row, Skeleton, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { adminVenuesApi } from '../../api/venues';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import LocationIcon from '../../images/Location-fotor-bg-remover-2025030545851.png';
import SelectedLocationIcon from '../../images/Vector-Location-PNG-Free-Image.png';
import './StadiumAdmin.css';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara

const customIcon = new L.Icon({
  iconUrl: LocationIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedCustomIcon = new L.Icon({
  iconUrl: SelectedLocationIcon,
  iconSize: [40, 60],
  iconAnchor: [20, 60],
  popupAnchor: [0, -60],
});

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
  useEffect(() => {
    if (!from || !to || !L.Routing) return undefined;
    const control = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
      lineOptions: { styles: [{ color: '#c6f432', weight: 4 }] },
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
  }, [map, from, to]);
  return null;
}

/** Admin: halı saha listesi + harita */
function Stadium() {
  const { message } = App.useApp();
  const navigate = useNavigate();
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
      .catch((e) => message.error(apiErrorMessage(e, 'Halı sahalar alınamadı.')))
      .finally(() => setLoading(false));
    adminVenuesApi
      .owners()
      .then((list) => setOwners(Array.isArray(list) ? list : []))
      .catch(() => setOwners([]));
  }, [message]);

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
      message.success(value ? 'Tesis yayına alındı.' : 'Tesis yayından kaldırıldı.');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Yayın durumu değiştirilemedi.'));
    } finally {
      setListedBusy(null);
    }
  };

  const ownerTag = (s) => {
    const o = ownerByStadium[s.stadiumId];
    if (!o) return <Tag color="warning">İşletmesi yok</Tag>;
    return (
      <Tooltip title={o.membershipActive ? 'Aktif işletme' : 'Üyelik aktif değil'}>
        <Tag icon={<ShopOutlined />} color={o.membershipActive ? 'green' : 'default'}>
          {o.owner?.name || o.owner?.userName || 'İşletme'}
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
        title="Halı Saha Listesi"
        subtitle="Sistemde kayıtlı halı sahalar ve harita üzerindeki konumları"
        icon={<EnvironmentOutlined />}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/adminPanel/stadiums/new')}>
            Halı saha ekle
          </Button>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Oyuncular yalnızca şu koşulları sağlayan tesisleri görür: yayında, aktif üyeliği olan bir işletmesi var, en az 1 fotoğraf ve 1 aktif saha, konum ve adres dolu."
        description={
          <>
            Yeni anlaşmalı tesis eklemek için <Link to="/adminPanel/businesses?new=1">Yeni işletme</Link> sihirbazını kullanın.
          </>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card
            bordered={false}
            title={`Halı sahalar (${stadiums.length})`}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ padding: 16, paddingBottom: 8 }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Ad veya adres ara"
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
                  locale={{ emptyText: <EmptyState description="Halı saha bulunamadı" /> }}
                  renderItem={(s) => (
                    <List.Item
                      key={s.stadiumId}
                      className={`mb-stadium-item${s.stadiumId === selectedId ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(s.stadiumId)}
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
                              {!s.coords && <Tag color="warning">Konum yok</Tag>}
                              {ownerTag(s)}
                              {!isListed(s) && <Tag>Yayında değil</Tag>}
                              {ownerByStadium[s.stadiumId]?.isVisible && <Tag color="lime">Oyunculara görünür</Tag>}
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
            <Card bordered={false} styles={{ body: { padding: 8 } }}>
              <MapContainer center={initialCenter} zoom={userPosition ? 13 : 6} className="mb-map">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {selected?.coords ? (
                  <FlyTo position={selected.coords} zoom={15} />
                ) : (
                  userPosition && <FlyTo position={userPosition} zoom={12} />
                )}
                {userPosition && (
                  <Marker position={userPosition} icon={customIcon}>
                    <Popup>Mevcut konumunuz</Popup>
                  </Marker>
                )}
                {stadiums
                  .filter((s) => s.coords)
                  .map((s) => (
                    <Marker
                      key={s.stadiumId}
                      position={s.coords}
                      icon={s.stadiumId === selectedId ? selectedCustomIcon : customIcon}
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
              </MapContainer>
            </Card>
            <Card bordered={false} title="Seçili halı saha">
              {selected ? (
                <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label="Ad">{selected.stadiumName}</Descriptions.Item>
                  <Descriptions.Item label="İşletme">
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
                          İşletmeye bağla
                        </Button>
                      </Space>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Yayında">
                    <Space size={8}>
                      <Switch
                        size="small"
                        checked={isListed(selected)}
                        loading={listedBusy === selected.stadiumId}
                        onChange={(v) => toggleListed(selected, v)}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {ownerByStadium[selected.stadiumId]?.isVisible ? 'Oyunculara görünür' : 'Oyunculara görünmüyor'}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Çalışma saatleri">
                    {shortTime(selected.openingTime)} – {shortTime(selected.closingTime)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Adres" span="filled">
                    {selected.address || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Konum" span="filled">
                    {selected.coords ? selected.coords.map((n) => n.toFixed(6)).join(', ') : 'Geçersiz konum'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Açıklama" span="filled">
                    {selected.description || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Ayrıntıları görmek için listeden veya haritadan bir halı saha seçin.</Text>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}

export default Stadium;
