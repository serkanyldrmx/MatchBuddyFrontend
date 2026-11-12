// Kullanıcı rolleri (backend Players.Role) — sözleşme: MatcBuddy/docs/venues-api.md
export const ROLE = { PLAYER: 0, ADMIN: 1, OWNER: 2 };

/** Eski oturumlarda `role` olmayabilir; isAdmin'den türet */
export const roleOf = (user) => {
  if (!user) return null;
  if (typeof user.role === 'number') return user.role;
  return user.isAdmin === 1 ? ROLE.ADMIN : ROLE.PLAYER;
};

/** Rolün ana sayfası */
export const homePathFor = (user) => {
  const r = roleOf(user);
  if (r === ROLE.ADMIN) return '/adminPanel';
  if (r === ROLE.OWNER) return '/venue';
  return '/home';
};
