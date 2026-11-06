import { Button, Form, Input, Select, Row, Col, message, Checkbox, Upload } from "antd";
import { LockOutlined, UserOutlined, MailOutlined, HomeOutlined, NumberOutlined, UploadOutlined, ColumnHeightOutlined, DashboardOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import React, { useRef, useState } from "react";
import AuthShell from "./AuthShell";
import { api } from '../../api/config';
import ImageCrop from "../../ui/ImageCrop";
import { ACCEPTED_IMAGE_ACCEPT, imageError, prepareImage } from "../../utils/image";

const { Option } = Select;

const RegisterForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);
  const rejectedRef = useRef(null); // kırpma öncesi reddedilen dosya

  const success = () => {
    message.success("Kayıt başarılı, yönlendiriliyor");
  };

  const error = (errorMessage) => {
    message.error(errorMessage || "Kayıt başarısız");
  };

  const onFinish = async (values) => {
    const formData = new FormData();

    // PlayerModel verilerini hazırla
    const playerModel = {
      playerName: values.name,
      playerSurname: values.lastName,
      userName: values.username,
      email: values.email,
      phoneNumber: "0" + values.phone,
      password: values.password,
      address: values.address,
      size: parseFloat(values.size),
      weight: parseFloat(values.weight),
      age: parseInt(values.age),
      matchNotificationPermission: values.matchNotificationPermission ? 1 : 0,
      userScore: 0,
    };

    // PlayerModel'i FormData'ya ekle
    formData.append("playerModel", JSON.stringify(playerModel));

    // Fotoğrafı ekle (varsa)
    if (fileList.length > 0) {
      // Kırpılmış fotoğrafı tarayıcıda küçült (başarısız olursa orijinal gönderilir)
      formData.append("profilePicture", await prepareImage(fileList[0]));
    }

    try {
      // Verileri ve fotoğrafı SavePlayer endpoint'ine gönder
      console.log("Sending FormData:", formData);
      const response = await api.post("/api/Players/SavePlayer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Response:", response.data);
      success();
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      // Extract error message
      let errorMessage = "Kayıt başarısız";
      if (err.response?.data) {
        if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.errors) {
          // Handle validation errors
          errorMessage = Object.values(err.response.data.errors)
            .flat()
            .join(", ");
        } else if (err.response.data.title) {
          errorMessage = err.response.data.title;
        }
      } else {
        errorMessage = err.message;
      }
      console.error("Error:", err.response?.data || err.message);
      error(errorMessage);
    }
  };

  const prefixSelector = (
    <Form.Item name="prefix" noStyle initialValue="90">
      <Select style={{ width: 70 }}>
        <Option value="90">+90</Option>
        <Option value="80">+80</Option>
        <Option value="70">+70</Option>
      </Select>
    </Form.Item>
  );

  // Kırpmadan önce tür/boyut kontrolü; uygun değilse kırpma penceresi açılmaz
  const beforeCrop = (file) => {
    const err = imageError(file);
    if (!err) return true;
    message.error(err);
    rejectedRef.current = file;
    return false;
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      if (file === rejectedRef.current) {
        rejectedRef.current = null;
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false;
    },
    fileList,
  };

  return (
    <AuthShell
      wide
      title={<>Kadroya <em>katıl</em></>}
      subtitle="Profilini oluştur, takımını kur ve ilk maçına çık."
    >
      <Form
        layout="vertical"
        form={form}
        name="register"
        className="mb-auth__form"
        onFinish={onFinish}
        initialValues={{ prefix: "90" }}
        scrollToFirstError
      >
        <h3 className="mb-auth__section"><span>01</span> Hesap</h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="username"
              label="Kullanıcı adı"
              rules={[{ required: true, message: "Lütfen kullanıcı adınızı girin!" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Kullanıcı Adı" autoComplete="username" autoCapitalize="none" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label="E-posta"
              rules={[
                { type: "email", message: "Giriş geçerli değil E-mail!" },
                { required: true, message: "Lütfen E-posta adresinizi giriniz!" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="E-mail" inputMode="email" autoComplete="email" autoCapitalize="none" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="password"
              label="Şifre"
              rules={[{ required: true, message: "Lütfen şifrenizi giriniz!" }]}
              hasFeedback
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Şifre" autoComplete="new-password" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="confirm"
              label="Şifre tekrar"
              dependencies={["password"]}
              hasFeedback
              rules={[
                { required: true, message: "Lütfen şifrenizi doğrulayınız!" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Girdiğiniz iki şifre eşleşmiyor!"));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Şifreyi Onayla" autoComplete="new-password" />
            </Form.Item>
          </Col>
        </Row>

        <h3 className="mb-auth__section"><span>02</span> Kişisel</h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="İsim"
              tooltip="Başkalarının sana ne demesini istiyorsun?"
              rules={[{ required: true, message: "Lütfen Tam Adınızı girin!", whitespace: true }]}
            >
              <Input prefix={<UserOutlined />} placeholder="İsim" autoComplete="given-name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="lastName"
              label="Soyisim"
              rules={[{ required: true, message: "Lütfen Soyadınızı girin!" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Soyisim" autoComplete="family-name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label="Telefon"
              rules={[{ required: true, message: "Lütfen telefon numaranızı giriniz!" }]}
            >
              <Input
                addonBefore={prefixSelector}
                style={{ width: "100%" }}
                placeholder="Telefon Numarası"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="address"
              label="Adres"
              rules={[{ required: true, message: "Lütfen adresinizi girin!" }]}
            >
              <Input prefix={<HomeOutlined />} placeholder="Adres" autoComplete="address-level2" />
            </Form.Item>
          </Col>
        </Row>

        <h3 className="mb-auth__section"><span>03</span> Fiziksel / Oyun</h3>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="size"
              label="Boy"
              rules={[{ required: true, message: "Lütfen boyunuzu girin!" }]}
            >
              <Input prefix={<ColumnHeightOutlined />} placeholder="Boy (cm)" inputMode="decimal" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="weight"
              label="Kilo"
              rules={[{ required: true, message: "Lütfen kilonuzu girin!" }]}
            >
              <Input prefix={<DashboardOutlined />} placeholder="Kilo (kg)" inputMode="decimal" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="age"
              label="Yaş"
              rules={[{ required: true, message: "Lütfen yaşınızı girin!" }]}
            >
              <Input prefix={<NumberOutlined />} placeholder="Yaş" inputMode="numeric" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="profilePicture" label="Profil fotoğrafı" rules={[{ required: false }]}>
              <ImageCrop variant="avatar" beforeCrop={beforeCrop}>
                <Upload {...uploadProps} accept={ACCEPTED_IMAGE_ACCEPT} maxCount={1}>
                  <Button icon={<UploadOutlined />} className="mb-auth__upload">Fotoğraf Yükle</Button>
                </Upload>
              </ImageCrop>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="matchNotificationPermission" valuePropName="checked" label="Bildirimler">
              <Checkbox className="mb-auth__check">Maç Bildirim İzni</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item className="mb-auth__submit">
          <Button type="primary" htmlType="submit" size="large" block>
            Kayıt Ol
          </Button>
        </Form.Item>
      </Form>
      <p className="mb-auth__switch">
        Zaten hesabın var mı? <Link to="/" className="mb-auth__link">Giriş yap</Link>
      </p>
    </AuthShell>
  );
};

export default RegisterForm;
