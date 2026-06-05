import os
import sys

# Ensure the backend directory is in Python's search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import get_db_connection
from auth import hash_password

def seed_official_matches():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Clean existing matches, predictions, and scores (fresh start)
    cursor.execute("DELETE FROM scores")
    cursor.execute("DELETE FROM predictions")
    cursor.execute("DELETE FROM matches")
    
    # 2. Make sure default test users exist
    cursor.execute("SELECT id FROM users WHERE username = %s", ("admin",))
    admin_row = cursor.fetchone()
    if not admin_row:
        cursor.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 1) RETURNING id", ("admin", hash_password("admin126")))
        admin_id = cursor.fetchone()["id"]
    else:
        admin_id = admin_row["id"]
        
    cursor.execute("SELECT id FROM users WHERE username = %s", ("juan",))
    juan_row = cursor.fetchone()
    if not juan_row:
        cursor.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 0) RETURNING id", ("juan", hash_password("juan26")))
        juan_id = cursor.fetchone()["id"]
    else:
        juan_id = juan_row["id"]

    cursor.execute("SELECT id FROM users WHERE username = %s", ("maria",))
    maria_row = cursor.fetchone()
    if not maria_row:
        cursor.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 0) RETURNING id", ("maria", hash_password("maria26")))
        maria_id = cursor.fetchone()["id"]
    else:
        maria_id = maria_row["id"]

    print("Default users verified.")

    # 3. Official Group Stage Matches for World Cup 2026 (first 22 fixtures)
    # Formatted exactly in the user's timezone (-06:00 offset)
    # Tuple: (home_team, away_team, match_time, group_name, round/jornada)
    official_matches = [
        # Thursday, June 11, 2026 — Grupo A
        ("México", "Sudáfrica", "2026-06-11T13:00:00-06:00", "A", 1),
        ("Corea del Sur", "Chequia", "2026-06-11T20:00:00-06:00", "A", 1),
        
        # Friday, June 12, 2026 — Grupo B
        ("Canadá", "Bosnia y H.", "2026-06-12T13:00:00-06:00", "B", 1),
        ("Estados Unidos", "Paraguay", "2026-06-12T19:00:00-06:00", "B", 1),
        
        # Saturday, June 13, 2026 — Grupos C y D
        ("Catar", "Suiza", "2026-06-13T13:00:00-06:00", "C", 1),
        ("Brasil", "Marruecos", "2026-06-13T16:00:00-06:00", "C", 1),
        ("Haití", "Escocia", "2026-06-13T19:00:00-06:00", "D", 1),
        ("Australia", "Turquía", "2026-06-13T22:00:00-06:00", "D", 1),
        
        # Sunday, June 14, 2026 — Grupos E y F
        ("Alemania", "Curazao", "2026-06-14T11:00:00-06:00", "E", 1),
        ("Países Bajos", "Japón", "2026-06-14T14:00:00-06:00", "E", 1),
        ("Costa de Marfil", "Ecuador", "2026-06-14T17:00:00-06:00", "F", 1),
        ("Suecia", "Túnez", "2026-06-14T20:00:00-06:00", "F", 1),
        
        # Monday, June 15, 2026 — Grupos G y H
        ("España", "Cabo Verde", "2026-06-15T10:00:00-06:00", "G", 1),
        ("Bélgica", "Egipto", "2026-06-15T13:00:00-06:00", "G", 1),
        ("Arabia Saudita", "Uruguay", "2026-06-15T16:00:00-06:00", "H", 1),
        ("Irán", "Nueva Zelanda", "2026-06-15T19:00:00-06:00", "H", 1),
        
        # Tuesday, June 16, 2026 — Grupos I y J
        ("Francia", "Senegal", "2026-06-16T13:00:00-06:00", "I", 1),
        ("Irak", "Noruega", "2026-06-16T16:00:00-06:00", "I", 1),
        ("Argentina", "Argelia", "2026-06-16T19:00:00-06:00", "J", 1),
        ("Austria", "Jordania", "2026-06-16T22:00:00-06:00", "J", 1),
        
        # Wednesday, June 17, 2026 — Grupo K
        ("Portugal", "RD Congo", "2026-06-17T11:00:00-06:00", "K", 1),
        ("Inglaterra", "Croacia", "2026-06-17T14:00:00-06:00", "K", 1),
    ]

    for home, away, m_time, group, jornada in official_matches:
        cursor.execute(
            "INSERT INTO matches (home_team, away_team, match_time, status, phase, group_name, round) VALUES (%s, %s, %s, 'open', 'grupos', %s, %s)",
            (home, away, m_time, group, jornada)
        )
    
    print(f"Successfully loaded {len(official_matches)} official matches.")
    
    # 4. Let's add some initial sample predictions for testing
    # Retrieve match IDs for the first couple of matches
    cursor.execute("SELECT id FROM matches WHERE home_team = %s AND away_team = %s", ("México", "Sudáfrica"))
    m1_row = cursor.fetchone()
    
    if m1_row:
        m1_id = m1_row["id"]
        # Juan predicts México wins 2 - 1
        cursor.execute("INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 2, 1)", (juan_id, m1_id))
        # Maria predicts a draw 1 - 1
        cursor.execute("INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 1, 1)", (maria_id, m1_id))
        print("Prepopulated test predictions for México vs Sudáfrica.")

    conn.commit()
    conn.close()
    print("Official matches loaded into database.")

if __name__ == "__main__":
    seed_official_matches()
