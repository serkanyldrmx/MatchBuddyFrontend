import React, { useState } from 'react';
import { message, Card, Avatar, Input, Button, Spin } from 'antd';
import Navbar from "../Navbar/Navbar";
import './TeamAICreate.css';
import axios from 'axios';
import { BrainCircuit } from "lucide-react";

function TeamAICreate() {
    const [teamName1, setTeamName1] = useState('');
    const [teamName2, setTeamName2] = useState('');
    const [teamMembers, setTeamMembers] = useState({ team1: [], team2: [] });
    const [loading, setLoading] = useState(false);
    const [teamSize, setTeamSize] = useState(6); // Varsayılan değer olarak 6
    const { Meta } = Card; 
    
    const handleCreateTeam = () => {
        // Takım isimlerinin boş olup olmadığını kontrol et
        

        if (teamSize < 4 || teamSize > 11) {
            message.error('Takım boyutu 4 ile 11 arasında olmalıdır!');
            return;
        }

        setLoading(true);
        fetch(`http://localhost:5000/create-teams?teamSize=${teamSize}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }
                return res.json();
            })
            .then(
                (result) => {
                    setTeamMembers(result);
                    message.success('Takımlar başarıyla oluşturuldu!');
                    setLoading(false);
                },
                (error) => {
                    message.error('Takımlar oluşturulurken bir hata oluştu.');
                    console.error('Error:', error);
                    setLoading(false);
                }
            );
    };

    const handleSaveTeams = async () => {
        // Takım isimlerinin boş olup olmadığını kontrol et
        if (!teamName1 || !teamName2) {
            message.error('Her iki takımın adı da girilmelidir!');
            return;
        }

        setLoading(true);

        // Takım kaydetme fonksiyonu
        const saveTeam = async (teamName, teamMembers) => {
            console.log(`Takım Kaydediliyor: ${teamName}, Üyeler: ${teamMembers}`);
            
            // Burada sadece playerId'leri alıp gönderiyoruz
            const playerIds = teamMembers.map(member => member.playerId);

            const payload = {
                TeamName: teamName,  // Takım adı
                PlayerId: playerIds  // Sadece playerId'leri gönderiyoruz
            };
            
            console.log("Gönderilen Payload:", payload);
            
            try {
                console.log('API isteği gönderiliyor...');
                const response = await axios.post("http://localhost:5033/api/Team/SaveTeam", payload, {
                    headers: { "Content-Type": "application/json" }
                });
                console.log('API yanıtı:', response);
                if (response.status === 200) {
                    return response.data;
                } else {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                console.error('Hata:', error);
                message.error("Takım kaydedilirken bir hata oluştu! " + error.message);
                return null;
            }
        };

        // Takımları ayrı ayrı kaydet
        const result1 = await saveTeam(teamName1, teamMembers.team1);
        const result2 = await saveTeam(teamName2, teamMembers.team2);

        if (result1 && result2) {
            message.success("Takımlar başarıyla kaydedildi!");
        }

        setLoading(false);
    };

    // Her takımın puanlarını toplama
    const getTotalScore = (team) => {
        return team.reduce((total, member) => total + member.userScore, 0);
    };

    return (
        <div className="team-ai-create">
            <Navbar />
            <div className="ai-header">
                <BrainCircuit size={32} className="ai-icon1" />
                <h2>Yapay Zeka ile Turnuva Oluşturma</h2>
            </div>

            {/* Takım boyutu input alanı */}
            <div className="team-size-input">
                <Input
                    type="number"
                    min={4}
                    max={11}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    placeholder="Takım Büyüklüğü (4-11)"
                />
            </div>

            <Button onClick={handleCreateTeam} disabled={loading} type="primary">
                {loading ? <Spin /> : 'Takımları Oluştur'}
            </Button>
            <div className="team-inputs">
                <Input
                    placeholder="Takım 1 Adı"
                    value={teamName1}
                    onChange={(e) => setTeamName1(e.target.value)}
                />
                <Input
                    placeholder="Takım 2 Adı"
                    value={teamName2}
                    onChange={(e) => setTeamName2(e.target.value)}
                />
            </div>

            <div className="team-container">
                {/* Takım 1 */}
                <div className="team-card-Ai">
                    <h3>{teamName1 || 'Takım 1'}</h3>
                    <div className="total-score">
                        Toplam Puan: {getTotalScore(teamMembers.team1)}
                    </div>
                    {teamMembers.team1.map((member, index) => (
                        <Card key={index} className="team-member" bordered={false}>
                            <Avatar>{member.playerName[0]}</Avatar>
                            <div>
                                <h4>{member.playerName} {member.playerSurname}</h4>
                                <p>Yaş: {member.age}</p>
                                <p>Skor: {member.userScore}</p>
                                <p>Boy: {member.size} cm - Kilo: {member.weight} kg</p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Takım 2 */}
                <div className="team-card-Ai">
                    <h3>{teamName2 || 'Takım 2'}</h3>
                    <div className="total-score">
                        Toplam Puan: {getTotalScore(teamMembers.team2)}
                    </div>
                    {teamMembers.team2.map((member, index) => (
                        <Card key={index} className="team-member" bordered={false}>
                            <Avatar>{member.playerName[0]}</Avatar>
                            <div>
                                <h4>{member.playerName} {member.playerSurname}</h4>
                                <p>Yaş: {member.age}</p>
                                <p>Skor: {member.userScore}</p>
                                <p>Boy: {member.size} cm - Kilo: {member.weight} kg</p>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            <Button onClick={handleSaveTeams} className="save-teams-button" type="primary">Takımları Kaydet</Button>
        </div>
    );
}

export default TeamAICreate;
