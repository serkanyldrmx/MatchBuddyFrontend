import React, { useState } from 'react';
import { App, Form, Input, Modal, Radio } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { matchesApi, SIDE } from '../../api/matches';
import { apiErrorMessage } from '../../utils/format';

/**
 * Misafir oyuncu (uygulamayı kullanmayan kişi) ekleme / düzenleme.
 * guest verilirse düzenleme modundadır.
 * free: { [SIDE.HOME]: n, [SIDE.AWAY]: n } — tarafta kalan boş yer (düzenlemede kendi yeri hariç)
 */
function GuestModal({ open, matchId, guest, side, preferredSide, free = {}, homeLabel, awayLabel, onClose, onSaved }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const editing = !!guest;

  const freeFor = (s) => {
    const n = free[s] ?? 0;
    return editing && guest.side === s ? n + 1 : n;
  };
  const defaultSide =
    guest?.side ||
    side ||
    // Varsayılan: maçı yönetenin kendi tarafı (genelde arkadaşını kendi takımına ekler), yer yoksa boş olan taraf
    (preferredSide && freeFor(preferredSide) > 0 ? preferredSide : null) ||
    (freeFor(SIDE.AWAY) > freeFor(SIDE.HOME) ? SIDE.AWAY : SIDE.HOME);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const name = values.name.trim();
    const note = values.note?.trim() || undefined;
    setSaving(true);
    try {
      const res = editing
        ? await matchesApi.updateGuest(guest.guestId, values.side, name, note)
        : await matchesApi.addGuest(matchId, values.side, name, note);
      message.success(res?.message || (editing ? t('home:guestModal.updated') : t('home:guestModal.added', { name })));
      onClose();
      onSaved?.();
    } catch (e) {
      message.error(apiErrorMessage(e, editing ? t('home:guestModal.updateFailed') : t('home:guestModal.addFailed')));
    } finally {
      setSaving(false);
    }
  };

  const sideOption = (s, label) => {
    const n = freeFor(s);
    return (
      <Radio.Button value={s} disabled={n <= 0} className={`mb-guest-side is-${s === SIDE.AWAY ? 'away' : 'home'}`}>
        <span className="mb-guest-side__inner">
          <span className="mb-guest-side__dot" />
          <span className="mb-guest-side__name">{label}</span>
          <small>{n > 0 ? t('home:guestModal.free', { count: n }) : t('home:guestModal.full')}</small>
        </span>
      </Radio.Button>
    );
  };

  return (
    <Modal
      open={open}
      title={
        <span>
          <UserAddOutlined style={{ color: 'var(--mb-primary)', marginRight: 8 }} />
          {editing ? t('home:guestModal.titleEdit') : t('home:guestModal.titleAdd')}
        </span>
      }
      okText={editing ? t('common:actions.save') : t('home:guestModal.okAdd')}
      cancelText={t('common:actions.cancel')}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
      className="mb-guest-modal"
    >
      <p className="mb-guest-modal__hint">
        {t('home:guestModal.hint')}
      </p>
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        requiredMark={false}
        initialValues={{ name: guest?.name || '', note: guest?.note || '', side: defaultSide }}
        onFinish={submit}
      >
        <Form.Item
          name="name"
          label={t('home:guestModal.nameLabel')}
          rules={[
            { required: true, whitespace: true, message: t('home:guestModal.nameRequired') },
            {
              validator: (_, v) => {
                const len = (v || '').trim().length;
                if (!len || (len >= 2 && len <= 60)) return Promise.resolve();
                return Promise.reject(new Error(t('home:guestModal.nameLength')));
              },
            },
          ]}
        >
          <Input placeholder={t('home:guestModal.namePlaceholder')} maxLength={60} autoFocus autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="note"
          label={t('home:guestModal.noteLabel')}
          rules={[{ max: 200, message: t('home:guestModal.noteMax', { count: 200 }) }]}
        >
          <Input.TextArea rows={2} maxLength={200} showCount placeholder={t('home:guestModal.notePlaceholder')} />
        </Form.Item>
        <Form.Item name="side" label={t('home:guestModal.sideLabel')} rules={[{ required: true, message: t('home:guestModal.sideRequired') }]}>
          <Radio.Group className="mb-guest-sides">
            {sideOption(SIDE.HOME, homeLabel)}
            {sideOption(SIDE.AWAY, awayLabel)}
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default GuestModal;
