import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import axios from 'axios';
import './Stadium.css';
import LocationIcon from '../../images/Location.webp';
import SelectedLocationIcon from '../../images/SelectedLocation.webp';

// Leaflet için özel ikon oluşturma
const customIcon = new L.Icon({
  iconUrl: LocationIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Seçilen stadyum için özel ikon oluşturma
const selectedCustomIcon = new L.Icon({
  iconUrl: SelectedLocationIcon,
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowSize: [45, 45],
});

// Haritayı belirli bir konuma yakınlaştırmak için bir bileşen
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Rota çizmek için bir bileşen
function Routing({ userPosition, selectedStadium }) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState(null);

  useEffect(() => {
    if (!userPosition || !selectedStadium) return;

    const newRoutingControl = L.Routing.control({
      waypoints: [
        L.latLng(userPosition[0], userPosition[1]),
        L.latLng(selectedStadium.location.split(',').map(coord => parseFloat(coord.trim()))),
      ],
      lineOptions: {
        styles: [{ color: 'blue', weight: 4 }],
      },
      createMarker: () => null,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
    }).addTo(map);

    setRoutingControl(newRoutingControl);

    return () => {
      if (newRoutingControl) {
        try {
          map.removeControl(newRoutingControl);
        } catch (error) {
          console.error('Routing kontrolü kaldırılırken hata oluştu:', error);
        }
      }
    };
  }, [userPosition, selectedStadium, map]);

  return null;
}

function Stadium() {
  const [userPosition, setUserPosition] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [selectedStadium, setSelectedStadium] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error('Konum alınamadı: ', error);
      }
    );

    axios
      .get('http://localhost:5033/api/Stadium/GetStadiumList')
      .then((response) => {
        setStadiums(response.data);
      })
      .catch((error) => {
        console.error('Halı sahalar alınamadı: ', error);
      });
  }, []);

  return (
    <div className="stadiumContainer">
      <div className="stadiumList">
        <h2>Stadyumlar</h2>
        <ul>
          {stadiums.map((stadium) => (
            <li key={stadium.stadiumId} onClick={() => setSelectedStadium(stadium)}>
              {stadium.stadiumName}
            </li>
          ))}
        </ul>
      </div>
      <div className="stadiumMapContainer">
        <MapContainer
          center={userPosition || [39.9334, 32.8597]} // Eğer kullanıcı konumu yoksa varsayılan konum (Ankara)
          zoom={userPosition ? 13 : 6}
          style={{ height: '100vh', width: '75vw', margin: '0 auto' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {selectedStadium && (
            <ChangeView center={selectedStadium.location.split(',').map(coord => parseFloat(coord.trim()))} zoom={15} />
          )}

          {/* Kullanıcının mevcut konumu */}
          {userPosition && (
            <Marker position={userPosition} icon={customIcon}>
              <Popup>Mevcut konumunuz</Popup>
            </Marker>
          )}

          {/* Halı sahaları işaretle */}
          {stadiums.map((stadium) => {
            const [lat, lon] = stadium.location.split(',').map((coord) => parseFloat(coord.trim()));
            const isSelected = selectedStadium && selectedStadium.stadiumId === stadium.stadiumId;
            return (
              <Marker key={stadium.stadiumId} position={[lat, lon]} icon={isSelected ? selectedCustomIcon : customIcon}>
                <Popup>
                  <div>
                    <h3>{stadium.stadiumName}</h3>
                    <p><strong>Adres:</strong> {stadium.address}</p>
                    <p><strong>Açılış Saati:</strong> {stadium.openingTime}</p>
                    <p><strong>Kapanış Saati:</strong> {stadium.closingTime}</p>
                    <p><strong>Açıklama:</strong> {stadium.description}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Rota çiz */}
          {userPosition && selectedStadium && (
            <Routing userPosition={userPosition} selectedStadium={selectedStadium} />
          )}
        </MapContainer>
        {selectedStadium && (
          <div className="stadiumInfo">
            <h3>{selectedStadium.stadiumName}</h3>
            <p><strong>Adres:</strong> {selectedStadium.address}</p>
            <p><strong>Açılış Saati:</strong> {selectedStadium.openingTime}</p>
            <p><strong>Kapanış Saati:</strong> {selectedStadium.closingTime}</p>
            <p><strong>Açıklama:</strong> {selectedStadium.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Stadium;
