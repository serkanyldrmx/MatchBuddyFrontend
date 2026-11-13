import React, { useEffect, useState } from 'react';
import { Alert, App, Form, Input, InputNumber, Modal } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { matchesApi } from '../../api/matches';
import { usePublicParams } from '../../api/parameters';
import { apiErrorMessage } from '../../utils/format';

/**
 * Maç bilgilerini düzenleme (kurucu / admin): ad, açıklama, oyuncu sayısı.
 * Saha / saat / ücret burada değişmez — harici sahada "Saha bilgisi" kartından, tesis maçında yeni rezervasyonla.
 * Sözleşme: MatcBuddy/docs/match-participation-api.md "UpdateMatch"
 */
function EditMatchModal({ open, detail, rosterCount, onClose, onSaved }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const params = usePublicParams();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const minPerSide = params.get('venue.bookingMinPlayersPerSide') || 4;
  const maxPerSide = detail?.venue?.playersPerSide || params.get('venue.playersPerSideMax') || 11;
  const extra = params.get('venue.extraPlayersAllowed') ?? 4;
  const min = Math.max(minPerSide * 2, rosterCount || 0, 2);
  const max = Math.max(maxPerSide * 2 + extra, min);

  useEffect(() => {
    if (open && detail) {
      form.setFieldsValue({
        matchName: detail.matchName || '',
        description: detail.description || '',
        userCount: detail.capacity,
      });
    }
  }, [open, detail, form]);

  const userCount = Form.useWatch('userCount', form);
  const perSide = userCount ? Math.ceil(userCount / 2) : null;

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const res = await matchesApi.update({
        matchId: detail.matchId,
        matchName: values.matchName.trim(),
        description: (values.description || '').trim(),
        userCount: values.userCount,
      });
      message.success(res?.message || t('match:edit.saved'));
      onClose();
      onSaved?.();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:edit.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <span>
          <EditOutlined style={{ marginRight: 8 }} />
          {t('match:edit.title')}
        </span>
      }
      okText={t('common:actions.save')}
      cancelText={t('common:actions.cancel')}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item
          name="matchName"
          label={t('match:edit.name')}
          rules={[
            { required: true, whitespace: true, message: t('match:edit.nameRequired') },
            { min: 2, max: 100, message: t('match:edit.nameLength') },
          ]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item
          name="userCount"
          label={t('match:edit.userCount')}
          extra={
            perSide
              ? t('match:edit.userCountHint', { perSide, min, max })
              : undefined
          }
          rules={[{ required: true, type: 'number', min, max, message: t('match:edit.userCountRange', { min, max }) }]}
        >
          <InputNumber min={min} max={max} step={2} style={{ width: '100%' }} inputMode="numeric" />
        </Form.Item>
        {rosterCount > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('match:edit.rosterNote', { count: rosterCount })}
          />
        )}
        <Form.Item name="description" label={t('match:edit.description')}>
          <Input.TextArea rows={3} maxLength={1000} showCount placeholder={t('match:edit.descriptionPlaceholder')} />
        </Form.Item>
        <p className="mb-hint" style={{ marginBottom: 0 }}>
          {detail?.venue?.isExternal ? t('match:edit.externalHint') : t('match:edit.venueHint')}
        </p>
      </Form>
    </Modal>
  );
}

export default EditMatchModal;
