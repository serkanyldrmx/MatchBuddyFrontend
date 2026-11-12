import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../../api/config';
import { getCurrentUser } from '../../utils/format';
import { homePathFor, roleOf } from '../../utils/roles';

/**
 * Rol bazlı rota koruması (yetki kontrolü asıl olarak sunucuda yapılır).
 * role: bu rotalara girebilecek rol (ROLE.PLAYER / ROLE.ADMIN / ROLE.OWNER)
 */
const PrivateRoute = ({ role }) => {
  const user = getCurrentUser();
  if (!user || !getToken()) {
    return <Navigate to="/login" replace />;
  }
  if (roleOf(user) !== role) {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return <Outlet />;
};

export default PrivateRoute;
