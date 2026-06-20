// ==========================================
// APPLICATION LOGIC - QUINIELA MUNDIAL 2026
// ==========================================

const API_BASE = "/api";
let currentUser = null;
let countdownInterval = null;

// Initialize app on load
window.addEventListener("DOMContentLoaded", () => {
    checkSession();
    startCountdownTimer();
});

// Check if user has an active session
async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`);
        if (res.ok) {
            const user = await res.json();
            loginUserSuccess(user);
        } else {
            showSection("auth-section");
        }
    } catch (err) {
        console.error("Error checking session:", err);
        showSection("auth-section");
    }
}

// Switch between Login and Register tabs
function switchAuthTab(tab) {
    const loginForm = document.getElementById("form-login");
    const registerForm = document.getElementById("form-register");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    
    // Clear error messages
    document.getElementById("login-error-msg").style.display = "none";
    document.getElementById("register-error-msg").style.display = "none";
    document.getElementById("register-success-msg").style.display = "none";

    if (tab === "login") {
        loginForm.style.display = "flex";
        registerForm.style.display = "none";
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "flex";
        tabLogin.classList.remove("active");
        tabRegister.classList.add("active");
    }
}

// Switch dashboard tabs
function switchDashboardTab(tab) {
    // Tab buttons
    const tabs = ["matches", "history", "leaderboard"];
    tabs.forEach(t => {
        const btn = document.getElementById(`dash-tab-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        if (t === tab) {
            btn.classList.add("active");
            content.style.display = "block";
        } else {
            btn.classList.remove("active");
            content.style.display = "none";
        }
    });

    // Load data based on tab
    if (tab === "matches") {
        loadActiveMatches();
    } else if (tab === "history") {
        loadHistory();
    } else if (tab === "leaderboard") {
        loadLeaderboard();
    }
}

// Show specific main section
function showSection(sectionId) {
    const sections = ["auth-section", "dashboard-section", "admin-section"];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (s === sectionId) {
            el.style.display = "flex";
            if (s === "dashboard-section") el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    });

    // Reset headers
    const header = document.getElementById("main-header-el");
    const userNav = document.getElementById("user-nav-el");
    
    if (sectionId === "auth-section") {
        userNav.style.display = "none";
    } else {
        userNav.style.display = "flex";
        if (currentUser) {
            document.getElementById("header-username").textContent = currentUser.username;
            // Admin button visibility
            const adminBtn = document.getElementById("btn-admin-panel");
            if (currentUser.is_admin) {
                adminBtn.style.display = "inline-flex";
            } else {
                adminBtn.style.display = "none";
            }
        }
    }
}

