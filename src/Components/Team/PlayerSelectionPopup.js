import React, { useState, useEffect } from "react";
import { Modal, Checkbox, Button, List, Spin, Input, message } from "antd"; // message eklendi
import axios from "axios";
import "./PlayerSelectionPopup.css";

const PlayerSelectionPopup = ({ visible, onClose, teamPlayers = [], onSave, teamName, teamId }) => {
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // Arama terimi için state

  useEffect(() => {
    // Oyuncu listesini API'den al
    axios.get("http://localhost:5033/api/Players/GetPlayerList")
      .then(response => {
        setPlayers(response.data);
        setSelectedPlayers(teamPlayers || []); // Mevcut takım oyuncularını seçili yap
      })
      .catch(error => {
        console.error("Oyuncular alınırken hata oluştu:", error);
      });
  }, [teamPlayers]);

  const handleCheckboxChange = (playerName) => {
    if (selectedPlayers.includes(playerName)) {
      setSelectedPlayers(selectedPlayers.filter(name => name !== playerName));
    } else {
      setSelectedPlayers([...selectedPlayers, playerName]);
    }
  };

  const handleSave = () => {
    // Tüm seçili oyuncuları API'ye gönder
    const payload = {
      teamId: teamId,
      playerIds: selectedPlayers.map(playerName => {
        const player = players.find(p => p.userName === playerName);
        return player ? player.playerId : null;
      }).filter(id => id !== null) // Geçerli playerId'leri filtrele
    };

    axios.post("http://localhost:5033/api/Team/SaveTeamByPlayerId", payload)
      .then(response => {
        message.success("Oyuncular başarıyla kaydedildi.");
        onSave(selectedPlayers); // Seçilen oyuncuları üst bileşene aktar
        onClose(); // Popup'ı kapat
      })
  };

  // Arama filtresi
  const filteredPlayers = players.filter(player =>
    player.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      title={`Takım İsmi : ${teamName}`} // Takım ismini başlıkta göster
      visible={visible}
      onCancel={onClose}
      footer={null}
      className="player-selection-popup"
    >
      <Input
        placeholder="Oyuncu ara..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: "15px" }}
      />
      {players.length === 0 ? (
        <Spin tip="Yükleniyor..." />
      ) : (
        <div className="player-list-container">
          <List
            dataSource={filteredPlayers} // Filtrelenmiş oyuncuları göster
            renderItem={(player) => (
              <List.Item>
                <Checkbox
                  checked={selectedPlayers.includes(player.userName)}
                  onChange={() => handleCheckboxChange(player.userName)}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {player.profilePictureUrl ? (
                      <img
                        src={player.profilePictureUrl.startsWith('http') ? player.profilePictureUrl : `http://localhost:5033${player.profilePictureUrl}`}
                        alt={player.userName}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', marginRight: 8, background: '#eee' }}
                        onError={e => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.parentNode.appendChild(Object.assign(document.createElement('div'), {
                            innerText: player.userName[0].toUpperCase(),
                            style: 'width:32px;height:32px;border-radius:50%;background:#bdbdbd;color:#fff;display:flex;align-items:center;justify-content:center;margin-right:8px;font-weight:bold;'
                          }));
                        }}
                      />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#bdbdbd', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, fontWeight: 'bold' }}>
                        {player.userName[0].toUpperCase()}
                      </div>
                    )}
                    {player.userName} - {player.position} - {player.userScore} Puan
                  </span>
                </Checkbox>
              </List.Item>
            )}
          />
        </div>
      )}
      <div className="popup-footer">
        <Button onClick={onClose} style={{ marginRight: "10px" }}>
          İptal
        </Button>
        <Button type="primary" onClick={handleSave}>
          Kaydet
        </Button>
      </div>
    </Modal>
  );
};

export default PlayerSelectionPopup;