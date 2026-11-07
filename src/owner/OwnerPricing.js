import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Checkbox, Col, Form, Grid, InputNumber, Modal, Row, Select, Skeleton, Space, Switch, Table, TimePicker, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined, TagsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DAYS, DAYS_SHORT, daysToMask, formatPrice, maskToDays, ownerApi } from '../api/venues';
import { intlLocale } from '../i18n';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, formErrorMessage } from '../utils/format';
import { usePublicParam } from '../api/parameters';
import { WriteButton, asList, effectivePrice, hourLabel, hourRange, normalizeHours, notifyOwnerChanged, useOwnerData } from './shared';

const { Text } = Typography;
const HOUR_OPTIONS_FROM = Array.from({ length: 24 }, (_, h) => ({ value: h, label: hourLabel(h) }));
const HOUR_OPTIONS_TO = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: i + 1 === 24 ? '24:00' : hourLabel(i + 1) }));
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const maskIndexes = (mask) => ALL_DAYS.filter((i) => mask & (1 << i));

function DayChips({ mask }) {
  const { t } = useTranslation();
  const days = maskToDays(mask);
  if (mask === 127) return <span className="mb-owner-daychip is-on">{t('facility:pricing.everyDay')}</span>;
  if (mask === daysToMask(WEEKDAYS)) return <span className="mb-owner-daychip is-on">{t('facility:pricing.weekdays')}</span>;
  if (mask === daysToMask(WEEKEND)) return <span className="mb-owner-daychip is-on">{t('facility:pricing.weekend')}</span>;
  return (
    <span className="mb-owner-daychips">
      {DAYS_SHORT.map((d) => (
        <span key={d} className={`mb-owner-daychip${days.includes(d) ? ' is-on' : ''}`}>
          {d}
        </span>
      ))}
    </span>
  );
}

