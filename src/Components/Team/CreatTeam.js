import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Col, Form, Input, Row, Space, Typography } from 'antd';
import { ArrowLeftOutlined, TeamOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, getCurrentUser } from '../../utils/format';
import { PlayerPickerTable } from './PlayerSelectionPopup';

const { Text } = Typography;

const CreateTeam = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [form] = Form.useForm();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Takımı kuran kişi varsayılan olarak takımdadır (sonradan kadroyu yönetebilmesi için)
  const [selected, setSelected] = useState(me?.playerId ? [me.playerId] : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/api/Players/GetPlayerList')
      .then((r) => setPlayers((r.data || []).filter((p) => p.isAdmin !== 1)))
      .catch((e) => message.error(apiErrorMessage(e, 'Oyuncular yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [message]);

  const selectedPlayers = players.filter((p) => selected.includes(p.playerId));

  const submit = async ({ teamName }) => {
    if (selected.length === 0) {
      message.warning('En az bir oyuncu seçin.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/Team/SaveTeam', { teamName: teamName.trim(), playerId: selected });
      if (res.data?.success === false) {
        message.error(res.data.message || 'Takım oluşturulamadı.');
        return;
      }
      message.success('Takım oluşturuldu.');
      navigate('/team');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Takım oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/team')} style={{ paddingLeft: 0, marginBottom: 8 }}>
        Takımlara dön
      </Button>
      <PageHeader title="Takım oluştur" subtitle="Takımına bir isim ver ve oyuncularını seç." icon={<TeamOutlined />} />

      <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card bordered={false} title="Takım bilgileri" style={{ position: 'sticky', top: 88 }}>
              <Form.Item
                name="teamName"
                label="Takım adı"
                rules={[
                  { required: true, whitespace: true, message: 'Takım adı zorunludur.' },
                  { min: 3, message: 'En az 3 karakter olmalıdır.' },
                ]}
              >
                <Input placeholder="Örn. Kadıköy Kartalları" maxLength={40} showCount />
              </Form.Item>

              <Text type="secondary">Seçilen oyuncular ({selected.length})</Text>
              <div style={{ margin: '8px 0 20px' }}>
                {selectedPlayers.length ? (
                  <Avatar.Group max={{ count: 8 }}>
                    {selectedPlayers.map((p) => (
                      <PlayerAvatar key={p.playerId} player={p} size={36} />
                    ))}
                  </Avatar.Group>
                ) : (
                  <Text type="secondary">Henüz oyuncu seçilmedi.</Text>
                )}
              </div>

              <Space>
                <Button onClick={() => navigate('/team')}>Vazgeç</Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Takımı oluştur
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card bordered={false} title="Oyuncular">
              <PlayerPickerTable players={players} selected={selected} onChange={setSelected} loading={loading} />
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
};

export default CreateTeam;
