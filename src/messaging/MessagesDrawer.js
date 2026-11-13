import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Drawer, Empty, Form, Image, Input, Modal, Popconfirm, Popover, Progress, Segmented, Select, Spin, Tooltip, Typography, message } from 'antd';
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  CrownFilled,
  LogoutOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SmileOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { uploadMedia } from '../api/media';
import { groupsApi, MESSAGE_MAX_LENGTH, messagesApi } from '../api/messages';
import { socialApi } from '../api/social';
import { onRealtime } from '../api/realtime';
import { PlayerAvatar } from '../ui';
import { apiErrorMessage, isErrorCode, fullName, getCurrentUser, mediaUrl } from '../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, imageError, preparedImageError, prepareImage } from '../utils/image';
import { EmojiPicker, MessageMenu, MessageText, ReactionChips, ReplyQuote, TypingDots, useLongPress, useTyping } from './MessageExtras';
import './messages.css';

const { Text } = Typography;
// Anlık bağlantı (SignalR) varken yoklama yalnızca yedektir
const POLL_MS = 30000;
// Aynı kişinin bu süre içindeki ardışık mesajları tek blok gibi görünür
const RUN_GAP_MIN = 5;

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
};

/** Listede kısa zaman: bugün saat, dün "Dün", bu hafta gün adı, daha eski tarih */
function useShortTime() {
  const { t } = useTranslation();
  return useCallback(
    (value) => {
      if (!value) return '';
      const d = dayjs(value);
      const today = dayjs().startOf('day');
      if (!d.isBefore(today)) return d.format('HH:mm');
      if (!d.isBefore(today.subtract(1, 'day'))) return t('messages:time.yesterday');
      if (!d.isBefore(today.subtract(6, 'day'))) return d.format('ddd');
      return d.format('DD.MM.YY');
    },
    [t]
  );
}

/** Gün ayracı: Bugün / Dün / 12 Kasım 2026 */
function dayLabel(value, t) {
  const d = dayjs(value);
  const today = dayjs().startOf('day');
  if (!d.isBefore(today)) return t('messages:time.today');
  if (!d.isBefore(today.subtract(1, 'day'))) return t('messages:time.yesterday');
  return d.format(d.year() === today.year() ? 'DD MMMM dddd' : 'DD MMMM YYYY');
}

