import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Radio, Row, Select, Skeleton, Space, Switch, Tooltip, Typography } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DAYS_SHORT, daysToMask, formatPrice, maskToDays, ownerApi } from '../api/venues';
import i18n from '../i18n';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, formErrorMessage, formatDate } from '../utils/format';
import { usePublicParam } from '../api/parameters';
import { INACTIVE_TIP, WriteButton, asList, hourLabel, hourRange, notifyOwnerChanged, useOwnerData, ymd } from './shared';

const { Text } = Typography;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const HOUR_FROM = Array.from({ length: 24 }, (_, h) => ({ value: h, label: hourLabel(h) }));
const HOUR_TO = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: i + 1 === 24 ? '24:00' : hourLabel(i + 1) }));

const daysLabel = (mask) => {
  if (mask === 127) return i18n.t('facility:campaigns.everyDay');
  if (mask === daysToMask(WEEKDAYS)) return i18n.t('facility:campaigns.weekdays');
  if (mask === daysToMask(WEEKEND)) return i18n.t('facility:campaigns.weekend');
  return maskToDays(mask).join(', ');
};

const campaignState = (c) => {
  const today = dayjs().startOf('day');
  if (dayjs(c.endDate).endOf('day').isBefore(today)) return { key: 'expired', label: i18n.t('facility:campaigns.state.expired') };
  if (!c.isActive) return { key: 'paused', label: i18n.t('facility:campaigns.state.paused') };
  if (dayjs(c.startDate).isAfter(dayjs(), 'day')) return { key: 'soon', label: i18n.t('facility:campaigns.state.soon') };
  return { key: 'live', label: i18n.t('facility:campaigns.state.live') };
};

