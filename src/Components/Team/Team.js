import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import { UsergroupAddOutlined } from "@ant-design/icons";
import Button from '@mui/material/Button';
import axios from 'axios';
import Navbar from "../Navbar/Navbar";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import IconButton from '@mui/material/IconButton';
import { message } from "antd";
import PlayerSelectionPopup from "./PlayerSelectionPopup"; // Popup bileşeni import edildi
import './Team.css';

const TeamsListContainer = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginTop: '20px',
});

const ContentContainer = styled('div')({
  marginTop: '70px',
  display: 'flex',
  justifyContent: 'center',
  flexDirection: 'column',
  alignItems: 'center',
});

const Team = () => {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false); // Dialog kontrolü için state
  const [selectedTeamId, setSelectedTeamId] = useState(null); // Seçilen takım id'si
  const [popupVisible, setPopupVisible] = useState(false); // Popup görünürlüğü
  const [currentTeamPlayers, setCurrentTeamPlayers] = useState([]); // Mevcut takım oyuncuları

  useEffect(() => {
    axios.get("http://localhost:5033/api/Team/GetTeamList")
      .then(response => {
        setTeams(response.data);
      })
      .catch(error => {
        console.log(error);
      });
  }, []);

  const handleDelete = (teamId) => {
    fetch(`http://localhost:5033/api/Team/DeleteTeam?teamId=${teamId}`, {
      method: "POST",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          message.success(data.message || "Başarıyla silindi.");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          message.error(data.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
      })
      .catch((error) => {
        message.error(error.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
      });
  };

  const handleDialogOpen = (teamId) => {
    setSelectedTeamId(teamId);
    setDialogOpen(true);
  };

  const handleDialogClose = (confirm) => {
    setDialogOpen(false);
    if (confirm && selectedTeamId !== null) {
      handleDelete(selectedTeamId);
    }
  };

  const handlePlayerEdit = (team) => {
    setCurrentTeamPlayers(team.playerName); // Mevcut takım oyuncularını ayarla
    setSelectedTeamId(team.teamId); // Seçilen takım ID'sini ayarla
    setName(team.teamName); // Seçilen takım ismini ayarla
    setPopupVisible(true); // Popup'ı aç
  };

  const handleSavePlayers = () => {
    // Popup kapatıldıktan sonra takımlar listesini yeniden yükle
    axios.get("http://localhost:5033/api/Team/GetTeamList")
      .then(response => {
        setTeams(response.data); // Takımlar listesini güncelle
      })
};

  return (
    <div>
      <Navbar />
      <ContentContainer>
        <Button variant="contained" color="primary" component={Link} to="/create-team">
          Takım Oluştur
        </Button>
        <TeamsListContainer>
          {teams.map((team) => (
            <Card key={team.teamId} className="teamCard" sx={{ margin: '20px', width: '300px', backgroundColor: '#3cc1b8' }}>
              <CardHeader
                avatar={
                  <Avatar>
                    <UsergroupAddOutlined />
                  </Avatar>
                }
                action={
                  <IconButton onClick={() => handleDialogOpen(team.teamId)} aria-label="delete">
                    <DeleteForeverIcon style={{ color: "red" }} />
                  </IconButton>
                }
                title={
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {team.teamName}
                  </Typography>
                }
              />
              <CardContent>
                <Typography variant="body2" color="textSecondary" sx={{ marginBottom: '8px' }}>
                  Oyuncu Sayısı: {team.playerName.length}
                </Typography>
                {team.playerName.map((player, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    {team.profilePictureUrl && team.profilePictureUrl[index] ? (
                      <Avatar
                        src={team.profilePictureUrl[index].startsWith('http') ? team.profilePictureUrl[index] : `http://localhost:5033${team.profilePictureUrl[index]}`}
                        sx={{ width: 32, height: 32, marginRight: 1 }}
                      />
                    ) : (
                      <Avatar sx={{ width: 32, height: 32, marginRight: 1 }}>
                        {player[0] || '?'}
                      </Avatar>
                    )}
                    <Typography variant="body2" color="textSecondary">
                      {player}
                    </Typography>
                  </div>
                ))}
                <Button
                  variant="contained"
                  style={{
                    background: 'linear-gradient(45deg,rgb(227, 74, 187) 30%,rgb(72, 152, 238) 90%)',
                    color: 'white',
                    marginTop: '15px',
                  }}
                  onClick={() => handlePlayerEdit(team)}
                >
                  Oyuncu ekle / sil
                </Button>
              </CardContent>
            </Card>
          ))}
        </TeamsListContainer>
      </ContentContainer>

      {/* Oyuncu Seçim Popup */}
      <PlayerSelectionPopup
        visible={popupVisible}
        onClose={() => setPopupVisible(false)}
        teamPlayers={currentTeamPlayers}
        teamId={selectedTeamId}
        teamName={name || ""} // Seçilen takımın ismini al
        onSave={handleSavePlayers}
      />
    </div>
  );
};

export default Team;