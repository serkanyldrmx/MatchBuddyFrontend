import React, { useEffect, useRef, useState } from 'react';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../utils/format';
import { requestLanguage } from '../../api/config';

/**
 * Google ve Facebook ile giriş. Butonlar yalnızca sunucuda yapılandırılmış sağlayıcılar için görünür
 * (GET /api/Auth/Providers). Sağlayıcının verdiği token sunucuda doğrulanır — docs/auth-api.md.
 */

const loadScript = (id, src) => new Promise((resolve, reject) => {
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.dataset.loaded) resolve();
    else existing.addEventListener('load', () => resolve());
    return;
  }
  const s = document.createElement('script');
  s.id = id;
  s.src = src;
  s.async = true;
  s.defer = true;
  s.onload = () => { s.dataset.loaded = '1'; resolve(); };
  s.onerror = reject;
  document.body.appendChild(s);
});

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ verticalAlign: '-4px' }}>
    <path fill="currentColor" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
  </svg>
);

export default function SocialLogin({ rememberMe = true, onSuccess }) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState(null);
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);
  const rememberRef = useRef(rememberMe);
  rememberRef.current = rememberMe;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    let alive = true;
    authApi.providers().then((p) => alive && setProviders(p)).catch(() => alive && setProviders({}));
    return () => { alive = false; };
  }, []);

  const signIn = async (call) => {
    setBusy(true);
    try {
      const data = await call();
      onSuccessRef.current?.(data);
    } catch (err) {
      message.error(apiErrorMessage(err, t('auth:social.failed')));
    } finally {
      setBusy(false);
    }
  };

  // Google Identity Services: resmi buton (tema/dil ile)
  const googleClientId = providers?.google?.clientId;
  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;
    loadScript('google-gsi', 'https://accounts.google.com/gsi/client')
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp) => {
            if (resp?.credential) signIn(() => authApi.google(resp.credential, rememberRef.current));
          },
        });
        const dark = document.documentElement.dataset.theme === 'dark';
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(googleRef.current.offsetWidth || 360, 400),
          locale: requestLanguage(),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId]);

  const facebookAppId = providers?.facebook?.appId;
  useEffect(() => {
    if (!facebookAppId) return;
    const locale = requestLanguage() === 'tr' ? 'tr_TR' : 'en_US';
    window.fbAsyncInit = () => {
      window.FB.init({ appId: facebookAppId, cookie: false, xfbml: false, version: 'v19.0' });
    };
    loadScript('facebook-jssdk', `https://connect.facebook.net/${locale}/sdk.js`).catch(() => {});
  }, [facebookAppId]);

  const facebookLogin = () => {
    if (!window.FB) {
      message.error(t('auth:social.failed'));
      return;
    }
    window.FB.login((resp) => {
      const token = resp?.authResponse?.accessToken;
      if (token) signIn(() => authApi.facebook(token, rememberRef.current));
    }, { scope: 'public_profile,email' });
  };

  if (!googleClientId && !facebookAppId) return null;

  return (
    <div className="mb-auth__social">
      <div className="mb-auth__divider"><span>{t('auth:social.or')}</span></div>
      {googleClientId && <div ref={googleRef} className="mb-auth__google" />}
      {facebookAppId && (
        <Button size="large" block className="mb-auth__facebook" icon={<FacebookIcon />} loading={busy} onClick={facebookLogin}>
          {t('auth:social.facebook')}
        </Button>
      )}
    </div>
  );
}
