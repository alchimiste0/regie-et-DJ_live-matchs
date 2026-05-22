let scores = { A: 0, B: 0 };
let boxSize = 20;
const uiPeriodStates = ["Échauffement", "Période 1", "Mi-temps", "Période 2", "Prolongation", "Tirs au but"];
const obsPeriodStates = ["ECH.", "P1", "MT", "P2", "PRO.", "TAB"];
let currentPeriodIndex = 0; let timerInterval = null; let timerCurrentSeconds = 0; let timerMaxSeconds = 1200; let isCountdown = false;
let penalties = { A: [], B: [] };

let replayList = []; let replayBufferActive = false; let playQueue = []; let sceneItemIds = {}; let currentLiveScene = "LIVE"; let isLoopingAll = false; 
const mtItemsNormal = ["RESUME", "SCORES_DIRECT", "SCORE", "CLASSEMENT-COMPLET", "POINTEURS-COMPLET", "PUBLICITE1", "PUBLICITE2", "SPONSORS"];
const mtItemsReplay = ["RESUME", "SCORE", "CLASSEMENT-COMPLET", "POINTEURS-COMPLET", "PUBLICITE1", "PUBLICITE2", "SPONSORS", "SCORES_DIRECT"];
let mtFolderIndex = 0; let mtReplayIndex = 0; let currentCycleMode = null; let mtPhase = 'FOLDER'; let cycleTimeout = null;
let teamRoster = { A: [], B: [] }; let graphicTimeouts = {}; let pendingSelectionData = null; let pendingSelectionType = null; 

const sourceNames = {
  sceneName: "LIVE", compoScene: "COMPOSITION", miTempsScene: "MI-TEMPS", miTempsReplayScene: "MI-TEMPS - REPLAY", finMatchScene: "FIN DE MATCH", finMatchReplayScene: "FIN DE MATCH - REPLAY", replayScene: "REPLAY",
  A: "SCORE-VISITEUR", B: "SCORE-DOMICILE", A_Name: "EQUIPE-VISITEUR", B_Name: "EQUIPE-DOMICILE", A_Compo: "COMPO_VISITEUR", B_Compo: "COMPO_DOMICILE", C: "PERIODE", D: "CHRONOMETRE",
  penaltyA_solo: "TEXTE_PEN_VIS_1", penaltyA1: "TEXTE_PEN_VIS_1", penaltyA2: "TEXTE_PEN_VIS_2", penaltyB_solo: "TEXTE_PEN_DOM_1", penaltyB1: "TEXTE_PEN_DOM_1", penaltyB2: "TEXTE_PEN_DOM_2", penaltyImageA: "PEN_VIS1", penaltyImageA2: "PEN_VIS2", penaltyImageB: "PEN_DOM1", penaltyImageB2: "PEN_DOM2",
  replayMediaNormal: "REPLAY_VIDEO", replayMediaMT: "MI-TEMPS VIDEO", replayMediaFin: "FIN VIDEO", replayImageNormal: "IMAGE_REPLAY",
  overlayName: "NOM_JOUEUR", overlayImage: "NOM_JOUEUR_BANDEAU", overlayReseaux: "RESEAUX_SOCIAUX", overlayClassement: "TOP5_CLASSEMENT", overlayPointeurs: "TOP5_POINTEURS", overlayAutresScores: "MATCHS_DIRECT", 
  classEquipes: "CLASSEMENT_EQUIPES_TEXTE", classMJ: "CLASSEMENT_MJ_TEXTE", classPts: "CLASSEMENT_POINTS_TEXTE", classBP: "CLASSEMENT_BP_TEXTE", classBC: "CLASSEMENT_BC_TEXTE", classDiff: "CLASSEMENT_DIFF_TEXTE",
  top5Equipes: "TOP5_EQUIPE_TEXTE", top5PtsEquipes: "TOP5_POINTS_TEXTE", pointJoueurs: "POINTEURS_JOUEURS_TEXTE", pointMJ: "POINTEURS_MJ_TEXTE", pointPts: "POINTEURS_PTS_TEXTE", pointB: "POINTEURS_B_TEXTE", pointA: "POINTEURS_A_TEXTE",
  top5Joueurs: "TOP5_POINTEURS_TEXTE", top5PtsJoueurs: "TOP5_PTS_POINTEURS_TEXTE", resumeDom: "RESUME_TEXTE_DOM", resumeVis: "RESUME_TEXTE_VIS", matchsDirectTexte: "MATCHS_DIRECT_TEXTE"
};
let obs;

