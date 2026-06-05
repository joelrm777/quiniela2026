import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load environment variables from config.env at project root
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.env")
load_dotenv(_env_path)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set. Check config.env")

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 2. Matches Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        match_time TEXT NOT NULL,
        home_score INTEGER,
        away_score INTEGER,
        status TEXT DEFAULT 'open',
        phase TEXT DEFAULT 'grupos',
        group_name TEXT DEFAULT '',
        round INTEGER DEFAULT 1
    );
    """)

    # 3. Predictions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        UNIQUE(user_id, match_id)
    );
    """)

    # 4. Scores Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        outcome_points INTEGER DEFAULT 0,
        exact_points INTEGER DEFAULT 0,
        home_goals_points INTEGER DEFAULT 0,
        away_goals_points INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        UNIQUE(user_id, match_id)
    );
    """)

    # 5. Scoring Rules Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scoring_rules (
        id SERIAL PRIMARY KEY,
        rule_key TEXT UNIQUE NOT NULL,
        rule_label TEXT NOT NULL,
        rule_description TEXT DEFAULT '',
        points INTEGER NOT NULL DEFAULT 0
    );
    """)

    # Seed default scoring rules if empty
    cursor.execute("SELECT COUNT(*) AS cnt FROM scoring_rules")
    if cursor.fetchone()["cnt"] == 0:
        default_rules = [
            ("outcome_correct", "Resultado Correcto",      "Acertar quién gana o si es empate",         3),
            ("exact_score",     "Marcador Exacto",         "Acertar el marcador exacto del partido",     2),
            ("home_goals",      "Goles Local Exactos",     "Acertar los goles del equipo local",         1),
            ("away_goals",      "Goles Visitante Exactos", "Acertar los goles del equipo visitante",     1),
        ]
        cursor.executemany(
            "INSERT INTO scoring_rules (rule_key, rule_label, rule_description, points) VALUES (%s, %s, %s, %s)",
            default_rules
        )

    conn.commit()
    conn.close()
    print("Database initialized successfully (Supabase/PostgreSQL)")

if __name__ == "__main__":
    init_db()
