import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, DatePicker, Grid, Segmented, Select, Skeleton, Space, Tooltip } from 'antd';
import { CalendarOutlined, LeftOutlined, LockOutlined, PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { BLOCK_KIND, DAYS_SHORT, contractDayIndex, formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, fullName } from '../utils/format';
import ManualBookingDrawer from './ManualBookingDrawer';
import ManualBookingModal from './ManualBookingModal';
import ReservationDrawer from './ReservationDrawer';
import {
  INACTIVE_TIP,
  WriteButton,
  asList,
  isMatchItem,
  minutesToHm,
  normalizeBlock,
  normalizeHours,
  notifyOwnerChanged,
  useReservationResponder,
  weekStart,
  ymd,
} from './shared';

const SLOT = 30; // dakika
const ROW_H = 26; // px / 30 dk
const ROW_H_PHONE = 32; // telefonda daha rahat dokunma alanı

/** Rezervasyon takvimi: tek saha için haftalık görünüm, tüm sahalar için günlük görünüm */
export default function OwnerCalendar() {
  const { message, modal } = App.useApp();
  const { venueId, venue, membershipActive } = useOwnerVenue();
  const [mode, setMode] = useState('week');
  const [anchor, setAnchor] = useState(() => dayjs().startOf('day'));
  const [pitchId, setPitchId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState(null); // ManualBookingModal draft: { mode, pitchId, start, maxEnd, booking }
  const [manual, setManual] = useState(null); // seçili harici rezervasyon
  const [now, setNow] = useState(() => dayjs());
  // Telefonda: daha yüksek satırlar, daha dar sütunlar; ızgara kart içinde yatay kayar (saat sütunu yapışkan)
  const isPhone = Grid.useBreakpoint().md === false;
  const rowH = isPhone ? ROW_H_PHONE : ROW_H;
  const scrollRef = useRef(null);

  const rangeStart = mode === 'week' ? weekStart(anchor) : anchor.startOf('day');
  const dayCount = mode === 'week' ? 7 : 1;
  const fromStr = ymd(rangeStart);

  const load = useCallback(
    async (silent) => {
      if (!venueId) return;
      if (!silent) setLoading(true);
      try {
        const start = dayjs(fromStr);
        // gece yarısını aşan saatler için bir gün fazlası istenir
        const res = await ownerApi.calendar(venueId, fromStr, ymd(start.add(dayCount + 1, 'day')));
        setData(res || {});
        setError(null);
      } catch (e) {
        setError(apiErrorMessage(e, 'Takvim yüklenemedi.'));
      } finally {
        setLoading(false);
      }
    },
    [venueId, fromStr, dayCount]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(t);
  }, []);

  const responder = useReservationResponder(() => {
    setSelected(null);
    load(true);
  });

  const pitches = useMemo(() => asList(data?.pitches), [data]);
  useEffect(() => {
    if (pitches.length && !pitches.some((p) => p.pitchId === pitchId)) setPitchId(pitches[0].pitchId);
  }, [pitches, pitchId]);

  const hours = useMemo(() => normalizeHours(asList(data?.openingHours, 'days')), [data]);

  // Izgaranın saat aralığı: haftanın en erken açılışı → en geç kapanışı (ertesi güne taşabilir)
  const [gridStart, gridEnd] = useMemo(() => {
    const open = hours.filter((h) => !h.isClosed);
    if (!open.length) return [8 * 60, 24 * 60];
    const s = Math.floor(Math.min(...open.map((h) => h.open)) / 60) * 60;
    const e = Math.ceil(Math.max(...open.map((h) => h.close)) / 60) * 60;
    return [s, Math.max(e, s + 60)];
  }, [hours]);
  const slots = useMemo(() => {
    const arr = [];
    for (let t = gridStart; t < gridEnd; t += SLOT) arr.push(t);
    return arr;
  }, [gridStart, gridEnd]);

  const columns = useMemo(() => {
    if (mode === 'week') {
      const p = pitches.find((x) => x.pitchId === pitchId);
      if (!p) return [];
      return Array.from({ length: 7 }, (_, i) => {
        const date = rangeStart.add(i, 'day');
        return { key: `${ymd(date)}-${p.pitchId}`, date, pitch: p, title: DAYS_SHORT[i], sub: date.format('DD MMM') };
      });
    }
    return pitches.map((p) => ({ key: `${fromStr}-${p.pitchId}`, date: rangeStart, pitch: p, title: p.name, sub: rangeStart.format('DD MMM ddd') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pitches, pitchId, fromStr]);

  const items = useMemo(() => {
    const names = new Map(pitches.map((p) => [p.pitchId, p.name]));
    return asList(data?.items)
      .filter((it) => !(isMatchItem(it) && it.status === 3))
      .map((it) => (isMatchItem(it) ? { ...it, isMatch: true } : normalizeBlock(it, names.get(it.pitchId))));
  }, [data, pitches]);

  /** Bir sütuna düşen öğeler (dakika ofsetleriyle) */
  const placed = useMemo(() => {
    const map = {};
    columns.forEach((c) => {
      map[c.key] = items
        .filter((it) => it.pitchId === c.pitch.pitchId)
        .map((it) => {
          const s = dayjs(it.start).diff(c.date, 'minute');
          const e = dayjs(it.end).diff(c.date, 'minute');
          return { it, s: Math.max(s, gridStart), e: Math.min(e, gridEnd), rawS: s };
        })
        .filter((x) => x.e > x.s && x.rawS < gridEnd && x.e > gridStart);
    });
    return map;
  }, [columns, items, gridStart, gridEnd]);

  const cellState = (col, t) => {
    const h = hours[contractDayIndex(col.date)];
    const open = h && !h.isClosed && t >= h.open && t < h.close;
    const past = !col.date.add(t + SLOT, 'minute').isAfter(now);
    return { open, past };
  };

  const shift = (dir) => setAnchor((a) => a.add(dir * (mode === 'week' ? 7 : 1), 'day'));

  const openMatch = async (it, pitch) => {
    const base = {
      matchId: it.matchId,
      matchName: it.title,
      start: it.start,
      end: it.end,
      status: it.status,
      creator: it.creator,
      goingCount: it.goingCount,
      capacity: it.capacity,
      totalPrice: it.totalPrice,
      pitch: { pitchId: pitch.pitchId, name: pitch.name },
    };
    setSelected(base);
    setDetailLoading(true);
    try {
      const day = dayjs(it.start).startOf('day');
      const list = asList(await ownerApi.reservations({ stadiumId: venueId, from: ymd(day), to: ymd(day.add(1, 'day')) }));
      const full = list.find((r) => r.matchId === it.matchId);
      if (full) setSelected((cur) => (cur?.matchId === it.matchId ? { ...base, ...full } : cur));
    } catch {
      /* özet bilgilerle devam */
    } finally {
      setDetailLoading(false);
    }
  };

  const openSlot = (col, t) => {
    if (!membershipActive) {
      message.info(INACTIVE_TIP);
      return;
    }
    const h = hours[contractDayIndex(col.date)];
    // aynı sütunda bu saatten sonraki ilk dolu öğe
    const nextBusy = (placed[col.key] || []).filter((x) => x.s >= t + SLOT).reduce((m, x) => Math.min(m, x.s), h.close);
    setDraft({
      mode: 'booking',
      pitchId: col.pitch.pitchId,
      start: col.date.add(t, 'minute'),
      maxEnd: col.date.add(Math.min(nextBusy, h.close), 'minute'),
    });
  };

  const openNew = () => {
    if (!membershipActive) {
      message.info(INACTIVE_TIP);
      return;
    }
    setDraft({ mode: 'booking', pitchId: mode === 'week' ? pitchId : pitches[0]?.pitchId, start: null, maxEnd: null });
  };

  const onDraftSaved = () => {
    setDraft(null);
    setManual(null);
    load(true);
  };

  const removeBlock = (it) => {
    if (!membershipActive) {
      message.info(INACTIVE_TIP);
      return;
    }
    modal.confirm({
      title: 'Kapatmayı kaldır',
      content: `${dayjs(it.start).format('DD MMM HH:mm')}–${dayjs(it.end).format('HH:mm')} aralığı (${it.reason || 'sebep belirtilmemiş'}) yeniden rezervasyona açılsın mı?`,
      okText: 'Saati aç',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await ownerApi.deleteBlock(it.slotBlockId);
          message.success('Saat yeniden rezervasyona açıldı.');
          notifyOwnerChanged();
          load(true);
        } catch (e) {
          message.error(apiErrorMessage(e, 'Kapatma kaldırılamadı.'));
        }
      },
    });
  };

  const title =
    mode === 'week'
      ? `${rangeStart.format('DD MMM')} – ${rangeStart.add(6, 'day').format('DD MMM YYYY')}`
      : rangeStart.format('DD MMMM YYYY, dddd');

  // Telefonda hafta görünümü açılınca bugünün sütununu görünür yap
  const hasGrid = Boolean(data) && pitches.length > 0;
  useEffect(() => {
    if (!isPhone || !hasGrid) return;
    const box = scrollRef.current;
    const today = box?.querySelector('.mb-owner-cal__head.is-today');
    const corner = box?.querySelector('.mb-owner-cal__corner');
    if (!box || !today) {
      if (box) box.scrollLeft = 0;
      return;
    }
    const offset = today.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollLeft = Math.max(0, offset - (corner?.offsetWidth || 0));
  }, [isPhone, hasGrid, mode, fromStr, pitchId]);

  const nowOffset = (col) => {
    const diff = now.diff(col.date, 'minute');
    return diff >= gridStart && diff < gridEnd ? diff : null;
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title="Rezervasyon Takvimi"
        icon={<CalendarOutlined />}
        subtitle="Maçlarınızı görün, talepleri yanıtlayın; boş bir saate tıklayarak telefonla gelen rezervasyonu ekleyin ya da saati kapatın."
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
              Yenile
            </Button>
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={!pitches.length}>
              Rezervasyon ekle
            </WriteButton>
          </Space>
        }
      />

      <Card bordered={false} className="mb-owner-cal-card">
        <div className="mb-owner-cal-toolbar">
          <Space wrap>
            <Space.Compact>
              <Button icon={<LeftOutlined />} onClick={() => shift(-1)} aria-label="Önceki" />
              <Button onClick={() => setAnchor(dayjs().startOf('day'))}>Bugün</Button>
              <Button icon={<RightOutlined />} onClick={() => shift(1)} aria-label="Sonraki" />
            </Space.Compact>
            <DatePicker
              value={anchor}
              allowClear={false}
              format="DD.MM.YYYY"
              onChange={(d) => d && setAnchor(d.startOf('day'))}
              style={{ width: 140 }}
            />
            <span className="mb-owner-cal-title mb-display">{title}</span>
          </Space>
          <Space wrap>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { label: 'Hafta', value: 'week' },
                { label: 'Gün · tüm sahalar', value: 'day' },
              ]}
            />
            {mode === 'week' && pitches.length > 1 && (
              <Select
                value={pitchId}
                onChange={setPitchId}
                style={{ minWidth: 150 }}
                options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))}
              />
            )}
          </Space>
        </div>

        <div className="mb-owner-cal-legend">
          <span className="is-approved">Onaylı</span>
          <span className="is-pending">Onay bekliyor</span>
          <span className="is-manual">Harici rezervasyon</span>
          <span className="is-block">Kapalı / blok</span>
          <span className="is-open">Açık · boş (tıklayıp rezervasyon ekleyin ya da kapatın)</span>
          <span className="is-unpaid">₺ Ödemesi alınmamış</span>
          <span className="is-closed">Çalışma saati dışı</span>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        {loading && !data ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : pitches.length === 0 ? (
          <EmptyState description="Takvimi kullanmak için önce bir saha ekleyin.">
            <Link to="/venue/pitches">
              <Button type="primary">Saha ekle</Button>
            </Link>
          </EmptyState>
        ) : (
          <div className="mb-owner-cal-scroll" ref={scrollRef}>
            <div
              className="mb-owner-cal"
              style={{
                gridTemplateColumns: isPhone
                  ? `46px repeat(${columns.length}, minmax(${mode === 'week' ? 92 : 128}px, 1fr))`
                  : `56px repeat(${columns.length}, minmax(${mode === 'week' ? 112 : 150}px, 1fr))`,
              }}
            >
              {/* başlık satırı */}
              <div className="mb-owner-cal__corner" />
              {columns.map((c) => {
                const isToday = c.date.isSame(now, 'day');
                const h = hours[contractDayIndex(c.date)];
                return (
                  <div
                    key={`h-${c.key}`}
                    className={`mb-owner-cal__head${isToday ? ' is-today' : ''}${mode === 'week' ? ' is-clickable' : ''}`}
                    onClick={mode === 'week' ? () => { setAnchor(c.date); setMode('day'); } : undefined}
                    title={mode === 'week' ? 'Bu günün tüm sahalarını gör' : undefined}
                  >
                    <strong>{c.title}</strong>
                    <span>
                      {c.sub}
                      {h?.isClosed ? ' · Kapalı' : ''}
                    </span>
                  </div>
                );
              })}

              {/* saat etiketleri */}
              <div className="mb-owner-cal__times" style={{ height: slots.length * rowH }}>
                {slots.map((t) =>
                  t % 60 === 0 ? (
                    <span key={t} style={{ top: ((t - gridStart) / SLOT) * rowH }}>
                      {minutesToHm(t)}
                    </span>
                  ) : null
                )}
              </div>

              {columns.map((c) => {
                const nowTop = nowOffset(c);
                return (
                  <div key={c.key} className="mb-owner-cal__col" style={{ height: slots.length * rowH }}>
                    {slots.map((t) => {
                      const st = cellState(c, t);
                      const cls = !st.open ? 'is-closed' : st.past ? 'is-past' : 'is-open';
                      return (
                        <div
                          key={t}
                          className={`mb-owner-cal__cell ${cls}${t % 60 === 0 ? ' is-hour' : ''}`}
                          style={{ height: rowH }}
                          onClick={st.open && !st.past ? () => openSlot(c, t) : undefined}
                          title={st.open && !st.past ? `${minutesToHm(t)} · rezervasyon eklemek ya da saati kapatmak için tıklayın` : undefined}
                        />
                      );
                    })}

                    {(placed[c.key] || []).map(({ it, s, e }) => {
                      const top = ((s - gridStart) / SLOT) * rowH;
                      const height = Math.max(((e - s) / SLOT) * rowH - 3, 18);
                      const time = `${dayjs(it.start).format('HH:mm')}–${dayjs(it.end).format('HH:mm')}`;
                      if (!it.isMatch && it.blockKind === BLOCK_KIND.MANUAL_BOOKING) {
                        return (
                          <Tooltip
                            key={`x-${it.slotBlockId}`}
                            title={`${time} · ${it.customerName || 'Harici'}${it.reason ? ` · ${it.reason}` : ''} · ${formatPrice(it.price)} · ${
                              it.isPaid ? 'ödendi' : 'ödeme alınmadı'
                            }`}
                          >
                            <button
                              type="button"
                              className={`mb-owner-cal__item is-manual${it.isPaid ? ' is-paid' : ' is-unpaid'}`}
                              style={{ top, height }}
                              onClick={() => setManual(it)}
                            >
                              <span className="mb-owner-cal__item-title">
                                <span className="mb-cal-pay" aria-label={it.isPaid ? 'Ödendi' : 'Ödenmedi'}>
                                  ₺
                                </span>
                                {it.customerName || 'Harici'}
                              </span>
                              {height > 30 && (
                                <span className="mb-owner-cal__item-meta">
                                  <span className="mb-cal-harici">Harici</span> {time}
                                </span>
                              )}
                              {height > 56 && (
                                <span className="mb-owner-cal__item-meta">
                                  {it.reason ? `${it.reason} · ` : ''}
                                  {formatPrice(it.price)}
                                </span>
                              )}
                            </button>
                          </Tooltip>
                        );
                      }
                      if (!it.isMatch) {
                        return (
                          <Tooltip key={`b-${it.slotBlockId}`} title={`${time} · ${it.reason || 'Kapalı'} — kaldırmak için tıklayın`}>
                            <button type="button" className="mb-owner-cal__item is-block" style={{ top, height }} onClick={() => removeBlock(it)}>
                              <span className="mb-owner-cal__item-title">
                                <LockOutlined /> {it.reason || 'Kapalı'}
                              </span>
                              {height > 30 && <span className="mb-owner-cal__item-meta">{time}</span>}
                            </button>
                          </Tooltip>
                        );
                      }
                      return (
                        <button
                          key={`m-${it.matchId}`}
                          type="button"
                          className={`mb-owner-cal__item ${it.status === 1 ? 'is-pending' : 'is-approved'}`}
                          style={{ top, height }}
                          onClick={() => openMatch(it, c.pitch)}
                        >
                          <span className="mb-owner-cal__item-title">{it.title || 'Maç'}</span>
                          {height > 30 && (
                            <span className="mb-owner-cal__item-meta">
                              {time} · {it.goingCount ?? 0}/{it.capacity ?? 0}
                            </span>
                          )}
                          {height > 56 && (
                            <span className="mb-owner-cal__item-meta">
                              {fullName(it.creator)}
                              {it.totalPrice != null ? ` · ${formatPrice(it.totalPrice)}` : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {nowTop != null && <div className="mb-owner-cal__now" style={{ top: ((nowTop - gridStart) / SLOT) * rowH }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <ReservationDrawer
        open={Boolean(selected)}
        reservation={selected}
        loading={detailLoading && !selected?.createdAt}
        onClose={() => setSelected(null)}
        responder={responder}
      />
      {responder.modal}

      <ManualBookingModal
        open={Boolean(draft)}
        draft={draft}
        pitches={pitches}
        hours={hours}
        onClose={() => setDraft(null)}
        onSaved={onDraftSaved}
      />
      <ManualBookingDrawer
        open={Boolean(manual)}
        booking={manual}
        onClose={() => setManual(null)}
        onEdit={(b) => {
          setManual(null);
          setDraft({ mode: 'booking', booking: b });
        }}
        onChanged={(b) => {
          if (b) setManual(b);
          load(true);
        }}
      />
    </>
  );
}
