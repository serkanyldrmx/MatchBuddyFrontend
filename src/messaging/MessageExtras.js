import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Popover, Tooltip } from 'antd';
import { CopyOutlined, DeleteOutlined, RightOutlined, RollbackOutlined, SmileOutlined, TrophyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { invokeRealtime, onRealtime } from '../api/realtime';

/** Hızlı tepkiler (sunucudaki izinli listenin önü) — maç emojileri dahil */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '⚽', '🏆'];
/** Tüm izinli tepkiler (sunucu: EFChatDal.AllowedReactions) */
export const ALL_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '👏', '💪', '⚽', '🥅', '🧤', '🏆', '🟨', '🟥', '🍻'];

/** Yazma alanındaki emoji seçici: maç / saha emojileri önce */
const EMOJI_GROUPS = [
  { key: 'match', emojis: ['⚽', '🥅', '🧤', '👟', '🏃', '🏆', '🥇', '🎽', '🟨', '🟥', '⏱️', '📍', '🏟️', '🔥', '💪', '🙌', '👏', '🤝', '🍻', '🎉', '💯', '🚀'] },
  { key: 'faces', emojis: ['😀', '😂', '🤣', '😅', '😎', '😍', '🤩', '😤', '😡', '😱', '😴', '🤔', '🙄', '😢', '🤦', '🙏', '👍', '👎', '❤️', '💔', '👀', '✅'] },
];