function formatTime(totalSeconds) { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return { minutes: String(minutes).padStart(2, '0'), seconds: String(seconds).padStart(2, '0') }; }
function syncTimerDisplayAndOBS() { const time = formatTime(timerCurrentSeconds); document.getElementById('timerMinutes').value = time.minutes; document.getElementById('timerSeconds').value = time.seconds; updateOBSText(sourceNames.D, `${time.minutes}:${time.seconds}`); }
function updatePenaltyOBSText() { ['A', 'B'].forEach(team => { const sortedPenalties = penalties[team].sort((a, b) => a.timeRemaining - b.timeRemaining); const isVis = (team === 'A'); const text1 = isVis ? sourceNames.penaltyA1 : sourceNames.penaltyB1; const img1 = isVis ? sourceNames.penaltyImageA : sourceNames.penaltyImageB; const text2 = isVis ? sourceNames.penaltyA2 : sourceNames.penaltyB2; const img2 = isVis ? sourceNames.penaltyImageA2 : sourceNames.penaltyImageB2; if (sortedPenalties.length >= 1) { const time1 = formatTime(sortedPenalties[0].timeRemaining); setSourceVisibility(text1, true, sourceNames.sceneName); setSourceVisibility(img1, true, sourceNames.sceneName); updateOBSText(text1, `${time1.minutes}:${time1.seconds}`); } else { setSourceVisibility(text1, false, sourceNames.sceneName); setSourceVisibility(img1, false, sourceNames.sceneName); } if (sortedPenalties.length >= 2) { const time2 = formatTime(sortedPenalties[1].timeRemaining); setSourceVisibility(text2, true, sourceNames.sceneName); setSourceVisibility(img2, true, sourceNames.sceneName); updateOBSText(text2, `${time2.minutes}:${time2.seconds}`); } else { setSourceVisibility(text2, false, sourceNames.sceneName); setSourceVisibility(img2, false, sourceNames.sceneName); } }); }
function tick() { if (isCountdown) { if (timerCurrentSeconds > 0) timerCurrentSeconds--; } else { if (timerCurrentSeconds < timerMaxSeconds) timerCurrentSeconds++; } const currentUI = uiPeriodStates[currentPeriodIndex]; if (currentUI !== "Échauffement" && currentUI !== "Mi-temps") { ['A', 'B'].forEach(team => { penalties[team].forEach(p => { if (p.timeRemaining > 0) p.timeRemaining--; }); penalties[team] = penalties[team].filter(p => p.timeRemaining > 0); }); } syncTimerDisplayAndOBS(); renderPenalties(); updatePenaltyOBSText(); if ((isCountdown && timerCurrentSeconds <= 0) || (!isCountdown && timerCurrentSeconds >= timerMaxSeconds)) stopTimer(); }
function renderPenalties() { ['A', 'B'].forEach(team => { const container = document.getElementById('penalties' + team); container.innerHTML = ''; penalties[team].forEach(p => { const time = formatTime(p.timeRemaining); const item = document.createElement('div'); item.className = 'penalty-item'; item.innerHTML = `<div class="penalty-time-inputs"><input type="number" value="${time.minutes}" oninput="manualSetPenaltyTime('${team}', ${p.id}, this)">:<input type="number" value="${time.seconds}" oninput="manualSetPenaltyTime('${team}', ${p.id}, this)"></div><button class="penalty-delete-btn" onclick="deletePenalty('${team}', ${p.id})">🗑️</button>`; container.appendChild(item); }); }); }
function addPenalty(team, minutes) { penalties[team].push({ id: Date.now(), timeRemaining: minutes * 60 }); renderPenalties(); updatePenaltyOBSText(); }
function deletePenalty(team, penaltyId) { penalties[team] = penalties[team].filter(p => p.id !== penaltyId); renderPenalties(); updatePenaltyOBSText(); }
function manualSetPenaltyTime(team, penaltyId, element) { const penalty = penalties[team].find(p => p.id === penaltyId); if (!penalty) return; const inputs = element.parentElement.querySelectorAll('input'); penalty.timeRemaining = (parseInt(inputs[0].value, 10) || 0) * 60 + (parseInt(inputs[1].value, 10) || 0); renderPenalties(); updatePenaltyOBSText(); }
function startTimer() { if (timerInterval) return; const m = parseInt(document.getElementById('maxMinutes').value, 10) || 0; const s = parseInt(document.getElementById('maxSeconds').value, 10) || 0; timerMaxSeconds = (m * 60) + s; if (isCountdown && timerCurrentSeconds === 0) timerCurrentSeconds = timerMaxSeconds; timerInterval = setInterval(tick, 1000); document.getElementById('playPauseBtn').textContent = '❚❚'; document.getElementById('playPauseBtn').classList.replace('start-btn', 'stop-btn'); }
function stopTimer() { clearInterval(timerInterval); timerInterval = null; document.getElementById('playPauseBtn').textContent = '▶'; document.getElementById('playPauseBtn').classList.replace('stop-btn', 'start-btn'); }
function toggleTimer() { if (timerInterval) stopTimer(); else startTimer(); }
function resetTimer() { stopTimer(); if (isCountdown) { const m = parseInt(document.getElementById('maxMinutes').value, 10) || 0; const s = parseInt(document.getElementById('maxSeconds').value, 10) || 0; timerCurrentSeconds = (m * 60) + s; } else timerCurrentSeconds = 0; syncTimerDisplayAndOBS(); }
function manualSetTime() { const oldTime = timerCurrentSeconds; const m = parseInt(document.getElementById('timerMinutes').value, 10) || 0; const s = parseInt(document.getElementById('timerSeconds').value, 10) || 0; timerCurrentSeconds = (m * 60) + s; if (timerCurrentSeconds - oldTime !== 0) updatePenaltiesWithDelta(timerCurrentSeconds - oldTime); updateOBSText(sourceNames.D, `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`); renderPenalties(); updatePenaltyOBSText(); }
function adjustTimer(delta) { const oldTime = timerCurrentSeconds; timerCurrentSeconds = Math.max(0, Math.min(5999, timerCurrentSeconds + delta)); if (timerCurrentSeconds - oldTime !== 0) updatePenaltiesWithDelta(timerCurrentSeconds - oldTime); syncTimerDisplayAndOBS(); renderPenalties(); updatePenaltyOBSText(); }
function updatePenaltiesWithDelta(delta) { ['A', 'B'].forEach(team => { penalties[team].forEach(p => { p.timeRemaining -= isCountdown ? -delta : delta; if (p.timeRemaining < 0) p.timeRemaining = 0; }); penalties[team] = penalties[team].filter(p => p.timeRemaining > 0); }); }
function invertTimerDirection() { isCountdown = !isCountdown; document.getElementById('invertBtn').textContent = isCountdown ? "Mode: Décompte" : "Mode: Chrono"; resetTimer(); }
function setPeriod(index) { currentPeriodIndex = index; document.getElementById("periodDisplay").textContent = uiPeriodStates[currentPeriodIndex]; updateOBSText(sourceNames.C, obsPeriodStates[currentPeriodIndex]); switchScene(sourceNames.sceneName); }
function changePeriod(delta) { setPeriod(Math.max(0, Math.min(uiPeriodStates.length - 1, currentPeriodIndex + delta))); }
function updateTeamName(team, newName) { updateOBSText(team === 'A' ? sourceNames.A_Name : sourceNames.B_Name, newName.toUpperCase()); }
function directChangeScore(team, delta) { scores[team] = Math.max(0, scores[team] + delta); document.getElementById("score" + team).textContent = scores[team]; updateOBSText(sourceNames[team], scores[team]); }
function resizeBoxes(delta) { boxSize = Math.max(0, boxSize + delta); document.querySelectorAll(".zone").forEach(zone => { zone.style.padding = boxSize + "px " + (boxSize * 2) + "px"; }); }
function toggleLayout() { document.body.classList.toggle("horizontal-layout"); }
function switchScene(sceneName) { if (!ensureOBSConnection()) return; if (sceneName !== sourceNames.miTempsScene && sceneName !== sourceNames.miTempsReplayScene) { currentCycleMode = null; clearTimeout(cycleTimeout); } sendReq("SetCurrentProgramScene", { sceneName: sceneName }); currentLiveScene = sceneName; }
function triggerGraphic(sourceName) { setSourceVisibility(sourceName, true, sourceNames.sceneName); if (graphicTimeouts[sourceName]) clearTimeout(graphicTimeouts[sourceName]); graphicTimeouts[sourceName] = setTimeout(() => { setSourceVisibility(sourceName, false, sourceNames.sceneName); }, 5000); }

