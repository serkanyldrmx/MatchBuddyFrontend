import React, { useEffect, useState } from "react";
import { Card, Avatar, Typography, Form, Input, Button, Checkbox, message, Upload, Select, Row, Col } from "antd";
import { UserOutlined, UploadOutlined, MailOutlined, HomeOutlined, NumberOutlined, EditOutlined } from "@ant-design/icons";
import "./User.css";
import Navbar from "../Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const { Text } = Typography;
const { Option } = Select;

const formItemLayout = {
  labelCol: { xs: { span: 24 }, sm: { span: 4 } },
  wrapperCol: { xs: { span: 24 }, sm: { span: 20 } },
};

function UserUpdate() {
  const [user, setUser] = useState({});
  const [fileList, setFileList] = useState([]);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    setUser(storedUser);
    form.setFieldsValue({
      playerName: storedUser.playerName || storedUser.PlayerName || "",
      playerSurname: storedUser.playerSurname || storedUser.PlayerSurname || "",
      userName: storedUser.userName || storedUser.UserName || "",
      email: storedUser.email || storedUser.Email || "",
      prefix: storedUser.phoneNumber?.startsWith("+90") ? "90" : "90",
      phoneNumber: storedUser.phoneNumber?.replace(/^\+\d{2}/, "") || "",
      address: storedUser.address || storedUser.Address || "",
      size: storedUser.size || storedUser.Size || "",
      weight: storedUser.weight || storedUser.Weight || "",
      age: storedUser.age || storedUser.Age || "",
      matchNotificationPermission: storedUser.matchNotificationPermission === 1,
    });

    if (storedUser?.profilePictureUrl) {
      setFileList([{ uid: "-1", name: "profilePicture", status: "done", url: storedUser.profilePictureUrl }]);
    }
  }, [form]);

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      if (!file.type.startsWith("image/")) {
        message.error("Sadece resim dosyaları yüklenebilir!");
        return Upload.LIST_IGNORE;
      }
      if (file.size > 5 * 1024 * 1024) {
        message.error("Dosya boyutu 5 MB'tan büyük olamaz!");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false;
    },
    fileList,
  };

  const prefixSelector = (
    <Form.Item name="prefix" noStyle initialValue="90">
      <Select style={{ width: 70 }}>
        <Option value="90">+90</Option>
        <Option value="80">+80</Option>
        <Option value="70">+70</Option>
      </Select>
    </Form.Item>
  );

  const updateLocalStorageUser = async (playerId) => {
    try {
      const response = await axios.get(`http://localhost:5033/api/Players/GetPlayerById?playerId=${playerId}`);
      if (response.data) {
        localStorage.setItem("user", JSON.stringify(response.data));
        setUser(response.data);
      }
    } catch (err) {
      console.error("Kullanıcı bilgileri güncellenirken hata oluştu:", err);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      const formData = new FormData();
      const playerModel = {
        PlayerId: user.playerId || user.PlayerId || "",
        PlayerName: values.playerName || "",
        PlayerSurname: values.playerSurname || "",
        Password: values.password || "",
        Size: values.size ? parseFloat(values.size) : 0,
        Weight: values.weight ? parseFloat(values.weight) : 0,
        UserScore: user.userScore || user.UserScore || 0,
        Address: values.address || "",
        Age: values.age ? parseInt(values.age) : 0,
        Email: values.email || "",
        PhoneNumber: values.prefix && values.phoneNumber ? `+${values.prefix}${values.phoneNumber}` : "",
        UserName: values.userName || "",
        MatchNotificationPermission: values.matchNotificationPermission ? 1 : 0,
      };

      // FormData'ya playerModel ve profilePicture ekle
      formData.append("playerModel", JSON.stringify(playerModel));
      if (fileList.length > 0 && !fileList[0].url) {
        formData.append("profilePicture", fileList[0]);
      }

      // FormData içeriğini konsola yazdır
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }

      const response = await axios.post(
        "http://localhost:5033/api/Players/UpdatePlayer",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success !== false) {
        message.success("Kullanıcı bilgileri güncellendi.");
        if (response.data.data?.profilePictureUrl) {
          user.profilePictureUrl = response.data.data.profilePictureUrl;
          setFileList([{ uid: "-1", name: "profilePicture", status: "done", url: response.data.data.profilePictureUrl }]);
        }
        // localStorage'ı API'den güncel veriyle güncelle
        await updateLocalStorageUser(playerModel.PlayerId);
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } else {
        message.error("Güncelleme başarısız: " + (response.data.message || "Bilinmeyen hata"));
      }
    } catch (error) {
      console.error("Error:", error);
      let errorMessage = "Kullanıcı bilgileri güncellenemedi.";
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
          errorMessage = Object.values(error.response.data.errors)
            .flat()
            .join(", ");
        } else if (error.response.data.title) {
          errorMessage = error.response.data.title;
        }
      } else {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    }
  };

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
          width: 600,
          borderRadius: 10,
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "10px 0",
            width: "100%",
            justifyContent: "center",
            gap: 32,
          }}
        >
          <Avatar
            src={
              user.profilePictureUrl
                ? user.profilePictureUrl.startsWith("http")
                  ? user.profilePictureUrl
                  : `http://localhost:5033${user.profilePictureUrl}`
                : null
            }
            style={{ width: 120, height: 120 }}
          >
            {!user.profilePictureUrl && <UserOutlined style={{ fontSize: 64 }} />}
          </Avatar>
          <Form.Item name="profilePicture" rules={[{ required: false }]} style={{ marginBottom: 0, marginLeft: 24 }}>
            <Upload {...uploadProps} accept="image/*" maxCount={1}>
              <Button icon={<UploadOutlined />}>Fotoğraf Yükle</Button>
            </Upload>
          </Form.Item>
        </div>

        <Text
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "10px",
            color: "#000",
          }}
        >
          Kullanıcı Bilgileri
        </Text>
        <Form
          {...formItemLayout}
          form={form}
          style={{ width: "100%" }}
          onFinish={handleSubmit}
          scrollToFirstError
        >
          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="playerName"
                rules={[{ required: true, message: "Lütfen adınızı girin!", whitespace: true }]}
              >
                <Input prefix={<UserOutlined />} placeholder="İsim" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="playerSurname"
                rules={[{ required: true, message: "Lütfen soyadınızı girin!", whitespace: true }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Soyisim" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                rules={[
                  { type: "email", message: "Geçerli bir e-posta adresi girin!" },
                  { required: true, message: "Lütfen e-posta adresinizi girin!" },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="E-posta" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phoneNumber"
                rules={[{ required: true, message: "Lütfen telefon numaranızı girin!" }]}
              >
                <Input
                  addonBefore={prefixSelector}
                  placeholder="Telefon Numarası"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="address"
                rules={[{ required: true, message: "Lütfen adresinizi girin!" }]}
              >
                <Input prefix={<HomeOutlined />} placeholder="Adres" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="size"
                rules={[{ required: true, message: "Lütfen boyunuzu girin!" }]}
              >
                <Input prefix={<NumberOutlined />} placeholder="Boy (cm)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="weight"
                rules={[{ required: true, message: "Lütfen kilonuzu girin!" }]}
              >
                <Input prefix={<NumberOutlined />} placeholder="Kilo (kg)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="age"
                rules={[{ required: true, message: "Lütfen yaşınızı girin!" }]}
              >
                <Input prefix={<NumberOutlined />} placeholder="Yaş" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="userName"
                rules={[{ required: true, message: "Lütfen kullanıcı adınızı girin!" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Kullanıcı Adı" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="matchNotificationPermission" valuePropName="checked">
                <Checkbox>Maç Bildirim İzni</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} justify="center">
            <Col xs={24} sm={12}>
              <Form.Item
                name="password"
                rules={[{ required: false, message: "Lütfen şifrenizi girin!" }]}
                hasFeedback
              >
                <Input.Password prefix={<EditOutlined />} placeholder="Şifre" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="confirm"
                dependencies={["password"]}
                hasFeedback
                rules={[
                  { required: false, message: "Lütfen şifrenizi doğrulayın!" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Girdiğiniz şifreler eşleşmiyor!"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<EditOutlined />} placeholder="Şifreyi Onayla" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: "center" }}>
            <Button type="primary" htmlType="submit">
              Güncelle
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default UserUpdate;