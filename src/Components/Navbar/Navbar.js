import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { styled, alpha } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import { Button, Dropdown } from 'antd';
import { 
  UsergroupAddOutlined, 
  UserOutlined, 
  HomeOutlined, 
  TableOutlined, 
  LogoutOutlined, 
  BorderOuterOutlined, 
  GatewayOutlined, 
  TeamOutlined, 
  QuestionCircleOutlined, 
  CloudUploadOutlined, 
  CommentOutlined, 
  BellOutlined 
} from '@ant-design/icons';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';
import './Navbar.css';

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
    label: <a href="/user">Profilim</a>,
    key: '1',
    icon: <QuestionCircleOutlined />,
    style: { color: 'orange' },
  },
  {
    label: <a href="/userUpdate">Profilimi Güncelle</a>,
    key: '2',
    icon: <CloudUploadOutlined />,
    style: { color: 'green' },
  },
  {
    label: <a href="/user">Maçlar</a>,
    key: '3',
    icon: <BorderOuterOutlined />,
  },
  {
    label: <a href="/user">Takım</a>,
    key: '4',
    icon: <UsergroupAddOutlined />,
  },
  {
    label: (
      <a
        href="/"
        onClick={() => {
          localStorage.setItem('user', null);
        }}
      >
        Çıkış
      </a>
    ),
    key: '5',
    icon: <LogoutOutlined />,
    danger: true,
  },
];

function Navbar() {
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(5);
  const navigate = useNavigate();
  const player = JSON.parse(localStorage.getItem("user"));
  const playerId = player?.playerId || player?.userId;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5033/api/Notifications/GetNotificationsByPlayerId?playerId=${playerId}`
        );
        const unreadCount = response.data.filter((notification) => !notification.isRead).length;
        setNotificationCount(unreadCount);
      } catch (error) {
        console.error("Bildirimler alınırken hata oluştu:", error);
      }
    };
    fetchNotifications();
  }, [playerId]);
  

  return (
    <AppBar style={{ position: 'fixed', width: '100%', zIndex: 100, backgroundColor: '#3f51b5' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Link className="link" to="/home">
            <HomeOutlined style={{ color: 'white' }} /> Match Buddy
          </Link>
        </Typography>

        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase placeholder="Search…" inputProps={{ 'aria-label': 'search' }} />
        </Search>

        <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
          <Button type="link" className="white-button" href="/homeStadium">
            <GatewayOutlined /> Stadyumlar
          </Button>
          <Button type="link" className="white-button" href="/players">
            <TeamOutlined /> Oyuncular
          </Button>
          <Button type="link" className="white-button" href="/team">
            <TableOutlined /> Takımlar
          </Button>
        </Box>

        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          <IconButton
            size="large"
            aria-label="show notifications"
            color="inherit"
            title="Bildirimler"
            onClick={() => navigate('/notificationList')}
          >
            <Badge badgeContent={notificationCount} color="error" showZero>
              <BellOutlined style={{ fontSize: '24px', color: 'white' }} />
            </Badge>
          </IconButton>

          <IconButton
            size="large"
            aria-label="show messages"
            color="inherit"
            title="Mesajlar"
            onClick={() => navigate('/chat')}
          >
            <Badge badgeContent={messageCount} color="error" showZero>
              <CommentOutlined style={{ fontSize: '24px', color: 'white' }} />
            </Badge>
          </IconButton>

          <Dropdown menu={{ items }} placement="bottomRight">
            <UserOutlined style={{ color: 'white', fontSize: '22px', marginLeft: '10px' }} />
          </Dropdown>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
