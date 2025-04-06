import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate eklendi
import { styled, alpha } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton'; 
import Badge from '@mui/material/Badge';
import "./Navbar.css";
import SearchIcon from '@mui/icons-material/Search';
import { Button, Dropdown } from 'antd';
import { UsergroupAddOutlined, UserOutlined, HomeOutlined, TableOutlined, LogoutOutlined, BorderOuterOutlined, GatewayOutlined, TeamOutlined, QuestionCircleOutlined, CloudUploadOutlined, CommentOutlined, BellOutlined } from '@ant-design/icons';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

const items = [
  {
    label: (
      <a href="/user">
        Profilim
      </a>
    ),
    key: '1',
    icon: <QuestionCircleOutlined />,
    style: { color: 'orange' },
  },
  {
    label: (
      <a href="/userUpdate">
        Profilimi Güncelle
      </a>
    ),
    key: '2',
    icon: <CloudUploadOutlined />,
    style: { color: 'green' },
  },
  {
    label: (
      <a href="/user">
        Maçlar
      </a>
    ),
    key: '3',
    icon: <BorderOuterOutlined />,
  },
  {
    label: (
      <a href="/user">
        Takım
      </a>
    ),
    key: '4',
    icon: <UsergroupAddOutlined />,
  },
  {
    label: (
      <a href="/" onClick={() => {
        localStorage.setItem("user", null);
      }}>
        Çıkış
      </a>
    ),
    key: '5',
    icon: <LogoutOutlined />,
    danger: true,
  },
];

function Navbar() {
  const [notificationCount, setNotificationCount] = useState(3); // Bildirim sayısını state olarak tanımlayın
  const [messageCount, setMessageCount] = useState(5); // Mesaj sayısını state olarak tanımlayın
  const navigate = useNavigate(); // useNavigate hook'u ile yönlendirme yapılacak

  return (
    <div>
      <AppBar style={{ position: 'fixed', width: '100%', zIndex: 100, backgroundColor: '#3f51b5' }}>
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            <Link className="link" to="/home"><HomeOutlined style={{ color: 'white' }} />Match Buddy</Link>
          </Typography>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            <Button type="link" className="white-button" href='/homeStadium'><GatewayOutlined />Stadyumlar</Button>
            <Button type="link" className="white-button" href='/players'><TeamOutlined />Oyuncular</Button>
            <Button type="link" className="white-button" href='/team'><TableOutlined />Takımlar</Button>
          </Box>

          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
            {/* Bildirim simgesi */}
            <IconButton size="large" aria-label="show notifications" color="inherit" title="Bildirimler">
              <Badge badgeContent={notificationCount} color="error">
                <BellOutlined style={{ fontSize: '24px', color: 'white' }} />
              </Badge>
            </IconButton>

            {/* Mesaj simgesi */}
            <IconButton
              size="large"
              aria-label="show messages"
              color="inherit"
              title="Mesajlar" // Mesajlar için araç ipucu
              onClick={() => navigate('/chat')} // Mesaj simgesine tıklandığında '/chat' adresine yönlendirme
            >
              <Badge badgeContent={messageCount} color="error">
                <CommentOutlined style={{ fontSize: '24px', color: 'white' }} />
              </Badge>
            </IconButton>

            <Dropdown menu={{ items }} placement="bottomRight">
              <UserOutlined style={{ color: 'white', fontSize: '22px', marginLeft: '10px' }} />
            </Dropdown>
          </Box>
        </Toolbar>
      </AppBar>
    </div>
  );
}

export default Navbar;