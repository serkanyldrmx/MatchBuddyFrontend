import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, Skeleton, Tooltip } from 'antd';
import { CalendarOutlined, LeftOutlined, LockOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { EmptyState } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import './Venues.css';

/** Önümüzdeki N günün yatay şeridi + istenirse takvimden seçim */
export function DateStrip({ value, onChange, days = 14, withPicker = true }) {
  const { t } = useTranslation();
  const today = dayjs().startOf('day');
  const list = Array.from({ length: days }, (_, i) => today.add(i, 'day'));
  const stripRef = useRef(null);
  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  const outside = value && !list.some((d) => d.isSame(value, 'day'));

  return (
    <div className="mb-datestrip">
      <Button type="text" size="small" className="mb-datestrip__nav" icon={<LeftOutlined />} onClick={() => scroll(-1)} aria-label={t('venues:slotPicker.prevDays')} />
      <div className="mb-datestrip__list" ref={stripRef}>
        {list.map((d, i) => {
          const active = value && d.isSame(value, 'day');
          return (
            <button key={d.format('YYYY-MM-DD')} type="button" className={`mb-datestrip__day ${active ? 'is-active' : ''}`} onClick={() => onChange(d)}>
              <span className="mb-datestrip__dow">{i === 0 ? t('venues:slotPicker.today') : i === 1 ? t('venues:slotPicker.tomorrow') : d.format('ddd')}</span>
              <strong>{d.format('DD')}</strong>
              <span className="mb-datestrip__month">{d.format('MMM')}</span>
            </button>
          );
        })}
      </div>
      <Button type="text" size="small" className="mb-datestrip__nav" icon={<RightOutlined />} onClick={() => scroll(1)} aria-label={t('venues:slotPicker.nextDays')} />
      {withPicker && (
        <DatePicker
          className={`mb-datestrip__picker ${outside ? 'is-active' : ''}`}
          value={outside ? value : null}
          allowClear={false}
          format="DD MMM"
          placeholder={t('venues:slotPicker.otherDay')}
          suffixIcon={<CalendarOutlined />}
          disabledDate={(d) => d.isBefore(today, 'day')}
          onChange={(d) => d && onChange(d.startOf('day'))}
        />
      )}
    </div>
  );
}

// Durum → çeviri anahtarı
const STATUS_LABEL = {
  booked: 'venues:slotPicker.status.booked',
  pending: 'venues:slotPicker.status.booked',
  blocked: 'venues:slotPicker.status.blocked',
  past: 'venues:slotPicker.status.past',
};

/** Tek bir saat hapı */
export function SlotPill({ slot, selected, onClick }) {
  const { t } = useTranslation();
  const time = dayjs(slot.start).format('HH:mm');
  if (slot.status !== 'free') {
    return (
      <span className={`mb-slot is-${slot.status}`}>
        <strong>{time}</strong>
        <small>
          {slot.status === 'blocked' && <LockOutlined />} {t(STATUS_LABEL[slot.status] || 'venues:slotPicker.status.booked')}
        </small>
      </span>
    );
  }
  const discounted = slot.originalPrice != null && slot.originalPrice > slot.price;
  const pill = (
    <button type="button" className={`mb-slot is-free ${selected ? 'is-selected' : ''} ${discounted ? 'is-deal' : ''}`} onClick={() => onClick?.(slot)}>
      <strong>{time}</strong>
      <small>
        {discounted && <s>{formatPrice(slot.originalPrice)}</s>} {formatPrice(slot.price)}
      </small>
      {slot.campaignTitle && <em className="mb-slot__deal">{t('venues:shared.campaign')}</em>}
    </button>
  );
  return slot.campaignTitle ? <Tooltip title={slot.campaignTitle}>{pill}</Tooltip> : pill;
}

/**
 * Seçili gün için tesisin tüm aktif sahalarının saatlik dilimleri.
 * pitches: Detail'den gelen saha listesi (yüzey / kapalı bilgisi için, opsiyonel)
 * selected: { pitchId, start } — seçili dilim
 * onSelect(slot, pitch)
 * onlyPitchId: verilirse sadece o saha gösterilir
 */
export default function SlotPicker({ stadiumId, date, pitches = [], selected, onSelect, onlyPitchId, onLoaded }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const dateKey = date ? dayjs(date).format('YYYY-MM-DD') : null;

  useEffect(() => {
    if (!stadiumId || !dateKey) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    venuesApi
      .availability(stadiumId, dateKey)
      .then((res) => {
        if (!alive) return;
        setData(res);
        onLoadedRef.current?.(res);
      })
      .catch((e) => alive && setError(apiErrorMessage(e, t('venues:slotPicker.loadError'))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, dateKey, t]);

  if (!stadiumId) return <EmptyState description={t('venues:slotPicker.pickVenueFirst')} />;
  if (loading && !data) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) return <EmptyState description={error} />;
  if (!data) return null;
  if (data.isClosed) return <EmptyState description={t('venues:slotPicker.closedDay')} />;

  const rows = (data.pitches || []).filter((p) => !onlyPitchId || p.pitchId === onlyPitchId);
  if (!rows.length) return <EmptyState description={t('venues:slotPicker.noPitch')} />;

  return (
    <div className={`mb-slotpicker ${loading ? 'is-loading' : ''}`}>
      {rows.map((p) => {
        const info = pitches.find((x) => x.pitchId === p.pitchId);
        const free = (p.slots || []).filter((s) => s.status === 'free').length;
        return (
          <div key={p.pitchId} className="mb-slotpicker__row">
            <div className="mb-slotpicker__pitch">
              <strong>{p.name}</strong>
              {info && (
                <span>
                  {SURFACE[info.surface] || t('common:pitch')} · {info.isIndoor ? t('common:indoor') : t('common:outdoor')} · {info.playersPerSide}+{info.playersPerSide}
                </span>
              )}
              <span className={free ? 'is-free' : ''}>{free ? t('venues:shared.freeSlots', { count: free }) : t('venues:shared.noFreeSlots')}</span>
            </div>
            <div className="mb-slotpicker__slots">
              {(p.slots || []).length === 0 ? (
                <span className="mb-hint">{t('venues:slotPicker.noSlots')}</span>
              ) : (
                p.slots.map((s) => (
                  <SlotPill
                    key={s.start}
                    slot={s}
                    selected={selected && selected.pitchId === p.pitchId && dayjs(selected.start).isSame(dayjs(s.start))}
                    onClick={(slot) => onSelect?.(slot, p)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
      <div className="mb-slotpicker__legend">
        <span><i className="is-free" /> {t('venues:slotPicker.legend.free')}</span>
        <span><i className="is-deal" /> {t('venues:slotPicker.legend.deal')}</span>
        <span><i className="is-booked" /> {t('venues:slotPicker.legend.booked')}</span>
        <span><i className="is-blocked" /> {t('venues:slotPicker.legend.blocked')}</span>
      </div>
    </div>
  );
}
