import React, { useState, useEffect } from "react";
import { Container, Grid, Card, CardHeader, CardContent, Button, Typography, Avatar, IconButton } from "@mui/material";
import { Link } from "react-router-dom";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { message } from "antd";
import { red } from '@mui/material/colors';

function MatchAll() {
  const [matchList, setMatchList] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Veriyi API'den alıyoruz
  useEffect(() => {
    fetch("http://localhost:5033/api/Match/GetMatchList")
      .then(res => res.json())
      .then(
        (result) => {
          setIsLoaded(true);
          setMatchList(result);
        },
        (error) => {
          setIsLoaded(true);
          setError(error);
        }
      );
  }, []);

  // Maç silme işlemi yapılmayacak, sadece göstermek amacıyla kaldırdık
  const handleDelete = () => {
    message.warning("Bu işlem admin panelinde yapılmıyor.");
  };

  // Durumu göstermek için bir fonksiyon ekliyoruz
  const getStatusMessage = (status) => {
    if (status === 1) {
      return { message: "Bu maç onayda", color: "blue" }; // Onay bekleyen maç
    }
    if (status === 2) {
      return { message: "Maç onaylandı", color: "green" }; // Onaylanan maç
    }
    if (status === 3) {
      return { message: "Maç reddedildi", color: "red" }; // Reddedilen maç
    }
    return { message: "Durum yok", color: "grey" };
  };

  // Tarih ve saati formatlıyoruz
  const formatDateAndTime = (matchDate) => {
    const matchDateObj = new Date(matchDate);
    const formattedDate = new Intl.DateTimeFormat('en-US').format(matchDateObj);
    const formattedTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false
    }).format(matchDateObj);
    return { date: formattedDate, time: formattedTime };
  };

  if (error) {
    return <div>Error!</div>;
  } else if (!isLoaded) {
    return <div>Loading...</div>;
  } else {
    return (
      <Container maxWidth="lg" style={{ marginTop: '50px' }}>
        <Grid container spacing={3}>
          {matchList.map((match) => {
            const statusMessage = getStatusMessage(match.isActive); // Maç durumunu alıyoruz
            const { date, time } = formatDateAndTime(match.matchDate); // Tarih ve saati ayırıyoruz
            return (
              <Grid item xs={12} sm={6} md={4} key={match.matchId}>
                <Card sx={{ marginBottom: '20px', backgroundColor: '#3cc1b8' }}>
                  <CardHeader
                    avatar={
                      <Link to={`/match-details/${match.matchId}`}>
                        <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
                          {match.matchName.charAt(0).toUpperCase()}
                        </Avatar>
                      </Link>
                    }
                    action={
                      // Silme butonunu sadece admin için göster, kullanıcılar için gizli.
                      <IconButton onClick={handleDelete} aria-label="delete" style={{ color: "red" }}>
                        <DeleteForeverIcon />
                      </IconButton>
                    }
                  />
                  {/* Durumu burada yazıyoruz ve renkli olarak gösteriyoruz */}
                  <CardContent>
                    <Typography variant="body2" color={statusMessage.color} style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {statusMessage.message}
                    </Typography>
                    <Typography variant="h6">{match.matchName}</Typography>
                    {/* Tarih ve saati ayırarak gösteriyoruz */}
                    <Typography variant="body2" color="text.secondary">{"Tarih: " + date}</Typography>
                    <Typography variant="body2" color="text.secondary">{"Saat: " + time}</Typography>
                    <Typography variant="body2" color="text.secondary">{"Katılımcı Sayısı: " + match.userCount}</Typography>
                    <Button
                      variant="contained"
                      style={{
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                        color: 'white',
                        marginTop: '15px',
                      }}
                    >
                      <Link
                        to={`/match-details/${match.matchId}`}
                        style={{ textDecoration: 'none', color: 'white' }}
                      >
                        Maçı İncele / Katıl
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    );
  }
}

export default MatchAll;
