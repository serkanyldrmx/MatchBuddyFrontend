import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Alert, App, Button, Card, Col, Image, Progress, Rate, Result, Row, Skeleton, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  FireOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  PhoneOutlined,
  SunOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AMENITIES, contractDayIndex, DAYS, formatPrice, maskToDays, SURFACE, venuesApi } from '../../api/venues';
import { useMessages } from '../../messaging/MessagesContext';
import { EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, formatDate, fromNow, mediaUrl } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import SlotPicker, { DateStrip } from './SlotPicker';
import { AMENITY_ICONS, directionsUrl, markerIcon, parseLocation, TILE_ATTR, TILE_URL, VenueRating } from './Venues';
import './VenueDetail.css';

const hhmm = (t) => (t ? String(t).slice(0, 5) : '--:--');

/** Kampanya kartı (altın) */
export function CampaignCard({ c, pitches = [] }) {
  const pitch = c.pitchId ? pitches.find((p) => p.pitchId === c.pitchId) : null;
  const days = maskToDays(c.daysMask || 0);
  return (
    <div className="mb-campaign">
      <div className="mb-campaign__badge">
        {c.discountPercent ? (
          <>
            <strong>%{c.discountPercent}</strong>
            <span>indirim</span>
          </>
        ) : (
          <>
            <strong>{formatPrice(c.fixedPrice)}</strong>
            <span>/saat</span>
          </>
        )}
      </div>
      <div className="mb-campaign__text">
        <h4>
          <FireOutlined /> {c.title}
        </h4>
        {c.description && <p>{c.description}</p>}
        <span>
          {days.length === 7 ? 'Her gün' : days.join(', ')} · {String(c.fromHour).padStart(2, '0')}:00–{String(c.toHour).padStart(2, '0')}:00
          {pitch ? ` · ${pitch.name}` : ''}
        </span>
        {c.endDate && <span>{formatDate(c.endDate)} tarihine kadar</span>}
      </div>
    </div>
  );
}

