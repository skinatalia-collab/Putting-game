const playerInputs = document.querySelector("#playerInputs");
const puttInputs = document.querySelector("#puttInputs");
const leaderCards = document.querySelector("#leaderCards");
const historyCards = document.querySelector("#historyCards");
const ledgerList = document.querySelector("#ledgerList");
const gameArea = document.querySelector("#gameArea");
const setupPanel = document.querySelector("#setupPanel");
const periodName = document.querySelector("#periodName");
const periodLabel = document.querySelector("#periodLabel");
const quarterValue = document.querySelector("#quarterValue");
const holeNumber = document.querySelector("#holeNumber");
const undoHole = document.querySelector("#undoHole");
const finishGame = document.querySelector("#finishGame");
const celebration = document.querySelector("#celebration");
const winnerNames = document.querySelector("#winnerNames");
const winnerStats = document.querySelector("#winnerStats");

let playerCount = 4;
let players = [];
let holes = [];
let history = [];
let currentGameId = createId("game");

const storedGame = localStorage.getItem("quarter-putt-game");
if (storedGame) {
  try {
    const parsed = JSON.parse(storedGame);
    if (Array.isArray(parsed.players) && Array.isArray(parsed.holes)) {
      players = parsed.players;
      holes = parsed.holes;
      periodName.value = parsed.period || "Today's Round";
      quarterValue.value = String(parsed.quarter || "0.25");
      playerCount = Math.max(2, Math.min(4, players.length || 4));
      currentGameId = parsed.gameId || currentGameId;
    }
  } catch {
    localStorage.removeItem("quarter-putt-game");
  }
}

