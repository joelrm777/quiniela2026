from pydantic import BaseModel, Field
from typing import Optional, List

class UserAuth(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)

class PredictionInput(BaseModel):
    match_id: int
    home_score: int = Field(..., ge=0)
    away_score: int = Field(..., ge=0)

class MatchInput(BaseModel):
    home_team: str
    away_team: str
    match_time: str  # Format: "YYYY-MM-DDTHH:MM:SS" (local or UTC string)
    phase: str = "grupos"       # grupos | ronda32 | octavos | cuartos | semifinal | tercer_lugar | final
    group_name: str = ""        # A, B, C ... L  (solo aplica en fase de grupos)
    round: int = 1              # Jornada 1, 2 o 3 (solo aplica en fase de grupos)

class MatchResultInput(BaseModel):
    home_score: int = Field(..., ge=0)
    away_score: int = Field(..., ge=0)

# --- Admin: User Management ---
class UserUpdateInput(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None

class UserPasswordInput(BaseModel):
    new_password: str = Field(..., min_length=4)

# --- Admin: Scoring Rules ---
class ScoringRuleItem(BaseModel):
    rule_key: str
    points: int = Field(..., ge=0, le=100)

class ScoringRulesUpdateInput(BaseModel):
    rules: List[ScoringRuleItem]
    recalculate: bool = False   # Si True, recalcula puntos de partidos ya finalizados

# --- Admin: Match Update ---
class MatchUpdateInput(BaseModel):
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    match_time: Optional[str] = None
    phase: Optional[str] = None
    group_name: Optional[str] = None
    round: Optional[int] = None
    status: Optional[str] = None
