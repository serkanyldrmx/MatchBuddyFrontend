import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Card, Col, Input, InputNumber, List, Row, Space, Spin, Statistic, Typography } from 'antd';
import { ReloadOutlined, RobotOutlined, SaveOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';
import { aiFetch, api, TEAM_AI_BASE_URL } from '../../api/config';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import './TeamAICreate.css';

const { Text } = Typography;
const total = (team) => team.reduce((s, p) => s + (p.userScore || 0), 0);

function TeamColumn({ side, name, onName, players }) {
  return (
    <Card
      bordered={false}
      className={`mb-ai-team is-${side}`}
      title={
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={side === 'home' ? '1. takımın adı' : '2. takımın adı'}
          variant="borderless"
          className="mb-ai-team__name"
          maxLength={40}
        />
      }
      extra={<Statistic value={total(players)} prefix={<StarFilled style={{ color: 'var(--mb-gold)' }} />} valueStyle={{ fontSize: 18 }} />}
    >
      <List
        dataSource={players}
        renderItem={(p) => (
          <List.Item extra={<Text type="secondary">{p.userScore ?? 0} puan</Text>}>
            <List.Item.Meta
              avatar={<PlayerAvatar player={p} size={36} />}
              title={fullName(p)}
              description={`${p.age || '-'} yaş · ${p.size || '-'} cm · ${p.weight || '-'} kg`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

function TeamAICreate() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [teamSize, setTeamSize] = useState(6);
  const [teams, setTeams] = useState({ team1: [], team2: [] });
  const [names, setNames] = useState({ team1: '', team2: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasTeams = teams.team1.length > 0;
  const diff = useMemo(() => Math.abs(total(teams.team1) - total(teams.team2)), [teams]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await aiFetch(TEAM_AI_BASE_URL, `/create-teams?teamSize=${teamSize}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text && text.length < 200 ? text : 'Takımlar oluşturulamadı.');
      }
      const data = await res.json();
      setTeams({ team1: data.team1 || [], team2: data.team2 || [] });
      message.success('Dengeli takımlar oluşturuldu.');
    } catch (e) {
      message.error(e.message === 'Failed to fetch' ? 'Yapay zeka servisine ulaşılamadı.' : e.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!names.team1.trim() || !names.team2.trim()) {
      message.warning('İki takıma da isim verin.');
      return;
    }
    setSaving(true);
    try {
      for (const key of ['team1', 'team2']) {
        await api.post('/api/Team/SaveTeam', {
          teamName: names[key].trim(),
          playerId: teams[key].map((p) => p.playerId).filter(Boolean),
        });
      }
      message.success('Takımlar kaydedildi.');
      navigate('/team');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Takımlar kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI ile takım oluştur"
        subtitle="Oyuncuların yaş, boy, kilo ve puanlarına göre birbirine denk iki takım kurulur."
        icon={<RobotOutlined />}
      />

      <Card bordered={false} style={{ marginBottom: 24 }}>
        <div className="mb-ai-settings">
          <Space align="end" wrap size={16}>
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Takım başına oyuncu</Text>
              <InputNumber min={4} max={11} value={teamSize} onChange={(v) => setTeamSize(v || 4)} style={{ width: 140 }} />
            </div>
            <Button type="primary" icon={hasTeams ? <ReloadOutlined /> : <ThunderboltOutlined />} onClick={generate} loading={loading}>
              {hasTeams ? 'Yeniden oluştur' : 'Takımları oluştur'}
            </Button>
          </Space>
          {hasTeams && (
            <Space wrap size={24}>
              <Statistic title="Puan farkı" value={diff} valueStyle={{ color: diff <= 10 ? '#22c55e' : '#fbbf24' }} />
              <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving}>
                Takımları kaydet
              </Button>
            </Space>
          )}
        </div>
      </Card>

      <Spin spinning={loading} tip="Takımlar dengeleniyor…">
        {hasTeams ? (
          <>
            {diff > 10 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Takımlar arasındaki puan farkı yüksek. Daha dengeli bir dağılım için yeniden oluşturmayı deneyin."
              />
            )}
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <TeamColumn side="home" name={names.team1} onName={(v) => setNames((n) => ({ ...n, team1: v }))} players={teams.team1} />
              </Col>
              <Col xs={24} md={12}>
                <TeamColumn side="away" name={names.team2} onName={(v) => setNames((n) => ({ ...n, team2: v }))} players={teams.team2} />
              </Col>
            </Row>
          </>
        ) : (
          <Card bordered={false}>
            <EmptyState description="Takım boyutunu seçip 'Takımları oluştur' butonuna basın" />
          </Card>
        )}
      </Spin>
    </>
  );
}

export default TeamAICreate;