export default function VenueDetail() {
  const { stadiumId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { openMessages } = useMessages();

  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('slots');
  const [date, setDate] = useState(() => {
    const q = params.get('date');
    const d = q ? dayjs(q) : null;
    return d && d.isValid() && !d.isBefore(dayjs(), 'day') ? d.startOf('day') : dayjs().startOf('day');
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    venuesApi
      .detail(stadiumId)
      .then((d) => {
        if (!alive) return;
        if (!d) setNotFound(true);
        setVenue(d);
      })
      .catch((e) => {
        if (!alive) return;
        if (e?.response?.status === 404) setNotFound(true);
        else message.error(apiErrorMessage(e, 'Tesis yüklenemedi.'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, message]);

  const photos = useMemo(() => {
    const list = (venue?.photos || []).slice().sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));
    if (!list.length && venue?.coverPhotoUrl) list.push({ photoId: 0, url: venue.coverPhotoUrl, isCover: true });
    return list;
  }, [venue]);

  if (loading) {
    return (
      <Card>
        <Skeleton.Image active style={{ width: '100%', height: 280 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }
  if (notFound || !venue) {
    return <Result status="404" title="Tesis bulunamadı" subTitle="Bu tesis şu an yayında olmayabilir." extra={<Button type="primary" onClick={() => navigate('/venues')}>Tesislere dön</Button>} />;
  }

  const v = venue;
  const coords = parseLocation(v.location);
  const pitches = v.pitches || [];
  const todayIdx = contractDayIndex(dayjs());
  const messageOwner = () =>
    v.owner && openMessages({ type: 'user', data: { playerId: v.owner.playerId, playerName: v.owner.name, userName: 'işletme' } });
  const pickSlot = (slot, pitch) =>
    navigate(`/matches/new?stadiumId=${v.stadiumId}&pitchId=${pitch.pitchId}&start=${encodeURIComponent(dayjs(slot.start).format('YYYY-MM-DDTHH:mm:ss'))}`);

  const breakdown = v.ratingBreakdown || {};
  const totalReviews = Object.values(breakdown).reduce((s, n) => s + (n || 0), 0);
  const hours = (v.openingHours || []).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const amenityList = AMENITIES.filter((a) => v.amenities?.[a.key]);

  const cancellation = v.cancellationPolicy && (
    <Alert type="info" showIcon icon={<InfoCircleOutlined />} className="mb-vd-policy" message="İptal politikası" description={v.cancellationPolicy} />
  );

  return (
    <>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/venues')} className="mb-vd-back">
        Tüm tesisler
      </Button>

      {/* ---------- Hero ---------- */}
      <section className="mb-vd-hero">
        <div className="mb-vd-gallery">
          <Image.PreviewGroup>
            {photos.length ? (
              <>
                <div className="mb-vd-gallery__cover">
                  <Image src={mediaUrl(photos[0].url, 'lg')} preview={{ src: mediaUrl(photos[0].url, 'lg') }} alt={v.name} decoding="async" />
                  {v.hasActiveCampaign && (
                    <span className="mb-ribbon">
                      <FireOutlined /> Kampanya
                    </span>
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="mb-vd-gallery__thumbs">
                    {photos.slice(1, 5).map((p, i) => (
                      <div key={p.photoId || p.url} className="mb-vd-gallery__thumb">
                        <Image src={mediaUrl(p.url, 'sm')} preview={{ src: mediaUrl(p.url, 'lg') }} alt="" loading="lazy" decoding="async" />
                        {i === 3 && photos.length > 5 && <span className="mb-vd-gallery__more">+{photos.length - 5}</span>}
                      </div>
                    ))}
                    {/* Kalan fotoğraflar önizleme galerisinde görünsün */}
                    <div style={{ display: 'none' }}>
                      {photos.slice(5).map((p) => (
                        <Image key={p.photoId || p.url} src={mediaUrl(p.url, 'sm')} preview={{ src: mediaUrl(p.url, 'lg') }} loading="lazy" decoding="async" />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-vd-gallery__cover mb-pitch-bg" />
            )}
          </Image.PreviewGroup>
        </div>

        <div className="mb-vd-info">
          <span className="mb-page-header__eyebrow">Anlaşmalı tesis</span>
          <h1 className="mb-vd-info__name">{v.name}</h1>
          <div className="mb-vd-info__addr">
            <EnvironmentOutlined /> {v.address}
            {(v.district || v.city) && <span> · {[v.district, v.city].filter(Boolean).join(', ')}</span>}
          </div>
          <VenueRating rating={v.rating} count={v.reviewCount} />
          {amenityList.length > 0 && (
            <div className="mb-vd-chips">
              {amenityList.map((a) => (
                <span key={a.key} className="mb-vd-chip">
                  {AMENITY_ICONS[a.key]} {a.label}
                </span>
              ))}
            </div>
          )}
          {v.description && <p className="mb-vd-info__desc">{v.description}</p>}
          <div className="mb-vd-info__stats">
            <div>
              <strong>{v.minPrice != null ? formatPrice(v.minPrice) : '-'}</strong>
              <span>en düşük /saat</span>
            </div>
            <div>
              <strong>{pitches.length || v.pitchCount}</strong>
              <span>saha</span>
            </div>
            <div>
              <strong>
                {hours[todayIdx]?.isClosed ? 'Kapalı' : `${hhmm(hours[todayIdx]?.openTime)}–${hhmm(hours[todayIdx]?.closeTime)}`}
              </strong>
              <span>bugün</span>
            </div>
          </div>
          <div className="mb-vd-info__actions">
            <Button type="primary" size="large" icon={<CalendarOutlined />} onClick={() => setTab('slots')}>
              Saat seç
            </Button>
            {v.owner && (
              <Button size="large" icon={<MessageOutlined />} onClick={messageOwner}>
                İşletmeye yaz
              </Button>
            )}
            {v.phone && (
              <Button size="large" icon={<PhoneOutlined />} href={`tel:${v.phone.replace(/\s/g, '')}`}>
                {v.phone}
              </Button>
            )}
          </div>
        </div>
      </section>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        className="mb-vd-tabs"
        items={[
          {
            key: 'slots',
            label: 'Saat seç',
            children: (
              <Row gutter={[20, 20]}>
                <Col xs={24} xl={17}>
                  <Card>
                    <DateStrip value={date} onChange={setDate} />
                    <SlotPicker stadiumId={v.stadiumId} date={date} pitches={pitches} onSelect={pickSlot} />
                  </Card>
                </Col>
                <Col xs={24} xl={7}>
                  <div className="mb-vd-side">
                    <div className="mb-vd-howto">
                      <h4>Nasıl çalışır?</h4>
                      <ol>
                        <li>Boş bir saate tıkla.</li>
                        <li>Kadronu ve ekstraları seç, kişi başı ücreti gör.</li>
                        <li>İşletme onaylayınca maçın kesinleşir.</li>
                      </ol>
                      <p className="mb-hint">Ödeme sahada yapılır.</p>
                    </div>
                    {cancellation}
                    {(v.campaigns || []).slice(0, 2).map((c) => (
                      <CampaignCard key={c.campaignId} c={c} pitches={pitches} />
                    ))}
                  </div>
                </Col>
              </Row>
            ),
          },
          {
            key: 'pitches',
            label: `Sahalar (${pitches.length})`,
            children: pitches.length ? (
              <Row gutter={[16, 16]}>
                {pitches.map((p) => (
                  <Col key={p.pitchId} xs={24} sm={12} xl={8}>
                    <div className="mb-pitch-card">
                      <div className="mb-pitch-card__field mb-pitch-bg">
                        <span className="mb-pitch-card__size">
                          {p.playersPerSide}+{p.playersPerSide}
                        </span>
                      </div>
                      <div className="mb-pitch-card__body">
                        <h3>{p.name}</h3>
                        <div className="mb-pitch-card__tags">
                          <span>{SURFACE[p.surface] || 'Saha'}</span>
                          <span>
                            {p.isIndoor ? <HomeOutlined /> : <SunOutlined />} {p.isIndoor ? 'Kapalı' : 'Açık'}
                          </span>
                          <span>
                            <TeamOutlined /> {p.playersPerSide * 2} oyuncu
                          </span>
                        </div>
                        <div className="mb-pitch-card__price">
                          <strong>{formatPrice(p.basePrice)}</strong> <span>/saat'ten başlayan</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            ) : (
              <Card>
                <EmptyState description="Saha bilgisi yok" />
              </Card>
            ),
          },
          {
            key: 'prices',
            label: 'Fiyatlar & saatler',
            children: (
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={12}>
                  <Card title={<span><ClockCircleOutlined /> Açılış saatleri</span>}>
                    <table className="mb-vd-hours">
                      <tbody>
                        {DAYS.map((name, i) => {
                          const h = hours.find((x) => x.dayOfWeek === i);
                          return (
                            <tr key={name} className={i === todayIdx ? 'is-today' : ''}>
                              <td>{name}</td>
                              <td>{!h ? '-' : h.isClosed ? <span className="mb-vd-hours__closed">Kapalı</span> : `${hhmm(h.openTime)} – ${hhmm(h.closeTime)}`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Fiyatlar">
                    <div className="mb-vd-pricelist">
                      {pitches.map((p) => (
                        <div key={p.pitchId}>
                          <span>{p.name} · saatlik</span>
                          <strong>{formatPrice(p.basePrice)}</strong>
                        </div>
                      ))}
                      {v.amenities?.cleatRental && v.prices?.cleatRentalPrice != null && (
                        <div>
                          <span>{AMENITY_ICONS.cleatRental} Krampon kiralama (çift)</span>
                          <strong>{formatPrice(v.prices.cleatRentalPrice)}</strong>
                        </div>
                      )}
                      {v.amenities?.camera && v.prices?.cameraPrice != null && (
                        <div>
                          <span>{AMENITY_ICONS.camera} Maç kaydı (kamera)</span>
                          <strong>{formatPrice(v.prices.cameraPrice)}</strong>
                        </div>
                      )}
                    </div>
                    <p className="mb-hint" style={{ marginTop: 12 }}>
                      Akşam saatlerinde ve hafta sonu fiyat değişebilir. Kesin ücreti saat seçince görürsün.
                    </p>
                  </Card>
                </Col>
                <Col xs={24}>
                  <h3 className="mb-vd-subtitle">Aktif kampanyalar</h3>
                  {(v.campaigns || []).length ? (
                    <Row gutter={[16, 16]}>
                      {v.campaigns.map((c) => (
                        <Col key={c.campaignId} xs={24} md={12}>
                          <CampaignCard c={c} pitches={pitches} />
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Card>
                      <EmptyState description="Şu an aktif kampanya yok" />
                    </Card>
                  )}
                </Col>
                {v.cancellationPolicy && <Col xs={24}>{cancellation}</Col>}
              </Row>
            ),
          },
          {
            key: 'reviews',
            label: `Yorumlar (${v.reviewCount || 0})`,
            children: (
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={8}>
                  <Card>
                    <div className="mb-vd-score">
                      <strong>{v.reviewCount ? Number(v.rating || 0).toFixed(1) : '-'}</strong>
                      <Rate disabled allowHalf value={Math.round((v.rating || 0) * 2) / 2} />
                      <span>{v.reviewCount || 0} değerlendirme</span>
                    </div>
                    <div className="mb-vd-bars">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const c = breakdown[n] || breakdown[String(n)] || 0;
                        return (
                          <div key={n} className="mb-vd-bars__row">
                            <span>{n}</span>
                            <Progress
                              percent={totalReviews ? Math.round((c / totalReviews) * 100) : 0}
                              showInfo={false}
                              size="small"
                              strokeColor="var(--mb-gold)"
                              trailColor="var(--mb-surface-2)"
                            />
                            <em>{c}</em>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </Col>
                <Col xs={24} lg={16}>
                  <Card>
                    {(v.reviews || []).length === 0 ? (
                      <EmptyState description="Henüz yorum yok. Burada maç yap, ilk yorumu sen yaz!" />
                    ) : (
                      <div className="mb-vd-reviews">
                        {v.reviews.map((r) => (
                          <div key={r.reviewId} className="mb-vd-review">
                            <PlayerAvatar player={r.player} size={40} />
                            <div className="mb-vd-review__body">
                              <div className="mb-vd-review__head">
                                {r.player ? <PlayerLink player={r.player} /> : <strong>Oyuncu</strong>}
                                <Rate disabled value={r.rating} className="mb-vd-review__rate" />
                                <span>{fromNow(r.createdAt)}</span>
                              </div>
                              {r.comment && <p>{r.comment}</p>}
                              {r.ownerReply && (
                                <div className="mb-vd-review__reply">
                                  <strong>İşletmenin yanıtı</strong>
                                  {r.repliedAt && <span> · {fromNow(r.repliedAt)}</span>}
                                  <p>{r.ownerReply}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'location',
            label: 'Konum',
            children: (
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={16}>
                  <Card styles={{ body: { padding: 12 } }}>
                    {coords ? (
                      <MapContainer center={coords} zoom={15} className="mb-vd-map" scrollWheelZoom={false}>
                        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
                        <Marker position={coords} icon={markerIcon} />
                      </MapContainer>
                    ) : (
                      <EmptyState description="Konum bilgisi yok" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="Adres">
                    <p className="mb-vd-address">{v.address}</p>
                    <p className="mb-hint">{[v.district, v.city].filter(Boolean).join(', ')}</p>
                    {coords && (
                      <Button type="primary" block icon={<CompassOutlined />} href={directionsUrl(coords)} target="_blank" rel="noopener noreferrer">
                        Yol tarifi
                      </Button>
                    )}
                    {v.phone && (
                      <Button block style={{ marginTop: 8 }} icon={<PhoneOutlined />} href={`tel:${v.phone.replace(/\s/g, '')}`}>
                        {v.phone}
                      </Button>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </>
  );
}
