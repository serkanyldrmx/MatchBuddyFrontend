import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import { UserOutlined } from "@ant-design/icons";
import Button from '@mui/material/Button';
import axios from 'axios';
import Navbar from "../Navbar/Navbar";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import IconButton from '@mui/material/IconButton';
import { message } from "antd";

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
  const [dialogOpen, setDialogOpen] = useState(false); // Dialog kontrolü için state
  const [selectedTeamId, setSelectedTeamId] = useState(null); // Seçilen takım id'si

  useEffect(() => {
    axios.get("http://localhost:5033/api/Team/GetTeamList")
      .then(response => {
        setTeams(response.data);
      })
      .catch(error => {
        console.log(error);
      });
  }, []);

  // Takım silme fonksiyonu
  const handleDelete = (teamId) => {
    console.log("Silinecek takım ID:", teamId); // teamId'nin doğru gelip gelmediğini kontrol et
    
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
    setSelectedTeamId(teamId); // Seçilen takım id'sini ayarla
    setDialogOpen(true); // Dialog'u aç
  };

  const handleDialogClose = (confirm) => {
    setDialogOpen(false); // Dialog'u kapat
    if (confirm && selectedTeamId !== null) {
      handleDelete(selectedTeamId); // Silme işlemini gerçekleştir
    }
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
                    <UserOutlined />
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
                {/* Oyuncu sayısını göster */}
                <Typography variant="body2" color="textSecondary" sx={{ marginBottom: '8px' }}>
                  Oyuncu Sayısı: {team.playerName.length}
                </Typography>
                
                {/* Oyuncu isimlerini listele */}
                {team.playerName.map((player, index) => (
                  <Typography key={index} variant="body2" color="textSecondary">
                    {player}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          ))}
        </TeamsListContainer>
      </ContentContainer>

      {/* Dialog */}
      {dialogOpen && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)', // Ekranın tam ortasına yerleştirir
          backgroundColor: 'white',
          padding: '20px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          zIndex: 1000,
          textAlign: 'center'
        }}>
          <h3>Bu takımı silmek istediğinize emin misiniz?</h3>
          <Button variant="contained" color="secondary" onClick={() => handleDialogClose(true)} style={{ margin: '10px' }}>
            Evet, Sil
          </Button>
          <Button variant="contained" onClick={() => handleDialogClose(false)} style={{ margin: '10px' }}>
            Hayır, Vazgeç
          </Button>
        </div>
      )}
    </div>
  );
};

export default Team;