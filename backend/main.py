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
from typing import List, Optional

from database import get_db_connection, init_db
from auth import hash_password, verify_password, generate_token, verify_token
from models import UserAuth, PredictionInput, MatchInput, MatchResultInput, UserUpdateInput, UserPasswordInput, ScoringRulesUpdateInput, MatchUpdateInput
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

# Helper: load scoring rules from DB as dict
def get_scoring_rules_dict(cursor) -> dict:
    cursor.execute("SELECT rule_key, points FROM scoring_rules")
    rows = cursor.fetchall()
    if not rows:
        return {"outcome_correct": 3, "exact_score": 2, "home_goals": 1, "away_goals": 1}
    return {row["rule_key"]: row["points"] for row in rows}

# Helper: recalculate all scores for finished matches with current rules
def recalculate_all_scores(cursor):
    rules = get_scoring_rules_dict(cursor)
    cursor.execute("SELECT id, home_score, away_score FROM matches WHERE status = 'finished'")
    for match in cursor.fetchall():
        cursor.execute(
            "SELECT user_id, home_score, away_score FROM predictions WHERE match_id = %s",
            (match["id"],)
        )
        for pred in cursor.fetchall():
            pts = calculate_points(
                pred["home_score"], pred["away_score"],
                match["home_score"], match["away_score"],
                rules=rules
            )
            cursor.execute("""
                INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT(user_id, match_id) DO UPDATE SET
                    outcome_points = EXCLUDED.outcome_points,
                    exact_points = EXCLUDED.exact_points,
                    home_goals_points = EXCLUDED.home_goals_points,
                    away_goals_points = EXCLUDED.away_goals_points,
                    total_points = EXCLUDED.total_points
            """, (
                pred["user_id"], match["id"],
                pts["outcome_points"], pts["exact_points"],
                pts["home_goals_points"], pts["away_goals_points"],
                pts["total_points"]
            ))

# Helper: Get Current User
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
        cursor.execute("SELECT id FROM users WHERE username = %s", (user.username,))
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
            "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, %s)",
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
        cursor.execute("SELECT id, username, password_hash, is_admin, is_active FROM users WHERE username = %s", (user.username,))
        db_user = cursor.fetchone()
        if not db_user or not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos."
            )

        if not db_user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta está desactivada. Contacta al administrador."
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
def get_matches(
    request: Request,
    phase: Optional[str] = None,
    round: Optional[int] = None,
    group_name: Optional[str] = None
):
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
        # Build dynamic query based on filters
        where_clauses = []
        params_list = []
        if phase:
            where_clauses.append("phase = %s")
            params_list.append(phase)
        if round is not None:
            where_clauses.append("round = %s")
            params_list.append(round)
        if group_name:
            where_clauses.append("group_name = %s")
            params_list.append(group_name)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        cursor.execute(f"SELECT * FROM matches {where_sql} ORDER BY match_time ASC", params_list)
        matches = [dict(m) for m in cursor.fetchall()]
        
        # Update match status on the fly based on current time (open/closed)
        for m in matches:
            # Check if locked
            if m["status"] == "open" and is_match_locked(m["match_time"]):
                # Mark as closed in DB
                m["status"] = "closed"
                cursor.execute("UPDATE matches SET status = 'closed' WHERE id = %s", (m["id"],))
                conn.commit()
            
            # If user is authenticated, attach their prediction
            m["prediction"] = None
            if user_id:
                cursor.execute(
                    "SELECT home_score, away_score FROM predictions WHERE user_id = %s AND match_id = %s",
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
        cursor.execute("SELECT status, match_time FROM matches WHERE id = %s", (pred.match_id,))
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
            VALUES (%s, %s, %s, %s)
            ON CONFLICT(user_id, match_id) DO UPDATE SET
                home_score = EXCLUDED.home_score,
                away_score = EXCLUDED.away_score
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
            WHERE p.user_id = %s
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
                COALESCE(SUM(CASE WHEN s.outcome_points > 0 THEN 1 ELSE 0 END), 0) AS matches_guessed,
                COALESCE(SUM(CASE WHEN s.exact_points > 0 THEN 1 ELSE 0 END), 0) AS exact_scores,
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
            "INSERT INTO matches (home_team, away_team, match_time, status, phase, group_name, round) VALUES (%s, %s, %s, 'open', %s, %s, %s) RETURNING id",
            (match.home_team, match.away_team, match.match_time, match.phase, match.group_name.upper(), match.round)
        )
        new_id = cursor.fetchone()["id"]
        conn.commit()
        return {"message": "Partido agregado exitosamente.", "id": new_id}
    finally:
        conn.close()

