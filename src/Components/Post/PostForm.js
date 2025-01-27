import React, { useState, useEffect } from "react";
import { styled } from '@mui/material/styles';
import { Card, CardHeader, CardContent, OutlinedInput, Typography, Button, Box, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import {message } from "antd";
import axios from 'axios';
import enUS from 'antd/es/locale/en_US';
import "./Post.css";

dayjs.extend(buddhistEra);
const defaultValue = dayjs().set('minute', 0).set('second', 0);

const StyledCard = styled(Card)(({ theme }) => ({
  margin: '20px',
  width: '500px',
  backgroundColor: '#6ded6d', // Açık yeşil rengi
  padding: '20px',
  borderRadius: '15px',
}));

const CompactOutlinedInput = styled(OutlinedInput)(({ theme }) => ({
  marginBottom: '15px',
  '& .MuiOutlinedInput-input': {
    padding: '10px',
  },
  '& fieldset': {
    borderRadius: '10px',
  },
  width: 'calc(50% - 10px)',
}));

const FullWidthOutlinedInput = styled(OutlinedInput)(({ theme }) => ({
  marginBottom: '15px',
  '& .MuiOutlinedInput-input': {
    padding: '10px',
  },
  '& fieldset': {
    borderRadius: '10px',
  },
  width: '100%',
}));

const StyledDatePicker = styled(DatePicker)(({ theme }) => ({
  width: '100%',
  borderRadius: '10px',
  '& .ant-picker': {
    borderRadius: '10px',
  },
}));

function PostForm() {
  const [matchName, setMatchName] = useState("");
  const [matchDate, setMatchDate] = useState(defaultValue.toDate());
  const [participantCount, setParticipantCount] = useState(8);
  const [description, setDescription] = useState("");
  const [stadiums, setStadiums] = useState([]);
  const [selectedStadium, setSelectedStadium] = useState("");
  const [errors, setErrors] = useState({});
  const [responseMessage, setResponseMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:5033/api/Stadium/GetStadiumList")
      .then((response) => {
        setStadiums(response.data);
      })
      .catch((error) => {
        console.error("There was an error fetching the stadium list!", error);
      });
  }, []);

  const validate = () => {
    let tempErrors = {};
    tempErrors.matchName = matchName ? "" : "Bu alan zorunludur.";
    tempErrors.matchDate = matchDate ? "" : "Bu alan zorunludur.";
    tempErrors.participantCount = participantCount >= 8 ? "" : "En az 8 oyuncu gereklidir.";
    tempErrors.selectedStadium = selectedStadium ? "" : "Bu alan zorunludur.";

    const selectedStadiumData = stadiums.find(stadium => stadium.stadiumId === selectedStadium);
    if (selectedStadiumData) {
      const matchTime = dayjs(matchDate).format('HH:mm:ss');
      const openingTime = selectedStadiumData.openingTime;
      let closingTime = selectedStadiumData.closingTime;

      if (closingTime === "00:00:00") {
        closingTime = "24:00:00";
      }

      if (matchTime < openingTime || matchTime > closingTime) {
        tempErrors.matchDate = "Stadyum bu saatte kapalıdır.";
      } else {
        tempErrors.matchDate = "";
      }
    }

    setErrors(tempErrors);
    return Object.values(tempErrors).every(x => x === "");
  };

  const handleSubmit = () => {
    if (validate()) {
      const match = {
        matchName,
        matchDate,
        userCount: parseInt(participantCount, 10),
        description,
        isActive: 1,
        stadiumId: selectedStadium,
      };
  
      axios.post("http://localhost:5033/api/Match/SaveMatch", match)
        .then((response) => {
          if (response.data.success) {
            message.success(response.data.message || "Başarıyla kaydedildi.");
  
            // Sayfayı yenilemek için navigate kullanarak aynı sayfaya yönlendiriyoruz
            setTimeout(() => {
              navigate(0); // Sayfayı yeniler
            }, 1500);
          } else {
            message.error(response.data.message || "Bir hata oluştu. Lütfen tekrar deneyiniz.");
            console.log(response.data.message);
          }
        })
        .catch((error) => {
          if (error.response && error.response.data && error.response.data.message) {
            message.error(error.response.data.message); // API'den gelen hata mesajını göster
          } else {
            message.error("Bir hata oluştu. Lütfen tekrar deneyiniz."); // Genel hata mesajı
          }
          console.error(error);
        });
    }
  };
  

  const onChange = (_, dateStr) => {
    setMatchDate(new Date(dateStr));
  };

  const disabledDate = (current) => {
    return current && current < dayjs().startOf('day');
  };

  return (
    <div className="postContainer">
      <StyledCard>
        <CardHeader
          title={(
            <Box display="flex" justifyContent="space-between">
              <CompactOutlinedInput
                variant="outlined"
                placeholder="Maç Adı: "
                inputProps={{ maxLength: 25 }}
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                error={!!errors.matchName}
              />
              <CompactOutlinedInput
                type="number"
                variant="outlined"
                placeholder="Katılacak Oyuncu Sayısı: "
                inputProps={{ min: 8, maxLength: 2 }}
                value={participantCount}
                onChange={(e) => {
                  if (e.target.value >= 8) {
                    setParticipantCount(e.target.value);
                  }
                }}
                error={!!errors.participantCount}
              />
            </Box>
          )}
        />
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '15px' }}>
          Stadyum:
          <FormControl fullWidth error={!!errors.selectedStadium}>
            <InputLabel id="stadium-select-label">Stadyum Seç</InputLabel>
            <Select
              labelId="stadium-select-label"
              value={selectedStadium}
              onChange={(e) => setSelectedStadium(e.target.value)}
              label="Stadyum Seç"
            >
              {stadiums.map((stadium) => (
                <MenuItem key={stadium.stadiumId} value={stadium.stadiumId}>
                  {stadium.stadiumName}
                </MenuItem>
              ))}
            </Select>
            {errors.selectedStadium && <Typography color="error">{errors.selectedStadium}</Typography>}
          </FormControl>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '15px' }}>
          Maç Tarihi:
          <StyledDatePicker
            defaultValue={defaultValue}
            showTime={{
              format: 'HH', // Sadece saat kısmı
              hourStep: 1, // Saat aralığını 1 saat olarak ayarlıyoruz
              minute: false, // Dakika kısmını kaldırıyoruz
            }}
            onChange={onChange}
            locale={enUS}
            disabledDate={disabledDate}
          />
          {errors.matchDate && <Typography color="error">{errors.matchDate}</Typography>}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '15px' }}>
          <FullWidthOutlinedInput
            variant="outlined"
            multiline
            placeholder="Açıklama : "
            inputProps={{ maxLength: 250 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Typography>
        <Button
          variant="contained"
          style={{
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            color: 'white',
            marginTop: '15px',
          }}
          onClick={handleSubmit}
        >
          Maçı Kaydet
        </Button>
      </StyledCard>
    </div>
  );
}

export default PostForm;
