import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardContent, Typography, Button, Avatar, Container, Grid, MenuItem, Select, InputLabel, FormControl } from "@mui/material";
import { red, blue } from "@mui/material/colors";
import { message } from "antd";
import Navbar from "../Navbar/Navbar";
import "./MatchDetails.css";

function MatchDetails() {
  const { matchId } = useParams();
  const [matchDetails, setMatchDetails] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [isMatchPast, setIsMatchPast] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:5033/api/Match/GetMatchById?matchId=${matchId}`)
      .then((res) => res.json())
      .then(
        (result) => {
          setMatchInfo(result);

          const matchDate = new Date(result?.matchDate);
          const currentDate = new Date();
          if (matchDate < currentDate) {
            setIsMatchPast(true);
          }
        },
        (error) => {
          setError(error);
        }
      );

    fetch(`http://localhost:5033/api/Match/GetMatchTeamInfo?matchId=${matchId}`)
      .then((res) => res.json())
      .then(
        (result) => {
          if (result.length < 2) {
            setMatchDetails([]);
          } else {
            setMatchDetails(result);
          }
          setIsLoaded(true);
        },
        (error) => {
          setError(error);
          setIsLoaded(true);
        }
      );

    fetch("http://localhost:5033/api/Team/GetTeamList")
      .then((res) => res.json())
      .then(
        (result) => {
          const teamsWithPlayerCount = result.map((team) => ({
            ...team,
            playerCount: team.playerName.length,
          }));
          setTeams(teamsWithPlayerCount);
        },
        (error) => {
          setError(error);
        }
      );
  }, [matchId]);

  const refreshTeamInfo = () => {
    fetch(`http://localhost:5033/api/Match/GetMatchTeamInfo?matchId=${matchId}`)
      .then((res) => res.json())
      .then((result) => {
        setMatchDetails(result);
        setIsLoaded(true);
      })
      .catch((error) => {
        setError(error);
        setIsLoaded(true);
      });
  };

  const handleTeamSelect = () => {
    if (team1 && team2) {
      saveSelectedTeams(team1, team2);
    } else {
      message.error("Lütfen iki takım seçin!");
    }
  };

  const handleJoinMatch = (teamId) => {
    const player = JSON.parse(localStorage.getItem("user")); // Kullanıcı bilgilerini al
    const playerId = player ? player.playerId : null; // Kullanıcının playerId'sini al
  
    // Team1 ve Team2'deki oyuncuları playerId'lere göre kontrol et
    const isInTeam1 = team1Details.some((player) => player.playerId === playerId);
    const isInTeam2 = team2Details.some((player) => player.playerId === playerId);
  
    // Eğer kullanıcı bir takıma zaten katılmışsa, mesaj göster
    if (isInTeam1) {
      const teamName = team1Details?.[0]?.teamName || "Team 1"; // Team 1'in ismi varsa, yoksa "Team 1" kullan
      message.error(`Zaten ${teamName} Takımında oynuyorsunuz.`); // Mesajı dinamik olarak göster
      return; // Eğer Team 1'de ise işlemi sonlandır
    } else if (isInTeam2) {
      const teamName = team2Details?.[0]?.teamName || "Team 2"; // Team 2'nin ismi varsa, yoksa "Team 2" kullan
      message.error(`Zaten ${teamName} Takımında oynuyorsunuz.`); // Mesajı dinamik olarak göster
      return; // Eğer Team 2'de ise işlemi sonlandır
    }
  
    // Kullanıcı takımlarda değilse, yeni takıma katılma işlemi
    fetch("http://localhost:5033/api/PlayerTeam/SavePlayerTeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId, playerId }), // Yeni takıma katıl
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          message.success("Maça Katıldınız");
          setHasJoined(true);
          refreshTeamInfo();
        } else {
          message.error("Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
      })
      .catch((error) => {
        message.error("Maça katılırken bir hata oluştu.");
      });
  };
  

  const saveSelectedTeams = (team1Id, team2Id) => {
    const saveTeam1 = fetch("http://localhost:5033/api/Match/SaveMatchTeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId: team1Id, matchId }),
    });

    const saveTeam2 = fetch("http://localhost:5033/api/Match/SaveMatchTeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId: team2Id, matchId }),
    });

    Promise.all([saveTeam1, saveTeam2])
      .then(() => {
        message.success("Takımlar başarıyla eklendi");
        refreshTeamInfo();
      })
      .catch((error) => {
        setError(error);
        message.error("Takımlar eklenirken bir hata oluştu.");
      });
  };

  const formatDateTime = (dateTime) => {
    const date = new Date(dateTime);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();
    return { formattedDate, formattedTime };
  };

  const requiredPlayerCount = Math.ceil(matchInfo?.userCount / 2);

  const team1Details = matchDetails?.filter(
    (team) => team.teamName === matchDetails?.[0]?.teamName
  ) || [];
  const team2Details = matchDetails?.filter(
    (team) => team.teamName !== matchDetails?.[0]?.teamName
  ) || [];

  const missingPlayersTeam1 = requiredPlayerCount - team1Details.length;
  const missingPlayersTeam2 = requiredPlayerCount - team2Details.length;

  return (
    <Container fixed className="container-detail">
      <Navbar />
      <div className="match-info">
        {error && (
          <Typography variant="body1" color="error">
            Error: {error.message}
          </Typography>
        )}
        {isLoaded ? (
          <>
            {matchDetails && matchDetails.length > 0 ? (
              <>
                <Card className="match-card">
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
                        {matchDetails[0]?.teamName.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    title={"Maç Adı: " + (matchInfo?.matchName || "Bilinmiyor")}
                    subheader={
                      <div>
                        <div>
                          {"Maç Tarihi: " +
                            (formatDateTime(matchInfo?.matchDate)?.formattedDate ||
                              "Bilinmiyor")}
                        </div>
                        <div>
                          {"Maç Saati: " +
                            (formatDateTime(matchInfo?.matchDate)?.formattedTime ||
                              "Bilinmiyor")}
                        </div>
                        <div>
                          {"Katılımcı Sayısı: " + (matchInfo?.userCount || 0)}
                        </div>
                      </div>
                    }
                  />
                </Card>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card className="team-card">
                      <CardHeader title={team1Details?.[0]?.teamName || "Takım 1"} />
                      <CardContent>
                        {team1Details?.map((team, index) => (
                          <Card key={index} className="player-card">
                            <CardHeader
                              avatar={
                                <Avatar
                                  sx={{ bgcolor: red[500] }}
                                  aria-label="player"
                                >
                                  {team.playerName.charAt(0)}
                                </Avatar>
                              }
                              title={
                                <Typography
                                  variant="h6"
                                  style={{ fontWeight: "bold" }}
                                >
                                  {team.userName}
                                </Typography>
                              }
                            />
                            <CardContent>
                              <Typography variant="body2">
                                {team.playerName} {team.playerSurname}
                              </Typography>
                              <Typography variant="body2">
                                {team.userScore} Puan
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                        {missingPlayersTeam1 > 0 && (
                          <Card className="player-card">
                            <CardHeader title="Eksik Oyuncu" />
                            <CardContent>
                              <Button
                                variant="contained"
                                color="primary"
                                disabled={isMatchPast || hasJoined}
                                onClick={() =>
                                  handleJoinMatch(team1Details?.[0]?.teamId)
                                }
                              >
                                {isMatchPast
                                  ? "Maç Tarihi Geçti"
                                  : "Bu Takıma Katıl"}
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Card className="team-card">
                      <CardHeader title={team2Details?.[0]?.teamName || "Takım 2"} />
                      <CardContent>
                        {team2Details?.map((team, index) => (
                          <Card key={index} className="player-card">
                            <CardHeader
                              avatar={
                                <Avatar
                                  sx={{ bgcolor: blue[500] }}
                                  aria-label="player"
                                >
                                  {team.playerName.charAt(0)}
                                </Avatar>
                              }
                              title={
                                <Typography
                                  variant="h6"
                                  style={{ fontWeight: "bold" }}
                                >
                                  {team.userName}
                                </Typography>
                              }
                            />
                            <CardContent>
                              <Typography variant="body2">
                                {team.playerName} {team.playerSurname}
                              </Typography>
                              <Typography variant="body2">
                                {team.userScore} Puan
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                        {missingPlayersTeam2 > 0 && (
                          <Card className="player-card">
                            <CardHeader title="Eksik Oyuncu" />
                            <CardContent>
                              <Button
                                variant="contained"
                                color="primary"
                                disabled={isMatchPast || hasJoined}
                                onClick={() =>
                                  handleJoinMatch(team2Details?.[0]?.teamId)
                                }
                              >
                                {isMatchPast
                                  ? "Maç Tarihi Geçti"
                                  : "Bu Takıma Katıl"}
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            ) : (
              <>
                <Typography variant="h6">
                  Takım yok, lütfen aşağıdan takımları seçin:
                </Typography>
                <FormControl fullWidth>
                  <InputLabel id="team1-select-label">Takım 1</InputLabel>
                  <Select
                    labelId="team1-select-label"
                    value={team1}
                    onChange={(e) => setTeam1(e.target.value)}
                  >
                    {teams
                      .filter((team) => team.playerCount <= requiredPlayerCount)
                      .map((team) => (
                        <MenuItem key={team.teamId} value={team.teamId}>
                          {team.teamName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="team2-select-label">Takım 2</InputLabel>
                  <Select
                    labelId="team2-select-label"
                    value={team2}
                    onChange={(e) => setTeam2(e.target.value)}
                  >
                    {teams
                      .filter((team) =>
                        team.playerCount <= requiredPlayerCount && team.teamId !== team1
                      )
                      .map((team) => (
                        <MenuItem key={team.teamId} value={team.teamId}>
                          {team.teamName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleTeamSelect}
                  disabled={!team1 || !team2}
                >
                  Takımları Kaydet
                </Button>
              </>
            )}
          </>
        ) : (
          <Typography variant="h6">Yükleniyor...</Typography>
        )}
      </div>
    </Container>
  );
}

export default MatchDetails;
