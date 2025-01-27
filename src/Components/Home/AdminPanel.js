import React, { useState } from 'react';
import './AdminPanel.css';
import StadiumIsAdmin from '../Stadium/StadiumIsAdmin';
import Stadium from '../Stadium/Stadium';
import About from '../Information/About';
import AboutPage from '../Information/AboutPage';
import MatchAll from '../Post/MatchAll';  // Home bileşenini import ettik
import Communication from '../Information/Communication';
import MatchReservation from '../AdminMatchOrganization/MatchReservation';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import home from '../../images/home.png';
import stadium from '../../images/stadium.png';
import stadiumAdd from '../../images/status.png';
import reservation from '../../images/Reservation.png';
import communication from '../../images/Communication.png';
import about from '../../images/about us.png';
import list from '../../images/list.jpg';

const AdminPanel = () => {
  const [activeContent, setActiveContent] = useState('aboutPage');

  const handleMenuClick = (content) => {
    setActiveContent(content);
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
    matchReservation: <MatchReservation />,
    about: <About />,
    matchAll: <MatchAll />,  // AdminPanel'de Home'u content-area içinde göstermek için
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
            <i className="notification-icon">🔔</i>
            <a
              href="/"
              onClick={() => {
                localStorage.setItem('user', null);
              }}
            >
              <ExitToAppIcon />
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
