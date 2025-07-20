import React, { useState, useEffect } from 'react';
import { message } from "antd";
import Post from "../Post/Post";
import { useLocation, useNavigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import '../Home/Home.scss';
import Container from '@mui/material/Container';
import Navbar from "../Navbar/Navbar";
import TeamAICreate from "../AIComponents/TeamAICreate";
import PostForm from "../Post/PostForm";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import mackolikIcon from '../../images/Mackolik.png';
import sosyalHalısahaIcon from '../../images/sosyal_Halısaha.png';
import beinSports from '../../images/bein_Sports.png';
import varSistemi from '../../images/varSistemi.png';
import { Card, CardContent, Typography, Button } from '@mui/material';

function Home() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = location.state || {};
    console.log('User:', user);

    const [error, setError] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [postList, setPostList] = useState([]);

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = () => {
        setIsLoading(true);
        fetch("http://localhost:5033/api/Match/GetMatchList")
            .then(res => res.json())
            .then(
                (result) => {
                    setIsLoaded(true);
                    const matchesWithMessage = result.map(match => ({
                        ...match,
                        personalizedMessage: match.personalizedMessage || ""
                    }));
                    setPostList(matchesWithMessage);
                    setIsLoading(false);
                },
                (error) => {
                    setIsLoaded(true);
                    setError(error);
                    setIsLoading(false);
                    message.error("Maçlar yüklenirken bir hata oluştu!");
                }
            );
    };

    const handleButtonClick = async () => {
        if (!user?.playerId) {
            message.error("Kullanıcı bilgisi eksik, lütfen giriş yapın!");
            return;
        }
        message.success("Yapay Zeka ile sıralama başlatıldı!");
        setIsLoading(true);

        try {
            // Minimum 3 saniye yükleme süresi
            const minimumLoadingTime = new Promise(resolve => setTimeout(resolve, 5000));

            // API çağrısı
            const fetchPromise = fetch(`http://localhost:5001/sort-matches?playerId=${user.playerId}`)
                .then(res => res.json())
                .then(result => {
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    return result.matches.map(match => ({
                        ...match,
                        personalizedMessage: match.personalizedMessage || ""
                    }));
                });

            // Her iki işlem tamamlanana kadar bekle
            const [matches] = await Promise.all([fetchPromise, minimumLoadingTime]);

            setPostList(matches);
            setIsLoading(false);
            message.success("Maçlar başarıyla sıralandı!");
        } catch (error) {
            console.error('Sıralama hatası:', error);
            setError(error);
            setIsLoading(false);
            message.error(`Sıralama başarısız oldu: ${error.message}`);
        }
    };

    const handleButtonTeamClick = () => {
        message.success("Yapay Zeka ile Takım Oluşturmaya yönlendiriliyorsunuz!");
        navigate('/teamAICreate');
    };

    if (error) {
        return <div>Hata: {error.message}</div>;
    } else if (!isLoaded) {
        return <div>Yükleniyor...</div>;
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
                        {isLoading && (
                            <div className="loading-overlay">
                                <div className="loading-content">
                                    <AutoAwesomeIcon className="ai-icon loading-icon" />
                                    <div className="spinner"></div>
                                    <span>Yapay Zeka İle Maçlar Sıralanıyor...</span>
                                </div>
                            </div>
                        )}
                        <div className="post-container">
                            {postList.map(post => (
                                <div className="post-item" key={post.matchId}>
                                    <Post
                                        matchId={post.matchId}
                                        matchName={post.matchName}
                                        description={post.description}
                                        userCount={post.userCount}
                                        status={post.isActive}
                                        matchDate={post.matchDate}
                                        initialLikes={post.likes}
                                        personalizedMessage={post.personalizedMessage}
                                    />
                                </div>
                            ))}
                        </div>
                    </Container>
                </div>
                <button className="ai-button" onClick={handleButtonClick}>
                    <AutoAwesomeIcon className="ai-icon" />
                    Yapay Zeka ile Maçları Sırala
                </button>
                <button className="ai-team-button" onClick={handleButtonTeamClick}>
                    <AutoAwesomeIcon className="ai-icon" />
                    Yapay Zeka ile Turnuva Oluştur
                </button>
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