import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { App, Button, Card, Col, DatePicker, Input, Rate, Row, Segmented, Select, Skeleton, Switch, Tag, Tooltip } from 'antd';
import {
  AimOutlined,
  AppstoreOutlined,
  CarOutlined,
  CloudOutlined,
  CoffeeOutlined,
  CompassOutlined,
  DribbbleOutlined,
  EnvironmentOutlined,
  FireOutlined,
  LockOutlined,
  SearchOutlined,
  SkinOutlined,
  StarFilled,
  TagOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AMENITIES, formatPrice, venuesApi } from '../../api/venues';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage, fileUrl } from '../../utils/format';
import LocationIcon from '../../images/Location-fotor-bg-remover-2025030545851.png';
import SelectedLocationIcon from '../../images/Vector-Location-PNG-Free-Image.png';
import './Venues.css';

/* =================== Ortak yardımcılar (VenueDetail / CreateMatch de kullanır) =================== */

export const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara
export const markerIcon = new L.Icon({ iconUrl: LocationIcon, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
export const selectedMarkerIcon = new L.Icon({ iconUrl: SelectedLocationIcon, iconSize: [44, 66], iconAnchor: [22, 66], popupAnchor: [0, -60] });
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** "lat, lon" metnini güvenli şekilde çözer */
export const parseLocation = (loc) => {
  if (!loc) return null;
  const parts = String(loc).split(',').map((x) => parseFloat(x.trim()));
  return parts.length === 2 && parts.every((n) => Number.isFinite(n)) ? parts : null;
};

export const directionsUrl = (coords) => (coords ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}` : null);

export const AMENITY_ICONS = {
  camera: <VideoCameraOutlined />,
  cleatRental: <ToolOutlined />,
  shower: <CloudOutlined />,
  lockerRoom: <LockOutlined />,
  parking: <CarOutlined />,
  cafe: <CoffeeOutlined />,
  shuttle: <CompassOutlined />,
  bibs: <SkinOutlined />,
  ball: <DribbbleOutlined />,
};

// Filtre çipleri için kısa etiketler
const AMENITY_SHORT = {
  camera: 'Kamera',
  cleatRental: 'Krampon',
  shower: 'Duş',
  lockerRoom: 'Soyunma odası',
  parking: 'Otopark',
  cafe: 'Kafe',
  shuttle: 'Servis',
  bibs: 'Yelek',
  ball: 'Top',
};

/** Tesisin sahip olduğu olanakların ikon satırı */
export function AmenityIcons({ amenities, size = 'md' }) {
  const list = AMENITIES.filter((a) => amenities?.[a.key]);
  if (!list.length) return null;
  return (
    <div className={`mb-amenities is-${size}`}>
      {list.map((a) => (
        <Tooltip key={a.key} title={a.label}>
          <span className="mb-amenities__icon">{AMENITY_ICONS[a.key]}</span>
        </Tooltip>
      ))}
    </div>
  );
}

/** Puan: yıldız + değer + yorum sayısı */
export function VenueRating({ rating, count, compact }) {
  if (!count) return <span className="mb-venue-rating is-new">Yeni tesis</span>;
  return (
    <span className="mb-venue-rating">
      {compact ? <StarFilled /> : <Rate disabled allowHalf value={Math.round((rating || 0) * 2) / 2} />}
      <strong>{Number(rating || 0).toFixed(1)}</strong>
      <span>({count})</span>
    </span>
  );
}

export function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

export function Routing({ from, to }) {
  const map = useMap();
  useEffect(() => {
    if (!from || !to) return undefined;
    const control = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
      lineOptions: { styles: [{ color: getComputedStyle(document.documentElement).getPropertyValue('--mb-primary').trim() || 'lime', weight: 5, opacity: 0.85 }] },
      createMarker: () => null,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
    }).addTo(map);
    return () => {
      try {
        map.removeControl(control);
      } catch {
        /* harita kapanmış olabilir */
      }
    };
  }, [from, to, map]);
  return null;
}

/* =================== Tesis kartı =================== */
function VenueCard({ v, onOpen, showFree }) {
  return (
    <article className="mb-venue-card" onClick={onOpen}>
      <div className="mb-venue-card__cover">
        {v.coverPhotoUrl ? <img src={fileUrl(v.coverPhotoUrl)} alt={v.name} loading="lazy" /> : <div className="mb-venue-card__placeholder mb-pitch-bg" />}
        {v.hasActiveCampaign && (
          <span className="mb-ribbon">
            <FireOutlined /> Kampanya
          </span>
        )}
        {showFree && v.freeSlotsToday != null && (
          <span className={`mb-venue-card__free ${v.freeSlotsToday ? '' : 'is-none'}`}>
            {v.freeSlotsToday ? `${v.freeSlotsToday} boş saat` : 'Boş saat yok'}
          </span>
        )}
        <div className="mb-venue-card__title">
          <h3>{v.name}</h3>
          <span>
            <EnvironmentOutlined /> {[v.district, v.city].filter(Boolean).join(', ')}
          </span>
        </div>
      </div>
      <div className="mb-venue-card__body">
        <div className="mb-venue-card__row">
          <VenueRating rating={v.rating} count={v.reviewCount} compact />
          <span className="mb-venue-card__pitches">{v.pitchCount} saha</span>
        </div>
        <AmenityIcons amenities={v.amenities} size="sm" />
        <div className="mb-venue-card__foot">
          <div className="mb-venue-card__price">
            {v.minPrice != null ? (
              <>
                <strong>{formatPrice(v.minPrice)}</strong>
                <span>'den başlayan /saat</span>
              </>
            ) : (
              <span>Fiyat için tıkla</span>
            )}
          </div>
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Saat seç
          </Button>
        </div>
      </div>
    </article>
  );
}

/* =================== Sayfa =================== */
export default function Venues() {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState();
  const [search, setSearch] = useState('');
  const [amenityFilter, setAmenityFilter] = useState([]);
  const [campaignOnly, setCampaignOnly] = useState(false);
  const [date, setDate] = useState(null);
  const [view, setView] = useState('list');

  // Harita
  const [userPosition, setUserPosition] = useState(null);
  const [selected, setSelected] = useState(null);
  const [route, setRoute] = useState(false);

  const dateKey = date ? date.format('YYYY-MM-DD') : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    venuesApi
      .list(dateKey ? { date: dateKey } : undefined)
      .then((res) => alive && setVenues((res || []).map((v) => ({ ...v, coords: parseLocation(v.location) }))))
      .catch((e) => alive && message.error(apiErrorMessage(e, 'Tesisler yüklenemedi.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dateKey, message]);

  useEffect(() => {
    if (view !== 'map' || userPosition) return;
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPosition([p.coords.latitude, p.coords.longitude]),
      () => {}
    );
  }, [view, userPosition]);

  const cities = useMemo(() => [...new Set(venues.map((v) => v.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [venues]);

  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return venues
      .filter((v) => {
        if (city && v.city !== city) return false;
        if (campaignOnly && !v.hasActiveCampaign) return false;
        if (amenityFilter.some((k) => !v.amenities?.[k])) return false;
        if (q && !`${v.name} ${v.district} ${v.city} ${v.address}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
      })
      .sort((a, b) => (date ? (b.freeSlotsToday || 0) - (a.freeSlotsToday || 0) : 0) || (b.rating || 0) - (a.rating || 0));
  }, [venues, city, campaignOnly, amenityFilter, search, date]);

  const toggleAmenity = (key, on) => setAmenityFilter((f) => (on ? [...f, key] : f.filter((k) => k !== key)));
  const open = (v) => navigate(`/venues/${v.stadiumId}${dateKey ? `?date=${dateKey}` : ''}`);
  const select = (v) => {
    setSelected(v);
    setRoute(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Anlaşmalı tesisler"
        title="Halı Sahalar"
        subtitle="Boş saatleri gör, sahanı seç, maçını dakikalar içinde kur."
        extra={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'Liste', icon: <AppstoreOutlined /> },
              { value: 'map', label: 'Harita', icon: <EnvironmentOutlined /> },
            ]}
          />
        }
      />

      {/* ---------- Filtreler ---------- */}
      <div className="mb-venue-filters">
        <div className="mb-venue-filters__row">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tesis, semt ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-venue-filters__search"
          />
          <Select allowClear placeholder="Tüm şehirler" value={city} onChange={setCity} options={cities.map((c) => ({ value: c, label: c }))} style={{ minWidth: 160 }} />
          <DatePicker
            value={date}
            onChange={(d) => setDate(d ? d.startOf('day') : null)}
            format="DD MMM YYYY"
            placeholder="Boş saat ara"
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          />
          <label className={`mb-venue-filters__toggle ${campaignOnly ? 'is-on' : ''}`}>
            <Switch size="small" checked={campaignOnly} onChange={setCampaignOnly} />
            <TagOutlined /> Kampanyalı
          </label>
        </div>
        <div className="mb-venue-filters__chips">
          {AMENITIES.map((a) => (
            <Tag.CheckableTag key={a.key} checked={amenityFilter.includes(a.key)} onChange={(on) => toggleAmenity(a.key, on)} className="mb-amenity-chip">
              {AMENITY_ICONS[a.key]} {AMENITY_SHORT[a.key] || a.label}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        loading ? (
          <Row gutter={[20, 20]}>
            {[1, 2, 3].map((i) => (
              <Col key={i} xs={24} md={12} xl={8}>
                <Card>
                  <Skeleton.Image active style={{ width: '100%', height: 160 }} />
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState description={venues.length ? 'Bu filtrelere uyan tesis yok' : 'Henüz anlaşmalı tesis yok'} />
          </Card>
        ) : (
          <Row gutter={[20, 20]}>
            {list.map((v) => (
              <Col key={v.stadiumId} xs={24} md={12} xl={8}>
                <VenueCard v={v} onOpen={() => open(v)} showFree={!!date} />
              </Col>
            ))}
          </Row>
        )
      ) : (
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={8}>
            <Card className="mb-venue-side" styles={{ body: { padding: 12 } }} title={<span><UnorderedListOutlined /> {list.length} tesis</span>}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : list.length === 0 ? (
                <EmptyState description="Tesis bulunamadı" />
              ) : (
                <div className="mb-venue-side__list">
                  {list.map((v) => (
                    <button
                      type="button"
                      key={v.stadiumId}
                      className={`mb-venue-side__item ${selected?.stadiumId === v.stadiumId ? 'is-active' : ''}`}
                      onClick={() => select(v)}
                    >
                      {v.coverPhotoUrl ? <img src={fileUrl(v.coverPhotoUrl)} alt="" /> : <span className="mb-venue-side__ph mb-pitch-bg" />}
                      <span className="mb-venue-side__text">
                        <strong>{v.name}</strong>
                        <small>{[v.district, v.city].filter(Boolean).join(', ')}</small>
                        <span>
                          <VenueRating rating={v.rating} count={v.reviewCount} compact />
                          {v.minPrice != null && <em>{formatPrice(v.minPrice)}+</em>}
                        </span>
                      </span>
                      {v.hasActiveCampaign && <FireOutlined className="mb-venue-side__deal" />}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card styles={{ body: { padding: 12 } }}>
              <MapContainer center={userPosition || DEFAULT_CENTER} zoom={userPosition ? 12 : 6} className="mb-venue-map">
                <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
                {selected?.coords && <FlyTo center={selected.coords} zoom={15} />}
                {userPosition && (
                  <Marker position={userPosition} icon={markerIcon}>
                    <Popup>Konumun</Popup>
                  </Marker>
                )}
                {list
                  .filter((v) => v.coords)
                  .map((v) => (
                    <Marker
                      key={v.stadiumId}
                      position={v.coords}
                      icon={selected?.stadiumId === v.stadiumId ? selectedMarkerIcon : markerIcon}
                      eventHandlers={{ click: () => select(v) }}
                    >
                      <Popup>
                        <strong>{v.name}</strong>
                        <br />
                        {v.minPrice != null && `${formatPrice(v.minPrice)}'den başlayan /saat`}
                      </Popup>
                    </Marker>
                  ))}
                {route && userPosition && selected?.coords && <Routing from={userPosition} to={selected.coords} />}
              </MapContainer>
            </Card>

            {selected && (
              <div className="mb-venue-mapcard">
                {selected.coverPhotoUrl && <img src={fileUrl(selected.coverPhotoUrl)} alt="" />}
                <div className="mb-venue-mapcard__text">
                  <h3>{selected.name}</h3>
                  <span>{selected.address}</span>
                  <AmenityIcons amenities={selected.amenities} size="sm" />
                </div>
                <div className="mb-venue-mapcard__actions">
                  <Tooltip title={!userPosition ? 'Konum izni gerekiyor' : undefined}>
                    <Button icon={<AimOutlined />} disabled={!userPosition || !selected.coords} onClick={() => setRoute(true)}>
                      Rota çiz
                    </Button>
                  </Tooltip>
                  <Button type="primary" onClick={() => open(selected)}>
                    Saat seç
                  </Button>
                </div>
              </div>
            )}
          </Col>
        </Row>
      )}
    </>
  );
}
