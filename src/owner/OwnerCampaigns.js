import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Radio, Row, Select, Skeleton, Space, Switch, Tooltip, Typography } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined } from '@ant-design/icons';
import { DAYS_SHORT, daysToMask, formatPrice, maskToDays, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, formatDate } from '../utils/format';
import { INACTIVE_TIP, WriteButton, asList, hourLabel, hourRange, notifyOwnerChanged, useOwnerData, ymd } from './shared';

const { Text } = Typography;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const HOUR_FROM = Array.from({ length: 24 }, (_, h) => ({ value: h, label: hourLabel(h) }));
const HOUR_TO = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: i + 1 === 24 ? '24:00' : hourLabel(i + 1) }));

const daysLabel = (mask) => {
  if (mask === 127) return 'Her gün';
  if (mask === daysToMask(WEEKDAYS)) return 'Hafta içi';
  if (mask === daysToMask(WEEKEND)) return 'Hafta sonu';
  return maskToDays(mask).join(', ');
};

const campaignState = (c) => {
  const today = dayjs().startOf('day');
  if (dayjs(c.endDate).endOf('day').isBefore(today)) return { key: 'expired', label: 'Süresi doldu' };
  if (!c.isActive) return { key: 'paused', label: 'Duraklatıldı' };
  if (dayjs(c.startDate).isAfter(dayjs(), 'day')) return { key: 'soon', label: 'Yakında' };
  return { key: 'live', label: 'Yayında' };
};

/** Kampanyalar */
export default function OwnerCampaigns() {
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
  const kind = Form.useWatch('kind', form);

  const pitches = useMemo(() => data?.pitches || [], [data]);
  const campaigns = useMemo(() => {
    const order = { live: 0, soon: 1, paused: 2, expired: 3 };
    return [...(data?.campaigns || [])].sort((a, b) => order[campaignState(a).key] - order[campaignState(b).key] || dayjs(a.startDate) - dayjs(b.startDate));
  }, [data]);
  const pitchName = (id) => (id == null ? 'Tüm sahalar' : pitches.find((p) => p.pitchId === id)?.name || `Saha #${id}`);

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
      message.success(editing.campaignId ? 'Kampanya güncellendi.' : 'Kampanya oluşturuldu.');
      setEditing(null);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Kampanya kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c, isActive) => {
    setToggling(c.campaignId);
    try {
      await ownerApi.saveCampaign(toPayload(c, { isActive }));
      setData((d) => ({ ...d, campaigns: d.campaigns.map((x) => (x.campaignId === c.campaignId ? { ...x, isActive } : x)) }));
      message.success(isActive ? 'Kampanya yayına alındı.' : 'Kampanya duraklatıldı.');
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Kampanya güncellenemedi.'));
    } finally {
      setToggling(null);
    }
  };

  const remove = (c) =>
    modal.confirm({
      title: `"${c.title}" silinsin mi?`,
      content: 'Kampanya oyunculara artık gösterilmez. Daha önce yapılmış rezervasyonların fiyatları değişmez.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await ownerApi.deleteCampaign(c.campaignId);
          message.success('Kampanya silindi.');
          notifyOwnerChanged();
          reload(true);
        } catch (e) {
          message.error(apiErrorMessage(e, 'Kampanya silinemedi.'));
        }
      },
    });

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title="Kampanyalar"
        icon={<GiftOutlined />}
        subtitle="Sakin saatlerinizi indirimlerle doldurun; kampanyalar oyunculara tesis sayfanızda öne çıkar."
        extra={
          <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
            Kampanya oluştur
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
          <EmptyState description="Henüz kampanyanız yok. Örneğin hafta içi öğle saatlerine %25 indirim tanımlayabilirsiniz.">
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
              İlk kampanyanızı oluşturun
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
                    <Tooltip title={membershipActive ? (c.isActive ? 'Duraklat' : 'Yayına al') : INACTIVE_TIP}>
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
                        <span className="mb-owner-promo__big">%{c.discountPercent}</span>
                        <span className="mb-owner-promo__unit">indirim</span>
                      </>
                    ) : (
                      <>
                        <span className="mb-owner-promo__big">{formatPrice(c.fixedPrice)}</span>
                        <span className="mb-owner-promo__unit">sabit saatlik</span>
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
                      Düzenle
                    </WriteButton>
                    <WriteButton size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(c)}>
                      Sil
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
        title={editing?.campaignId ? 'Kampanyayı düzenle' : 'Yeni kampanya'}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        width={560}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="title" label="Başlık" rules={[{ required: true, whitespace: true, message: 'Başlık gerekli.' }]}>
            <Input maxLength={80} placeholder="Örn. Hafta İçi Öğle İndirimi" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={2} maxLength={300} showCount placeholder="Oyunculara gösterilecek kısa açıklama" />
          </Form.Item>
          <Form.Item name="kind" label="Kampanya tipi">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value="percent">Yüzde indirim</Radio>
              <Radio value="fixed">Sabit fiyat</Radio>
            </Radio.Group>
          </Form.Item>
          {kind === 'fixed' ? (
            <Form.Item name="fixedPrice" label="Saatlik sabit fiyat" rules={[{ required: true, message: 'Fiyat girin.' }]}>
              <InputNumber min={0} step={50} addonAfter="₺" style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item name="discountPercent" label="İndirim oranı" rules={[{ required: true, message: 'Oran girin.' }]}>
              <InputNumber min={1} max={90} addonBefore="%" style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="range" label="Geçerlilik tarihleri" rules={[{ required: true, message: 'Tarih aralığı seçin.' }]}>
            <DatePicker.RangePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Günler" required>
            <Space size={6} style={{ marginBottom: 8 }} wrap>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKDAYS })}>
                Hafta içi
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: WEEKEND })}>
                Hafta sonu
              </Button>
              <Button size="small" onClick={() => form.setFieldsValue({ days: ALL_DAYS })}>
                Her gün
              </Button>
            </Space>
            <Form.Item name="days" noStyle rules={[{ required: true, type: 'array', min: 1, message: 'En az bir gün seçin.' }]}>
              <Checkbox.Group options={DAYS_SHORT.map((label, value) => ({ label, value }))} />
            </Form.Item>
          </Form.Item>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name="fromHour" label="Başlangıç" rules={[{ required: true, message: 'Seçin.' }]}>
                <Select options={HOUR_FROM} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item
                name="toHour"
                label="Bitiş"
                dependencies={['fromHour']}
                rules={[
                  { required: true, message: 'Seçin.' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) => (v == null || v > getFieldValue('fromHour') ? Promise.resolve() : Promise.reject(new Error('Bitiş saati hatalı.'))),
                  }),
                ]}
              >
                <Select options={HOUR_TO} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="pitchId" label="Saha">
                <Select allowClear placeholder="Tüm sahalar" options={pitches.map((p) => ({ value: p.pitchId, label: p.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isActive" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch checkedChildren="Yayında" unCheckedChildren="Taslak" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Aynı saate birden fazla kampanya uyarsa oyuncu için en uygun fiyat uygulanır.
          </Text>
        </Form>
      </Modal>
    </>
  );
}
