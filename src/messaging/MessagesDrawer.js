import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Drawer, Empty, Form, Input, List, Modal, Segmented, Select, Spin, Tooltip, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, SearchOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../api/config';
import { socialApi } from '../api/social';
import { PlayerAvatar } from '../ui';
import { apiErrorMessage, fromNow, fullName, getCurrentUser } from '../utils/format';
import './messages.css';

const { Text } = Typography;
const POLL_MS = 5000;

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
};

/* ---------------- Konuşma listesi ---------------- */
const matchesQuery = (p, q) =>
  !q || fullName(p).toLocaleLowerCase('tr').includes(q) || (p.userName || '').toLocaleLowerCase('tr').includes(q);

function PersonItem({ player, last, onSelect }) {
  return (
    <List.Item className="mb-chat-item" onClick={() => onSelect({ type: 'user', data: player })}>
      <List.Item.Meta
        avatar={<PlayerAvatar player={player} size={42} />}
        title={
          <div className="mb-chat-item__title">
            <span className="mb-chat-item__name">
              <span className="mb-chat-item__fullname">{fullName(player)}</span>
              {player.isMutual && <span className="mb-chat-item__badge">Arkadaş</span>}
            </span>
            {last && <Text type="secondary" className="mb-chat-item__time">{fromNow(last.sendingDate)}</Text>}
          </div>
        }
        description={
          <Text type="secondary" ellipsis>
            {last ? `${last.mine ? 'Sen: ' : ''}${last.text}` : `@${player.userName}`}
          </Text>
        }
      />
    </List.Item>
  );
}

/** Başlıklı kişi bölümü (Sohbetler / Arkadaşlar / Diğer oyuncular) */
function Section({ title, items, onSelect }) {
  if (!items.length) return null;
  return (
    <>
      <div className="mb-chat-section">{title}</div>
      <List
        dataSource={items}
        rowKey={(c) => c.player.playerId}
        renderItem={(c) => <PersonItem player={c.player} last={c.lastMessage} onSelect={onSelect} />}
      />
    </>
  );
}

