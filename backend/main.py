import os
import sys

# Ensure the backend directory is in Python's search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import datetime
from typing import List

from database import get_db_connection, init_db
from auth import hash_password, verify_password, generate_token, verify_token
from models import UserAuth, PredictionInput, MatchInput, MatchResultInput
from scoring import calculate_points

app = FastAPI(title="Quiniela Mundial 2026 API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper: Check if match is locked for predictions (less than 1 hour before start)
def is_match_locked(match_time_str: str) -> bool:
    try:
        # Match time format: "2026-06-15T18:00:00"
        match_time = datetime.datetime.fromisoformat(match_time_str.replace("Z", "+00:00"))
        if match_time.tzinfo is None:
            # If naive, compare with local time
            now = datetime.datetime.now()
        else:
            # If aware, compare with aware UTC time
            now = datetime.datetime.now(datetime.timezone.utc)
            
        time_diff = match_time - now
        return time_diff.total_seconds() < 3600  # Locked if less than 3600s (1h) left
    except Exception as e:
        print(f"Error parsing date {match_time_str}: {e}")
        return True  # Lock on error for safety

# Dependency: Get Current User
def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debe iniciar sesión para realizar esta acción."
        )
        
    user = verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada o inválida. Inicie sesión nuevamente."
        )
    return user

# Dependency: Require Admin Role
def get_current_admin(user = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren privilegios de administrador."
        )
    return user

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register")
def register(user: UserAuth):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if username exists
        cursor.execute("SELECT id FROM users WHERE username = ?", (user.username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya está registrado."
            )
        
        # Check if it's the first user, make them admin for ease of testing
        cursor.execute("SELECT COUNT(*) as count FROM users")
        count = cursor.fetchone()["count"]
        is_admin = 1 if count == 0 else 0
        
        hashed = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
            (user.username, hashed, is_admin)
        )
        conn.commit()
        return {"message": "Usuario registrado exitosamente.", "is_admin": bool(is_admin)}
    finally:
        conn.close()

@app.post("/api/auth/login")
def login(user: UserAuth, response: Response):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, password_hash, is_admin FROM users WHERE username = ?", (user.username,))
        db_user = cursor.fetchone()
        if not db_user or not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos."
            )
        
        is_admin = bool(db_user["is_admin"])
        token = generate_token(db_user["id"], db_user["username"], is_admin)
        
        # Set cookie (safe session management)
        response.set_cookie(
            key="session_token",
            value=token,
            httponly=False,  # Set to False for local dev frontend simplicity, True in production
            samesite="lax",
            max_age=604800   # 7 days
        )
        
        return {
            "message": "Inicio de sesión exitoso.",
            "token": token,
            "user": {
                "id": db_user["id"],
                "username": db_user["username"],
                "is_admin": is_admin
            }
        }
    finally:
        conn.close()

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("session_token")
    return {"message": "Sesión cerrada."}

@app.get("/api/auth/me")
def get_me(user = Depends(get_current_user)):
    return user


# --- MATCH ENDPOINTS ---

@app.get("/api/matches")
def get_matches(request: Request):
    # Optional authentication to include current user's predictions
    token = request.cookies.get("session_token")
    user_id = None
    if token:
        user_payload = verify_token(token)
        if user_payload:
            user_id = user_payload.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM matches ORDER BY match_time ASC")
        matches = [dict(m) for m in cursor.fetchall()]
        
        # Update match status on the fly based on current time (open/closed)
        for m in matches:
            # Check if locked
            if m["status"] == "open" and is_match_locked(m["match_time"]):
                # Mark as closed in DB
                m["status"] = "closed"
                cursor.execute("UPDATE matches SET status = 'closed' WHERE id = ?", (m["id"],))
                conn.commit()
            
            # If user is authenticated, attach their prediction
            m["prediction"] = None
            if user_id:
                cursor.execute(
                    "SELECT home_score, away_score FROM predictions WHERE user_id = ? AND match_id = ?",
                    (user_id, m["id"])
                )
                pred = cursor.fetchone()
                if pred:
                    m["prediction"] = {
                        "home_score": pred["home_score"],
                        "away_score": pred["away_score"]
                    }
                    
        return matches
    finally:
        conn.close()


# --- PREDICTION ENDPOINTS ---

