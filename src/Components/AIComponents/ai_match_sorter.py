import requests
import random
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import numpy as np
import logging
import copy

# Loglama ayarları
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/sort-matches": {"origins": "http://localhost:3000"}})

# İlk 30 maç için özel mesaj şablonları
CUSTOM_MESSAGES = [
    # İlk 15: Takım bazlı mesajlar
    lambda match, team_name, stadium_name, match_count: f"Daha önce maç yaptığın {team_name} bu maçta oynuyor!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile tekrar karşı karşıya! Hazır mısın?",
    lambda match, team_name, stadium_name, match_count: f"Bu maçta {team_name} rakibin, sahada kendini göster!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} bu maçta sahada, eski hesapları kapat!",
    lambda match, team_name, stadium_name, match_count: f"Daha önce karşılaştığın {team_name} ile epik bir maç seni bekliyor!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile yeniden kapışacaksın, hazır ol!",
    lambda match, team_name, stadium_name, match_count: f"Bu maçta {team_name} var, tanıdık bir rakip!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile sahada buluşuyorsun, geçmiş maçları hatırla!",
    lambda match, team_name, stadium_name, match_count: f"Daha önce maç yaptığın {team_name} bu maçta karşında!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile yeni bir mücadele, sahaya çık!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} bu maçta rakibin, eski anılar canlanacak!",
    lambda match, team_name, stadium_name, match_count: f"Daha önce karşılaştığın {team_name} ile maç vakti!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile bu maçta kapışacaksın, hazır mısın?",
    lambda match, team_name, stadium_name, match_count: f"Bu maçta {team_name} var, tanıdık bir mücadele!",
    lambda match, team_name, stadium_name, match_count: f"{team_name} ile sahada yeniden, zafer senin olsun!",
    # Sonraki 15: Stadyum bazlı mesajlar (maç sayısına göre dinamik)
    lambda match, team_name, stadium_name, match_count: f"Bu stadyumda {match_count} kez maç yaptın, sahaya hükmetmeye hazır mısın?",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} kez top koşturdun, yine zafer senin olsun!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name} sana tanıdık! {match_count} maçlık tecrübenle parlayacaksın!",
    lambda match, team_name, stadium_name, match_count: f"Bu stadyumda {match_count} kez oynadın, bu maçta da fark yarat!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} maç yaptın, sahada fırtına estir!",
    lambda match, team_name, stadium_name, match_count: f"{match_count} kez oynadığın {stadium_name}'nde bu maçta da yıldız sensin!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} maçlık anıların var, bu maçı da unutulmaz kıl!",
    lambda match, team_name, stadium_name, match_count: f"Bu stadyumda {match_count} kez sahaya çıktın, bu maçta da tarih yaz!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} maç oynadın, bu maçta da kral sensin!",
    lambda match, team_name, stadium_name, match_count: f"{match_count} maçlık {stadium_name} tecrübenle bu maçta parlayacaksın!",
    lambda match, team_name, stadium_name, match_count: f"Bu stadyumda {match_count} kez mücadele ettin, bu maçta da kazan!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} maç yaptın, bu maçta da efsane ol!",
    lambda match, team_name, stadium_name, match_count: f"{match_count} kez oynadığın {stadium_name}'nde bu maçta da zafer senin!",
    lambda match, team_name, stadium_name, match_count: f"Bu stadyumda {match_count} maçlık geçmişin var, bu maçta da parlayacaksın!",
    lambda match, team_name, stadium_name, match_count: f"{stadium_name}'nde {match_count} kez sahaya çıktın, bu maçta da destan yaz!",
]

