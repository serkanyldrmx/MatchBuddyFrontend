import { LockOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import AuthShell from "./AuthShell";
import { api, getToken } from '../../api/config';
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

  const success = () => {
    message.success(t('auth:login.success'));
  };

  const error = (text) => {
    message.error(text || t('auth:login.failed'));
  };

  const onFinish = async (values) => {
    const user = {
      userName: values.username,
      password: values.password,
    };

    try {
      const response = await api.post("/api/Players/PlayerLogin", user);
      const data = response.data;
      if (!data || !data.token || !data.player) {
        error();
        return;
      }

      // JWT token ve kullanıcı bilgisi saklanır
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.player));
      success();

      setTimeout(() => {
        navigate(homePathFor(data.player), { replace: true });
      }, 1500);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        error(t('auth:login.invalidCredentials'));
      } else {
        error();
      }
      console.error(err);
    }
  };

  return (
    <AuthShell
      title={<Trans i18nKey="auth:login.title" components={{ em: <em /> }} />}
      subtitle={t('auth:login.subtitle')}
    >
      <Form
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
          <Link to="#" className="mb-auth__link">{t('auth:login.forgotPassword')}</Link>
        </div>
        <Form.Item className="mb-auth__submit">
          <Button type="primary" htmlType="submit" size="large" block>
            {t('auth:login.submit')}
          </Button>
        </Form.Item>
      </Form>
      <p className="mb-auth__switch">
        {t('auth:login.noAccount')} <Link to="/register" className="mb-auth__link">{t('auth:login.signUpNow')}</Link>
      </p>
    </AuthShell>
  );
};

export default UserLogin;