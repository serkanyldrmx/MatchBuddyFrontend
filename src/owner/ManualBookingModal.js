import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Segmented, Select, Switch, TimePicker, Typography } from 'antd';
import { CalendarOutlined, LockOutlined } from '@ant-design/icons';
import { BLOCK_KIND, contractDayIndex, formatPrice, ownerApi } from '../api/venues';
import { apiErrorMessage } from '../utils/format';
import { WriteButton, isoLocal, notifyOwnerChanged } from './shared';

const { Text } = Typography;

const BOOKING_DURATIONS = [
  { value: 60, label: '1 saat' },
  { value: 90, label: '1,5 saat' },
  { value: 120, label: '2 saat' },
  { value: 'custom', label: 'Bitiş seç' },
];

const CLOSE_DURATIONS = [
  { value: 30, label: '30 dakika' },
  { value: 60, label: '1 saat' },
  { value: 90, label: '1,5 saat' },
  { value: 120, label: '2 saat' },
  { value: 180, label: '3 saat' },
  { value: 'close', label: 'Kapanışa kadar' },
];

const QUICK_TITLES = ['Şirket maçı', 'Okul kiralaması', 'Abonman', 'Turnuva'];

/** Tarih + saat alanlarından başlangıç anını üretir */
const combine = (date, time) => (date && time ? dayjs(date).startOf('day').add(time.hour(), 'hour').add(time.minute(), 'minute') : null);

/**
 * Harici rezervasyon ekle / saati kapat modalı.
 * draft: { mode: 'booking' | 'close', pitchId, start (dayjs|null), maxEnd (dayjs|null), booking (düzenlenen kayıt) }
 * hours: normalizeHours çıktısı (kapanışa kadar seçeneği için, opsiyonel)
 */
