import Post from "../Post/Post";
import React, { useState, useEffect } from 'react';
import { message } from "antd";
import { useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import '../Home/Home.scss'; // Home.scss dosyasını import ediyoruz
import Container from '@mui/material/Container';
import Navbar from "../Navbar/Navbar";
import PostForm from "../Post/PostForm";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; // Yapay zeka simgesi
import mackolikIcon from '../../images/Mackolik.png'; // Mackolik ikonunu ekleyin
import sosyalHalısahaIcon from '../../images/sosyal_Halısaha.png'; // Sosyal Halısaha ikonunu ekleyin
import beinSports from '../../images/bein_Sports.png'; // bein Sports ikonunu ekleyin
import varSistemi from '../../images/varSistemi.png'; // bein Sports ikonunu ekleyin
import { Card, CardContent, Typography, Button } from '@mui/material'; // Card bileşeni

function Home() {
    const location = useLocation();
    const { user } = location.state || {};
    console.log(user);

    const [error, setError] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [postList, setPostList] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5033/api/Match/GetMatchList")
            .then(res => res.json())
            .then(
                (result) => {
                    setIsLoaded(true);
                    setPostList(result);
                },
                (error) => {
                    setIsLoaded(true);
                    setError(error);
                }
            )
    }, []);

    const handleButtonClick = () => {
        message.success("Yapay Zeka ile Sıralama Başlatıldı!");
    };
    const handleButtonTeamClick = () => {
        message.success("Yapay Zeka ile Takım OLuşturmaya yönlendiriliyorsunuz!");
    };

    if (error) {
        return <div>Error!!!</div>;
    } else if (!isLoaded) {
        return <div>Loading...</div>;
    } else {
        return (
            <div>
                <Navbar />
                <div className="container">
                    <Container maxWidth="sm" style={{ margin: '5em' }}>
                        <PostForm
                            key={2}
                            matchName={"deneme"}
                            description={"title"}
                            userCount={5}
                            matchDate={'2024-04-12 18:34:45.1600000'}
                        />
                        <div className="post-container">
                            {postList.map(post => (
                                <div className="post-item" key={post.id}>
                                    <Post
                                        matchId={post.matchId}
                                        matchName={post.matchName}
                                        description={post.description}
                                        userCount={post.userCount}
                                        status={post.isActive}
                                        matchDate={post.matchDate}
                                    />
                                </div>
                            ))}
                        </div>
                    </Container>
                </div>
                {/* Sağ tarafa buton */}
                <button className="ai-button" onClick={handleButtonClick}>
                    <AutoAwesomeIcon className="ai-icon" />
                    Yapay Zeka ile Maçları Sırala
                </button>

                <button className="ai-team-button" onClick={handleButtonTeamClick}>
                    <AutoAwesomeIcon className="ai-icon" />
                    Yapay Zeka ile Takımları Oluştur
                </button>

                {/* Card ile Butonlar */}
                <div className="external-link">
                    <Card sx={{ width: '100%', height: 'auto', margin: '2em auto', backgroundColor: 'transparent', boxShadow: 'none' }}>
                        <CardContent style={{ padding: '0' }}>
                            <Typography variant="h5" component="div" gutterBottom style={{ margin: '10px' }}>
                                Diğer Maç Siteleri
                            </Typography>
                            <div className="button-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' }}>
                                <a href="https://www.mackolik.com" target="_blank" rel="noopener noreferrer">
                                    <Button className="external-link-btn" fullWidth>
                                        <img src={mackolikIcon} alt="Mackolik" className="external-link-icon" />
                                        Mackolik
                                    </Button>
                                </a>
                                <a href="https://www.sosyalhalisaha.com" target="_blank" rel="noopener noreferrer">
                                    <Button className="external-link-btn" fullWidth>
                                        <img src={sosyalHalısahaIcon} alt="Sosyal Halısaha" className="external-link-icon" />
                                        Sosyal Halısaha
                                    </Button>
                                </a>
                                <a href="https://beinsports.com.tr" target="_blank" rel="noopener noreferrer">
                                    <Button className="external-link-btn" fullWidth>
                                        <img src={beinSports} alt="Bein Sports" className="external-link-icon" />
                                        Bein Sports
                                    </Button>
                                </a>
                                <a href="https://varsistemi.com" target="_blank" rel="noopener noreferrer">
                                    <Button className="external-link-btn" fullWidth>
                                        <img src={varSistemi} alt="Var Sistemi" className="external-link-icon" />
                                        Var Sistemi
                                    </Button>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
}

export default Home;