/** Kampanyalar */
export default function OwnerCampaigns() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { venue, venueId, membershipActive } = useOwnerVenue();
  const { data, loading, error, reload, setData } = useOwnerData(async (id) => {
    const [campaigns, pitches] = await Promise.all([ownerApi.campaigns(id), ownerApi.pitches(id).catch(() => [])]);
    return { campaigns: asList(campaigns, 'campaigns'), pitches: asList(pitches, 'pitches') };
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [form] = Form.useForm();
  const maxPrice = usePublicParam('venue.maxPrice');
  const kind = Form.useWatch('kind', form);

  const pitches = useMemo(() => data?.pitches || [], [data]);
  const campaigns = useMemo(() => {
    const order = { live: 0, soon: 1, paused: 2, expired: 3 };
    return [...(data?.campaigns || [])].sort((a, b) => order[campaignState(a).key] - order[campaignState(b).key] || dayjs(a.startDate) - dayjs(b.startDate));
  }, [data]);
  const pitchName = (id) =>
    id == null
      ? t('facility:campaigns.allPitches')
      : pitches.find((p) => p.pitchId === id)?.name || t('facility:campaigns.pitchFallback', { id });

  const toPayload = (c, patch = {}) => ({
    campaignId: c.campaignId,
    stadiumId: venueId,
    pitchId: c.pitchId ?? null,
    title: c.title,
    description: c.description || null,
    startDate: ymd(c.startDate),
    endDate: ymd(c.endDate),
    daysMask: c.daysMask,
    fromHour: c.fromHour,
    toHour: c.toHour,
    discountPercent: c.discountPercent ?? null,
    fixedPrice: c.fixedPrice ?? null,
    isActive: c.isActive,
    ...patch,
  });

  const openEditor = (c) => {
    setEditing(c || {});
    form.resetFields();
    form.setFieldsValue(
      c
        ? {
            title: c.title,
            description: c.description,
            range: [dayjs(c.startDate), dayjs(c.endDate)],
            days: ALL_DAYS.filter((i) => c.daysMask & (1 << i)),
            fromHour: c.fromHour,
            toHour: c.toHour,
            pitchId: c.pitchId ?? undefined,
            kind: c.fixedPrice != null ? 'fixed' : 'percent',
            discountPercent: c.discountPercent ?? 20,
            fixedPrice: c.fixedPrice ?? undefined,
            isActive: c.isActive,
          }
        : {
            title: '',
            description: '',
            range: [dayjs(), dayjs().add(1, 'month')],
            days: WEEKDAYS,
            fromHour: 12,
            toHour: 17,
            pitchId: undefined,
            kind: 'percent',
            discountPercent: 20,
            fixedPrice: undefined,
            isActive: true,
          }
    );
  };

  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    try {
      await ownerApi.saveCampaign(
        toPayload({
          campaignId: editing.campaignId,
          pitchId: v.pitchId,
          title: v.title.trim(),
          description: v.description?.trim(),
          startDate: v.range[0],
          endDate: v.range[1],
          daysMask: daysToMask(v.days),
          fromHour: v.fromHour,
          toHour: v.toHour,
          discountPercent: v.kind === 'percent' ? v.discountPercent : null,
          fixedPrice: v.kind === 'fixed' ? v.fixedPrice : null,
          isActive: v.isActive,
        })
      );
      message.success(editing.campaignId ? t('facility:campaigns.updated') : t('facility:campaigns.created'));
      setEditing(null);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(
        formErrorMessage(form, e, t('facility:campaigns.saveFailed'), {
          aliases: { daysMask: 'days', startDate: 'range', endDate: 'range' },
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c, isActive) => {
    setToggling(c.campaignId);
    try {
      await ownerApi.saveCampaign(toPayload(c, { isActive }));
      setData((d) => ({ ...d, campaigns: d.campaigns.map((x) => (x.campaignId === c.campaignId ? { ...x, isActive } : x)) }));
      message.success(isActive ? t('facility:campaigns.published') : t('facility:campaigns.paused'));
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, t('facility:campaigns.updateFailed')));
    } finally {
      setToggling(null);
    }
  };

  const remove = (c) =>
    modal.confirm({
      title: t('facility:campaigns.deleteConfirmTitle', { title: c.title }),
      content: t('facility:campaigns.deleteConfirmContent'),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await ownerApi.deleteCampaign(c.campaignId);
          message.success(t('facility:campaigns.deleted'));
          notifyOwnerChanged();
          reload(true);
        } catch (e) {
          message.error(apiErrorMessage(e, t('facility:campaigns.deleteFailed')));
        }
      },
    });

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('facility:campaigns.title')}
        icon={<GiftOutlined />}
        subtitle={t('facility:campaigns.subtitle')}
        extra={
          <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
            {t('facility:campaigns.create')}
          </WriteButton>
        }
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {loading && !data ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2].map((i) => (
            <Col xs={24} md={12} xl={8} key={i}>
              <Card bordered={false}>
                <Skeleton active />
              </Card>
            </Col>
          ))}
        </Row>
      ) : campaigns.length === 0 ? (
        <Card bordered={false}>
          <EmptyState description={t('facility:campaigns.empty')}>
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
              {t('facility:campaigns.createFirst')}
            </WriteButton>
          </EmptyState>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {campaigns.map((c) => {
            const st = campaignState(c);
            return (
              <Col xs={24} md={12} xl={8} key={c.campaignId}>
                <div className={`mb-owner-promo is-${st.key}`}>
                  <div className="mb-owner-promo__top">
                    <span className={`mb-owner-promo__state is-${st.key}`}>{st.label}</span>
                    <Tooltip
                      title={
                        membershipActive ? (c.isActive ? t('facility:campaigns.pause') : t('facility:campaigns.publish')) : INACTIVE_TIP
                      }
                    >
                      <Switch
                        size="small"
                        checked={c.isActive}
                        disabled={!membershipActive || st.key === 'expired'}
                        loading={toggling === c.campaignId}
                        onChange={(v) => toggle(c, v)}
                      />
                    </Tooltip>
                  </div>
                  <div className="mb-owner-promo__value">
                    {c.discountPercent != null ? (
                      <>
                        <span className="mb-owner-promo__big">{t('facility:campaigns.percentValue', { value: c.discountPercent })}</span>
                        <span className="mb-owner-promo__unit">{t('facility:campaigns.discountUnit')}</span>
                      </>
                    ) : (
                      <>
                        <span className="mb-owner-promo__big">{formatPrice(c.fixedPrice)}</span>
                        <span className="mb-owner-promo__unit">{t('facility:campaigns.fixedHourlyUnit')}</span>
                      </>
                    )}
                  </div>
                  <div className="mb-owner-promo__title">{c.title}</div>
                  {c.description && <div className="mb-owner-promo__desc">{c.description}</div>}
                  <div className="mb-owner-promo__perf" />
                  <div className="mb-owner-promo__meta">
                    <span>
                      <CalendarOutlined /> {formatDate(c.startDate)} – {formatDate(c.endDate)}
                    </span>
                    <span>
                      <ClockCircleOutlined /> {daysLabel(c.daysMask)} · {hourRange(c.fromHour, c.toHour)}
                    </span>
                    <span>{pitchName(c.pitchId)}</span>
                  </div>
                  <div className="mb-owner-promo__actions">
                    <WriteButton size="small" icon={<EditOutlined />} onClick={() => openEditor(c)}>
                      {t('common:actions.edit')}
                    </WriteButton>
                    <WriteButton size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(c)}>
                      {t('common:actions.delete')}
                    </WriteButton>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.campaignId ? t('facility:campaigns.editTitle') : t('facility:campaigns.newTitle')}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        width={560}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="title"
            label={t('facility:campaigns.form.title')}
            rules={[{ required: true, whitespace: true, message: t('facility:campaigns.form.titleRequired') }]}
          >
            <Input maxLength={80} placeholder={t('facility:campaigns.form.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('facility:campaigns.form.description')}>
            <Input.TextArea rows={2} maxLength={300} showCount placeholder={t('facility:campaigns.form.descriptionPlaceholder')} />
          </Form.Item>
          <Form.Item name="kind" label={t('facility:campaigns.form.kind')}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value="percent">{t('facility:campaigns.form.kindPercent')}</Radio>
              <Radio value="fixed">{t('facility:campaigns.form.kindFixed')}</Radio>
            </Radio.Group>
          </Form.Item>
          {kind === 'fixed' ? (
            <Form.Item
              name="fixedPrice"
              label={t('facility:campaigns.form.fixedPrice')}
              rules={[{ required: true, message: t('facility:campaigns.form.priceRequired') }]}
            >
              <InputNumber min={0} max={maxPrice} step={50} addonAfter="₺" style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="discountPercent"
              label={t('facility:campaigns.form.discountPercent')}
              rules={[{ required: true, message: t('facility:campaigns.form.rateRequired') }]}
            >
              {/* Üst sınır (venue.maxDiscountPercent) herkese açık değil: sunucu doğrular, hata alanın altında gösterilir */}
              <InputNumber min={1} max={100} addonBefore="%" style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item
            name="range"
            label={t('facility:campaigns.form.range')}
            rules={[{ required: true, message: t('facility:campaigns.form.rangeRequired') }]}
          >
            <DatePicker.RangePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('facility:campaigns.form.days')} required>
            <Space size={6} style={{ marginBottom: 8 }} wrap>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKDAYS })}>
                {t('facility:campaigns.weekdays')}
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKEND })}>
                {t('facility:campaigns.weekend')}
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: ALL_DAYS })}>
                {t('facility:campaigns.everyDay')}
              </Button>
            </Space>
            <Form.Item name="days" noStyle rules={[{ required: true, type: 'array', min: 1, message: t('facility:campaigns.form.daysRequired') }]}>
              <Checkbox.Group options={DAYS_SHORT.map((label, value) => ({ label, value }))} />
            </Form.Item>
          </Form.Item>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name="fromHour" label={t('facility:campaigns.form.from')} rules={[{ required: true, message: t('validation:select') }]}>
                <Select options={HOUR_FROM} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item
                name="toHour"
                label={t('facility:campaigns.form.to')}
                dependencies={['fromHour']}
                rules={[
                  { required: true, message: t('validation:select') },
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      v == null || v > getFieldValue('fromHour')
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('facility:campaigns.form.toInvalid'))),
                  }),
                ]}
              >
                <Select options={HOUR_TO} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="pitchId" label={t('common:pitch')}>
                <Select
                  allowClear
                  placeholder={t('facility:campaigns.allPitches')}
                  options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isActive" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch checkedChildren={t('facility:campaigns.state.live')} unCheckedChildren={t('facility:campaigns.form.draft')} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('facility:campaigns.form.overlapHint')}
          </Text>
        </Form>
      </Modal>
    </>
  );
}
