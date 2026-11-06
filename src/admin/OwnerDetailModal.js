import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Col,
  Descriptions,
  Empty,
  Grid,
  Image,
  Modal,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CopyOutlined,
  EnvironmentOutlined,
  KeyOutlined,
  LockOutlined,
  PhoneOutlined,
  ShopOutlined,
  StarFilled,
} from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { adminVenuesApi, AMENITIES, DAYS, formatPrice, maskToDays, SURFACE } from '../api/venues';
import { Stat } from '../ui';
import { apiErrorMessage, formatDate, formatDateTime, mediaUrl } from '../utils/format';
import './OwnerDetailModal.css';

const { Text, Paragraph, Title } = Typography;

// Bilinen eksik kodları (çeviri anahtarları: adminVenues:ownerDetail.missing.<kod>)
const MISSING_KEYS = ['photo', 'pitch', 'location', 'address', 'listed', 'membership', 'hours'];

/** Panoya kopyalanabilir değer */
function Copyable({ value, children }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  if (!value) return <Text type="secondary">-</Text>;
  return (
    <Space size={6} className="mb-od-copyable">
      <span className="mb-od-copyable__value">{children ?? value}</span>
      <Tooltip title={t('adminVenues:ownerDetail.copy')}>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard?.writeText(String(value));
            message.success(t('adminVenues:ownerDetail.copied'));
          }}
        />
      </Tooltip>
    </Space>
  );
}

function membershipChip(o, t) {
  if (o.membershipSuspended) return <span className="mb-chip is-rejected">{t('adminVenues:ownerDetail.membership.suspended')}</span>;
  if (!o.membershipActive) return <span className="mb-chip is-rejected">{t('adminVenues:ownerDetail.membership.expired')}</span>;
  return <span className="mb-chip is-approved">{t('adminVenues:ownerDetail.membership.active')}</span>;
}

