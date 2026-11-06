import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Checkbox, Input, Modal, Skeleton } from 'antd';
import { SearchOutlined, SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { invitesApi, socialApi } from '../../api/social';
import { EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import './Invites.css';

/**
 * Takip ettiklerini bir maça ya da takıma davet etme penceresi.
 * kind: "match" | "team", targetId: matchId / teamId, title: maç/takım adı
 */
export default function InviteModal({ open, onClose, kind = 'match', targetId, title }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setSearch('');
    setLoading(true);
    socialApi
      .following()
      .then((list) => setPeople(list || []))
      .catch((e) => message.error(apiErrorMessage(e, 'Takip listen yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [open, message]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .filter((p) => !q || `${fullName(p)} ${p.userName || ''}`.toLowerCase().includes(q))
      .sort((a, b) => Number(!!b.isMutual) - Number(!!a.isMutual) || fullName(a).localeCompare(fullName(b), 'tr'));
  }, [people, search]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const send = async () => {
    setSending(true);
    try {
      const res =
        kind === 'team' ? await invitesApi.inviteToTeam(targetId, selected) : await invitesApi.inviteToMatch(targetId, selected);
      const invited = res?.invited ?? selected.length;
      const skipped = res?.skipped || 0;
      let text = invited > 0 ? `${invited} kişiye davet gönderildi.` : 'Yeni davet gönderilmedi.';
      if (skipped > 0) text += ` ${skipped} kişi zaten ${kind === 'team' ? 'takımda' : 'kadroda'} ya da davetli olduğu için atlandı.`;
      if (invited > 0) message.success(text);
      else message.info(text);
      onClose?.();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Davet gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  const goDiscover = () => {
    onClose?.();
    navigate('/friends?tab=discover');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnClose
      className="mb-invite-modal"
      title={
        <div className="mb-invite-modal__title">
          <span>{kind === 'team' ? 'Takıma davet et' : 'Maça davet et'}</span>
          {title && <small>{title}</small>}
        </div>
      }
      footer={
        people.length > 0 && [
          <Button key="c" onClick={onClose}>
            Vazgeç
          </Button>,
          <Button key="s" type="primary" icon={<SendOutlined />} disabled={!selected.length} loading={sending} onClick={send}>
            {selected.length ? `${selected.length} kişiyi davet et` : 'Davet et'}
          </Button>,
        ]
      }
    >
      {loading ? (
        <Skeleton active avatar paragraph={{ rows: 3 }} />
      ) : people.length === 0 ? (
        <EmptyState description="Henüz kimseyi takip etmiyorsun">
          <Button type="primary" icon={<UserAddOutlined />} onClick={goDiscover}>
            Oyuncu keşfet
          </Button>
        </EmptyState>
      ) : (
        <>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="İsim ya da kullanıcı adı ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="mb-invite-list">
            {list.length === 0 && <div className="mb-invite-list__none">Aramana uyan kimse yok.</div>}
            {list.map((p) => {
              const on = selected.includes(p.playerId);
              return (
                <label key={p.playerId} className={`mb-invite-row ${on ? 'is-on' : ''}`}>
                  <Checkbox checked={on} onChange={() => toggle(p.playerId)} />
                  <PlayerAvatar player={p} size={36} />
                  <span className="mb-invite-row__name">
                    <strong>{fullName(p)}</strong>
                    <small>
                      @{p.userName}
                      {p.playedTogether > 0 && ` · ${p.playedTogether} maç birlikte`}
                    </small>
                  </span>
                  {p.isMutual && <span className="mb-chip is-approved">Arkadaş</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