function handleMiTempsClick() { forceStopReplay(); const useReplay = replayBufferActive && replayList.length > 0; currentCycleMode = useReplay ? 'MT_REPLAY' : 'MT_SIMPLE'; const targetScene = useReplay ? sourceNames.miTempsReplayScene : sourceNames.miTempsScene; switchScene(targetScene); mtFolderIndex = 0; mtReplayIndex = 0; mtPhase = 'FOLDER'; mtItemsNormal.forEach(item => setSourceVisibility(item, false, sourceNames.miTempsScene)); mtItemsReplay.forEach(item => setSourceVisibility(item, false, sourceNames.miTempsReplayScene)); setSourceVisibility(sourceNames.replayMediaMT, false, sourceNames.miTempsReplayScene); if (currentCycleMode === 'MT_SIMPLE') runMiTempsNormalCycle(); else runMiTempsReplayCycle(); }
function runMiTempsNormalCycle() { if (currentCycleMode !== 'MT_SIMPLE') return; const targetScene = sourceNames.miTempsScene; const prevIndex = (mtFolderIndex - 1 + mtItemsNormal.length) % mtItemsNormal.length; setSourceVisibility(mtItemsNormal[prevIndex], false, targetScene); const currentItem = mtItemsNormal[mtFolderIndex]; setSourceVisibility(currentItem, true, targetScene); cycleTimeout = setTimeout(() => { if (currentCycleMode !== 'MT_SIMPLE') return; setSourceVisibility(currentItem, false, targetScene); mtFolderIndex = (mtFolderIndex + 1) % mtItemsNormal.length; runMiTempsNormalCycle(); }, 5000); }
function runMiTempsReplayCycle() { if (currentCycleMode !== 'MT_REPLAY') return; const targetScene = sourceNames.miTempsReplayScene; if (mtPhase === 'FOLDER') { setSourceVisibility(sourceNames.replayMediaMT, false, targetScene); const prevIndex = (mtFolderIndex - 1 + mtItemsReplay.length) % mtItemsReplay.length; setSourceVisibility(mtItemsReplay[prevIndex], false, targetScene); const currentItem = mtItemsReplay[mtFolderIndex]; setSourceVisibility(currentItem, true, targetScene); cycleTimeout = setTimeout(() => { if (currentCycleMode !== 'MT_REPLAY') return; mtPhase = 'REPLAY'; runMiTempsReplayCycle(); }, 5000); } else if (mtPhase === 'REPLAY') { const currentItem = mtItemsReplay[mtFolderIndex]; setSourceVisibility(currentItem, false, targetScene); if (replayList.length === 0) { mtFolderIndex = (mtFolderIndex + 1) % mtItemsReplay.length; mtPhase = 'FOLDER'; runMiTempsReplayCycle(); return; } const nextFile = replayList[mtReplayIndex]; mtReplayIndex = (mtReplayIndex + 1) % replayList.length; sendReq("SetInputSettings", { inputName: sourceNames.replayMediaMT, inputSettings: { local_file: nextFile, is_local_file: true, looping: false, restart_on_activate: true, speed_percent: 60 } }); sendReq("TriggerMediaInputAction", { inputName: sourceNames.replayMediaMT, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" }); sendReq("SetInputMute", { inputName: sourceNames.replayMediaMT, inputMuted: true }); setSourceVisibility(sourceNames.replayMediaMT, true, targetScene); } }
function handleFinMatchClick() { forceStopReplay(); const useReplay = replayBufferActive && replayList.length > 0; if (useReplay) { switchScene(sourceNames.finMatchReplayScene); playQueue = [...replayList]; isLoopingAll = true; playNextVideoContext('FIN_MATCH'); } else { switchScene(sourceNames.finMatchScene); } }

let currentModalAction = null; let currentModalTeam = null; let currentModalDuration = null; let overlayDisplayTimeout = null;
function promptGoal(team) { openPlayerModal('BUT', team, null); }
function openPlayerModal(action, team, penaltyDuration) {
    currentModalAction = action; currentModalTeam = team; currentModalDuration = penaltyDuration;
    const teamName = document.getElementById(team === 'A' ? "visName" : "domName").value;
    document.getElementById("modal-title").textContent = action === 'BUT' ? `BUT POUR ${teamName} !` : `PÉNALITÉ DE ${penaltyDuration} MIN`;
    const grid = document.getElementById("player-grid"); grid.innerHTML = ""; const players = teamRoster[team] || [];
    if (players.length === 0) { const btn = document.createElement("button"); btn.textContent = "Équipe (Aucun joueur chargé)"; btn.onclick = () => submitPlayerAction("Équipe", ""); grid.appendChild(btn); } 
    else { players.forEach(p => { const btn = document.createElement("button"); btn.innerHTML = `<b>${p.num}</b><br>${p.nom}`; btn.className = p.type === 'S' ? "staff-btn" : ""; btn.onclick = () => submitPlayerAction(p.nom, p.num); grid.appendChild(btn); }); const btnInc = document.createElement("button"); btnInc.innerHTML = `<b>?</b><br>Inconnu / Équipe`; btnInc.className = "staff-btn"; btnInc.onclick = () => submitPlayerAction("Équipe", ""); grid.appendChild(btnInc); }
    document.getElementById("player-modal").style.display = "flex";
}
function promptTimeout() { currentModalAction = 'TIMEOUT'; document.getElementById("modal-title").textContent = "TEMPS MORT DEMANDÉ PAR :"; const grid = document.getElementById("player-grid"); grid.innerHTML = ""; ['domName', 'visName'].forEach(id => { const name = document.getElementById(id).value || (id === 'domName' ? 'Domicile' : 'Visiteur'); const btn = document.createElement("button"); btn.innerHTML = `<b style="font-size:18px;">${name}</b>`; btn.style.padding = "20px"; btn.onclick = () => submitTimeoutAction(name); grid.appendChild(btn); }); document.getElementById("player-modal").style.display = "flex"; }
function closePlayerModal() { document.getElementById("player-modal").style.display = "none"; }
function submitPlayerAction(nom, num) { closePlayerModal(); const overlayText = `${currentModalAction} - ${nom} ${num ? `n°${num}` : ""}`.trim(); if (currentModalAction === 'BUT') directChangeScore(currentModalTeam, 1); else if (currentModalAction === 'PEN') { penalties[currentModalTeam].push({ id: Date.now(), timeRemaining: currentModalDuration * 60 }); renderPenalties(); updatePenaltyOBSText(); } triggerOverlay(overlayText); }
function submitTimeoutAction(teamName) { closePlayerModal(); if (timerInterval) stopTimer(); triggerOverlay(`TEMPS MORT - ${teamName}`); }
function promptPenalty(team, duration) { openPlayerModal('PEN', team, duration); }
function triggerOverlay(text) { updateOBSText(sourceNames.overlayName, text.toUpperCase()); setSourceVisibility(sourceNames.overlayImage, true, sourceNames.sceneName); setSourceVisibility(sourceNames.overlayName, true, sourceNames.sceneName); clearTimeout(overlayDisplayTimeout); overlayDisplayTimeout = setTimeout(() => { setSourceVisibility(sourceNames.overlayImage, false, sourceNames.sceneName); setSourceVisibility(sourceNames.overlayName, false, sourceNames.sceneName); }, 6000); }

function openSelectionModal(title, options) { document.getElementById("pool-modal-title").innerText = title; const grid = document.getElementById("pool-grid"); grid.innerHTML = ""; options.forEach(opt => { const btn = document.createElement("button"); btn.innerHTML = `<b style="font-size:16px;">${opt.label}</b>`; btn.style.padding = "15px 5px"; if(opt.color) { btn.style.backgroundColor = opt.color; btn.style.gridColumn = "1 / -1"; } btn.onclick = () => submitSelection(opt.value); grid.appendChild(btn); }); document.getElementById("pool-modal").style.display = "flex"; document.getElementById("rolskanet-status").innerText = "⏳ En attente de la sélection..."; }
function closePoolModal() { document.getElementById("pool-modal").style.display = "none"; pendingSelectionData = null; pendingSelectionType = null; document.getElementById("rolskanet-status").innerText = "❌ Import annulé."; }
function submitSelection(selectedValue) { document.getElementById("pool-modal").style.display = "none"; if(!pendingSelectionData) return; if (pendingSelectionType === 'classement') { let filtered = pendingSelectionData.filter(d => d.pool === selectedValue); processClassement(filtered); } else if (pendingSelectionType === 'pointeurs') { let filtered = pendingSelectionData; if (selectedValue !== "TOUT") { filtered = pendingSelectionData.filter(d => d.eq === selectedValue); } processPointeurs(filtered); } pendingSelectionData = null; pendingSelectionType = null; }

function updateReplayBtnUI() { const btn = document.getElementById("toggleReplayBtn"); const content = document.getElementById("replay-content"); if (replayBufferActive) { btn.textContent = "⏹️ Désactiver le Replay Buffer"; btn.classList.replace("start-btn", "stop-btn"); content.className = "replay-content-active"; } else { btn.textContent = "▶️ Activer le Replay Buffer"; btn.classList.replace("stop-btn", "start-btn"); content.className = "replay-content-hidden"; } }
function toggleReplayBuffer() { sendReq(replayBufferActive ? "StopReplayBuffer" : "StartReplayBuffer"); }
function saveReplay() { sendReq("SaveReplayBuffer"); document.getElementById("saveReplayBtn").textContent = "⏳ Capture en cours..."; }
function playReplays(paths) { if (!ensureOBSConnection() || paths.length === 0) return; forceStopReplay(); playQueue = [...paths]; switchScene(sourceNames.replayScene); setSourceVisibility(sourceNames.replayImageNormal, true, sourceNames.replayScene); playNextVideoContext('NORMAL'); }
function playNextVideoContext(context) { const mediaSource = context === 'NORMAL' ? sourceNames.replayMediaNormal : sourceNames.replayMediaFin; const scene = context === 'NORMAL' ? sourceNames.replayScene : sourceNames.finMatchReplayScene; if (playQueue.length > 0) { const nextFile = playQueue.shift(); sendReq("SetInputSettings", { inputName: mediaSource, inputSettings: { local_file: nextFile, is_local_file: true, looping: false, restart_on_activate: true, speed_percent: 60 } }); sendReq("TriggerMediaInputAction", { inputName: mediaSource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" }); sendReq("SetInputMute", { inputName: mediaSource, inputMuted: true }); setSourceVisibility(mediaSource, true, scene); } else { const isLoopChecked = document.getElementById("loopReplaysCheckbox").checked; if ((context === 'NORMAL' && isLoopingAll && isLoopChecked && replayList.length > 0) || (context === 'FIN_MATCH' && replayList.length > 0)) { playQueue = [...replayList]; playNextVideoContext(context); } else { hideReplayOnStream(context); } } }
function playLastReplay() { if (replayList.length > 0) { isLoopingAll = false; playReplays([replayList[replayList.length - 1]]); } else alert("Aucune vidéo capturée !"); }
function playAllReplays() { if (replayList.length > 0) { isLoopingAll = true; playReplays(replayList); } else alert("Liste vide !"); }
function clearReplays() { replayList = []; playQueue = []; document.getElementById("replayCount").innerText = "0"; document.getElementById("deleteBtn").textContent = "✅ Vidé !"; setTimeout(() => { document.getElementById("deleteBtn").textContent = "🗑️ Vider la liste"; }, 1500); }
function hideReplayOnStream(context = 'NORMAL') { const mediaSource = context === 'NORMAL' ? sourceNames.replayMediaNormal : sourceNames.replayMediaFin; const scene = context === 'NORMAL' ? sourceNames.replayScene : sourceNames.finMatchReplayScene; playQueue = []; isLoopingAll = false; sendReq("TriggerMediaInputAction", { inputName: mediaSource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }); setSourceVisibility(mediaSource, false, scene); if (context === 'NORMAL') { setSourceVisibility(sourceNames.replayImageNormal, false, scene); if (currentLiveScene === sourceNames.replayScene) switchScene(sourceNames.sceneName); } }
function forceStopReplay() { playQueue = []; isLoopingAll = false; currentCycleMode = null; clearTimeout(cycleTimeout); sendReq("TriggerMediaInputAction", { inputName: sourceNames.replayMediaNormal, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }); sendReq("TriggerMediaInputAction", { inputName: sourceNames.replayMediaFin, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }); sendReq("TriggerMediaInputAction", { inputName: sourceNames.replayMediaMT, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }); mtItemsNormal.forEach(item => setSourceVisibility(item, false, sourceNames.miTempsScene)); mtItemsReplay.forEach(item => setSourceVisibility(item, false, sourceNames.miTempsReplayScene)); if (currentLiveScene === sourceNames.replayScene) { setSourceVisibility(sourceNames.replayImageNormal, false, sourceNames.replayScene); switchScene(sourceNames.sceneName); } else if (currentLiveScene === sourceNames.finMatchReplayScene) { switchScene(sourceNames.finMatchScene); } else if (currentLiveScene === sourceNames.miTempsReplayScene) { switchScene(sourceNames.miTempsScene); } }

function sendReq(type, data = {}, reqId = null) { if (!ensureOBSConnection()) return; obs.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: reqId || (type + Date.now()), requestData: data } })); }
function connectOBS() {
    obs = new WebSocket("ws://localhost:4455");
    obs.onmessage = (event) => {
        const p = JSON.parse(event.data);
        if (p.op === 0) obs.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
        else if (p.op === 2) { console.log("✅ Connecté à OBS"); updateOBSText(sourceNames.C, obsPeriodStates[currentPeriodIndex]); syncTimerDisplayAndOBS(); updatePenaltyOBSText(); sendReq("GetReplayBufferStatus", {}, "init-replay-status"); } 
        else if (p.op === 5) {
            const t = p.d.eventType; const d = p.d.eventData;
            if (t === "ReplayBufferStateChanged") { replayBufferActive = d.outputActive; updateReplayBtnUI(); } 
            else if (t === "ReplayBufferSaved") { if (d.savedReplayPath && !replayList.includes(d.savedReplayPath)) { replayList.push(d.savedReplayPath); document.getElementById("replayCount").innerText = replayList.length; document.getElementById("saveReplayBtn").textContent = "✅ Action capturée !"; setTimeout(() => { document.getElementById("saveReplayBtn").textContent = "📸 Capturer l'action !"; }, 2000); } } 
            else if (t === "MediaInputPlaybackEnded") { 
                if (d.inputName === sourceNames.replayMediaNormal) playNextVideoContext('NORMAL'); else if (d.inputName === sourceNames.replayMediaFin) playNextVideoContext('FIN_MATCH');
                else if (d.inputName === sourceNames.replayMediaMT) { if (currentCycleMode === 'MT_REPLAY') { setSourceVisibility(sourceNames.replayMediaMT, false, sourceNames.miTempsReplayScene); mtFolderIndex = (mtFolderIndex + 1) % mtItemsReplay.length; mtPhase = 'FOLDER'; runMiTempsReplayCycle(); } }
            }
        } 
        else if (p.op === 7) {
            if (!p.d.requestStatus.result) return;
            if (p.d.requestId === "init-replay-status") { replayBufferActive = p.d.responseData.outputActive; updateReplayBtnUI(); } 
            else if (p.d.requestId.startsWith("getid:::")) { const pts = p.d.requestId.split(":::"); sceneItemIds[pts[1] + ":::" + pts[2]] = p.d.responseData.sceneItemId; sendReq("SetSceneItemEnabled", { sceneName: pts[1], sceneItemId: p.d.responseData.sceneItemId, sceneItemEnabled: pts[3] === "true" }); }
        }
    };
    obs.onerror = err => console.error("❌ Erreur OBS :", err);
    obs.onclose = () => setTimeout(connectOBS, 3000);
}
function ensureOBSConnection() { return (obs && obs.readyState === WebSocket.OPEN); }
function setSourceVisibility(sourceName, isVisible, targetScene) { if (!targetScene) return; const cacheKey = targetScene + ":::" + sourceName; if (sceneItemIds[cacheKey] !== undefined) sendReq("SetSceneItemEnabled", { sceneName: targetScene, sceneItemId: sceneItemIds[cacheKey], sceneItemEnabled: isVisible }); else sendReq("GetSceneItemId", { sceneName: targetScene, sourceName: sourceName }, "getid:::" + targetScene + ":::" + sourceName + ":::" + isVisible); }
function updateOBSText(sourceName, newText) { sendReq("SetInputSettings", { inputName: sourceName, inputSettings: { text: String(newText) } }); }

const cleanTeamName = (name) => { if (!name) return ""; let clean = name.replace(/^\d{5}\s*[-]?\s*/, ''); clean = clean.replace(/^\d+\s*-\s*/, ''); clean = clean.replace(/\s*-?\s*(ELITE|N[1-4]|N\s*[1-4]|PRENAT|NAT).*$/i, ''); return clean.trim(); };
const formatMatchLine = (dom, scoreDom, scoreVis, vis) => { let leftText = `${dom} ${scoreDom}`; let rightText = `${scoreVis} ${vis}`; let diff = leftText.length - rightText.length; const padChar = '\xA0'; if (diff > 0) rightText += padChar.repeat(diff); else if (diff < 0) leftText = padChar.repeat(Math.abs(diff)) + leftText; return `${leftText} - ${rightText}`; };
function openAllRolskanetPages() { window.open('https://rolskanet.fr/sportif/synthese/rencontres/LH', '_blank'); window.open('https://rolskanet.fr/sportif/synthese/classements/LH', '_blank'); window.open('https://rolskanet.fr/sportif/statistiques/LH', '_blank'); }
function processClassement(data) { let strEq = "", strMj = "", strPts = "", strBp = "", strBc = "", strDiff = "", strTop5Eq = "", strTop5Pts = ""; data.slice(0, 10).forEach(t => { let teamName = cleanTeamName(t.eq); strEq += `${t.pos} - ${teamName}\n`; strMj += `${t.mj}\n`; strPts += `${t.pts}\n`; strBp += `${t.bp}\n`; strBc += `${t.bc}\n`; strDiff += `${t.diff}\n`; }); data.slice(0, 5).forEach(t => { strTop5Eq += `${t.pos} - ${cleanTeamName(t.eq)}\n`; strTop5Pts += `${t.pts}\n`; }); updateOBSText(sourceNames.classEquipes, strEq.trim()); updateOBSText(sourceNames.classMJ, strMj.trim()); updateOBSText(sourceNames.classPts, strPts.trim()); updateOBSText(sourceNames.classBP, strBp.trim()); updateOBSText(sourceNames.classBC, strBc.trim()); updateOBSText(sourceNames.classDiff, strDiff.trim()); updateOBSText(sourceNames.top5Equipes, strTop5Eq.trim()); updateOBSText(sourceNames.top5PtsEquipes, strTop5Pts.trim()); document.getElementById("rolskanet-status").innerText = "✅ TOP 10 et TOP 5 Classement mis à jour !"; }
function processPointeurs(data) { let strJ = "", strMj = "", strPts = "", strB = "", strA = "", strTop5J = "", strTop5PtsJ = ""; data.slice(0, 10).forEach((p, idx) => { let rank = p.pos ? p.pos : (idx + 1); strJ += `${rank} - ${p.j}\n`; strMj += `${p.mj}\n`; strPts += `${p.pts}\n`; strB += `${p.b}\n`; strA += `${p.a}\n`; }); data.slice(0, 5).forEach((p, idx) => { let rank = p.pos ? p.pos : (idx + 1); strTop5J += `${rank} - ${p.j}\n`; strTop5PtsJ += `${p.pts}\n`; }); updateOBSText(sourceNames.pointJoueurs, strJ.trim()); updateOBSText(sourceNames.pointMJ, strMj.trim()); updateOBSText(sourceNames.pointPts, strPts.trim()); updateOBSText(sourceNames.pointB, strB.trim()); updateOBSText(sourceNames.pointA, strA.trim()); updateOBSText(sourceNames.top5Joueurs, strTop5J.trim()); updateOBSText(sourceNames.top5PtsJoueurs, strTop5PtsJ.trim()); document.getElementById("rolskanet-status").innerText = "✅ TOP 10 et TOP 5 Pointeurs mis à jour !"; }
function fetchRolskanetData() { const input = document.getElementById("rolskanetId").value.trim(); if (!input) return alert("Veuillez coller le code JSON..."); const statusText = document.getElementById("rolskanet-status"); statusText.style.color = "yellow"; statusText.innerText = "⏳ Analyse en cours..."; try { if (!input.startsWith("{") && !input.startsWith("[")) throw new Error("Format invalide."); const parsedData = JSON.parse(input); if (parsedData.data && Array.isArray(parsedData.data) && parsedData.data[0] && parsedData.data[0].receveur && parsedData.data[0].visiteur) { let strMatchs = ""; let targetDate = ""; if (parsedData.data[0].infosRencontre && parsedData.data[0].infosRencontre.date_rencontre) targetDate = parsedData.data[0].infosRencontre.date_rencontre.split(' ')[0]; let filteredMatches = parsedData.data; if (targetDate) filteredMatches = parsedData.data.filter(m => m.infosRencontre && m.infosRencontre.date_rencontre && m.infosRencontre.date_rencontre.startsWith(targetDate)); filteredMatches.slice(0, 10).forEach(m => { let dom = cleanTeamName(m.receveur.libelle_court || m.receveur.libelle); let vis = cleanTeamName(m.visiteur.libelle_court || m.visiteur.libelle); let scoreDom = 0, scoreVis = 0; if (m.score && Array.isArray(m.score)) { let sD = m.score.find(s => s.equipe_id === m.receveur.id); let sV = m.score.find(s => s.equipe_id === m.visiteur.id); if(sD) scoreDom = sD.score; if(sV) scoreVis = sV.score; } strMatchs += formatMatchLine(dom, scoreDom, scoreVis, vis) + '\n'; }); updateOBSText(sourceNames.matchsDirectTexte, strMatchs.trim() || "Aucun match lu."); document.getElementById("rolskanetId").value = ""; statusText.style.color = "#1ed760"; statusText.innerText = "✅ Matchs en direct mis à jour (Alignés) !"; return; } if (parsedData._source === "bookmarklet") { if (parsedData.type === "live") { const pd = parsedData.data; const domName = cleanTeamName(pd.receveur.libelle_court || pd.receveur.libelle); const visName = cleanTeamName(pd.visiteur.libelle_court || pd.visiteur.libelle); document.getElementById("domName").value = domName; document.getElementById("visName").value = visName; updateTeamName('B', domName); updateTeamName('A', visName); let scoreDom = 0; let scoreVis = 0; if (pd.scores) { pd.scores.forEach(s => { if (s.equipe_id === pd.receveur.id) scoreDom = s.score; if (s.equipe_id === pd.visiteur.id) scoreVis = s.score; }); } scores.B = scoreDom; document.getElementById("scoreB").textContent = scoreDom; updateOBSText(sourceNames.B, scoreDom); scores.A = scoreVis; document.getElementById("scoreA").textContent = scoreVis; updateOBSText(sourceNames.A, scoreVis); if (pd.evenements) { const buildResume = (teamId) => { let penCount = pd.evenements.filter(e => e.type === "PENALITE" && e.equipe && e.equipe.id === teamId).length; let goals = pd.evenements.filter(e => e.type === "BUT" && e.equipe && e.equipe.id === teamId).sort((a,b) => a.temps - b.temps); let str = `Nombre de pénalité(s): ${penCount}\nNombre de but(s): ${goals.length}\n\n`; goals.forEach(g => { let m = String(Math.floor(g.temps / 60)).padStart(2, '0'); let s = String(g.temps % 60).padStart(2, '0'); let nom = g.buteur ? g.buteur.nom_complet.replace(/^(M |Mme )/, "") : "Inconnu"; str += `${m}:${s} - ${nom}\n`; }); return str.trim(); }; updateOBSText(sourceNames.resumeDom, buildResume(pd.receveur.id)); updateOBSText(sourceNames.resumeVis, buildResume(pd.visiteur.id)); } const jDom = pd.joueurs.filter(j => j.equipe_id === pd.receveur.id); const jVis = pd.joueurs.filter(j => j.equipe_id === pd.visiteur.id); const sDom = pd.staffs ? pd.staffs.filter(s => s.equipe_id === pd.receveur.id) : []; const sVis = pd.staffs ? pd.staffs.filter(s => s.equipe_id === pd.visiteur.id) : []; const sortByNum = (a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0); jDom.sort(sortByNum); jVis.sort(sortByNum); const formatNom = (nom) => nom.replace(/^(M |Mme )/, ""); teamRoster.B = jDom.map(j => ({ nom: formatNom(j.nom_complet), num: j.numero || "0", type: "J" })); teamRoster.B.push(...sDom.map(s => ({ nom: formatNom(s.nom_complet), num: "Staff", type: "S" }))); teamRoster.A = jVis.map(j => ({ nom: formatNom(j.nom_complet), num: j.numero || "0", type: "J" })); teamRoster.A.push(...sVis.map(s => ({ nom: formatNom(s.nom_complet), num: "Staff", type: "S" }))); const buildCompo = (joueurs, staffs) => { let str = ""; joueurs.forEach(j => { let attr = ""; if(j.attributs && j.attributs.length > 0) { if(j.attributs[0].code === "CA") attr = " (C)"; if(j.attributs[0].code === "ASS") attr = " (A)"; } str += `${j.numero || "0"} - ${formatNom(j.nom_complet)}${attr}\n`; }); staffs.forEach(s => { let role = s.attributs && s.attributs.length > 0 ? s.attributs[0].libelle : "Staff"; str += `${role} - ${formatNom(s.nom_complet)}\n`; }); return str.trim(); }; updateOBSText(sourceNames.B_Compo, buildCompo(jDom, sDom)); updateOBSText(sourceNames.A_Compo, buildCompo(jVis, sVis)); statusText.innerText = "✅ Match : Compos et Résumé mis à jour !"; } else if (parsedData.type === "classement") { let pools = [...new Set(parsedData.data.map(d => d.pool || "Poule 1"))]; if (pools.length > 1) { pendingSelectionType = 'classement'; pendingSelectionData = parsedData.data; openSelectionModal("Plusieurs poules détectées ! Sélectionnez celle à afficher :", pools.map(p => ({ label: p, value: p }))); } else { processClassement(parsedData.data); } } else if (parsedData.type === "pointeurs") { let teams = [...new Set(parsedData.data.map(d => d.eq).filter(Boolean))]; if (teams.length > 0) { let options = [{ label: "TOUT (Global)", value: "TOUT", color: "#28a745" }]; teams.forEach(t => options.push({ label: cleanTeamName(t), value: t })); pendingSelectionType = 'pointeurs'; pendingSelectionData = parsedData.data; openSelectionModal("Sélectionnez l'équipe pour les statistiques :", options); } else { processPointeurs(parsedData.data); } } else if (parsedData.type === "rencontres") { let strMatchs = ""; parsedData.data.slice(0, 10).forEach(m => { let dom = cleanTeamName(m.tA); let vis = cleanTeamName(m.tB); strMatchs += formatMatchLine(dom, m.sA, m.sB, vis) + '\n'; }); updateOBSText(sourceNames.matchsDirectTexte, strMatchs.trim() || "Aucun match lu."); statusText.innerText = "✅ Matchs en direct mis à jour (Alignés) !"; } } else { throw new Error("Format invalide ou non reconnu."); } document.getElementById("rolskanetId").value = ""; } catch (error) { console.error(error); statusText.style.color = "#ff4d4d"; statusText.innerHTML = `❌ Erreur : ${error.message}`; } }

// ==========================================
// --- MODULE DJ SPOTIFY & WEB APP ---
// ==========================================

const SPOTIFY_CLIENT_ID = "5bc17dabfc0945b7b6ba5ee2989a25f1"; 
// S'adapte automatiquement à l'adresse exacte où tu te trouves (en local ou sur GitHub Pages)
const SPOTIFY_REDIRECT_URI = window.location.origin + window.location.pathname;
const SPOTIFY_SCOPES = ["user-modify-playback-state", "user-read-playback-state", "playlist-read-private", "playlist-read-collaborative"];

let spotifyPlaylists = []; let spotifyPlaylistsMap = {}; 
let customMappings = JSON.parse(localStorage.getItem('obs_spotify_custom_maps') || '[]');
const FAVORIS_KEY = "obs_spotify_favoris";
let favoris_playlists = new Set(JSON.parse(localStorage.getItem(FAVORIS_KEY) || "[]"));
let webAppActive = false;
let playerPollInterval = null;
let currentUser = null;
let filtre_actif = 'tous';
let currentTrackUri = null;
let currentPlaylistUri = null;

function generateRandomString(length) { let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < length; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); } return text; }
async function generateCodeChallenge(v) { const d = new TextEncoder().encode(v); const h = await window.crypto.subtle.digest('SHA-256', d); return btoa(String.fromCharCode.apply(null, new Uint8Array(h))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function redirectToAuthCodeFlow() { const v = generateRandomString(128); const c = await generateCodeChallenge(v); localStorage.setItem("obs_spotify_verifier", v); const p = new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: SPOTIFY_REDIRECT_URI, scope: SPOTIFY_SCOPES.join(' '), code_challenge_method: 'S256', code_challenge: c }); document.location = `https://accounts.spotify.com/authorize?${p.toString()}`; }
async function getSpotifyToken(c) { const v = localStorage.getItem("obs_spotify_verifier"); const p = new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: c, redirect_uri: SPOTIFY_REDIRECT_URI, code_verifier: v }); const r = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: p }); if (!r.ok) throw new Error("Impossible de générer le token"); const { access_token, refresh_token } = await r.json(); return { access_token, refresh_token }; }
async function refreshSpotifyToken() { const r = localStorage.getItem('obs_spotify_refresh'); if(!r) throw new Error("Aucun refresh token"); const p = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: r, client_id: SPOTIFY_CLIENT_ID }); const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: p }); if (!res.ok) { localStorage.removeItem('obs_spotify_access'); localStorage.removeItem('obs_spotify_refresh'); throw new Error("Token expiré."); } const { access_token, refresh_token: n } = await res.json(); if (n) { localStorage.setItem('obs_spotify_refresh', n); } localStorage.setItem('obs_spotify_access', access_token); return access_token; }