/** Gönderildi (✓) / görüldü (✓✓) işareti */
function Ticks({ read, title }) {
  return (
    <span className={`mb-ticks${read ? ' is-read' : ''}`} title={title} aria-label={title}>
      <svg viewBox="0 0 18 12" width="16" height="11" aria-hidden="true">
        <path d="M1 6.5 4.5 10 11 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {read && <path d="M7 9.2 7.8 10 14.5 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

/** Grup avatarı: iki üyenin fotoğrafı üst üste (yoksa takım simgesi) */
export function GroupAvatar({ group, me, size = 48 }) {
  const others = (group?.members || []).filter((p) => p.playerId !== me?.playerId);
  const style = { width: size, height: size };
  if (others.length < 2) {
    return (
      <span className="mb-group-avatar" style={{ ...style, fontSize: size * 0.4 }}>
        <TeamOutlined />
      </span>
    );
  }
  const inner = Math.round(size * 0.68);
  return (
    <span className="mb-group-stack" style={style}>
      <PlayerAvatar player={others[1]} size={inner} className="mb-group-stack__back" />
      <PlayerAvatar player={others[0]} size={inner} className="mb-group-stack__front" />
    </span>
  );
}

/* ---------------- Konuşma listesi ---------------- */
const matchesQuery = (p, q) =>
  !q || fullName(p).toLocaleLowerCase('tr').includes(q) || (p.userName || '').toLocaleLowerCase('tr').includes(q);

function ConversationRow({ avatar, title, badge, last, preview, unreadCount, onClick }) {
  const shortTime = useShortTime();
  const { t } = useTranslation();
  const unread = unreadCount > 0;
  return (
    <button type="button" className={`mb-conv${unread ? ' is-unread' : ''}`} onClick={onClick}>
      <span className="mb-conv__avatar">{avatar}</span>
      <span className="mb-conv__body">
        <span className="mb-conv__top">
          <span className="mb-conv__name">
            <span className="mb-conv__title">{title}</span>
            {badge}
          </span>
          {last && <span className="mb-conv__time">{shortTime(last.sendingDate)}</span>}
        </span>
        <span className="mb-conv__bottom">
          <span className="mb-conv__preview">
            {last?.mine && last.read !== undefined && <Ticks read={last.read} title={last.read ? t('messages:chat.seen') : t('messages:chat.sent')} />}
            {preview}
          </span>
          {unread && <span className="mb-conv__count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </span>
      </span>
    </button>
  );
}

function PersonRow({ contact, onSelect }) {
  const { t } = useTranslation();
  const { player, lastMessage: last, unreadCount } = contact;
  const preview = last ? (last.mine ? t('messages:list.youPrefix', { text: last.text }) : last.text) : `@${player.userName}`;
  return (
    <ConversationRow
      avatar={<PlayerAvatar player={player} size={48} />}
      title={fullName(player)}
      badge={player.isMutual && <span className="mb-conv__badge">{t('messages:list.friendBadge')}</span>}
      last={last ? { ...last, read: last.mine ? !!last.read : undefined } : null}
      preview={preview}
      unreadCount={unreadCount}
      onClick={() => onSelect({ type: 'user', data: player })}
    />
  );
}

function GroupRow({ group, me, onSelect }) {
  const { t } = useTranslation();
  const last = group.lastMessage;
  const preview = last
    ? last.mine
      ? t('messages:list.youPrefix', { text: last.text })
      : last.senderName
        ? `${last.senderName}: ${last.text}`
        : last.text
    : t('messages:group.memberCount', { count: group.memberCount });
  return (
    <ConversationRow
      avatar={<GroupAvatar group={group} me={me} />}
      title={group.groupName}
      last={last}
      preview={preview}
      unreadCount={group.unreadCount}
      onClick={() => onSelect({ type: 'group', data: group })}
    />
  );
}

/** Başlıklı bölüm (Sohbetler / Arkadaşlar / Diğer oyuncular) */
function Section({ title, items, onSelect }) {
  if (!items.length) return null;
  return (
    <>
      <div className="mb-chat-section">{title}</div>
      {items.map((c) => (
        <PersonRow key={c.player.playerId} contact={c} onSelect={onSelect} />
      ))}
    </>
  );
}

/** Takip ettiklerim arasından oyuncu seçici (grup kurma / üye ekleme) */
function FollowingSelect({ value, onChange, exclude = [], open }) {
  const { t } = useTranslation();
  const [following, setFollowing] = useState(null);
  useEffect(() => {
    if (!open || following) return;
    socialApi
      .following()
      .then((list) => setFollowing(list || []))
      .catch((e) => {
        setFollowing([]);
        message.error(apiErrorMessage(e, t('messages:group.followingLoadFailed')));
      });
  }, [open, following, t]);
  const excluded = new Set(exclude);
  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      placeholder={t('messages:group.membersPlaceholder')}
      optionFilterProp="search"
      loading={!following}
      notFoundContent={following ? t('messages:group.noFollowing') : <Spin size="small" />}
      options={(following || [])
        .filter((p) => !excluded.has(p.playerId))
        .map((p) => ({
          value: p.playerId,
          search: `${fullName(p)} ${p.userName}`,
          label: (
            <span className="mb-person-option">
              <PlayerAvatar player={p} size={22} />
              <span>{fullName(p)}</span>
              <Text type="secondary">@{p.userName}</Text>
            </span>
          ),
        }))}
    />
  );
}

function ConversationList({ me, onSelect, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'people');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [others, setOthers] = useState([]);
  const [othersLoading, setOthersLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const loadContacts = useCallback(() => socialApi.messageContacts().then((list) => setContacts(list || [])), []);
  const loadGroups = useCallback(() => groupsApi.mine().then(setGroups), []);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    Promise.all([loadContacts(), loadGroups()])
      .catch((e) => message.error(apiErrorMessage(e, t('messages:list.loadFailed'))))
      .finally(() => setLoading(false));
  }, [me, loadContacts, loadGroups, t]);

  // Yeni mesaj / okundu / grup değişikliği gelince liste (son mesaj, sıra, rozetler) tazelenir
  useEffect(() => {
    if (!me) return undefined;
    let timer;
    const refresh = (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!e || e.kind === 'user') loadContacts().catch(() => {});
        if (!e || e.kind !== 'user') loadGroups().catch(() => {});
      }, 250);
    };
    const offMessage = onRealtime('message', refresh);
    const offRead = onRealtime('messageRead', () => loadContacts().catch(() => {}));
    return () => {
      clearTimeout(timer);
      offMessage();
      offRead();
    };
  }, [me, loadContacts, loadGroups]);

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
    const timer = setTimeout(() => {
      socialApi
        .discover(term, 20)
        .then((list) => alive && setOthers(list || []))
        .catch(() => alive && setOthers([]))
        .finally(() => alive && setOthersLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, tab]);

  const otherResults = useMemo(() => {
    const known = new Set(contacts.map((c) => c.player?.playerId));
    return others.filter((p) => !known.has(p.playerId)).map((p) => ({ player: p, lastMessage: null, unreadCount: 0 }));
  }, [others, contacts]);

  const filteredGroups = useMemo(
    () => groups.filter((g) => !q || (g.groupName || '').toLocaleLowerCase('tr').includes(q)),
    [groups, q]
  );

  const peopleUnread = contacts.reduce((n, c) => n + (c.unreadCount || 0), 0);
  const groupsUnread = groups.reduce((n, g) => n + (g.unreadCount || 0), 0);

  const createGroup = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const res = await groupsApi.create(values.groupName.trim(), values.players);
      message.success(t('messages:group.created'));
      setGroupModal(false);
      form.resetFields();
      const list = await groupsApi.mine();
      setGroups(list);
      setTab('groups');
      const created = list.find((g) => g.groupId === res?.groupId);
      if (created) onSelect({ type: 'group', data: created });
    } catch (e) {
      message.error(apiErrorMessage(e, t('messages:group.createFailed')));
    } finally {
      setCreating(false);
    }
  };

  const peopleEmpty = !chats.length && !friends.length && !otherResults.length;
  const emptyText = !q
    ? t('messages:list.emptyChats')
    : search.trim().length < 2
      ? t('messages:list.noContactFound')
      : t('messages:list.noPlayerFound');

  const tabLabel = (label, count) => (
    <span className="mb-chat-tab">
      {label}
      {count > 0 && <Badge count={count} size="small" overflowCount={99} />}
    </span>
  );

  return (
    <div className="mb-chat-list">
      <div className="mb-chat-list__toolbar">
        <Segmented
          block
          value={tab}
          onChange={setTab}
          options={[
            { label: tabLabel(t('messages:list.tabPeople'), peopleUnread), value: 'people' },
            { label: tabLabel(t('messages:list.tabGroups'), groupsUnread), value: 'groups' },
          ]}
        />
        <div className="mb-chat-list__search">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={tab === 'people' ? t('messages:list.searchPeople') : t('messages:list.searchGroups')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === 'groups' && (
            <Tooltip title={t('messages:group.new')}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModal(true)} aria-label={t('messages:group.new')} />
            </Tooltip>
          )}
        </div>
      </div>

      <div className="mb-chat-list__items">
        {loading ? (
          <div className="mb-center"><Spin /></div>
        ) : tab === 'people' ? (
          <>
            <Section title={t('messages:list.sectionChats')} items={chats} onSelect={onSelect} />
            <Section title={t('messages:list.sectionFriends')} items={friends} onSelect={onSelect} />
            <Section title={t('messages:list.sectionOthers')} items={otherResults} onSelect={onSelect} />
            {othersLoading && (
              <div className="mb-chat-section__loading"><Spin size="small" /></div>
            )}
            {peopleEmpty && !othersLoading && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="mb-chat-list__empty" description={emptyText} />
            )}
          </>
        ) : filteredGroups.length ? (
          filteredGroups.map((g) => <GroupRow key={g.groupId} group={g} me={me} onSelect={onSelect} />)
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="mb-chat-list__empty" description={q ? t('messages:group.notFound') : t('messages:group.empty')}>
            {!q && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModal(true)}>
                {t('messages:group.create')}
              </Button>
            )}
          </Empty>
        )}
      </div>

      <Modal
        title={t('messages:group.modalTitle')}
        open={groupModal}
        onOk={createGroup}
        confirmLoading={creating}
        onCancel={() => setGroupModal(false)}
        okText={t('messages:group.createOk')}
        cancelText={t('common:actions.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="groupName" label={t('messages:group.nameLabel')} rules={[{ required: true, whitespace: true, message: t('messages:group.nameRequired') }]}>
            <Input placeholder={t('messages:group.namePlaceholder')} maxLength={50} />
          </Form.Item>
          <Form.Item name="players" label={t('messages:group.membersLabel')} rules={[{ required: true, message: t('messages:group.membersRequired') }]}>
            <FollowingSelect open={groupModal} />
          </Form.Item>
          <Text type="secondary">{t('messages:group.creatorNote')}</Text>
        </Form>
      </Modal>
    </div>
  );
}

