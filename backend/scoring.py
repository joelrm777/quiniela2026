def calculate_points(home_pred: int, away_pred: int, home_real: int, away_real: int) -> dict:
    """
    Calculates prediction points based on World Cup 2026 rules:
    - Guesses outcome (winner or draw): 3 points
    - Guesses exact score: +2 points
    - Guesses local goals: 1 point
    - Guesses visitor goals: 1 point
    """
    # 1. Check outcome (Winner / Draw)
    pred_outcome = 1 if home_pred > away_pred else (-1 if home_pred < away_pred else 0)
    real_outcome = 1 if home_real > away_real else (-1 if home_real < away_real else 0)
    
    outcome_points = 3 if pred_outcome == real_outcome else 0
    
    # 2. Check exact score
    exact_points = 2 if (home_pred == home_real and away_pred == away_real) else 0
    
    # 3. Check goals per team
    home_goals_points = 1 if home_pred == home_real else 0
    away_goals_points = 1 if away_pred == away_real else 0
    
    total_points = outcome_points + exact_points + home_goals_points + away_goals_points
    
    return {
        "outcome_points": outcome_points,
        "exact_points": exact_points,
        "home_goals_points": home_goals_points,
        "away_goals_points": away_goals_points,
        "total_points": total_points
    }
