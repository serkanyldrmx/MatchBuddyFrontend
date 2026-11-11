import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getToken } from '../api/config';
import { messagesApi } from '../api/messages';
import { onRealtime } from '../api/realtime';
import MessagesDrawer from './MessagesDrawer';

/**
 * Mesajlaşma her ekranda sağdan açılan bir panel (Drawer) olarak çalışır.
 * Herhangi bir bileşen:  const { openMessages } = useMessages();
 *   openMessages()                         -> konuşma listesini açar
 *   openMessages({ type: 'user', data })   -> doğrudan bir oyuncuyla konuşmayı açar
 *   openMessages({ type: 'group', data })  -> doğrudan bir grup konuşmasını açar
 *   isOpen                                 -> panel açık mı (mobil alt menüyü gizlemek için)
 *   unread                                 -> okunmamış mesaj sayısı (mesaj simgesindeki rozet)
 */
const MessagesContext = createContext({ openMessages: () => {}, closeMessages: () => {}, isOpen: false, unread: 0, refreshUnread: () => {} });

// Anlık bağlantı (SignalR) varken yoklama yalnızca yedektir
const UNREAD_POLL_MS = 60000;

function useUnreadCount() {
  const [unread, setUnread] = useState(0);
  const timer = useRef(null);

  const refresh = useCallback(() => {
    if (!getToken()) {
      setUnread(0);
      return;
    }
    messagesApi
      .unread()
      .then((r) => setUnread(r?.total || 0))
      .catch(() => {});
  }, []);

  // Art arda gelen sinyalleri tek istekte topla
  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 400);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, UNREAD_POLL_MS);
    const offMessage = onRealtime('message', refreshSoon);
    const offRead = onRealtime('messageRead', refreshSoon);
    const onLogin = () => refresh();
    const onLogout = () => setUnread(0);
    window.addEventListener('mb:login', onLogin);
    window.addEventListener('mb:logout', onLogout);
    return () => {
      clearInterval(poll);
      clearTimeout(timer.current);
      offMessage();
      offRead();
      window.removeEventListener('mb:login', onLogin);
      window.removeEventListener('mb:logout', onLogout);
    };
  }, [refresh, refreshSoon]);

  return { unread, refreshUnread: refreshSoon };
}

export function MessagesProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const { unread, refreshUnread } = useUnreadCount();

  const openMessages = useCallback((t = null) => {
    setTarget(t);
    setOpen(true);
  }, []);

  const closeMessages = useCallback(() => {
    setOpen(false);
    refreshUnread();
  }, [refreshUnread]);

  const changeTarget = useCallback(
    (t) => {
      setTarget(t);
      refreshUnread();
    },
    [refreshUnread]
  );

  const value = useMemo(
    () => ({ openMessages, closeMessages, isOpen: open, unread, refreshUnread }),
    [openMessages, closeMessages, open, unread, refreshUnread]
  );

  return (
    <MessagesContext.Provider value={value}>
      {children}
      <MessagesDrawer open={open} target={target} onTargetChange={changeTarget} onClose={closeMessages} onRead={refreshUnread} />
    </MessagesContext.Provider>
  );
}

export const useMessages = () => useContext(MessagesContext);
