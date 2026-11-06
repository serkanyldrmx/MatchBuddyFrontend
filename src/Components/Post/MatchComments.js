import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, List, Typography } from 'antd';
import { DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { PlayerAvatar } from '../../ui';
import { apiErrorMessage, getCurrentUser } from '../../utils/format';

const { Text } = Typography;

/** Maç yorumları (maç detay sayfasında) */
export default function MatchComments({ matchId }) {
  const { message } = App.useApp();
  const me = getCurrentUser();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/MatchComment/GetMatchComments?matchId=${matchId}`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setComments([]);
      message.error(apiErrorMessage(e, 'Yorumlar yüklenemedi.'));
    }
  }, [matchId, message]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      await api.post('/api/MatchComment/SaveMatchComment', { comment: body, matchId: Number(matchId), playerId: me?.playerId });
      setText('');
      load();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Yorum gönderilemedi.'));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId) => {
    try {
      await api.post(`/api/MatchComment/DeleteMatchComment?commentId=${commentId}`);
      setComments((c) => c.filter((x) => x.commentsId !== commentId));
    } catch (e) {
      message.error(apiErrorMessage(e, 'Yorum silinemedi.'));
    }
  };

  return (
    <>
      <List
        loading={comments === null}
        dataSource={comments || []}
        locale={{ emptyText: 'Henüz yorum yok. Soyunma odasında ilk sözü sen söyle.' }}
        renderItem={(c) => {
          const canDelete = me && (c.playerId === me.playerId || me.isAdmin === 1);
          return (
            <List.Item
              actions={
                canDelete
                  ? [<Button key="d" type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(c.commentsId)} aria-label="Yorumu sil" />]
                  : []
              }
            >
              <List.Item.Meta
                avatar={<PlayerAvatar player={c} size={34} />}
                title={<Text strong style={{ fontSize: 13 }}>@{c.userName}</Text>}
                description={<Text>{c.comment}</Text>}
              />
            </List.Item>
          );
        }}
      />
      <div className="mb-comments__composer">
        <PlayerAvatar player={me} size={34} />
        <Input
          placeholder="Yorum yaz…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={post}
          maxLength={300}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={post} loading={posting} disabled={!text.trim()} />
      </div>
    </>
  );
}
