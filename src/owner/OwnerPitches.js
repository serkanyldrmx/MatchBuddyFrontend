import React, { useState } from 'react';
import { Alert, App, Card, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Skeleton, Switch, Tooltip, Typography } from 'antd';
import { BorderOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { SURFACE, formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, formErrorMessage, isErrorCode } from '../utils/format';
import { usePublicParams } from '../api/parameters';
import { INACTIVE_TIP, WriteButton, asList, notifyOwnerChanged, useOwnerData } from './shared';

const { Text } = Typography;
const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Tesisteki sahalar */
export default function OwnerPitches() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { venue, venueId, membershipActive } = useOwnerVenue();
  const { data, loading, error, reload, setData } = useOwnerData((id) => ownerApi.pitches(id));
  const [editing, setEditing] = useState(null); // {} = yeni
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [form] = Form.useForm();
  // Takım başına oyuncu aralığı ve en yüksek ücret sunucu parametrelerinden gelir
  const params = usePublicParams();
  const sideMin = params.get('venue.playersPerSideMin');
  const sideMax = Math.max(sideMin, params.get('venue.playersPerSideMax'));
  const SIDES = range(sideMin, sideMax);
  const defaultSide = Math.min(Math.max(7, sideMin), sideMax);
  const maxPrice = params.get('venue.maxPrice');

  const pitches = asList(data, 'pitches');

  const toPayload = (p, patch = {}) => ({
    pitchId: p.pitchId,
    stadiumId: venueId,
    name: p.name,
    surface: p.surface,
    isIndoor: p.isIndoor,
    playersPerSide: p.playersPerSide,
    basePrice: p.basePrice,
    isActive: p.isActive,
    ...patch,
  });

  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    try {
      await ownerApi.savePitch(toPayload({ ...editing, ...v, name: v.name.trim() }));
      message.success(editing.pitchId ? t('facility:pitches.updated') : t('facility:pitches.added'));
      setEditing(null);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(formErrorMessage(form, e, t('facility:pitches.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p, isActive) => {
    setToggling(p.pitchId);
    try {
      await ownerApi.savePitch(toPayload(p, { isActive }));
      setData((list) => asList(list, 'pitches').map((x) => (x.pitchId === p.pitchId ? { ...x, isActive } : x)));
      message.success(isActive ? t('facility:pitches.activated', { name: p.name }) : t('facility:pitches.deactivated', { name: p.name }));
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, t('facility:pitches.statusUpdateFailed')));
    } finally {
      setToggling(null);
    }
  };

  const remove = (p) =>
    modal.confirm({
      title: t('facility:pitches.deleteConfirmTitle', { name: p.name }),
      content: t('facility:pitches.deleteConfirmContent'),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await ownerApi.deletePitch(p.pitchId);
          message.success(t('facility:pitches.deleted'));
          notifyOwnerChanged();
          reload(true);
        } catch (e) {
          if (isErrorCode(e, 'OWNER_PITCH_HAS_RESERVATIONS')) {
            modal.warning({
              title: t('facility:pitches.deleteBlockedTitle'),
              content: (
                <>
                  <p>{apiErrorMessage(e, t('facility:pitches.deleteBlockedReason'))}</p>
                  <p>{t('facility:pitches.deleteBlockedHint')}</p>
                </>
              ),
              okText: t('common:actions.ok'),
            });
          } else {
            message.error(apiErrorMessage(e, t('facility:pitches.deleteFailed')));
          }
        }
      },
    });

  const openEditor = (p) => {
    setEditing(p || {});
    form.resetFields();
    form.setFieldsValue(
      p
        ? { name: p.name, surface: p.surface, isIndoor: p.isIndoor, playersPerSide: p.playersPerSide, basePrice: p.basePrice, isActive: p.isActive }
        : { name: t('facility:pitches.defaultName', { n: pitches.length + 1 }), surface: 1, isIndoor: false, playersPerSide: defaultSide, basePrice: 1500, isActive: true }
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('facility:pitches.title')}
        icon={<BorderOutlined />}
        subtitle={t('facility:pitches.subtitle')}
        extra={
          <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
            {t('facility:pitches.add')}
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
      ) : pitches.length === 0 ? (
        <Card bordered={false}>
          <EmptyState description={t('facility:pitches.empty')}>
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
              {t('facility:pitches.addFirst')}
            </WriteButton>
          </EmptyState>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {pitches.map((p) => (
            <Col xs={24} md={12} xl={8} key={p.pitchId}>
              <div className={`mb-owner-pitch${p.isActive ? '' : ' is-inactive'}`}>
                <div className="mb-owner-pitch__field">
                  <span className="mb-owner-pitch__format">
                    {p.playersPerSide}+{p.playersPerSide}
                  </span>
                  <span className="mb-owner-pitch__chips">
                    <span>{SURFACE[p.surface] || t('common:other')}</span>
                    <span>{p.isIndoor ? t('common:indoor') : t('common:outdoor')}</span>
                  </span>
                </div>
                <div className="mb-owner-pitch__body">
                  <div>
                    <div className="mb-owner-pitch__name">{p.name}</div>
                    <Text type="secondary">
                      <Trans
                        i18nKey="facility:pitches.basePriceLine"
                        values={{ price: formatPrice(p.basePrice) }}
                        components={{ b: <Text strong /> }}
                      />
                    </Text>
                  </div>
                  <Tooltip
                    title={
                      membershipActive
                        ? p.isActive
                          ? t('facility:pitches.activeTooltip')
                          : t('facility:pitches.inactiveTooltip')
                        : INACTIVE_TIP
                    }
                  >
                    <Switch
                      checked={p.isActive}
                      loading={toggling === p.pitchId}
                      disabled={!membershipActive}
                      onChange={(v) => toggleActive(p, v)}
                      checkedChildren={t('facility:pitches.active')}
                      unCheckedChildren={t('facility:pitches.inactive')}
                    />
                  </Tooltip>
                </div>
                <div className="mb-owner-pitch__actions">
                  <WriteButton size="small" icon={<EditOutlined />} onClick={() => openEditor(p)}>
                    {t('common:actions.edit')}
                  </WriteButton>
                  <WriteButton size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(p)}>
                    {t('common:actions.delete')}
                  </WriteButton>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.pitchId ? t('facility:pitches.editTitle') : t('facility:pitches.newTitle')}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label={t('facility:pitches.form.name')}
            rules={[{ required: true, whitespace: true, message: t('facility:pitches.form.nameRequired') }]}
          >
            <Input maxLength={60} placeholder={t('facility:pitches.form.namePlaceholder')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="surface" label={t('facility:pitches.form.surface')}>
                <Select options={Object.entries(SURFACE).map(([value, label]) => ({ value: Number(value), label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="playersPerSide" label={t('facility:pitches.form.format')}>
                <Select options={SIDES.map((n) => ({ value: n, label: `${n}+${n}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isIndoor" label={t('facility:pitches.form.type')}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value={false}>{t('facility:pitches.form.outdoor')}</Radio>
              <Radio value>{t('facility:pitches.form.indoor')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="basePrice"
                label={t('facility:pitches.form.basePrice')}
                extra={t('facility:pitches.form.basePriceExtra')}
                rules={[{ required: true, message: t('facility:pitches.form.priceRequired') }]}
              >
                <InputNumber min={0} max={maxPrice} step={50} addonAfter="₺" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="isActive" label={t('facility:pitches.form.status')} valuePropName="checked">
                <Switch checkedChildren={t('facility:pitches.active')} unCheckedChildren={t('facility:pitches.inactive')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
