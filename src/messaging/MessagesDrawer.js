import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Drawer, Empty, Form, Image, Input, List, Modal, Progress, Segmented, Select, Spin, Tooltip, Typography, message } from 'antd';
import { ArrowLeftOutlined, CloseOutlined, PictureOutlined, PlusOutlined, SearchOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { uploadMedia } from '../api/media';
import { socialApi } from '../api/social';
import { onRealtime } from '../api/realtime';
import { PlayerAvatar } from '../ui';
import { apiErrorMessage, fromNow, isErrorCode, fullName, getCurrentUser, mediaUrl } from '../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, imageError, preparedImageError, prepareImage } from '../utils/image';
import './messages.css';

const { Text } = Typography;
// Anlık bağlantı (SignalR) varken yoklama yalnızca yedektir
const POLL_MS = 30000;

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
};

/* ---------------- Konuşma listesi ---------------- */
const matchesQuery = (p, q) =>
  !q || fullName(p).toLocaleLowerCase('tr').includes(q) || (p.userName || '').toLocaleLowerCase('tr').includes(q);

function PersonItem({ player, last, onSelect }) {
  const { t } = useTranslation();
  return (
    <List.Item className="mb-chat-item" onClick={() => onSelect({ type: 'user', data: player })}>
      <List.Item.Meta
        avatar={<PlayerAvatar player={player} size={42} />}
        title={
          <div className="mb-chat-item__title">
            <span className="mb-chat-item__name">
              <span className="mb-chat-item__fullname">{fullName(player)}</span>
              {player.isMutual && <span className="mb-chat-item__badge">{t('messages:list.friendBadge')}</span>}
            </span>
            {last && <Text type="secondary" className="mb-chat-item__time">{fromNow(last.sendingDate)}</Text>}
          </div>
        }
        description={
          <Text type="secondary" ellipsis>
            {last ? (last.mine ? t('messages:list.youPrefix', { text: last.text }) : last.text) : `@${player.userName}`}
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
  const { t } = useTranslation();

  const loadGroups = useCallback(() => api.get('/api/Groups/GetGroupList').then((r) => setGroups(r.data || [])), []);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    Promise.all([socialApi.messageContacts().then((list) => setContacts(list || [])), loadGroups()])
      .catch((e) => message.error(apiErrorMessage(e, t('messages:list.loadFailed'))))
      .finally(() => setLoading(false));
  }, [me, loadGroups, t]);

  // Yeni mesaj gelince konuşma listesi (son mesaj / sıra) tazelenir
  useEffect(() => {
    if (!me) return undefined;
    return onRealtime('message', () => {
      socialApi.messageContacts().then((list) => setContacts(list || [])).catch(() => {});
    });
  }, [me]);

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
        message.error(apiErrorMessage(e, t('messages:group.followingLoadFailed')));
      });
  }, [groupModal, following, t]);

  const filteredGroups = useMemo(
    () => groups.filter((g) => !q || (g.groupName || '').toLocaleLowerCase('tr').includes(q)),
    [groups, q]
  );

  const createGroup = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/api/Groups/SaveGroup', { groupName: values.groupName, playerList: values.players });
      message.success(t('messages:group.created'));
      setGroupModal(false);
      form.resetFields();
      loadGroups();
      setTab('groups');
    } catch (e) {
      message.error(apiErrorMessage(e, t('messages:group.createFailed')));
    }
  };

  const peopleEmpty = !chats.length && !friends.length && !otherResults.length;
  const emptyText = !q
    ? t('messages:list.emptyChats')
    : search.trim().length < 2
      ? t('messages:list.noContactFound')
      : t('messages:list.noPlayerFound');

  return (
    <div className="mb-chat-list">
      <div className="mb-chat-list__toolbar">
        <Segmented
          block
          value={tab}
          onChange={setTab}
          options={[
            { label: t('messages:list.tabPeople'), value: 'people' },
            { label: t('messages:list.tabGroups'), value: 'groups' },
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
        ) : (
          <List
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('messages:group.empty')}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModal(true)}>
                    {t('messages:group.create')}
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
                  description={<Text type="secondary">{t('messages:group.chat')}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      <Modal
        title={t('messages:group.modalTitle')}
        open={groupModal}
        onOk={createGroup}
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
            <Select
              mode="multiple"
              placeholder={t('messages:group.membersPlaceholder')}
              optionFilterProp="label"
              loading={!following}
              notFoundContent={following ? t('messages:group.noFollowing') : <Spin size="small" />}
              options={(following || []).map((p) => ({ value: p.playerId, label: `${fullName(p)} (@${p.userName})` }))}
            />
          </Form.Item>
          <Text type="secondary">{t('messages:group.creatorNote')}</Text>
        </Form>
      </Modal>
    </div>
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
 * onLoad sarmalayıcıya gider; React'te img yüklenme olayı üst öğeye de ulaşır.
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

function Conversation({ me, target }) {
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
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const nearBottomRef = useRef(true);
  const dragDepth = useRef(0);
  const attachmentRef = useRef(null);
  attachmentRef.current = attachment;
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
      if (e?.response?.status !== 401) message.error(apiErrorMessage(e, t('messages:chat.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [isGroup, target, me, t]);

  // İlk yükleme + anlık sinyal (SignalR) + yedek yoklama
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setDenied(null);
    load();
    const timer = setInterval(load, POLL_MS);
    const off = onRealtime('message', (e) => {
      if (isGroup ? e.kind === 'group' && e.groupId === target.data.groupId
        : e.kind === 'user' && [e.senderId, e.recipientId].includes(target.data.playerId)) load();
    });
    return () => {
      clearInterval(timer);
      off();
    };
  }, [load, isGroup, target]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Önizleme adresini serbest bırak (kaldırıldığında / değiştiğinde / kapanışta)
  const previewUrl = attachment?.preview;
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Resim geç yüklenince en altta kalalım
  const onImageLoad = useCallback(() => {
    if (nearBottomRef.current) bottomRef.current?.scrollIntoView();
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
    if ((!body && !att) || sending || preparing || denied) return;
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
      const now = new Date().toISOString();
      const media = mediaId ? { mediaId } : {};
      if (isGroup) {
        await api.post('/api/GroupsMessage/SaveGroupMessage', {
          groupId: target.data.groupId,
          matchMessage: body,
          sendingDate: now,
          sendPlayerId: me.playerId,
          status: 0,
          ...media,
        });
      } else {
        await api.post('/api/Message/MessageSave', {
          recipientPlayerId: target.data.playerId,
          sendPlayerId: me.playerId,
          matchMessage: body,
          sendingDate: now,
          status: 1,
          ...media,
        });
      }
      setText('');
      setAttachment(null);
      nearBottomRef.current = true;
      await load();
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

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const uploading = sending && attachment && attachment.progress != null && !attachment.mediaId;
  const canSend = (!!text.trim() || !!attachment) && !denied && !preparing;

  // Gün ayraçlarıyla birlikte mesajlar
  let lastDay = null;

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
          <div className="mb-center">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('messages:chat.empty')} />
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
                  <div className={`mb-bubble${mine ? ' is-mine' : ''}${m.imageUrl ? ' has-image' : ''}`}>
                    {isGroup && !mine && <div className="mb-bubble__author">{m.userName || t('messages:chat.member')}</div>}
                    {m.imageUrl && <BubbleImage url={m.imageUrl} onLoad={onImageLoad} />}
                    {m.matchMessage && <div className="mb-bubble__text">{m.matchMessage}</div>}
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
      <div className="mb-chat__composer">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_ACCEPT} hidden onChange={onFileChange} />
        <Tooltip title={t('messages:chat.addPhotoHint')}>
          <Button
            type="text"
            className="mb-chat__photo-btn"
            icon={<PictureOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!!denied || sending || preparing}
            aria-label={t('messages:chat.addPhoto')}
          />
        </Tooltip>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          disabled={!!denied}
          placeholder={
            denied
              ? t('messages:chat.deniedPlaceholder')
              : attachment
                ? t('messages:chat.captionPlaceholder')
                : t('messages:chat.inputPlaceholder')
          }
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={1000}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={send} loading={sending} disabled={!canSend} aria-label={t('common:actions.send')} />
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

export default function MessagesDrawer({ open, target, onTargetChange, onClose }) {
  const isMobile = useIsMobile();
  useVisualViewportVars(open && isMobile);
  const [me, setMe] = useState(getCurrentUser);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) setMe(getCurrentUser());
  }, [open]);

  const title = target ? (
    <div className="mb-chat-header">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => onTargetChange(null)} aria-label={t('common:actions.back')} />
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
          {target.type === 'user' ? `@${target.data.userName}` : t('messages:group.chat')}
        </Text>
      </div>
    </div>
  ) : (
    <span>{t('messages:drawer.title')}</span>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={isMobile ? '100%' : 440}
      title={title}
      className="mb-messages-drawer"
      rootClassName="mb-messages-root"
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
