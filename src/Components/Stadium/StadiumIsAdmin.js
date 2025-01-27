import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Navbar from '../Navbar/Navbar';
import './StadiumIsAdmin.css';
import axios from 'axios';
import { message } from 'antd'; // Ant Design message bileşenini import edin
import L from 'leaflet'; // Leaflet'i import edin
import LocationIcon from '../../images/Location.webp'; // Location.webp dosyasını import edin

// Sabit il ve ilçe verileri
const cities = [
  { id: 1, name: 'Ankara', districts: [{ id: 1, name: 'Çankaya' }, { id: 2, name: 'Keçiören' }] },
  { id: 2, name: 'İstanbul', districts: [{ id: 3, name: 'Kadıköy' }, { id: 4, name: 'Beşiktaş' }] },
  { id: 3, name: 'İzmir', districts: [{ id: 5, name: 'Konak' }, { id: 6, name: 'Bornova' }] },
  { id: 4, name: 'Konya', districts: [{ id: 7, name: 'Selçuklu' }, { id: 8, name: 'Karatay' }, { id: 9, name: 'Meram' }] },
  // Diğer iller ve ilçeler
];

// Leaflet için özel ikon oluşturma
const customIcon = new L.Icon({
  iconUrl: LocationIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function StadiumIsAdmin() {
  const [userPosition, setUserPosition] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [stadiumName, setStadiumName] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('Konum Ara');
  const [mapCenter, setMapCenter] = useState([39.9334, 32.8597]); // Varsayılan konum (Ankara)
  const [zoomLevel, setZoomLevel] = useState(6); // Varsayılan zoom seviyesi
  const [districts, setDistricts] = useState([]); // Dinamik ilçe verileri

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = [position.coords.latitude, position.coords.longitude];
        setUserPosition(userPos);
        setMapCenter(userPos); // Kullanıcının konumunu haritanın merkezi olarak ayarla
        setZoomLevel(13); // Kullanıcının konumuna yakınlaştır
      },
      (error) => {
        console.error('Error getting user position:', error);
      }
    );
  }, []);

  useEffect(() => {
    // İl seçildiğinde ilgili ilçeleri yükle
    const selectedCity = cities.find(c => c.id === parseInt(city));
    if (selectedCity) {
      setDistricts(selectedCity.districts);
    } else {
      setDistricts([]);
    }
  }, [city]);

  function LocationMarker() {
    useMapEvents({
      click(e) {
        setSelectedPosition([e.latlng.lat, e.latlng.lng]);
      },
    });

    return selectedPosition === null ? null : (
      <Marker position={selectedPosition} icon={customIcon}>
        <Popup>Seçilen Konum</Popup>
      </Marker>
    );
  }

  const handleSearch = async () => {
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
      if (response.data.length > 0) {
        const { lat, lon } = response.data[0];
        setSelectedPosition([lat, lon]);
        setMapCenter([lat, lon]); // Arama sonucunu haritanın merkezi olarak ayarla
        setZoomLevel(13); // Arama sonucuna yakınlaştır
      } else {
        alert('Konum bulunamadı');
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
  };

  const handleSaveStadium = async () => {
    if (!stadiumName || !selectedPosition || !city || !district || !address || !openingTime || !closingTime || !description) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    const stadiumData = {
      stadiumName,
      location: `${selectedPosition[0]}, ${selectedPosition[1]}`,
      city: parseInt(city),
      district: parseInt(district),
      address,
      openingTime: `${openingTime}:00`,
      closingTime: `${closingTime}:00`,
      description,
    };

    try {
      const response = await axios.post('http://localhost:5033/api/Stadium/SaveStadium', stadiumData);
      if (response.data.success) {
        message.success('Stadyum başarıyla kaydedildi.');
        // Formu temizle
        setStadiumName('');
        setSelectedPosition(null);
        setCity('');
        setDistrict('');
        setAddress('');
        setOpeningTime('');
        setClosingTime('');
        setDescription('');
      } else {
        message.error('Stadyum kaydedilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Error saving stadium:', error);
      message.error('Stadyum kaydedilirken bir hata oluştu.');
    }
  };

  return (
    <div>
      <div className="adminContainer">
        <div className="controlsContainer">
          <input
            type="text"
            placeholder="Stadyum İsmi"
            value={stadiumName}
            onChange={(e) => setStadiumName(e.target.value)}
            className="inputField"
            required
          />
          <input
            type="text"
            placeholder="Seçilen Konum"
            value={selectedPosition ? `${selectedPosition[0]}, ${selectedPosition[1]}` : ''}
            readOnly
            className="inputField"
            required
          />
          <label className="inputLabel">Açılış Saati</label>
          <input
            type="time"
            value={openingTime}
            onChange={(e) => setOpeningTime(e.target.value)}
            className="inputField"
            required
          />
          <label className="inputLabel">Kapanış Saati</label>
          <input
            type="time"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
            className="inputField"
            required
          />
          <select className="comboBox" value={city} onChange={(e) => setCity(e.target.value)} required>
            <option value="">İl Seçin</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
          <select className="comboBox" value={district} onChange={(e) => setDistrict(e.target.value)} required>
            <option value="">İlçe Seçin</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>{district.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Açık Adres"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="inputField"
            required
          />
          <textarea
            placeholder="Açıklama"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textareaField"
            required
          />
          <button onClick={handleSaveStadium} className="saveButton">Stadyumu Kaydet</button>
        </div>
        <div className="stadiumMapContainer">
          <MapContainer
            center={mapCenter} // Haritanın merkezi
            zoom={zoomLevel} // Yakınlaştırma seviyesi
            style={{ height: "700px", width: "100%", position: "relative" }} // Yüksekliği artırdık
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {userPosition && (
              <Marker position={userPosition} icon={customIcon}>
                <Popup>Mevcut konumunuz</Popup>
              </Marker>
            )}
            <LocationMarker />
            <div className="searchContainer">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchPlaceholder('')}
                onBlur={() => setSearchPlaceholder('Konum Ara')}
                className="searchInput"
              />
              <button onClick={handleSearch} className="searchButton">Ara</button>
            </div>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default StadiumIsAdmin;