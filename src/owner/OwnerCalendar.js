import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, DatePicker, Form, Input, Modal, Segmented, Select, Skeleton, Space, Tooltip, Typography } from 'antd';
import { CalendarOutlined, LeftOutlined, LockOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { DAYS_SHORT, contractDayIndex, formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, fullName } from '../utils/format';
import ReservationDrawer from './ReservationDrawer';
import {
  INACTIVE_TIP,
  asList,
  isoLocal,
  minutesToHm,
  normalizeHours,
  notifyOwnerChanged,
  useReservationResponder,
  weekStart,
  ymd,
} from './shared';

const { Text } = Typography;
const SLOT = 30; // dakika
const ROW_H = 26; // px / 30 dk

const DURATIONS = [
  { value: 30, label: '30 dakika' },
  { value: 60, label: '1 saat' },
  { value: 90, label: '1,5 saat' },
  { value: 120, label: '2 saat' },
  { value: 180, label: '3 saat' },
  { value: 'close', label: 'Kapanışa kadar' },
];

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
  const [blockDraft, setBlockDraft] = useState(null); // { pitchId, pitchName, start, maxEnd }
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => dayjs());
  const [form] = Form.useForm();

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

  useEffect(() => {
    if (blockDraft) form.resetFields();
  }, [blockDraft, form]);

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

  const items = useMemo(() => asList(data?.items).filter((it) => !(it.kind === 'match' && it.status === 3)), [data]);

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

  const openBlockModal = (col, t) => {
    if (!membershipActive) {
      message.info(INACTIVE_TIP);
      return;
    }
    const h = hours[contractDayIndex(col.date)];
    // aynı sütunda bu saatten sonraki ilk dolu öğe
    const nextBusy = (placed[col.key] || []).filter((x) => x.s >= t + SLOT).reduce((m, x) => Math.min(m, x.s), h.close);
    setBlockDraft({ pitchId: col.pitch.pitchId, pitchName: col.pitch.name, start: col.date.add(t, 'minute'), maxEnd: col.date.add(Math.min(nextBusy, h.close), 'minute') });
  };

  const saveBlock = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const end = v.duration === 'close' ? blockDraft.maxEnd : blockDraft.start.add(v.duration, 'minute');
    setSaving(true);
    try {
      await ownerApi.saveBlock({ pitchId: blockDraft.pitchId, startAt: isoLocal(blockDraft.start), endAt: isoLocal(end), reason: v.reason.trim() });
      message.success('Saat rezervasyona kapatıldı.');
      setBlockDraft(null);
      notifyOwnerChanged();
      load(true);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Saat kapatılamadı.'));
    } finally {
      setSaving(false);
    }
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
        subtitle="Maçlarınızı görün, talepleri yanıtlayın, boş saatleri tek tıkla kapatın."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            Yenile
          </Button>
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
          <span className="is-block">Kapalı / blok</span>
          <span className="is-open">Açık · boş (tıklayıp kapatabilirsiniz)</span>
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
          <div className="mb-owner-cal-scroll">
            <div
              className="mb-owner-cal"
              style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(${mode === 'week' ? 112 : 150}px, 1fr))` }}
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
              <div className="mb-owner-cal__times" style={{ height: slots.length * ROW_H }}>
                {slots.map((t) =>
                  t % 60 === 0 ? (
                    <span key={t} style={{ top: ((t - gridStart) / SLOT) * ROW_H }}>
                      {minutesToHm(t)}
                    </span>
                  ) : null
                )}
              </div>

              {columns.map((c) => {
                const nowTop = nowOffset(c);
                return (
                  <div key={c.key} className="mb-owner-cal__col" style={{ height: slots.length * ROW_H }}>
                    {slots.map((t) => {
                      const st = cellState(c, t);
                      const cls = !st.open ? 'is-closed' : st.past ? 'is-past' : 'is-open';
                      return (
                        <div
                          key={t}
                          className={`mb-owner-cal__cell ${cls}${t % 60 === 0 ? ' is-hour' : ''}`}
                          style={{ height: ROW_H }}
                          onClick={st.open && !st.past ? () => openBlockModal(c, t) : undefined}
                          title={st.open && !st.past ? `${minutesToHm(t)} · saati kapatmak için tıklayın` : undefined}
                        />
                      );
                    })}

                    {(placed[c.key] || []).map(({ it, s, e }) => {
                      const top = ((s - gridStart) / SLOT) * ROW_H;
                      const height = Math.max(((e - s) / SLOT) * ROW_H - 3, 18);
                      const time = `${dayjs(it.start).format('HH:mm')}–${dayjs(it.end).format('HH:mm')}`;
                      if (it.kind === 'block') {
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

                    {nowTop != null && <div className="mb-owner-cal__now" style={{ top: ((nowTop - gridStart) / SLOT) * ROW_H }} />}
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

      <Modal
        open={Boolean(blockDraft)}
        title="Saati kapat"
        okText="Saati kapat"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={saveBlock}
        onCancel={() => setBlockDraft(null)}
        destroyOnClose
      >
        {blockDraft && (
          <Form form={form} layout="vertical" requiredMark={false} initialValues={{ reason: '', duration: 60 }}>
            <div className="mb-owner-note" style={{ marginTop: 0 }}>
              <strong>{blockDraft.pitchName}</strong> · {blockDraft.start.format('DD MMMM dddd, HH:mm')} itibarıyla bu saha rezervasyona
              kapatılacak. Oyuncular bu aralığı dolu olarak görür.
            </div>
            <Form.Item name="reason" label="Sebep" rules={[{ required: true, whitespace: true, message: 'Lütfen kısa bir sebep yazın.' }]}>
              <Input maxLength={100} placeholder="Örn. Bakım, özel etkinlik, okul kiralaması" />
            </Form.Item>
            <Form.Item name="duration" label="Süre">
              <Select
                options={DURATIONS.map((d) => ({
                  ...d,
                  label: d.value === 'close' ? `${d.label} (${blockDraft.maxEnd.format('HH:mm')})` : d.label,
                }))}
              />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Kapatılan aralık mevcut bir maçla çakışırsa işlem kabul edilmez.
            </Text>
          </Form>
        )}
      </Modal>
    </>
  );
}