async function fetchSpotifyApi(endpoint, method = 'GET', body = null, isRetry = false) {
    let token = localStorage.getItem('obs_spotify_access');
    const res = await fetch(`https://api.spotify.com/v1/${endpoint}`, { headers: { Authorization: `Bearer ${token}` }, method, body: body ? JSON.stringify(body) : null });
    if (res.status === 401 && !isRetry) { await refreshSpotifyToken(); return await fetchSpotifyApi(endpoint, method, body, true); }
    if (!res.ok) throw new Error(`Erreur Spotify API ${res.status}`);
    if (res.status === 204 || res.status === 202) return null;
    return await res.json();
}

// Replier/Déplier la config Spotify
function toggleSpotifyConfig() {
    const content = document.getElementById('spotify-config-content');
    const chevron = document.getElementById('spotify-config-chevron');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.textContent = '▲';
    } else {
        content.style.display = 'none';
        chevron.textContent = '▼';
    }
}

async function loadSpotifyPlaylists() {
    try {
        const data = await fetchSpotifyApi('me/playlists?limit=50');
        if (data && data.items) {
            spotifyPlaylists = data.items.filter(pl => pl !== null);
            spotifyPlaylists.forEach(pl => { spotifyPlaylistsMap[pl.uri] = { name: pl.name, image: (pl.images && pl.images.length > 0) ? pl.images[0].url : 'https://placehold.co/150x150/282828/1DB954?text=🎵' }; });
            updateAllSelects(); renderCustomMappings(); renderQuickLaunch();
            if(webAppActive) appliquerFiltre(filtre_actif);
            document.getElementById('spotify-status').innerText = "✅ Playlists chargées.";
        }
    } catch (e) { console.error("Erreur chargement playlists", e); }
}

