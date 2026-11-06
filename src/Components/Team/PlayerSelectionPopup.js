import React, { useEffect, useMemo, useState } from 'react';
import { App, Input, Modal, Table, Typography } from 'antd';
import { SearchOutlined, StarFilled } from '@ant-design/icons';
import { api } from '../../api/config';
import { PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';

const { Text } = Typography;

/** Oyuncu seçim tablosu: takım oluşturma ve kadro düzenlemede ortak kullanılır */
export function PlayerPickerTable({ players, selected, onChange, loading, height = 420 }) {
  const [search, setSearch] = useState('');
  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => !q || fullName(p).toLowerCase().includes(q) || (p.userName || '').toLowerCase().includes(q));
  }, [players, search]);

  return (
    <>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Oyuncu ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="playerId"
        size="small"
        loading={loading}
        dataSource={data}
        pagination={false}
        scroll={{ y: height }}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => onChange(keys), preserveSelectedRowKeys: true }}
        onRow={(p) => ({
          onClick: () =>
            onChange(selected.includes(p.playerId) ? selected.filter((id) => id !== p.playerId) : [...selected, p.playerId]),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: 'Oyuncu',
            render: (_, p) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayerAvatar player={p} size={32} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
                  <Text>{fullName(p)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>@{p.userName}</Text>
                </div>
              </div>
            ),
          },
          { title: 'Yaş', dataIndex: 'age', width: 70, sorter: (a, b) => a.age - b.age, responsive: ['sm'] },
          {
            title: 'Puan',
            dataIndex: 'userScore',
            width: 90,
            sorter: (a, b) => a.userScore - b.userScore,
            render: (v) => (
              <span style={{ color: 'var(--mb-gold)' }}>
                <StarFilled /> {v ?? 0}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}

/** Mevcut takımın kadrosunu düzenleme penceresi */
const PlayerSelectionPopup = ({ visible, onClose, team, onSave }) => {
  const { message } = App.useApp();
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(team?.playerId || []);
    setLoading(true);
    api
      .get('/api/Players/GetPlayerList')
      .then((r) => setPlayers((r.data || []).filter((p) => p.isAdmin !== 1)))
      .catch((e) => message.error(apiErrorMessage(e, 'Oyuncular yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [visible, team, message]);

  const save = async () => {
    if (selected.length === 0) {
      message.warning('Takımda en az bir oyuncu olmalı.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/Team/SaveTeamByPlayerId', { teamId: team.teamId, playerIds: selected });
      message.success('Kadro güncellendi.');
      onSave?.();
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Kadro güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Kadroyu düzenle · ${team?.teamName || ''}`}
      open={visible}
      onCancel={onClose}
      onOk={save}
      okText={`Kaydet (${selected.length} oyuncu)`}
      cancelText="Vazgeç"
      confirmLoading={saving}
      width={640}
      destroyOnClose
    >
      <PlayerPickerTable players={players} selected={selected} onChange={setSelected} loading={loading} height={360} />
    </Modal>
  );
};

export default PlayerSelectionPopup;