export default function ManualBookingModal({ open, draft, pitches = [], hours, onClose, onSaved }) {
  const editing = Boolean(draft?.booking);
  return (
    <Modal
      open={open}
      title={editing ? 'Harici rezervasyonu düzenle' : 'Takvime ekle'}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={560}
    >
      {open && draft && <BookingForm draft={draft} pitches={pitches} hours={hours} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function BookingForm({ draft, pitches, hours, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const booking = draft.booking;
  const editing = Boolean(booking);
  const [mode, setMode] = useState(editing ? 'booking' : draft.mode || 'booking');
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState({ loading: false, value: null, error: null });
  const priceTouched = useRef(editing);
  const quoteSeq = useRef(0);

  const initialValues = useMemo(() => {
    const start = booking ? dayjs(booking.start) : draft.start || null;
    let duration = 60;
    let endTime = null;
    if (booking) {
      const mins = dayjs(booking.end).diff(start, 'minute');
      if ([60, 90, 120].includes(mins)) duration = mins;
      else {
        duration = 'custom';
        endTime = dayjs(booking.end);
      }
    }
    return {
      pitchId: booking?.pitchId ?? draft.pitchId ?? pitches[0]?.pitchId,
      date: start,
      time: start,
      duration,
      endTime,
      closeDuration: 60,
      customerName: booking?.customerName || '',
      customerPhone: booking?.customerPhone || '',
      reason: booking?.reason || '',
      price: booking?.price ?? null,
      isPaid: Boolean(booking?.isPaid),
      note: booking?.note || '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pitchId = Form.useWatch('pitchId', form);
  const date = Form.useWatch('date', form);
  const time = Form.useWatch('time', form);
  const duration = Form.useWatch('duration', form);
  const endTime = Form.useWatch('endTime', form);
  const price = Form.useWatch('price', form);

  const start = combine(date, time);
  const bookingEnd = useMemo(() => {
    if (!start) return null;
    if (duration === 'custom') {
      if (!endTime) return null;
      let e = start.startOf('day').add(endTime.hour(), 'hour').add(endTime.minute(), 'minute');
      if (!e.isAfter(start)) e = e.add(1, 'day');
      return e;
    }
    return start.add(Number(duration) || 60, 'minute');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.valueOf(), duration, endTime?.valueOf()]);
  const durationMinutes = start && bookingEnd ? bookingEnd.diff(start, 'minute') : null;

  /** "Kapanışa kadar": takvimden gelen sınır ya da günün kapanış saati */
  const closeEnd = useMemo(() => {
    if (!start) return null;
    if (draft.maxEnd && draft.start && start.isSame(draft.start)) return draft.maxEnd;
    const h = hours?.[contractDayIndex(start)];
    if (!h || h.isClosed) return null;
    const e = start.startOf('day').add(h.close, 'minute');
    return e.isAfter(start) ? e : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.valueOf(), hours, draft]);

  // Tarifeye göre fiyat: saha / başlangıç / süre değiştikçe yeniden hesaplanır
  useEffect(() => {
    if (mode !== 'booking' || !pitchId || !start || !durationMinutes || durationMinutes <= 0) {
      setQuote({ loading: false, value: null, error: null });
      return undefined;
    }
    const id = ++quoteSeq.current;
    setQuote((q) => ({ ...q, loading: true, error: null }));
    const t = setTimeout(async () => {
      try {
        const res = await ownerApi.quote(pitchId, isoLocal(start), durationMinutes);
        if (id !== quoteSeq.current) return;
        const value = res?.pitchTotal ?? res?.total ?? null;
        setQuote({ loading: false, value, error: null });
        if (value != null && !priceTouched.current) form.setFieldsValue({ price: Number(value) });
      } catch (e) {
        if (id === quoteSeq.current) setQuote({ loading: false, value: null, error: apiErrorMessage(e, 'Tarife hesaplanamadı.') });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pitchId, start?.valueOf(), durationMinutes]);

  const submit = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const s = combine(v.date, v.time);
    let payload;
    if (mode === 'booking') {
      if (!bookingEnd || durationMinutes <= 0) {
        message.warning('Lütfen geçerli bir bitiş saati seçin.');
        return;
      }
      payload = {
        slotBlockId: booking?.slotBlockId,
        pitchId: v.pitchId,
        startAt: isoLocal(s),
        endAt: isoLocal(bookingEnd),
        kind: BLOCK_KIND.MANUAL_BOOKING,
        reason: v.reason?.trim() || undefined,
        customerName: v.customerName.trim(),
        customerPhone: v.customerPhone?.trim() || undefined,
        price: Number(v.price) || 0,
        isPaid: Boolean(v.isPaid),
        note: v.note?.trim() || undefined,
      };
    } else {
      const end = v.closeDuration === 'close' ? closeEnd : s.add(v.closeDuration, 'minute');
      if (!end) {
        message.warning('Kapanış saati bulunamadı; lütfen bir süre seçin.');
        return;
      }
      payload = { pitchId: v.pitchId, startAt: isoLocal(s), endAt: isoLocal(end), kind: BLOCK_KIND.CLOSED, reason: v.reason.trim() };
    }
    setSaving(true);
    try {
      const res = await ownerApi.saveBlock(payload);
      message.success(
        mode === 'close'
          ? 'Saat rezervasyona kapatıldı.'
          : editing
            ? 'Harici rezervasyon güncellendi.'
            : 'Harici rezervasyon takvime eklendi.'
      );
      notifyOwnerChanged();
      onSaved?.(res, payload);
    } catch (e) {
      message.error(apiErrorMessage(e, mode === 'close' ? 'Saat kapatılamadı.' : 'Rezervasyon kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const showQuoteHint = mode === 'booking' && (quote.loading || quote.value != null || quote.error);

  return (
    <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues} className="mb-mbk-form">
      {!editing && (
        <Segmented
          block
          value={mode}
          onChange={setMode}
          style={{ marginBottom: 16 }}
          options={[
            { value: 'booking', label: 'Rezervasyon ekle', icon: <CalendarOutlined /> },
            { value: 'close', label: 'Saati kapat', icon: <LockOutlined /> },
          ]}
        />
      )}

      <Row gutter={12}>
        <Col xs={24} sm={10}>
          <Form.Item name="pitchId" label="Saha" rules={[{ required: true, message: 'Saha seçin.' }]}>
            <Select options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))} placeholder="Saha" />
          </Form.Item>
        </Col>
        <Col xs={14} sm={8}>
          <Form.Item name="date" label="Tarih" rules={[{ required: true, message: 'Tarih seçin.' }]}>
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="Tarih" />
          </Form.Item>
        </Col>
        <Col xs={10} sm={6}>
          <Form.Item name="time" label="Başlangıç" rules={[{ required: true, message: 'Saat seçin.' }]}>
            <TimePicker format="HH:mm" minuteStep={15} needConfirm={false} style={{ width: '100%' }} placeholder="Saat" />
          </Form.Item>
        </Col>
      </Row>

      {mode === 'booking' ? (
        <>
          <Form.Item label="Süre" style={{ marginBottom: duration === 'custom' ? 8 : 16 }}>
            <Form.Item name="duration" noStyle>
              <Segmented options={BOOKING_DURATIONS} />
            </Form.Item>
            {start && bookingEnd && (
              <Text type="secondary" style={{ marginLeft: 10, fontSize: 12 }}>
                {start.format('HH:mm')}–{bookingEnd.format('HH:mm')} · {durationMinutes} dk
              </Text>
            )}
          </Form.Item>
          {duration === 'custom' && (
            <Form.Item name="endTime" label="Bitiş saati" rules={[{ required: true, message: 'Bitiş saati seçin.' }]}>
              <TimePicker format="HH:mm" minuteStep={15} needConfirm={false} style={{ width: 140 }} placeholder="Bitiş" />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col xs={24} sm={13}>
              <Form.Item
                name="customerName"
                label="Müşteri adı"
                rules={[{ required: true, whitespace: true, message: 'Lütfen müşterinin adını yazın.' }]}
              >
                <Input maxLength={80} placeholder="Örn. Ahmet Yılmaz" autoFocus={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={11}>
              <Form.Item name="customerPhone" label="Telefon">
                <Input maxLength={30} placeholder="05xx xxx xx xx" inputMode="tel" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reason" label="Başlık / etiket (isteğe bağlı)" style={{ marginBottom: 6 }}>
            <Input maxLength={100} placeholder="Örn. Şirket maçı" />
          </Form.Item>
          <div className="mb-mbk-chips">
            {QUICK_TITLES.map((q) => (
              <span key={q} role="button" tabIndex={0} className="mb-mbk-chip" onClick={() => form.setFieldsValue({ reason: q })}>
                {q}
              </span>
            ))}
          </div>

          <Row gutter={12} align="bottom">
            <Col xs={24} sm={13}>
              <Form.Item
                name="price"
                label="Ücret"
                rules={[{ required: true, message: 'Ücret girin.' }]}
                extra={
                  showQuoteHint ? (
                    <span className="mb-mbk-quote">
                      {quote.loading ? (
                        'Tarife hesaplanıyor…'
                      ) : quote.error ? (
                        quote.error
                      ) : (
                        <>
                          Tarifeye göre: <strong>{formatPrice(quote.value)}</strong>
                          {priceTouched.current && Number(price) !== Number(quote.value) && (
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                priceTouched.current = false;
                                form.setFieldsValue({ price: Number(quote.value) });
                              }}
                            >
                              Uygula
                            </Button>
                          )}
                        </>
                      )}
                    </span>
                  ) : null
                }
              >
                <InputNumber
                  min={0}
                  max={1000000}
                  step={50}
                  style={{ width: '100%' }}
                  addonAfter="₺"
                  decimalSeparator=","
                  onChange={() => {
                    priceTouched.current = true;
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={11}>
              <Form.Item name="isPaid" label="Ödeme alındı" valuePropName="checked">
                <Switch checkedChildren="Alındı" unCheckedChildren="Alınmadı" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Not">
            <Input.TextArea maxLength={200} rows={2} showCount placeholder="Örn. Kapora alındı, yelek istendi" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Harici rezervasyonlar oyunculara “dolu” olarak görünür. Ödemesi alınan ve oynanan rezervasyonlar gelirinize otomatik
            eklenir.
          </Text>
        </>
      ) : (
        <>
          <Form.Item name="reason" label="Sebep" rules={[{ required: true, whitespace: true, message: 'Lütfen kısa bir sebep yazın.' }]}>
            <Input maxLength={100} placeholder="Örn. Bakım, özel etkinlik" autoFocus />
          </Form.Item>
          <Form.Item name="closeDuration" label="Süre">
            <Select
              options={CLOSE_DURATIONS.filter((d) => d.value !== 'close' || closeEnd).map((d) => ({
                ...d,
                label: d.value === 'close' ? `${d.label} (${closeEnd.format('HH:mm')})` : d.label,
              }))}
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Oyuncular bu aralığı dolu olarak görür. Kapatılan aralık mevcut bir maçla çakışırsa işlem kabul edilmez.
          </Text>
        </>
      )}

      <div className="mb-mbk-footer">
        <Button onClick={onClose}>Vazgeç</Button>
        <WriteButton type="primary" loading={saving} onClick={submit} icon={mode === 'close' ? <LockOutlined /> : undefined}>
          {mode === 'close' ? 'Saati kapat' : editing ? 'Değişiklikleri kaydet' : 'Rezervasyonu ekle'}
        </WriteButton>
      </div>
    </Form>
  );
}