export function EmojiPicker({ onPick, disabled }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const content = (
    <div className="mb-emoji-picker">
      {EMOJI_GROUPS.map((g) => (
        <div key={g.key} className="mb-emoji-picker__group">
          <div className="mb-emoji-picker__title">{t(`messages:emoji.${g.key}`)}</div>
          <div className="mb-emoji-picker__grid">
            {g.emojis.map((e) => (
              <button type="button" key={e} onClick={() => onPick(e)} aria-label={e}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="topLeft" arrow={false}>
      <Button type="text" shape="circle" className="mb-chat__photo-btn" icon={<SmileOutlined />} disabled={disabled} aria-label={t('messages:emoji.open')} />
    </Popover>
  );
}

/** Mesaj üzerindeki işlem menüsü: hızlı tepkiler, tüm tepkiler, yanıtla, sil */
export function MessageMenu({ mine, myReaction, onReact, onReply, onDelete, onCopy }) {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);
  const list = more ? ALL_REACTIONS : QUICK_REACTIONS;
  return (
    <div className="mb-msg-menu">
      <div className="mb-msg-menu__reactions">
        {list.map((e) => (
          <button type="button" key={e} className={myReaction === e ? 'is-mine' : ''} onClick={() => onReact(e)} aria-label={e}>
            {e}
          </button>
        ))}
        {!more && (
          <button type="button" className="mb-msg-menu__more" onClick={() => setMore(true)} aria-label={t('messages:actions.moreReactions')}>
            +
          </button>
        )}
      </div>
      <div className="mb-msg-menu__actions">
        <Button type="text" size="small" icon={<RollbackOutlined />} onClick={onReply}>
          {t('messages:actions.reply')}
        </Button>
        {onCopy && (
          <Button type="text" size="small" icon={<CopyOutlined />} onClick={onCopy}>
            {t('messages:actions.copy')}
          </Button>
        )}
        {mine && (
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete}>
            {t('messages:actions.delete')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Balonun altındaki tepki çipleri; tıklayınca o emojiyle tepki ver / kaldır */
export function ReactionChips({ reactions, onToggle }) {
  const { t } = useTranslation();
  if (!reactions?.length) return null;
  return (
    <div className="mb-reactions">
      {reactions.map((r) => (
        <Tooltip key={r.emoji} title={r.names?.length ? r.names.join(', ') : undefined}>
          <button
            type="button"
            className={`mb-reaction${r.mine ? ' is-mine' : ''}`}
            onClick={() => onToggle(r.emoji)}
            aria-label={t('messages:actions.reactionCount', { emoji: r.emoji, count: r.count })}
          >
            <span>{r.emoji}</span>
            {r.count > 1 && <b>{r.count}</b>}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

/** Yanıtlanan mesajın alıntısı (balonun içinde ya da yazma alanının üstünde) */
export function ReplyQuote({ reply, mine, onClick, onClose }) {
  const { t } = useTranslation();
  if (!reply) return null;
  const text = reply.isDeleted ? t('messages:chat.deleted') : reply.text || (reply.hasImage ? `📷 ${t('messages:chat.photo')}` : '');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`mb-reply-quote${mine ? ' is-mine' : ''}${onClose ? ' is-composer' : ''}`} onClick={onClick}>
      <span className="mb-reply-quote__body">
        <strong>{reply.senderName || t('messages:chat.member')}</strong>
        <span>{text}</span>
      </span>
      {onClose && (
        <span
          role="button"
          tabIndex={0}
          className="mb-reply-quote__close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => e.key === 'Enter' && onClose()}
          aria-label={t('messages:actions.cancelReply')}
        >
          ×
        </span>
      )}
    </Tag>
  );
}

/** Basılı tutunca (telefon) menüyü aç */
export function useLongPress(onLongPress, ms = 450) {
  const timer = useRef(null);
  const start = useCallback(
    (arg) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onLongPress(arg), ms);
    },
    [onLongPress, ms]
  );
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { start, cancel };
}

const TYPING_SEND_MS = 3000;
const TYPING_SHOW_MS = 4500;

/**
 * "Yazıyor…": yazarken en fazla 3 sn'de bir sinyal gönderir; karşı taraftan gelen sinyali 4,5 sn gösterir.
 * Dönen: { typingIds: [playerId], notifyTyping() }
 */
export function useTyping({ isGroup, groupId, otherId, myId }) {
  const [typing, setTyping] = useState({}); // playerId -> son sinyal zamanı
  const lastSent = useRef(0);

  useEffect(() => {
    setTyping({});
    return onRealtime('typing', (e) => {
      if (e.senderId === myId) return;
      const mineConv = isGroup ? e.kind === 'group' && e.groupId === groupId : e.kind === 'user' && e.senderId === otherId;
      if (mineConv) setTyping((s) => ({ ...s, [e.senderId]: Date.now() }));
    });
  }, [isGroup, groupId, otherId, myId]);

  // Gelen mesaj "yazıyor"u bitirir
  useEffect(
    () =>
      onRealtime('message', (e) => {
        if (e.senderId) setTyping((s) => (s[e.senderId] ? { ...s, [e.senderId]: 0 } : s));
      }),
    []
  );

  // Süresi dolanları temizle
  useEffect(() => {
    const ids = Object.keys(typing).filter((k) => typing[k]);
    if (!ids.length) return undefined;
    const timer = setTimeout(() => {
      const now = Date.now();
      setTyping((s) => Object.fromEntries(Object.entries(s).filter(([, at]) => at && now - at < TYPING_SHOW_MS)));
    }, 1000);
    return () => clearTimeout(timer);
  }, [typing]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < TYPING_SEND_MS) return;
    lastSent.current = now;
    if (isGroup) invokeRealtime('TypingGroup', groupId);
    else invokeRealtime('Typing', otherId);
  }, [isGroup, groupId, otherId]);

  const now = Date.now();
  const typingIds = Object.entries(typing)
    .filter(([, at]) => at && now - at < TYPING_SHOW_MS)
    .map(([id]) => Number(id));
  return { typingIds, notifyTyping };
}

export function TypingDots() {
  return (
    <span className="mb-typing-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/* ---------------- Mesaj metni: bağlantılar + maç kartı ---------------- */

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
// Uygulamanın maç bağlantıları: davet linki (/m/KOD, /davet/KOD) ya da maç detayı (/match-details/ID)
const SHARE_RE = /\/(?:m|davet)\/([A-Za-z0-9]{4,16})(?=[/?#]|$)/;
const DETAIL_RE = /\/match-details\/(\d+)(?=[/?#]|$)/;

/** Mesajdaki ilk maç bağlantısının uygulama içi yolu (yoksa null) */
export function matchLinkOf(text) {
  if (!text) return null;
  const urls = text.match(URL_RE) || [];
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      const share = u.pathname.match(SHARE_RE);
      if (share) return `/davet/${share[1]}`;
      const detail = u.pathname.match(DETAIL_RE);
      if (detail) return `/match-details/${detail[1]}`;
    } catch {
      /* geçersiz adres: atla */
    }
  }
  return null;
}

/**
 * Sohbet balonundaki metin: adresler tıklanabilir; maç bağlantısı varsa altında "Maçı aç / katıl" kartı.
 * onNavigate: uygulama içi bağlantıya gidilirken (mesaj panelini kapatmak için) çağrılır.
 */
export function MessageText({ text, onNavigate }) {
  const { t } = useTranslation();
  const matchPath = matchLinkOf(text);
  const parts = text.split(URL_RE);
  return (
    <>
      <div className="mb-bubble__text">
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="mb-bubble__link">
              {part}
            </a>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </div>
      {matchPath && (
        <Link to={matchPath} onClick={onNavigate} className="mb-bubble__match">
          <TrophyOutlined className="mb-bubble__match-icon" />
          <span>{matchPath.startsWith('/davet/') ? t('messages:chat.matchJoin') : t('messages:chat.matchOpen')}</span>
          <RightOutlined />
        </Link>
      )}
    </>
  );
}
