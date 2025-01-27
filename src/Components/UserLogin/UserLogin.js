import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, Row, Col, message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect } from "react";
import "./Login.css";
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
              color: "#f4a261",
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
          <Input
            style={{ borderRadius: "1.2rem", color: "#f4a261" }}
            prefix={<LockOutlined className="site-form-item-icon" />}
            type="password"
            placeholder="Şifre"
          />
        </Form.Item>
        <Form.Item>
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Beni Hatırla</Checkbox>
          </Form.Item>
          <Link to="#">Parolanızı mı unuttunuz?</Link>
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="login-form-button"
            style={{ margin: "1rem" }}
          >
            Giriş Yap
          </Button>
          <Link to="/register">Şimdi Üye Ol!</Link>
        </Form.Item>
      </Form>
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
