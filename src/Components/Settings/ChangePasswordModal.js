import React, { useState } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';
import { saveSession } from '../../api/config';
import { usePublicParam } from '../../api/parameters';
import { apiErrorMessage, applyFieldErrors } from '../../utils/format';

/** Şifre değiştir (mevcut şifre + yeni şifre). Başarıda sunucu yeni oturum döndürür; diğer cihazlar kapanır. */
export default function ChangePasswordModal({ open, onClose }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const minLength = Number(usePublicParam('security.passwordMinLength')) || 6;
  const needLetterDigit = usePublicParam('auth.passwordRequireLetterAndDigit') === true;

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.changePassword(values.current, values.password);
      saveSession(res);
      message.success(t('settings:password.saved'));
      form.resetFields();
      onClose();
    } catch (e) {
      const { unmatched } = applyFieldErrors(form, e, { aliases: { currentPassword: 'current', newPassword: 'password' } });
      message.error(unmatched[0] || apiErrorMessage(e, t('settings:password.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <span>
          <LockOutlined style={{ marginRight: 8 }} />
          {t('settings:password.title')}
        </span>
      }
      okText={t('common:actions.save')}
      cancelText={t('common:actions.cancel')}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={submit}>
        <Form.Item name="current" label={t('settings:password.current')} rules={[{ required: true, message: t('settings:password.required') }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('settings:password.new')}
          hasFeedback
          rules={[
            { required: true, message: t('settings:password.required') },
            { min: minLength, message: t('settings:password.min', { count: minLength }) },
            ...(needLetterDigit ? [{ pattern: /^(?=.*\p{L})(?=.*\d).+$/u, message: t('settings:password.letterDigit') }] : []),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('settings:password.confirm')}
          dependencies={['password']}
          hasFeedback
          rules={[
            { required: true, message: t('settings:password.required') },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || getFieldValue('password') === v ? Promise.resolve() : Promise.reject(new Error(t('settings:password.mismatch'))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <p className="mb-hint" style={{ margin: 0 }}>{t('settings:password.hint')}</p>
      </Form>
    </Modal>
  );
}