# Yardımcı fonksiyonlar
def fetch_stadiums():
    """Tüm stadyumları API'den çeker."""
    try:
        response = requests.get("http://localhost:5033/api/Stadium/GetStadiumList", timeout=5)
        response.raise_for_status()
        stadiums = response.json()
        if not isinstance(stadiums, list):
            logging.error(f"Stadyum verisi beklenen formatta değil: {stadiums}")
            return []
        logging.debug(f"Stadyum verileri alındı: {len(stadiums)} stadyum bulundu, IDs: {[s.get('stadiumId') for s in stadiums if s.get('stadiumId') is not None]}")
        return stadiums
    except requests.exceptions.RequestException as e:
        logging.error(f"Stadyum verileri alınırken hata: {e}")
        return []
    except ValueError as e:
        logging.error(f"Stadyum JSON parse hatası: {e}")
        return []

def fetch_stadium_match_list():
    """Stadyumların maç geçmişlerini API'den çeker."""
    try:
        response = requests.get("http://localhost:5033/api/Stadium/GetStadiumMatchList", timeout=5)
        response.raise_for_status()
        stadium_matches = response.json()
        if not isinstance(stadium_matches, list):
            logging.error(f"Stadyum maç verisi beklenen formatta değil: {stadium_matches}")
            return []
        logging.debug(f"Stadyum maç verileri alındı: {len(stadium_matches)} stadyum bulundu, Stadium IDs: {[s.get('stadiumId') for s in stadium_matches if s.get('stadiumId') is not None]}")
        return stadium_matches
    except requests.exceptions.RequestException as e:
        logging.error(f"Stadyum maç verileri alınırken hata: {e}")
        return []
    except ValueError as e:
        logging.error(f"Stadyum maç JSON parse hatası: {e}")
        return []

def fetch_matches():
    """Tüm maçları, takımları ve stadyumları API'den çeker."""
    try:
        # Maçları çek
        response = requests.get("http://localhost:5033/api/Match/GetMatchList", timeout=5)
        response.raise_for_status()
        matches = response.json()
        if not isinstance(matches, list):
            logging.error(f"Maç verisi beklenen formatta değil: {matches}")
            return []
        logging.debug(f"Maç verileri alındı: {len(matches)} maç bulundu, IDs: {[m.get('matchId') for m in matches if m.get('matchId') is not None]}")

        # Stadyumları çek
        stadiums = fetch_stadiums()
        stadium_dict = {}
        for s in stadiums:
            if s.get("stadiumId") is not None:
                stadium_dict[int(s["stadiumId"])] = s
                stadium_dict[str(s["stadiumId"])] = s
        logging.debug(f"Stadyum dict oluşturuldu: {list(stadium_dict.keys())}")

        # Stadyum maç geçmişlerini çek
        stadium_matches = fetch_stadium_match_list()
        stadium_match_dict = {s["stadiumId"]: s.get("matchModel", []) for s in stadium_matches if s.get("stadiumId") is not None and isinstance(s.get("matchModel"), list)}
        logging.debug(f"Stadyum maç dict oluşturuldu: {list(stadium_match_dict.keys())}")

        # Her maç için takımları ve stadyumu ekle
        updated_matches = []
        for match in matches:
            match_copy = copy.deepcopy(match)
            match_id = match_copy.get("matchId")
            if match_id is None:
                logging.warning(f"Maç ID eksik: {match_copy}")
                continue

            # Takımları çek
            match_teams = fetch_match_teams(match_id)
            match_copy["matchTeams"] = match_teams if match_teams else []
            logging.debug(f"Maç takımları eklendi: matchId={match_id}, takım sayısı={len(match_teams)}, teamIds={[t.get('teamId') for t in match_teams if t.get('teamId') is not None]}")

            # Stadyumu ekle
            stadium_id = match_copy.get("stadiumId")
            stadium = None
            if stadium_id is not None:
                stadium = stadium_dict.get(stadium_id) or stadium_dict.get(str(stadium_id)) or stadium_dict.get(int(stadium_id) if isinstance(stadium_id, str) else stadium_id)
            match_copy["stadium"] = stadium
            if stadium:
                logging.debug(f"Stadyum eklendi: matchId={match_id}, stadiumId={stadium_id}, name={stadium.get('stadiumName')}")
            else:
                logging.warning(f"Stadyum bulunamadı: matchId={match_id}, stadiumId={stadium_id}")

            # Stadyum maç geçmişini ekle
            match_copy["stadiumMatches"] = stadium_match_dict.get(stadium_id, []) if stadium_id is not None else []
            logging.debug(f"Stadyum maçları eklendi: matchId={match_id}, stadiumId={stadium_id}, maç sayısı={len(match_copy['stadiumMatches'])}")

            updated_matches.append(match_copy)

        return updated_matches
    except requests.exceptions.RequestException as e:
        logging.error(f"Maç verileri alınırken hata: {e}")
        raise Exception(f"Maç listesi alınırken hata oluştu: {str(e)}")
    except Exception as e:
        logging.error(f"Maç verileri işlenirken beklenmeyen hata: {e}")
        raise Exception(f"Maç verileri işlenirken hata: {str(e)}")

