import React, { useEffect, useState } from "react";
import { Card, Avatar, List, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import "./User.css";
import Navbar from "../Navbar/Navbar";

const { Text } = Typography;

function User() {
  const [user, setUser] = useState({}); // Kullanıcı bilgisi
  const [player, setPlayer] = useState(null); // API'den gelen oyuncu bilgisi
  const [loading, setLoading] = useState(true); // Yüklenme durumu
  const [error, setError] = useState(null); // Hata durumu

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")); // localStorage'dan kullanıcı bilgisi al
    setUser(storedUser || {});

    const fetchPlayerById = async () => {
      if (!storedUser || !storedUser.playerId) {
        setError("Geçerli bir kullanıcı bulunamadı.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:5033/api/Players/GetPlayerById?playerId=${storedUser.playerId}`
        );
        if (!response.ok) {
          throw new Error("API isteğinde bir hata oluştu");
        }
        const data = await response.json();
        setPlayer(data); // API'den gelen veriyi player state'ine ata
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false); // Yüklenme durumunu kapat
      }
    };

    fetchPlayerById();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Yüklenme durumu
  }

  if (error) {
    return <div>Hata: {error}</div>; // Hata durumu
  }

  if (!player) {
    return <div>Kullanıcı bulunamadı.</div>; // Kullanıcı bulunamadı durumu
  }

  const labelStyle = { color: "#000000", marginRight: "5px", fontWeight: "bold" };
  const valueStyle = { color: "#000000" };

  const userDetails = [
    { label: "Ad", value: player.playerName || "Bilinmiyor" },
    { label: "Soyad", value: player.playerSurname || "Bilinmiyor" },
    { label: "Kullanıcı Adı", value: player.userName || "Bilinmiyor" },
    { label: "E-posta", value: player.email || "Bilinmiyor" },
    { label: "Telefon Numarası", value: player.phoneNumber || "Bilinmiyor" },
    { label: "Adres", value: player.address || "Bilinmiyor" },
    { label: "Boy", value: player.size ? `${player.size} cm` : "Bilinmiyor" },
    { label: "Kilo", value: player.weight ? `${player.weight} kg` : "Bilinmiyor" },
    { label: "Yaş", value: player.age || "Bilinmiyor" },
    { label: "Maç Bildirimi İzin", value: player.matchNotificationPermission ? "Evet" : "Hayır" },
    { label: "Kullanıcı Puanı", value: player.userScore || 0 },
  ];

  return (
    <div
      className="user"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: "#f0f2f5",
      }}
    >
      <Navbar />
      <Card
        className="card1"
        style={{
          width: 340,
          borderRadius: 10,
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 0",
          }}
        >
          <Avatar
            size={64}
            icon={<UserOutlined />}
            style={{ marginBottom: "20px" }}
          />
          <Text
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
              color: "#000000",
            }}
          >
            Kullanıcı Bilgileri
          </Text>
          <List
            itemLayout="horizontal"
            dataSource={userDetails}
            renderItem={(item) => (
              <List.Item style={{ marginBottom: "10px" }}>
                <Text style={labelStyle}>{item.label}: </Text>
                <Text style={valueStyle}>{item.value}</Text>
              </List.Item>
            )}
          />
        </div>
      </Card>
    </div>
  );
}

export default User;