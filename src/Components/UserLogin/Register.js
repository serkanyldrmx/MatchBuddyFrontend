import { Button, Form, Input, Select, Row, Col, message, Checkbox, Upload } from "antd";
import { LockOutlined, UserOutlined, MailOutlined, HomeOutlined, NumberOutlined, UploadOutlined, ColumnHeightOutlined, DashboardOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import React, { useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import AuthShell from "./AuthShell";
import { api } from '../../api/config';
import { apiErrorMessage } from '../../utils/format';
import ImageCrop from "../../ui/ImageCrop";
import { ACCEPTED_IMAGE_ACCEPT, imageError, prepareImage } from "../../utils/image";

const { Option } = Select;

const RegisterForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);
  const rejectedRef = useRef(null); // kırpma öncesi reddedilen dosya
  const { t } = useTranslation();

  const success = () => {
    message.success(t('auth:register.success'));
  };

  const error = (errorMessage) => {
    message.error(errorMessage || t('auth:register.failed'));
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
      let errorMessage = t('auth:register.failed');
      if (err.response?.data) {
        if (err.response.data.code || err.response.data.Code) {
          // Sunucu hata kodu varsa errors namespace'inden çevrilir
          errorMessage = apiErrorMessage(err, t('auth:register.failed'));
        } else if (err.response.data.message) {
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
      title={<Trans i18nKey="auth:register.title" components={{ em: <em /> }} />}
      subtitle={t('auth:register.subtitle')}
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
        <h3 className="mb-auth__section"><span>01</span> {t('auth:register.sections.account')}</h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="username"
              label={t('auth:register.username')}
              rules={[{ required: true, message: t('auth:register.usernameRequired') }]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('auth:register.usernamePlaceholder')} autoComplete="username" autoCapitalize="none" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label={t('auth:register.email')}
              rules={[
                { type: "email", message: t('auth:register.emailInvalid') },
                { required: true, message: t('auth:register.emailRequired') },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder={t('auth:register.emailPlaceholder')} inputMode="email" autoComplete="email" autoCapitalize="none" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="password"
              label={t('auth:register.password')}
              rules={[{ required: true, message: t('auth:register.passwordRequired') }]}
              hasFeedback
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth:register.passwordPlaceholder')} autoComplete="new-password" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="confirm"
              label={t('auth:register.confirmPassword')}
              dependencies={["password"]}
              hasFeedback
              rules={[
                { required: true, message: t('auth:register.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('auth:register.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth:register.confirmPasswordPlaceholder')} autoComplete="new-password" />
            </Form.Item>
          </Col>
        </Row>

        <h3 className="mb-auth__section"><span>02</span> {t('auth:register.sections.personal')}</h3>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={t('auth:register.name')}
              tooltip={t('auth:register.nameTooltip')}
              rules={[{ required: true, message: t('auth:register.nameRequired'), whitespace: true }]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('auth:register.namePlaceholder')} autoComplete="given-name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="lastName"
              label={t('auth:register.lastName')}
              rules={[{ required: true, message: t('auth:register.lastNameRequired') }]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('auth:register.lastNamePlaceholder')} autoComplete="family-name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label={t('auth:register.phone')}
              rules={[{ required: true, message: t('auth:register.phoneRequired') }]}
            >
              <Input
                addonBefore={prefixSelector}
                style={{ width: "100%" }}
                placeholder={t('auth:register.phonePlaceholder')}
                inputMode="tel"
                autoComplete="tel-national"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="address"
              label={t('auth:register.address')}
              rules={[{ required: true, message: t('auth:register.addressRequired') }]}
            >
              <Input prefix={<HomeOutlined />} placeholder={t('auth:register.addressPlaceholder')} autoComplete="address-level2" />
            </Form.Item>
          </Col>
        </Row>

        <h3 className="mb-auth__section"><span>03</span> {t('auth:register.sections.physical')}</h3>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="size"
              label={t('auth:register.height')}
              rules={[{ required: true, message: t('auth:register.heightRequired') }]}
            >
              <Input prefix={<ColumnHeightOutlined />} placeholder={t('auth:register.heightPlaceholder')} inputMode="decimal" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="weight"
              label={t('auth:register.weight')}
              rules={[{ required: true, message: t('auth:register.weightRequired') }]}
            >
              <Input prefix={<DashboardOutlined />} placeholder={t('auth:register.weightPlaceholder')} inputMode="decimal" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="age"
              label={t('auth:register.age')}
              rules={[{ required: true, message: t('auth:register.ageRequired') }]}
            >
              <Input prefix={<NumberOutlined />} placeholder={t('auth:register.agePlaceholder')} inputMode="numeric" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="profilePicture" label={t('auth:register.profilePicture')} rules={[{ required: false }]}>
              <ImageCrop variant="avatar" beforeCrop={beforeCrop}>
                <Upload {...uploadProps} accept={ACCEPTED_IMAGE_ACCEPT} maxCount={1}>
                  <Button icon={<UploadOutlined />} className="mb-auth__upload">{t('auth:register.uploadPhoto')}</Button>
                </Upload>
              </ImageCrop>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="matchNotificationPermission" valuePropName="checked" label={t('auth:register.notifications')}>
              <Checkbox className="mb-auth__check">{t('auth:register.matchNotificationPermission')}</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item className="mb-auth__submit">
          <Button type="primary" htmlType="submit" size="large" block>
            {t('auth:register.submit')}
          </Button>
        </Form.Item>
      </Form>
      <p className="mb-auth__switch">
        {t('auth:register.haveAccount')} <Link to="/" className="mb-auth__link">{t('auth:register.signIn')}</Link>
      </p>
    </AuthShell>
  );
};

export default RegisterForm;
