import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Notification.css";
import Navbar from "../Navbar/Navbar";

const notificationTypeClasses = {
  0: "type-message",
  1: "type-match-join",
  2: "type-match-approval",
  3: "type-match-rejection",
  4: "type-stadium-added",
  5: "type-match-created",
};

const notificationIcons = {
  0: "💬",
  1: "🤝",
  2: "✅",
  3: "❌",
  4: "🏟️",
  5: "⚽",
};

const NotificationList = () => {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const player = JSON.parse(localStorage.getItem("user"));
  const playerId = player?.playerId || player?.userId;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5033/api/Notifications/GetNotificationsByPlayerId?playerId=${playerId}`
        );
        setNotifications(response.data || []);
      } catch (error) {
        console.error("Bildirimler alınırken hata oluştu:", error);
      }
    };
    fetchNotifications();
  }, [playerId]);

  const markAsRead = async (playerNotificationId) => {
    try {
      await axios.post(`http://localhost:5033/api/Notifications/MarkAsRead?playerNotificationId=${playerNotificationId}`);
      window.location.reload(); // sayfayı tamamen yeniler
    } catch (error) {
      console.error("Bildirim okunamadı:", error);
    }
  };

  const handleOpenPopup = (notification) => {
    setSelectedNotification(notification);
  };

  const handleClosePopup = async () => {
    const id = selectedNotification?.playerNotificationId;
    if (!selectedNotification?.isRead && id) {
      await markAsRead(id);
    } else {
      setSelectedNotification(null);
    }
  };

  return (
    <div className="notification-container" style={{ paddingTop: '20px' }}>
      <Navbar />
      <h2>Bildirimler</h2>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <p className="no-notifications">Hiç bildiriminiz yok.</p>
        ) : (
          notifications.map((item) => (
            <div
              key={item.playerNotificationId}
              className={`notification-item ${item.isRead ? "read" : "unread"} ${notificationTypeClasses[item.notification.type]}`}
              onDoubleClick={() => handleOpenPopup(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1c1c1c',
                color: '#ffffff',
                border: '1px solid #444',
                borderRadius: '10px',
                padding: '15px',
                marginBottom: '15px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                cursor: 'pointer',
                fontFamily: 'Segoe UI, sans-serif'
              }}
            >
              <div style={{ fontSize: '24px', marginRight: '12px' }}>
                {notificationIcons[item.notification.type]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: item.isRead ? 'normal' : 'bold' }}>
                  {item.notification.text}
                </div>
                <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>
                  {new Date(item.notification.createdAt).toLocaleString('tr-TR')}
                </div>
              </div>
              {!item.isRead && (
                <button
                  style={{
                    marginLeft: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation(); // div'in çift tıklamasını engelle
                    markAsRead(item.playerNotificationId);
                  }}
                >
                  Okundu
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {selectedNotification && (
        <div
          className="notification-popup"
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fff',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            zIndex: 999,
            color: '#000'
          }}
        >
          <button
            onClick={handleClosePopup}
            style={{
              position: 'absolute',
              top: '10px',
              right: '15px',
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
          <div style={{ fontSize: '30px' }}>
            {notificationIcons[selectedNotification.notification.type]}
          </div>
          <h3 style={{ marginTop: '10px' }}>
            {selectedNotification.notification.type === 0 ? "Mesaj" : "Bildirim"}
          </h3>
          <p style={{ marginTop: '10px' }}>{selectedNotification.notification.text}</p>
        </div>
      )}
    </div>
  );
};

export default NotificationList;
