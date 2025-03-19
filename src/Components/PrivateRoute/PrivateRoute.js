import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = ({ adminOnly }) => {
  const user = JSON.parse(localStorage.getItem('user'));

  if (!user) {
    return <Navigate to="/" />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/home" />;
  }

  if (!adminOnly && user.isAdmin) {
    return <Navigate to="/adminPanel" />;
  }

  return <Outlet />;
};

export default PrivateRoute;