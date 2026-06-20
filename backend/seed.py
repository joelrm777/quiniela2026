import sqlite3
import os
import sys

# Ensure the backend directory is in Python's search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import datetime
from database import get_db_connection, DB_PATH
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
        "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
        ("admin", hash_password("admin126"))
    )
    admin_id = cursor.lastrowid
    
    # Regular users
    cursor.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)",
        ("juan", hash_password("juan26"))
    )
    juan_id = cursor.lastrowid
    
    cursor.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)",
        ("maria", hash_password("maria26"))
    )
    maria_id = cursor.lastrowid
    
    print("Users seeded: admin, juan, maria")
    
    # 3. Add Matches
    # Current time relative: 2026-06-04T08:24:00-06:00
    # Let's get current system dates and adjust
    base_time = datetime.datetime.now(datetime.timezone.utc)
    
    # Match 1: Finished (played 2 hours ago)
    time_m1 = (base_time - datetime.timedelta(hours=2)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, home_score, away_score, status) VALUES (?, ?, ?, 2, 1, 'finished')",
        ("México", "Argentina", time_m1)
    )
    m1_id = cursor.lastrowid
    
    # Match 2: Closed (starts in 30 minutes, less than 1 hour, so it blocks predictions)
    time_m2 = (base_time + datetime.timedelta(minutes=30)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (?, ?, ?, 'closed')",
        ("Estados Unidos", "Italia", time_m2)
    )
    m2_id = cursor.lastrowid
    
    # Match 3: Open (starts in 24 hours)
    time_m3 = (base_time + datetime.timedelta(days=1)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (?, ?, ?, 'open')",
        ("España", "Alemania", time_m3)
    )
    m3_id = cursor.lastrowid
    
    # Match 4: Open (starts in 2 days)
    time_m4 = (base_time + datetime.timedelta(days=2)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (?, ?, ?, 'open')",
        ("Canadá", "Camerún", time_m4)
    )
    m4_id = cursor.lastrowid
    
    # Match 5: Open (starts in 3 days)
    time_m5 = (base_time + datetime.timedelta(days=3)).isoformat()
    cursor.execute(
        "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (?, ?, ?, 'open')",
        ("Brasil", "Francia", time_m5)
    )
    m5_id = cursor.lastrowid
    
    print("Matches seeded: México vs Argentina, Estados Unidos vs Italia, España vs Alemania, Canadá vs Camerún, Brasil vs Francia")
    
    # 4. Add predictions for Match 1 (Finished)
    # Juan predicted exact score: 2 - 1
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?, ?, 2, 1)",
        (juan_id, m1_id)
    )
    # Maria predicted outcome but wrong score: 1 - 0
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?, ?, 1, 0)",
        (maria_id, m1_id)
    )
    
    # Add predictions for Match 2 (Closed)
    # Juan predicted 1 - 1
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?, ?, 1, 1)",
        (juan_id, m2_id)
    )
    # Maria predicted 0 - 2
    cursor.execute(
        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?, ?, 0, 2)",
        (maria_id, m2_id)
    )
    
    # 5. Add scores for Match 1 (Finished)
    # Juan: 2-1 prediction vs 2-1 real
    # Winner: 3 pts, Exact: 2 pts, Local goals (2): 1 pt, Visitor goals (1): 1 pt. Total = 7
    cursor.execute(
        "INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points) VALUES (?, ?, 3, 2, 1, 1, 7)",
        (juan_id, m1_id)
    )
    
    # Maria: 1-0 prediction vs 2-1 real
    # Winner: 3 pts, Exact: 0 pts, Local goals (1): 0 pts, Visitor goals (0): 0 pts. Total = 3
    cursor.execute(
        "INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points) VALUES (?, ?, 3, 0, 0, 0, 3)",
        (maria_id, m1_id)
    )
    
    conn.commit()
    conn.close()
    print("Database seeded with sample data successfully.")

if __name__ == "__main__":
    seed_data()
