import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Marker } from 'react-leaflet';
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
import { useTranslation } from 'react-i18next';
import { AMENITIES, contractDayIndex, DAYS, formatPrice, maskToDays, SURFACE, venuesApi } from '../../api/venues';
import { useMessages } from '../../messaging/MessagesContext';
import { EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, formatDate, fromNow, mediaUrl } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import SlotPicker, { DateStrip } from './SlotPicker';
import { AMENITY_ICONS, directionsUrl, parseLocation, VenueRating } from './Venues';
import { appleDirectionsUrl, isIOS, MbMap, venuePinIcon } from '../../ui/map/mapKit';
import './VenueDetail.css';
import { SwipeTabs } from '../../ui/Swipe';

const hhmm = (t) => (t ? String(t).slice(0, 5) : '--:--');

/** Kampanya kartı (altın) */
export function CampaignCard({ c, pitches = [] }) {
  const { t } = useTranslation();
  const pitch = c.pitchId ? pitches.find((p) => p.pitchId === c.pitchId) : null;
  const days = maskToDays(c.daysMask || 0);
  return (
    <div className="mb-campaign">
      <div className="mb-campaign__badge">
        {c.discountPercent ? (
          <>
            <strong>{t('venues:detail.campaign.discountValue', { value: c.discountPercent })}</strong>
            <span>{t('venues:detail.campaign.discount')}</span>
          </>
        ) : (
          <>
            <strong>{formatPrice(c.fixedPrice)}</strong>
            <span>{t('venues:detail.campaign.perHour')}</span>
          </>
        )}
      </div>
      <div className="mb-campaign__text">
        <h4>
          <FireOutlined /> {c.title}
        </h4>
        {c.description && <p>{c.description}</p>}
        <span>
          {days.length === 7 ? t('venues:detail.campaign.everyDay') : days.join(', ')} · {String(c.fromHour).padStart(2, '0')}:00–{String(c.toHour).padStart(2, '0')}:00
          {pitch ? ` · ${pitch.name}` : ''}
        </span>
        {c.endDate && <span>{t('venues:detail.campaign.until', { date: formatDate(c.endDate) })}</span>}
      </div>
    </div>
  );
}