/* ---------------- Giriş bilgileri ---------------- */
function Credentials({ detail }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const [reset, setReset] = useState(null);
  const [busy, setBusy] = useState(false);

  const doReset = async () => {
    setBusy(true);
    try {
      const res = await adminVenuesApi.resetOwnerPassword(detail.owner.playerId);
      setReset(res);
      message.success(t('adminVenues:ownerDetail.credentials.resetSuccess'));
    } catch (e) {
      message.error(apiErrorMessage(e, t('adminVenues:ownerDetail.credentials.resetFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-od-card">
      <div className="mb-od-card__title">
        <LockOutlined /> {t('adminVenues:ownerDetail.credentials.title')}
      </div>
      <Descriptions column={1} size="small" labelStyle={{ width: isPhone ? 100 : 130 }}>
        <Descriptions.Item label={t('adminVenues:ownerDetail.credentials.userName')}>
          <Copyable value={detail.owner.userName}>@{detail.owner.userName}</Copyable>
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.credentials.password')}>
          {reset ? (
            <Copyable value={reset.password}>
              <code className="mb-od-password">{reset.password}</code>
            </Copyable>
          ) : (
            <Text type="secondary">{t('adminVenues:ownerDetail.credentials.hashed')}</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
      {reset ? (
        <Alert
          type="warning"
          showIcon
          message={t('adminVenues:ownerDetail.credentials.shownOnceTitle')}
          description={t('adminVenues:ownerDetail.credentials.shownOnceDescription')}
        />
      ) : (
        <>
          <Paragraph type="secondary" className="mb-od-hint">
            {t('adminVenues:ownerDetail.credentials.hint')}
          </Paragraph>
          <Popconfirm
            title={t('adminVenues:ownerDetail.credentials.resetConfirm')}
            description={t('adminVenues:ownerDetail.credentials.resetConfirmDescription')}
            okText={t('common:actions.reset')}
            okButtonProps={{ danger: true }}
            cancelText={t('common:actions.cancel')}
            onConfirm={doReset}
          >
            <Button icon={<KeyOutlined />} loading={busy}>
              {t('adminVenues:ownerDetail.credentials.resetButton')}
            </Button>
          </Popconfirm>
        </>
      )}
    </div>
  );
}

/* ---------------- Tesis ---------------- */
function VenuePanel({ v }) {
  const { t } = useTranslation();
  const isPhone = Grid.useBreakpoint().md === false;
  const am = v.amenities || {};
  const activeAmenities = AMENITIES.filter((a) => am[a.key]);
  const coords = (v.location || '').split(',').map((x) => parseFloat(x));
  const hasCoords = coords.length === 2 && coords.every(Number.isFinite);

  return (
    <div className="mb-od-venue">
      {/* Durum */}
      <Space wrap style={{ marginBottom: 12 }}>
        {v.isVisible ? (
          <span className="mb-chip is-approved">{t('adminVenues:ownerDetail.venue.visible')}</span>
        ) : (
          <span className="mb-chip is-rejected">{t('adminVenues:ownerDetail.venue.notVisible')}</span>
        )}
        {v.isListed ? <Tag>{t('adminVenues:ownerDetail.venue.listed')}</Tag> : <Tag color="red">{t('adminVenues:ownerDetail.venue.unlisted')}</Tag>}
        {v.hasActiveCampaign && <Tag color="gold">{t('adminVenues:ownerDetail.venue.activeCampaign')}</Tag>}
        {v.rating != null && (
          <Tag icon={<StarFilled style={{ color: 'var(--mb-gold)' }} />}>
            {Number(v.rating).toFixed(1)} · {t('adminVenues:ownerDetail.venue.reviews', { count: v.reviewCount || 0 })}
          </Tag>
        )}
      </Space>
      {v.missing?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('adminVenues:ownerDetail.venue.missingTitle')}
          description={v.missing.map((m) => (MISSING_KEYS.includes(m) ? t(`adminVenues:ownerDetail.missing.${m}`) : m)).join(' · ')}
        />
      )}

      {/* Fotoğraflar */}
      <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.photos', { count: v.photos?.length || 0 })}</div>
      {v.photos?.length ? (
        <Image.PreviewGroup>
          <div className="mb-od-photos">
            {v.photos.map((p) => (
              <div key={p.photoId} className={`mb-od-photo ${p.isCover ? 'is-cover' : ''}`}>
                <Image src={mediaUrl(p.url, 'md')} preview={{ src: mediaUrl(p.url, 'lg') }} alt="" loading="lazy" decoding="async" />
                {p.isCover && <span className="mb-od-photo__badge">{t('adminVenues:ownerDetail.venue.cover')}</span>}
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('adminVenues:ownerDetail.venue.noPhotos')} />
      )}

      {/* Genel bilgiler */}
      <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.infoTitle')}</div>
      <Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.name')}>{v.name}</Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.phone')}>
          <Copyable value={v.phone} />
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.cityDistrict')}>
          {[v.city, v.district].filter(Boolean).join(' / ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.location')}>
          {hasCoords ? (
            <a href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`} target="_blank" rel="noopener noreferrer">
              <EnvironmentOutlined /> {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
            </a>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.address')} span={2}>
          <Copyable value={v.address} />
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.description')} span={2}>
          {v.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('adminVenues:ownerDetail.venue.cancellationPolicy')} span={2}>
          {v.cancellationPolicy || '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* Olanaklar ve ekstra ücretler */}
      <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.amenities')}</div>
      {activeAmenities.length ? (
        <Space wrap>
          {activeAmenities.map((a) => (
            <Tag key={a.key}>
              {a.label}
              {a.key === 'cleatRental' && v.prices?.cleatRentalPrice != null && ` · ${formatPrice(v.prices.cleatRentalPrice)}`}
              {a.key === 'camera' && v.prices?.cameraPrice != null && ` · ${formatPrice(v.prices.cameraPrice)}`}
            </Tag>
          ))}
        </Space>
      ) : (
        <Text type="secondary">{t('adminVenues:ownerDetail.venue.noAmenities')}</Text>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 4 }}>
        <Col xs={24} lg={14}>
          <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.pitches', { count: v.pitches?.length || 0 })}</div>
          <Table
            size="small"
            rowKey="pitchId"
            pagination={false}
            scroll={isPhone ? { x: 'max-content' } : undefined}
            dataSource={v.pitches || []}
            locale={{ emptyText: t('adminVenues:ownerDetail.venue.noPitches') }}
            columns={[
              { title: t('adminVenues:ownerDetail.venue.pitchColumns.pitch'), dataIndex: 'name' },
              { title: t('adminVenues:ownerDetail.venue.pitchColumns.surface'), dataIndex: 'surface', render: (s) => SURFACE[s] || '-' },
              {
                title: t('adminVenues:ownerDetail.venue.pitchColumns.type'),
                dataIndex: 'isIndoor',
                render: (i) => (i ? t('common:indoor') : t('common:outdoor')),
              },
              { title: t('adminVenues:ownerDetail.venue.pitchColumns.format'), dataIndex: 'playersPerSide', render: (n) => `${n}+${n}` },
              { title: t('adminVenues:ownerDetail.venue.pitchColumns.hourly'), dataIndex: 'basePrice', render: formatPrice },
              {
                title: t('adminVenues:ownerDetail.venue.pitchColumns.status'),
                dataIndex: 'isActive',
                render: (a) =>
                  a === false ? (
                    <Tag color="red">{t('adminVenues:ownerDetail.venue.inactive')}</Tag>
                  ) : (
                    <Tag color="green">{t('adminVenues:ownerDetail.venue.active')}</Tag>
                  ),
              },
            ]}
          />
        </Col>
        <Col xs={24} lg={10}>
          <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.hours')}</div>
          <div className="mb-od-hours">
            {(v.openingHours || []).map((h) => (
              <div key={h.dayOfWeek}>
                <span>{DAYS[h.dayOfWeek]}</span>
                <span>
                  {h.isClosed ? (
                    <Text type="secondary">{t('adminVenues:ownerDetail.venue.closed')}</Text>
                  ) : (
                    `${(h.openTime || '').slice(0, 5)} – ${(h.closeTime || '').slice(0, 5)}`
                  )}
                </span>
              </div>
            ))}
            {!v.openingHours?.length && <Text type="secondary">{t('adminVenues:ownerDetail.venue.notEntered')}</Text>}
          </div>
        </Col>
      </Row>

      <div className="mb-od-section-title">{t('adminVenues:ownerDetail.venue.campaigns', { count: v.campaigns?.length || 0 })}</div>
      {v.campaigns?.length ? (
        <div className="mb-od-campaigns">
          {v.campaigns.map((c) => (
            <div key={c.campaignId} className="mb-od-campaign">
              <strong>{c.title}</strong>
              <span>
                {c.discountPercent
                  ? t('adminVenues:ownerDetail.venue.discount', { percent: c.discountPercent })
                  : t('adminVenues:ownerDetail.venue.fixedPrice', { price: formatPrice(c.fixedPrice) })}{' '}
                · {maskToDays(c.daysMask).join(', ')} ·{' '}
                {String(c.fromHour).padStart(2, '0')}:00–{String(c.toHour).padStart(2, '0')}:00
              </span>
              <Text type="secondary">
                {formatDate(c.startDate)} – {formatDate(c.endDate)}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary">{t('adminVenues:ownerDetail.venue.noCampaigns')}</Text>
      )}
    </div>
  );
}

/* ---------------- Pencere ---------------- */
export default function OwnerDetailModal({ ownerId, open, onClose }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setDetail(null);
    try {
      setDetail(await adminVenuesApi.ownerDetail(ownerId));
    } catch (e) {
      message.error(apiErrorMessage(e, t('adminVenues:ownerDetail.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [ownerId, message, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const d = detail;
  const venues = d?.venueDetails || [];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1000} destroyOnClose className="mb-od-modal" title={null}>
      {loading || !d ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <>
          {/* Başlık */}
          <div className="mb-od-head">
            <div className="mb-od-head__icon">
              {venues[0]?.photos?.[0] ? <img src={mediaUrl(venues[0].photos[0].url, 'sm')} alt="" decoding="async" /> : <ShopOutlined />}
            </div>
            <div className="mb-od-head__text">
              <Title level={3} className="mb-od-head__title">
                {d.owner.name}
              </Title>
              <Space wrap size={8}>
                {membershipChip(d, t)}
                <Text type="secondary">
                  <Trans
                    i18nKey="adminVenues:ownerDetail.membership.until"
                    values={{
                      date: d.membershipUntil ? formatDate(d.membershipUntil) : t('adminVenues:ownerDetail.membership.unlimited'),
                    }}
                    components={{ b: <strong /> }}
                  />
                </Text>
                {d.createdAt && (
                  <Text type="secondary">{t('adminVenues:ownerDetail.membership.registered', { date: formatDate(d.createdAt) })}</Text>
                )}
              </Space>
            </div>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <div className="mb-od-card">
                <div className="mb-od-card__title">
                  <PhoneOutlined /> {t('adminVenues:ownerDetail.contact.title')}
                </div>
                <Descriptions column={1} size="small" labelStyle={{ width: isPhone ? 100 : 130 }}>
                  <Descriptions.Item label={t('adminVenues:ownerDetail.contact.contactName')}>{d.owner.contactName || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('adminVenues:ownerDetail.contact.phone')}>
                    <Copyable value={d.owner.phoneNumber} />
                  </Descriptions.Item>
                  <Descriptions.Item label={t('adminVenues:ownerDetail.contact.email')}>
                    <Copyable value={d.owner.email} />
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Credentials detail={d} />
            </Col>
          </Row>

          <div className="mb-od-stats">
            <Stat value={d.stats?.totalReservations ?? 0} label={t('adminVenues:ownerDetail.stats.totalReservations')} />
            <Stat value={d.stats?.pendingCount ?? 0} label={t('adminVenues:ownerDetail.stats.pending')} accent="var(--mb-gold)" />
            <Stat
              value={d.stats?.upcomingApprovedCount ?? 0}
              label={t('adminVenues:ownerDetail.stats.upcomingApproved')}
              accent="var(--mb-primary)"
            />
            <Stat value={d.stats?.rejectedCount ?? 0} label={t('adminVenues:ownerDetail.stats.rejected')} />
            <Stat value={formatPrice(d.stats?.approvedRevenue ?? 0)} label={t('adminVenues:ownerDetail.stats.revenue')} />
          </div>
          {d.stats?.lastReservationAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('adminVenues:ownerDetail.stats.lastReservation', { date: formatDateTime(d.stats.lastReservationAt) })}
            </Text>
          )}

          <div className="mb-od-venues">
            {venues.length === 0 ? (
              <Empty description={t('adminVenues:ownerDetail.noVenues')} />
            ) : venues.length === 1 ? (
              <VenuePanel v={venues[0]} />
            ) : (
              <Tabs items={venues.map((v) => ({ key: String(v.stadiumId), label: v.name, children: <VenuePanel v={v} /> }))} />
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
