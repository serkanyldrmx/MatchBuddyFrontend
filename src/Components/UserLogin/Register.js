import { Button, Form, Input, Select, Row, Col, message, Checkbox, Card } from "antd";
import { EditOutlined, UserOutlined, MailOutlined, HomeOutlined, NumberOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import React from "react";
import "./Login.css";
import axios from 'axios';
import Logo from '../../images/mutch_buddy_Logo.png'; // Logoyu import edin

const { Option } = Select;

const formItemLayout = {
  labelCol: {
    xs: {
      span: 24,
    },
    sm: {
      span: 4,
    },
  },
  wrapperCol: {
    xs: {
      span: 24,
    },
    sm: {
      span: 20,
    },
  },
};

const RegisterForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const success = () => {
    message.success("Kayıt başarılı, yönlendiriliyorsunuz");
  };
  const error = () => {
    message.error("Kayıt başarısız");
  };

  const onFinish = (values) => {
    const user = {
      playerName: values.name,
      playerSurname: values.lastName,
      username: values.username,
      email: values.email,
      phoneNumber: "0" + values.phone,
      password: values.password,
      address: values.address,
      size: values.size,
      weight: values.weight,
      age: values.age,
      matchNotificationPermission: values.matchNotificationPermission ? 1 : 0,
      userScore: 0
    };

    axios
      .post("http://localhost:5033/api/Players/SavePlayer", user)
      .then((response) => {
        console.log(response);
        success();
        setTimeout(() => {
          navigate("/");
        }, 1500);
      })
      .catch((err) => {
        console.log(err);
        error();
      });
  };

  const prefixSelector = (
    <Form.Item name="prefix" noStyle>
      <Select
        style={{
          width: 70,
        }}
      >
        <Option value="90">+90</Option>
        <Option value="80">+80</Option>
        <Option value="70">+70</Option>
      </Select>
    </Form.Item>
  );

  const renderRegister = (
    <Card className="register-card">
      <div className="register-header">
        <img src={Logo} alt="Logo" className="logo-reg" />
        <h1 className="register-title">Register</h1>
      </div>
      <Form
        {...formItemLayout}
        form={form}
        name="register"
        className="register-form"
        onFinish={onFinish}
        initialValues={{
          prefix: "90",
        }}
        scrollToFirstError
      >
        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="name"
              tooltip="Başkalarının sana ne demesini istiyorsun?"
              rules={[
                {
                  required: true,
                  message: "Lütfen Tam Adınızı girin!",
                  whitespace: true,
                },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="İsim" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="lastName"
              rules={[
                {
                  required: true,
                  message: "Lütfen Soyadınızı girin!",
                },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="Soyisim" className="input-large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              rules={[
                {
                  type: "email",
                  message: "Giriş geçerli değil E-mail!",
                },
                {
                  required: true,
                  message: "Lütfen E-posta adresinizi giriniz!",
                },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="E-mail" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              rules={[
                {
                  required: true,
                  message: "Lütfen telefon numaranızı giriniz!",
                },
              ]}
            >
              <Input
                addonBefore={prefixSelector}
                style={{
                  width: "100%",
                }}
                placeholder="Telefon Numarası"
                className="input-large"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="address"
              rules={[
                {
                  required: true,
                  message: "Lütfen adresinizi girin!",
                },
              ]}
            >
              <Input prefix={<HomeOutlined />} placeholder="Adres" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="size"
              rules={[
                {
                  required: true,
                  message: "Lütfen boyunuzu girin!",
                },
              ]}
            >
              <Input prefix={<NumberOutlined />} placeholder="Boy (cm)" className="input-large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="weight"
              rules={[
                {
                  required: true,
                  message: "Lütfen kilonuzu girin!",
                },
              ]}
            >
              <Input prefix={<NumberOutlined />} placeholder="Kilo (kg)" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="age"
              rules={[
                {
                  required: true,
                  message: "Lütfen yaşınızı girin!",
                },
              ]}
            >
              <Input prefix={<NumberOutlined />} placeholder="Yaş" className="input-large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="username"
              rules={[
                {
                  required: true,
                  message: "Lütfen kullanıcı adınızı girin!",
                },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="Kullanıcı Adı" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="matchNotificationPermission" valuePropName="checked">
              <Checkbox>Maç Bildirim İzni</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} justify="center">
          <Col xs={24} sm={12}>
            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: "Lütfen şifrenizi giriniz!",
                },
              ]}
              hasFeedback
            >
              <Input.Password prefix={<EditOutlined />} placeholder="Şifre" className="input-large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="confirm"
              dependencies={["password"]}
              hasFeedback
              rules={[
                {
                  required: true,
                  message: "Lütfen şifrenizi doğrulayınız!",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error("Girdiğiniz iki şifre eşleşmiyor!")
                    );
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<EditOutlined />}
                placeholder="Şifreyi Onayla"
                className="input-large"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item className="register-button">
          <Button type="primary" htmlType="submit">
            Kayıt Ol
          </Button>
        </Form.Item>
        <hr />
        Veya <Link to="/">Oturum Açmaya Git</Link>
      </Form>
    </Card>
  );

  return (
    <div className="register">
      <Row
        type="flex"
        justify="center"
        align="middle"
        style={{ minHeight: "100vh" }}
      >
        <Col>{renderRegister}</Col>
      </Row>
    </div>
  );
};

export default RegisterForm;