def fetch_player_data(player_id):
    """Oyuncunun geçmiş verilerini API'den çeker."""
    try:
        response = requests.get(f"http://localhost:5033/api/Players/AISortByPlayer?playerId={player_id}", timeout=5)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list):
            logging.error(f"Oyuncu verisi beklenen formatta değil: {data}")
            return []
        logging.debug(f"Oyuncu verileri alındı: playerId={player_id}, maç sayısı={len(data[0].get('match', [])) if data and isinstance(data[0].get('match'), list) else 0}")
        return data
    except requests.exceptions.RequestException as e:
        logging.error(f"Oyuncu verileri alınırken hata: {e}")
        return []
    except ValueError as e:
        logging.error(f"Oyuncu JSON parse hatası: {e}")
        return []

def fetch_match_teams(match_id):
    """Maçın takımlarını ve oyuncularını API'den çeker."""
    try:
        response = requests.get(f"http://localhost:5033/api/Match/GetMatchTeamInfo?matchId={match_id}", timeout=5)
        response.raise_for_status()
        teams = response.json()
        if not isinstance(teams, list):
            logging.error(f"Maç takımları beklenen formatta değil: matchId={match_id}, veri={teams}")
            return []
        logging.debug(f"Maç takımları alındı: matchId={match_id}, takım sayısı={len(teams)}, teamIds={[t.get('teamId') for t in teams if t.get('teamId') is not None]}")
        return teams
    except requests.exceptions.RequestException as e:
        logging.warning(f"Maç takımları alınırken hata: matchId={match_id}, hata={e}")
        return []
    except ValueError as e:
        logging.error(f"Maç takımları JSON parse hatası: matchId={match_id}, hata={e}")
        return []

def calculate_team_similarity(player_data, match_teams):
    """Geçmiş takım oyuncuları ile maç oyuncuları arasında benzerlik hesaplar."""
    if not player_data or not match_teams:
        logging.warning("Oyuncu verisi veya maç takımları eksik, varsayılan 0.5 döndürülüyor.")
        return 0.5

    player_scores = []
    for match in player_data.get("match", []):
        for team in match.get("team", []):
            for player in team.get("player", []):
                score = player.get("userScore", 50)
                player_scores.append(score)

    if not player_scores:
        logging.warning("Oyuncunun geçmiş maç skoru yok, varsayılan 0.5 döndürülüyor.")
        return 0.5

    avg_player_score = np.mean(player_scores)
    logging.debug(f"Oyuncunun ortalama skoru: {avg_player_score}")

    match_player_scores = [team.get("userScore", 50) for team in match_teams if team.get("userScore") is not None]
    avg_match_score = np.mean(match_player_scores) if match_player_scores else 50
    logging.debug(f"Maç oyuncularının ortalama skoru: {avg_match_score}")

    score_diff = abs(avg_player_score - avg_match_score) / 100
    similarity = 1 - score_diff
    logging.debug(f"Takım benzerlik skoru: {similarity}")
    return max(0, min(1, similarity))

