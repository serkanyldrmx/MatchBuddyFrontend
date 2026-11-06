import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Col,
  Descriptions,
  Empty,
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
import { adminVenuesApi, AMENITIES, DAYS, formatPrice, maskToDays, SURFACE } from '../api/venues';
import { Stat } from '../ui';
import { apiErrorMessage, fileUrl, formatDate, formatDateTime } from '../utils/format';
import './OwnerDetailModal.css';

const { Text, Paragraph, Title } = Typography;

const MISSING_LABELS = {
  photo: 'Fotoğraf yok',
  pitch: 'Aktif saha yok',
  location: 'Konum yok',
  address: 'Adres yok',
  listed: 'Yayından kaldırılmış',
  membership: 'Üyelik aktif değil',
  hours: 'Çalışma saatleri eksik',
};

/** Panoya kopyalanabilir değer */
function Copyable({ value, children }) {
  const { message } = App.useApp();
  if (!value) return <Text type="secondary">-</Text>;
  return (
    <Space size={6}>
      <span>{children ?? value}</span>
      <Tooltip title="Kopyala">
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard?.writeText(String(value));
            message.success('Kopyalandı.');
          }}
        />
      </Tooltip>
    </Space>
  );
}

function membershipChip(o) {
  if (o.membershipSuspended) return <span className="mb-chip is-rejected">Askıda</span>;
  if (!o.membershipActive) return <span className="mb-chip is-rejected">Süresi doldu</span>;
  return <span className="mb-chip is-approved">Aktif</span>;
}