/* ---------------- Grup bilgisi ---------------- */
function GroupInfoModal({ open, group, me, onClose, onChanged, onLeft, onNavigate }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState([]);
  const [busy, setBusy] = useState(false);
  const members = group?.members || [];
  const isCreator = group?.createdByPlayerId === me?.playerId;

  useEffect(() => {
    if (!open) setAdding([]);
  }, [open]);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const res = await fn();
      message.success(res?.message || okText);
      return true;
    } catch (e) {
      message.error(apiErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!adding.length) return;
    if (await run(() => groupsApi.addMembers(group.groupId, adding), t('messages:group.membersAdded'))) {
      setAdding([]);
      onChanged();
    }
  };
  const remove = async (p) => {
    if (await run(() => groupsApi.removeMember(group.groupId, p.playerId), t('messages:group.memberRemoved'))) onChanged();
  };
  const leave = async () => {
    if (await run(() => groupsApi.leave(group.groupId), t('messages:group.left'))) onLeft();
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={group?.groupName} destroyOnClose className="mb-group-info">
      <div className="mb-group-info__head">
        <GroupAvatar group={group} me={me} size={64} />
        <Text type="secondary">{t('messages:group.memberCount', { count: members.length })}</Text>
      </div>

      <div className="mb-chat-section is-flat">{t('messages:group.members')}</div>
      <div className="mb-group-info__members">
        {members.map((p) => (
          <div key={p.playerId} className="mb-group-member">
            <Link to={`/player/${p.playerId}`} onClick={onNavigate} className="mb-group-member__link">
              <PlayerAvatar player={p} size={36} />
              <span className="mb-group-member__text">
                <strong>
                  {fullName(p)}
                  {p.playerId === me?.playerId && <Text type="secondary"> {t('messages:group.you')}</Text>}
                </strong>
                <Text type="secondary">@{p.userName}</Text>
              </span>
            </Link>
            {group.createdByPlayerId === p.playerId && (
              <Tooltip title={t('messages:group.creator')}>
                <CrownFilled className="mb-group-member__crown" />
              </Tooltip>
            )}
            {isCreator && p.playerId !== me?.playerId && (
              <Popconfirm title={t('messages:group.removeConfirm', { name: fullName(p) })} onConfirm={() => remove(p)} okText={t('common:actions.yes')} cancelText={t('common:actions.no')}>
                <Button type="text" size="small" danger icon={<UserDeleteOutlined />} disabled={busy} aria-label={t('messages:group.remove')} />
              </Popconfirm>
            )}
          </div>
        ))}
      </div>

      <div className="mb-chat-section is-flat">{t('messages:group.addMembers')}</div>
      <div className="mb-group-info__add">
        <FollowingSelect open={open} value={adding} onChange={setAdding} exclude={members.map((m) => m.playerId)} />
        <Button type="primary" icon={<UserAddOutlined />} onClick={add} disabled={!adding.length} loading={busy}>
          {t('common:actions.add')}
        </Button>
      </div>

      <Popconfirm title={t('messages:group.leaveConfirm')} onConfirm={leave} okText={t('messages:group.leave')} cancelText={t('common:actions.cancel')} okButtonProps={{ danger: true }}>
        <Button danger block icon={<LogoutOutlined />} className="mb-group-info__leave" disabled={busy}>
          {t('messages:group.leave')}
        </Button>
      </Popconfirm>
    </Modal>
  );
}