const storedHistory = localStorage.getItem("quarter-putt-history");
if (storedHistory) {
  try {
    const parsed = JSON.parse(storedHistory);
    if (Array.isArray(parsed)) {
      history = parsed;
    }
  } catch {
    localStorage.removeItem("quarter-putt-history");
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function golferKey(name) {
  return (name || "golfer")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "golfer";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(amount) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
}

function saveGame() {
  localStorage.setItem("quarter-putt-game", JSON.stringify({
    gameId: currentGameId,
    period: periodName.value.trim(),
    quarter: Number(quarterValue.value),
    players,
    holes
  }));
}

function saveHistory() {
  localStorage.setItem("quarter-putt-history", JSON.stringify(history));
}

function renderPlayerInputs() {
  playerInputs.innerHTML = "";

  const names = players.length ? players.map((player) => player.name) : [];
  for (let i = 0; i < playerCount; i += 1) {
    const label = document.createElement("label");
    label.textContent = `Golfer ${i + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.value = names[i] || `Golfer ${i + 1}`;
    input.dataset.playerIndex = String(i);

    label.append(input);
    playerInputs.append(label);
  }

  document.querySelector("#removePlayer").disabled = playerCount <= 2;
  document.querySelector("#addPlayer").disabled = playerCount >= 4;
}

function collectPlayers() {
  return [...playerInputs.querySelectorAll("input")]
    .map((input, index) => ({
      id: `player-${index}-${golferKey(input.value)}`,
      key: golferKey(input.value || `Golfer ${index + 1}`),
      name: input.value.trim() || `Golfer ${index + 1}`
    }));
}

function renderPuttInputs() {
  puttInputs.innerHTML = "";

  players.forEach((player) => {
    const label = document.createElement("label");
    label.textContent = player.name;

    const stepper = document.createElement("div");
    stepper.className = "putt-stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "step-button";
    minus.textContent = "-";
    minus.ariaLabel = `Decrease putts for ${player.name}`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "12";
    input.value = "2";
    input.inputMode = "numeric";
    input.dataset.playerId = player.id;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "step-button";
    plus.textContent = "+";
    plus.ariaLabel = `Increase putts for ${player.name}`;

    minus.addEventListener("click", () => {
      input.value = String(Math.max(0, Number(input.value || 0) - 1));
    });

    plus.addEventListener("click", () => {
      input.value = String(Math.min(12, Number(input.value || 0) + 1));
    });

    stepper.append(minus, input, plus);
    label.append(stepper);
    puttInputs.append(label);
  });
}

function calculateTotals() {
  const totals = new Map(players.map((player) => [player.id, {
    putts: 0,
    quarters: 0,
    wins: 0
  }]));

  holes.forEach((hole) => {
    Object.entries(hole.putts).forEach(([playerId, putts]) => {
      totals.get(playerId).putts += putts;
    });

    hole.winners.forEach((playerId) => {
      totals.get(playerId).wins += 1;
      totals.get(playerId).quarters += hole.payers.length;
    });

    hole.payers.forEach((playerId) => {
      totals.get(playerId).quarters -= hole.winners.length;
    });
  });

  return totals;
}

function getGameWinners() {
  const totals = calculateTotals();
  if (!holes.length) {
    return [];
  }

  const bestPutts = Math.min(...players.map((player) => totals.get(player.id).putts));
  return players
    .filter((player) => totals.get(player.id).putts === bestPutts)
    .map((player) => ({
      ...player,
      ...totals.get(player.id)
    }));
}

function calculateHistoryTotals() {
  const totals = new Map();

  history.forEach((record) => {
    record.golfers.forEach((golfer) => {
      const current = totals.get(golfer.key) || {
        name: golfer.name,
        holes: 0,
        putts: 0,
        quarters: 0,
        wins: 0,
        lastPlayed: ""
      };

      current.name = golfer.name;
      current.holes += 1;
      current.putts += golfer.putts;
      current.quarters += golfer.quarters;
      current.wins += golfer.wins;
      current.lastPlayed = record.recordedAt;
      totals.set(golfer.key, current);
    });
  });

  return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function formatDate(value) {
  if (!value) {
    return "No rounds yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function renderHistory() {
  const totals = calculateHistoryTotals();
  historyCards.innerHTML = "";

  if (!totals.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Record a hole to start each golfer's saved history.";
    historyCards.append(empty);
    document.querySelector("#resetHistory").disabled = true;
    return;
  }

  document.querySelector("#resetHistory").disabled = false;

  totals.forEach((total) => {
    const card = document.createElement("article");
    card.className = "history-card";
    const quarterAmount = total.quarters * Number(quarterValue.value);
    const moneyClass = quarterAmount >= 0 ? "money-positive" : "money-negative";

    card.innerHTML = `
      <h3>${escapeHtml(total.name)}</h3>
      <p class="history-meta">Last played ${formatDate(total.lastPlayed)}</p>
      <div class="stat-row"><span>Tracked holes</span><strong>${total.holes}</strong></div>
      <div class="stat-row"><span>Total putts</span><strong>${total.putts}</strong></div>
      <div class="stat-row"><span>Winning holes</span><strong>${total.wins}</strong></div>
      <div class="stat-row"><span>Quarters</span><strong>${total.quarters}</strong></div>
      <div class="stat-row"><span>Money</span><strong class="${moneyClass}">${money(quarterAmount)}</strong></div>
    `;

    historyCards.append(card);
  });
}

function renderTotals() {
  const totals = calculateTotals();
  const bestPutts = holes.length
    ? Math.min(...players.map((player) => totals.get(player.id).putts))
    : null;

  leaderCards.innerHTML = "";

  players.forEach((player) => {
    const total = totals.get(player.id);
    const card = document.createElement("article");
    card.className = "player-card";
    if (bestPutts !== null && total.putts === bestPutts) {
      card.classList.add("is-leading");
    }

    const quarterAmount = total.quarters * Number(quarterValue.value);
    const moneyClass = quarterAmount >= 0 ? "money-positive" : "money-negative";

    card.innerHTML = `
      <h3>${escapeHtml(player.name)}</h3>
      <div class="stat-row"><span>Total putts</span><strong>${total.putts}</strong></div>
      <div class="stat-row"><span>Winning holes</span><strong>${total.wins}</strong></div>
      <div class="stat-row"><span>Quarters</span><strong>${total.quarters}</strong></div>
      <div class="stat-row"><span>Money</span><strong class="${moneyClass}">${money(quarterAmount)}</strong></div>
    `;

    leaderCards.append(card);
  });
}

function playerName(playerId) {
  return players.find((player) => player.id === playerId)?.name || "Golfer";
}

function buildHistoryRecord(hole) {
  return {
    id: hole.id,
    gameId: currentGameId,
    period: periodName.value.trim() || "Current game",
    recordedAt: new Date().toISOString(),
    golfers: players.map((player) => {
      const won = hole.winners.includes(player.id);
      const paid = hole.payers.includes(player.id);
      return {
        key: player.key || golferKey(player.name),
        name: player.name,
        putts: hole.putts[player.id] || 0,
        wins: won ? 1 : 0,
        quarters: (won ? hole.payers.length : 0) - (paid ? hole.winners.length : 0)
      };
    })
  };
}

function removeHistoryForHole(holeId) {
  history = history.filter((record) => record.id !== holeId);
}

function renderLedger() {
  ledgerList.innerHTML = "";

  if (!holes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No holes recorded yet.";
    ledgerList.append(empty);
    return;
  }

  [...holes].reverse().forEach((hole) => {
    const item = document.createElement("article");
    item.className = "ledger-item";

    const puttDetails = Object.entries(hole.putts)
      .map(([playerId, putts]) => `<span class="pill">${escapeHtml(playerName(playerId))}: ${putts}</span>`)
      .join("");

    const winners = hole.winners.map(playerName).join(", ");
    const payers = hole.payers.length ? hole.payers.map(playerName).join(", ") : "No one";

    item.innerHTML = `
      <div class="ledger-title">
        <span>Hole ${hole.number}</span>
        <span>${escapeHtml(winners)} won</span>
      </div>
      <div class="ledger-details">${puttDetails}</div>
      <p class="muted">${escapeHtml(payers)} paid ${hole.winners.length > 1 ? "the winners" : "the winner"}.</p>
    `;

    ledgerList.append(item);
  });
}

function renderGame() {
  periodLabel.textContent = periodName.value.trim() || "Current game";
  holeNumber.textContent = String(holes.length + 1);
  undoHole.disabled = holes.length === 0;
  finishGame.disabled = holes.length === 0;
  renderPuttInputs();
  renderTotals();
  renderHistory();
  renderLedger();
}

function showGame() {
  setupPanel.classList.add("is-hidden");
  gameArea.classList.remove("is-hidden");
  renderGame();
}

document.querySelector("#addPlayer").addEventListener("click", () => {
  playerCount = Math.min(4, playerCount + 1);
  renderPlayerInputs();
});

document.querySelector("#removePlayer").addEventListener("click", () => {
  playerCount = Math.max(2, playerCount - 1);
  renderPlayerInputs();
});

document.querySelector("#startGame").addEventListener("click", () => {
  players = collectPlayers();
  holes = [];
  currentGameId = createId("game");
  saveGame();
  showGame();
});

document.querySelector("#newGame").addEventListener("click", () => {
  celebration.classList.add("is-hidden");
  holes = [];
  players = [];
  currentGameId = createId("game");
  localStorage.removeItem("quarter-putt-game");
  gameArea.classList.add("is-hidden");
  setupPanel.classList.remove("is-hidden");
  renderPlayerInputs();
  renderHistory();
});

finishGame.addEventListener("click", () => {
  const winners = getGameWinners();
  if (!winners.length) {
    return;
  }

  const winnerLabel = winners.map((winner) => winner.name).join(", ");
  const winnerWord = winners.length > 1 ? "winners" : "winner";
  winnerNames.textContent = winnerLabel;
  winnerStats.innerHTML = `
    <span class="pill">${winners[0].putts} total putts</span>
    <span class="pill">${winners.map((winner) => winner.wins).join(" / ")} winning holes</span>
    <span class="pill">${winnerWord}</span>
  `;
  document.querySelector("#celebration-title").textContent = winners.length > 1
    ? "Salute to the winners"
    : "Salute to the winner";
  celebration.classList.remove("is-hidden");
});

document.querySelector("#addHole").addEventListener("click", () => {
  const putts = {};
  [...puttInputs.querySelectorAll("input")].forEach((input) => {
    putts[input.dataset.playerId] = Math.max(0, Math.min(12, Number(input.value || 0)));
  });

  const lowest = Math.min(...Object.values(putts));
  const winners = Object.entries(putts)
    .filter(([, count]) => count === lowest)
    .map(([playerId]) => playerId);
  const payers = Object.entries(putts)
    .filter(([, count]) => count > lowest)
    .map(([playerId]) => playerId);

  holes.push({
    id: createId("hole"),
    number: holes.length + 1,
    putts,
    winners,
    payers
  });

  history.push(buildHistoryRecord(holes[holes.length - 1]));
  saveHistory();
  saveGame();
  renderGame();
});

undoHole.addEventListener("click", () => {
  const removed = holes.pop();
  if (removed) {
    removeHistoryForHole(removed.id);
    saveHistory();
  }
  saveGame();
  renderGame();
});

document.querySelector("#clearScores").addEventListener("click", () => {
  holes.forEach((hole) => removeHistoryForHole(hole.id));
  holes = [];
  saveHistory();
  saveGame();
  renderGame();
});

document.querySelector("#resetHistory").addEventListener("click", () => {
  history = [];
  localStorage.removeItem("quarter-putt-history");
  renderHistory();
});

document.querySelector("#closeCelebration").addEventListener("click", () => {
  celebration.classList.add("is-hidden");
});

document.querySelector("#nextGame").addEventListener("click", () => {
  celebration.classList.add("is-hidden");
  document.querySelector("#newGame").click();
});

quarterValue.addEventListener("change", () => {
  saveGame();
  renderTotals();
  renderHistory();
});

periodName.addEventListener("input", () => {
  saveGame();
  periodLabel.textContent = periodName.value.trim() || "Current game";
});

renderPlayerInputs();
renderHistory();
if (players.length) {
  showGame();
}
