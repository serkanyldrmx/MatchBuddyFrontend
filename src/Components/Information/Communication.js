import React from 'react';
import { App, Avatar, Button, Card, Col, Descriptions, Form, Input, Row, Space, Typography } from 'antd';
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, SendOutlined } from '@ant-design/icons';
import { PageHeader } from '../../ui';
import SerkanYildirim from './SerkanYildirim.jpg';

const { Text, Paragraph } = Typography;

const Communication = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  // Mesaj gönderimi için henüz bir servis yok; mesaj yalnızca not alınır.
  const handleFinish = () => {
    message.info('Mesajınız not alındı. Teşekkür ederiz!');
    form.resetFields();
  };

  return (
    <>
      <PageHeader
        title="Bizimle İletişime Geçin"
        subtitle="Sorularınız, önerileriniz ve görüşleriniz bizim için çok değerlidir."
        icon={<MailOutlined />}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} title="İletişim Bilgilerimiz" style={{ height: '100%' }}>
            <Space align="center" size={16} style={{ marginBottom: 20 }}>
              <Avatar src={SerkanYildirim} size={64} />
              <div>
                <Text strong>Serkan Yıldırım</Text>
                <br />
                <Text type="secondary">MatchBuddy</Text>
              </div>
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={<Space><EnvironmentOutlined />Adres</Space>}>Malazgirt, Türkiye</Descriptions.Item>
              <Descriptions.Item label={<Space><PhoneOutlined />Telefon</Space>}>
                <a href="tel:+905455218249">+90 545 521 82 49</a>
              </Descriptions.Item>
              <Descriptions.Item label={<Space><MailOutlined />E-posta</Space>}>
                <a href="mailto:bmserkanyildirim@matchbuddy.com">bmserkanyildirim@matchbuddy.com</a>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} title="Bize Ulaşın" style={{ height: '100%' }}>
            <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="name"
                    label="Adınız"
                    rules={[{ required: true, whitespace: true, message: 'Adınızı girin' }]}
                  >
                    <Input placeholder="Adınızı girin" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="E-posta"
                    rules={[
                      { required: true, message: 'E-posta adresinizi girin' },
                      { type: 'email', message: 'Geçerli bir e-posta adresi girin' },
                    ]}
                  >
                    <Input placeholder="E-posta adresinizi girin" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="message"
                label="Mesajınız"
                rules={[{ required: true, whitespace: true, message: 'Mesajınızı yazın' }]}
              >
                <Input.TextArea rows={5} placeholder="Mesajınızı yazın" maxLength={1000} showCount />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                  Gönder
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
      <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
        &copy; 2024 MatchBuddy. Tüm hakları saklıdır.
      </Paragraph>
    </>
  );
};

export default Communication;