function updateAllSelects() {
    const defaultKeys = ['goal', 'penalty', 'reprise', 'lancement'];
    const optionsHtml = '<option value="">-- Aucune playlist --</option>' + spotifyPlaylists.map(pl => `<option value="${pl.uri}">${pl.name}</option>`).join('');
    defaultKeys.forEach(k => { const el = document.getElementById(`map-${k}`); if(el) { el.innerHTML = optionsHtml; const savedUri = localStorage.getItem(`obs_spotify_map_${k}`); if(savedUri) el.value = savedUri; } });
}
function saveSpotifyMap(key, uri) { if(uri === "") localStorage.removeItem(`obs_spotify_map_${key}`); else localStorage.setItem(`obs_spotify_map_${key}`, uri); renderQuickLaunch(); }
function getPlaylistImage(uri) { return spotifyPlaylistsMap[uri] ? spotifyPlaylistsMap[uri].image : 'https://placehold.co/150x150/282828/1DB954?text=🎵'; }

function renderQuickLaunch() {
    const container = document.getElementById('quick-launch-container'); container.innerHTML = '';
    const defaults = [{ id: 'goal', label: 'But' }, { id: 'penalty', label: 'Pénalité' }];
    defaults.forEach(k => {
        const uri = localStorage.getItem(`obs_spotify_map_${k.id}`);
        const img = uri ? getPlaylistImage(uri) : 'https://placehold.co/150x150/282828/1DB954?text=🎵';
        const btn = document.createElement('button'); btn.className = 'quick-launch-btn'; btn.title = k.label;
        btn.innerHTML = `<img src="${img}" alt="${k.label}">`;
        btn.onclick = () => playSpotifyUri(uri, k.label); container.appendChild(btn);
    });
    const moreBtn = document.createElement('button'); moreBtn.className = 'quick-launch-btn more-btn'; moreBtn.title = "Autres sons";
    moreBtn.innerHTML = `<div>+</div>`; moreBtn.onclick = () => openSpotifyExtraModal(); container.appendChild(moreBtn);
}