@app.post("/api/admin/matches/{match_id}/result")
def set_result(match_id: int, result: MatchResultInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if match exists
        cursor.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        match = cursor.fetchone()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partido no encontrado."
            )
            
        # Update match scores and mark status as finished
        cursor.execute(
            "UPDATE matches SET home_score = %s, away_score = %s, status = 'finished' WHERE id = %s",
            (result.home_score, result.away_score, match_id)
        )
        
        # Select all predictions for this match to calculate and record scores
        cursor.execute("SELECT user_id, home_score, away_score FROM predictions WHERE match_id = %s", (match_id,))
        predictions = cursor.fetchall()
        
        for pred in predictions:
            points_breakdown = calculate_points(
                pred["home_score"], pred["away_score"], 
                result.home_score, result.away_score,
                rules=get_scoring_rules_dict(cursor)
            )
            
            cursor.execute("""
                INSERT INTO scores (user_id, match_id, outcome_points, exact_points, home_goals_points, away_goals_points, total_points)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT(user_id, match_id) DO UPDATE SET
                    outcome_points = EXCLUDED.outcome_points,
                    exact_points = EXCLUDED.exact_points,
                    home_goals_points = EXCLUDED.home_goals_points,
                    away_goals_points = EXCLUDED.away_goals_points,
                    total_points = EXCLUDED.total_points
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
        cursor.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partido no encontrado."
            )
        cursor.execute("UPDATE matches SET status = 'closed' WHERE id = %s", (match_id,))
        conn.commit()
        return {"message": "El partido ha sido cerrado para pronósticos."}
    finally:
        conn.close()


@app.put("/api/admin/matches/{match_id}")
def update_match(match_id: int, data: MatchUpdateInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Partido no encontrado.")

        fields = []
        values = []
        if data.home_team  is not None: fields.append("home_team = %s");  values.append(data.home_team)
        if data.away_team  is not None: fields.append("away_team = %s");  values.append(data.away_team)
        if data.match_time is not None: fields.append("match_time = %s"); values.append(data.match_time)
        if data.phase      is not None: fields.append("phase = %s");      values.append(data.phase)
        if data.group_name is not None: fields.append("group_name = %s"); values.append(data.group_name.upper())
        if data.round      is not None: fields.append("round = %s");      values.append(data.round)
        if data.status     is not None: fields.append("status = %s");     values.append(data.status)

        if not fields:
            raise HTTPException(status_code=400, detail="No se enviaron campos para actualizar.")

        values.append(match_id)
        cursor.execute(f"UPDATE matches SET {', '.join(fields)} WHERE id = %s", values)
        conn.commit()
        return {"message": "Partido actualizado correctamente."}
    finally:
        conn.close()


@app.delete("/api/admin/matches/{match_id}")
def delete_match(match_id: int, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Partido no encontrado.")
        cursor.execute("DELETE FROM matches WHERE id = %s", (match_id,))
        conn.commit()
        return {"message": "Partido eliminado correctamente."}
    finally:
        conn.close()


@app.get("/api/admin/matches/{match_id}/predictions")
def get_match_predictions(match_id: int, admin = Depends(get_current_admin)):
    """Returns all user predictions for a match, with scores if finished."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        match = cursor.fetchone()
        if not match:
            raise HTTPException(status_code=404, detail="Partido no encontrado.")

        cursor.execute("""
            SELECT
                u.id        AS user_id,
                u.username,
                p.home_score AS pred_home,
                p.away_score AS pred_away,
                s.outcome_points,
                s.exact_points,
                s.home_goals_points,
                s.away_goals_points,
                s.total_points
            FROM users u
            LEFT JOIN predictions p ON u.id = p.user_id AND p.match_id = %s
            LEFT JOIN scores     s ON u.id = s.user_id AND s.match_id = %s
            WHERE u.is_active = 1
            ORDER BY COALESCE(s.total_points, -1) DESC, u.username ASC
        """, (match_id, match_id))

        rows = [dict(r) for r in cursor.fetchall()]
        return {
            "match": dict(match),
            "predictions": rows
        }
    finally:
        conn.close()

@app.get("/api/admin/users")
def get_users(admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT u.id, u.username, u.is_admin, u.is_active,
                   COALESCE(SUM(s.total_points), 0) AS total_points,
                   COUNT(DISTINCT p.match_id) AS predictions_count
            FROM users u
            LEFT JOIN scores s ON u.id = s.user_id
            LEFT JOIN predictions p ON u.id = p.user_id
            GROUP BY u.id
            ORDER BY u.username ASC
        """)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@app.put("/api/admin/users/{user_id}")
def update_user(user_id: int, data: UserUpdateInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        db_user = cursor.fetchone()
        if not db_user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        fields = []
        values = []
        if data.username is not None:
            cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s", (data.username, user_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Ese nombre de usuario ya existe.")
            fields.append("username = %s")
            values.append(data.username)
        if data.is_admin is not None:
            fields.append("is_admin = %s")
            values.append(1 if data.is_admin else 0)
        if data.is_active is not None:
            fields.append("is_active = %s")
            values.append(1 if data.is_active else 0)

        if not fields:
            raise HTTPException(status_code=400, detail="No se enviaron campos para actualizar.")

        values.append(user_id)
        cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", values)
        conn.commit()
        return {"message": "Usuario actualizado correctamente."}
    finally:
        conn.close()


@app.post("/api/admin/users/{user_id}/password")
def change_user_password(user_id: int, data: UserPasswordInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(data.new_password), user_id)
        )
        conn.commit()
        return {"message": "Contraseña actualizada correctamente."}
    finally:
        conn.close()


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Prevent admin from deleting themselves
        if admin["user_id"] == user_id:
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return {"message": "Usuario eliminado correctamente."}
    finally:
        conn.close()


# --- ADMIN: SCORING RULES ---

@app.get("/api/admin/scoring-rules")
def get_scoring_rules(admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM scoring_rules ORDER BY id ASC")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@app.put("/api/admin/scoring-rules")
def update_scoring_rules(data: ScoringRulesUpdateInput, admin = Depends(get_current_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for rule in data.rules:
            cursor.execute(
                "UPDATE scoring_rules SET points = %s WHERE rule_key = %s",
                (rule.points, rule.rule_key)
            )
        if data.recalculate:
            recalculate_all_scores(cursor)
        conn.commit()
        msg = "Reglas actualizadas."
        if data.recalculate:
            msg += " Puntos recalculados para todos los partidos finalizados."
        return {"message": msg}
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
