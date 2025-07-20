import React, { useState, useEffect } from 'react';
import './MatchReservation.css';
import image from "./image.png";

const MatchReservation = ({ updateNotificationCount }) => {
  const [stadiums, setStadiums] = useState([]);
  const [selectedStadium, setSelectedStadium] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchTeams, setMatchTeams] = useState([]);
  const [isMatchExpired, setIsMatchExpired] = useState(false);
  const [expandedStadiums, setExpandedStadiums] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5033/api/Stadium/GetStadiumMatchList')
      .then((response) => response.json())
      .then((data) => {
        const updatedStadiums = data.map((stadium) => ({
          ...stadium,
          matchModel: stadium.matchModel.filter((match) => match.isActive === 1),
        }));
        setStadiums(updatedStadiums);
      })
      .catch((error) => console.error('Hata:', error));
  }, []);

  const handleStadiumClick = (stadium) => {
    setSelectedStadium(stadium);
  };

  const toggleStadium = (stadiumId) => {
    setExpandedStadiums((prevExpanded) => ({
      ...prevExpanded,
      [stadiumId]: !prevExpanded[stadiumId],
    }));
  };

  const handleMatchClick = (matchId) => {
    fetch(`http://localhost:5033/api/Match/GetMatchById?matchId=${matchId}`)
      .then((response) => response.json())
      .then((data) => {
        setSelectedMatch(data);
        const matchDate = new Date(data.matchDate);
        const currentDate = new Date();
        setIsMatchExpired(matchDate < currentDate);
      })
      .catch((error) => console.error('Hata:', error));

    fetch(`http://localhost:5033/api/Match/GetMatchTeamInfo?matchId=${matchId}`)
      .then((response) => response.json())
      .then((data) => {
        setMatchTeams(data);
      })
      .catch((error) => console.error('Hata:', error));
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedMatch) return;

    const payload = {
      matchId: selectedMatch.matchId,
      status: status,
    };

    try {
      const response = await fetch('http://localhost:5033/api/Match/MatchStatusUpdate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Durum güncellenemedi');
      }

      setMessage(data.message);
      updateNotificationCount(); // Bildirim sayısını güncelle

      // Seçili maçı listeden sil
      const updatedStadiums = stadiums.map((stadium) => ({
        ...stadium,
        matchModel: stadium.matchModel.filter((match) => match.matchId !== selectedMatch.matchId),
      }));
      setStadiums(updatedStadiums);
      setSelectedMatch(null); // Seçili maçı sıfırla
      setMatchTeams([]);
    } catch (error) {
      console.error('Hata:', error);
      setMessage(`Hata: ${error.message}`);
    }
  };

  return (
    <div className="match-reservation-container">
      <div className="stadium-tree">
        <h3>Stadyumlar</h3>
        <ul>
          {stadiums.map((stadium) => (
            <li key={stadium.stadiumId}>
              <div
                className="stadium-item"
                onClick={() => toggleStadium(stadium.stadiumId)}
              >
                <span className={`toggle-icon ${expandedStadiums[stadium.stadiumId] ? 'open' : 'closed'}`}>▼</span>
                {stadium.stadiumName}
                {stadium.matchModel.length > 0 && (
                  <span className="badge">{stadium.matchModel.length}</span>
                )}
              </div>
              {expandedStadiums[stadium.stadiumId] && (
                <ul>
                  {stadium.matchModel.map((match) => (
                    <li
                      key={match.matchId}
                      className="match-item"
                      onClick={() => handleMatchClick(match.matchId)}
                    >
                      - {match.matchName}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="stadium-details">
        {selectedMatch ? (
          <div>
            <h3>{selectedMatch.matchName}</h3>

            {isMatchExpired && (
              <div className="expired-match">
                <p>Bu maçın tarihi geçmiştir.</p>
              </div>
            )}

            <p><strong>Tarih:</strong> {new Date(selectedMatch.matchDate).toLocaleString()}</p>
            <p><strong>Oyuncu Sayısı:</strong> {selectedMatch.userCount}</p>
            <p><strong>Açıklama:</strong> {selectedMatch.description}</p>

            <div className="teams-container">
              {matchTeams.length > 0 ? (
                Object.entries(
                  matchTeams.reduce((acc, team) => {
                    acc[team.teamName] = acc[team.teamName] || [];
                    acc[team.teamName].push(team);
                    return acc;
                  }, {})
                ).map(([teamName, players]) => (
                  <div key={teamName} className="team">
                    <h5>{teamName}</h5>
                    <ul>
                      {players.map((player) => (
                        <li key={player.userName}>
                          <img
                            src={image}
                            alt="Player Icon"
                            className="player-icon"
                          />
                          {player.playerName} {player.playerSurname} ({player.userName}) - Skor: {player.userScore}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p>Takım bilgisi mevcut değil.</p>
              )}
            </div>

            <button className="btn btn-approve" onClick={() => handleStatusUpdate(2)}>
              Onayla
            </button>
            <button className="btn btn-reject" onClick={() => handleStatusUpdate(3)}>
              Reddet
            </button>
          </div>
        ) : (
          <p>Bir maç seçin.</p>
        )}
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
};

export default MatchReservation;