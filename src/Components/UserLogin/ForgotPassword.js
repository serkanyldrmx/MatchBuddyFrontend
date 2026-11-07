import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Radio, message } from 'antd';
import { LockOutlined, MailOutlined, MessageOutlined, NumberOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import AuthShell from './AuthShell';
import { authApi } from '../../api/auth';
import { usePublicParam } from '../../api/parameters';
import { applyFieldErrors, apiErrorMessage } from '../../utils/format';

/**
 * Şifremi unuttum: 1) kullanıcı adı / e-posta / telefon + kanal (e-posta ya da SMS) → 6 haneli kod
 *                  2) kod + yeni şifre. Kod hesabın kayıtlı adresine gider (docs/auth-api.md).
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('email');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resetForm] = Form.useForm();
  const resendSeconds = Number(usePublicParam('auth.codeResendCooldownSeconds')) || 60;
  const codeMinutes = Number(usePublicParam('auth.codeTtlMinutes')) || 15;
  const minLength = Number(usePublicParam('security.passwordMinLength')) || 6;
  const needLetterDigit = usePublicParam('auth.passwordRequireLetterAndDigit') === true;

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = async (id = identifier, ch = channel) => {
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(id.trim(), ch);
      message.success(res?.message || t('auth:forgot.codeSent'));
      setIdentifier(id.trim());
      setChannel(ch);
      setStep(2);
      setCooldown(resendSeconds);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (values) => {
    setLoading(true);
    try {
      const res = await authApi.resetPassword(identifier, values.code.trim(), values.password);
      message.success(res?.message || t('auth:forgot.done'));
      navigate('/', { replace: true });
    } catch (err) {
      const { unmatched } = applyFieldErrors(resetForm, err, { aliases: { newPassword: 'password' } });
      message.error(unmatched[0] || apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    { required: true, message: t('auth:forgot.passwordRequired') },
    { min: minLength, message: t('auth:forgot.passwordMin', { count: minLength }) },
    ...(needLetterDigit
      ? [{ pattern: /^(?=.*\p{L})(?=.*\d).+$/u, message: t('auth:forgot.passwordLetterDigit') }]
      : []),
  ];

  return (
    <AuthShell
      title={<Trans i18nKey="auth:forgot.title" components={{ em: <em /> }} />}
      subtitle={step === 1 ? t('auth:forgot.subtitle') : t(`auth:forgot.sentTo.${channel}`, { minutes: codeMinutes })}
    >
      {step === 1 ? (
        <Form
          layout="vertical"
          className="mb-auth__form"
          requiredMark={false}
          initialValues={{ channel: 'email' }}
          onFinish={(v) => sendCode(v.identifier, v.channel)}
        >
          <Form.Item
            name="identifier"
            label={t('auth:forgot.identifier')}
            rules={[{ required: true, whitespace: true, message: t('auth:forgot.identifierRequired') }]}
          >
            <Input size="large" prefix={<UserOutlined />} placeholder={t('auth:forgot.identifierPlaceholder')}
              autoComplete="username" autoCapitalize="none" autoFocus />
          </Form.Item>
          <Form.Item name="channel" label={t('auth:forgot.channel')}>
            <Radio.Group optionType="button" buttonStyle="solid" size="large" style={{ display: 'flex' }}>
              <Radio.Button value="email" style={{ flex: 1, textAlign: 'center' }}><MailOutlined /> {t('auth:forgot.email')}</Radio.Button>
              <Radio.Button value="sms" style={{ flex: 1, textAlign: 'center' }}><MessageOutlined /> {t('auth:forgot.sms')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item className="mb-auth__submit">
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {t('auth:forgot.sendCode')}
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Form form={resetForm} layout="vertical" className="mb-auth__form" requiredMark={false} onFinish={reset}>
          <Form.Item
            name="code"
            label={t('auth:forgot.code')}
            rules={[{ required: true, pattern: /^\s*\d{6}\s*$/, message: t('auth:forgot.codeInvalid') }]}
          >
            <Input size="large" prefix={<NumberOutlined />} placeholder="123456" inputMode="numeric"
              autoComplete="one-time-code" maxLength={6} autoFocus />
          </Form.Item>
          <Form.Item name="password" label={t('auth:forgot.newPassword')} rules={passwordRules} hasFeedback>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t('auth:forgot.confirmPassword')}
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: t('auth:forgot.passwordRequired') },
              ({ getFieldValue }) => ({
                validator: (_, v) => (!v || getFieldValue('password') === v
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('auth:register.passwordMismatch')))),
              }),
            ]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item className="mb-auth__submit">
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {t('auth:forgot.resetSubmit')}
            </Button>
          </Form.Item>
          <div className="mb-auth__row">
            <Button type="link" className="mb-auth__link" style={{ padding: 0 }} onClick={() => setStep(1)}>
              {t('auth:forgot.changeMethod')}
            </Button>
            <Button type="link" className="mb-auth__link" style={{ padding: 0 }} disabled={cooldown > 0 || loading}
              onClick={() => sendCode()}>
              {cooldown > 0 ? t('auth:forgot.resendIn', { seconds: cooldown }) : t('auth:forgot.resend')}
            </Button>
          </div>
        </Form>
      )}
      <p className="mb-auth__switch">
        <Link to="/" className="mb-auth__link">{t('auth:forgot.backToLogin')}</Link>
      </p>
    </AuthShell>
  );
}
