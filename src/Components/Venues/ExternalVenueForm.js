import React, { useState } from 'react';
import { Alert, App, Button, Col, DatePicker, Input, InputNumber, Row, Segmented, TimePicker, Tooltip } from 'antd';
import {
  AimOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../api/venues';

/** Harici sahanın boş hali (CreateMatch durumunda tutulur) */
export const EMPTY_EXTERNAL = {
  venueId: null,
  name: '',
  phone: '',
  city: '',
  district: '',
  address: '',
  location: '',
  date: null,
  time: null,
  price: null,
};

/** Seçilen gün + saat → başlangıç (dayjs) */
export const externalStart = (ext) =>
  ext.date && ext.time ? ext.date.hour(ext.time.hour()).minute(ext.time.minute()).second(0).millisecond(0) : null;

/** "lat, lon" → Google Haritalar yol tarifi (konum yoksa adres araması) */
export const mapsUrl = (venue) => {
  if (venue?.location) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue.location.replace(/\s/g, ''))}`;
  const q = [venue?.name, venue?.address, venue?.district, venue?.city].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
};

/** Telefon bağlantısı: yalnızca rakam ve + */
export const telUrl = (phone) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);

/**
 * Harici (anlaşmasız) saha: oyuncu sahayı telefonla kendisi ayarlar (MatcBuddy/docs/external-venues-api.md).
 * Önceki harici sahalardan biri seçilebilir ya da yeni saha bilgisi girilir; ardından gün, saat, süre ve (isteğe bağlı) ücret.
 */
export default function ExternalVenueForm({ value, onChange, savedVenues, durationOptions, duration, onDurationChange }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [locating, setLocating] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });

  const pickSaved = (v) => {
    if (value.venueId === v.stadiumId) {
      set({ venueId: null, name: '', phone: '', city: '', district: '', address: '', location: '' });
      return;
    }
    set({
      venueId: v.stadiumId,
      name: v.name || '',
      phone: v.phone || '',
      city: v.city || '',
      district: v.district || '',
      address: v.address || '',
      location: v.location || '',
    });
  };

  // Ad değişirse artık kayıtlı saha değil, yeni saha (aynı adla kaydedilirse sunucu eskisini kullanır)
  const changeName = (name) => {
    const saved = savedVenues.find((v) => v.stadiumId === value.venueId);
    set({ name, venueId: saved && saved.name === name ? saved.stadiumId : null });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      message.warning(t('venues:external.locationUnsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set({ location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      () => {
        setLocating(false);
        message.warning(t('venues:external.locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const start = externalStart(value);
  const inPast = start && start.isBefore(dayjs());

  return (
    <div className="mb-ext">
      <Alert type="info" showIcon icon={<PhoneOutlined />} className="mb-ext__intro" message={t('venues:external.intro')} description={t('venues:external.introHint')} />

      {savedVenues.length > 0 && (
        <div className="mb-cm-field">
          <label>
            <HistoryOutlined /> {t('venues:external.savedVenues')}
          </label>
          <div className="mb-ext__saved">
            {savedVenues.map((v) => (
              <button
                type="button"
                key={v.stadiumId}
                className={`mb-ext__saved-item${value.venueId === v.stadiumId ? ' is-active' : ''}`}
                onClick={() => pickSaved(v)}
              >
                <strong>{v.name}</strong>
                <span>{[v.district, v.city].filter(Boolean).join(', ') || v.phone || t('venues:external.matchCount', { count: v.matchCount })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <div className="mb-cm-field">
            <label>{t('venues:external.name')}</label>
            <Input size="large" maxLength={100} value={value.name} onChange={(e) => changeName(e.target.value)} placeholder={t('venues:external.namePlaceholder')} prefix={<EnvironmentOutlined />} />
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div className="mb-cm-field">
            <label>{t('venues:external.phone')}</label>
            <Input size="large" maxLength={30} inputMode="tel" value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder={t('venues:external.phonePlaceholder')} prefix={<PhoneOutlined />} />
          </div>
        </Col>
        <Col xs={12} md={8}>
          <div className="mb-cm-field">
            <label>{t('venues:external.city')}</label>
            <Input size="large" maxLength={60} value={value.city} onChange={(e) => set({ city: e.target.value })} />
          </div>
        </Col>
        <Col xs={12} md={8}>
          <div className="mb-cm-field">
            <label>{t('venues:external.district')}</label>
            <Input size="large" maxLength={60} value={value.district} onChange={(e) => set({ district: e.target.value })} />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="mb-cm-field">
            <label>{t('venues:external.location')}</label>
            {value.location ? (
              <div className="mb-ext__loc">
                <a href={mapsUrl({ location: value.location })} target="_blank" rel="noreferrer">
                  <AimOutlined /> {t('venues:external.locationAdded')}
                </a>
                <Tooltip title={t('common:actions.delete')}>
                  <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => set({ location: '' })} aria-label={t('common:actions.delete')} />
                </Tooltip>
              </div>
            ) : (
              <Button size="large" block icon={<AimOutlined />} loading={locating} onClick={locate}>
                {t('venues:external.useMyLocation')}
              </Button>
            )}
          </div>
        </Col>
      </Row>
      <div className="mb-cm-field">
        <label>{t('venues:external.address')}</label>
        <Input.TextArea rows={2} maxLength={300} value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder={t('venues:external.addressPlaceholder')} />
      </div>

      <Row gutter={16}>
        <Col xs={12} md={8}>
          <div className="mb-cm-field">
            <label>
              <CalendarOutlined /> {t('venues:external.date')}
            </label>
            <DatePicker
              size="large"
              format="DD MMM ddd"
              value={value.date}
              onChange={(d) => set({ date: d ? d.startOf('day') : null })}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              inputReadOnly
              style={{ width: '100%' }}
            />
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="mb-cm-field">
            <label>
              <ClockCircleOutlined /> {t('venues:external.time')}
            </label>
            <TimePicker
              size="large"
              format="HH:mm"
              minuteStep={15}
              needConfirm={false}
              showNow={false}
              inputReadOnly
              value={value.time}
              onChange={(v) => set({ time: v })}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div className="mb-cm-field">
            <label>{t('venues:external.price')}</label>
            <InputNumber
              size="large"
              inputMode="numeric"
              min={0}
              max={100000}
              step={50}
              value={value.price}
              onChange={(v) => set({ price: v })}
              addonAfter="₺"
              placeholder={t('venues:external.pricePlaceholder')}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
      </Row>
      {inPast && <Alert type="warning" showIcon message={t('venues:external.pastWarning')} style={{ marginBottom: 16 }} />}

      <div className="mb-cm-field">
        <label>{t('venues:createMatch.slot.duration')}</label>
        <Segmented size="large" options={durationOptions} value={duration} onChange={onDurationChange} />
      </div>
      <p className="mb-hint">
        <InfoCircleOutlined /> {t('venues:external.priceHint')}
      </p>
    </div>
  );
}

/** Sağdaki özet: harici saha (fiyat teklifi yok; kurucunun girdiği ücret kişi başına bölünür) */
export function ExternalReceipt({ value, duration, userCount }) {
  const { t } = useTranslation();
  const start = externalStart(value);
  if (!value.name.trim() || !start) {
    return (
      <div className="mb-receipt is-empty">
        <h3 className="mb-receipt__title">{t('venues:external.receiptTitle')}</h3>
        <p className="mb-hint">{t('venues:external.receiptEmpty')}</p>
      </div>
    );
  }
  const end = start.add(duration, 'minute');
  const per = value.price > 0 && userCount > 0 ? Math.ceil((value.price / userCount) * 100) / 100 : null;
  return (
    <div className="mb-receipt">
      <h3 className="mb-receipt__title">{t('venues:external.receiptTitle')}</h3>
      <div className="mb-receipt__venue">
        <span className="mb-ext__badge-icon">
          <PhoneOutlined />
        </span>
        <div>
          <strong>{value.name.trim()}</strong>
          <span>{[value.district, value.city].filter(Boolean).join(', ') || t('venues:external.badge')}</span>
        </div>
      </div>
      <div className="mb-receipt__when">
        <span>
          <CalendarOutlined /> {start.format('DD MMMM dddd')}
        </span>
        <span>
          <ClockCircleOutlined /> {start.format('HH:mm')}–{end.format('HH:mm')} · {t('venues:createMatch.minutes', { count: duration })}
        </span>
      </div>
      {value.price > 0 ? (
        <>
          <div className="mb-receipt__total">
            <span>{t('venues:createMatch.receipt.total')}</span>
            <strong>{formatPrice(value.price)}</strong>
          </div>
          {per != null && (
            <div className="mb-receipt__per">
              <span>{t('venues:createMatch.receipt.perPlayer')}</span>
              <strong>{formatPrice(per)}</strong>
              <small>{t('venues:createMatch.receipt.splitAmong', { count: userCount })}</small>
            </div>
          )}
        </>
      ) : (
        <p className="mb-hint">{t('venues:external.noPrice')}</p>
      )}
      <p className="mb-receipt__note">{t('venues:external.receiptNote')}</p>
    </div>
  );
}