export default function VenueDetail() {
  const { t } = useTranslation();
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
        else message.error(apiErrorMessage(e, t('venues:shared.venueLoadError')));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, message, t]);

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
    return (
      <Result
        status="404"
        title={t('venues:detail.notFoundTitle')}
        subTitle={t('venues:detail.notFoundSubtitle')}
        extra={<Button type="primary" onClick={() => navigate('/venues')}>{t('venues:detail.backToVenues')}</Button>}
      />
    );
  }

  const v = venue;
  const coords = parseLocation(v.location);
  const pitches = v.pitches || [];
  const todayIdx = contractDayIndex(dayjs());
  const messageOwner = () =>
    v.owner && openMessages({ type: 'user', data: { playerId: v.owner.playerId, playerName: v.owner.name, userName: t('venues:detail.ownerUserName') } });
  const pickSlot = (slot, pitch) =>
    navigate(`/matches/new?stadiumId=${v.stadiumId}&pitchId=${pitch.pitchId}&start=${encodeURIComponent(dayjs(slot.start).format('YYYY-MM-DDTHH:mm:ss'))}`);

  const breakdown = v.ratingBreakdown || {};
  const totalReviews = Object.values(breakdown).reduce((s, n) => s + (n || 0), 0);
  const hours = (v.openingHours || []).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const amenityList = AMENITIES.filter((a) => v.amenities?.[a.key]);

  const cancellation = v.cancellationPolicy && (
    <Alert type="info" showIcon icon={<InfoCircleOutlined />} className="mb-vd-policy" message={t('venues:detail.cancellationPolicy')} description={v.cancellationPolicy} />
  );

  return (
    <>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/venues')} className="mb-vd-back">
        {t('venues:detail.allVenues')}
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
                      <FireOutlined /> {t('venues:shared.campaign')}
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
          <span className="mb-page-header__eyebrow">{t('venues:detail.eyebrow')}</span>
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
              <span>{t('venues:detail.stats.lowestPerHour')}</span>
            </div>
            <div>
              <strong>{pitches.length || v.pitchCount}</strong>
              <span>{t('venues:detail.stats.pitches')}</span>
            </div>
            <div>
              <strong>
                {hours[todayIdx]?.isClosed ? t('venues:shared.closed') : `${hhmm(hours[todayIdx]?.openTime)}–${hhmm(hours[todayIdx]?.closeTime)}`}
              </strong>
              <span>{t('venues:detail.stats.today')}</span>
            </div>
          </div>
          <div className="mb-vd-info__actions">
            <Button type="primary" size="large" icon={<CalendarOutlined />} onClick={() => setTab('slots')}>
              {t('venues:shared.pickTime')}
            </Button>
            {v.owner && (
              <Button size="large" icon={<MessageOutlined />} onClick={messageOwner}>
                {t('venues:detail.messageOwner')}
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

      <SwipeTabs>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          className="mb-vd-tabs"
          items={[
            {
              key: 'slots',
              label: t('venues:shared.pickTime'),
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
                        <h4>{t('venues:detail.howTo.title')}</h4>
                        <ol>
                          <li>{t('venues:detail.howTo.step1')}</li>
                          <li>{t('venues:detail.howTo.step2')}</li>
                          <li>{t('venues:detail.howTo.step3')}</li>
                        </ol>
                        <p className="mb-hint">{t('venues:shared.paymentOnSite')}</p>
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
              label: t('venues:detail.tabs.pitches', { count: pitches.length }),
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
                            <span>{SURFACE[p.surface] || t('common:pitch')}</span>
                            <span>
                              {p.isIndoor ? <HomeOutlined /> : <SunOutlined />} {p.isIndoor ? t('common:indoor') : t('common:outdoor')}
                            </span>
                            <span>
                              <TeamOutlined /> {t('venues:detail.pitchCard.players', { count: p.playersPerSide * 2 })}
                            </span>
                          </div>
                          <div className="mb-pitch-card__price">
                            <strong>{formatPrice(p.basePrice)}</strong> <span>{t('venues:detail.pitchCard.priceFromSuffix')}</span>
                          </div>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Card>
                  <EmptyState description={t('venues:detail.noPitchInfo')} />
                </Card>
              ),
            },
            {
              key: 'prices',
              label: t('venues:detail.tabs.prices'),
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={12}>
                    <Card title={<span><ClockCircleOutlined /> {t('venues:detail.prices.openingHours')}</span>}>
                      <table className="mb-vd-hours">
                        <tbody>
                          {DAYS.map((name, i) => {
                            const h = hours.find((x) => x.dayOfWeek === i);
                            return (
                              <tr key={name} className={i === todayIdx ? 'is-today' : ''}>
                                <td>{name}</td>
                                <td>{!h ? '-' : h.isClosed ? <span className="mb-vd-hours__closed">{t('venues:shared.closed')}</span> : `${hhmm(h.openTime)} – ${hhmm(h.closeTime)}`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title={t('venues:detail.prices.title')}>
                      <div className="mb-vd-pricelist">
                        {pitches.map((p) => (
                          <div key={p.pitchId}>
                            <span>{t('venues:detail.prices.hourly', { name: p.name })}</span>
                            <strong>{formatPrice(p.basePrice)}</strong>
                          </div>
                        ))}
                        {v.amenities?.cleatRental && v.prices?.cleatRentalPrice != null && (
                          <div>
                            <span>{AMENITY_ICONS.cleatRental} {t('venues:detail.prices.cleatRentalPair')}</span>
                            <strong>{formatPrice(v.prices.cleatRentalPrice)}</strong>
                          </div>
                        )}
                        {v.amenities?.camera && v.prices?.cameraPrice != null && (
                          <div>
                            <span>{AMENITY_ICONS.camera} {t('venues:amenities.camera')}</span>
                            <strong>{formatPrice(v.prices.cameraPrice)}</strong>
                          </div>
                        )}
                      </div>
                      <p className="mb-hint" style={{ marginTop: 12 }}>
                        {t('venues:detail.prices.note')}
                      </p>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <h3 className="mb-vd-subtitle">{t('venues:detail.prices.activeCampaigns')}</h3>
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
                        <EmptyState description={t('venues:detail.prices.noCampaigns')} />
                      </Card>
                    )}
                  </Col>
                  {v.cancellationPolicy && <Col xs={24}>{cancellation}</Col>}
                </Row>
              ),
            },
            {
              key: 'reviews',
              label: t('venues:detail.tabs.reviews', { count: v.reviewCount || 0 }),
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={8}>
                    <Card>
                      <div className="mb-vd-score">
                        <strong>{v.reviewCount ? Number(v.rating || 0).toFixed(1) : '-'}</strong>
                        <Rate disabled allowHalf value={Math.round((v.rating || 0) * 2) / 2} />
                        <span>{t('venues:detail.reviews.count', { count: v.reviewCount || 0 })}</span>
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
                        <EmptyState description={t('venues:detail.reviews.empty')} />
                      ) : (
                        <div className="mb-vd-reviews">
                          {v.reviews.map((r) => (
                            <div key={r.reviewId} className="mb-vd-review">
                              <PlayerAvatar player={r.player} size={40} />
                              <div className="mb-vd-review__body">
                                <div className="mb-vd-review__head">
                                  {r.player ? <PlayerLink player={r.player} /> : <strong>{t('venues:detail.reviews.player')}</strong>}
                                  <Rate disabled value={r.rating} className="mb-vd-review__rate" />
                                  <span>{fromNow(r.createdAt)}</span>
                                </div>
                                {r.comment && <p>{r.comment}</p>}
                                {r.ownerReply && (
                                  <div className="mb-vd-review__reply">
                                    <strong>{t('venues:detail.reviews.ownerReply')}</strong>
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
              label: t('venues:detail.tabs.location'),
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={16}>
                    <Card styles={{ body: { padding: 12 } }}>
                      {coords ? (
                        <MbMap center={coords} zoom={15} className="mb-vd-map" scrollWheelZoom={false}>
                          <Marker position={coords} icon={venuePinIcon({ active: true })} title={v.name} keyboard={false} />
                        </MbMap>
                      ) : (
                        <EmptyState description={t('venues:detail.location.noLocation')} />
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card title={t('venues:detail.location.address')}>
                      <p className="mb-vd-address">{v.address}</p>
                      <p className="mb-hint">{[v.district, v.city].filter(Boolean).join(', ')}</p>
                      {coords && (
                        <Button type="primary" block icon={<CompassOutlined />} href={directionsUrl(coords)} target="_blank" rel="noopener noreferrer">
                          {t('venues:detail.location.directions')}
                        </Button>
                      )}
                      {coords && isIOS() && (
                        <Button block style={{ marginTop: 8 }} href={appleDirectionsUrl(coords)} target="_blank" rel="noopener noreferrer">
                          {t('common:map.appleMaps')}
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
      </SwipeTabs>
    </>
  );
}
