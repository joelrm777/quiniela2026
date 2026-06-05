def calculate_points(home_pred: int, away_pred: int, home_real: int, away_real: int, rules: dict = None) -> dict:
    """
    Calculates prediction points using configurable rules.
    Default rules:
    - outcome_correct: 3 pts  (acertar resultado: local/visitante/empate)
    - exact_score:     2 pts  (marcador exacto)
    - home_goals:      1 pt   (goles local exactos)
    - away_goals:      1 pt   (goles visitante exactos)
    """
    if rules is None:
        rules = {
            "outcome_correct": 3,
            "exact_score":     2,
            "home_goals":      1,
            "away_goals":      1,
        }

    # 1. Check outcome (Winner / Draw)
    pred_outcome = 1 if home_pred > away_pred else (-1 if home_pred < away_pred else 0)
    real_outcome = 1 if home_real > away_real else (-1 if home_real < away_real else 0)

    outcome_points = rules.get("outcome_correct", 3) if pred_outcome == real_outcome else 0

    # 2. Check exact score
    exact_points = rules.get("exact_score", 2) if (home_pred == home_real and away_pred == away_real) else 0

    # 3. Check goals per team
    home_goals_points = rules.get("home_goals", 1) if home_pred == home_real else 0
    away_goals_points = rules.get("away_goals", 1) if away_pred == away_real else 0

    total_points = outcome_points + exact_points + home_goals_points + away_goals_points

    return {
        "outcome_points": outcome_points,
        "exact_points": exact_points,
        "home_goals_points": home_goals_points,
        "away_goals_points": away_goals_points,
        "total_points": total_points
    }
