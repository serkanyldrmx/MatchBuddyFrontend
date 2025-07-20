import React, { useState, useEffect } from "react";
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import StarIcon from '@mui/icons-material/Star';
import Navbar from "../Navbar/Navbar";
import { UserOutlined } from "@ant-design/icons";
import './Players.css';

const RootContainer = styled('div')({
  flexGrow: 1,
});

const MenuButton = styled('div')(({ theme }) => ({
  marginRight: theme.spacing(2),
}));

const Title = styled('div')({
  flexGrow: 1,
  textAlign: 'left',
});

function Players() {
  const [players, setPlayers] = useState([]);
  const [expanded, setExpanded] = useState(null); // Expanded state for each player card
  const [selectedStars, setSelectedStars] = useState({}); // State to store selected stars for each player

  useEffect(() => {
    fetch("http://localhost:5033/api/Players/GetPlayerList")
        .then(res => res.json())
        .then(
            (result) => {
                setPlayers(result);
            },
            (error) => {
                console.log(error);
            }
        )
  }, []);

  const handleExpandClick = (playerId) => {
    setExpanded(expanded === playerId ? null : playerId);
  };

  const handleStarClick = (playerId, stars) => {
    setSelectedStars(prevState => ({
      ...prevState,
      [playerId]: stars
    }));
  };

  const handleRatePlayer = (playerId) => {
    const stars = selectedStars[playerId] || 0;
    const newScore = stars * 2; // Each star gives 2 points
    setPlayers(players.map(player => {
      if (player.playerId === playerId) {
        return { ...player, userScore: player.userScore + newScore };
      }
      return player;
    }));
    setExpanded(null); // Collapse the card after rating
  };

  return (
    <div>
      <Navbar />
      <div className="playersPostContainer">
        {players.map((player) => (
          <Card key={player.playerId} className="playerCard" sx={{ margin: '20px', width: '300px', backgroundColor: '#85a5d4' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', marginBottom: '20px' }}>
              <Avatar
                src={
                  player.profilePictureUrl
                    ? `http://localhost:5033${player.profilePictureUrl}`
                    : null
                }
                sx={{ width: 64, height: 64 }}
              >
                {!player.profilePictureUrl && <UserOutlined />}
              </Avatar>
            </div>
            <CardHeader
              title={
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                  {player.playerName + " " + player.playerSurname}
                </Typography>
              }
              subheader={
                <div>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Kullanıcı Adı: " + player.userName}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Email: " + player.email}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Telefon: " + player.phoneNumber}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Adres: " + player.address}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Boy: " + player.size + " cm"}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Kilo: " + player.weight + " kg"}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Yaş: " + player.age}
                  </Typography>
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
                    {"Puan: " + player.userScore}
                  </Typography>
                </div>
              }
            />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => handleExpandClick(player.playerId)}
              >
                Oyuncuyu Puanla
              </Button>
            </div>
            {expanded === player.playerId && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <StarIcon
                      key={star}
                      onClick={() => handleStarClick(player.playerId, star)}
                      sx={{ 
                        color: star <= (selectedStars[player.playerId] || 0) ? 'gold' : 'grey',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={() => handleRatePlayer(player.playerId)}
                >
                  Puanla
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Players;
