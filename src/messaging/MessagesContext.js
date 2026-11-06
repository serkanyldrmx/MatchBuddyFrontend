import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import MessagesDrawer from './MessagesDrawer';

/**
 * Mesajlaşma her ekranda sağdan açılan bir panel (Drawer) olarak çalışır.
 * Herhangi bir bileşen:  const { openMessages } = useMessages();
 *   openMessages()                         -> konuşma listesini açar
 *   openMessages({ type: 'user', data })   -> doğrudan bir oyuncuyla konuşmayı açar
 *   openMessages({ type: 'group', data })  -> doğrudan bir grup konuşmasını açar
 */
const MessagesContext = createContext({ openMessages: () => {}, closeMessages: () => {} });

export function MessagesProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null);

  const openMessages = useCallback((t = null) => {
    setTarget(t);
    setOpen(true);
  }, []);

  const closeMessages = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ openMessages, closeMessages }), [openMessages, closeMessages]);

  return (
    <MessagesContext.Provider value={value}>
      {children}
      <MessagesDrawer open={open} target={target} onTargetChange={setTarget} onClose={closeMessages} />
    </MessagesContext.Provider>
  );
}

export const useMessages = () => useContext(MessagesContext);
