import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Checkbox, Input, Modal, Skeleton } from 'antd';
import { SearchOutlined, SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      .catch((e) => message.error(apiErrorMessage(e, t('invites:modal.loadFailed'))))
      .finally(() => setLoading(false));
  }, [open, message, t]);

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
      let text = invited > 0 ? t('invites:modal.sent', { count: invited }) : t('invites:modal.noneSent');
      if (skipped > 0) {
        text += ` ${kind === 'team' ? t('invites:modal.skippedTeam', { count: skipped }) : t('invites:modal.skippedMatch', { count: skipped })}`;
      }
      if (invited > 0) message.success(text);
      else message.info(text);
      onClose?.();
    } catch (e) {
      message.error(apiErrorMessage(e, t('invites:modal.sendFailed')));
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
          <span>{kind === 'team' ? t('invites:modal.titleTeam') : t('invites:modal.titleMatch')}</span>
          {title && <small>{title}</small>}
        </div>
      }
      footer={
        people.length > 0 && [
          <Button key="c" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>,
          <Button key="s" type="primary" icon={<SendOutlined />} disabled={!selected.length} loading={sending} onClick={send}>
            {selected.length ? t('invites:modal.inviteCount', { count: selected.length }) : t('invites:modal.invite')}
          </Button>,
        ]
      }
    >
      {loading ? (
        <Skeleton active avatar paragraph={{ rows: 3 }} />
      ) : people.length === 0 ? (
        <EmptyState description={t('invites:modal.noFollowing')}>
          <Button type="primary" icon={<UserAddOutlined />} onClick={goDiscover}>
            {t('invites:modal.discoverPlayers')}
          </Button>
        </EmptyState>
      ) : (
        <>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('invites:modal.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="mb-invite-list">
            {list.length === 0 && <div className="mb-invite-list__none">{t('invites:modal.noResults')}</div>}
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
                      {p.playedTogether > 0 && ` · ${t('invites:modal.matchesTogether', { count: p.playedTogether })}`}
                    </small>
                  </span>
                  {p.isMutual && <span className="mb-chip is-approved">{t('invites:modal.friend')}</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
