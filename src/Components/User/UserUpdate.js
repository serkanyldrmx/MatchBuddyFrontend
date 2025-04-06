import React, { useEffect, useState } from "react";
import { Card, Avatar, Typography, Form, Input, Button, Checkbox, message } from "antd";
import { UserOutlined } from "@ant-design/icons";
import "./User.css";
import Navbar from "../Navbar/Navbar";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

function UserUpdate() {
  const [user, setUser] = useState({});
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setUser(storedUser || {});
    form.setFieldsValue(storedUser || {});
  }, [form]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUser((prevUser) => ({
      ...prevUser,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e) => {
    setUser((prevUser) => ({
      ...prevUser,
      matchNotificationPermission: e.target.checked ? 1 : 0,
    }));
  };

  const handleSubmit = () => {
    axios
      .post("http://localhost:5033/api/Players/UpdatePlayer", user)
      .then((response) => {
        console.log(response);
        message.success("Kullanıcı bilgileri güncellendi.");
        localStorage.setItem("user", JSON.stringify(user));
        setTimeout(() => {
          navigate("/");
        }, 1500);
      })
      .catch((err) => {
        console.log(err);
        message.error("Kullanıcı bilgileri güncellenemedi.");
      });
  };

  const labelStyle = {
    color: "#000", // Change the color to black
    fontWeight: "bold",
};

  const formItemLayout = {
    labelCol: { span: 12 },
    wrapperCol: { span: 12 },
  };

  return (
    <div className="user" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: '20px', backgroundColor: "#f0f2f5" }}>
      <Navbar />
      <Card className="card1" style={{ width: 340, borderRadius: 10, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
          <Avatar size={64} icon={<UserOutlined />} style={{ marginBottom: "20px" }} />
          <Text style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#000' }}>Kullanıcı Bilgileri</Text>
          <Form {...formItemLayout} form={form} style={{ width: "100%" }} onFinish={handleSubmit}>
            <Form.Item label={<span style={labelStyle}>Ad</span>} name="playerName">
              <Input name="playerName" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Soyad</span>} name="playerSurname">
              <Input name="playerSurname" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Kullanıcı Adı</span>} name="userName">
              <Input name="userName" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>E-posta</span>} name="email">
              <Input name="email" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Telefon Numarası</span>} name="phoneNumber">
              <Input name="phoneNumber" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Adres</span>} name="address">
              <Input name="address" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Boy</span>} name="size">
              <Input name="size" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Kilo</span>} name="weight">
              <Input name="weight" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item label={<span style={labelStyle}>Yaş</span>} name="age">
              <Input name="age" onChange={handleInputChange} />
            </Form.Item>
            <Form.Item
              label={<span style={labelStyle}>Maç Bildirimi İzin</span>}
              name="matchNotificationPermission"
              valuePropName="checked"
            >
              <Checkbox
                checked={user.matchNotificationPermission === 1}
                onChange={handleCheckboxChange}
              />
            </Form.Item>
            <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: "center" }}>
              <Button type="primary" htmlType="submit">Güncelle</Button>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  );
}

export default UserUpdate;
