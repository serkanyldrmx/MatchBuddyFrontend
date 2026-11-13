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

export default PrivateRoute;
