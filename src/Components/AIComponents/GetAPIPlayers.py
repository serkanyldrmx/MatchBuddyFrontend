vimport requests
import random
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/create-teams": {"origins": "http://localhost:3000"}})

# API'den oyuncu verilerini çekme
def fetch_players():
    try:
        response = requests.get("http://localhost:5033/api/Players/GetPlayerList")
        response.raise_for_status()  # HTTP hatalarını kontrol et
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API'den oyuncu verileri alınırken bir hata oluştu: {e}")
        raise Exception("Oyuncu listesi alınırken bir hata oluştu.")

# Oyuncuya performans skoru atama
def calculate_performance_score(player):
    # Performans skoru, yaş, kilo, boy ve puanın bir kombinasyonudur.
    
    # Ağırlıklı faktörler
    age_factor = 0.2  # Yaşın etkisi
    weight_factor = 0.1  # Kilonun etkisi
    height_factor = 0.15  # Boyun etkisi
    score_factor = 0.55  # Puanın etkisi

    # Normalizasyon işlemi (örnek değerler ile yapalım)
    max_age = 50  # En yüksek yaş (örnek)
    max_weight = 150  # En yüksek kilo (örnek)
    max_height = 200  # En yüksek boy (örnek)
    max_score = 100  # En yüksek skor (örnek)

    # Normalizasyon ve performans skoru hesaplama
    normalized_age = (max_age - player["age"]) / max_age  # Yaş ne kadar küçükse o kadar iyi
    normalized_weight = (max_weight - player["weight"]) / max_weight  # Kilo ne kadar küçükse o kadar iyi
    normalized_height = player["size"] / max_height  # Boy ne kadar büyükse o kadar iyi
    normalized_score = player["userScore"] / max_score  # Skor ne kadar yüksekse o kadar iyi

    # Performans skoru hesaplama
    performance_score = (normalized_age * age_factor) + \
                        (normalized_weight * weight_factor) + \
                        (normalized_height * height_factor) + \
                        (normalized_score * score_factor)
    
    return performance_score

# Oyuncuları analiz ederek dengeli takımlar oluşturma
def create_balanced_teams(players, team_size):
    # Performans skoru hesapla
    for player in players:
        player["performanceScore"] = calculate_performance_score(player)

    # Performans skorlarına göre oyuncuları sırala (yüksekten düşüğe)
    players.sort(key=lambda x: x["performanceScore"], reverse=True)

    total_players = len(players)

    # Eğer toplam oyuncu sayısı yeterli değilse, hata döndürüyoruz
    if total_players < team_size * 2:
        return f"Toplam oyuncu sayısı, her takımda {team_size} oyuncu olacak şekilde yeterli değil.", 400

    # Takımları oluşturacak listeyi hazırlıyoruz
    team1, team2 = [], []

    total_score_team1 = 0
    total_score_team2 = 0
    total_weight_team1 = 0
    total_weight_team2 = 0
    total_age_team1 = 0
    total_age_team2 = 0
    total_height_team1 = 0
    total_height_team2 = 0

    # Alternatif dağıtım yaparak oyuncuları dengeli şekilde paylaştırıyoruz
    for i in range(total_players):
        player = players[i]
        
        # Performans skoru ve diğer faktörlere göre takımların dengede olması için alternatif dağıtım
        if total_score_team1 <= total_score_team2:
            team1.append(player)
            total_score_team1 += player["performanceScore"]
            total_weight_team1 += player["weight"]
            total_age_team1 += player["age"]
            total_height_team1 += player["size"]
        else:
            team2.append(player)
            total_score_team2 += player["performanceScore"]
            total_weight_team2 += player["weight"]
            total_age_team2 += player["age"]
            total_height_team2 += player["size"]

    # Ortalama hesaplamalar
    avg_weight_team1 = total_weight_team1 / len(team1)
    avg_weight_team2 = total_weight_team2 / len(team2)
    
    avg_age_team1 = total_age_team1 / len(team1)
    avg_age_team2 = total_age_team2 / len(team2)

    avg_height_team1 = total_height_team1 / len(team1)
    avg_height_team2 = total_height_team2 / len(team2)

    # Takımların dengelenmesi için küçük değişiklikler yapalım
    if avg_weight_team1 > avg_weight_team2:
        player_to_swap = team1.pop()
        team2.append(player_to_swap)

    if avg_age_team1 > avg_age_team2:
        player_to_swap = team1.pop()
        team2.append(player_to_swap)

    if avg_height_team1 > avg_height_team2:
        player_to_swap = team1.pop()
        team2.append(player_to_swap)

    # Takımları daha farklı yapmak için bir karıştırma işlemi ekliyoruz
    random.shuffle(team1)
    random.shuffle(team2)

    return team1, team2

@app.route('/create-teams', methods=['GET'])
def create_teams():
    try:
        # API parametrelerini alıyoruz
        team_size = request.args.get('teamSize', type=int)
        
        if team_size is None or team_size < 4 or team_size > 11:
            return "Geçerli bir takım boyutu (4 ile 11 arasında) girilmelidir.", 400
        
        players = fetch_players()
        team1, team2 = create_balanced_teams(players, team_size)
        if isinstance(team1, str):  # Eğer hata mesajı döndüyse
            return team1, 400
        return jsonify({"team1": team1, "team2": team2})
    except Exception as e:
        print(f"Takımlar oluşturulurken bir hata oluştu: {e}")
        return str(e), 500

if __name__ == "__main__":
    app.run(port=5000)


#her seferinde aynı takım oluşuyor