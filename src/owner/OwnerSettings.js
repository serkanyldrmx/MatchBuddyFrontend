import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Form, InputNumber, Row, Skeleton, Tag, Typography } from 'antd';
import { SaveOutlined, SettingOutlined, UndoOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ownerApi } from '../api/venues';
import { usePublicParams } from '../api/parameters';
import { useOwnerVenue } from '../layout/VenueLayout';
import { PageHeader } from '../ui';
import { formErrorMessage, formatDateTime } from '../utils/format';
import { InactiveTip, WriteButton, notifyOwnerChanged, useOwnerData } from './shared';
import './OwnerSettings.css';

const { Text } = Typography;

/**
 * Tesis ayarları (VenueSettings) — sözleşme: MatcBuddy/docs/platform-api.md §5
 * Boş (null) alan = sistem varsayılanı (booking.* parametreleri).
 * unit: owner:settings.units.<unit> (saat / gün)
 */
const FIELDS = [
  { name: 'minBookingNoticeHours', min: 0, max: 168, unit: 'hours', param: 'booking.defaultMinNoticeHours' },
  { name: 'maxAdvanceBookingDays', min: 1, max: 365, unit: 'days', param: 'booking.defaultMaxAdvanceDays' },
  { name: 'freeCancellationHours', min: 0, max: 720, unit: 'hours', param: 'booking.defaultFreeCancellationHours' },
];

const toForm = (s) => Object.fromEntries(FIELDS.map((f) => [f.name, s?.[f.name] ?? null]));

/** İşletme: rezervasyon kuralları */
export default function OwnerSettings() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { venue, venueId, membershipActive } = useOwnerVenue();
  const params = usePublicParams();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { data, loading, error, setData } = useOwnerData((id) => ownerApi.settings(id));
  const values = Form.useWatch([], form) || {};

  useEffect(() => {
    if (data) form.setFieldsValue(toForm(data));
  }, [data, form]);

  // Sistem varsayılanı: önce sunucunun bu tesis için döndürdüğü, yoksa herkese açık parametre
  const defaultOf = (f) => data?.defaults?.[f.name] ?? params.get(f.param);
  const unitText = (f, count) => t(`owner:settings.units.${f.unit}`, { count });

  const dirty = data ? FIELDS.some((f) => (values[f.name] ?? null) !== (data[f.name] ?? null)) : false;

  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    try {
      // Tam değiştirme: boş alanlar null gönderilir (= sistem varsayılanı)
      const body = Object.fromEntries(FIELDS.map((f) => [f.name, v[f.name] ?? null]));
      const res = await ownerApi.saveSettings(venueId, body);
      const saved = res?.settings || { ...data, ...body };
      setData(saved);
      form.setFieldsValue(toForm(saved));
      message.success(t('owner:settings.saved'));
      notifyOwnerChanged();
    } catch (e) {
      message.error(formErrorMessage(form, e, t('owner:settings.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('owner:settings.title')}
        subtitle={t('owner:settings.subtitle')}
        icon={<SettingOutlined />}
        extra={
          <WriteButton type="primary" icon={<SaveOutlined />} loading={saving} disabled={!data || !dirty} onClick={save}>
            {t('common:actions.save')}
          </WriteButton>
        }
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Card bordered={false} className="mb-owner-settings">
        {loading && !data ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Form form={form} layout="vertical" requiredMark={false} disabled={!membershipActive} onFinish={save}>
            <Alert type="info" showIcon className="mb-owner-settings__intro" message={t('owner:settings.intro')} />
            <Row gutter={[24, 8]}>
              {FIELDS.map((f) => {
                const def = defaultOf(f);
                const usingDefault = values[f.name] == null;
                const effective = usingDefault ? def : values[f.name];
                return (
                  <Col xs={24} lg={8} key={f.name}>
                    <div className="mb-owner-settings__field">
                      <div className="mb-owner-settings__label">
                        <strong>{t(`owner:settings.fields.${f.name}.label`)}</strong>
                        {usingDefault ? (
                          <Tag>{t('owner:settings.usingDefault')}</Tag>
                        ) : (
                          <Tag color="gold">{t('owner:settings.custom')}</Tag>
                        )}
                      </div>
                      <Form.Item
                        name={f.name}
                        extra={
                          <span className="mb-owner-settings__help">
                            <span>{t(`owner:settings.fields.${f.name}.help`, { value: effective, unit: unitText(f, effective) })}</span>
                            <span>
                              {t('owner:settings.systemDefault', { value: unitText(f, def) })} ·{' '}
                              {t('owner:settings.allowedRange', { min: f.min, max: unitText(f, f.max) })}
                            </span>
                          </span>
                        }
                        rules={[
                          {
                            type: 'number',
                            min: f.min,
                            max: f.max,
                            message: t('owner:settings.rangeError', { min: f.min, max: f.max }),
                          },
                        ]}
                      >
                        <InputNumber
                          min={f.min}
                          max={f.max}
                          precision={0}
                          style={{ width: '100%' }}
                          placeholder={t('owner:settings.defaultPlaceholder', { value: unitText(f, def) })}
                          addonAfter={t(`owner:settings.units.${f.unit}Short`)}
                        />
                      </Form.Item>
                      {!usingDefault && (
                        <InactiveTip>
                          <Button
                            type="link"
                            size="small"
                            icon={<UndoOutlined />}
                            className="mb-owner-settings__reset"
                            disabled={!membershipActive}
                            onClick={() => form.setFieldValue(f.name, null)}
                          >
                            {t('owner:settings.useDefault')}
                          </Button>
                        </InactiveTip>
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
            <div className="mb-owner-settings__footer">
              <Text type="secondary">
                {data?.updatedAt ? t('owner:settings.updatedAt', { date: formatDateTime(data.updatedAt) }) : t('owner:settings.neverSaved')}
              </Text>
              <WriteButton type="primary" icon={<SaveOutlined />} loading={saving} disabled={!data || !dirty} onClick={save}>
                {t('common:actions.save')}
              </WriteButton>
            </div>
          </Form>
        )}
      </Card>
    </>
  );
}
