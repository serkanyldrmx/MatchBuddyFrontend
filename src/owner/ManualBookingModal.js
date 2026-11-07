import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Segmented, Select, Switch, TimePicker, Typography } from 'antd';
import { CalendarOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { BLOCK_KIND, contractDayIndex, formatPrice, ownerApi } from '../api/venues';
import { apiErrorMessage, formErrorMessage } from '../utils/format';
import { usePublicParam } from '../api/parameters';
import { WriteButton, isoLocal, notifyOwnerChanged } from './shared';

const { Text } = Typography;

// Etiketler owner:booking.durations.<anahtar> altındadır
const BOOKING_DURATIONS = [
  { value: 60, key: 'h1' },
  { value: 90, key: 'h1_5' },
  { value: 120, key: 'h2' },
  { value: 'custom', key: 'custom' },
];

const CLOSE_DURATIONS = [
  { value: 30, key: 'm30' },
  { value: 60, key: 'h1' },
  { value: 90, key: 'h1_5' },
  { value: 120, key: 'h2' },
  { value: 180, key: 'h3' },
  { value: 'close', key: 'untilClose' },
];

const QUICK_TITLE_KEYS = ['corporate', 'school', 'subscription', 'tournament'];

/** Tarih + saat alanlarından başlangıç anını üretir */
const combine = (date, time) => (date && time ? dayjs(date).startOf('day').add(time.hour(), 'hour').add(time.minute(), 'minute') : null);

/**
 * Harici rezervasyon ekle / saati kapat modalı.
 * draft: { mode: 'booking' | 'close', pitchId, start (dayjs|null), maxEnd (dayjs|null), booking (düzenlenen kayıt) }
 * hours: normalizeHours çıktısı (kapanışa kadar seçeneği için, opsiyonel)
 */
export default function ManualBookingModal({ open, draft, pitches = [], hours, onClose, onSaved }) {
  const { t } = useTranslation();
  const editing = Boolean(draft?.booking);
  return (
    <Modal
      open={open}
      title={editing ? t('owner:booking.modal.editTitle') : t('owner:booking.modal.addTitle')}
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
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const maxPrice = usePublicParam('venue.maxPrice');
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
    const timer = setTimeout(async () => {
      try {
        const res = await ownerApi.quote(pitchId, isoLocal(start), durationMinutes);
        if (id !== quoteSeq.current) return;
        const value = res?.pitchTotal ?? res?.total ?? null;
        setQuote({ loading: false, value, error: null });
        if (value != null && !priceTouched.current) form.setFieldsValue({ price: Number(value) });
      } catch (e) {
        if (id === quoteSeq.current) setQuote({ loading: false, value: null, error: apiErrorMessage(e, t('owner:booking.modal.quoteFailed')) });
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pitchId, start?.valueOf(), durationMinutes]);

  const submit = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const s = combine(v.date, v.time);
    let payload;
    if (mode === 'booking') {
      if (!bookingEnd || durationMinutes <= 0) {
        message.warning(t('owner:booking.modal.invalidEnd'));
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
        message.warning(t('owner:booking.modal.noCloseTime'));
        return;
      }
      payload = { pitchId: v.pitchId, startAt: isoLocal(s), endAt: isoLocal(end), kind: BLOCK_KIND.CLOSED, reason: v.reason.trim() };
    }
    setSaving(true);
    try {
      const res = await ownerApi.saveBlock(payload);
      message.success(
        mode === 'close'
          ? t('owner:booking.modal.closedSuccess')
          : editing
            ? t('owner:booking.modal.updatedSuccess')
            : t('owner:booking.modal.addedSuccess')
      );
      notifyOwnerChanged();
      onSaved?.(res, payload);
    } catch (e) {
      message.error(
        formErrorMessage(form, e, mode === 'close' ? t('owner:booking.modal.closeFailed') : t('owner:booking.modal.saveFailed'), {
          aliases: { startAt: 'time', endAt: mode === 'booking' ? 'endTime' : 'closeDuration' },
        })
      );
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
            { value: 'booking', label: t('owner:booking.modal.modeBooking'), icon: <CalendarOutlined /> },
            { value: 'close', label: t('owner:booking.modal.modeClose'), icon: <LockOutlined /> },
          ]}
        />
      )}

      <Row gutter={12}>
        <Col xs={24} sm={10}>
          <Form.Item name="pitchId" label={t('common:pitch')} rules={[{ required: true, message: t('owner:booking.modal.selectPitch') }]}>
            <Select options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))} placeholder={t('common:pitch')} />
          </Form.Item>
        </Col>
        <Col xs={14} sm={8}>
          <Form.Item
            name="date"
            label={t('owner:booking.modal.date')}
            rules={[{ required: true, message: t('owner:booking.modal.selectDate') }]}
          >
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder={t('owner:booking.modal.date')} />
          </Form.Item>
        </Col>
        <Col xs={10} sm={6}>
          <Form.Item
            name="time"
            label={t('owner:booking.modal.start')}
            rules={[{ required: true, message: t('owner:booking.modal.selectTime') }]}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={15}
              needConfirm={false}
              style={{ width: '100%' }}
              placeholder={t('owner:booking.modal.time')}
            />
          </Form.Item>
        </Col>
      </Row>

      {mode === 'booking' ? (
        <>
          <Form.Item label={t('owner:booking.modal.duration')} style={{ marginBottom: duration === 'custom' ? 8 : 16 }}>
            <Form.Item name="duration" noStyle>
              <Segmented options={BOOKING_DURATIONS.map((d) => ({ value: d.value, label: t(`owner:booking.durations.${d.key}`) }))} />
            </Form.Item>
            {start && bookingEnd && (
              <Text type="secondary" style={{ marginLeft: 10, fontSize: 12 }}>
                {start.format('HH:mm')}–{bookingEnd.format('HH:mm')} · {t('owner:booking.minutes', { count: durationMinutes })}
              </Text>
            )}
          </Form.Item>
          {duration === 'custom' && (
            <Form.Item
              name="endTime"
              label={t('owner:booking.modal.endTime')}
              rules={[{ required: true, message: t('owner:booking.modal.selectEndTime') }]}
            >
              <TimePicker
                format="HH:mm"
                minuteStep={15}
                needConfirm={false}
                style={{ width: 140 }}
                placeholder={t('owner:booking.modal.end')}
              />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col xs={24} sm={13}>
              <Form.Item
                name="customerName"
                label={t('owner:booking.modal.customerName')}
                rules={[{ required: true, whitespace: true, message: t('owner:booking.modal.customerNameRequired') }]}
              >
                <Input maxLength={80} placeholder={t('owner:booking.modal.customerNamePlaceholder')} autoFocus={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={11}>
              <Form.Item name="customerPhone" label={t('owner:reservations.table.phone')}>
                <Input maxLength={30} placeholder={t('owner:booking.modal.phonePlaceholder')} inputMode="tel" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reason" label={t('owner:booking.modal.titleLabel')} style={{ marginBottom: 6 }}>
            <Input maxLength={100} placeholder={t('owner:booking.modal.titlePlaceholder')} />
          </Form.Item>
          <div className="mb-mbk-chips">
            {QUICK_TITLE_KEYS.map((k) => {
              const q = t(`owner:booking.quickTitles.${k}`);
              return (
                <span key={k} role="button" tabIndex={0} className="mb-mbk-chip" onClick={() => form.setFieldsValue({ reason: q })}>
                  {q}
                </span>
              );
            })}
          </div>

          <Row gutter={12} align="bottom">
            <Col xs={24} sm={13}>
              <Form.Item
                name="price"
                label={t('owner:booking.fee')}
                rules={[{ required: true, message: t('owner:booking.modal.feeRequired') }]}
                extra={
                  showQuoteHint ? (
                    <span className="mb-mbk-quote">
                      {quote.loading ? (
                        t('owner:booking.modal.quoteLoading')
                      ) : quote.error ? (
                        quote.error
                      ) : (
                        <>
                          {t('owner:booking.modal.quoteLabel')} <strong>{formatPrice(quote.value)}</strong>
                          {priceTouched.current && Number(price) !== Number(quote.value) && (
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                priceTouched.current = false;
                                form.setFieldsValue({ price: Number(quote.value) });
                              }}
                            >
                              {t('owner:booking.modal.apply')}
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
                  max={maxPrice}
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
              <Form.Item name="isPaid" label={t('owner:booking.paymentReceived')} valuePropName="checked">
                <Switch checkedChildren={t('owner:reservations.paid')} unCheckedChildren={t('owner:reservations.unpaid')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label={t('owner:booking.drawer.note')}>
            <Input.TextArea maxLength={200} rows={2} showCount placeholder={t('owner:booking.modal.notePlaceholder')} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('owner:booking.modal.bookingInfo')}
          </Text>
        </>
      ) : (
        <>
          <Form.Item
            name="reason"
            label={t('owner:booking.modal.reason')}
            rules={[{ required: true, whitespace: true, message: t('owner:booking.modal.reasonRequired') }]}
          >
            <Input maxLength={100} placeholder={t('owner:booking.modal.reasonPlaceholder')} autoFocus />
          </Form.Item>
          <Form.Item name="closeDuration" label={t('owner:booking.modal.duration')}>
            <Select
              options={CLOSE_DURATIONS.filter((d) => d.value !== 'close' || closeEnd).map((d) => ({
                value: d.value,
                label:
                  d.value === 'close'
                    ? t('owner:booking.durations.untilCloseAt', { time: closeEnd.format('HH:mm') })
                    : t(`owner:booking.durations.${d.key}`),
              }))}
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('owner:booking.modal.closeInfo')}
          </Text>
        </>
      )}

      <div className="mb-mbk-footer">
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <WriteButton type="primary" loading={saving} onClick={submit} icon={mode === 'close' ? <LockOutlined /> : undefined}>
          {mode === 'close'
            ? t('owner:booking.modal.modeClose')
            : editing
              ? t('owner:booking.modal.saveChanges')
              : t('owner:booking.modal.addBooking')}
        </WriteButton>
      </div>
    </Form>
  );
}