function saveCustomMappings() { localStorage.setItem('obs_spotify_custom_maps', JSON.stringify(customMappings)); if (document.getElementById('spotify-extra-modal').style.display === 'flex') { openSpotifyExtraModal(); } }
function addCustomMapping() { customMappings.push({ id: Date.now(), name: 'Nouveau son', uri: '' }); saveCustomMappings(); renderCustomMappings(); }
function deleteCustomMapping(id) { customMappings = customMappings.filter(m => m.id !== id); saveCustomMappings(); renderCustomMappings(); }
function updateCustomMapping(id, field, value) { const map = customMappings.find(m => m.id === id); if(map) { map[field] = value; saveCustomMappings(); } }
function renderCustomMappings() {
    const container = document.getElementById('custom-mappings-container'); container.innerHTML = '';
    const optionsHtml = '<option value="">-- Choisir une playlist --</option>' + spotifyPlaylists.map(pl => `<option value="${pl.uri}">${pl.name}</option>`).join('');
    customMappings.forEach(m => {
        const row = document.createElement('div'); row.className = 'mapping-row custom-map-row';
        const input = document.createElement('input'); input.type = 'text'; input.value = m.name; input.placeholder = "Nom du son"; input.onchange = (e) => updateCustomMapping(m.id, 'name', e.target.value);
        const select = document.createElement('select'); select.innerHTML = optionsHtml; select.value = m.uri; select.onchange = (e) => updateCustomMapping(m.id, 'uri', e.target.value);
        const delBtn = document.createElement('button'); delBtn.innerText = '❌'; delBtn.className = 'del-map-btn'; delBtn.title = "Supprimer"; delBtn.onclick = () => deleteCustomMapping(m.id);
        row.appendChild(input); row.appendChild(select); row.appendChild(delBtn); container.appendChild(row);
    });
}