/** Haftalık açılış saatleri, fiyat kuralları ve fiyat önizlemesi */
export default function OwnerPricing() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { venue, venueId, membershipActive } = useOwnerVenue();
  const { data, loading, error, reload } = useOwnerData(async (id) => {
    const [hours, rules, pitches] = await Promise.all([ownerApi.openingHours(id), ownerApi.priceRules(id), ownerApi.pitches(id)]);
    return { hours: asList(hours, 'days', 'openingHours'), rules: asList(rules, 'rules', 'priceRules'), pitches: asList(pitches, 'pitches') };
  });

  const [days, setDays] = useState(() => normalizeHours([]));
  const [hoursDirty, setHoursDirty] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [editing, setEditing] = useState(null);
  const [savingRule, setSavingRule] = useState(false);
  const [previewPitch, setPreviewPitch] = useState(null);
  const [form] = Form.useForm();
  const maxPrice = usePublicParam('venue.maxPrice');
  // Telefonda kart başlığındaki ana aksiyonlar tam boy (44px) dokunma alanı alır
  const isPhone = Grid.useBreakpoint().md === false;
  const headBtnSize = isPhone ? 'middle' : 'small';

  useEffect(() => {
    if (data) {
      setDays(normalizeHours(data.hours));
      setHoursDirty(false);
    }
  }, [data]);

  const rules = useMemo(() => data?.rules || [], [data]);
  const pitches = useMemo(() => data?.pitches || [], [data]);
  const pitchName = (id) => pitches.find((p) => p.pitchId === id)?.name || t('facility:pricing.pitchFallback', { id });

  useEffect(() => {
    if (pitches.length && !pitches.some((p) => p.pitchId === previewPitch)) setPreviewPitch((pitches.find((p) => p.isActive) || pitches[0]).pitchId);
  }, [pitches, previewPitch]);

  /* ---------- Açılış saatleri ---------- */
  const updateDay = (i, patch) => {
    setDays((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setHoursDirty(true);
  };

  const copyToAll = (i) => {
    const src = days[i];
    setDays((list) => list.map((d) => ({ ...d, isClosed: src.isClosed, openTime: src.openTime, closeTime: src.closeTime })));
    setHoursDirty(true);
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      await ownerApi.saveOpeningHours(
        venueId,
        days.map((d) => ({ dayOfWeek: d.dayOfWeek, isClosed: Boolean(d.isClosed), openTime: d.openTime, closeTime: d.closeTime }))
      );
      message.success(t('facility:pricing.hoursSaved'));
      setHoursDirty(false);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(apiErrorMessage(e, t('facility:pricing.hoursSaveFailed')));
    } finally {
      setSavingHours(false);
    }
  };

  /* ---------- Fiyat kuralları ---------- */
  const openRule = (r) => {
    setEditing(r || {});
    form.resetFields();
    form.setFieldsValue(
      r
        ? { days: maskIndexes(r.daysMask), fromHour: r.fromHour, toHour: r.toHour, pitchId: r.pitchId ?? undefined, pricePerHour: r.pricePerHour }
        : { days: WEEKDAYS, fromHour: 18, toHour: 24, pitchId: undefined, pricePerHour: undefined }
    );
  };

  const saveRule = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSavingRule(true);
    try {
      await ownerApi.savePriceRule({
        priceRuleId: editing.priceRuleId,
        stadiumId: venueId,
        pitchId: v.pitchId ?? null,
        daysMask: daysToMask(v.days),
        fromHour: v.fromHour,
        toHour: v.toHour,
        pricePerHour: v.pricePerHour,
      });
      message.success(editing.priceRuleId ? t('facility:pricing.ruleUpdated') : t('facility:pricing.ruleAdded'));
      setEditing(null);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(formErrorMessage(form, e, t('facility:pricing.ruleSaveFailed'), { aliases: { daysMask: 'days' } }));
    } finally {
      setSavingRule(false);
    }
  };

  const removeRule = (r) =>
    modal.confirm({
      title: t('facility:pricing.deleteConfirmTitle'),
      content: t('facility:pricing.deleteConfirmContent'),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await ownerApi.deletePriceRule(r.priceRuleId);
          message.success(t('facility:pricing.ruleDeleted'));
          notifyOwnerChanged();
          reload(true);
        } catch (e) {
          message.error(apiErrorMessage(e, t('facility:pricing.ruleDeleteFailed')));
        }
      },
    });

  const ruleColumns = [
    { title: t('facility:pricing.columns.days'), dataIndex: 'daysMask', render: (m) => <DayChips mask={m} /> },
    { title: t('facility:pricing.columns.hours'), key: 'hours', render: (_, r) => <Text strong>{hourRange(r.fromHour, r.toHour)}</Text> },
    {
      title: t('common:pitch'),
      dataIndex: 'pitchId',
      render: (id) => (id == null ? <Text type="secondary">{t('facility:pricing.allPitches')}</Text> : pitchName(id)),
    },
    {
      title: t('facility:pricing.columns.hourlyPrice'),
      dataIndex: 'pricePerHour',
      align: 'right',
      render: (v) => <span className="mb-owner-price">{formatPrice(v)}</span>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <WriteButton size="small" icon={<EditOutlined />} onClick={() => openRule(r)} aria-label={t('common:actions.edit')} />
          <WriteButton size="small" danger icon={<DeleteOutlined />} onClick={() => removeRule(r)} aria-label={t('common:actions.delete')} />
        </Space>
      ),
    },
  ];

  /* ---------- Önizleme ---------- */
  const preview = useMemo(() => {
    const pitch = pitches.find((p) => p.pitchId === previewPitch);
    const open = days.filter((d) => !d.isClosed);
    if (!pitch || !open.length) return null;
    const start = Math.floor(Math.min(...open.map((d) => d.open)) / 60);
    const end = Math.ceil(Math.max(...open.map((d) => d.close)) / 60);
    const hours = Array.from({ length: end - start }, (_, i) => start + i);
    const rows = days.map((d, di) => ({
      day: di,
      cells: hours.map((h) => {
        const isOpen = !d.isClosed && h * 60 >= Math.floor(d.open / 60) * 60 && h * 60 < d.close;
        if (!isOpen) return { h, open: false };
        const dayIdx = h >= 24 ? (di + 1) % 7 : di;
        const { price, rule } = effectivePrice(pitch, rules, dayIdx, h % 24);
        return { h, open: true, price, ruled: Boolean(rule) };
      }),
    }));
    const prices = rows.flatMap((r) => r.cells.filter((c) => c.open).map((c) => c.price));
    return { hours, rows, min: Math.min(...prices), max: Math.max(...prices) };
  }, [pitches, previewPitch, days, rules]);

  const heat = (price) => {
    if (!preview || preview.max === preview.min) return 30;
    return 18 + Math.round(((price - preview.min) / (preview.max - preview.min)) * 62);
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('facility:pricing.title')}
        icon={<TagsOutlined />}
        subtitle={t('facility:pricing.subtitle')}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card
            bordered={false}
            title={t('facility:pricing.openingHours')}
            extra={
              <WriteButton type="primary" size={headBtnSize} icon={<SaveOutlined />} onClick={saveHours} loading={savingHours} disabled={!hoursDirty}>
                {t('common:actions.save')}
              </WriteButton>
            }
          >
            {loading && !data ? (
              <Skeleton active paragraph={{ rows: 7 }} />
            ) : (
              <div className="mb-owner-hours">
                {days.map((d, i) => {
                  const overnight = !d.isClosed && d.closeTime !== '00:00' && d.closeTime <= d.openTime;
                  return (
                    <div key={i} className={`mb-owner-hours__row${d.isClosed ? ' is-closed' : ''}`}>
                      <span className="mb-owner-hours__day">{DAYS[i]}</span>
                      <Switch
                        size="small"
                        checked={!d.isClosed}
                        disabled={!membershipActive}
                        onChange={(v) => updateDay(i, { isClosed: !v })}
                        checkedChildren={t('facility:pricing.open')}
                        unCheckedChildren={t('facility:pricing.closed')}
                      />
                      {d.isClosed ? (
                        <Text type="secondary" className="mb-owner-hours__closed">
                          {t('facility:pricing.dayClosed')}
                        </Text>
                      ) : (
                        <span className="mb-owner-hours__times">
                          <TimePicker
                            size="small"
                            format="HH:mm"
                            minuteStep={30}
                            allowClear={false}
                            needConfirm={false}
                            disabled={!membershipActive}
                            value={dayjs(d.openTime, 'HH:mm')}
                            onChange={(t) => t && updateDay(i, { openTime: t.format('HH:mm') })}
                          />
                          <span>–</span>
                          <TimePicker
                            size="small"
                            format="HH:mm"
                            minuteStep={30}
                            allowClear={false}
                            needConfirm={false}
                            disabled={!membershipActive}
                            value={dayjs(d.closeTime, 'HH:mm')}
                            onChange={(t) => t && updateDay(i, { closeTime: t.format('HH:mm') })}
                          />
                          {overnight && <span className="mb-owner-hours__hint">{t('facility:pricing.nextDay')}</span>}
                          {d.closeTime === '00:00' && <span className="mb-owner-hours__hint is-muted">{t('facility:pricing.midnight')}</span>}
                        </span>
                      )}
                      <Tooltip title={t('facility:pricing.applyToAllTooltip')}>
                        <Button
                          size="small"
                          type="text"
                          icon={<ClockCircleOutlined />}
                          disabled={!membershipActive}
                          onClick={() => copyToAll(i)}
                          aria-label={t('facility:pricing.applyToAll')}
                        />
                      </Tooltip>
                    </div>
                  );
                })}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('facility:pricing.overnightHint')}
                </Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            bordered={false}
            title={t('facility:pricing.priceRules')}
            extra={
              <WriteButton size={headBtnSize} type="primary" icon={<PlusOutlined />} onClick={() => openRule(null)} disabled={!pitches.length}>
                {t('facility:pricing.addRule')}
              </WriteButton>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {t('facility:pricing.rulesHint')}
            </Text>
            <Table
              rowKey="priceRuleId"
              size="small"
              columns={ruleColumns}
              dataSource={rules}
              loading={loading}
              pagination={false}
              scroll={{ x: 560 }}
              locale={{ emptyText: <EmptyState description={t('facility:pricing.noRules')} /> }}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card
            bordered={false}
            title={t('facility:pricing.preview')}
            extra={
              pitches.length > 1 && (
                <Select size="small" value={previewPitch} onChange={setPreviewPitch} style={{ minWidth: 150 }} options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))} />
              )
            }
          >
            {!preview ? (
              <EmptyState description={pitches.length ? t('facility:pricing.previewNeedsOpenDay') : t('facility:pricing.previewNeedsPitch')} />
            ) : (
              <>
                <div className="mb-owner-heat-scroll">
                  <div
                    className="mb-owner-heat"
                    style={{
                      gridTemplateColumns: isPhone
                        ? `40px repeat(${preview.hours.length}, minmax(44px, 1fr))`
                        : `72px repeat(${preview.hours.length}, minmax(52px, 1fr))`,
                    }}
                  >
                    <span />
                    {preview.hours.map((h) => (
                      <span key={h} className="mb-owner-heat__hour">
                        {hourLabel(h)}
                      </span>
                    ))}
                    {preview.rows.map((r) => (
                      <React.Fragment key={r.day}>
                        <span className="mb-owner-heat__day">{DAYS_SHORT[r.day]}</span>
                        {r.cells.map((c) =>
                          c.open ? (
                            <Tooltip
                              key={c.h}
                              title={t(c.ruled ? 'facility:pricing.cellTooltipRule' : 'facility:pricing.cellTooltipBase', {
                                day: DAYS[r.day],
                                hour: hourLabel(c.h),
                                price: formatPrice(c.price),
                              })}
                            >
                              <span
                                className={`mb-owner-heat__cell${c.ruled ? ' is-ruled' : ''}`}
                                style={{ background: `color-mix(in srgb, var(--mb-primary) ${heat(c.price)}%, var(--mb-surface-2))` }}
                              >
                                {Math.round(c.price).toLocaleString(intlLocale())}
                              </span>
                            </Tooltip>
                          ) : (
                            <span key={c.h} className="mb-owner-heat__cell is-closed" />
                          )
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                  {t('facility:pricing.previewHint')}
                </Text>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={Boolean(editing)}
        title={editing?.priceRuleId ? t('facility:pricing.editRule') : t('facility:pricing.newRule')}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={savingRule}
        onOk={saveRule}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label={t('facility:pricing.columns.days')} required>
            <Space size={6} style={{ marginBottom: 8 }} wrap>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKDAYS })}>
                {t('facility:pricing.weekdays')}
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKEND })}>
                {t('facility:pricing.weekend')}
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: ALL_DAYS })}>
                {t('facility:pricing.everyDay')}
              </Button>
            </Space>
            <Form.Item name="days" noStyle rules={[{ required: true, type: 'array', min: 1, message: t('facility:pricing.daysRequired') }]}>
              <Checkbox.Group options={DAYS_SHORT.map((label, value) => ({ label, value }))} />
            </Form.Item>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fromHour" label={t('facility:pricing.from')} rules={[{ required: true, message: t('validation:select') }]}>
                <Select options={HOUR_OPTIONS_FROM} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="toHour"
                label={t('facility:pricing.to')}
                dependencies={['fromHour']}
                rules={[
                  { required: true, message: t('validation:select') },
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      v == null || v > getFieldValue('fromHour')
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('facility:pricing.toAfterFrom'))),
                  }),
                ]}
              >
                <Select options={HOUR_OPTIONS_TO} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="pitchId" label={t('common:pitch')}>
                <Select allowClear placeholder={t('facility:pricing.allPitches')} options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="pricePerHour"
                label={t('facility:pricing.columns.hourlyPrice')}
                rules={[{ required: true, message: t('facility:pricing.priceRequired') }]}
              >
                <InputNumber min={0} max={maxPrice} step={50} addonAfter="₺" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('facility:pricing.overnightRuleHint')}
          </Text>
        </Form>
      </Modal>
    </>
  );
}
