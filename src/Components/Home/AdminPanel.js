import React, { useState, useEffect } from 'react';
import './AdminPanel.css';
import StadiumIsAdmin from '../Stadium/StadiumIsAdmin';
import Stadium from '../Stadium/Stadium';
import About from '../Information/About';
import AboutPage from '../Information/AboutPage';
import MatchAll from '../Post/MatchAll';
import Communication from '../Information/Communication';
import MatchReservation from '../AdminMatchOrganization/MatchReservation';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import Badge from '@mui/material/Badge';
import home from '../../images/home.png';
import stadium from '../../images/stadium.png';
import stadiumAdd from '../../images/status.png';
import reservation from '../../images/Reservation.png';
import communication from '../../images/Communication.png';
import about from '../../images/about us.png';
import list from '../../images/list.jpg';

const AdminPanel = () => {
  const [activeContent, setActiveContent] = useState('aboutPage');
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchMatchList = async () => {
    try {
      const response = await fetch("http://localhost:5033/api/Match/GetMatchList");
      if (!response.ok) {
        throw new Error("API isteğinde bir hata oluştu");
      }
      const data = await response.json();
      const activeMatches = data.filter(match => match.isActive === 1);
      setNotificationCount(activeMatches.length);
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  useEffect(() => {
    fetchMatchList();
  }, []);

  const handleMenuClick = (content) => {
    setActiveContent(content);
  };

  const handleNotificationClick = () => {
    setActiveContent('matchReservation');
  };

  const menuItems = [
    { name: 'Ana Sayfa', content: 'aboutPage', icon: home },
    { name: 'Halı Sahalar', content: 'stadium', icon: stadium },
    { name: 'Halı Saha Ekle', content: 'stadiumIsAdmin', icon: stadiumAdd },
    { name: 'Rezervasyon', content: 'matchReservation', icon: reservation },
    { name: 'Halı Saha Maçları', content: 'matchAll', icon: list },
    { name: 'İletişim', content: 'communication', icon: communication },
    { name: 'Hakkımızda', content: 'about', icon: about }
  ];

  const contentComponents = {
    stadium: <Stadium />,
    stadiumIsAdmin: <StadiumIsAdmin />,
    matchReservation: <MatchReservation updateNotificationCount={fetchMatchList} />,
    about: <About />,
    matchAll: <MatchAll />,
    communication: <Communication />,
    aboutPage: <AboutPage />
  };

  return (
    <div className="admin-panel">
      <div className="sidebar">
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
          Match Buddy Admin Paneli
        </span>
        <ul>
          {menuItems.map(({ name, content, icon }) => (
            <li key={content} onClick={() => handleMenuClick(content)}>
              <img src={icon} alt={name} className="player-icon" />
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <input type="text" placeholder="Search for..." />
          <div className="icons">
            <Badge badgeContent={notificationCount} color="error">
              <i
                className="notification-icon"
                style={{ cursor: 'pointer' }}
                onClick={handleNotificationClick}
              >
                <NotificationsActiveIcon fontSize='medium'/>
              </i>
            </Badge>
            <a
              href="/"
              onClick={() => {
                localStorage.setItem('user', null);
              }}
            >
              <ExitToAppIcon fontSize='medium'/>
            </a>
          </div>
        </div>

        <div className="content-area">
          {contentComponents[activeContent]}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;