function openSpotifyExtraModal() {
    const grid = document.getElementById('spotify-extra-grid'); grid.innerHTML = '';
    const extraDefaults = [{ id: 'reprise', label: 'Reprise MT' }, { id: 'lancement', label: 'Lancement' }];
    extraDefaults.forEach(k => {
        const uri = localStorage.getItem(`obs_spotify_map_${k.id}`); const img = uri ? getPlaylistImage(uri) : 'https://placehold.co/150x150/282828/1DB954?text=🎵';
        const btn = document.createElement('button'); btn.className = 'modal-launch-btn';
        btn.innerHTML = `<img src="${img}" alt="${k.label}"><span>${k.label}</span>`;
        btn.onclick = () => { playSpotifyUri(uri, k.label); closeSpotifyExtraModal(); }; grid.appendChild(btn);
    });
    customMappings.forEach(m => {
        const img = m.uri ? getPlaylistImage(m.uri) : 'https://placehold.co/150x150/282828/1DB954?text=🎵';
        const btn = document.createElement('button'); btn.className = 'modal-launch-btn';
        btn.innerHTML = `<img src="${img}" alt="${m.name}"><span>${m.name}</span>`;
        btn.onclick = () => { playSpotifyUri(m.uri, m.name); closeSpotifyExtraModal(); }; grid.appendChild(btn);
    });
    document.getElementById('spotify-extra-modal').style.display = 'flex';
}
function closeSpotifyExtraModal() { document.getElementById('spotify-extra-modal').style.display = 'none'; }

async function playSpotifyUri(uri, contextName) {
    const statusEl = document.getElementById('spotify-status');
    if(!uri) { statusEl.innerText = "❌ Action annulée : Aucune playlist sélectionnée."; setTimeout(() => statusEl.innerText = "", 3000); return; }
    try { await fetchSpotifyApi('me/player/play', 'PUT', { context_uri: uri }); statusEl.innerText = `🎵 Lecture envoyée : ${contextName}`; setTimeout(() => statusEl.innerText = "", 3000); } 
    catch (e) { statusEl.innerText = "❌ Erreur 404 : Aucun appareil actif. Ouvrez l'appli Spotify !"; setTimeout(() => statusEl.innerText = "", 5000); }
}

async function toggleSpotifyPlayPause() {
    const statusEl = document.getElementById('spotify-status');
    try {
        const state = await fetchSpotifyApi('me/player');
        if (state && state.is_playing) { await fetchSpotifyApi('me/player/pause', 'PUT'); statusEl.innerText = "⏸️ Musique en pause"; } 
        else { await fetchSpotifyApi('me/player/play', 'PUT'); statusEl.innerText = "▶️ Musique relancée"; }
        setTimeout(() => statusEl.innerText = "", 3000);
    } catch (e) { statusEl.innerText = "❌ Erreur 404 : Aucun appareil actif !"; setTimeout(() => statusEl.innerText = "", 5000); }
}

// -----------------------------------------
// POLLING GLOBAL (POUR LE CONTROLEUR ET LA WEB APP)
// -----------------------------------------
function startPlayerPolling() {
    if(playerPollInterval) clearInterval(playerPollInterval);
    playerPollInterval = setInterval(async () => {
        if (!localStorage.getItem('obs_spotify_access')) return;
        try { const state = await fetchSpotifyApi('me/player'); updateGlobalPlayerUI(state); } catch(e) {}
    }, 1000);
}

function updateGlobalPlayerUI(state) {
    // 1. MAJ du texte en vert sur le Contrôleur
    const ctrlNp = document.getElementById('controller-now-playing');
    if (!state || !state.item) {
        if(ctrlNp) ctrlNp.style.display = 'none';
    } else {
        if(ctrlNp) {
            ctrlNp.style.display = 'block';
            document.getElementById('controller-np-track').textContent = state.item.name;
            let contextName = state.item.artists[0].name;
            if (state.context && state.context.uri && spotifyPlaylistsMap[state.context.uri]) {
                contextName = spotifyPlaylistsMap[state.context.uri].name;
            }
            document.getElementById('controller-np-playlist').textContent = " - " + contextName;
        }
    }
    // 2. MAJ de la Web App
    if(webAppActive) updateWebAppPlayerUI(state);
}

// -----------------------------------------
// INTÉGRATION SPOTIFY WEB APP (Moitié Droite)
// -----------------------------------------
function toggleSpotifyWebApp() {
    webAppActive = !webAppActive;
    const rightSide = document.getElementById('spotify-webapp-side');
    const leftSide = document.getElementById('score-manager-side');
    if (webAppActive) {
        rightSide.classList.add('active'); leftSide.classList.add('split-active');
        appliquerFiltre(filtre_actif);
    } else {
        rightSide.classList.remove('active'); leftSide.classList.remove('split-active');
    }
}

function buildWebappMenus() {
    const settingsMenu = document.getElementById('settings-menu'); const filterMenu = document.getElementById('filter-menu');
    if(settingsMenu) settingsMenu.innerHTML = `<a href="#" id="logout-btn">Déconnecter</a>`;
    if(filterMenu) filterMenu.innerHTML = `<a href="#" data-filter="tous">Tous</a><hr><a href="#" data-filter="utilisateur">Par vous</a><a href="#" data-filter="telecharges">Téléchargé(s)</a>`;
    
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); localStorage.clear(); window.location.reload(); });
    
    if(filterMenu) filterMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); appliquerFiltre(e.target.dataset.filter); });
    });

    window.addEventListener('click', function(event) {
        if (!event.target.matches('.menubtn')) { document.querySelectorAll(".dropdown-content").forEach(content => content.classList.remove('show')); }
    });
    document.querySelectorAll('.menubtn').forEach(button => {
        button.addEventListener('click', function() {
            const currentMenu = this.nextElementSibling;
            document.querySelectorAll(".dropdown-content").forEach(c => { if (c !== currentMenu) c.classList.remove('show'); });
            currentMenu.classList.toggle("show");
        });
    });

    const volSlider = document.getElementById('volume-slider');
    if(volSlider) volSlider.addEventListener('change', (e) => { fetchSpotifyApi(`me/player/volume?volume_percent=${e.target.value}`, 'PUT'); });
    const devBtn = document.getElementById('devices-button');
    if(devBtn) devBtn.addEventListener('click', openDevicesMenu);
}

async function appliquerFiltre(type_filtre) {
    filtre_actif = type_filtre; let playlists_a_afficher = spotifyPlaylists;
    if (filtre_actif === 'utilisateur') {
        if (!currentUser) { try { currentUser = await fetchSpotifyApi('me'); } catch(e){} }
        if (currentUser) playlists_a_afficher = spotifyPlaylists.filter(p => p.owner.id === currentUser.id);
    } else if (filtre_actif === 'telecharges') {
        playlists_a_afficher = spotifyPlaylists.filter(p => favoris_playlists.has(p.uri));
    }
    displayWebAppPlaylists(playlists_a_afficher);
}

function sauvegarder_favoris() { localStorage.setItem(FAVORIS_KEY, JSON.stringify(Array.from(favoris_playlists))); }
function toggle_favori(uri, checked) { if(checked) favoris_playlists.add(uri); else favoris_playlists.delete(uri); sauvegarder_favoris(); if(filtre_actif === 'telecharges') appliquerFiltre('telecharges'); }

