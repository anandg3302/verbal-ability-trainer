const STORAGE_KEY = "passageRecallTrainerState";
const PASSAGES_URL = "./data/passages.json";

const state = {
  passages: [],
  currentPassage: null,
  currentMode: "random",
  difficulty: "medium",
  phase: "ready",
  readingTime: 30,
  writingTime: 90,
  readingCountdown: 30,
  writingCountdown: 90,
  currentIndex: 0,
  completedCount: 0,
  bestScore: 0,
  history: [],
  streak: 0,
  theme: "light",
  timerId: null,
};

const stopWords = new Set([
  "a","an","the","and","or","but","if","then","for","to","of","in","on","with","that","this","these","those","is","are","was","were","be","been","being","it","its","as","at","by","from","into","through","during","before","after","while","about","against","between","during","without","under","over","about","above","below","up","down","our","your","their","my","his","her","we","they","i","you","he","she","them","there","here","how","what","when","why","who","which","can","could","would","should","did","do","does","have","has","had","not","no","yes","very","more","most","than","so","such","too","much","many","one","two","three","four","five","six","seven","eight","nine","ten"
]);

const synonymMap = {
  success: ["achievement", "victory", "progress"],
  innovation: ["advance", "improvement", "breakthrough"],
  community: ["society", "group", "people"],
  environment: ["surroundings", "nature", "ecosystem"],
  technology: ["tech", "digital", "innovation"],
  education: ["learning", "schooling", "teaching"],
  leadership: ["guidance", "direction", "management"],
  future: ["tomorrow", "upcoming", "coming"],
  health: ["wellbeing", "fitness", "wellness"],
  economy: ["finance", "market", "trade"],
  culture: ["tradition", "heritage", "custom"],
  science: ["research", "study", "knowledge"],
};

async function init() {
  bindEvents();
  loadState();
  await loadPassages();
  render();
  setTheme(state.theme);
  if (!state.currentPassage && state.passages.length) {
    startPractice();
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
  });

  const responseText = document.getElementById("responseText");
  if (responseText) {
    responseText.addEventListener("input", () => {
      responseText.dataset.hasContent = responseText.value.trim().length > 0 ? "true" : "false";
    });
  }

  document.querySelectorAll(".mode-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".mode-pill").forEach((item) => item.classList.remove("active"));
      pill.classList.add("active");
      state.currentMode = pill.dataset.mode;
      state.currentIndex = 0;
      render();
    });
  });

  document.getElementById("difficultySelect").addEventListener("change", (event) => {
    state.difficulty = event.target.value;
    state.currentIndex = 0;
    render();
  });

  document.getElementById("modeSelect").addEventListener("change", (event) => {
    state.currentMode = event.target.value;
    state.currentIndex = 0;
    render();
  });

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("startPracticeBtn").addEventListener("click", async () => {
    await startPractice();
  });
  document.getElementById("submitBtn").addEventListener("click", submitResponse);
  document.getElementById("resetBtn").addEventListener("click", resetPractice);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        toggleTheme();
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        startPractice();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        submitResponse();
      }
    }
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  } catch (error) {
    console.warn("Unable to parse stored state", error);
  }
}

async function loadPassages() {
  try {
    const response = await fetch(PASSAGES_URL);
    if (!response.ok) throw new Error(`Failed to load passages: ${response.status}`);
    const passages = await response.json();
    state.passages = Array.isArray(passages) ? passages : [];
  } catch (error) {
    console.error("Unable to load passages", error);
    state.passages = [];
    showToast("Unable to load passages. Please refresh the page.");
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentMode: state.currentMode,
    difficulty: state.difficulty,
    completedCount: state.completedCount,
    bestScore: state.bestScore,
    history: state.history,
    streak: state.streak,
    theme: state.theme,
  }));
}

function setTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle("dark", theme === "dark");
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  saveState();
}

function toggleTheme() {
  setTheme(state.theme === "dark" ? "light" : "dark");
}

function switchSection(section) {
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(section).classList.add("active");
  document.querySelector(`[data-section="${section}"]`).classList.add("active");
}

function render() {
  populateDashboard();
  populatePracticeView();
  populateReviewView();
  populateStatistics();
}