def calculate_team_familiarity(player_data, match_teams):
    """Oyuncunun geçmişte oynadığı takımlarla mevcut maçın takımları arasında eşleşme kontrolü."""
    if not player_data or not match_teams:
        logging.warning("Oyuncu verisi veya maç takımları eksik, varsayılan 0 döndürülüyor.")
        return 0

    past_team_ids = set()
    for match in player_data.get("match", []):
        for team in match.get("team", []):
            team_id = team.get("teamId")
            if team_id is not None:
                past_team_ids.add(team_id)
    logging.debug(f"Geçmiş takım IDs: {past_team_ids}")

    current_team_ids = set(team.get("teamId") for team in match_teams if team.get("teamId") is not None)
    logging.debug(f"Mevcut maç takım IDs: {current_team_ids}")

    intersection = past_team_ids & current_team_ids
    if intersection:
        logging.debug(f"Takım eşleşmesi bulundu: eşleşen IDs={intersection}")
        return 1
    logging.debug(f"Takım eşleşmesi yok: past_team_ids={past_team_ids}, current_team_ids={current_team_ids}")
    return 0

def generate_custom_message(match, index):
    """İlk 30 maç için özel mesaj üretir."""
    match_id = match.get("matchId", 0)
    match_teams = match.get("matchTeams", [])
    stadium = match.get("stadium", {})
    stadium_matches = match.get("stadiumMatches", [])

    # Takım ismi seç
    team_name = "bilinmeyen takım"
    if match_teams and isinstance(match_teams, list):
        valid_teams = [t.get("teamName", "bilinmeyen takım") for t in match_teams if t.get("teamName")]
        team_name = random.choice(valid_teams) if valid_teams else "bilinmeyen takım"
    logging.debug(f"Seçilen takım ismi: {team_name} (matchId={match_id})")

    # Stadyum ismi al
    stadium_name = stadium.get("stadiumName", "bilinmeyen stadyum") if stadium and isinstance(stadium, dict) else "bilinmeyen stadyum"
    logging.debug(f"Seçilen stadyum ismi: {stadium_name} (matchId={match_id})")

    # Stadyum maç sayısı
    match_count = len(stadium_matches) if isinstance(stadium_matches, list) else 0
    if match_count == 0:
        match_count = random.randint(1, 5)  # Gerçekçi bir varsayılan
    logging.debug(f"Stadyum maç sayısı: {match_count} (matchId={match_id})")

    # Mesaj seç
    try:
        selected_message_func = CUSTOM_MESSAGES[index]
        message = selected_message_func(match, team_name, stadium_name, match_count)
    except Exception as e:
        logging.error(f"Özel mesaj üretirken hata: matchId={match_id}, index={index}, hata={e}")
        message = "Bu maç harika bir fırsat, hemen katıl!"
    logging.debug(f"Özel mesaj seçildi: {message} (matchId={match_id}, index={index})")
    return message

def generate_personalized_message(match, player_data, match_teams, scores):
    """Geri kalan maçlar için model mesajları üretir."""
    try:
        score_types = [
            ("team_familiarity", scores["team_familiarity_score"], "Daha önce bu takımla maça katılmıştınız!"),
            ("opponent_familiarity", scores["team_familiarity_score"], "Rakip takımınız burada oynadı!"),
            ("popularity", scores["popularity_score"], f"Bu maç çok popüler, {match.get('userCount', 0)} kişi katılıyor!"),
            ("date", scores["date_score"], "Bu maç yakında, hemen yerini kap!"),
            ("team", scores["team_score"], "Bu maçta senin seviyende oyuncular var!"),
            ("high_participation", scores["popularity_score"], f"Bu maç kalabalık, tam {match.get('userCount', 0)} kişiyle oynanacak!")
        ]

        if scores["team_familiarity_score"] > 0:
            valid_messages = [
                s[2] for s in score_types if s[0] in ["team_familiarity", "opponent_familiarity"]
            ]
            if valid_messages:
                selected_message = random.choice(valid_messages)
                logging.debug(f"Takım mesajı seçildi: {selected_message} (matchId={match.get('matchId')})")
                return selected_message

        top_scores = sorted(score_types, key=lambda x: x[1], reverse=True)[:4]
        valid_messages = [s[2] for s in top_scores if s[1] > 0]
        if not valid_messages:
            logging.warning(f"Maç için geçerli mesaj yok, varsayılan mesaj döndürülüyor: matchId={match.get('matchId')}")
            return "Bu maç harika bir fırsat, hemen katıl!"

        selected_message = random.choice(valid_messages)
        logging.debug(f"Seçilen mesaj: {selected_message} (matchId={match.get('matchId')}, skorlar={scores})")
        return selected_message
    except Exception as e:
        logging.error(f"Kişiselleştirilmiş mesaj üretirken hata: matchId={match.get('matchId')}, hata={e}")
        return "Bu maç harika bir fırsat, hemen katıl!"

