import { api } from './config';

/** Kimlik doğrulama uç noktaları — sözleşme: MatcBuddy/docs/auth-api.md */
export const authApi = {
  login: (userName, password, rememberMe = true) =>
    api.post('/api/Auth/Login', { userName, password, rememberMe }).then((r) => r.data),
  /** { google: { clientId } | null, facebook: { appId } | null } */
  providers: () => api.get('/api/Auth/Providers').then((r) => r.data),
  google: (idToken, rememberMe = true) => api.post('/api/Auth/Google', { idToken, rememberMe }).then((r) => r.data),
  facebook: (accessToken, rememberMe = true) =>
    api.post('/api/Auth/Facebook', { accessToken, rememberMe }).then((r) => r.data),
  /** channel: "email" | "sms" — yanıt her zaman aynı (hesap var/yok sızdırılmaz) */
  forgotPassword: (identifier, channel) =>
    api.post('/api/Auth/ForgotPassword', { identifier, channel }).then((r) => r.data),
  resetPassword: (identifier, code, newPassword) =>
    api.post('/api/Auth/ResetPassword', { identifier, code, newPassword }).then((r) => r.data),
  changePassword: (currentPassword, newPassword) =>
    api.post('/api/Auth/ChangePassword', { currentPassword, newPassword }).then((r) => r.data),
  logoutAll: () => api.post('/api/Auth/LogoutAll').then((r) => r.data),
  acceptTerms: (termsVersion, marketingConsent = false) =>
    api.post('/api/Auth/AcceptTerms', { termsVersion, marketingConsent }).then((r) => r.data),
  verifyEmail: (code) => api.post('/api/Auth/VerifyEmail', { code }).then((r) => r.data),
  resendVerification: () => api.post('/api/Auth/ResendVerification').then((r) => r.data),
};