/* ---------------- Konuşma ---------------- */
const fileFromClipboard = (e) => {
  const items = Array.from(e.clipboardData?.items || []);
  const item = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'));
  return item ? item.getAsFile() : null;
};

const hasDraggedFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

/**
 * Baloncuktaki resim: sm boyu, tıklayınca lg önizleme.
 * (srcSet kullanılmıyor: rc-image aynı srcSet'i önizlemeye de verdiği için lg yerine küçük boy açılırdı.)
 */
function BubbleImage({ url, onLoad }) {
  const { t } = useTranslation();
  return (
    <Image
      className="mb-bubble__img"
      src={mediaUrl(url, 'sm')}
      alt={t('messages:chat.photo')}
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      preview={{ src: mediaUrl(url, 'lg'), mask: null }}
    />
  );
}

const sameRun = (a, b) =>
  a && b && a.sendPlayerId === b.sendPlayerId && dayjs(a.sendingDate).isSame(dayjs(b.sendingDate), 'day') &&
  Math.abs(dayjs(b.sendingDate).diff(dayjs(a.sendingDate), 'minute')) < RUN_GAP_MIN;

const keyOf = (m, i) => m.messageId || m.groupMessageId || `i${i}`;

const senderOf = (m) => ({
  playerId: m.sendPlayerId,
  playerName: m.playerName,
  playerSurname: m.playerSurname,
  userName: m.userName,
  profilePictureUrl: m.profilePictureUrl,
});

