import React, { useState } from 'react';
import { App, Form, Input, Modal, Radio } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { matchesApi, SIDE } from '../../api/matches';
import { apiErrorMessage } from '../../utils/format';

/**
 * Misafir oyuncu (uygulamayı kullanmayan kişi) ekleme / düzenleme.
 * guest verilirse düzenleme modundadır.
 * free: { [SIDE.HOME]: n, [SIDE.AWAY]: n } — tarafta kalan boş yer (düzenlemede kendi yeri hariç)
 */
function GuestModal({ open, matchId, guest, side, preferredSide, free = {}, homeLabel, awayLabel, onClose, onSaved }) {
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
      message.success(res?.message || (editing ? 'Misafir oyuncu güncellendi.' : `${name} kadroya eklendi.`));
      onClose();
      onSaved?.();
    } catch (e) {
      message.error(apiErrorMessage(e, editing ? 'Misafir oyuncu güncellenemedi.' : 'Misafir oyuncu eklenemedi.'));
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
          <small>{n > 0 ? `${n} boş yer` : 'Dolu'}</small>
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
          {editing ? 'Misafir oyuncuyu düzenle' : 'İsimle oyuncu ekle'}
        </span>
      }
      okText={editing ? 'Kaydet' : 'Kadroya ekle'}
      cancelText="Vazgeç"
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
      className="mb-guest-modal"
    >
      <p className="mb-guest-modal__hint">
        Uygulamada hesabı olmayan arkadaşını isimle kadroya yaz. Misafirler kadroda yer tutar ama MVP oylamasına ve
        puanlamaya katılmaz.
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
          label="İsim"
          rules={[
            { required: true, whitespace: true, message: 'İsim yaz.' },
            {
              validator: (_, v) => {
                const len = (v || '').trim().length;
                if (!len || (len >= 2 && len <= 60)) return Promise.resolve();
                return Promise.reject(new Error('İsim 2–60 karakter olmalı.'));
              },
            },
          ]}
        >
          <Input placeholder="Ör. Ahmet Yılmaz" maxLength={60} autoFocus autoComplete="off" />
        </Form.Item>
        <Form.Item name="note" label="Not / açıklama" rules={[{ max: 200, message: 'En fazla 200 karakter.' }]}>
          <Input.TextArea rows={2} maxLength={200} showCount placeholder="Ör. kaleci, Ahmet'in arkadaşı" />
        </Form.Item>
        <Form.Item name="side" label="Takım" rules={[{ required: true, message: 'Bir takım seç.' }]}>
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
