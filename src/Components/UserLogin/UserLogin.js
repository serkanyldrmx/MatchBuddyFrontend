import { LockOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import AuthShell from "./AuthShell";
import { getToken } from '../../api/config';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../utils/format';
import SocialLogin from './SocialLogin';
import useLoginFlow from './useLoginFlow';
import { homePathFor } from '../../utils/roles';

const UserLogin = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    // Token yoksa oturum geçersiz sayılır
    if (storedUser && getToken()) {
      navigate(homePathFor(storedUser), { replace: true });
    }
  }, [navigate]);

  const { finish, termsModal } = useLoginFlow();
  const [form] = Form.useForm();
  const remember = Form.useWatch('remember', form) ?? true;
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      finish(await authApi.login(values.username, values.password, values.remember !== false));
    } catch (err) {
      if (err.response && err.response.status === 401) {
        message.error(t('auth:login.invalidCredentials'));
      } else {
        message.error(apiErrorMessage(err, t('auth:login.failed')));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={<Trans i18nKey="auth:login.title" components={{ em: <em /> }} />}
      subtitle={t('auth:login.subtitle')}
    >
      <Form
        form={form}
        name="normal_login"
        className="mb-auth__form"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          remember: true,
        }}
        onFinish={onFinish}
      >
        <Form.Item
          name="username"
          label={t('auth:login.username')}
          rules={[
            {
              required: true,
              message: t('auth:login.usernameRequired'),
            },
          ]}
        >
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder={t('auth:login.usernamePlaceholder')}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
          />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth:login.password')}
          rules={[
            {
              required: true,
              message: t('auth:login.passwordRequired'),
            },
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined />}
            placeholder={t('auth:login.passwordPlaceholder')}
            autoComplete="current-password"
            iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>
        <div className="mb-auth__row">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>{t('auth:login.remember')}</Checkbox>
          </Form.Item>
          <Link to="/forgot-password" className="mb-auth__link">{t('auth:login.forgotPassword')}</Link>
        </div>
        <Form.Item className="mb-auth__submit">
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {t('auth:login.submit')}
          </Button>
        </Form.Item>
      </Form>
      <SocialLogin rememberMe={remember} onSuccess={finish} />
      {termsModal}
      <p className="mb-auth__switch">
        {t('auth:login.noAccount')} <Link to="/register" className="mb-auth__link">{t('auth:login.signUpNow')}</Link>
      </p>
    </AuthShell>
  );
};

export default UserLogin;