// Handle login or registration
async function handleAuth(event, type) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    const errorEl = document.getElementById(`${type}-error-msg`);
    errorEl.style.display = "none";

    if (type === "register") {
        const successEl = document.getElementById("register-success-msg");
        successEl.style.display = "none";
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                successEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message} Redirigiendo a inicio de sesión...`;
                successEl.style.display = "flex";
                event.target.reset();
                setTimeout(() => {
                    switchAuthTab("login");
                    // Prepopulate username
                    document.getElementById("login-username").value = data.username;
                }, 2000);
            } else {
                errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
                errorEl.style.display = "flex";
            }
        } catch (err) {
            errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.`;
            errorEl.style.display = "flex";
        }
    } else {
        // Login
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                loginUserSuccess(result.user);
            } else {
                errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
                errorEl.style.display = "flex";
            }
        } catch (err) {
            errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.`;
            errorEl.style.display = "flex";
        }
    }
}

// User successfully logged in
function loginUserSuccess(user) {
    currentUser = user;
    showSection("dashboard-section");
    switchDashboardTab("matches");
    updatePointsBadge();
}

// Update the user points in the header badge
async function updatePointsBadge() {
    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        if (res.ok) {
            const leaderboard = await res.json();
            const me = leaderboard.find(u => u.username === currentUser.username);
            const badge = document.getElementById("header-points-badge");
            if (me) {
                badge.textContent = `${me.total_points} Pts`;
            } else {
                badge.textContent = "0 Pts";
            }
        }
    } catch (err) {
        console.error("Error updating points badge:", err);
    }
}

// Log out user
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
        currentUser = null;
        showSection("auth-section");
        switchAuthTab("login");
    } catch (err) {
        console.error("Logout error:", err);
    }
}

// --- TAB 1: FETCH ACTIVE MATCHES ---
async function loadActiveMatches() {
    const grid = document.getElementById("active-matches-list");
    grid.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x text-accent"></i><p style="margin-top: 10px;">Cargando partidos...</p></div>`;
    
    try {
        const res = await fetch(`${API_BASE}/matches`);
        if (!res.ok) throw new Error("Could not load matches");
        const matches = await res.json();
        
        if (matches.length === 0) {
            grid.innerHTML = `<div class="text-center text-muted" style="grid-column: 1/-1; padding: 40px;"><i class="fa-solid fa-calendar-minus fa-2x"></i><p style="margin-top:10px;">No hay partidos cargados actualmente.</p></div>`;
            return;
        }

        grid.innerHTML = "";
        matches.forEach(m => {
            const isFinished = m.status === 'finished';
            const isClosed = m.status === 'closed';
            const hasPrediction = m.prediction !== null;
            
            // Format time local
            const timeObj = new Date(m.match_time);
            const formattedTime = timeObj.toLocaleString("es-ES", {
                weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            // Initial input values
            const homeScoreVal = hasPrediction ? m.prediction.home_score : 0;
            const awayScoreVal = hasPrediction ? m.prediction.away_score : 0;

            const card = document.createElement("div");
            card.id = `match-card-${m.id}`;
            card.className = `match-card ${(isClosed || isFinished) ? 'locked-card' : ''}`;

            let badgeHtml = "";
            if (isFinished) {
                badgeHtml = `<span class="card-header-badge badge-finished">Finalizado</span>`;
            } else if (isClosed) {
                badgeHtml = `<span class="card-header-badge badge-locked">Cerrado</span>`;
            } else {
                badgeHtml = `<span class="card-header-badge badge-open">Abierto</span>`;
            }

            // Real scores display if finished
            let vsContent = `<span class="vs-text">VS</span>`;
            if (isFinished) {
                vsContent = `<div class="real-score-box">${m.home_score} - ${m.away_score}</div>`;
            }

            card.innerHTML = `
                ${badgeHtml}
                <div class="match-meta">
                    <span class="match-date">${formattedTime}</span>
                    ${(!isFinished && !isClosed) ? 
                        `<span class="match-countdown" data-match-time="${m.match_time}" data-match-id="${m.id}"><i class="fa-solid fa-clock"></i> Calculando...</span>` 
                        : (isClosed && !isFinished ? `<span class="text-muted text-sm"><i class="fa-solid fa-lock"></i> Bloqueado para cambios</span>` : `<span class="text-gold text-sm"><i class="fa-solid fa-circle-check"></i> Resultado Oficial</span>`)
                    }
                </div>
                <div class="match-body">
                    <div class="team-display">
                        <div class="team-flag-placeholder">${m.home_team.substring(0,2).toUpperCase()}</div>
                        <span class="team-name">${m.home_team}</span>
                    </div>
                    
                    <div class="match-vs">
                        ${vsContent}
                    </div>

                    <div class="team-display">
                        <div class="team-flag-placeholder">${m.away_team.substring(0,2).toUpperCase()}</div>
                        <span class="team-name">${m.away_team}</span>
                    </div>
                </div>

                <div class="match-actions">
                    <div style="display:flex; justify-content: space-around; align-items:center; margin-bottom: 8px;">
                        <span class="text-muted text-sm">Tu Pronóstico:</span>
                        
                        <div class="score-inputs-wrapper">
                            <!-- Local Score -->
                            <div class="score-control">
                                <button class="score-btn" onclick="adjustScore(${m.id}, 'home', 1)" ${(isClosed || isFinished) ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                                <input type="number" id="pred-home-${m.id}" class="score-input" value="${homeScoreVal}" min="0" readonly>
                                <button class="score-btn" onclick="adjustScore(${m.id}, 'home', -1)" ${(isClosed || isFinished) ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                            
                            <span class="text-muted font-weight-bold">-</span>
                            
                            <!-- Away Score -->
                            <div class="score-control">
                                <button class="score-btn" onclick="adjustScore(${m.id}, 'away', 1)" ${(isClosed || isFinished) ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                                <input type="number" id="pred-away-${m.id}" class="score-input" value="${awayScoreVal}" min="0" readonly>
                                <button class="score-btn" onclick="adjustScore(${m.id}, 'away', -1)" ${(isClosed || isFinished) ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                        </div>
                    </div>

                    <div id="pred-msg-${m.id}" class="alert" style="display:none; padding: 6px 12px; margin-top:0;"></div>

                    ${(!isClosed && !isFinished) ? 
                        `<button class="btn btn-primary btn-save-prediction" onclick="savePrediction(${m.id})">
                            <i class="fa-solid fa-floppy-disk"></i> Guardar Pronóstico
                        </button>` : ''
                    }

                    ${(hasPrediction && !isFinished) ? 
                        `<div class="prediction-saved-indicator"><i class="fa-solid fa-circle-check"></i> Pronóstico guardado</div>` : ''
                    }
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading matches:", err);
        grid.innerHTML = `<div class="alert alert-danger" style="grid-column: 1/-1;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar los partidos. Intenta de nuevo más tarde.</div>`;
    }
}

// Adjust prediction score locally in UI
function adjustScore(matchId, team, delta) {
    const input = document.getElementById(`pred-${team}-${matchId}`);
    if (input) {
        let current = parseInt(input.value) || 0;
        current = Math.max(0, current + delta);
        input.value = current;
        
        // Hide saved indicator when user modifies inputs to remind them to save
        const card = document.getElementById(`match-card-${matchId}`);
        const indicator = card.querySelector(".prediction-saved-indicator");
        if (indicator) indicator.style.display = "none";
    }
}

// Save user prediction to database
async function savePrediction(matchId) {
    const homeInput = document.getElementById(`pred-home-${matchId}`);
    const awayInput = document.getElementById(`pred-away-${matchId}`);
    const msgEl = document.getElementById(`pred-msg-${matchId}`);
    
    msgEl.style.display = "none";

    const payload = {
        match_id: matchId,
        home_score: parseInt(homeInput.value),
        away_score: parseInt(awayInput.value)
    };

    try {
        const res = await fetch(`${API_BASE}/predictions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (res.ok) {
            msgEl.className = "alert alert-success";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Pronóstico guardado.`;
            msgEl.style.display = "flex";
            
            // Reload active matches to show clean saved states
            setTimeout(() => {
                loadActiveMatches();
                updatePointsBadge();
            }, 1000);
        } else {
            msgEl.className = "alert alert-danger";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
            msgEl.style.display = "flex";
        }
    } catch (err) {
        msgEl.className = "alert alert-danger";
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al guardar.`;
        msgEl.style.display = "flex";
    }
}

// Countdown timer interval logic
function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const countdownElements = document.querySelectorAll('[data-match-time]');
        countdownElements.forEach(el => {
            const matchTimeStr = el.getAttribute('data-match-time');
            const matchId = el.getAttribute('data-match-id');
            const matchTime = new Date(matchTimeStr);
            const now = new Date();
            
            // Lock window is 1 hour (3,600,000 ms) before kickoff
            const deadline = new Date(matchTime.getTime() - 60 * 60 * 1000);
            const timeDiff = deadline - now;
            
            if (timeDiff <= 0) {
                el.innerHTML = '<span class="text-danger"><i class="fa-solid fa-lock"></i> Cerrado</span>';
                // Lock matching card inputs in UI dynamically
                lockMatchCard(matchId);
            } else {
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                
                let timeText = "";
                if (hours > 0) timeText += `${hours}h `;
                timeText += `${minutes}m ${seconds}s`;
                
                el.innerHTML = `<i class="fa-solid fa-clock"></i> Cierra en: ${timeText}`;
            }
        });
    }, 1000);
}

// Lock a match card inputs when countdown expires
function lockMatchCard(matchId) {
    const card = document.getElementById(`match-card-${matchId}`);
    if (card && !card.classList.contains('locked-card')) {
        card.classList.add('locked-card');
        
        // Update header badge to "Cerrado"
        const badge = card.querySelector('.card-header-badge');
        if (badge && badge.classList.contains('badge-open')) {
            badge.className = 'card-header-badge badge-locked';
            badge.textContent = 'Cerrado';
        }

        // Disable input buttons and text fields
        const inputs = card.querySelectorAll('.score-input');
        inputs.forEach(inp => inp.disabled = true);
        const buttons = card.querySelectorAll('.score-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        // Hide Save button
        const saveBtn = card.querySelector('.btn-save-prediction');
        if (saveBtn) saveBtn.style.display = "none";
        
        // Hide saved message
        const savedText = card.querySelector(".prediction-saved-indicator");
        if (savedText) savedText.style.display = "none";
    }
}


// --- TAB 2: FETCH USER PREDICTION HISTORY ---
async function loadHistory() {
    const tbody = document.getElementById("history-table-body");
    const summaryBox = document.getElementById("history-summary-box-el");
    
    tbody.innerHTML = `<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin fa-lg text-accent"></i> Cargando historial...</td></tr>`;
    
    try {
        const res = await fetch(`${API_BASE}/predictions/history`);
        if (!res.ok) throw new Error("Could not load history");
        const history = await res.json();
        
        if (history.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aún no has realizado ningún pronóstico.</td></tr>`;
            summaryBox.innerHTML = `
                <div class="summary-item"><h4>Total Puntos</h4><div class="summary-value text-gold">0</div></div>
                <div class="summary-item"><h4>Marcadores Exactos</h4><div class="summary-value text-accent">0</div></div>
                <div class="summary-item"><h4>Resultados Acertados</h4><div class="summary-value text-success">0</div></div>
            `;
            return;
        }

        let totalPoints = 0;
        let exactScores = 0;
        let outcomeGuessed = 0;
        tbody.innerHTML = "";

        history.forEach(row => {
            const isFinished = row.status === 'finished';
            const realScore = isFinished ? `${row.real_home} - ${row.real_away}` : '<span class="text-muted">Pendiente</span>';
            const predScore = `${row.pred_home} - ${row.pred_away}`;
            
            // Format date
            const dateStr = new Date(row.match_time).toLocaleDateString("es-ES", {
                day: 'numeric', month: 'short'
            });

            // Points styling
            const pointsEarned = isFinished ? row.total_points : 0;
            if (isFinished) {
                totalPoints += pointsEarned;
                if (row.exact_points > 0) exactScores++;
                if (row.outcome_points > 0) outcomeGuessed++;
            }

            const pointsDisplay = isFinished ? 
                `<span class="badge-points font-weight-bold text-gold">${pointsEarned} Pts</span>` 
                : '<span class="text-muted">-</span>';

            const matchGuessedDisplay = isFinished ? 
                (row.outcome_points > 0 ? '<i class="fa-solid fa-circle-check text-success"></i> +3 Pts' : '<i class="fa-solid fa-circle-xmark text-danger"></i> 0 Pts')
                : '<span class="text-muted">Pendiente</span>';
            
            const exactGuessedDisplay = isFinished ? 
                (row.exact_points > 0 ? '<i class="fa-solid fa-circle-check text-success"></i> +2 Pts' : '<i class="fa-solid fa-circle-xmark text-danger"></i> 0 Pts')
                : '<span class="text-muted">Pendiente</span>';

            const goalsDisplay = isFinished ?
                `Local: ${row.home_goals_points > 0 ? '+1' : '0'} | Vis: ${row.away_goals_points > 0 ? '+1' : '0'} Pts`
                : '<span class="text-muted">Pendiente</span>';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700;">${row.home_team} vs ${row.away_team}</div>
                    <div class="text-muted text-sm">${dateStr}</div>
                </td>
                <td class="font-weight-bold text-accent">${predScore}</td>
                <td class="font-weight-bold">${realScore}</td>
                <td>${matchGuessedDisplay}</td>
                <td>${exactGuessedDisplay}</td>
                <td class="text-sm">${goalsDisplay}</td>
                <td>${pointsDisplay}</td>
            `;
            tbody.appendChild(tr);
        });

        // Update Summary box
        summaryBox.innerHTML = `
            <div class="summary-item">
                <h4>Total Puntos</h4>
                <div class="summary-value text-gold">${totalPoints}</div>
            </div>
            <div class="summary-item">
                <h4>Marcadores Exactos</h4>
                <div class="summary-value text-accent">${exactScores}</div>
            </div>
            <div class="summary-item">
                <h4>Resultados Acertados</h4>
                <div class="summary-value text-success">${outcomeGuessed}</div>
            </div>
        `;

    } catch (err) {
        console.error("Error loading history:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar historial.</td></tr>`;
    }
}


// --- TAB 3: FETCH GENERAL LEADERBOARD ---
async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboard-table-body");
    const podiumEl = document.getElementById("leaderboard-podium-el");
    
    tbody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin fa-lg text-accent"></i> Cargando clasificación...</td></tr>`;
    podiumEl.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        if (!res.ok) throw new Error("Could not load leaderboard");
        const list = await res.json();
        
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aún no hay posiciones registradas.</td></tr>`;
            return;
        }

        // Render Podium (top 3)
        const podiumUsers = list.slice(0, 3);
        const second = podiumUsers[1];
        const first = podiumUsers[0];
        const third = podiumUsers[2];

        // 2nd Place card
        if (second) {
            podiumEl.appendChild(createPodiumCard(second, "second-place", 2, "🥈"));
        } else {
            podiumEl.appendChild(createEmptyPodiumCard("second-place", 2));
        }

        // 1st Place card (center)
        if (first) {
            podiumEl.appendChild(createPodiumCard(first, "first-place", 1, "🏆"));
        } else {
            podiumEl.appendChild(createEmptyPodiumCard("first-place", 1));
        }

        // 3rd Place card
        if (third) {
            podiumEl.appendChild(createPodiumCard(third, "third-place", 3, "🥉"));
        } else {
            podiumEl.appendChild(createEmptyPodiumCard("third-place", 3));
        }

        // Render remaining list in the table
        tbody.innerHTML = "";
        list.forEach((user, index) => {
            const tr = document.createElement("tr");
            
            // Highlight current user
            const isMe = currentUser && user.username === currentUser.username;
            if (isMe) tr.style.background = "rgba(0, 242, 254, 0.08)";

            let medal = "";
            if (user.position === 1) medal = "🥇 ";
            else if (user.position === 2) medal = "🥈 ";
            else if (user.position === 3) medal = "🥉 ";

            tr.innerHTML = `
                <td class="font-weight-bold">${medal}${user.position}</td>
                <td class="font-weight-bold" style="${isMe ? 'color:var(--color-accent);' : ''}">
                    ${user.username} ${isMe ? ' <span class="text-xs text-accent">(Tú)</span>' : ''}
                </td>
                <td>${user.matches_guessed}</td>
                <td>${user.exact_scores}</td>
                <td class="font-weight-bold text-gold">${user.total_points} Pts</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error loading leaderboard:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar la tabla de posiciones.</td></tr>`;
    }
}

function createPodiumCard(user, cssClass, rank, medal) {
    const card = document.createElement("div");
    card.className = `podium-card ${cssClass}`;
    card.innerHTML = `
        <div class="podium-rank">${rank}</div>
        <div style="font-size: 2rem; margin-top:5px;">${medal}</div>
        <div class="podium-username">${user.username}</div>
        <div class="podium-points">${user.total_points} Pts</div>
        <div class="text-muted text-xs">${user.exact_scores} Marcadores | ${user.matches_guessed} Aciertos</div>
    `;
    return card;
}

function createEmptyPodiumCard(cssClass, rank) {
    const card = document.createElement("div");
    card.className = `podium-card ${cssClass} text-muted`;
    card.innerHTML = `
        <div class="podium-rank" style="background:#555; box-shadow:none;">${rank}</div>
        <div style="font-size: 2rem; margin-top:5px; opacity:0.3;"><i class="fa-solid fa-user-slash"></i></div>
        <div class="podium-username">-</div>
        <div class="podium-points">0 Pts</div>
    `;
    return card;
}


// --- ADMIN PANEL FUNCTIONS ---

// Add a new match
async function handleAddMatch(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Convert match time to timezone string
    const dateInput = new Date(data.match_time);
    data.match_time = dateInput.toISOString(); // Send ISO UTC to backend

    const msgEl = document.getElementById("add-match-msg");
    msgEl.style.display = "none";

    try {
        const res = await fetch(`${API_BASE}/admin/matches`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (res.ok) {
            msgEl.className = "alert alert-success";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
            msgEl.style.display = "flex";
            event.target.reset();
            loadAdminMatchesList();
        } else {
            msgEl.className = "alert alert-danger";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
            msgEl.style.display = "flex";
        }
    } catch (err) {
        msgEl.className = "alert alert-danger";
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.`;
        msgEl.style.display = "flex";
    }
}

// Load matches in admin panel for updating results
async function loadAdminMatchesList() {
    const listEl = document.getElementById("admin-matches-list-el");
    listEl.innerHTML = `<p class="text-center padding-20"><i class="fa-solid fa-spinner fa-spin text-accent"></i> Cargando partidos...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/matches`);
        if (!res.ok) throw new Error("Could not load matches for admin");
        const matches = await res.json();
        
        // Filter out matches that are already finished
        const openOrClosed = matches.filter(m => m.status !== 'finished');
        
        if (openOrClosed.length === 0) {
            listEl.innerHTML = `<p class="text-center text-muted padding-20">No hay partidos pendientes de resultados.</p>`;
            return;
        }

        listEl.innerHTML = "";
        openOrClosed.forEach(m => {
            const item = document.createElement("div");
            item.className = "admin-match-item";
            
            const timeObj = new Date(m.match_time);
            const formattedTime = timeObj.toLocaleString("es-ES", {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            item.innerHTML = `
                <div class="admin-match-info">
                    <span>${m.home_team} vs ${m.away_team}</span>
                    <span class="text-accent text-sm">${formattedTime} (${m.status.toUpperCase()})</span>
                </div>
                
                <form class="admin-match-result-form" onsubmit="handleSetResult(event, ${m.id})">
                    <div class="admin-score-inputs">
                        <input type="number" id="admin-home-${m.id}" name="home_score" min="0" placeholder="L" required>
                        <span>-</span>
                        <input type="number" id="admin-away-${m.id}" name="away_score" min="0" placeholder="V" required>
                    </div>
                    
                    <div style="display:flex; gap: 8px;">
                        ${m.status === 'open' ? 
                            `<button type="button" class="btn btn-secondary btn-sm" onclick="closePrediction(${m.id})">
                                <i class="fa-solid fa-lock"></i> Cerrar
                            </button>` : ''
                        }
                        <button type="submit" class="btn btn-success btn-sm">
                            <i class="fa-solid fa-circle-check"></i> Registrar
                        </button>
                    </div>
                </form>
                <div id="admin-msg-${m.id}" class="alert" style="display:none; padding:6px 12px; margin-top:0;"></div>
            `;
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Admin matches error:", err);
        listEl.innerHTML = `<p class="text-danger text-center">Error al cargar partidos.</p>`;
    }
}

// Call API to manually lock predictions for a match
async function closePrediction(matchId) {
    try {
        const res = await fetch(`${API_BASE}/admin/matches/${matchId}/close`, {
            method: "POST"
        });
        const result = await res.json();
        if (res.ok) {
            loadAdminMatchesList();
        } else {
            alert(result.detail);
        }
    } catch (err) {
        console.error("Error closing prediction:", err);
    }
}

// Call API to submit official result
async function handleSetResult(event, matchId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    const payload = {
        home_score: parseInt(data.home_score),
        away_score: parseInt(data.away_score)
    };

    const msgEl = document.getElementById(`admin-msg-${matchId}`);
    msgEl.style.display = "none";

    try {
        const res = await fetch(`${API_BASE}/admin/matches/${matchId}/result`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (res.ok) {
            msgEl.className = "alert alert-success";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Puntos calculados!`;
            msgEl.style.display = "flex";
            
            setTimeout(() => {
                loadAdminMatchesList();
            }, 1500);
        } else {
            msgEl.className = "alert alert-danger";
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
            msgEl.style.display = "flex";
        }
    } catch (err) {
        msgEl.className = "alert alert-danger";
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al registrar.`;
        msgEl.style.display = "flex";
    }
}

// When showing admin section, reload match listing
const originalShowSection = showSection;
showSection = function(sectionId) {
    originalShowSection(sectionId);
    if (sectionId === 'admin-section') {
        loadAdminMatchesList();
    } else if (sectionId === 'dashboard-section') {
        updatePointsBadge();
    }
};
