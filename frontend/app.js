// ==========================================
// APPLICATION LOGIC - QUINIELA MUNDIAL 2026
// ==========================================

const API_BASE = "/api";
let currentUser = null;
let countdownInterval = null;

// Phase / filter state
let currentPhase = 'grupos';
let currentRound = 1;
let currentGroup = 'all';

const PHASE_LABELS = {
    grupos:       'Fase de Grupos',
    ronda32:      'Ronda de 32',
    octavos:      'Octavos de Final',
    cuartos:      'Cuartos de Final',
    semifinal:    'Semifinales',
    tercer_lugar: 'Tercer Lugar',
    final:        'Gran Final'
};

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
        // Reset to Fase de Grupos Jornada 1 when switching back to Partidos tab
        switchPhase(currentPhase);
    } else if (tab === "history") {
        loadHistory();
    } else if (tab === "leaderboard") {
        loadLeaderboard();
    }
}

// ── PHASE / ROUND / GROUP NAVIGATION ──────────────────────────────────────

function switchPhase(phase) {
    currentPhase = phase;
    currentRound = 1;
    currentGroup = 'all';

    // Update phase button active state
    document.querySelectorAll('.phase-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`phase-btn-${phase}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Show/hide grupos sub-filters
    const gruposFilters = document.getElementById('grupos-filters');
    if (gruposFilters) {
        gruposFilters.style.display = (phase === 'grupos') ? 'block' : 'none';
    }

    // Reset round chips
    for (let r = 1; r <= 3; r++) {
        const chip = document.getElementById(`round-btn-${r}`);
        if (chip) chip.classList.toggle('active', r === 1);
    }
    // Reset group chips
    document.querySelectorAll('[id^="group-btn-"]').forEach(c => c.classList.remove('active'));
    const allChip = document.getElementById('group-btn-all');
    if (allChip) allChip.classList.add('active');

    updateMatchesHeader();
    loadActiveMatches();
}

function switchRound(round) {
    currentRound = round;
    // Update chips
    for (let r = 1; r <= 3; r++) {
        const chip = document.getElementById(`round-btn-${r}`);
        if (chip) chip.classList.toggle('active', r === round);
    }
    updateMatchesHeader();
    loadActiveMatches();
}

function switchGroup(group) {
    currentGroup = group;
    // Update chips
    document.querySelectorAll('[id^="group-btn-"]').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById(`group-btn-${group}`);
    if (chip) chip.classList.add('active');
    updateMatchesHeader();
    loadActiveMatches();
}

function updateMatchesHeader() {
    const titleEl = document.getElementById('matches-section-title');
    const subtitleEl = document.getElementById('matches-section-subtitle');
    if (!titleEl) return;

    if (currentPhase === 'grupos') {
        const groupSuffix = (currentGroup !== 'all') ? ` &mdash; Grupo ${currentGroup}` : '';
        titleEl.innerHTML = `Fase de Grupos &mdash; Jornada ${currentRound}${groupSuffix}`;
        subtitleEl.textContent = 'Ingresa tus apuestas exactas de goles. Se bloquean automáticamente 1 hora antes de que inicie cada partido.';
    } else {
        titleEl.textContent = PHASE_LABELS[currentPhase] || currentPhase;
        subtitleEl.textContent = 'Pronósticos de la fase eliminatoria. Se bloquean 1 hora antes del inicio.';
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
    
    // Build query params from current phase/round/group state
    const params = new URLSearchParams();
    params.set('phase', currentPhase);
    if (currentPhase === 'grupos') {
        params.set('round', currentRound);
        if (currentGroup !== 'all') params.set('group_name', currentGroup);
    }

    try {
        const res = await fetch(`${API_BASE}/matches?${params.toString()}`);
        if (!res.ok) throw new Error("Could not load matches");
        const matches = await res.json();
        
        // Non-grupos phases: show "próximamente" if no matches exist yet
        if (matches.length === 0) {
            if (currentPhase !== 'grupos') {
                grid.innerHTML = `
                    <div class="phase-coming-soon" style="grid-column: 1/-1;">
                        <i class="fa-solid fa-hourglass-half fa-3x text-gold"></i>
                        <h3>${PHASE_LABELS[currentPhase] || currentPhase}</h3>
                        <p class="text-muted">Los partidos de esta fase se habilitarán una vez que el administrador los publique.</p>
                    </div>`;
            } else {
                grid.innerHTML = `<div class="text-center text-muted" style="grid-column: 1/-1; padding: 40px;"><i class="fa-solid fa-calendar-minus fa-2x"></i><p style="margin-top:10px;">No hay partidos cargados para esta jornada/grupo.</p></div>`;
            }
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
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span><strong>${m.home_team} vs ${m.away_team}</strong></span>
                        <span class="text-accent text-sm">${formattedTime} (${m.status.toUpperCase()})</span>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openMatchPredictionsModal(${m.id})" title="Ver pronósticos">
                            <i class="fa-solid fa-eye"></i> Pronósticos
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="confirmDeleteMatch(${m.id}, '${m.home_team.replace(/'/g,"\\'")} vs ${m.away_team.replace(/'/g,"\\'")}')">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>
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

// Add admin group fields toggle
function toggleAdminGroupFields(phase) {
    const roundGroup = document.getElementById('admin-round-group');
    const groupNameGroup = document.getElementById('admin-group-name-group');
    const isGrupos = phase === 'grupos';
    if (roundGroup) roundGroup.style.display = isGrupos ? 'block' : 'none';
    if (groupNameGroup) groupNameGroup.style.display = isGrupos ? 'block' : 'none';
}

// ============================================================
// ADMIN TAB NAVIGATION
// ============================================================

function switchAdminTab(tab) {
    ['partidos', 'usuarios', 'puntuacion'].forEach(t => {
        const btn = document.getElementById(`admin-nav-${t}`);
        const content = document.getElementById(`admin-content-${t}`);
        if (btn)     btn.classList.toggle('active', t === tab);
        if (content) content.style.display = (t === tab) ? 'block' : 'none';
    });
    if (tab === 'partidos')  { loadAdminMatchesList(); loadAdminAllMatches(); }
    if (tab === 'usuarios')  { loadAdminUsers(); }
    if (tab === 'puntuacion'){ loadScoringRules(); }
}

// ============================================================
// ADMIN — FULL MATCH LIST (edit / delete)
// ============================================================

let adminAllMatches = [];   // cached for filter

async function loadAdminAllMatches() {
    const tbody = document.getElementById('admin-all-matches-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;
    try {
        const res = await fetch(`${API_BASE}/matches`);
        adminAllMatches = await res.json();
        renderAdminMatchesTable(adminAllMatches);
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar partidos.</td></tr>`;
    }
}

function filterAdminMatches(phase) {
    document.querySelectorAll('#admin-phase-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
    const active = document.getElementById(`admin-phase-${phase}`);
    if (active) active.classList.add('active');
    const filtered = phase === 'all' ? adminAllMatches : adminAllMatches.filter(m => m.phase === phase);
    renderAdminMatchesTable(filtered);
}

const PHASE_NAMES = {
    grupos: 'Grupos', ronda32: 'R.32', octavos: 'Octavos',
    cuartos: 'Cuartos', semifinal: 'Semifinal', tercer_lugar: '3er Lugar', final: 'Final'
};
const STATUS_BADGES = {
    open:     '<span class="status-chip chip-open">Abierto</span>',
    closed:   '<span class="status-chip chip-closed">Cerrado</span>',
    finished: '<span class="status-chip chip-finished">Finalizado</span>',
};

function renderAdminMatchesTable(matches) {
    const tbody = document.getElementById('admin-all-matches-body');
    if (!tbody) return;
    if (!matches.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin partidos para este filtro.</td></tr>`;
        return;
    }
    tbody.innerHTML = matches.map(m => {
        const dt = new Date(m.match_time).toLocaleString('es-ES', {
            day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
        });
        const phaseLabel = PHASE_NAMES[m.phase] || m.phase;
        const groupInfo  = m.phase === 'grupos' ? ` G.${m.group_name} J${m.round}` : '';
        return `
        <tr>
            <td><strong>${m.home_team} vs ${m.away_team}</strong></td>
            <td class="text-sm">${dt}</td>
            <td class="text-sm">${phaseLabel}${groupInfo}</td>
            <td>${STATUS_BADGES[m.status] || m.status}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="openMatchPredictionsModal(${m.id})" title="Ver pronósticos">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="margin-left:4px;" onclick="openEditMatchModal(${m.id})" title="Editar">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="btn btn-danger btn-sm" style="margin-left:4px;" onclick="confirmDeleteMatch(${m.id}, '${m.home_team} vs ${m.away_team}')" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openEditMatchModal(matchId) {
    const match = adminAllMatches.find(m => m.id === matchId);
    if (!match) return;
    document.getElementById('edit-match-id').value      = match.id;
    document.getElementById('edit-match-home').value    = match.home_team;
    document.getElementById('edit-match-away').value    = match.away_team;
    document.getElementById('edit-match-status').value  = match.status;
    document.getElementById('edit-match-phase').value   = match.phase;
    document.getElementById('edit-match-round').value   = match.round || 1;
    document.getElementById('edit-match-group').value   = match.group_name || 'A';
    // Convert ISO to datetime-local format
    const dt = new Date(match.match_time);
    const pad = n => String(n).padStart(2,'0');
    document.getElementById('edit-match-time').value =
        `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    toggleEditGroupFields(match.phase);
    document.getElementById('edit-match-msg').style.display = 'none';
    openModal('modal-edit-match');
}

function toggleEditGroupFields(phase) {
    const gf = document.getElementById('edit-group-fields');
    if (gf) gf.style.display = phase === 'grupos' ? 'flex' : 'none';
}

async function handleEditMatchSubmit(event) {
    event.preventDefault();
    const matchId = document.getElementById('edit-match-id').value;
    const phase   = document.getElementById('edit-match-phase').value;
    const msgEl   = document.getElementById('edit-match-msg');
    msgEl.style.display = 'none';

    const dtRaw  = document.getElementById('edit-match-time').value;
    const isoTime = new Date(dtRaw).toISOString();

    const payload = {
        home_team:  document.getElementById('edit-match-home').value,
        away_team:  document.getElementById('edit-match-away').value,
        match_time: isoTime,
        phase:      phase,
        status:     document.getElementById('edit-match-status').value,
        group_name: phase === 'grupos' ? document.getElementById('edit-match-group').value : '',
        round:      phase === 'grupos' ? parseInt(document.getElementById('edit-match-round').value) : 1
    };

    try {
        const res    = await fetch(`${API_BASE}/admin/matches/${matchId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            msgEl.className = 'alert alert-success';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
            msgEl.style.display = 'flex';
            setTimeout(() => { closeModal('modal-edit-match'); loadAdminAllMatches(); loadAdminMatchesList(); }, 1000);
        } else {
            msgEl.className = 'alert alert-danger';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
            msgEl.style.display = 'flex';
        }
    } catch(e) {
        msgEl.className = 'alert alert-danger';
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error de conexión.`;
        msgEl.style.display = 'flex';
    }
}

async function confirmDeleteMatch(matchId, label) {
    if (!confirm(`¿Seguro que deseas eliminar el partido "${label}"?\nSe eliminarán también todos los pronósticos y puntajes asociados.`)) return;
    try {
        const res = await fetch(`${API_BASE}/admin/matches/${matchId}`, { method: 'DELETE' });
        const result = await res.json();
        if (res.ok) {
            loadAdminAllMatches();
            loadAdminMatchesList();
        } else {
            alert(result.detail);
        }
    } catch(e) { alert('Error al eliminar el partido.'); }
}

// ============================================================
// ADMIN — MATCH PREDICTIONS VIEWER
// ============================================================

let currentMatchPredictionsData = null;   // cached for export

async function openMatchPredictionsModal(matchId) {
    openModal('modal-match-predictions');
    const titleEl  = document.getElementById('pred-modal-title');
    const subtitleEl = document.getElementById('pred-modal-subtitle');
    const tbody    = document.getElementById('pred-modal-tbody');
    const exportBtn = document.getElementById('btn-export-predictions');

    titleEl.textContent   = 'Cargando...';
    subtitleEl.textContent = '';
    exportBtn.style.display = 'none';
    tbody.innerHTML = `<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin text-accent"></i></td></tr>`;

    try {
        const res  = await fetch(`${API_BASE}/admin/matches/${matchId}/predictions`);
        const data = await res.json();
        if (!res.ok) { tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">${data.detail}</td></tr>`; return; }

        currentMatchPredictionsData = data;
        const m = data.match;
        const isFinished = m.status === 'finished';

        titleEl.textContent = `${m.home_team} vs ${m.away_team}`;
        const dt = new Date(m.match_time).toLocaleString('es-ES', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
        const realScore = isFinished ? `  |  Resultado: ${m.home_score} - ${m.away_score}` : '';
        subtitleEl.textContent = `${dt}${realScore}`;

        // Update table header based on whether match is finished
        const thead = document.querySelector('#pred-modal-thead tr');
        if (thead) {
            thead.innerHTML = isFinished
                ? `<th>#</th><th>Usuario</th><th>Pronóstico</th><th style="text-align:center;">Resultado</th><th style="text-align:center;">Marcador</th><th style="text-align:center;">Goles</th><th style="text-align:center;">Total</th>`
                : `<th>#</th><th>Usuario</th><th>Pronóstico</th><th colspan="4" class="text-center text-muted">Partido no finalizado</th>`;
        }

        const preds = data.predictions;
        if (!preds.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Ningún usuario ha registrado pronóstico para este partido.</td></tr>`;
            return;
        }

        tbody.innerHTML = preds.map((p, idx) => {
            const hasPred = p.pred_home !== null && p.pred_home !== undefined;
            const predCell = hasPred
                ? `<strong class="text-accent">${p.pred_home} - ${p.pred_away}</strong>`
                : `<span class="text-muted">Sin pronóstico</span>`;

            let scoreCells = `<td colspan="4" class="text-center text-muted">—</td>`;
            if (isFinished && hasPred) {
                const pts = p.total_points ?? 0;
                const ptsColor = pts >= 5 ? 'text-gold' : pts >= 3 ? 'text-success' : pts > 0 ? 'text-accent' : 'text-muted';
                scoreCells = `
                    <td style="text-align:center;">${p.outcome_points > 0 ? `<span class="text-success">+${p.outcome_points}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td style="text-align:center;">${p.exact_points   > 0 ? `<span class="text-success">+${p.exact_points}</span>`   : '<span class="text-muted">0</span>'}</td>
                    <td style="text-align:center;" class="text-sm">${p.home_goals_points > 0 ? '+1' : '0'}/${p.away_goals_points > 0 ? '+1' : '0'}</td>
                    <td style="text-align:center;"><strong class="${ptsColor}">${pts} Pts</strong></td>`;
            } else if (isFinished && !hasPred) {
                scoreCells = `<td colspan="4" class="text-center text-muted">Sin pronóstico</td>`;
            } else {
                scoreCells = `<td colspan="4" class="text-center text-muted">Pendiente</td>`;
            }

            return `<tr>
                <td class="text-muted text-sm">${idx + 1}</td>
                <td><strong>${p.username}</strong></td>
                <td>${predCell}</td>
                ${scoreCells}
            </tr>`;
        }).join('');

        exportBtn.style.display = 'inline-flex';
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Error al cargar pronósticos.</td></tr>`;
    }
}

// ============================================================
// EXCEL EXPORT — SheetJS
// ============================================================

function exportPredictionsToExcel() {
    if (!currentMatchPredictionsData) return;
    const { match: m, predictions: preds } = currentMatchPredictionsData;
    const isFinished = m.status === 'finished';

    // Build rows
    const headers = isFinished
        ? ['#', 'Usuario', 'Pronóstico Local', 'Pronóstico Visitante', 'Marcador Real', 'Pts Resultado', 'Pts Marcador Exacto', 'Pts Goles Local', 'Pts Goles Visitante', 'Total Puntos']
        : ['#', 'Usuario', 'Pronóstico Local', 'Pronóstico Visitante'];

    const rows = preds.map((p, idx) => {
        const hasPred = p.pred_home !== null && p.pred_home !== undefined;
        const base = [
            idx + 1,
            p.username,
            hasPred ? p.pred_home : 'Sin pronóstico',
            hasPred ? p.pred_away : 'Sin pronóstico'
        ];
        if (isFinished) {
            base.push(
                `${m.home_score} - ${m.away_score}`,
                hasPred ? (p.outcome_points ?? 0)    : '-',
                hasPred ? (p.exact_points ?? 0)      : '-',
                hasPred ? (p.home_goals_points ?? 0) : '-',
                hasPred ? (p.away_goals_points ?? 0) : '-',
                hasPred ? (p.total_points ?? 0)      : '-'
            );
        }
        return base;
    });

    // Match info row at top
    const dt = new Date(m.match_time).toLocaleString('es-ES');
    const matchInfo = [[`Partido: ${m.home_team} vs ${m.away_team}`], [`Fecha: ${dt}`]];
    if (isFinished) matchInfo.push([`Resultado Final: ${m.home_score} - ${m.away_score}`]);
    matchInfo.push([`Fase: ${PHASE_LABELS[m.phase] || m.phase}`], []);

    // Build worksheet
    const wsData = [...matchInfo, headers, ...rows];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 1 ? 20 : 18 }));

    const safeName = `${m.home_team} vs ${m.away_team}`.replace(/[^\w\s-]/g, '').substring(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, safeName);

    // Also add a summary sheet if finished
    if (isFinished) {
        const sumHeaders = ['Usuario', 'Pronóstico', 'Total Puntos', 'Tiene Pronóstico'];
        const sumRows = preds.map(p => {
            const hasPred = p.pred_home !== null && p.pred_home !== undefined;
            return [p.username, hasPred ? `${p.pred_home}-${p.pred_away}` : '-', hasPred ? (p.total_points ?? 0) : '-', hasPred ? 'Sí' : 'No'];
        });
        const wsSum = XLSX.utils.aoa_to_sheet([sumHeaders, ...sumRows]);
        wsSum['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen');
    }

    const filename = `Pronosticos_${safeName}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// ============================================================
// ADMIN — USER MANAGEMENT
// ============================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>`;
    try {
        const res   = await fetch(`${API_BASE}/admin/users`);
        const users = await res.json();
        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay usuarios.</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td style="text-align:center;">
                    ${u.is_admin
                        ? '<span class="status-chip chip-admin"><i class="fa-solid fa-crown"></i> Admin</span>'
                        : '<span class="status-chip chip-user">Usuario</span>'}
                </td>
                <td style="text-align:center;">
                    ${u.is_active
                        ? '<span class="status-chip chip-open">Activo</span>'
                        : '<span class="status-chip chip-closed">Inactivo</span>'}
                </td>
                <td style="text-align:center;">${u.predictions_count}</td>
                <td style="text-align:center;" class="text-gold"><strong>${u.total_points}</strong></td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="openEditUserModal(${u.id},'${u.username}',${u.is_admin},${u.is_active})" title="Editar">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="confirmDeleteUser(${u.id},'${u.username}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar usuarios.</td></tr>`;
    }
}

function openEditUserModal(userId, username, isAdmin, isActive) {
    document.getElementById('edit-user-id').value            = userId;
    document.getElementById('edit-user-username').value      = username;
    document.getElementById('edit-user-is-admin').checked    = Boolean(isAdmin);
    document.getElementById('edit-user-is-active').checked   = Boolean(isActive);
    document.getElementById('edit-user-msg').style.display       = 'none';
    document.getElementById('change-password-msg').style.display = 'none';
    document.getElementById('edit-user-new-password').value       = '';
    openModal('modal-edit-user');
}

async function handleEditUserSubmit(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const msgEl  = document.getElementById('edit-user-msg');
    msgEl.style.display = 'none';

    const payload = {
        username:  document.getElementById('edit-user-username').value,
        is_admin:  document.getElementById('edit-user-is-admin').checked,
        is_active: document.getElementById('edit-user-is-active').checked
    };

    try {
        const res    = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            msgEl.className = 'alert alert-success';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
            msgEl.style.display = 'flex';
            loadAdminUsers();
        } else {
            msgEl.className = 'alert alert-danger';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
            msgEl.style.display = 'flex';
        }
    } catch(e) {
        msgEl.className = 'alert alert-danger';
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error de conexión.`;
        msgEl.style.display = 'flex';
    }
}

async function handleChangePasswordSubmit(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const msgEl  = document.getElementById('change-password-msg');
    msgEl.style.display = 'none';

    const payload = { new_password: document.getElementById('edit-user-new-password').value };

    try {
        const res    = await fetch(`${API_BASE}/admin/users/${userId}/password`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            msgEl.className = 'alert alert-success';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
            document.getElementById('edit-user-new-password').value = '';
        } else {
            msgEl.className = 'alert alert-danger';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
        }
        msgEl.style.display = 'flex';
    } catch(e) {
        msgEl.className = 'alert alert-danger';
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error de conexión.`;
        msgEl.style.display = 'flex';
    }
}

async function confirmDeleteUser(userId, username) {
    if (!confirm(`¿Seguro que deseas ELIMINAR al usuario "${username}"?\nSe borrarán todos sus pronósticos y puntuaciones.`)) return;
    try {
        const res    = await fetch(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE' });
        const result = await res.json();
        if (res.ok) {
            loadAdminUsers();
        } else {
            alert(result.detail);
        }
    } catch(e) { alert('Error al eliminar usuario.'); }
}

// ============================================================
// ADMIN — SCORING RULES
// ============================================================

async function loadScoringRules() {
    const container = document.getElementById('scoring-rules-fields');
    if (!container) return;
    container.innerHTML = `<p class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>`;
    try {
        const res   = await fetch(`${API_BASE}/admin/scoring-rules`);
        const rules = await res.json();
        container.innerHTML = rules.map(r => `
            <div class="scoring-rule-row">
                <div class="scoring-rule-info">
                    <div class="scoring-rule-label">${r.rule_label}</div>
                    <div class="scoring-rule-desc text-muted text-sm">${r.rule_description}</div>
                </div>
                <div class="scoring-rule-input">
                    <input type="hidden" name="rule_key" value="${r.rule_key}">
                    <label class="text-sm text-muted">Puntos</label>
                    <div class="score-control" style="margin-top:4px;">
                        <button type="button" class="score-btn" onclick="adjustRulePoints('${r.rule_key}', 1)"><i class="fa-solid fa-chevron-up"></i></button>
                        <input type="number" id="rule-pts-${r.rule_key}" class="score-input" value="${r.points}" min="0" max="100" readonly>
                        <button type="button" class="score-btn" onclick="adjustRulePoints('${r.rule_key}', -1)"><i class="fa-solid fa-chevron-down"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<p class="text-center text-danger">Error al cargar reglas.</p>`;
    }
}

function adjustRulePoints(ruleKey, delta) {
    const input = document.getElementById(`rule-pts-${ruleKey}`);
    if (input) input.value = Math.max(0, Math.min(100, parseInt(input.value || 0) + delta));
}

async function handleUpdateScoringRules(event) {
    event.preventDefault();
    const msgEl = document.getElementById('scoring-rules-msg');
    msgEl.style.display = 'none';

    const ruleKeys = ['outcome_correct', 'exact_score', 'home_goals', 'away_goals'];
    const rules = ruleKeys
        .map(k => ({ rule_key: k, points: parseInt(document.getElementById(`rule-pts-${k}`)?.value || 0) }))
        .filter(r => document.getElementById(`rule-pts-${r.rule_key}`));  // only existing ones

    if (!rules.length) {
        msgEl.className = 'alert alert-danger';
        msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> No se encontraron reglas para guardar.`;
        msgEl.style.display = 'flex';
        return;
    }

    const payload = {
        rules,
        recalculate: document.getElementById('scoring-recalculate').checked
    };

    try {
        const res    = await fetch(`${API_BASE}/admin/scoring-rules`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            msgEl.className = 'alert alert-success';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
        } else {
            msgEl.className = 'alert alert-danger';
            msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${result.detail}`;
        }
        msgEl.style.display = 'flex';
    } catch(e) {
        msgEl.className = 'alert alert-danger';
        msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error de conexión.`;
        msgEl.style.display = 'flex';
    }
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function closeModalOnBackdrop(event, modalId) {
    if (event.target.id === modalId) closeModal(modalId);
}

// When showing admin section, reload match listing
const originalShowSection = showSection;
showSection = function(sectionId) {
    originalShowSection(sectionId);
    if (sectionId === 'admin-section') {
        switchAdminTab('partidos');
    } else if (sectionId === 'dashboard-section') {
        updatePointsBadge();
    }
};
