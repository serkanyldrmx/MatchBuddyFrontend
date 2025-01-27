import React from "react";
import "./Communication.css"; // CSS dosyasını unutmayın
import SerkanYildirim from "./SerkanYildirim.jpg"; // Import the image

const Communication = () => {
    return (
        <div className="communication-container">
            <header className="header">
                <h1>Bizimle İletişime Geçin</h1>
                <p>Sorularınız, önerileriniz ve görüşleriniz bizim için çok değerlidir.</p>
            </header>

            <div className="content">
                <section className="contact-details">
                    <h2>İletişim Bilgilerimiz</h2>
                    <img src={SerkanYildirim} alt="Serkan Yıldırım" className="team-member-image" />
                    <p><strong>Adres:</strong> Konya, Türkiye</p>
                    <p><strong>Telefon:</strong> +90 545 521 82 49</p>
                    <p><strong>E-posta:</strong> bmserkanyildirim@matchbuddy.com</p>
                </section>

                <section className="contact-form">
                    <h2>Bize Ulaşın</h2>
                    <form className="form">
                        <div className="form-group">
                            <label htmlFor="name">Adınız</label>
                            <input type="text" id="name" name="name" placeholder="Adınızı girin" required />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">E-posta</label>
                            <input type="email" id="email" name="email" placeholder="E-posta adresinizi girin" required />
                        </div>

                        <div className="form-group">
                            <label htmlFor="message">Mesajınız</label>
                            <textarea id="message" name="message" placeholder="Mesajınızı yazın" rows="5" required></textarea>
                        </div>

                        <button type="submit" className="submit-button">Gönder</button>
                    </form>
                </section>
            </div>

            <footer className="footer">
                <p>&copy; 2024 MatchBuddy. Tüm hakları saklıdır.</p>
            </footer>
        </div>
    );
};

export default Communication;
