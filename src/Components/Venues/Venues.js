import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Marker, Popup, useMap } from 'react-leaflet';
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
import { Trans, useTranslation } from 'react-i18next';
import { AMENITIES, formatPrice, venuesApi } from '../../api/venues';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage, mediaUrl } from '../../utils/format';
import { MbMap, venuePinIcon } from '../../ui/map/mapKit';
import './Venues.css';

/* =================== Ortak yardımcılar (VenueDetail / CreateMatch de kullanır) =================== */

export const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara

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

// Filtre çipleri için kısa etiketler (çeviri anahtarları)
const AMENITY_SHORT = {
  camera: 'venues:amenityShort.camera',
  cleatRental: 'venues:amenityShort.cleatRental',
  shower: 'venues:amenityShort.shower',
  lockerRoom: 'venues:amenityShort.lockerRoom',
  parking: 'venues:amenityShort.parking',
  cafe: 'venues:amenityShort.cafe',
  shuttle: 'venues:amenityShort.shuttle',
  bibs: 'venues:amenityShort.bibs',
  ball: 'venues:amenityShort.ball',
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
  const { t } = useTranslation();
  if (!count) return <span className="mb-venue-rating is-new">{t('venues:shared.newVenue')}</span>;
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

/** Konum izni yoksa haritayı tüm sahaları gösterecek şekilde açar (telefonda Türkiye geneli zoom'u sahaları dışarıda bırakıyordu) */
function FitAll({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    const fit = () => {
      // Harita gizli sekmede kurulduysa boyutu 0'dır: önce boyutu yenile, sonra sığdır
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 13);
      else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 13 });
    };
    fit();
    // Sekme açılınca / ekran döndürülünce kap görünür olur: bir kez daha sığdır
    const el = map.getContainer();
    let done = el.clientWidth > 0;
    const ro = new ResizeObserver(() => {
      if (!done && el.clientWidth > 0) {
        done = true;
        fit();
      }
    });
    ro.observe(el);
    const t = setTimeout(fit, 400);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
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
  const { t } = useTranslation();
  return (
    <article className="mb-venue-card" onClick={onOpen}>
      <div className="mb-venue-card__cover">
        {v.coverPhotoUrl ? <img src={mediaUrl(v.coverPhotoUrl, 'md')} alt={v.name} loading="lazy" decoding="async" /> : <div className="mb-venue-card__placeholder mb-pitch-bg" />}
        {v.hasActiveCampaign && (
          <span className="mb-ribbon">
            <FireOutlined /> {t('venues:shared.campaign')}
          </span>
        )}
        {showFree && v.freeSlotsToday != null && (
          <span className={`mb-venue-card__free ${v.freeSlotsToday ? '' : 'is-none'}`}>
            {v.freeSlotsToday ? t('venues:shared.freeSlots', { count: v.freeSlotsToday }) : t('venues:shared.noFreeSlots')}
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
          <span className="mb-venue-card__pitches">{t('venues:list.card.pitchCount', { count: v.pitchCount })}</span>
        </div>
        <AmenityIcons amenities={v.amenities} size="sm" />
        <div className="mb-venue-card__foot">
          <div className="mb-venue-card__price">
            {v.minPrice != null ? (
              <Trans i18nKey="venues:list.card.priceFrom" values={{ price: formatPrice(v.minPrice) }} components={{ b: <strong />, s: <span /> }} />
            ) : (
              <span>{t('venues:list.card.clickForPrice')}</span>
            )}
          </div>
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {t('venues:shared.pickTime')}
          </Button>
        </div>
      </div>
    </article>
  );
}

/* =================== Sayfa =================== */
export default function Venues() {
  const { t } = useTranslation();
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
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [selected, setSelected] = useState(null);
  const [route, setRoute] = useState(false);

  const dateKey = date ? date.format('YYYY-MM-DD') : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    venuesApi
      .list(dateKey ? { date: dateKey } : undefined)
      .then((res) => alive && setVenues((res || []).map((v) => ({ ...v, coords: parseLocation(v.location) }))))
      .catch((e) => alive && message.error(apiErrorMessage(e, t('venues:shared.venuesLoadError'))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dateKey, message, t]);

  useEffect(() => {
    if (view !== 'map' || userPosition) return;
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setUserPosition([p.coords.latitude, p.coords.longitude]);
        setUserAccuracy(p.coords.accuracy);
      },
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
        eyebrow={t('venues:list.eyebrow')}
        title={t('venues:list.title')}
        subtitle={t('venues:list.subtitle')}
        extra={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: t('venues:list.viewList'), icon: <AppstoreOutlined /> },
              { value: 'map', label: t('venues:list.viewMap'), icon: <EnvironmentOutlined /> },
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
            placeholder={t('venues:list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-venue-filters__search"
          />
          <Select allowClear placeholder={t('venues:list.allCities')} value={city} onChange={setCity} options={cities.map((c) => ({ value: c, label: c }))} style={{ minWidth: 160 }} className="mb-venue-filters__city" />
          <DatePicker
            value={date}
            onChange={(d) => setDate(d ? d.startOf('day') : null)}
            format="DD MMM YYYY"
            placeholder={t('venues:list.datePlaceholder')}
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          />
          <label className={`mb-venue-filters__toggle ${campaignOnly ? 'is-on' : ''}`}>
            <Switch size="small" checked={campaignOnly} onChange={setCampaignOnly} />
            <TagOutlined /> {t('venues:list.campaignOnly')}
          </label>
        </div>
        <div className="mb-venue-filters__chips">
          {AMENITIES.map((a) => (
            <Tag.CheckableTag key={a.key} checked={amenityFilter.includes(a.key)} onChange={(on) => toggleAmenity(a.key, on)} className="mb-amenity-chip">
              {AMENITY_ICONS[a.key]} {AMENITY_SHORT[a.key] ? t(AMENITY_SHORT[a.key]) : a.label}
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
            <EmptyState description={venues.length ? t('venues:list.emptyFiltered') : t('venues:list.emptyNone')} />
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
          {/* Telefonda önce harita, sonra liste */}
          <Col xs={{ span: 24, order: 2 }} lg={{ span: 8, order: 1 }}>
            <Card className="mb-venue-side" styles={{ body: { padding: 12 } }} title={<span><UnorderedListOutlined /> {t('venues:list.venueCount', { count: list.length })}</span>}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : list.length === 0 ? (
                <EmptyState description={t('venues:list.notFound')} />
              ) : (
                <div className="mb-venue-side__list">
                  {list.map((v) => (
                    <button
                      type="button"
                      key={v.stadiumId}
                      className={`mb-venue-side__item ${selected?.stadiumId === v.stadiumId ? 'is-active' : ''}`}
                      onClick={() => select(v)}
                    >
                      {v.coverPhotoUrl ? <img src={mediaUrl(v.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" /> : <span className="mb-venue-side__ph mb-pitch-bg" />}
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
          <Col xs={{ span: 24, order: 1 }} lg={{ span: 16, order: 2 }}>
            <Card styles={{ body: { padding: 12 } }}>
              <MbMap
                center={userPosition || DEFAULT_CENTER}
                zoom={userPosition ? 12 : 6}
                className="mb-venue-map"
                userLocation={userPosition ? { latlng: userPosition, accuracy: userAccuracy } : null}
                onLocate={(loc) => {
                  setUserPosition(loc.latlng);
                  setUserAccuracy(loc.accuracy);
                }}
              >
                {!userPosition && !selected?.coords && <FitAll points={list.filter((v) => v.coords).map((v) => v.coords)} />}
                {selected?.coords && <FlyTo center={selected.coords} zoom={15} />}
                {list
                  .filter((v) => v.coords)
                  .map((v) => (
                    <Marker
                      key={v.stadiumId}
                      position={v.coords}
                      title={v.name}
                      icon={venuePinIcon({
                        active: selected?.stadiumId === v.stadiumId,
                        hot: !!v.hasActiveCampaign,
                        hotLabel: t('common:map.campaign'),
                        badge: selected?.stadiumId === v.stadiumId && v.minPrice != null ? `${formatPrice(v.minPrice)}+` : null,
                      })}
                      zIndexOffset={selected?.stadiumId === v.stadiumId ? 1000 : 0}
                      eventHandlers={{ click: () => select(v) }}
                    >
                      <Popup>
                        <strong>{v.name}</strong>
                        <br />
                        {v.minPrice != null && t('venues:list.popupPriceFrom', { price: formatPrice(v.minPrice) })}
                      </Popup>
                    </Marker>
                  ))}
                {route && userPosition && selected?.coords && <Routing from={userPosition} to={selected.coords} />}
              </MbMap>
            </Card>

            {selected && (
              <div className="mb-venue-mapcard">
                {selected.coverPhotoUrl && <img src={mediaUrl(selected.coverPhotoUrl, 'sm')} alt="" decoding="async" />}
                <div className="mb-venue-mapcard__text">
                  <h3>{selected.name}</h3>
                  <span>{selected.address}</span>
                  <AmenityIcons amenities={selected.amenities} size="sm" />
                </div>
                <div className="mb-venue-mapcard__actions">
                  <Tooltip title={!userPosition ? t('venues:list.locationPermissionNeeded') : undefined}>
                    <Button icon={<AimOutlined />} disabled={!userPosition || !selected.coords} onClick={() => setRoute(true)}>
                      {t('venues:list.drawRoute')}
                    </Button>
                  </Tooltip>
                  <Button type="primary" onClick={() => open(selected)}>
                    {t('venues:shared.pickTime')}
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