function populateDashboard() {
  document.getElementById("completedStat").textContent = state.completedCount;
  document.getElementById("bestScoreStat").textContent = `${state.bestScore}%`;
  document.getElementById("averageScoreStat").textContent = `${calculateAverageScore()}%`;
  document.getElementById("streakStat").textContent = state.streak;

  const recent = state.history.slice(0, 4);
  const list = document.getElementById("recentAttempts");
  list.innerHTML = recent.length
    ? recent.map((entry) => `<li><span>${entry.passageTitle}</span><strong>${entry.scores.overall}%</strong></li>`).join("")
    : '<li><span>No attempts yet</span><strong>—</strong></li>';
}

function populatePracticeView() {
  const modeSelect = document.getElementById("modeSelect");
  const difficultySelect = document.getElementById("difficultySelect");
  if (modeSelect) modeSelect.value = state.currentMode;
  if (difficultySelect) difficultySelect.value = state.difficulty;

  const progressLabel = document.getElementById("progressLabel");
  const passageLabel = document.getElementById("passageLabel");
  const progressFill = document.getElementById("progressFill");
  const passageContainer = document.getElementById("passageContainer");

  if (!state.currentPassage) {
    progressLabel.textContent = "Ready to begin";
    passageLabel.textContent = "Select a passage";
    progressFill.style.width = "0%";
    document.getElementById("passageTitle").textContent = "Choose a passage to begin";
    document.getElementById("passageText").textContent = "A fresh practice session will appear here.";
    return;
  }

  const pool = getFilteredPassages();
  const progress = pool.length ? Math.round((state.currentIndex / pool.length) * 100) : 0;
  progressLabel.textContent = state.phase === "completed" ? "Completed" : state.phase === "writing" ? "Writing phase" : "Reading phase";
  passageLabel.textContent = `${state.currentPassage.title} · ${state.currentPassage.difficulty}`;
  progressFill.style.width = `${Math.min(100, progress)}%`;
  passageContainer.classList.toggle("hidden", state.phase !== "reading");
  document.getElementById("passageTitle").textContent = state.currentPassage.title;
  document.getElementById("passageText").textContent = state.currentPassage.text;
  document.getElementById("readingTimer").textContent = formatTime(state.readingCountdown);
  document.getElementById("writingTimer").textContent = formatTime(state.writingCountdown);
  document.getElementById("phaseLabel").textContent = state.phase === "writing" ? "Writing phase" : state.phase === "completed" ? "Completed" : "Reading phase";
  document.getElementById("phaseChip").textContent = state.phase === "writing" ? "Write" : state.phase === "completed" ? "Done" : "Read";
}

function populateReviewView() {
  const reviewList = document.getElementById("reviewList");
  if (!state.history.length) {
    reviewList.innerHTML = '<div class="review-item">No review entries yet. Complete a round to build your history.</div>';
    return;
  }

  reviewList.innerHTML = state.history
    .map((entry) => `
      <article class="review-item">
        <div>
          <strong>${entry.passageTitle}</strong>
          <div>${entry.mode} · ${entry.difficulty} · ${new Date(entry.date).toLocaleDateString()}</div>
        </div>
        <div>${entry.scores.overall}% overall</div>
      </article>
    `)
    .join("");
}

function populateStatistics() {
  const content = document.getElementById("statsContent");
  const average = calculateAverageScore();
  const averageScores = calculateAverageScoreBreakdown();

  content.innerHTML = `
    <div class="stat-block"><span>Overall average</span><strong>${average}%</strong></div>
    <div class="stat-block"><span>Content accuracy</span><strong>${averageScores.contentAccuracy}%</strong></div>
    <div class="stat-block"><span>Key idea coverage</span><strong>${averageScores.keyIdeaCoverage}%</strong></div>
    <div class="stat-block"><span>Grammar</span><strong>${averageScores.grammar}%</strong></div>
    <div class="stat-block"><span>Vocabulary</span><strong>${averageScores.vocabulary}%</strong></div>
    <div class="stat-block"><span>Organization</span><strong>${averageScores.organization}%</strong></div>
  `;
}

