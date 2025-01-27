import React from 'react';
import './AboutPage.css';
import aboutImage from '../../images/top.png'; // Görselin yolunu ekleyin
import mackolikIcon from '../../images/Mackolik.png'; // Mackolik ikonunu ekleyin
import sosyalHalısahaIcon from '../../images/sosyal_Halısaha.png'; // Sosyal Halısaha ikonunu ekleyin
import beinSports from '../../images/bein_Sports.png'; // bein Sports ikonunu ekleyin
import varSistemi from '../../images/varSistemi.png'; // bein Sports ikonunu ekleyin

function AboutPage() {
  return (
    <div className="about-page">
      {/* Başlık ve Alt Başlık */}
      <div className="about-header">
        <h1>Hakkımızda</h1>
        <p>
          Match Buddy, spor severlerin halı saha rezervasyonlarını kolaylaştırmak ve 
          ekipler arasında iletişim kurmalarını sağlamak için tasarlanmış bir platformdur.
        </p>
      </div>

      {/* Görsel ve Açıklama */}
      <div className="about-content">
        <img src={aboutImage} alt="About Match Buddy" className="about-image" />
        <div className="about-text">
          <h2>Amacımız</h2>
          <p>
            Sporun birleştirici gücüne inanıyoruz. Kullanıcılarımızın daha kolay maç organize edebilmeleri, 
            ekiplerini oluşturabilmeleri ve eğlenceli bir deneyim yaşamaları için buradayız.
          </p>
          <h2>Avantajlarımız</h2>
          <ul>
            <li>Kolay rezervasyon yönetimi</li>
            <li>Ekipler arasında hızlı iletişim</li>
            <li>Güvenilir saha bilgisi ve fiyatlandırma</li>
          </ul>
        </div>
      </div>

      {/* Kartlar Bölümü */}
      <div className="about-cards">
        <div className="card">
          <h3>Hızlı Rezervasyon</h3>
          <p>Halı saha rezervasyonlarınızı birkaç tıkla yapabilirsiniz.</p>
        </div>
        <div className="card">
          <h3>Takım Yönetimi</h3>
          <p>Takım arkadaşlarınızı kolayca ekleyin ve organize olun.</p>
        </div>
        <div className="card">
          <h3>Güvenilir Bilgi</h3>
          <p>Halı saha bilgilerine ve kullanıcı yorumlarına anında erişin.</p>
        </div>
      </div>

      {/* Butonlar */}
      <div className="external-links">
        <h3>Diğer Maç Siteleri</h3>
        <div className="button-container">
          <a href="https://www.mackolik.com" target="_blank" rel="noopener noreferrer">
            <button className="external-link-btn">
              <img src={mackolikIcon} alt="Mackolik" className="external-link-icon" />
              Mackolik
            </button>
          </a>
          <a href="https://www.sosyalhalisaha.com" target="_blank" rel="noopener noreferrer">
            <button className="external-link-btn">
              <img src={sosyalHalısahaIcon} alt="Sosyal Halısaha" className="external-link-icon" />
              Sosyal Halısaha
            </button>
          </a>
          <a href="https://beinsports.com.tr" target="_blank" rel="noopener noreferrer">
            <button className="external-link-btn">
              <img src={beinSports} alt="Bein Sports" className="external-link-icon" />
              Bein Sports
            </button>
          </a>
          <a href="https://varsistemi.com" target="_blank" rel="noopener noreferrer">
            <button className="external-link-btn">
              <img src={varSistemi} alt="Var Sistemi" className="external-link-icon" />
              Var Sistemi
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
