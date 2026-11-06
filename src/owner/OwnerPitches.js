import React, { useState } from 'react';
import { Alert, App, Card, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Skeleton, Switch, Tooltip, Typography } from 'antd';
import { BorderOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { SURFACE, formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage } from '../utils/format';
import { INACTIVE_TIP, WriteButton, asList, notifyOwnerChanged, useOwnerData } from './shared';

const { Text } = Typography;
const SIDES = [5, 6, 7, 8, 9, 10, 11];

/** Tesisteki sahalar */
export default function OwnerPitches() {
  const { message, modal } = App.useApp();
  const { venue, venueId, membershipActive } = useOwnerVenue();
  const { data, loading, error, reload, setData } = useOwnerData((id) => ownerApi.pitches(id));
  const [editing, setEditing] = useState(null); // {} = yeni
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [form] = Form.useForm();

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
      message.success(editing.pitchId ? 'Saha güncellendi.' : 'Saha eklendi.');
      setEditing(null);
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Saha kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p, isActive) => {
    setToggling(p.pitchId);
    try {
      await ownerApi.savePitch(toPayload(p, { isActive }));
      setData((list) => asList(list, 'pitches').map((x) => (x.pitchId === p.pitchId ? { ...x, isActive } : x)));
      message.success(isActive ? `${p.name} rezervasyona açıldı.` : `${p.name} pasife alındı; oyuncular bu sahayı göremez.`);
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Durum güncellenemedi.'));
    } finally {
      setToggling(null);
    }
  };

  const remove = (p) =>
    modal.confirm({
      title: `${p.name} silinsin mi?`,
      content: 'Bu işlem geri alınamaz. Sahanın geçmiş maç kayıtları korunur.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await ownerApi.deletePitch(p.pitchId);
          message.success('Saha silindi.');
          notifyOwnerChanged();
          reload(true);
        } catch (e) {
          if (e?.response?.status === 400) {
            modal.warning({
              title: 'Saha silinemedi',
              content: (
                <>
                  <p>{apiErrorMessage(e, 'Bu sahada gelecekte onaylı ya da bekleyen maçlar var.')}</p>
                  <p>Yeni rezervasyon almamak için sahayı silmek yerine pasife alabilirsiniz.</p>
                </>
              ),
              okText: 'Tamam',
            });
          } else {
            message.error(apiErrorMessage(e, 'Saha silinemedi.'));
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
        : { name: `Saha ${pitches.length + 1}`, surface: 1, isIndoor: false, playersPerSide: 7, basePrice: 1500, isActive: true }
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title="Sahalar"
        icon={<BorderOutlined />}
        subtitle="Tesisinizdeki sahaları, zemin tipini ve saatlik taban fiyatı yönetin."
        extra={
          <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
            Saha ekle
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
          <EmptyState description="Henüz saha eklemediniz. Rezervasyon alabilmek için en az bir aktif saha gerekir.">
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
              İlk sahanızı ekleyin
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
                    <span>{SURFACE[p.surface] || 'Diğer'}</span>
                    <span>{p.isIndoor ? 'Kapalı' : 'Açık'}</span>
                  </span>
                </div>
                <div className="mb-owner-pitch__body">
                  <div>
                    <div className="mb-owner-pitch__name">{p.name}</div>
                    <Text type="secondary">
                      Taban fiyat <Text strong>{formatPrice(p.basePrice)}</Text> / saat
                    </Text>
                  </div>
                  <Tooltip title={membershipActive ? (p.isActive ? 'Rezervasyona açık' : 'Pasif — oyuncular göremez') : INACTIVE_TIP}>
                    <Switch
                      checked={p.isActive}
                      loading={toggling === p.pitchId}
                      disabled={!membershipActive}
                      onChange={(v) => toggleActive(p, v)}
                      checkedChildren="Aktif"
                      unCheckedChildren="Pasif"
                    />
                  </Tooltip>
                </div>
                <div className="mb-owner-pitch__actions">
                  <WriteButton size="small" icon={<EditOutlined />} onClick={() => openEditor(p)}>
                    Düzenle
                  </WriteButton>
                  <WriteButton size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(p)}>
                    Sil
                  </WriteButton>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.pitchId ? 'Sahayı düzenle' : 'Yeni saha'}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Saha adı" rules={[{ required: true, whitespace: true, message: 'Saha adı gerekli.' }]}>
            <Input maxLength={60} placeholder="Örn. Saha 1, Kapalı Saha" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="surface" label="Zemin">
                <Select options={Object.entries(SURFACE).map(([value, label]) => ({ value: Number(value), label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="playersPerSide" label="Format">
                <Select options={SIDES.map((n) => ({ value: n, label: `${n}+${n}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isIndoor" label="Saha tipi">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value={false}>Açık saha</Radio>
              <Radio value>Kapalı saha</Radio>
            </Radio.Group>
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="basePrice"
                label="Saatlik taban fiyat"
                extra="Fiyat kuralı olmayan saatlerde uygulanır."
                rules={[{ required: true, message: 'Fiyat girin.' }]}
              >
                <InputNumber min={0} step={50} addonAfter="₺" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="isActive" label="Durum" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