function Conversation({ me, target, onRead, onNavigate }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(null); // 403: mesaj izni yok
  // Gönderilecek resim: { file, preview, name, mediaId?, progress? }
  const [attachment, setAttachment] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [firstUnreadKey, setFirstUnreadKey] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // yanıtlanan mesaj
  const [menuKey, setMenuKey] = useState(null); // işlem menüsü açık mesaj
  const [flashKey, setFlashKey] = useState(null); // alıntıya tıklanınca vurgulanan mesaj
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const nearBottomRef = useRef(true);
  const dragDepth = useRef(0);
  const attachmentRef = useRef(null);
  const countRef = useRef(0);
  const firstLoadRef = useRef(true);
  const loadingRef = useRef(true);
  attachmentRef.current = attachment;
  const isGroup = target.type === 'group';
  const otherId = target.data.playerId;
  const groupId = target.data.groupId;
  const { typingIds, notifyTyping } = useTyping({ isGroup, groupId, otherId, myId: me.playerId });
  const isTouch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);
  const longPress = useLongPress(setMenuKey);

  const markRead = useCallback(() => {
    const call = isGroup ? groupsApi.markRead(groupId) : messagesApi.markRead(otherId);
    call.then(() => onRead?.()).catch(() => {});
  }, [isGroup, groupId, otherId, onRead]);

  const load = useCallback(async () => {
    try {
      const list = (isGroup ? await groupsApi.conversation(groupId) : await messagesApi.conversation(me.playerId, otherId))
        .slice()
        .sort((a, b) => new Date(a.sendingDate) - new Date(b.sendingDate) || (a.messageId || a.groupMessageId || 0) - (b.messageId || b.groupMessageId || 0));
      // İlk açılışta: okunmamış ilk mesajın önüne "Yeni mesajlar" ayracı (birebir)
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        if (!isGroup) {
          const idx = list.findIndex((m) => m.sendPlayerId !== me.playerId && !m.readAt);
          if (idx > 0) setFirstUnreadKey(keyOf(list[idx], idx));
        }
      }
      const incomingNew = list.length > countRef.current && list.slice(countRef.current).some((m) => m.sendPlayerId !== me.playerId);
      if (countRef.current && list.length > countRef.current && !nearBottomRef.current) {
        setNewBelow((n) => n + (list.length - countRef.current));
      }
      countRef.current = list.length;
      setMessages(list);
      if (incomingNew || (list.length && loadingRef.current)) markRead();
    } catch (e) {
      if (e?.response?.status !== 401) message.error(apiErrorMessage(e, t('messages:chat.loadFailed')));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [isGroup, groupId, otherId, me, t, markRead]);

  // İlk yükleme + anlık sinyal (SignalR) + yedek yoklama
  useEffect(() => {
    setLoading(true);
    loadingRef.current = true;
    firstLoadRef.current = true;
    countRef.current = 0;
    setMessages([]);
    setDenied(null);
    setFirstUnreadKey(null);
    load();
    const timer = setInterval(load, POLL_MS);
    const offMessage = onRealtime('message', (e) => {
      if (isGroup ? e.kind === 'group' && e.groupId === groupId : e.kind === 'user' && [e.senderId, e.recipientId].includes(otherId)) load();
    });
    // Karşı taraf okudu: görüldü işaretleri güncellensin
    const offRead = onRealtime('messageRead', (e) => {
      if (!isGroup && e.readerId === otherId) load();
    });
    return () => {
      clearInterval(timer);
      offMessage();
      offRead();
    };
  }, [load, isGroup, groupId, otherId]);

  // Yeni mesaj: en alttaysak (ya da ilk yüklemede) aşağı kay
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !messages.length) return;
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Önizleme adresini serbest bırak (kaldırıldığında / değiştiğinde / kapanışta)
  const previewUrl = attachment?.preview;
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    if (near !== atBottom) setAtBottom(near);
    if (near && newBelow) setNewBelow(0);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    nearBottomRef.current = true;
    setAtBottom(true);
    setNewBelow(0);
  };

  // Resim geç yüklenince en altta kalalım
  const onImageLoad = useCallback(() => {
    const el = listRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, []);

  const attach = async (file) => {
    if (!file || denied || sending) return;
    const err = imageError(file);
    if (err) {
      message.error(err);
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      const sizeErr = preparedImageError(prepared);
      if (sizeErr) {
        message.error(sizeErr);
        return;
      }
      setAttachment({ file: prepared, preview: URL.createObjectURL(prepared), name: file.name || t('messages:chat.photo') });
      inputRef.current?.focus();
    } finally {
      setPreparing(false);
    }
  };

  const removeAttachment = () => {
    if (!sending) setAttachment(null);
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    attach(file);
  };

  const onPaste = (e) => {
    const file = fileFromClipboard(e);
    if (!file) return;
    // Yalnızca resim yapıştırıldıysa metin alanına bir şey yazılmasın
    if (!e.clipboardData.getData('text/plain')) e.preventDefault();
    attach(file);
  };

  /* Sürükle-bırak */
  const onDragEnter = (e) => {
    if (!hasDraggedFiles(e) || denied) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e) => {
    if (!hasDraggedFiles(e) || denied) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e) => {
    if (!hasDraggedFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    attach(files.find((f) => f.type.startsWith('image/')) || files[0]);
  };

  const send = async () => {
    const body = text.trim();
    const att = attachmentRef.current;
    if ((!body && !att) || sending || preparing || denied || body.length > MESSAGE_MAX_LENGTH) return;
    setSending(true);
    let step = 'upload';
    try {
      // 1) Resim varsa önce yükle (yeniden denemede tekrar yüklenmez)
      let mediaId = att?.mediaId;
      if (att && !mediaId) {
        setAttachment((a) => (a ? { ...a, progress: 0 } : a));
        const res = await uploadMedia(att.file, 'message', (pct) => setAttachment((a) => (a ? { ...a, progress: pct } : a)));
        mediaId = res.mediaId;
        setAttachment((a) => (a ? { ...a, mediaId, progress: 100 } : a));
      }
      // 2) Mesajı kaydet (resim varsa metin boş olabilir)
      step = 'send';
      const replyId = replyTo ? replyTo.messageId || replyTo.groupMessageId : undefined;
      if (isGroup) await groupsApi.send(groupId, body, mediaId, replyId);
      else await messagesApi.send(otherId, body, mediaId, replyId);
      setText('');
      setReplyTo(null);
      setAttachment(null);
      setFirstUnreadKey(null);
      nearBottomRef.current = true;
      setAtBottom(true);
      await load();
      inputRef.current?.focus();
    } catch (e) {
      setAttachment((a) => (a ? { ...a, progress: undefined } : a));
      if (step === 'send' && !isGroup && (isErrorCode(e, 'MESSAGE_NOT_ALLOWED', 'MESSAGE_BLOCKED') || e?.response?.status === 403)) {
        setDenied(apiErrorMessage(e, t('messages:chat.deniedMessage')));
      } else if (isErrorCode(e, 'COMMON_RATE_LIMITED') || e?.response?.status === 429) {
        message.error(apiErrorMessage(e, t('messages:chat.uploadRateLimited')));
      } else {
        message.error(apiErrorMessage(e, step === 'upload' ? t('common:image.uploadFailed') : t('messages:chat.sendFailed')));
      }
    } finally {
      setSending(false);
    }
  };

  const idsOf = (m) => (m.groupMessageId ? { groupMessageId: m.groupMessageId } : { messageId: m.messageId });

  // Tepki: anında ekranda göster, sunucu yanıtıyla tazele
  const react = async (m, emoji) => {
    setMenuKey(null);
    const current = (m.reactions || []).find((r) => r.mine)?.emoji;
    const removing = current === emoji;
    setMessages((list) =>
      list.map((x) => {
        if (x !== m) return x;
        let rs = (x.reactions || [])
          .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
          .filter((r) => r.count > 0);
        if (!removing) {
          const ex = rs.find((r) => r.emoji === emoji);
          rs = ex ? rs.map((r) => (r === ex ? { ...r, count: r.count + 1, mine: true } : r)) : [...rs, { emoji, count: 1, mine: true, names: [] }];
        }
        return { ...x, reactions: rs };
      })
    );
    try {
      await messagesApi.react(idsOf(m), removing ? null : emoji);
    } catch (e) {
      message.error(apiErrorMessage(e, t('messages:actions.reactFailed')));
    }
    load();
  };

  const startReply = (m) => {
    setMenuKey(null);
    setReplyTo(m);
    inputRef.current?.focus();
  };

  const removeMessage = (m) => {
    setMenuKey(null);
    Modal.confirm({
      title: t('messages:actions.deleteTitle'),
      content: t('messages:actions.deleteContent'),
      okText: t('messages:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await messagesApi.remove(idsOf(m));
          if (replyTo === m) setReplyTo(null);
          load();
        } catch (e) {
          message.error(apiErrorMessage(e, t('messages:actions.deleteFailed')));
        }
      },
    });
  };

  // Alıntıya tıklayınca asıl mesaja git ve kısa süre vurgula
  const jumpTo = (id) => {
    const target = messages.findIndex((x) => (x.messageId || x.groupMessageId) === id);
    if (target < 0) return;
    const key = keyOf(messages[target], target);
    document.getElementById(`mb-msg-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 1600);
  };

  // İmlecin olduğu yere emoji ekle
  const insertEmoji = (emoji) => {
    const el = inputRef.current?.resizableTextArea?.textArea;
    if (!el) {
      setText((v) => v + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const replyPreviewOf = (m) => ({
    senderName: m.sendPlayerId === me.playerId ? t('messages:chat.you') : fullName(profileOf(m)),
    text: m.matchMessage,
    hasImage: !!m.imageUrl,
    isDeleted: m.isDeleted,
  });

  const typingNames = typingIds
    .map((id) => (isGroup ? (target.data.members || []).find((p) => p.playerId === id) : target.data))
    .filter(Boolean);

  const onKeyDown = (e) => {
    // Telefonda Enter yeni satır; gönderme düğmeyle (ekran klavyesinde Shift yok)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send();
    }
  };

  const uploading = sending && attachment && attachment.progress != null && !attachment.mediaId;
  const tooLong = text.trim().length > MESSAGE_MAX_LENGTH;
  const canSend = (!!text.trim() || !!attachment) && !denied && !preparing && !tooLong;
  const showCounter = text.length > MESSAGE_MAX_LENGTH - 200;

  // Okundu bilgisi yalnızca birebir: benim son "okundu" mesajım
  const lastMineIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].sendPlayerId === me.playerId) return i;
    return -1;
  }, [messages, me.playerId]);

  const profileOf = (m) => (isGroup ? senderOf(m) : target.data);

  return (
    <div
      className={`mb-chat${dragging ? ' is-dragging' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-chat__messages" ref={listRef} onScroll={onScroll}>
        {loading ? (
          <div className="mb-center"><Spin /></div>
        ) : messages.length === 0 ? (
          <div className="mb-chat__empty">
            {isGroup ? <GroupAvatar group={target.data} me={me} size={72} /> : <PlayerAvatar player={target.data} size={72} />}
            <strong>{isGroup ? target.data.groupName : fullName(target.data)}</strong>
            <Text type="secondary">{t('messages:chat.empty')}</Text>
            <div className="mb-chat__starters">
              {['hello', 'match', 'free'].map((k) => (
                <button type="button" key={k} className="mb-chat__starter" onClick={() => { setText(t(`messages:starters.${k}`)); inputRef.current?.focus(); }}>
                  {t(`messages:starters.${k}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const mine = m.sendPlayerId === me.playerId;
            const key = keyOf(m, i);
            const showDay = !prev || !dayjs(prev.sendingDate).isSame(dayjs(m.sendingDate), 'day');
            const first = showDay || !sameRun(prev, m);
            const last = !next || !sameRun(m, next) || !dayjs(next.sendingDate).isSame(dayjs(m.sendingDate), 'day');
            const sender = !mine ? profileOf(m) : null;
            return (
              <React.Fragment key={key}>
                {showDay && <div className="mb-chat__day"><span>{dayLabel(m.sendingDate, t)}</span></div>}
                {key === firstUnreadKey && (
                  <div className="mb-chat__unread-divider"><span>{t('messages:chat.newMessages')}</span></div>
                )}
                <div
                  id={`mb-msg-${key}`}
                  className={`mb-bubble-row${mine ? ' is-mine' : ''}${first ? ' is-first' : ''}${last ? ' is-last' : ''}${flashKey === key ? ' is-flash' : ''}${m.reactions?.length ? ' has-reactions' : ''}`}
                >
                  {!mine && (
                    <span className="mb-bubble-row__avatar">
                      {last && (
                        <Tooltip title={fullName(sender)} placement="left">
                          <Link to={`/player/${m.sendPlayerId}`} onClick={onNavigate} aria-label={fullName(sender)}>
                            <PlayerAvatar player={sender} size={28} />
                          </Link>
                        </Tooltip>
                      )}
                    </span>
                  )}
                  <div className="mb-bubble-wrap">
                  <Popover
                    open={menuKey === key && !m.isDeleted}
                    onOpenChange={(o) => setMenuKey(o ? key : null)}
                    trigger={isTouch ? [] : ['contextMenu']}
                    placement={mine ? 'topRight' : 'topLeft'}
                    arrow={false}
                    overlayClassName="mb-msg-menu-pop"
                    content={
                      <MessageMenu
                        mine={mine}
                        myReaction={(m.reactions || []).find((r) => r.mine)?.emoji}
                        onReact={(e) => react(m, e)}
                        onReply={() => startReply(m)}
                        onDelete={() => removeMessage(m)}
                        onCopy={
                          m.matchMessage && navigator.clipboard
                            ? () => {
                                setMenuKey(null);
                                navigator.clipboard.writeText(m.matchMessage).then(() => message.success(t('messages:actions.copied')), () => {});
                              }
                            : undefined
                        }
                      />
                    }
                  >
                  <div
                    className={`mb-bubble${mine ? ' is-mine' : ''}${m.imageUrl ? ' has-image' : ''}${m.isDeleted ? ' is-deleted' : ''}`}
                    onTouchStart={isTouch && !m.isDeleted ? () => longPress.start(key) : undefined}
                    onTouchEnd={isTouch ? longPress.cancel : undefined}
                    onTouchMove={isTouch ? longPress.cancel : undefined}
                    onDoubleClick={!isTouch && !m.isDeleted ? () => react(m, '👍') : undefined}
                  >
                    {isGroup && !mine && first && <div className="mb-bubble__author">{fullName(sender) || t('messages:chat.member')}</div>}
                    {m.replyTo && !m.isDeleted && <ReplyQuote reply={m.replyTo} mine={mine} onClick={() => jumpTo(m.replyTo.id)} />}
                    {m.isDeleted ? (
                      <div className="mb-bubble__text is-deleted">{t('messages:chat.deleted')}</div>
                    ) : (
                      <>
                        {m.imageUrl && <BubbleImage url={m.imageUrl} onLoad={onImageLoad} />}
                        {m.matchMessage && <MessageText text={m.matchMessage} onNavigate={onNavigate} />}
                      </>
                    )}
                    <div className="mb-bubble__meta">
                      <time dateTime={m.sendingDate} title={dayjs(m.sendingDate).format('DD MMMM YYYY HH:mm')}>
                        {dayjs(m.sendingDate).format('HH:mm')}
                      </time>
                      {mine && !isGroup && (
                        <Ticks read={!!m.readAt} title={m.readAt ? t('messages:chat.seenAt', { time: dayjs(m.readAt).format('DD MMM HH:mm') }) : t('messages:chat.sent')} />
                      )}
                    </div>
                  </div>
                  </Popover>
                  {!m.isDeleted && !isTouch && (
                      <button
                        title={t('messages:actions.menu')}
                        type="button"
                        className="mb-bubble-more"
                        onClick={() => setMenuKey(menuKey === key ? null : key)}
                        aria-label={t('messages:actions.menu')}
                      >
                        <SmileOutlined />
                      </button>
                  )}
                  <ReactionChips reactions={m.reactions} onToggle={(e) => react(m, e)} />
                  </div>
                </div>
                {mine && !isGroup && i === lastMineIndex && m.readAt && (
                  <div className="mb-chat__seen">{t('messages:chat.seenAt', { time: dayjs(m.readAt).format('HH:mm') })}</div>
                )}
              </React.Fragment>
            );
          })
        )}
        {typingNames.length > 0 && (
          <div className="mb-bubble-row is-first is-last mb-typing-row">
            <span className="mb-bubble-row__avatar">
              <PlayerAvatar player={typingNames[0]} size={28} />
            </span>
            <div className="mb-bubble mb-typing-bubble" aria-live="polite">
              <TypingDots />
              <span className="mb-typing-bubble__text">
                {isGroup
                  ? t('messages:chat.typingNamed', { name: typingNames.map((p) => p.playerName || p.userName).join(', ') })
                  : t('messages:chat.typing')}
              </span>
            </div>
          </div>
        )}
      </div>

      {!atBottom && !loading && messages.length > 0 && (
        <button type="button" className="mb-chat__jump" onClick={scrollToBottom} aria-label={t('messages:chat.jumpToLatest')}>
          {newBelow > 0 && <span className="mb-chat__jump-count">{newBelow}</span>}
          <ArrowDownOutlined />
        </button>
      )}

      {denied && (
        <Alert type="warning" showIcon banner className="mb-chat__denied" message={denied} />
      )}
      {(attachment || preparing) && !denied && (
        <div className="mb-chat__attach">
          <div className="mb-attach-chip">
            {attachment ? (
              <img src={attachment.preview} alt="" className="mb-attach-chip__thumb" />
            ) : (
              <span className="mb-attach-chip__thumb is-loading"><Spin size="small" /></span>
            )}
            <div className="mb-attach-chip__body">
              <span className="mb-attach-chip__name">{attachment ? attachment.name : t('messages:chat.preparingPhoto')}</span>
              {uploading ? (
                <Progress
                  percent={attachment.progress}
                  size="small"
                  showInfo={false}
                  strokeColor="var(--mb-primary)"
                  trailColor="rgba(148,163,184,0.16)"
                  className="mb-attach-chip__progress"
                />
              ) : (
                attachment && (
                  <span className="mb-attach-chip__hint">
                    {attachment.mediaId ? t('messages:chat.uploadedWaiting') : t('messages:chat.uploadOnSend')}
                  </span>
                )
              )}
            </div>
            {attachment && (
              <Tooltip title={t('messages:chat.remove')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={removeAttachment}
                  disabled={sending}
                  aria-label={t('messages:chat.removePhoto')}
                />
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {replyTo && !denied && (
        <div className="mb-chat__reply">
          <ReplyQuote reply={replyPreviewOf(replyTo)} onClose={() => setReplyTo(null)} />
        </div>
      )}
      <div className="mb-chat__composer">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_ACCEPT} hidden onChange={onFileChange} />
        <Tooltip title={t('messages:chat.addPhotoHint')}>
          <Button
            type="text"
            shape="circle"
            className="mb-chat__photo-btn"
            icon={<PictureOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!!denied || sending || preparing}
            aria-label={t('messages:chat.addPhoto')}
          />
        </Tooltip>
        <div className="mb-chat__input">
          <Input.TextArea
            ref={inputRef}
            // Masaüstünde sohbet açılınca yazmaya hazır (telefonda klavye kendiliğinden açılmasın)
            autoFocus={window.matchMedia('(pointer: fine)').matches}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) notifyTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && replyTo) setReplyTo(null);
              onKeyDown(e);
            }}
            onPaste={onPaste}
            disabled={!!denied}
            variant="borderless"
            placeholder={
              denied
                ? t('messages:chat.deniedPlaceholder')
                : attachment
                  ? t('messages:chat.captionPlaceholder')
                  : t('messages:chat.inputPlaceholder')
            }
            autoSize={{ minRows: 1, maxRows: 5 }}
          />
          {showCounter && (
            <span className={`mb-chat__counter${tooLong ? ' is-over' : ''}`}>
              {text.trim().length}/{MESSAGE_MAX_LENGTH}
            </span>
          )}
        </div>
        {!isTouch && <EmojiPicker onPick={insertEmoji} disabled={!!denied} />}
        <Button
          type="primary"
          shape="circle"
          className="mb-chat__send"
          icon={<SendOutlined />}
          onClick={send}
          loading={sending}
          disabled={!canSend}
          aria-label={t('common:actions.send')}
        />
      </div>
      {dragging && (
        <div className="mb-chat__drop">
          <PictureOutlined />
          <span>{t('messages:chat.dropHere')}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Drawer ---------------- */
/**
 * Telefonda ekran klavyesi açılınca görünen alan (visualViewport) küçülür ama sabit konumlu
 * panel küçülmez; yazma alanı klavyenin altında kalmasın diye panelin yüksekliği/üst kenarı
 * görünen alana eşitlenir (messages.css: --mb-vv-h / --mb-vv-top).
 */
function useVisualViewportVars(active) {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!active || !vv) return undefined;
    const update = () => {
      root.style.setProperty('--mb-vv-h', `${Math.round(vv.height)}px`);
      root.style.setProperty('--mb-vv-top', `${Math.round(vv.offsetTop)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--mb-vv-h');
      root.style.removeProperty('--mb-vv-top');
    };
  }, [active]);
}

export default function MessagesDrawer({ open, target, onTargetChange, onClose, onRead }) {
  const isMobile = useIsMobile();
  useVisualViewportVars(open && isMobile);
  const navigate = useNavigate();
  const [me, setMe] = useState(getCurrentUser);
  const [infoOpen, setInfoOpen] = useState(false);
  const [listTab, setListTab] = useState('people');
  const { t } = useTranslation();

  useEffect(() => {
    if (open) setMe(getCurrentUser());
    else setInfoOpen(false);
  }, [open]);

  // Grup üyeleri / adı değişince açık grubun bilgisi tazelensin
  const isGroup = target?.type === 'group';
  const groupId = target?.data?.groupId;
  const refreshGroup = useCallback(async () => {
    if (!isGroup) return;
    try {
      const list = await groupsApi.mine();
      const fresh = list.find((g) => g.groupId === groupId);
      if (fresh) onTargetChange({ type: 'group', data: fresh });
      else {
        // Gruptan çıkarıldım / grup silindi
        setInfoOpen(false);
        setListTab('groups');
        onTargetChange(null);
      }
    } catch {
      /* bilgi tazelenemezse eski hali kalır */
    }
  }, [isGroup, groupId, onTargetChange]);

  useEffect(() => {
    if (!open || !isGroup) return undefined;
    // Başka ekrandan yalnızca groupId ile açıldıysa üyeleri yükle
    if (!target.data.members) refreshGroup();
    return onRealtime('message', (e) => {
      if (e.kind === 'groupChanged' && e.groupId === groupId) refreshGroup();
    });
  }, [open, isGroup, groupId, target, refreshGroup]);

  const goProfile = () => {
    setInfoOpen(false);
    onClose();
  };

  const back = () => {
    setListTab(isGroup ? 'groups' : 'people');
    onTargetChange(null);
  };

  const title = target ? (
    <div className="mb-chat-header">
      <Button type="text" shape="circle" icon={<ArrowLeftOutlined />} onClick={back} aria-label={t('common:actions.back')} />
      {target.type === 'user' ? (
        <button type="button" className="mb-chat-header__who" onClick={() => { onClose(); navigate(`/player/${target.data.playerId}`); }}>
          <PlayerAvatar player={target.data} size={40} />
          <span className="mb-chat-header__text">
            <span className="mb-chat-header__name">{fullName(target.data)}</span>
            <Text type="secondary" className="mb-chat-header__sub">
              {target.data.userName ? `@${target.data.userName}` : ''}
            </Text>
          </span>
        </button>
      ) : (
        <button type="button" className="mb-chat-header__who" onClick={() => setInfoOpen(true)}>
          <GroupAvatar group={target.data} me={me} size={40} />
          <span className="mb-chat-header__text">
            <span className="mb-chat-header__name">{target.data.groupName}</span>
            <Text type="secondary" className="mb-chat-header__sub">
              {target.data.members
                ? target.data.members.map((p) => p.playerName || p.userName).slice(0, 4).join(', ') +
                  (target.data.members.length > 4 ? ` +${target.data.members.length - 4}` : '')
                : t('messages:group.chat')}
            </Text>
          </span>
        </button>
      )}
    </div>
  ) : (
    <span>{t('messages:drawer.title')}</span>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={isMobile ? '100%' : 460}
      title={title}
      className="mb-messages-drawer"
      rootClassName="mb-messages-root"
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      destroyOnClose
    >
      {me &&
        (target ? (
          <Conversation
            key={`${target.type}-${target.data.playerId || target.data.groupId}`}
            me={me}
            target={target}
            onRead={onRead}
            onNavigate={goProfile}
          />
        ) : (
          <ConversationList me={me} onSelect={onTargetChange} initialTab={listTab} />
        ))}
      {isGroup && (
        <GroupInfoModal
          open={infoOpen}
          group={target.data}
          me={me}
          onClose={() => setInfoOpen(false)}
          onChanged={refreshGroup}
          onNavigate={goProfile}
          onLeft={() => {
            setInfoOpen(false);
            setListTab('groups');
            onTargetChange(null);
            onRead?.();
          }}
        />
      )}
    </Drawer>
  );
}
