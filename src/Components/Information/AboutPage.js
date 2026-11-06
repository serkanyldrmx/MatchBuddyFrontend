import React from 'react';
import { Button, Card, Col, Image, List, Row, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PageHeader } from '../../ui';
import aboutImage from '../../images/top.png';
import mackolikIcon from '../../images/Mackolik.png';
import sosyalHalisahaIcon from '../../images/sosyal_Halısaha.png';
import beinSports from '../../images/bein_Sports.png';
import varSistemi from '../../images/varSistemi.png';

const { Title, Paragraph, Text } = Typography;

const ADVANTAGES = [
  'Kolay rezervasyon yönetimi',
  'Ekipler arasında hızlı iletişim',
  'Güvenilir saha bilgisi ve fiyatlandırma',
];

const FEATURES = [
  { icon: <ThunderboltOutlined />, title: 'Hızlı Rezervasyon', text: 'Halı saha rezervasyonlarınızı birkaç tıkla yapabilirsiniz.' },
  { icon: <TeamOutlined />, title: 'Takım Yönetimi', text: 'Takım arkadaşlarınızı kolayca ekleyin ve organize olun.' },
  { icon: <SafetyCertificateOutlined />, title: 'Güvenilir Bilgi', text: 'Halı saha bilgilerine ve kullanıcı yorumlarına anında erişin.' },
];

const LINKS = [
  { href: 'https://www.mackolik.com', icon: mackolikIcon, label: 'Mackolik' },
  { href: 'https://www.sosyalhalisaha.com', icon: sosyalHalisahaIcon, label: 'Sosyal Halısaha' },
  { href: 'https://beinsports.com.tr', icon: beinSports, label: 'Bein Sports' },
  { href: 'https://varsistemi.com', icon: varSistemi, label: 'Var Sistemi' },
];

function AboutPage() {
  return (
    <>
      <PageHeader
        title="Hakkımızda"
        subtitle="Match Buddy, spor severlerin halı saha rezervasyonlarını kolaylaştırmak ve ekipler arasında iletişim kurmalarını sağlamak için tasarlanmış bir platformdur."
        icon={<InfoCircleOutlined />}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card bordered={false}>
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} md={9} style={{ textAlign: 'center' }}>
                <Image src={aboutImage} alt="Match Buddy" preview={false} style={{ maxHeight: 220, objectFit: 'contain' }} />
              </Col>
              <Col xs={24} md={15}>
                <Title level={4}>Amacımız</Title>
                <Paragraph>
                  Sporun birleştirici gücüne inanıyoruz. Kullanıcılarımızın daha kolay maç organize edebilmeleri,
                  ekiplerini oluşturabilmeleri ve eğlenceli bir deneyim yaşamaları için buradayız.
                </Paragraph>
                <Title level={4}>Avantajlarımız</Title>
                <List
                  split={false}
                  dataSource={ADVANTAGES}
                  renderItem={(a) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Space>
                        <CheckCircleOutlined style={{ color: 'var(--mb-pitch)' }} />
                        <Text>{a}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {FEATURES.map((f) => (
          <Col xs={24} md={8} key={f.title}>
            <Card bordered={false} style={{ height: '100%' }}>
              <Space direction="vertical" size={8}>
                <span className="mb-page-header__icon">{f.icon}</span>
                <Text strong style={{ fontSize: 16 }}>
                  {f.title}
                </Text>
                <Text type="secondary">{f.text}</Text>
              </Space>
            </Card>
          </Col>
        ))}

        <Col xs={24}>
          <Card bordered={false} title="Diğer Maç Siteleri">
            <Space wrap size={12}>
              {LINKS.map((l) => (
                <Button
                  key={l.label}
                  size="large"
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<img src={l.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
                >
                  {l.label}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default AboutPage;
