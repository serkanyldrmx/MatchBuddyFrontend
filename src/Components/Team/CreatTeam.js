import React, { useState, useEffect } from "react";
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import axios from 'axios';
import { green } from '@mui/material/colors';
import { UserOutlined } from "@ant-design/icons";
import { message } from "antd";
import Navbar from "../Navbar/Navbar";

const TeamForm = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '20px',
  marginTop: '80px',
});

const PlayersListContainer = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginTop: '20px',
});

const PlayerCard = styled(Card)({
  margin: '20px',
  width: '300px',
  backgroundColor: '#3cc1b8',
  position: 'relative',
  paddingTop: '20px',
});

const CheckboxContainer = styled('div')({
  position: 'absolute',
  top: '10px',
  right: '10px',
});

const GreenCheckbox = styled(Checkbox)({
  color: green[400],
  '&.Mui-checked': {
    color: green[600],
  },
});

const CreateTeam = () => {
  const [players, setPlayers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5033/api/Players/GetPlayerList")
      .then(response => {
        setPlayers(response.data);
      })
      .catch(error => {
        console.log(error);
      });
  }, []);

  const handleTeamNameChange = (event) => {
    setTeamName(event.target.value);
  };

  const handlePlayerSelection = (event) => {
    const playerId = parseInt(event.target.value, 10);
    setSelectedPlayers(prevSelected => 
      prevSelected.includes(playerId)
        ? prevSelected.filter(id => id !== playerId)
        : [...prevSelected, playerId]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const teamData = {
      teamName: teamName,
      playerId: selectedPlayers
    };
  
    axios.post("http://localhost:5033/api/Team/SaveTeam", teamData)
      .then((response) => {
        alert('Takım başarıyla oluşturuldu!');
        setTeamName('');
        setSelectedPlayers([]);
        message.success("Takım başarıyla oluşturuldu");
      })
      .catch((error) => {
        console.error('Takım oluşturulurken bir hata oluştu!', error);
        message.error("Takım oluşturulurken bir hata oluştu!");
      });
  };
  
  return (
    <div>
      <Navbar></Navbar>
      <TeamForm onSubmit={handleSubmit}>
        <TextField
          label="Takım Adı"
          value={teamName}
          onChange={handleTeamNameChange}
          required
        />
        <Button type="submit" variant="contained" color="primary" style={{ marginTop: '10px' }}>
          Takım Oluştur
        </Button>
      </TeamForm>
      <PlayersListContainer>
        {players.map((player) => (
          <PlayerCard key={player.playerId}>
            <CheckboxContainer>
              <FormControlLabel
                control={
                  <GreenCheckbox
                    value={player.playerId}
                    onChange={handlePlayerSelection}
                    checked={selectedPlayers.includes(player.playerId)}
                  />
                }
                label=""
              />
            </CheckboxContainer>
            <CardHeader
              avatar={<Avatar icon={<UserOutlined />} />}
              title={
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', marginTop: '10px' }}>
                  {player.playerName + " " + player.playerSurname}
                </Typography>
              }
            />
            <CardContent>
              <Typography variant="subtitle1" component="div">
                Kullanıcı Adı: {player.userName}
              </Typography>
              <Typography variant="subtitle1" component="div">
                Email: {player.email}
              </Typography>
              <Typography variant="subtitle1" component="div">
                Telefon: {player.phoneNumber}
              </Typography>
              <Typography variant="subtitle1" component="div">
                Adres: {player.address}
              </Typography>
              <Typography variant="subtitle1" component="div">
                Boy: {player.size} cm
              </Typography>
              <Typography variant="subtitle1" component="div">
                Kilo: {player.weight} kg
              </Typography>
              <Typography variant="subtitle1" component="div">
                Yaş: {player.age}
              </Typography>
              <Typography variant="subtitle1" component="div">
                Kullanıcı Skoru: {player.userScore}
              </Typography>
            </CardContent>
          </PlayerCard>
        ))}
      </PlayersListContainer>
    </div>
  );
}

export default CreateTeam;



