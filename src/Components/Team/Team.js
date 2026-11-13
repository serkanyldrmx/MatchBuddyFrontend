import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Dropdown, Input, Segmented, Skeleton, Tooltip, Typography } from 'antd';
import { CrownOutlined, DeleteOutlined, EditOutlined, LogoutOutlined, MoreOutlined, PlusOutlined, RobotOutlined, SearchOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, getCurrentUser } from '../../utils/format';
import PlayerSelectionPopup from './PlayerSelectionPopup';
import InviteModal from '../Invites/InviteModal';
import './Team.css';

const { Text, Title } = Typography;

// GetTeamList cevabı oyuncuları paralel diziler olarak döner; tek listeye çevir
const membersOf = (team) =>
  (team.playerId || []).map((id, i) => ({
    playerId: id,
    userName: team.playerName?.[i],
    playerName: team.playerName?.[i],
    profilePictureUrl: team.profilePictureUrl?.[i],
  }));

const Team = () => {
  const { message, modal } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/api/Team/GetTeamList')
      .then((r) => {
        const data = r.data || [];
        setTeams(data);
        // Kullanıcının hiç takımı yoksa doğrudan tüm takımları göster
        const myId = getCurrentUser()?.playerId;
        if (!data.some((t) => (t.playerId || []).includes(myId))) setTab('all');
      })
      .catch((e) => message.error(apiErrorMessage(e, t('team:list.loadError'))))
      .finally(() => setLoading(false));
  }, [message, t]);

  useEffect(() => {
    load();
  }, [load]);

  const isMember = (t) => (t.playerId || []).includes(me?.playerId);
  // Silme / kadro düzenleme kurucuya ait; kurucusu bilinmeyen eski takımlarda her üye (sunucu kuralıyla aynı)
  const isCreator = (t) => (t.createdByPlayerId ? t.createdByPlayerId === me?.playerId : isMember(t));
  const canManage = (t) => me?.isAdmin === 1 || isCreator(t);
  const myCount = teams.filter(isMember).length;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams
      .filter((t) => (tab === 'mine' ? isMember(t) : true))
      .filter((t) => !q || (t.teamName || '').toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, tab, search]);

  const remove = (team) =>
    modal.confirm({
      title: t('team:list.deleteConfirm.title'),
      content: t('team:list.deleteConfirm.content', { name: team.teamName }),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await api.post(`/api/Team/DeleteTeam?teamId=${team.teamId}`);
          message.success(t('team:list.deleteSuccess'));
          setTeams((ts) => ts.filter((t) => t.teamId !== team.teamId));
        } catch (e) {
          message.error(apiErrorMessage(e, t('team:list.deleteError')));
        }
      },
    });

  const leave = (team) => {
    const othersLeft = (team.playerId || []).length > 1;
    const creator = team.createdByPlayerId === me?.playerId;
    modal.confirm({
      title: t('team:list.leaveConfirm.title'),
      content: creator && othersLeft
        ? t('team:list.leaveConfirm.creator', { name: team.teamName })
        : t('team:list.leaveConfirm.content', { name: team.teamName }),
      okText: t('team:list.leave'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await api.post(`/api/Team/LeaveTeam?teamId=${team.teamId}`);
          message.success(t('team:list.leaveSuccess', { name: team.teamName }));
          load();
        } catch (e) {
          message.error(apiErrorMessage(e, t('team:list.leaveError')));
        }
      },
    });
  };

  return (
    <>
      <PageHeader
        title={t('team:list.title')}
        subtitle={t('team:list.subtitle')}
        icon={<TeamOutlined />}
        extra={[
          <Button key="ai" icon={<RobotOutlined />} onClick={() => navigate('/teamAICreate')}>
            {t('team:list.createWithAI')}
          </Button>,
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-team')}>
            {t('team:list.create')}
          </Button>,
        ]}
      />

      <Card bordered={false} className="mb-toolbar-card" style={{ marginBottom: 16 }}>
        <div className="mb-toolbar">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { label: t('team:list.tabs.mine', { count: myCount }), value: 'mine' },
              { label: t('team:list.tabs.all', { count: teams.length }), value: 'all' },
            ]}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('team:list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </Card>

      {loading ? (
        <div className="mb-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i} bordered={false}>
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card bordered={false}>
          <EmptyState description={tab === 'mine' ? t('team:list.emptyMine') : t('team:list.empty')}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-team')}>
              {t('team:list.create')}
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="mb-grid">
          {list.map((team) => {
            const members = membersOf(team);
            return (
              <Card key={team.teamId} bordered={false} className="mb-team-tile">
                <div className="mb-team-tile__head">
                  <div className="mb-team-tile__logo">{(team.teamName || '?').charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Title level={5} style={{ margin: 0 }} ellipsis>
                      {team.teamName}
                    </Title>
                    <Text type="secondary">{t('team:list.players', { count: members.length })}</Text>
                  </div>
                  {(canManage(team) || isMember(team)) && (
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          ...(isMember(team)
                            ? [{ key: 'invite', icon: <SendOutlined />, label: t('team:list.invite'), onClick: () => setInviting(team) }]
                            : []),
                          ...(canManage(team)
                            ? [{ key: 'edit', icon: <EditOutlined />, label: t('team:list.editSquad'), onClick: () => setEditing(team) }]
                            : []),
                          { type: 'divider' },
                          ...(isMember(team) && (team.playerId || []).length > 1
                            ? [{ key: 'leave', icon: <LogoutOutlined />, label: t('team:list.leave'), danger: true, onClick: () => leave(team) }]
                            : []),
                          ...(canManage(team)
                            ? [{ key: 'delete', icon: <DeleteOutlined />, label: t('team:list.deleteConfirm.title'), danger: true, onClick: () => remove(team) }]
                            : []),
                        ],
                      }}
                    >
                      <Button type="text" icon={<MoreOutlined />} aria-label={t('team:list.actions')} />
                    </Dropdown>
                  )}
                </div>

                <Avatar.Group max={{ count: 6 }} size={34}>
                  {members.map((m) => (
                    <Tooltip key={m.playerId} title={`@${m.userName}`}>
                      <PlayerAvatar player={m} size={34} />
                    </Tooltip>
                  ))}
                </Avatar.Group>

                <div className="mb-team-tile__members">
                  {members.slice(0, 4).map((m) => (
                    <Text key={m.playerId} type="secondary" className="mb-team-tile__member">
                      @{m.userName}
                      {m.playerId === me?.playerId && t('team:list.youSuffix')}
                      {m.playerId === team.createdByPlayerId && (
                        <Tooltip title={t('team:list.creator')}>
                          <CrownOutlined style={{ color: 'var(--mb-gold)', marginLeft: 4 }} aria-label={t('team:list.creator')} />
                        </Tooltip>
                      )}
                    </Text>
                  ))}
                  {members.length > 4 && <Text type="secondary">{t('team:list.morePlayers', { count: members.length - 4 })}</Text>}
                  {members.length === 0 && <Text type="secondary">{t('team:list.emptySquad')}</Text>}
                </div>

                {(canManage(team) || isMember(team)) && (
                  <div className="mb-team-tile__actions" style={{ display: 'flex', gap: 8 }}>
                    {canManage(team) && (
                      <Button block icon={<EditOutlined />} onClick={() => setEditing(team)}>
                        {t('team:list.editSquad')}
                      </Button>
                    )}
                    {isMember(team) && (
                      <Button block icon={<SendOutlined />} onClick={() => setInviting(team)}>
                        {t('team:list.invite')}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <InviteModal
        open={!!inviting}
        onClose={() => setInviting(null)}
        kind="team"
        targetId={inviting?.teamId}
        title={inviting?.teamName}
      />
      <PlayerSelectionPopup visible={!!editing} team={editing} onClose={() => setEditing(null)} onSave={load} />
    </>
  );
};

export default Team;
