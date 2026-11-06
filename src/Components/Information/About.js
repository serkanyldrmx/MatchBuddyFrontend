import React from 'react';
import { Avatar, Button, Card, Col, Descriptions, Row, Space, Statistic, Typography } from 'antd';
import {
  EnvironmentOutlined,
  GithubOutlined,
  InfoCircleOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import { PageHeader } from '../../ui';
import SerkanYildirim from './SerkanYildirim.jpg';
import Logo from '../../images/mutch_buddy_Logo.png';

const { Title, Paragraph, Text } = Typography;

const TEAM = [
  { name: 'Serkan Yıldırım', role: 'Kurucu & Geliştirici, UI/UX Tasarımcı, Backend Geliştirici', photo: SerkanYildirim },
  { name: 'Diğer Üye', role: 'Frontend Geliştirici', photo: SerkanYildirim },
];

const STATS = [
  { title: 'Kayıtlı Kullanıcı', value: '10,000+' },
  { title: 'Organize Edilen Maç', value: '5,000+' },
  { title: 'Takım', value: '1,000+' },
];

const SOCIAL = [
  { href: 'https://www.linkedin.com/in/serkan-y%C4%B1ld%C4%B1r%C4%B1m-558571222/', icon: <LinkedinOutlined />, label: 'LinkedIn' },
  { href: 'https://github.com/serkanyldrmx', icon: <GithubOutlined />, label: 'GitHub' },
  { href: 'https://www.youtube.com/', icon: <YoutubeOutlined />, label: 'YouTube' },
];

const About = () => (
  <>
    <PageHeader title="Hakkında" subtitle="MatchBuddy ve ekibi hakkında" icon={<InfoCircleOutlined />} />
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card bordered={false}>
          <Space size={20} align="center" wrap>
            <Avatar src={Logo} size={72} shape="square" style={{ background: '#fff' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                MatchBuddy
              </Title>
              <Text type="secondary">Halı saha arkadaşını bul, eğlenceye katıl!</Text>
            </div>
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card bordered={false} title="Biz Kimiz?" style={{ height: '100%' }}>
          <Paragraph style={{ margin: 0 }}>
            MatchBuddy, halı saha maçı yapmak isteyen ancak takım arkadaşlarını bulmakta zorlanan kişiler için
            oluşturulmuş bir sosyal platformdur. Amacımız, insanların hem spor yapmasını hem de sosyalleşmesini
            desteklemektir.
          </Paragraph>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card bordered={false} title="Misyonumuz" style={{ height: '100%' }}>
          <Paragraph style={{ margin: 0 }}>
            Takım ruhunu desteklemek, spor yapmayı teşvik etmek ve insanları bir araya getirerek unutulmaz anılar
            yaratmak. Halı saha maçlarını daha eğlenceli ve erişilebilir hale getiriyoruz.
          </Paragraph>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card bordered={false} title="Ekibimiz" style={{ height: '100%' }}>
          <Row gutter={[16, 16]}>
            {TEAM.map((m) => (
              <Col xs={24} sm={12} key={m.name}>
                <Space align="start" size={14}>
                  <Avatar src={m.photo} size={64} />
                  <div>
                    <Text strong>{m.name}</Text>
                    <br />
                    <Text type="secondary">{m.role}</Text>
                  </div>
                </Space>
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card bordered={false} title="İstatistikler" style={{ height: '100%' }}>
          <Row gutter={16}>
            {STATS.map((s) => (
              <Col span={8} key={s.title}>
                <Statistic title={s.title} value={s.value} />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>

      <Col xs={24}>
        <Card bordered={false} title="Bize Ulaşın">
          <Descriptions column={{ xs: 1, md: 3 }} size="small">
            <Descriptions.Item label={<PhoneOutlined />}>
              <a href="tel:+905455218249">+90 545 521 82 49</a>
            </Descriptions.Item>
            <Descriptions.Item label={<MailOutlined />}>
              <a href="mailto:bmserkanyildirim@matchbuddy.com">bmserkanyildirim@matchbuddy.com</a>
            </Descriptions.Item>
            <Descriptions.Item label={<EnvironmentOutlined />}>
              Coşandere Cd. No:3 Bosna Hersek, 42250 Selçuklu/Konya
            </Descriptions.Item>
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            İlişkin güncel haberler için bizi sosyal medya hesaplarımızdan takip edin.
          </Paragraph>
          <Space wrap>
            {SOCIAL.map((s) => (
              <Button key={s.label} icon={s.icon} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </Button>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
    <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
      &copy; 2024 MatchBuddy. Tüm hakları saklıdır.
    </Paragraph>
  </>
);

export default About;