function ConversationList({ me, onSelect }) {
  const [tab, setTab] = useState('people');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [others, setOthers] = useState([]);
  const [othersLoading, setOthersLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [following, setFollowing] = useState(null);
  const [form] = Form.useForm();

  const loadGroups = useCallback(() => api.get('/api/Groups/GetGroupList').then((r) => setGroups(r.data || [])), []);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    Promise.all([socialApi.messageContacts().then((list) => setContacts(list || [])), loadGroups()])
      .catch((e) => message.error(apiErrorMessage(e, 'Konuşmalar yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [me, loadGroups]);

  const q = search.trim().toLocaleLowerCase('tr');

  // Sunucu sırası korunur: son mesaj tarihi azalan, mesajı olmayanlar sonda
  const { chats, friends } = useMemo(() => {
    const filtered = contacts.filter((c) => c.player && matchesQuery(c.player, q));
    return { chats: filtered.filter((c) => c.lastMessage), friends: filtered.filter((c) => !c.lastMessage) };
  }, [contacts, q]);

  // 2+ karakterde diğer oyuncuları da ara (300 ms gecikmeli)
  useEffect(() => {
    const term = search.trim();
    if (tab !== 'people' || term.length < 2) {
      setOthers([]);
      setOthersLoading(false);
      return undefined;
    }
    let alive = true;
    setOthersLoading(true);
    const t = setTimeout(() => {
      socialApi
        .discover(term, 20)
        .then((list) => alive && setOthers(list || []))
        .catch(() => alive && setOthers([]))
        .finally(() => alive && setOthersLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, tab]);

  const otherResults = useMemo(() => {
    const known = new Set(contacts.map((c) => c.player?.playerId));
    return others.filter((p) => !known.has(p.playerId)).map((p) => ({ player: p, lastMessage: null }));
  }, [others, contacts]);

  // Grup üyeleri: takip ettiğim oyuncular (modal ilk açıldığında yüklenir)
  useEffect(() => {
    if (!groupModal || following) return;
    socialApi
      .following()
      .then((list) => setFollowing(list || []))
      .catch((e) => {
        setFollowing([]);
        message.error(apiErrorMessage(e, 'Takip ettiklerin yüklenemedi.'));
      });
  }, [groupModal, following]);

  const filteredGroups = useMemo(
    () => groups.filter((g) => !q || (g.groupName || '').toLocaleLowerCase('tr').includes(q)),
    [groups, q]
  );

  const createGroup = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/api/Groups/SaveGroup', { groupName: values.groupName, playerList: values.players });
      message.success('Grup oluşturuldu.');
      setGroupModal(false);
      form.resetFields();
      loadGroups();
      setTab('groups');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Grup oluşturulamadı.'));
    }
  };

  const peopleEmpty = !chats.length && !friends.length && !otherResults.length;
  const emptyText = !q
    ? 'Henüz sohbetin yok. Arkadaşlarınla burada yazışabilirsin.'
    : search.trim().length < 2
      ? 'Kişi bulunamadı'
      : 'Oyuncu bulunamadı';

  return (
    <div className="mb-chat-list">
      <div className="mb-chat-list__toolbar">
        <Segmented
          block
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Kişiler', value: 'people' },
            { label: 'Gruplar', value: 'groups' },
          ]}
        />
        <div className="mb-chat-list__search">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={tab === 'people' ? 'Kişi ya da oyuncu ara' : 'Grup ara'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === 'groups' && (
            <Tooltip title="Yeni grup">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModal(true)} />
            </Tooltip>
          )}
        </div>
      </div>

      <div className="mb-chat-list__items">
        {loading ? (
          <div className="mb-center"><Spin /></div>
        ) : tab === 'people' ? (
          <>
            <Section title="Sohbetler" items={chats} onSelect={onSelect} />
            <Section title="Arkadaşlar" items={friends} onSelect={onSelect} />
            <Section title="Diğer oyuncular" items={otherResults} onSelect={onSelect} />
            {othersLoading && (
              <div className="mb-chat-section__loading"><Spin size="small" /></div>
            )}
            {peopleEmpty && !othersLoading && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="mb-chat-list__empty" description={emptyText} />
            )}
          </>
        ) : (
          <List
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz bir grubun yok">
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModal(true)}>
                    Grup oluştur
                  </Button>
                </Empty>
              ),
            }}
            dataSource={filteredGroups}
            renderItem={(g) => (
              <List.Item className="mb-chat-item" onClick={() => onSelect({ type: 'group', data: g })}>
                <List.Item.Meta
                  avatar={<div className="mb-group-avatar"><TeamOutlined /></div>}
                  title={g.groupName}
                  description={<Text type="secondary">Grup sohbeti</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      <Modal
        title="Yeni grup oluştur"
        open={groupModal}
        onOk={createGroup}
        onCancel={() => setGroupModal(false)}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="groupName" label="Grup adı" rules={[{ required: true, whitespace: true, message: 'Grup adı zorunludur.' }]}>
            <Input placeholder="Örn. Perşembe Maçı" maxLength={50} />
          </Form.Item>
          <Form.Item name="players" label="Üyeler" rules={[{ required: true, message: 'En az bir üye seç.' }]}>
            <Select
              mode="multiple"
              placeholder="Takip ettiğin oyunculardan seç"
              optionFilterProp="label"
              loading={!following}
              notFoundContent={following ? 'Henüz kimseyi takip etmiyorsun' : <Spin size="small" />}
              options={(following || []).map((p) => ({ value: p.playerId, label: `${fullName(p)} (@${p.userName})` }))}
            />
          </Form.Item>
          <Text type="secondary">Grubu oluşturan kişi otomatik olarak gruba eklenir.</Text>
        </Form>
      </Modal>
    </div>
  );
}

/* ---------------- Konuşma ---------------- */
function Conversation({ me, target }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(null); // 403: mesaj izni yok
  const bottomRef = useRef(null);
  const isGroup = target.type === 'group';

  const load = useCallback(async () => {
    try {
      const res = isGroup
        ? await api.post('/api/GroupsMessage/GetGroupMessageById', { groupId: target.data.groupId })
        : await api.post('/api/Message/GetMessageById', {
            sendPlayerId: me.playerId,
            recipientPlayerId: target.data.playerId,
          });
      const list = (res.data || []).slice().sort((a, b) => new Date(a.sendingDate) - new Date(b.sendingDate));
      setMessages(list);
    } catch (e) {
      if (e?.response?.status !== 401) message.error(apiErrorMessage(e, 'Mesajlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [isGroup, target, me]);

  // İlk yükleme + periyodik yenileme (gerçek zamanlı altyapı gelene kadar)
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setDenied(null);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || denied) return;
    setSending(true);
    try {
      const now = new Date().toISOString();
      if (isGroup) {
        await api.post('/api/GroupsMessage/SaveGroupMessage', {
          groupId: target.data.groupId,
          matchMessage: body,
          sendingDate: now,
          sendPlayerId: me.playerId,
          status: 0,
        });
      } else {
        await api.post('/api/Message/MessageSave', {
          recipientPlayerId: target.data.playerId,
          sendPlayerId: me.playerId,
          matchMessage: body,
          sendingDate: now,
          status: 1,
        });
      }
      setText('');
      await load();
    } catch (e) {
      if (!isGroup && e?.response?.status === 403) {
        setDenied(apiErrorMessage(e, 'Bu oyuncuya mesaj gönderemezsin.'));
      } else {
        message.error(apiErrorMessage(e, 'Mesaj gönderilemedi.'));
      }
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Gün ayraçlarıyla birlikte mesajlar
  let lastDay = null;

  return (
    <div className="mb-chat">
      <div className="mb-chat__messages">
        {loading ? (
          <div className="mb-center"><Spin /></div>
        ) : messages.length === 0 ? (
          <div className="mb-center">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz mesaj yok. İlk mesajı sen gönder." />
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sendPlayerId === me.playerId;
            const day = dayjs(m.sendingDate).format('DD MMMM YYYY');
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <React.Fragment key={m.messageId || m.groupMessageId || i}>
                {showDay && <div className="mb-chat__day"><span>{day}</span></div>}
                <div className={`mb-bubble-row ${mine ? 'is-mine' : ''}`}>
                  <div className={`mb-bubble ${mine ? 'is-mine' : ''}`}>
                    {isGroup && !mine && <div className="mb-bubble__author">{m.userName || 'Üye'}</div>}
                    <div className="mb-bubble__text">{m.matchMessage}</div>
                    <div className="mb-bubble__time">{dayjs(m.sendingDate).format('HH:mm')}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {denied && (
        <Alert type="warning" showIcon banner className="mb-chat__denied" message={denied} />
      )}
      <div className="mb-chat__composer">
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!!denied}
          placeholder={denied ? 'Bu oyuncuya mesaj gönderemezsin' : 'Mesaj yaz… (Enter: gönder, Shift+Enter: yeni satır)'}
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={1000}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={send}
          loading={sending}
          disabled={!text.trim() || !!denied}
        />
      </div>
    </div>
  );
}

/* ---------------- Drawer ---------------- */
export default function MessagesDrawer({ open, target, onTargetChange, onClose }) {
  const isMobile = useIsMobile();
  const [me, setMe] = useState(getCurrentUser);

  useEffect(() => {
    if (open) setMe(getCurrentUser());
  }, [open]);

  const title = target ? (
    <div className="mb-chat-header">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => onTargetChange(null)} aria-label="Geri" />
      {target.type === 'user' ? (
        <PlayerAvatar player={target.data} size={36} />
      ) : (
        <div className="mb-group-avatar small"><TeamOutlined /></div>
      )}
      <div className="mb-chat-header__text">
        <div className="mb-chat-header__name">
          {target.type === 'user' ? (
            <Link to={`/player/${target.data.playerId}`} className="mb-player-link" onClick={onClose}>
              {fullName(target.data)}
            </Link>
          ) : (
            target.data.groupName
          )}
        </div>
        <Text type="secondary" className="mb-chat-header__sub">
          {target.type === 'user' ? `@${target.data.userName}` : 'Grup sohbeti'}
        </Text>
      </div>
    </div>
  ) : (
    <span>Mesajlar</span>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={isMobile ? '100%' : 440}
      title={title}
      className="mb-messages-drawer"
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      destroyOnClose
    >
      {me &&
        (target ? (
          <Conversation key={`${target.type}-${target.data.playerId || target.data.groupId}`} me={me} target={target} />
        ) : (
          <ConversationList me={me} onSelect={onTargetChange} />
        ))}
    </Drawer>
  );
}
