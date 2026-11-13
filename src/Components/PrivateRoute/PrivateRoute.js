import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken } from '../../api/config';
import { getCurrentUser } from '../../utils/format';
import { homePathFor, roleOf } from '../../utils/roles';
import { rememberReturnTo } from '../../utils/returnTo';

/**
 * Rol bazlı rota koruması (yetki kontrolü asıl olarak sunucuda yapılır).
 * role: bu rotalara girebilecek rol (ROLE.PLAYER / ROLE.ADMIN / ROLE.OWNER)
 */
const PrivateRoute = ({ role }) => {
  const user = getCurrentUser();
  const location = useLocation();
  if (!user || !getToken()) {
    rememberReturnTo(`${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }
  if (roleOf(user) !== role) {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return <Outlet />;
};

/** Giriş / kayıt sayfaları: oturum açıksa doğrudan uygulamaya (geri kaydırınca girişe düşmesin) */
export const GuestOnly = ({ children }) => {
  const user = getCurrentUser();
  if (user && getToken()) return <Navigate to={homePathFor(user)} replace />;
  return children;
};

/** Ana ekrana eklenen uygulama (PWA / iPhone uygulaması) tanıtım sitesini değil, uygulamayı açar */
const isInstalledApp = () =>
  !!window.Capacitor?.isNativePlatform?.() ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export const LandingGate = ({ children }) => {
  if (!isInstalledApp()) return children;
  const user = getCurrentUser();
  return <Navigate to={user && getToken() ? homePathFor(user) : '/login'} replace />;
};

export default PrivateRoute;
