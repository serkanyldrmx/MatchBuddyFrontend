import React from "react";
import {
    Facebook as FacebookIcon,
    Twitter as TwitterIcon,
    Instagram as InstagramIcon,
    LinkedIn as LinkedInIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocationOn as LocationIcon,
    GitHub as GitHubIcon,
    YouTube as YouTubeIcon,
} from "@mui/icons-material";
import "./About.css";
import SerkanYildirim from "./SerkanYildirim.jpg";
import Logo from '../../images/mutch_buddy_Logo.png'; // Import the logo

const About = () => {
    return (
        <div className="about-container">
            <header className="about-header1">
                <div className="about-header-content">
                    <img src={Logo} alt="MatchBuddy Logo" className="about-logo" /> {/* Add the logo */}
                    <div>
                        <h1>MatchBuddy</h1>
                        <p>Halı saha arkadaşını bul, eğlenceye katıl!</p>
                    </div>
                </div>
            </header>

            <div className="about-content">
                <section className="about-section">
                    <h2>Biz Kimiz?</h2>
                    <p>MatchBuddy, halı saha maçı yapmak isteyen ancak takım arkadaşlarını bulmakta zorlanan kişiler için oluşturulmuş bir sosyal platformdur. Amacımız, insanların hem spor yapmasını hem de sosyalleşmesini desteklemektir.</p>
                </section>

                <section className="about-section">
                    <h2>Misyonumuz</h2>
                    <p>Takım ruhunu desteklemek, spor yapmayı teşvik etmek ve insanları bir araya getirerek unutulmaz anılar yaratmak. Halı saha maçlarını daha eğlenceli ve erişilebilir hale getiriyoruz.</p>
                </section>

                <section className="about-section">
                    <h2>Ekibimiz</h2>
                    <div className="about-team">
                        <div className="about-team-member">
                            <img src={SerkanYildirim} alt="Serkan Yıldırım" className="about-team-member-image" />
                            <div className="about-team-member-info">
                                <h3>Serkan Yıldırım</h3>
                                <p>Kurucu & Geliştirici, UI/UX Tasarımcı, Backend Geliştirici</p>
                            </div>
                        </div>
                        <div className="about-team-member">
                            <img src={SerkanYildirim} alt="Diğer Üye" className="about-team-member-image" />
                            <div className="about-team-member-info">
                                <h3>Diğer Üye</h3>
                                <p>Frontend Geliştirici</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-section about-stats">
                    <h2>İstatistikler</h2>
                    <div className="stats-container">
                        <div className="stat-item">
                            <h3>10,000+</h3>
                            <p>Kayıtlı Kullanıcı</p>
                        </div>
                        <div className="stat-item">
                            <h3>5,000+</h3>
                            <p>Organize Edilen Maç</p>
                        </div>
                        <div className="stat-item">
                            <h3>1,000+</h3>
                            <p>Takım</p>
                        </div>
                    </div>
                </section>
            </div>

            <section className="about-contact">
                <h2>Bize Ulaşın</h2>
                <div className="contact-info">
                    <p><PhoneIcon /> +90 545 521 82 49</p>
                    <p><EmailIcon /> bmserkanyildirim@matchbuddy.com</p>
                    <p><LocationIcon /> Coşandere Cd. No:3 Bosna Hersek, 42250 Selçuklu/Konya</p>
                </div>
                <p>İlişkin güncel haberler için bizi sosyal medya hesaplarımızdan takip edin.</p>
                <div className="social-links">
                    <a href="#" className="social-icon"><InstagramIcon /></a>
                    <a href="#" className="social-icon"><FacebookIcon /></a>
                    <a href="#" className="social-icon"><TwitterIcon /></a>
                    <a href="https://www.linkedin.com/in/serkan-y%C4%B1ld%C4%B1r%C4%B1m-558571222/" className="social-icon" target="_blank" rel="noopener noreferrer"><LinkedInIcon /></a>
                    <a href="https://github.com/serkanyldrmx" className="social-icon" target="_blank" rel="noopener noreferrer"><GitHubIcon /></a>
                    <a href="https://www.youtube.com/" className="social-icon"><YouTubeIcon /></a>
                </div>
            </section>

            <footer className="about-footer">
                <p>&copy; 2024 MatchBuddy. Tüm hakları saklıdır.</p>
            </footer>
        </div>
    );
};

export default About;