async function startPractice() {
  if (!state.passages.length) {
    await loadPassages();
  }

  if (!state.passages.length) {
    showToast("Passages are still loading. Please try again in a moment.");
    return;
  }

  switchSection("practice");
  clearInterval(state.timerId);
  const pool = getFilteredPassages();
  if (!pool.length) {
    showToast("No passages match the selected difficulty.");
    return;
  }

  let selected;
  if (state.currentMode === "sequential") {
    selected = pool[state.currentIndex % pool.length];
    state.currentIndex = (state.currentIndex + 1) % pool.length;
  } else {
    selected = pool[Math.floor(Math.random() * pool.length)];
  }

  state.currentPassage = selected;
  state.phase = "reading";
  state.readingCountdown = state.readingTime;
  state.writingCountdown = state.writingTime;
  document.getElementById("responseText").value = "";
  document.getElementById("resultContainer").classList.add("hidden");
  document.getElementById("responseText").disabled = false;
  populatePracticeView();

  state.timerId = setInterval(() => {
    if (state.phase === "reading") {
      state.readingCountdown -= 1;
      populatePracticeView();
      if (state.readingCountdown <= 0) {
        transitionToWriting();
      }
    } else if (state.phase === "writing") {
      state.writingCountdown -= 1;
      populatePracticeView();
      if (state.writingCountdown <= 0) {
        submitResponse();
      }
    }
  }, 1000);
}

function transitionToWriting() {
  state.phase = "writing";
  document.getElementById("responseText").focus();
  populatePracticeView();
}

function resetPractice() {
  clearInterval(state.timerId);
  state.phase = "ready";
  state.currentPassage = null;
  state.readingCountdown = state.readingTime;
  state.writingCountdown = state.writingTime;
  const responseText = document.getElementById("responseText");
  if (responseText) {
    responseText.value = "";
    responseText.disabled = false;
    responseText.dataset.hasContent = "false";
  }
  document.getElementById("resultContainer").classList.add("hidden");
  document.getElementById("passageTitle").textContent = "Choose a passage to begin";
  document.getElementById("passageText").textContent = "A fresh practice session will appear here.";
  populatePracticeView();
}

function submitResponse() {
  clearInterval(state.timerId);
  const responseText = document.getElementById("responseText");
  const response = responseText ? responseText.value.trim() : "";
  if (!response) {
    showToast("Please write a response before submitting.");
    return;
  }

  if (!state.currentPassage) {
    showToast("Please start a practice session first.");
    return;
  }

  const analysis = analyzeResponse(response, state.currentPassage);
  const entry = {
    id: Date.now(),
    passageTitle: state.currentPassage.title,
    mode: state.currentMode,
    difficulty: state.currentPassage.difficulty,
    date: new Date().toISOString(),
    scores: analysis.scores,
    highlights: analysis.highlights,
    response,
  };

  state.history.unshift(entry);
  state.history = state.history.slice(0, 12);
  state.completedCount += 1;
  state.bestScore = Math.max(state.bestScore, analysis.scores.overall);
  state.streak = response.length > 80 ? state.streak + 1 : 0;
  state.phase = "completed";
  document.getElementById("responseText").disabled = true;
  render();
  showResults(entry);
  saveState();
}

function showResults(entry) {
  const resultContainer = document.getElementById("resultContainer");
  resultContainer.classList.remove("hidden");
  const { scores, highlights } = entry;
  resultContainer.innerHTML = `
    <div class="panel-heading compact">
      <div>
        <p class="eyebrow">Feedback</p>
        <h3>${entry.passageTitle}</h3>
      </div>
      <div class="phase-chip">Overall ${scores.overall}%</div>
    </div>
    <div class="result-grid">
      <div class="score-pill"><strong>${scores.contentAccuracy}%</strong><span>Content Accuracy</span></div>
      <div class="score-pill"><strong>${scores.keyIdeaCoverage}%</strong><span>Key Idea Coverage</span></div>
      <div class="score-pill"><strong>${scores.grammar}%</strong><span>Grammar</span></div>
      <div class="score-pill"><strong>${scores.vocabulary}%</strong><span>Vocabulary</span></div>
      <div class="score-pill"><strong>${scores.organization}%</strong><span>Organization</span></div>
      <div class="score-pill"><strong>${scores.overall}%</strong><span>Overall Performance</span></div>
    </div>
    <div class="highlights">
      ${highlights.map((item) => `<span class="highlight-chip ${item.type}">${item.label}</span>`).join("")}
    </div>
    <p class="eyebrow" style="margin-top: 12px;">Green = matched ideas, amber = similar ideas, red = missing ideas.</p>
  `;
  populatePracticeView();
}

