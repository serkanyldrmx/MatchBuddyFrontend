import React from "react";
import "./About.css";
import SerkanYildirim from "./SerkanYildirim.jpg"; // Import the image

const About = () => {
    return (
        <div className="hakkimizda-container">
            <header className="header">
                <h1>MatchBuddy</h1>
                <p>Halı saha arkadaşını bul, eğlenceye katıl!</p>
            </header>

            <div className="content">
                <section className="section">
                    <h2>Biz Kimiz?</h2>
                    <p>MatchBuddy, halı saha maçı yapmak isteyen ancak takım arkadaşlarını bulmakta zorlanan kişiler için oluşturulmuş bir sosyal platformdur. Amacımız, insanların hem spor yapmasını hem de sosyalleşmesini desteklemektir.</p>
                </section>

                <section className="section">
                    <h2>Misyonumuz</h2>
                    <p>Takım ruhunu desteklemek, spor yapmayı teşvik etmek ve insanları bir araya getirerek unutulmaz anılar yaratmak. Halı saha maçlarını daha eğlenceli ve erişilebilir hale getiriyoruz.</p>
                </section>

                <section className="section">
                    <h2>Ekibimiz</h2>
                    <div className="team">
                        <div className="team-member">
                            <img src={SerkanYildirim} alt="Serkan Yıldırım" className="team-member-image" />
                            <div className="team-member-info">
                                <h3>Serkan Yıldırım</h3>
                                <p>Kurucu & Geliştirici, UI/UX Tasarımcı, Backend Geliştirici</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <footer className="footer">
                <p>&copy; 2024 MatchBuddy. Tüm hakları saklıdır.</p>
            </footer>
        </div>
    );
};

export default About;