import os
import sys

# Ensure the backend directory is in Python's search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import datetime
from database import get_db_connection
from auth import hash_password

def seed_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Clean existing data (only if you want a fresh seed)
    cursor.execute("DELETE FROM scores")
    cursor.execute("DELETE FROM predictions")
    cursor.execute("DELETE FROM matches")
    cursor.execute("DELETE FROM users")
    
    # 2. Add Users
    # Admin
    cursor.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 1) RETURNING id",
        ("admin", hash_password("admin126"))
    )
    admin_id = cursor.fetchone()["id"]
    
    # Regular users
    cursor.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 0) RETURNING id",
        ("juan", hash_password("juan26"))
    )
    juan_id = cursor.fetchone()["id"]
    
    cursor.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, 0) RETURNING id",
        ("maria", hash_password("maria26"))
    )
    maria_id = cursor.fetchone()["id"]
    
    print("Users seeded: admin, juan, maria")
    
    # 3. Add Matches
    base_time = datetime.datetime.now(datetime.timezone.utc)
    
    # Match 1: Finished (played 2 hours ago)
    time_m1 = (base_time - datetime.timedelta(hours=2)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, home_score, away_score, status) VALUES (%s, %s, %s, 2, 1, 'finished') RETURNING id",
        ("México", "Argentina", time_m1)
    )
    m1_id = cursor.fetchone()["id"]
    
    # Match 2: Closed (starts in 30 minutes)
    time_m2 = (base_time + datetime.timedelta(minutes=30)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (%s, %s, %s, 'closed') RETURNING id",
        ("Estados Unidos", "Italia", time_m2)
    )
    m2_id = cursor.fetchone()["id"]
    
    # Match 3: Open (starts in 24 hours)
    time_m3 = (base_time + datetime.timedelta(days=1)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (%s, %s, %s, 'open') RETURNING id",
        ("España", "Alemania", time_m3)
    )
    m3_id = cursor.fetchone()["id"]
    
    # Match 4: Open (starts in 2 days)
    time_m4 = (base_time + datetime.timedelta(days=2)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (%s, %s, %s, 'open') RETURNING id",
        ("Canadá", "Camerún", time_m4)
    )
    m4_id = cursor.fetchone()["id"]
    
    # Match 5: Open (starts in 3 days)
    time_m5 = (base_time + datetime.timedelta(days=3)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (%s, %s, %s, 'open') RETURNING id",
        ("Brasil", "Francia", time_m5)
    )
    m5_id = cursor.fetchone()["id"]
    
    print("Matches seeded: México vs Argentina, Estados Unidos vs Italia, España vs Alemania, Canadá vs Camerún, Brasil vs Francia")
    
    # 4. Add predictions for Match 1 (Finished)
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 2, 1)",
        (juan_id, m1_id)
    )
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 1, 0)",
        (maria_id, m1_id)
    )
    
    # Add predictions for Match 2 (Closed)
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 1, 1)",
        (juan_id, m2_id)
    )
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (%s, %s, 0, 2)",
        (maria_id, m2_id)
    )
    
    # 5. Add scores for Match 1 (Finished)
    cursor.execute(
        "INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points) VALUES (%s, %s, 3, 2, 1, 1, 7)",
        (juan_id, m1_id)
    )
    cursor.execute(
        "INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points) VALUES (%s, %s, 3, 0, 0, 0, 3)",
        (maria_id, m1_id)
    )
    
    conn.commit()
    conn.close()
    print("Database seeded with sample data successfully.")

if __name__ == "__main__":
    seed_data()