function analyzeResponse(response, passage) {
  if (!passage || !passage.text) {
    return {
      scores: {
        contentAccuracy: 0,
        keyIdeaCoverage: 0,
        grammar: 0,
        vocabulary: 0,
        organization: 0,
        overall: 0,
      },
      highlights: [{ label: "No passage data available", type: "missing" }],
    };
  }

  const responseTokens = tokenize(response);
  const passageTokens = tokenize(passage.text);
  const keywordTokens = Array.isArray(passage.keywords) ? passage.keywords.map((word) => word.toLowerCase()) : [];

  const matches = keywordTokens.filter((word) => responseTokens.includes(word));
  const similar = keywordTokens.filter((word) => !matches.includes(word) && responseTokens.some((token) => isSimilar(token, word)));
  const missing = keywordTokens.filter((word) => !matches.includes(word) && !similar.includes(word));

  const overlap = calculateOverlap(responseTokens, passageTokens);
  const contentAccuracy = clamp(Math.round((matches.length / Math.max(1, keywordTokens.length)) * 70 + overlap * 30), 0, 100);
  const keyIdeaCoverage = clamp(Math.round(((matches.length * 1.2) + (similar.length * 0.6)) / Math.max(1, keywordTokens.length) * 100), 0, 100);
  const grammar = scoreGrammar(response);
  const vocabulary = scoreVocabulary(responseTokens, matches, similar);
  const organization = scoreOrganization(response);
  const overall = clamp(Math.round(contentAccuracy * 0.3 + keyIdeaCoverage * 0.25 + grammar * 0.15 + vocabulary * 0.15 + organization * 0.15), 0, 100);

  return {
    scores: {
      contentAccuracy,
      keyIdeaCoverage,
      grammar,
      vocabulary,
      organization,
      overall,
    },
    highlights: [
      ...matches.map((word) => ({ label: `${word} matched`, type: "match" })),
      ...similar.map((word) => ({ label: `${word} similar`, type: "similar" })),
      ...missing.map((word) => ({ label: `${word} missing`, type: "missing" })),
    ].slice(0, 8),
  };
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !stopWords.has(word));
}

function calculateOverlap(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? Math.round((intersection / union) * 100) : 0;
}

function isSimilar(token, keyword) {
  if (token === keyword) return true;
  const related = synonymMap[keyword] || [];
  return related.includes(token);
}

function scoreGrammar(response) {
  const sentences = response.split(/[.!?]+/).filter(Boolean).length;
  let score = 55;
  if (response.length > 60) score += 12;
  if (sentences >= 2) score += 12;
  if (/[.!?]/.test(response)) score += 10;
  if (!/\s{2,}/.test(response)) score += 6;
  return clamp(score, 0, 100);
}

function scoreVocabulary(tokens, matches, similar) {
  const uniqueCount = new Set(tokens).size;
  let score = Math.min(100, Math.round((uniqueCount / Math.max(1, tokens.length)) * 140));
  score += matches.length * 3;
  score += similar.length * 1;
  return clamp(score, 0, 100);
}

function scoreOrganization(response) {
  let score = 45;
  if (response.split(/\n+/).filter(Boolean).length > 1) score += 20;
  if (response.match(/\b(first|second|finally|however|therefore|moreover|in addition|overall|consequently)\b/i)) score += 20;
  if (response.split(/[.!?]+/).filter(Boolean).length >= 2) score += 15;
  return clamp(score, 0, 100);
}

function calculateAverageScore() {
  if (!state.history.length) return 0;
  const avg = state.history.reduce((sum, entry) => sum + entry.scores.overall, 0) / state.history.length;
  return Math.round(avg);
}

function calculateAverageScoreBreakdown() {
  if (!state.history.length) {
    return {
      contentAccuracy: 0,
      keyIdeaCoverage: 0,
      grammar: 0,
      vocabulary: 0,
      organization: 0,
    };
  }

  const totals = state.history.reduce(
    (acc, entry) => {
      acc.contentAccuracy += entry.scores.contentAccuracy;
      acc.keyIdeaCoverage += entry.scores.keyIdeaCoverage;
      acc.grammar += entry.scores.grammar;
      acc.vocabulary += entry.scores.vocabulary;
      acc.organization += entry.scores.organization;
      return acc;
    },
    { contentAccuracy: 0, keyIdeaCoverage: 0, grammar: 0, vocabulary: 0, organization: 0 },
  );

  const count = state.history.length;
  return {
    contentAccuracy: Math.round(totals.contentAccuracy / count),
    keyIdeaCoverage: Math.round(totals.keyIdeaCoverage / count),
    grammar: Math.round(totals.grammar / count),
    vocabulary: Math.round(totals.vocabulary / count),
    organization: Math.round(totals.organization / count),
  };
}

function getFilteredPassages() {
  const filtered = state.passages.filter((passage) => state.difficulty === "all" || passage.difficulty === state.difficulty);
  return filtered;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

window.addEventListener("load", init);