def calculate_match_score(match, player_data, current_time, match_teams):
    """Maç için uygunluk puanını hesaplar ve kişiselleştirilmiş mesaj üretir."""
    match_copy = copy.deepcopy(match)
    match_id = match_copy.get("matchId", "bilinmeyen")

    try:
        match_date_str = match_copy.get("matchDate")
        if not match_date_str:
            logging.error(f"Maç tarihi eksik: matchId={match_id}")
            return 0, match_copy, ""

        match_date = datetime.fromisoformat(match_date_str)
    except (ValueError, KeyError) as e:
        logging.error(f"Maç tarihi hatalı veya eksik: matchId={match_id}, hata={e}")
        return 0, match_copy, ""

    if match_date < current_time or match_copy.get("isActive") != 1:
        logging.debug(f"Maç tarihi geçmiş veya aktif değil: matchId={match_id}, isActive={match_copy.get('isActive')}")
        return 0, match_copy, ""

    # Tarih puanı
    try:
        time_diff_days = (match_date - current_time).total_seconds() / (3600 * 24)
        if time_diff_days <= 14:
            date_score = 100 * (1 - time_diff_days / 14)
        elif time_diff_days <= 30:
            date_score = 50 * (1 - (time_diff_days - 14) / 16)
        else:
            date_score = 50 / (1 + time_diff_days / 30)
        logging.debug(f"Tarih skoru: {date_score} (matchId={match_id})")
    except Exception as e:
        logging.error(f"Tarih skoru hesaplanırken hata: matchId={match_id}, hata={e}")
        date_score = 0

    # Takım uyumluluğu
    try:
        team_score = calculate_team_similarity(player_data, match_teams) * 100
        logging.debug(f"Takım skoru: {team_score} (matchId={match_id})")
    except Exception as e:
        logging.error(f"Takım skoru hesaplanırken hata: matchId={match_id}, hata={e}")
        team_score = 50

    # Takım tanıdıklık skoru
    try:
        team_familiarity_score = calculate_team_familiarity(player_data, match_teams) * 100
        logging.debug(f"Takım tanıdıklık skoru: {team_familiarity_score} (matchId={match_id})")
    except Exception as e:
        logging.error(f"Takım tanıdıklık skoru hesaplanırken hata: matchId={match_id}, hata={e}")
        team_familiarity_score = 0

    # Maç popülerliği
    try:
        user_count_score = match_copy.get("userCount", 0) * 3
        likes_score = match_copy.get("likes", 0) * 0.5
        popularity_score = min(user_count_score + likes_score, 100)
        logging.debug(f"Popülerlik skoru: {popularity_score} (matchId={match_id})")
    except Exception as e:
        logging.error(f"Popülerlik skoru hesaplanırken hata: matchId={match_id}, hata={e}")
        popularity_score = 0

    # Ağırlıklı toplam
    try:
        total_score = (0.5 * date_score) + (0.2 * team_score) + (0.15 * popularity_score) + (0.15 * team_familiarity_score)
        logging.debug(f"Toplam skor: {total_score} (matchId={match_id})")
    except Exception as e:
        logging.error(f"Toplam skor hesaplanırken hata: matchId={match_id}, hata={e}")
        total_score = 0

    scores = {
        "date_score": date_score,
        "team_score": team_score,
        "popularity_score": popularity_score,
        "team_familiarity_score": team_familiarity_score
    }

    # Model mesajı üret
    try:
        message = generate_personalized_message(match_copy, player_data, match_teams, scores)
    except Exception as e:
        logging.error(f"Mesaj üretirken hata: matchId={match_id}, hata={e}")
        message = "Bu maç harika bir fırsat, hemen katıl!"

    match_copy["personalizedMessage"] = message
    logging.debug(f"Maç nesnesine mesaj eklendi: matchId={match_id}, personalizedMessage={message}")

    return total_score, match_copy, message

