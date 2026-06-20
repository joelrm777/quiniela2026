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

class MatchResultInput(BaseModel):
    home_score: int = Field(..., ge=0)
    away_score: int = Field(..., ge=0)
