const WORD_LENGTH = 5;
const MAX_TRIES = 6;

let answer = null;
let currentRow = 0;
let currentCol = 0;
let gameOver = false;

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const answerListEl = document.getElementById("answerList");

const usedAnswers = new Set();
const wordValidationCache = new Map();

function createBoard() {
  for (let r = 0; r < MAX_TRIES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.row = r;

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

const KEY_LAYOUT = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Enter", "z", "x", "c", "v", "b", "n", "m", "Back"],
];

function createKeyboard() {
  KEY_LAYOUT.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    row.forEach((key) => {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.textContent = key === "Back" ? "⌫" : key;
      btn.dataset.key = key;
      if (key === "Enter" || key === "Back") btn.classList.add("wide");
      btn.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(btn);
    });

    keyboard.appendChild(rowEl);
  });
}

function showMessage(msg, type = "info", ms = 1500) {
  messageEl.textContent = msg;
  messageEl.className = `message ${type}`;
  if (ms > 0) {
    setTimeout(() => {
      if (messageEl.textContent === msg) messageEl.className = "message";
    }, ms);
  }
}

function getTile(r, c) {
  return document.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
}

function getCurrentGuess() {
  let guess = "";
  for (let c = 0; c < WORD_LENGTH; c++) {
    guess += getTile(currentRow, c).textContent;
  }
  return guess;
}

function handleKey(key) {
  if (gameOver) return;
  if (!answer) return showMessage("단어를 불러오는 중입니다...", "info");

  if (key === "Back") {
    if (currentCol > 0) {
      currentCol--;
      const t = getTile(currentRow, currentCol);
      t.textContent = "";
      t.classList.remove("filled");
    }
    return;
  }

  if (key === "Enter") return submitGuess();

  if (/^[a-zA-Z]$/.test(key) && currentCol < WORD_LENGTH) {
    const t = getTile(currentRow, currentCol);
    t.textContent = key.toUpperCase();
    t.classList.add("filled");
    currentCol++;
  }
}

function evaluateGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const answerArr = answer.split("");

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answerArr[i]) {
      result[i] = "correct";
      answerArr[i] = null;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const idx = answerArr.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = "present";
      answerArr[idx] = null;
    }
  }
  return result;
}

function updateKeyboardColors(guess, result) {
  result.forEach((status, i) => {
    const key = guess[i].toLowerCase();
    const btn = keyboard.querySelector(`.key[data-key="${key}"]`);
    if (!btn) return;

    if (status === "correct") return (btn.className = "key correct");
    if (status === "present" && !btn.classList.contains("correct"))
      return (btn.className = "key present");
    if (
      !btn.classList.contains("correct") &&
      !btn.classList.contains("present")
    )
      btn.className = "key absent";
  });
}

async function validateWord(word) {
  const upper = word.toUpperCase();
  if (upper === answer) return true;
  if (wordValidationCache.has(upper)) return wordValidationCache.get(upper);

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    const valid = res.ok;
    wordValidationCache.set(upper, valid);
    return valid;
  } catch {
    wordValidationCache.set(upper, true);
    return true;
  }
}

async function fetchEnglishDefinition(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d[0]?.meanings?.[0]?.definitions?.[0]?.definition || null;
  } catch {
    return null;
  }
}

async function translateToKorean(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=en|ko`
    );
    const data = await res.json();
    return data.responseData.translatedText || null;
  } catch {
    return null;
  }
}

async function getKoreanMeaning(word) {
  const def = await fetchEnglishDefinition(word);
  if (!def) return null;
  return await translateToKorean(def);
}

async function submitGuess() {
  if (currentCol < WORD_LENGTH)
    return showMessage("글자가 부족합니다.", "error");

  const guess = getCurrentGuess();
  const valid = await validateWord(guess);
  if (!valid) return showMessage("단어가 아닙니다.", "error");

  const result = evaluateGuess(guess, answer);
  result.forEach((r, i) => getTile(currentRow, i).classList.add(r));
  updateKeyboardColors(guess, result);

  if (guess === answer) {
    gameOver = true;
    showMessage("정답입니다! 🎉", "success", 0);
    await addAnswerToHistory(answer);
    restartBtn.classList.remove("hidden");
    return;
  }

  currentRow++;
  currentCol = 0;

  if (currentRow >= MAX_TRIES) {
    gameOver = true;
    showMessage(`정답: ${answer}`, "info", 0);
    await addAnswerToHistory(answer);
    restartBtn.classList.remove("hidden");
  }
}

async function addAnswerToHistory(word) {
  if (usedAnswers.has(word)) return;
  usedAnswers.add(word);

  const li = document.createElement("li");
  li.textContent = word;

  const first = answerListEl.firstChild;
  first ? answerListEl.insertBefore(li, first) : answerListEl.appendChild(li);

  const meaning = await getKoreanMeaning(word);
  if (meaning) {
    const m = document.createElement("div");
    m.className = "answer-meaning";
    m.textContent = meaning;
    li.appendChild(m);
  }
}

async function fetchAnswerWord() {
  const fallback = [
    "APPLE",
    "GRADE",
    "MUSIC",
    "LIGHT",
    "BRAIN",
    "CLOUD",
    "SMILE",
    "TRAIN",
    "HOUSE",
    "WATER",
  ];

  async function apiWord() {
    const res = await fetch(
      "https://random-word-api.herokuapp.com/word?number=1&length=5"
    );
    const data = await res.json();
    return String(data[0] || "").toUpperCase();
  }

  try {
    for (let i = 0; i < 5; i++) {
      const w = await apiWord();
      if (/^[A-Z]{5}$/.test(w) && !usedAnswers.has(w)) return w;
    }
  } catch {}

  const candidates = fallback.filter((w) => !usedAnswers.has(w));
  return candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : fallback[0];
}

function resetGameState() {
  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  answer = null;

  document.querySelectorAll(".tile").forEach((t) => {
    t.textContent = "";
    t.className = "tile";
  });

  document.querySelectorAll(".key").forEach((k) => {
    k.className = "key";
  });

  messageEl.textContent = "";
  messageEl.className = "message";

  restartBtn.classList.add("hidden");
}

async function startNewGame() {
  resetGameState();
  showMessage("게임을 시작합니다. 단어를 불러오는 중...", "info");
  answer = await fetchAnswerWord();
  showMessage("영어 단어를 추측해 보세요!", "info");
}

restartBtn.onclick = () => startNewGame();

window.addEventListener("keydown", (e) => {
  if (gameOver) return;
  if (e.key === "Backspace") handleKey("Back");
  else if (e.key === "Enter") handleKey("Enter");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
});

document.addEventListener("DOMContentLoaded", async () => {
  createBoard();
  createKeyboard();
  await startNewGame();
});