function displayWebAppPlaylists(playlistsToDisplay = spotifyPlaylists) {
    const grid = document.getElementById("webapp-playlists-grid"); if(!grid) return; grid.innerHTML = "";
    playlistsToDisplay.forEach(playlist => {
        if(!playlist) return;
        const item = document.createElement("div"); item.className = "webapp-playlist-item"; item.dataset.uri = playlist.uri;
        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = favoris_playlists.has(playlist.uri); check.className = 'webapp-fav-check';
        check.onclick = (e) => { e.stopPropagation(); toggle_favori(playlist.uri, e.target.checked); };
        const imgUrl = (playlist.images && playlist.images.length > 0) ? playlist.images[0].url : 'https://placehold.co/150';
        const img = document.createElement('img'); img.src = imgUrl; img.onclick = async () => { const tracks = await getWebAppTracks(playlist.id); displayWebAppTracks(tracks, playlist); };
        const title = document.createElement('p'); title.textContent = playlist.name; title.onclick = async () => { const tracks = await getWebAppTracks(playlist.id); displayWebAppTracks(tracks, playlist); };
        if (playlist.uri === currentPlaylistUri) title.classList.add('active-text');
        
        const playBtn = document.createElement('button'); playBtn.className = 'webapp-play-button'; playBtn.innerHTML = '▶'; playBtn.onclick = (e) => { e.stopPropagation(); playSpotifyUri(playlist.uri, playlist.name); };
        item.appendChild(check); item.appendChild(img); item.appendChild(title); item.appendChild(playBtn); grid.appendChild(item);
    });
}

async function getWebAppTracks(pId) { try { return (await fetchSpotifyApi(`playlists/${pId}/tracks`)).items; } catch (e) { return []; } }

function displayWebAppTracks(tracks, playlist) {
    const container = document.getElementById("webapp-tracks-container"); if(!container) return; container.innerHTML = "";
    container.dataset.uri = playlist.uri;
    const header = document.createElement('div'); header.className = 'webapp-playlist-header';
    const imgUrl = (playlist.images && playlist.images.length > 0) ? playlist.images[0].url : 'https://placehold.co/150';
    header.innerHTML = `<img src="${imgUrl}"><h2 style="color:white; margin:0;" class="${playlist.uri === currentPlaylistUri ? 'active-text' : ''}">${playlist.name}</h2>`;
    container.appendChild(header);

    if (!tracks || tracks.length === 0) { container.innerHTML += "<p style='color:#b3b3b3;'>Cette playlist est vide.</p>"; return; }
    tracks.forEach(item => {
        const track = item.track; if (!track) return;
        const trackItem = document.createElement("div"); trackItem.className = "webapp-track-item"; trackItem.dataset.uri = track.uri;
        const trackImgUrl = track.album?.images?.[2]?.url || 'https://placehold.co/40'; const artists = track.artists.map(a => a.name).join(', ');
        trackItem.innerHTML = `<img src="${trackImgUrl}"><div class="webapp-track-info"><h3 style="color:white; margin:0;" class="${track.uri === currentTrackUri ? 'active-text' : ''}">${track.name}</h3><p>${artists}</p></div>`;
        if(track.is_local) { trackItem.style.cursor = 'not-allowed'; trackItem.title = 'Piste locale non jouable'; }
        else { trackItem.onclick = async () => { try { await fetchSpotifyApi('me/player/play', 'PUT', { context_uri: playlist.uri, offset: { uri: track.uri } }); } catch(e){} }; }
        container.appendChild(trackItem);
    });
}

function updateWebAppPlayerUI(state) {
    const footer = document.getElementById('webapp-footer'); if(!footer) return;
    if (!state || !state.item) { footer.style.visibility = 'hidden'; return; }
    footer.style.visibility = 'visible';
    document.getElementById('webapp-np-title').textContent = state.item.name;
    document.getElementById('webapp-np-artist').textContent = state.item.artists.map(a => a.name).join(', ');
    document.getElementById('webapp-np-img').src = state.item.album?.images?.[0]?.url || 'https://placehold.co/56';
    document.getElementById('webapp-play-pause-btn').textContent = state.is_playing ? '⏸' : '▶';
    
    const formatTime = ms => new Date(ms).toISOString().substr(14, 5);
    document.getElementById('webapp-current-time').textContent = formatTime(state.progress_ms);
    document.getElementById('webapp-total-time').textContent = formatTime(state.item.duration_ms);
    const progress = document.getElementById('webapp-progress-bar'); progress.max = state.item.duration_ms; progress.value = state.progress_ms;
    const volumeSlider = document.getElementById('volume-slider'); if (state.device && volumeSlider) { volumeSlider.value = state.device.volume_percent; }

    const oldTrackUri = currentTrackUri; const oldPlaylistUri = currentPlaylistUri;
    currentTrackUri = state.item.uri; currentPlaylistUri = state.context?.uri;
    
    if (oldTrackUri !== currentTrackUri || oldPlaylistUri !== currentPlaylistUri) {
        document.querySelectorAll('.webapp-playlist-item').forEach(item => { const p = item.querySelector('p'); if (p) p.classList.toggle('active-text', item.dataset.uri === currentPlaylistUri); });
        const headerTitle = document.querySelector('.webapp-playlist-header h2');
        if (headerTitle) { headerTitle.classList.toggle('active-text', document.getElementById('webapp-tracks-container').dataset.uri === currentPlaylistUri); }
        document.querySelectorAll('.webapp-track-item').forEach(item => { const h3 = item.querySelector('.webapp-track-info h3'); if (h3) h3.classList.toggle('active-text', item.dataset.uri === currentTrackUri); });
    }
}

async function openDevicesMenu() {
    try {
        const { devices } = await fetchSpotifyApi('me/player/devices');
        const menu = document.createElement('div'); menu.className = 'context-menu';
        if (devices && devices.length > 0) {
            devices.forEach(device => {
                const item = document.createElement('div'); item.className = 'context-menu-item'; item.textContent = `${device.is_active ? '✔ ' : ''}${device.name}`;
                item.onclick = () => { fetchSpotifyApi('me/player', 'PUT', { device_ids: [device.id], play: true }); document.body.removeChild(menu); };
                menu.appendChild(item);
            });
        } else { menu.innerHTML = `<div class="context-menu-item">Aucun appareil</div>`; }
        document.body.appendChild(menu);
        const btn = document.getElementById('devices-button'); const rect = btn.getBoundingClientRect();
        menu.style.left = `${rect.left}px`; menu.style.top = `${rect.top - menu.offsetHeight - 10}px`;
        setTimeout(() => document.addEventListener('click', () => { if(document.body.contains(menu)) document.body.removeChild(menu); }, { once: true }), 0);
    } catch(e) {}
}

async function initSpotifyModule() {
    const params = new URLSearchParams(window.location.search); const code = params.get('code');
    if (code) {
        try {
            const { access_token, refresh_token } = await getSpotifyToken(code);
            localStorage.setItem('obs_spotify_access', access_token); localStorage.setItem('obs_spotify_refresh', refresh_token);
            window.history.replaceState({}, '', SPOTIFY_REDIRECT_URI);
            document.getElementById('spotify-login-state').style.display = 'none'; document.getElementById('spotify-connected-state').style.display = 'block';
            buildWebappMenus(); await loadSpotifyPlaylists(); startPlayerPolling();
        } catch (error) { console.error("Erreur auth Spotify:", error); }
    } else if (localStorage.getItem('obs_spotify_refresh')) {
        try {
            await refreshSpotifyToken();
            document.getElementById('spotify-login-state').style.display = 'none'; document.getElementById('spotify-connected-state').style.display = 'block';
            buildWebappMenus(); await loadSpotifyPlaylists(); startPlayerPolling();
        } catch (error) { console.error("Session expirée."); }
    }
}

document.addEventListener('DOMContentLoaded', () => { resetTimer(); renderPenalties(); connectOBS(); initSpotifyModule(); });