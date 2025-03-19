import React, { useEffect, useRef, useState } from "react";
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { red } from '@mui/material/colors';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import "./Post.css";
import CommentIcon from '@mui/icons-material/Comment';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FavoriteIcon from '@mui/icons-material/Favorite';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import { message } from "antd";
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Comment from "../Comment/Comment";
import DeleteIcon from '@mui/icons-material/Delete';
// ...existing code...

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
}));

function Post(props) {
  const { matchId, matchName, description, userCount, matchDate, status, initialLikes } = props;
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes || 0); // Beğeni sayısını state olarak tut
  const [commentList, setCommentList] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false); // Dialog kontrolü için state
  const isInitialMount = useRef(true);
  const [player, setPlayer] = useState(null);
  const [newComment, setNewComment] = useState("");

  const currentDate = new Date();
  const matchDateObj = new Date(matchDate);

  const isMatchPast = matchDateObj < currentDate;
  const formattedDate = new Intl.DateTimeFormat('en-US').format(matchDateObj);
  const formattedHour = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false // 24 saat formatında göstermek isterseniz
  }).format(matchDateObj);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    setPlayer(user);
  }, []);

  const handleExpandClick = () => {
    setExpanded(!expanded);
    if (!expanded) {
      refreshComments();
    }
  };

  const handleDelete = () => {
    fetch(`http://localhost:5033/api/Match/DeleteMatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ matchId }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
        return response.json();
      })
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

  const handleCommentDelete = (commentId) => {
    fetch(`http://localhost:5033/api/MatchComment/DeleteMatchComment?commentId=${commentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          message.success(data.message || "Yorum başarıyla silindi.");
          refreshComments();
        } else {
          message.error(data.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
      })
      .catch((error) => {
        message.error(error.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
      });
  };

  const handleDialogOpen = () => {
    setDialogOpen(true); // Popup'u aç
  };

  const handleDialogClose = (confirm) => {
    setDialogOpen(false); // Popup'u kapat
    if (confirm) {
      handleDelete(); // Eğer kullanıcı onay verdiyse silme işlemini gerçekleştir
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1)); // Beğeni sayısını artır veya azalt

    fetch(`http://localhost:5033/api/Match/MatchLiked?matchId=${matchId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
        return response.json();
      })
      .then((data) => {
        if (!data.success) {
          message.error(data.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
      })
      .catch((error) => {
        message.error(error.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
      });
  };

  const refreshComments = () => {
    fetch(`http://localhost:5033/api/MatchComment/GetMatchComments?matchId=${matchId}`)
      .then(res => res.json())
      .then(
        (result) => {
          setIsLoaded(true);
          if (Array.isArray(result)) {
            setCommentList(result);
          } else {
            setCommentList([]);
          }
        },
        (error) => {
          setIsLoaded(true);
          setError(error);
        }
      );
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      refreshComments();
    }
  }, []);

  const getStatusMessage = () => {    
    if (isMatchPast) {
      return { message: "Maç Tarihi Geçti", color: "red" }; // Geçmiş maçlar
    }
    if (status === 1) {
      return { message: "Bu maç onayda", color: "blue" }; // Onay bekleyen maç
    }
    if (status === 2) {
      return { message: "Maç onaylandı ", color: "yellow" }; // Onaylanan maç
    }
    if (status === 3) {
      return { message: "Maç reddedildi", color: "orange" }; // Reddedilen maç
    }
    //return null; // Durum yoksa null döndür
  };
  
  const statusMessage = getStatusMessage();

  const handleCommentChange = (event) => {
    setNewComment(event.target.value);
  };

  const handleCommentSubmit = () => {
    if (newComment.trim() === "") {
      message.error("Yorum boş olamaz.");
      return;
    }

    const commentData = {
      comment: newComment,
      playerId: player?.playerId,
      matchId: matchId,
    };

    fetch(`http://localhost:5033/api/MatchComment/SaveMatchComment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commentData),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          message.success(data.message || "Yorum başarıyla eklendi.");
          setNewComment("");
          refreshComments();
        } else {
          message.error(data.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
        }
      })
      .catch((error) => {
        message.error(error.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
      });
  };

  const getColorById = (id) => {
    const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF", "#33FFF5", "#F5FF33", "#FF8C33", "#8C33FF", "#33FF8C"];
    return colors[id % 10];
  };

  return (
    <div className="postContainer">
      <Card className="postCard" sx={{ margin: '20px', width: '600px', backgroundColor: '#3cc1b8', padding: '16px' }}>
        <CardHeader
          avatar={
            <Link to={`/match-details/${matchId}`}>
              <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
                {matchName ? matchName.charAt(0).toUpperCase() : "?"}
              </Avatar>
            </Link>
          }
          action={
            <IconButton onClick={handleDialogOpen} aria-label="delete">
              <DeleteForeverIcon style={{ color: "red" }} />
            </IconButton>
          }
        />
        {statusMessage && (
          <Typography variant="body2" color={statusMessage.color} style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {statusMessage.message}
          </Typography>
        )}
        <Typography variant="h6" component="div" style={{ marginTop: statusMessage ? '5px' : '0' }}>
          {"Maç Adı: " + matchName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {"Maç tarihi: " + formattedDate}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {"Maç Saati: " + formattedHour}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {"Katılımcı Sayısı: " + userCount}
        </Typography>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          <Button
            variant="contained"
            style={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              color: 'white',
              marginTop: '15px',
            }}
          >
            <Link
              to={`/match-details/${matchId}`}
              style={{ textDecoration: 'none', color: 'white' }}
            >
              Maçı İncele / Katıl
            </Link>
          </Button>
        </CardContent>
        <CardActions disableSpacing>
          <IconButton onClick={handleLike} aria-label="add to favorites">
            <FavoriteIcon style={liked ? { color: "red" } : null} />
          </IconButton>
          <Typography variant="body2" color="text.secondary" style={{ marginLeft: '8px' }}>
            {likes} {/* Beğeni sayısını göster */}
          </Typography>
          <ExpandMore
            expand={expanded.toString()}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <CommentIcon />
          </ExpandMore>
        </CardActions>
      </Card>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Container fixed className="commentSection">
          <Typography variant="h6" component="div" className="commentSectionTitle">
            Maç Yorumları
          </Typography>
          {isLoaded ? commentList.length > 0 ? commentList.map(comment => (
            <div key={comment.commentsId} className="commentCard">
              <Avatar className="avatar" sx={{ bgcolor: getColorById(comment.playerId) }}>
                {comment.playerName.charAt(0).toUpperCase()}{comment.playerSurname.charAt(0).toUpperCase()}
              </Avatar>
              <div className="commentContent">
                <div className="commentUserName">{comment.userName}</div>
                <div>{comment.comment}</div>
              </div>
              <IconButton
                aria-label="delete"
                onClick={() => handleCommentDelete(comment.commentsId)}
                style={{ marginLeft: 'auto', color: 'red' }} // Rengi kırmızı yap
              >
                <DeleteIcon />
              </IconButton>
            </div>
          )) : "Bu Maça Henüz Yorum Eklenmedi" : "Loading..."}
          <div style={{ marginTop: '20px' }}>
            <TextField
              label="Yorum Yaz"
              variant="outlined"
              fullWidth
              value={newComment}
              onChange={handleCommentChange}
            />
            <Button
              variant="contained"
              color="primary"
              style={{ marginTop: '10px' }}
              onClick={handleCommentSubmit}
            >
              Gönder
            </Button>
          </div>
        </Container>
      </Collapse>

      {/* Popup (Dialog) */}
      <Dialog open={dialogOpen} onClose={() => handleDialogClose(false)}>
        <DialogTitle>{"Maçı Sil"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bu maçı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose(false)} color="primary">
            Vazgeç
          </Button>
          <Button onClick={() => handleDialogClose(true)} color="error" autoFocus>
            Sil
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Post;