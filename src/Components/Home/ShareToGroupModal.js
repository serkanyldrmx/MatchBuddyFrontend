import React, { useEffect, useState } from 'react';
import { App, Avatar, Button, Checkbox, Empty, Input, Modal, Skeleton } from 'antd';
import { TeamOutlined, SendOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { matchesApi } from '../../api/matches';
import { groupsApi } from '../../api/messages';
import { useMessages } from '../../messaging/MessagesContext';
import { apiErrorMessage } from '../../utils/format';
import './ShareToGroupModal.css';

const MAX_GROUPS = 10;

/**
 * Maçı (bilgileri + katılma linki) üyesi olunan sohbet gruplarına gönderir.
 * Grup üyelerinden maçta olmayanlara maça götüren bir bildirim de düşer.
 * Sözleşme: MatcBuddy/docs/engagement-api.md "ShareToGroups"
 */
function ShareToGroupModal({ open, matchId, matchName, onClose }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { openMessages } = useMessages();
  const [groups, setGroups] = useState(null);
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setGroups(null);
    setSelected([]);
    setNote('');
    groupsApi
      .mine()
      .then((list) => {
        if (!alive) return;
        setGroups(list);
        // Tek grup varsa doğrudan seçili gelsin
        if (list.length === 1) setSelected([list[0].groupId]);
      })
      .catch((e) => {
        if (!alive) return;
        setGroups([]);
        message.error(apiErrorMessage(e, t('match:shareGroup.loadFailed')));
      });
    return () => {
      alive = false;
    };
  }, [open, message, t]);

  const toggle = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_GROUPS ? cur : [...cur, id]));

  const send = async () => {
    if (!selected.length) {
      message.warning(t('match:shareGroup.pickOne'));
      return;
    }
    setSending(true);
    try {
      const res = await matchesApi.shareToGroups(matchId, selected, note.trim() || undefined);
      message.success(res?.message || t('match:shareGroup.sent', { count: selected.length }));
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:shareGroup.failed')));
    } finally {
      setSending(false);
    }
  };

  const newGroup = () => {
    onClose();
    // Mesaj panelinden yeni grup kurulur; kurduktan sonra maç detayındaki "Gruba gönder" ile gönderilebilir
    openMessages();
  };

  return (
    <Modal
      open={open}
      title={
        <span>
          <TeamOutlined style={{ marginRight: 8 }} />
          {t('match:shareGroup.title')}
        </span>
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>,
        <Button key="send" type="primary" icon={<SendOutlined />} loading={sending} disabled={!selected.length} onClick={send}>
          {selected.length > 0 ? t('match:shareGroup.sendTo', { count: selected.length }) : t('match:shareGroup.send')}
        </Button>,
      ]}
      destroyOnClose
    >
      <p className="mb-hint" style={{ marginTop: 0 }}>
        {t('match:shareGroup.intro', { name: matchName })}
      </p>
      {groups == null ? (
        <Skeleton active avatar paragraph={{ rows: 2 }} />
      ) : groups.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:shareGroup.noGroups')}>
          <Button icon={<PlusOutlined />} onClick={newGroup}>
            {t('match:shareGroup.createGroup')}
          </Button>
        </Empty>
      ) : (
        <>
          <div className="mb-share-groups" role="list">
            {groups.map((g) => {
              const checked = selected.includes(g.groupId);
              return (
                <label key={g.groupId} className={`mb-share-group ${checked ? 'is-checked' : ''}`} role="listitem">
                  <Checkbox checked={checked} onChange={() => toggle(g.groupId)} />
                  <Avatar className="mb-share-group__avatar" icon={<TeamOutlined />} />
                  <span className="mb-share-group__text">
                    <strong>{g.groupName}</strong>
                    <small>{t('match:shareGroup.members', { count: g.memberCount || g.members?.length || 0 })}</small>
                  </span>
                </label>
              );
            })}
          </div>
          <Input.TextArea
            rows={2}
            maxLength={300}
            showCount
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('match:shareGroup.notePlaceholder')}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Modal>
  );
}

export default ShareToGroupModal;
