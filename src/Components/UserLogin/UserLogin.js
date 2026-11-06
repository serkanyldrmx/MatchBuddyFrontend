import { LockOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect } from "react";
import AuthShell from "./AuthShell";
import { api, getToken } from '../../api/config';
import { homePathFor } from '../../utils/roles';

const UserLogin = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    // Token yoksa oturum geçersiz sayılır
    if (storedUser && getToken()) {
      navigate(homePathFor(storedUser), { replace: true });
    }
  }, [navigate]);

  const success = () => {
    message.success("Giriş başarılı, yönlendiriliyorsunuz");
  };

  const error = (text = "Giriş başarısız") => {
    message.error(text);
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
        error("Kullanıcı adı veya şifre hatalı");
      } else {
        error();
      }
      console.error(err);
    }
  };

  return (
    <AuthShell
      title={<>Sahaya <em>dönüş</em></>}
      subtitle="Kadron seni bekliyor. Hesabına giriş yap, maçını kaçırma."
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
          label="Kullanıcı adı"
          rules={[
            {
              required: true,
              message: "Lütfen Kullanıcı adınızı giriniz!",
            },
          ]}
        >
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="Kullanıcı Adı"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
          />
        </Form.Item>
        <Form.Item
          name="password"
          label="Şifre"
          rules={[
            {
              required: true,
              message: "Lütfen Şifrenizi Giriniz!",
            },
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined />}
            placeholder="Şifre"
            autoComplete="current-password"
            iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>
        <div className="mb-auth__row">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Beni Hatırla</Checkbox>
          </Form.Item>
          <Link to="#" className="mb-auth__link">Parolanızı mı unuttunuz?</Link>
        </div>
        <Form.Item className="mb-auth__submit">
          <Button type="primary" htmlType="submit" size="large" block>
            Giriş Yap
          </Button>
        </Form.Item>
      </Form>
      <p className="mb-auth__switch">
        Hesabın yok mu? <Link to="/register" className="mb-auth__link">Şimdi üye ol</Link>
      </p>
    </AuthShell>
  );
};

export default UserLogin;