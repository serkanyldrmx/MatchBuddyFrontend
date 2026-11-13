import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, DatePicker, Grid, Segmented, Select, Skeleton, Space, Tooltip } from 'antd';
import { CalendarOutlined, LeftOutlined, LockOutlined, PlusOutlined, ReloadOutlined, RightOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { BLOCK_KIND, DAYS_SHORT, contractDayIndex, formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, fullName } from '../utils/format';
import ManualBookingDrawer from './ManualBookingDrawer';
import ManualBookingModal from './ManualBookingModal';
import ReservationDrawer from './ReservationDrawer';
import {
  WriteButton,
  asList,
  inactiveTip,
  isMatchItem,
  minutesToHm,
  normalizeBlock,
  normalizeHours,
  notifyOwnerChanged,
  useReservationResponder,
  weekStart,
  ymd,
} from './shared';
import { SwipeTabs } from '../ui/Swipe';

const SLOT = 30; // dakika
const ROW_H = 26; // px / 30 dk
const ROW_H_PHONE = 32; // telefonda daha rahat dokunma alanı

/** Rezervasyon takvimi: tek saha için haftalık görünüm, tüm sahalar için günlük görünüm */
export default function OwnerCalendar() {
  const { message, modal } = App.useApp();
  const { t } = useTranslation();
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
        setError(apiErrorMessage(e, t('owner:calendar.loadFailed')));
      } finally {
        setLoading(false);
      }
    },
    [venueId, fromStr, dayCount, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
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
      message.info(inactiveTip());
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

  const openNew = (draftMode = 'booking') => {
    if (!membershipActive) {
      message.info(inactiveTip());
      return;
    }
    setDraft({ mode: draftMode, pitchId: mode === 'week' ? pitchId : pitches[0]?.pitchId, start: null, maxEnd: null });
  };

  const onDraftSaved = () => {
    setDraft(null);
    setManual(null);
    load(true);
  };

  const removeBlock = (it) => {
    if (!membershipActive) {
      message.info(inactiveTip());
      return;
    }
    modal.confirm({
      title: t('owner:calendar.removeBlock.title'),
      content: t('owner:calendar.removeBlock.content', {
        range: `${dayjs(it.start).format('DD MMM HH:mm')}–${dayjs(it.end).format('HH:mm')}`,
        reason: it.reason || t('owner:calendar.removeBlock.noReason'),
      }),
      okText: t('owner:calendar.removeBlock.ok'),
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await ownerApi.deleteBlock(it.slotBlockId);
          message.success(t('owner:calendar.removeBlock.success'));
          notifyOwnerChanged();
          load(true);
        } catch (e) {
          message.error(apiErrorMessage(e, t('owner:calendar.removeBlock.failed')));
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
    // Telefonda takvimi sağa / sola kaydırmak önceki / sonraki haftaya (güne) geçer
    <SwipeTabs onSwipe={shift}>
      <PageHeader
        eyebrow={venue?.name}
        title={t('owner:calendar.title')}
        icon={<CalendarOutlined />}
        subtitle={t('owner:calendar.subtitle')}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
              {t('common:actions.refresh')}
            </Button>
            <WriteButton icon={<ThunderboltOutlined />} onClick={() => openNew('deal')} disabled={!pitches.length}>
              {t('owner:deal.button')}
            </WriteButton>
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openNew()} disabled={!pitches.length}>
              {t('owner:calendar.addBooking')}
            </WriteButton>
          </Space>
        }
      />

      <Card bordered={false} className="mb-owner-cal-card">
        <div className="mb-owner-cal-toolbar">
          <Space wrap>
            <Space.Compact>
              <Button icon={<LeftOutlined />} onClick={() => shift(-1)} aria-label={t('owner:calendar.prev')} />
              <Button onClick={() => setAnchor(dayjs().startOf('day'))}>{t('owner:calendar.today')}</Button>
              <Button icon={<RightOutlined />} onClick={() => shift(1)} aria-label={t('owner:calendar.next')} />
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
                { label: t('owner:calendar.modes.week'), value: 'week' },
                { label: t('owner:calendar.modes.day'), value: 'day' },
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
          <span className="is-approved">{t('owner:calendar.legend.approved')}</span>
          <span className="is-pending">{t('owner:calendar.legend.pending')}</span>
          <span className="is-manual">{t('owner:calendar.legend.manual')}</span>
          <span className="is-block">{t('owner:calendar.legend.block')}</span>
          <span className="is-open">{t('owner:calendar.legend.open')}</span>
          <span className="is-unpaid">{t('owner:calendar.legend.unpaid')}</span>
          <span className="is-closed">{t('owner:calendar.legend.closed')}</span>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        {loading && !data ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : pitches.length === 0 ? (
          <EmptyState description={t('owner:calendar.noPitches')}>
            <Link to="/venue/pitches">
              <Button type="primary">{t('owner:calendar.addPitch')}</Button>
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
                    title={mode === 'week' ? t('owner:calendar.seeDay') : undefined}
                  >
                    <strong>{c.title}</strong>
                    <span>
                      {c.sub}
                      {h?.isClosed ? ` · ${t('owner:calendar.closed')}` : ''}
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
                    {slots.map((m) => {
                      const st = cellState(c, m);
                      const cls = !st.open ? 'is-closed' : st.past ? 'is-past' : 'is-open';
                      return (
                        <div
                          key={m}
                          className={`mb-owner-cal__cell ${cls}${m % 60 === 0 ? ' is-hour' : ''}`}
                          style={{ height: rowH }}
                          onClick={st.open && !st.past ? () => openSlot(c, m) : undefined}
                          title={st.open && !st.past ? t('owner:calendar.cellHint', { time: minutesToHm(m) }) : undefined}
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
                            title={`${time} · ${it.customerName || t('owner:calendar.external')}${it.reason ? ` · ${it.reason}` : ''} · ${formatPrice(
                              it.price
                            )} · ${it.isPaid ? t('owner:calendar.paid') : t('owner:calendar.unpaid')}`}
                          >
                            <button
                              type="button"
                              className={`mb-owner-cal__item is-manual${it.isPaid ? ' is-paid' : ' is-unpaid'}`}
                              style={{ top, height }}
                              onClick={() => setManual(it)}
                            >
                              <span className="mb-owner-cal__item-title">
                                <span
                                  className="mb-cal-pay"
                                  aria-label={it.isPaid ? t('owner:calendar.paidAria') : t('owner:calendar.unpaidAria')}
                                >
                                  ₺
                                </span>
                                {it.customerName || t('owner:calendar.external')}
                              </span>
                              {height > 30 && (
                                <span className="mb-owner-cal__item-meta">
                                  <span className="mb-cal-harici">{t('owner:calendar.external')}</span> {time}
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
                          <Tooltip
                            key={`b-${it.slotBlockId}`}
                            title={t('owner:calendar.blockHint', { time, reason: it.reason || t('owner:calendar.closed') })}
                          >
                            <button type="button" className="mb-owner-cal__item is-block" style={{ top, height }} onClick={() => removeBlock(it)}>
                              <span className="mb-owner-cal__item-title">
                                <LockOutlined /> {it.reason || t('owner:calendar.closed')}
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
                          <span className="mb-owner-cal__item-title">{it.title || t('owner:calendar.match')}</span>
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
        stadiumId={venueId}
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
    </SwipeTabs>
  );
}
