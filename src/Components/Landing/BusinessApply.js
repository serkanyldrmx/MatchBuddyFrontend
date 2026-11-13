import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Checkbox, Col, Form, Input, InputNumber, Result, Row } from 'antd';
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import AuthShell from '../UserLogin/AuthShell';
import { api } from '../../api/config';
import { apiErrorMessage } from '../../utils/format';
import { phoneDigits, phoneRule, toStoredPhone } from '../../utils/phone';

/**
 * İşletme üyelik başvurusu (işletmeler sayfasındaki "Başvur" / "Üye ol").
 * Hesap kendiliğinden açılmaz: başvuru yöneticilere iletilir, yönetici arayıp hesabı açar.
 */
export default function BusinessApply() {
  const { t } = useTranslation('auth');
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (v) => {
    setSending(true);
    setError(null);
    try {
      await api.post('/api/BusinessApplications', {
        businessName: v.businessName?.trim(),
        contactName: v.contactName?.trim(),
        phone: toStoredPhone(v.phone),
        email: v.email?.trim() || null,
        city: v.city?.trim() || null,
        district: v.district?.trim() || null,
        pitchCount: v.pitchCount || null,
        note: v.note?.trim() || null,
        consent: !!v.consent,
      });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(apiErrorMessage(e, t('bizApply.error')));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={<Trans i18nKey="auth:bizApply.doneTitle" components={{ em: <em /> }} />}>
        <Result
          status="success"
          title={t('bizApply.doneHeading')}
          subTitle={t('bizApply.doneText')}
          extra={[
            <Link key="biz" to="/isletmeler">
              <Button type="primary">{t('bizApply.backToBiz')}</Button>
            </Link>,
            <Link key="home" to="/">
              <Button>{t('bizApply.backHome')}</Button>
            </Link>,
          ]}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell wide title={<Trans i18nKey="auth:bizApply.title" components={{ em: <em /> }} />} subtitle={t('bizApply.subtitle')}>
      <Form layout="vertical" form={form} className="mb-auth__form" onFinish={submit} scrollToFirstError requiredMark={false}>
        <h3 className="mb-auth__section">
          <span>01</span> {t('bizApply.sections.business')}
        </h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="businessName"
              label={t('bizApply.businessName')}
              rules={[{ required: true, whitespace: true, message: t('bizApply.required') }, { max: 120 }]}
            >
              <Input prefix={<ShopOutlined />} placeholder={t('bizApply.businessNamePlaceholder')} autoComplete="organization" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="pitchCount" label={t('bizApply.pitchCount')} extra={t('bizApply.optional')}>
              <InputNumber min={1} max={50} style={{ width: '100%' }} inputMode="numeric" placeholder="2" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="city" label={t('bizApply.city')} rules={[{ max: 60 }]}>
              <Input prefix={<EnvironmentOutlined />} placeholder={t('bizApply.cityPlaceholder')} autoComplete="address-level1" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="district" label={t('bizApply.district')} rules={[{ max: 60 }]}>
              <Input placeholder={t('bizApply.districtPlaceholder')} autoComplete="address-level2" />
            </Form.Item>
          </Col>
        </Row>

        <h3 className="mb-auth__section">
          <span>02</span> {t('bizApply.sections.contact')}
        </h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="contactName"
              label={t('bizApply.contactName')}
              rules={[{ required: true, whitespace: true, message: t('bizApply.required') }, { max: 100 }]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('bizApply.contactNamePlaceholder')} autoComplete="name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label={t('bizApply.phone')}
              normalize={phoneDigits}
              rules={[{ required: true, message: t('bizApply.phoneRequired') }, phoneRule(t)]}
            >
              <Input
                addonBefore="0"
                prefix={<PhoneOutlined />}
                maxLength={10}
                placeholder="5xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label={t('bizApply.email')} extra={t('bizApply.optional')} rules={[{ type: 'email', message: t('bizApply.emailInvalid') }]}>
              <Input prefix={<MailOutlined />} placeholder="ornek@isletme.com" inputMode="email" autoComplete="email" autoCapitalize="none" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="note" label={t('bizApply.note')} extra={t('bizApply.optional')}>
              <Input.TextArea rows={3} maxLength={1000} showCount placeholder={t('bizApply.notePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="consent"
          valuePropName="checked"
          rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error(t('bizApply.consentRequired')))) }]}
        >
          <Checkbox>
            <Trans i18nKey="auth:bizApply.consent" components={{ terms: <Link to="/terms" target="_blank" rel="noopener noreferrer" /> }} />
          </Checkbox>
        </Form.Item>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Button type="primary" htmlType="submit" block size="large" loading={sending}>
          {t('bizApply.submit')}
        </Button>
        <p className="mb-auth__switch">
          {t('bizApply.haveAccount')} <Link to="/login" className="mb-auth__link">{t('bizApply.ownerLogin')}</Link>
        </p>
      </Form>
    </AuthShell>
  );
}
