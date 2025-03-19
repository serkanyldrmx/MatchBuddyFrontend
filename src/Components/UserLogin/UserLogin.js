import { LockOutlined, UserOutlined, EyeTwoTone, EyeInvisibleOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, Row, Col, message, Card } from "antd";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect } from "react";
import "./Login.css";
import Logo from '../../images/mutch_buddy_Logo.png'; // Logoyu import edin
import axios from 'axios';

const UserLogin = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      if (storedUser.isAdmin === 1) {
        navigate("/AdminPanel", { state: { user: storedUser } });
      } else {
        navigate("/home", { state: { user: storedUser } });
      }
    }
  }, [navigate]);

  const success = () => {
    message.success("Giriş başarılı, yönlendiriliyorsunuz");
  };

  const error = () => {
    message.error("Giriş başarısız");
  };

  const onFinish = async (values) => {
    const user = {
      username: values.username,
      password: values.password,
    };

    try {
      const response = await axios.post("http://localhost:5033/api/Players/PlayerLogin", user);
      const data = response.data;
      if (!data) {
        error();
        return;
      }

      localStorage.setItem("user", JSON.stringify(data));
      success();

      setTimeout(() => {
        if (data.isAdmin === 1) {
          navigate("/AdminPanel", { state: { user: data } });
        } else {
          navigate("/home", { state: { user: data } });
        }
      }, 1500);
    } catch (err) {
      error();
      console.error(err);
    }
  };

  const renderForm = (
    <div className="login-background">      
      <img src={Logo} alt="Logo" className="logo" />
      <Card className="login-card">
        <div className="login-header">
          <h1 className="login-title">Log In</h1>
        </div>
        <Form
          name="normal_login"
          className="login-form"
          initialValues={{
            remember: true,
          }}
          onFinish={onFinish}
        >
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: "Lütfen Kullanıcı adınızı giriniz!",
              },
            ]}
          >
            <Input
              style={{
                borderRadius: "1.2rem",
                color: "#0f0e0f",
                fontSize: "bold",
              }}
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="Kullanıcı Adı"
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: "Lütfen Şifrenizi Giriniz!",
              },
            ]}
          >
            <Input.Password
              style={{ borderRadius: "1.2rem", color: "#0f0e0f" }}
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="Şifre"
              iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Form.Item>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Beni Hatırla</Checkbox>
            </Form.Item>
            <Link to="#">Parolanızı mı unuttunuz?</Link>
          </Form.Item>
          <Form.Item>
            <Form.Item className="register-button">
              <Button type="primary" htmlType="submit">
                Giriş Yap
              </Button>
            </Form.Item>
            <div className="divider"></div> {/* Beyaz çizgi */}
            Veya <Link to="/register">Şimdi Üye Ol!</Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );

  return (
    <div className="login">
      <Row
        type="flex"
        justify="center"
        align="middle"
        style={{ minHeight: "100vh" }}
      >
        <Col>{renderForm}</Col>
      </Row>
    </div>
  );
};

export default UserLogin;