/* ---------------- Giriş bilgileri ---------------- */
function Credentials({ detail }) {
  const { message } = App.useApp();
  const [reset, setReset] = useState(null);
  const [busy, setBusy] = useState(false);

  const doReset = async () => {
    setBusy(true);
    try {
      const res = await adminVenuesApi.resetOwnerPassword(detail.owner.playerId);
      setReset(res);
      message.success('Yeni geçici şifre oluşturuldu.');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Şifre sıfırlanamadı.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-od-card">
      <div className="mb-od-card__title">
        <LockOutlined /> Giriş bilgileri
      </div>
      <Descriptions column={1} size="small" labelStyle={{ width: 130 }}>
        <Descriptions.Item label="Kullanıcı adı">
          <Copyable value={detail.owner.userName}>@{detail.owner.userName}</Copyable>
        </Descriptions.Item>
        <Descriptions.Item label="Şifre">
          {reset ? (
            <Copyable value={reset.password}>
              <code className="mb-od-password">{reset.password}</code>
            </Copyable>
          ) : (
            <Text type="secondary">•••••••••• (şifreli saklanır)</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
      {reset ? (
        <Alert
          type="warning"
          showIcon
          message="Bu şifre sadece şimdi gösteriliyor"
          description="Pencereyi kapattıktan sonra bir daha görüntülenemez. İşletmeye iletin; ilk girişte değiştirmesini önerin. Eski şifre artık çalışmaz."
        />
      ) : (
        <>
          <Paragraph type="secondary" className="mb-od-hint">
            Güvenlik gereği şifreler geri çevrilemez biçimde saklanır; mevcut şifreyi kimse göremez. İşletme şifresini unuttuysa yeni bir geçici
            şifre oluşturabilirsiniz.
          </Paragraph>
          <Popconfirm
            title="Şifre sıfırlansın mı?"
            description="İşletmenin mevcut şifresi geçersiz olur ve yeni geçici şifre oluşturulur."
            okText="Sıfırla"
            okButtonProps={{ danger: true }}
            cancelText="Vazgeç"
            onConfirm={doReset}
          >
            <Button icon={<KeyOutlined />} loading={busy}>
              Şifreyi sıfırla
            </Button>
          </Popconfirm>
        </>
      )}
    </div>
  );
}

/* ---------------- Tesis ---------------- */
function VenuePanel({ v }) {
  const am = v.amenities || {};
  const activeAmenities = AMENITIES.filter((a) => am[a.key]);
  const coords = (v.location || '').split(',').map((x) => parseFloat(x));
  const hasCoords = coords.length === 2 && coords.every(Number.isFinite);

  return (
    <div className="mb-od-venue">
      {/* Durum */}
      <Space wrap style={{ marginBottom: 12 }}>
        {v.isVisible ? <span className="mb-chip is-approved">Oyunculara görünüyor</span> : <span className="mb-chip is-rejected">Oyunculara görünmüyor</span>}
        {v.isListed ? <Tag>Yayında</Tag> : <Tag color="red">Yayından kaldırıldı</Tag>}
        {v.hasActiveCampaign && <Tag color="gold">Aktif kampanya</Tag>}
        {v.rating != null && (
          <Tag icon={<StarFilled style={{ color: 'var(--mb-gold)' }} />}>
            {Number(v.rating).toFixed(1)} · {v.reviewCount || 0} yorum
          </Tag>
        )}
      </Space>
      {v.missing?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Eksikler"
          description={v.missing.map((m) => MISSING_LABELS[m] || m).join(' · ')}
        />
      )}

      {/* Fotoğraflar */}
      <div className="mb-od-section-title">Fotoğraflar ({v.photos?.length || 0})</div>
      {v.photos?.length ? (
        <Image.PreviewGroup>
          <div className="mb-od-photos">
            {v.photos.map((p) => (
              <div key={p.photoId} className={`mb-od-photo ${p.isCover ? 'is-cover' : ''}`}>
                <Image src={fileUrl(p.url)} alt="" />
                {p.isCover && <span className="mb-od-photo__badge">Kapak</span>}
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Fotoğraf yok" />
      )}

      {/* Genel bilgiler */}
      <div className="mb-od-section-title">Tesis bilgileri</div>
      <Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
        <Descriptions.Item label="Tesis adı">{v.name}</Descriptions.Item>
        <Descriptions.Item label="Telefon">
          <Copyable value={v.phone} />
        </Descriptions.Item>
        <Descriptions.Item label="İl / ilçe">
          {[v.city, v.district].filter(Boolean).join(' / ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Konum">
          {hasCoords ? (
            <a href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`} target="_blank" rel="noopener noreferrer">
              <EnvironmentOutlined /> {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
            </a>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Adres" span={2}>
          <Copyable value={v.address} />
        </Descriptions.Item>
        <Descriptions.Item label="Açıklama" span={2}>
          {v.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="İptal politikası" span={2}>
          {v.cancellationPolicy || '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* Olanaklar ve ekstra ücretler */}
      <div className="mb-od-section-title">Olanaklar</div>
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
        <Text type="secondary">Olanak girilmemiş.</Text>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 4 }}>
        <Col xs={24} lg={14}>
          <div className="mb-od-section-title">Sahalar ({v.pitches?.length || 0})</div>
          <Table
            size="small"
            rowKey="pitchId"
            pagination={false}
            dataSource={v.pitches || []}
            locale={{ emptyText: 'Saha yok' }}
            columns={[
              { title: 'Saha', dataIndex: 'name' },
              { title: 'Zemin', dataIndex: 'surface', render: (s) => SURFACE[s] || '-' },
              { title: 'Tip', dataIndex: 'isIndoor', render: (i) => (i ? 'Kapalı' : 'Açık') },
              { title: 'Format', dataIndex: 'playersPerSide', render: (n) => `${n}+${n}` },
              { title: 'Saatlik', dataIndex: 'basePrice', render: formatPrice },
              {
                title: 'Durum',
                dataIndex: 'isActive',
                render: (a) => (a === false ? <Tag color="red">Pasif</Tag> : <Tag color="green">Aktif</Tag>),
              },
            ]}
          />
        </Col>
        <Col xs={24} lg={10}>
          <div className="mb-od-section-title">Çalışma saatleri</div>
          <div className="mb-od-hours">
            {(v.openingHours || []).map((h) => (
              <div key={h.dayOfWeek}>
                <span>{DAYS[h.dayOfWeek]}</span>
                <span>{h.isClosed ? <Text type="secondary">Kapalı</Text> : `${(h.openTime || '').slice(0, 5)} – ${(h.closeTime || '').slice(0, 5)}`}</span>
              </div>
            ))}
            {!v.openingHours?.length && <Text type="secondary">Girilmemiş</Text>}
          </div>
        </Col>
      </Row>

      <div className="mb-od-section-title">Aktif kampanyalar ({v.campaigns?.length || 0})</div>
      {v.campaigns?.length ? (
        <div className="mb-od-campaigns">
          {v.campaigns.map((c) => (
            <div key={c.campaignId} className="mb-od-campaign">
              <strong>{c.title}</strong>
              <span>
                {c.discountPercent ? `%${c.discountPercent} indirim` : `${formatPrice(c.fixedPrice)} sabit`} · {maskToDays(c.daysMask).join(', ')} ·{' '}
                {String(c.fromHour).padStart(2, '0')}:00–{String(c.toHour).padStart(2, '0')}:00
              </span>
              <Text type="secondary">
                {formatDate(c.startDate)} – {formatDate(c.endDate)}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary">Aktif kampanya yok.</Text>
      )}
    </div>
  );
}

/* ---------------- Pencere ---------------- */
export default function OwnerDetailModal({ ownerId, open, onClose }) {
  const { message } = App.useApp();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setDetail(null);
    try {
      setDetail(await adminVenuesApi.ownerDetail(ownerId));
    } catch (e) {
      message.error(apiErrorMessage(e, 'İşletme bilgileri alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [ownerId, message]);

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
              {venues[0]?.photos?.[0] ? <img src={fileUrl(venues[0].photos[0].url)} alt="" /> : <ShopOutlined />}
            </div>
            <div className="mb-od-head__text">
              <Title level={3} className="mb-od-head__title">
                {d.owner.name}
              </Title>
              <Space wrap size={8}>
                {membershipChip(d)}
                <Text type="secondary">
                  Üyelik bitişi: <strong>{d.membershipUntil ? formatDate(d.membershipUntil) : 'Süresiz'}</strong>
                </Text>
                {d.createdAt && <Text type="secondary">· Kayıt: {formatDate(d.createdAt)}</Text>}
              </Space>
            </div>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <div className="mb-od-card">
                <div className="mb-od-card__title">
                  <PhoneOutlined /> İletişim
                </div>
                <Descriptions column={1} size="small" labelStyle={{ width: 130 }}>
                  <Descriptions.Item label="Yetkili kişi">{d.owner.contactName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Telefon">
                    <Copyable value={d.owner.phoneNumber} />
                  </Descriptions.Item>
                  <Descriptions.Item label="E-posta">
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
            <Stat value={d.stats?.totalReservations ?? 0} label="Toplam rezervasyon" />
            <Stat value={d.stats?.pendingCount ?? 0} label="Onay bekleyen" accent="var(--mb-gold)" />
            <Stat value={d.stats?.upcomingApprovedCount ?? 0} label="Yaklaşan onaylı" accent="var(--mb-primary)" />
            <Stat value={d.stats?.rejectedCount ?? 0} label="Reddedilen" />
            <Stat value={formatPrice(d.stats?.approvedRevenue ?? 0)} label="Gerçekleşen ciro" />
          </div>
          {d.stats?.lastReservationAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Son rezervasyon talebi: {formatDateTime(d.stats.lastReservationAt)}
            </Text>
          )}

          <div className="mb-od-venues">
            {venues.length === 0 ? (
              <Empty description="Bu işletmeye bağlı tesis yok" />
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