@app.post("/api/predictions")
def save_prediction(pred: PredictionInput, user = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if match exists and its status
        cursor.execute("SELECT status, match_time FROM matches WHERE id = ?", (pred.match_id,))
        match = cursor.fetchone()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partido no encontrado."
            )
            
        # Enforce lock time logic (1 hour before match time or status already closed/finished)
        if match["status"] != "open" or is_match_locked(match["match_time"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El pronóstico para este partido está bloqueado (cierra 1 hora antes de iniciar)."
            )
            
        # Insert or update prediction
        cursor.execute("""
            INSERT INTO predictions (user_id, match_id, home_score, away_score)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, match_id) DO UPDATE SET
                home_score = excluded.home_score,
                away_score = excluded.away_score
        """, (user["user_id"], pred.match_id, pred.home_score, pred.away_score))
        
        conn.commit()
        return {"message": "Pronóstico guardado correctamente."}
    finally:
        conn.close()

@app.get("/api/predictions/history")
def get_history(user = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                p.match_id,
                m.home_team,
                m.away_team,
                m.match_time,
                m.home_score as real_home,
                m.away_score as real_away,
                m.status,
                p.home_score as pred_home,
                p.away_score as pred_away,
                s.outcome_points,
                s.exact_points,
                s.home_goals_points,
                s.away_goals_points,
                s.total_points
            FROM predictions p
            JOIN matches m ON p.match_id = m.id
            LEFT JOIN scores s ON p.user_id = s.user_id AND p.match_id = s.match_id
            WHERE p.user_id = ?
            ORDER BY m.match_time DESC
        """, (user["user_id"],))
        
        history = [dict(row) for row in cursor.fetchall()]
        return history
    finally:
        conn.close()


# --- LEADERBOARD ENDPOINT ---

@app.get("/api/leaderboard")
def get_leaderboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(s.total_points), 0) DESC, u.username ASC) as position,
                u.username,
                COALESCE(SUM(CASE WHEN s.outcome_points = 3 THEN 1 ELSE 0 END), 0) AS matches_guessed,
                COALESCE(SUM(CASE WHEN s.exact_points = 2 THEN 1 ELSE 0 END), 0) AS exact_scores,
                COALESCE(SUM(s.total_points), 0) AS total_points
            FROM users u
            LEFT JOIN scores s ON u.id = s.user_id
            GROUP BY u.id, u.username
            ORDER BY total_points DESC, u.username ASC
        """)
        leaderboard = [dict(row) for row in cursor.fetchall()]
        return leaderboard
    finally:
        conn.close()


# --- ADMIN ENDPOINTS ---

@app.post("/api/admin/matches")
def add_match(match: MatchInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO matches (home_team, away_team, match_time, status) VALUES (?, ?, ?, 'open')",
            (match.home_team, match.away_team, match.match_time)
        )
        conn.commit()
        return {"message": "Partido agregado exitosamente.", "id": cursor.lastrowid}
    finally:
        conn.close()

@app.post("/api/admin/matches/{match_id}/result")
def set_result(match_id: int, result: MatchResultInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if match exists
        cursor.execute("SELECT * FROM matches WHERE id = ?", (match_id,))
        match = cursor.fetchone()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partido no encontrado."
            )
            
        # Update match scores and mark status as finished
        cursor.execute(
            "UPDATE matches SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?",
            (result.home_score, result.away_score, match_id)
        )
        
        # Select all predictions for this match to calculate and record scores
        cursor.execute("SELECT user_id, home_score, away_score FROM predictions WHERE match_id = ?", (match_id,))
        predictions = cursor.fetchall()
        
        for pred in predictions:
            points_breakdown = calculate_points(
                pred["home_score"], pred["away_score"], 
                result.home_score, result.away_score
            )
            
            cursor.execute("""
                INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, match_id) DO UPDATE SET
                    outcome_points = excluded.outcome_points,
                    exact_points = excluded.exact_points,
                    home_goals_points = excluded.home_goals_points,
                    away_goals_points = excluded.away_goals_points,
                    total_points = excluded.total_points
            """, (
                pred["user_id"],
                match_id,
                points_breakdown["outcome_points"],
                points_breakdown["exact_points"],
                points_breakdown["home_goals_points"],
                points_breakdown["away_goals_points"],
                points_breakdown["total_points"]
            ))
            
        conn.commit()
        return {"message": "Resultado guardado y puntuaciones calculadas correctamente."}
    finally:
        conn.close()

@app.post("/api/admin/matches/{match_id}/close")
def close_match(match_id: int, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM matches WHERE id = ?", (match_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partido no encontrado."
            )
        cursor.execute("UPDATE matches SET status = 'closed' WHERE id = ?", (match_id,))
        conn.commit()
        return {"message": "El partido ha sido cerrado para pronósticos."}
    finally:
        conn.close()


# --- SERVE FRONTEND STATIC FILES ---

# Get current script path to properly reference frontend
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(backend_dir)
frontend_dir = os.path.join(project_dir, "frontend")

# Create frontend directory if it doesn't exist yet (safeguard)
os.makedirs(frontend_dir, exist_ok=True)

# Mount the static directory
app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")

# Serve main index.html on root
@app.get("/")
def read_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Servidor activo. frontend/index.html no creado aún."}
