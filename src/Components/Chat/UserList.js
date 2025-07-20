// src/Components/Chat/UserList.js

import React from 'react';
import { UserOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';

function UserList({ users, onSelectUser }) {
  return (
    <div className="user-list">
      {/* Arkadaşlarım Başlığı - Tıklanamaz */}
      <div className="friends-title">Arkadaşlarım</div>
      
      {/* Kullanıcıları listeleme */}
      {users.map(user => (
        <div key={user.playerId} onClick={() => onSelectUser(user)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={40}
            src={
              user.profilePictureUrl
                ? user.profilePictureUrl.startsWith("http")
                  ? user.profilePictureUrl
                  : `http://localhost:5033${user.profilePictureUrl}`
                : undefined
            }
            icon={!user.profilePictureUrl ? <UserOutlined /> : undefined}
            style={{ backgroundColor: '#b0d4d3' }}
          />
          {user.playerName} {user.playerSurname}
        </div>
      ))}
    </div>
  );
}

export default UserList;
