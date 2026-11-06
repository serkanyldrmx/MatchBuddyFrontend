import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, Skeleton, Tooltip } from 'antd';
import { CalendarOutlined, LeftOutlined, LockOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { EmptyState } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import './Venues.css';

/** Önümüzdeki N günün yatay şeridi + istenirse takvimden seçim */
export function DateStrip({ value, onChange, days = 14, withPicker = true }) {
  const today = dayjs().startOf('day');
  const list = Array.from({ length: days }, (_, i) => today.add(i, 'day'));
  const stripRef = useRef(null);
  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  const outside = value && !list.some((d) => d.isSame(value, 'day'));

  return (
    <div className="mb-datestrip">
      <Button type="text" size="small" className="mb-datestrip__nav" icon={<LeftOutlined />} onClick={() => scroll(-1)} aria-label="Önceki günler" />
      <div className="mb-datestrip__list" ref={stripRef}>
        {list.map((d, i) => {
          const active = value && d.isSame(value, 'day');
          return (
            <button key={d.format('YYYY-MM-DD')} type="button" className={`mb-datestrip__day ${active ? 'is-active' : ''}`} onClick={() => onChange(d)}>
              <span className="mb-datestrip__dow">{i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : d.format('ddd')}</span>
              <strong>{d.format('DD')}</strong>
              <span className="mb-datestrip__month">{d.format('MMM')}</span>
            </button>
          );
        })}
      </div>
      <Button type="text" size="small" className="mb-datestrip__nav" icon={<RightOutlined />} onClick={() => scroll(1)} aria-label="Sonraki günler" />
      {withPicker && (
        <DatePicker
          className={`mb-datestrip__picker ${outside ? 'is-active' : ''}`}
          value={outside ? value : null}
          allowClear={false}
          format="DD MMM"
          placeholder="Başka gün"
          suffixIcon={<CalendarOutlined />}
          disabledDate={(d) => d.isBefore(today, 'day')}
          onChange={(d) => d && onChange(d.startOf('day'))}
        />
      )}
    </div>
  );
}

const STATUS_LABEL = { booked: 'Dolu', pending: 'Dolu', blocked: 'Kapalı', past: 'Geçti' };

/** Tek bir saat hapı */
export function SlotPill({ slot, selected, onClick }) {
  const time = dayjs(slot.start).format('HH:mm');
  if (slot.status !== 'free') {
    return (
      <span className={`mb-slot is-${slot.status}`}>
        <strong>{time}</strong>
        <small>
          {slot.status === 'blocked' && <LockOutlined />} {STATUS_LABEL[slot.status] || 'Dolu'}
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
      {slot.campaignTitle && <em className="mb-slot__deal">Kampanya</em>}
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
      .catch((e) => alive && setError(apiErrorMessage(e, 'Saatler yüklenemedi.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, dateKey]);

  if (!stadiumId) return <EmptyState description="Önce bir tesis seç" />;
  if (loading && !data) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) return <EmptyState description={error} />;
  if (!data) return null;
  if (data.isClosed) return <EmptyState description="Tesis bu gün kapalı. Başka bir gün seç." />;

  const rows = (data.pitches || []).filter((p) => !onlyPitchId || p.pitchId === onlyPitchId);
  if (!rows.length) return <EmptyState description="Bu gün için uygun saha yok" />;

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
                  {SURFACE[info.surface] || 'Saha'} · {info.isIndoor ? 'Kapalı' : 'Açık'} · {info.playersPerSide}+{info.playersPerSide}
                </span>
              )}
              <span className={free ? 'is-free' : ''}>{free ? `${free} boş saat` : 'Boş saat yok'}</span>
            </div>
            <div className="mb-slotpicker__slots">
              {(p.slots || []).length === 0 ? (
                <span className="mb-hint">Bu gün saat yok</span>
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
        <span><i className="is-free" /> Boş</span>
        <span><i className="is-deal" /> Kampanyalı</span>
        <span><i className="is-booked" /> Dolu</span>
        <span><i className="is-blocked" /> Kapalı</span>
      </div>
    </div>
  );
}
