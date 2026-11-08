import React, { useCallback, useState } from 'react';
import { Checkbox, Modal, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { saveSession } from '../../api/config';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../utils/format';
import { homePathFor, roleOf, ROLE } from '../../utils/roles';

/**
 * Giriş yanıtı (AuthLoginResponse) sonrası ortak akış — kullanıcı adı/şifre, Google ve Facebook için aynı:
 *  1) oturumu sakla
 *  2) güncel koşullar kabul edilmemişse (consentRequired) onay penceresi
 *  3) sosyal girişle yeni açılan ve profili eksik oyuncu → profil düzenleme, diğerleri → ana sayfa
 */
export default function useLoginFlow() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pending, setPending] = useState(null); // onay bekleyen giriş yanıtı
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  const go = useCallback((data) => {
    const player = data.player;
    message.success(t('auth:login.success'));
    if (data.isNew && data.profileIncomplete && roleOf(player) === ROLE.PLAYER) {
      message.info(t('auth:social.completeProfile'));
      navigate('/userUpdate', { replace: true });
      return;
    }
    navigate(homePathFor(player), { replace: true });
  }, [navigate, t]);

  const finish = useCallback((data) => {
    if (!data || !data.token || !data.player) {
      message.error(t('auth:login.failed'));
      return;
    }
    saveSession(data);
    if (data.consentRequired) {
      setAccepted(false);
      setMarketing(false);
      setPending(data);
      return;
    }
    go(data);
  }, [go, t]);

  const accept = async () => {
    setSaving(true);
    try {
      const res = await authApi.acceptTerms(pending.termsVersion, marketing);
      const data = { ...pending, player: res.player || pending.player, consentRequired: false };
      saveSession(data);
      setPending(null);
      go(data);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const termsModal = (
    <Modal
      open={Boolean(pending)}
      title={t('auth:terms.modalTitle')}
      okText={t('auth:terms.continue')}
      cancelButtonProps={{ style: { display: 'none' } }}
      closable={false}
      maskClosable={false}
      okButtonProps={{ disabled: !accepted, loading: saving }}
      onOk={accept}
    >
      <p>{t('auth:terms.modalText')}</p>
      <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
        <Trans i18nKey="auth:terms.accept" components={{ a: <Link to="/terms" target="_blank" rel="noopener" /> }} />
      </Checkbox>
      <div style={{ marginTop: 8 }}>
        <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)}>
          {t('auth:terms.marketing')}
        </Checkbox>
      </div>
    </Modal>
  );

  return { finish, termsModal };
}
