import React, { useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, TimePicker, Tooltip } from 'antd';
import { CalendarOutlined, CompassOutlined, EditOutlined, EnvironmentOutlined, InfoCircleOutlined, PhoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { matchesApi } from '../../api/matches';
import { formatPrice } from '../../api/venues';
import { usePublicParams } from '../../api/parameters';
import { apiErrorMessage } from '../../utils/format';
import { mapsUrl, telUrl } from '../Venues/ExternalVenueForm';

/**
 * Harici (anlaşmasız) sahadaki maçın saha kartı: telefon, adres, yol tarifi, ücret ve kişi başı pay.
 * Kurucu saati / süreyi / ücreti / saha bilgisini düzenleyebilir (MatchBuddy/docs/external-venues-api.md).
 */
export default function ExternalVenueCard({ d, canEdit, reload }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const publicParams = usePublicParams();
  const v = d.venue;
  const start = dayjs(d.matchDate);
  const duration = d.durationMinutes || 60;
  const maps = mapsUrl(v);
  const tel = telUrl(v.phone);
  const place = [v.address, v.district, v.city].filter(Boolean).join(', ');

  const openEdit = () => {
    form.setFieldsValue({
      venueName: v.name,
      phone: v.phone,
      address: v.address,
      date: start.startOf('day'),
      time: start,
      durationMinutes: duration,
      totalPrice: d.totalPrice ?? null,
    });
    setEditing(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const when = values.date.hour(values.time.hour()).minute(values.time.minute()).second(0);
    setSaving(true);
    try {
      const res = await matchesApi.updateExternal({
        matchId: d.matchId,
        matchDate: when.format('YYYY-MM-DDTHH:mm:ss'),
        durationMinutes: values.durationMinutes,
        totalPrice: values.totalPrice ?? 0,
        venueName: values.venueName?.trim() || null,
        phone: values.phone?.trim() ?? '',
        address: values.address?.trim() ?? '',
      });
      message.success(res?.message || t('match:external.saved'));
      setEditing(false);
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:external.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="mb-booking mb-ext-card"
      title={t('match:external.title')}
      extra={
        canEdit && (
          <Button size="small" icon={<EditOutlined />} onClick={openEdit}>
            {t('match:external.edit')}
          </Button>
        )
      }
    >
      <div className="mb-booking__head is-static">
        <span className="mb-ext__badge-icon is-large">
          <PhoneOutlined />
        </span>
        <span className="mb-booking__head-text">
          <strong>{v.name}</strong>
          <Tooltip title={t('match:external.badgeHint')}>
            <span className="mb-ext__badge">
              <InfoCircleOutlined /> {t('match:external.badge')}
            </span>
          </Tooltip>
          <span>
            <CalendarOutlined /> {start.format('DD MMM, HH:mm')}–{start.add(duration, 'minute').format('HH:mm')} ·{' '}
            {t('match:external.minutes', { count: duration })}
          </span>
        </span>
      </div>

      {place && (
        <p className="mb-ext-card__place">
          <EnvironmentOutlined /> {place}
        </p>
      )}

      <div className="mb-booking__lines">
        <div className="is-total">
          <span>{t('match:external.total')}</span>
          <span>{d.totalPrice != null ? formatPrice(d.totalPrice) : '-'}</span>
        </div>
      </div>
      {d.perPlayer != null ? (
        <div className="mb-booking__per">
          <span>{t('match:external.perPlayer')}</span>
          <strong>{formatPrice(d.perPlayer)}</strong>
        </div>
      ) : (
        <p className="mb-hint">{t('match:external.noPrice')}</p>
      )}
      <p className="mb-hint">{t('match:external.payOnSite')}</p>

      <div className="mb-booking__actions">
        {tel && (
          <Button type="primary" icon={<PhoneOutlined />} href={tel}>
            {t('match:external.call')}
          </Button>
        )}
        {maps && (
          <Button icon={<CompassOutlined />} href={maps} target="_blank" rel="noreferrer">
            {t('match:external.directions')}
          </Button>
        )}
      </div>

      <Modal
        open={editing}
        title={t('match:external.editTitle')}
        onCancel={() => setEditing(false)}
        onOk={save}
        confirmLoading={saving}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        destroyOnClose
      >
        <p className="mb-hint">
          <InfoCircleOutlined /> {t('match:external.editHint')}
        </p>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="venueName" label={t('match:external.venueName')} rules={[{ required: true, min: 2, max: 100, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label={t('match:external.date')} rules={[{ required: true }]}>
                <DatePicker format="DD MMM ddd" inputReadOnly style={{ width: '100%' }} disabledDate={(x) => x && x.isBefore(dayjs().startOf('day'))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="time" label={t('match:external.time')} rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} needConfirm={false} showNow={false} inputReadOnly style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="durationMinutes" label={t('match:external.duration')}>
                <Select options={publicParams.get('venue.allowedDurations').map((x) => ({ value: x, label: t('match:external.minutes', { count: x }) }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="totalPrice" label={t('match:external.price')}>
                <InputNumber min={0} max={100000} step={50} addonAfter="₺" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phone" label={t('match:external.phone')}>
            <Input maxLength={30} inputMode="tel" />
          </Form.Item>
          <Form.Item name="address" label={t('match:external.address')}>
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