@app.route('/sort-matches', methods=['GET'])
def sort_matches():
    try:
        player_id = request.args.get('playerId', type=int)
        if not player_id:
            logging.error("playerId parametresi eksik.")
            return jsonify({"error": "playerId parametresi gerekli."}), 400

        # Verileri çek
        logging.debug(f"Maç verileri çekiliyor: playerId={player_id}")
        matches = fetch_matches()
        logging.debug(f"Oyuncu verileri çekiliyor: playerId={player_id}")
        player_data = fetch_player_data(player_id)[0] if fetch_player_data(player_id) else {}
        logging.debug(f"Oyuncu verisi: maç sayısı={len(player_data.get('match', [])) if isinstance(player_data.get('match'), list) else 0}")

        # Son 30 maçı ayır
        top_30_matches = matches[-30:] if len(matches) >= 30 else matches
        remaining_matches = matches[:-30] if len(matches) > 30 else []
        logging.debug(f"Son 30 maç: {len(top_30_matches)}, kalan maçlar: {len(remaining_matches)}")

        # İlk 30 maça özel mesaj ekle
        final_matches = []
        for index, match in enumerate(top_30_matches):
            match_copy = copy.deepcopy(match)
            try:
                match_copy["personalizedMessage"] = generate_custom_message(match_copy, index)
                logging.debug(f"Özel mesaj eklendi: matchId={match_copy.get('matchId')}, index={index}, mesaj={match_copy['personalizedMessage']}")
                final_matches.append(match_copy)
            except Exception as e:
                logging.error(f"Özel mesaj eklenirken hata: matchId={match_copy.get('matchId')}, index={index}, hata={e}")
                match_copy["personalizedMessage"] = "Bu maç harika bir fırsat, hemen katıl!"
                final_matches.append(match_copy)

        # Geri kalan maçları modelle işle
        current_time = datetime.now()
        scored_matches = []
        for match in remaining_matches:
            match_teams = match.get("matchTeams", [])
            try:
                score, updated_match, message = calculate_match_score(match, player_data, current_time, match_teams)
                if score > 0:
                    scored_matches.append({"match": updated_match, "score": score})
                    logging.debug(f"Maç işlendi: matchId={updated_match.get('matchId')}, personalizedMessage={message}, score={score}")
            except Exception as e:
                logging.error(f"Maç işlenirken hata: matchId={match.get('matchId', 'bilinmeyen')}, hata={e}")
                continue

        # Puanlara göre sırala
        try:
            scored_matches.sort(key=lambda x: x["score"], reverse=True)
            sorted_remaining_matches = [item["match"] for item in scored_matches]
            logging.info(f"Sıralanmış kalan maç sayısı: {len(sorted_remaining_matches)}")
            logging.debug(f"Sıralanmış kalan maçlar: {[m.get('matchId') for m in sorted_remaining_matches if m.get('matchId') is not None]}")
        except Exception as e:
            logging.error(f"Kalan maçlar sıralanırken hata: {e}")
            raise Exception(f"Maç sıralama hatası: {str(e)}")

        # İlk 30 maç + sıralanmış kalan maçlar
        final_matches.extend(sorted_remaining_matches)
        logging.info(f"Toplam maç sayısı: {len(final_matches)}")

        return jsonify({"matches": final_matches})
    except Exception as e:
        logging.error(f"Maçlar sıralanırken hata oluştu: {e}")
        return jsonify({"error": f"Sıralama başarısız oldu: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(port=5001)