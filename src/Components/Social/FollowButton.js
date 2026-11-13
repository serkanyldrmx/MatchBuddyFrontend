import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { App, Button } from 'antd';
import { CheckOutlined, UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { emit, socialApi, SOCIAL_CHANGED } from '../../api/social';
import { apiErrorMessage, fullName } from '../../utils/format';

/**
 * Takip et / Takiptesin / Geri takip et butonu.
 * player: SocialPlayerDto (iFollow, followsMe alanları) ya da en azından playerId
 * onChange(nextState): { iFollow, isMutual }
 */
export default function FollowButton({ player, size = 'middle', block, onChange }) {
  const { message, modal } = App.useApp();
  const { t } = useTranslation();
  const [iFollow, setIFollow] = useState(!!player?.iFollow);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => setIFollow(!!player?.iFollow), [player?.iFollow]);

  // Takibi bırakmak (arkadaşlığı bitirmek) onay ister: telefonda "Takibi bırak" uyarısı (hover) görünmez,
  // tek dokunuşla arkadaşlık bitmesin
  const onClick = (e) => {
    e?.stopPropagation();
    if (!iFollow) {
      toggle();
      return;
    }
    modal.confirm({
      title: t('social:follow.unfollowConfirm', { name: fullName(player) }),
      content: player?.followsMe ? t('social:follow.unfollowFriendHint') : undefined,
      okText: t('social:follow.unfollow'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: toggle,
    });
  };

  const toggle = async () => {
    setBusy(true);
    try {
      if (iFollow) {
        await socialApi.unfollow(player.playerId);
        setIFollow(false);
        onChange?.({ iFollow: false, isMutual: false });
      } else {
        const res = await socialApi.follow(player.playerId);
        setIFollow(true);
        onChange?.({ iFollow: true, isMutual: !!res?.isMutual });
        if (res?.isMutual) message.success(t('social:follow.nowFriends', { name: fullName(player) }));
      }
      emit(SOCIAL_CHANGED);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (iFollow) {
    return (
      <Button
        size={size}
        block={block}
        loading={busy}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        danger={hover}
        icon={hover ? null : <CheckOutlined />}
        className={hover ? '' : 'mb-following-btn'}
      >
        {hover ? t('social:follow.unfollow') : player?.followsMe ? t('social:follow.friends') : t('social:follow.following')}
      </Button>
    );
  }
  return (
    <Button type="primary" size={size} block={block} loading={busy} onClick={onClick} icon={<UserAddOutlined />}>
      {player?.followsMe ? t('social:follow.followBack') : t('social:follow.follow')}
    </Button>
  );
}

/** Oyuncu adını profil sayfasına bağlar */
export function PlayerLink({ player, children, className }) {
  if (!player?.playerId) return <span className={className}>{children ?? fullName(player)}</span>;
  return (
    <Link to={`/player/${player.playerId}`} className={`mb-player-link ${className || ''}`} onClick={(e) => e.stopPropagation()}>
      {children ?? fullName(player)}
    </Link>
  );
}
