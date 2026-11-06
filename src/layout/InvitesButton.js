import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Tooltip } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { INVITES_CHANGED, invitesApi } from '../api/social';

/** Üst bardaki davetler butonu: bekleyen maç/takım daveti sayısı */
export default function InvitesButton() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    invitesApi.pendingCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    window.addEventListener(INVITES_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(INVITES_CHANGED, load);
    };
  }, [load]);

  return (
    <Tooltip title="Davetler">
      <Badge count={count} size="small" offset={[-4, 4]}>
        <Button className="mb-icon-btn" icon={<InboxOutlined />} onClick={() => navigate('/invites')} aria-label="Davetler" />
      </Badge>
    </Tooltip>
  );
}
