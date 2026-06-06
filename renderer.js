// Pomodoro Timer - Renderer
const { ipcRenderer } = require('electron');

// ── DOM Elements ──────────────────────────────────
const timerDisplay = document.getElementById('timer-display');
const timerRingProgress = document.getElementById('timer-ring-progress');
const sessionLabel = document.getElementById('session-label');
const sessionDots = document.getElementById('session-dots');
const btnStart = document.getElementById('btn-start');
const btnSkip = document.getElementById('btn-skip');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
const btnPin = document.getElementById('btn-pin');
const settingsPanel = document.getElementById('settings-panel');
const settingWork = document.getElementById('setting-work');
const settingShortBreak = document.getElementById('setting-short-break');
const settingLongBreak = document.getElementById('setting-long-break');

// ── Constants ─────────────────────────────────────
const RING_CIRCUMFERENCE = 2 * Math.PI * 108; // ~678.584
const SESSIONS_BEFORE_LONG_BREAK = 4;
const SESSION_TYPES = {
  WORK: 'work',
  SHORT_BREAK: 'short-break',
  LONG_BREAK: 'long-break',
};
const LABELS = {
  [SESSION_TYPES.WORK]: '专注工作',
  [SESSION_TYPES.SHORT_BREAK]: '短休息',
  [SESSION_TYPES.LONG_BREAK]: '长休息',
};

// ── State ─────────────────────────────────────────
let state = {
  currentSession: SESSION_TYPES.WORK,
  workDuration: 25,        // minutes
  shortBreakDuration: 5,   // minutes
  longBreakDuration: 15,   // minutes
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  isRunning: false,
  completedSessions: 0,
  intervalId: null,
  alwaysOnTop: false,
};

// ── Audio ─────────────────────────────────────────
function playAlarm() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Play a pleasant 3-note ascending chime
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.2 + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.2);
    osc.stop(audioCtx.currentTime + i * 0.2 + 0.4);
  });

  // Also play a longer sustained note for break end (more urgent)
  setTimeout(() => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  }, notes.length * 200);
}

// ── Notification ──────────────────────────────────
function showNotification(title, body) {
  ipcRenderer.send('show-notification', { title, body });
}

// ── Persistence ───────────────────────────────────
function saveSettings() {
  localStorage.setItem('pomodoro-settings', JSON.stringify({
    workDuration: state.workDuration,
    shortBreakDuration: state.shortBreakDuration,
    longBreakDuration: state.longBreakDuration,
    completedSessions: state.completedSessions,
  }));
}

function loadSettings() {
  const saved = localStorage.getItem('pomodoro-settings');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.workDuration = data.workDuration || 25;
      state.shortBreakDuration = data.shortBreakDuration || 5;
      state.longBreakDuration = data.longBreakDuration || 15;
      state.completedSessions = data.completedSessions || 0;
    } catch (e) {
      // Use defaults
    }
  }
}

// ── UI Updates ────────────────────────────────────
function updateTimerDisplay() {
  const mins = Math.floor(state.remainingSeconds / 60);
  const secs = state.remainingSeconds % 60;
  timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Update ring progress
  const progress = state.remainingSeconds / state.totalSeconds;
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  timerRingProgress.setAttribute('stroke-dashoffset', offset);
}

function updateSessionLabel() {
  sessionLabel.textContent = LABELS[state.currentSession];
  sessionLabel.className = 'session-label';
  switch (state.currentSession) {
    case SESSION_TYPES.WORK:
      sessionLabel.classList.add('session-label--work');
      timerRingProgress.style.stroke = 'var(--work)';
      btnStart.style.background = 'var(--work)';
      break;
    case SESSION_TYPES.SHORT_BREAK:
      sessionLabel.classList.add('session-label--short-break');
      timerRingProgress.style.stroke = 'var(--short-break)';
      btnStart.style.background = 'var(--short-break)';
      break;
    case SESSION_TYPES.LONG_BREAK:
      sessionLabel.classList.add('session-label--long-break');
      timerRingProgress.style.stroke = 'var(--long-break)';
      btnStart.style.background = 'var(--long-break)';
      break;
  }
}

function updateDots() {
  const dots = sessionDots.querySelectorAll('.session-dot');
  dots.forEach((dot, i) => {
    if (i < state.completedSessions % SESSIONS_BEFORE_LONG_BREAK) {
      dot.classList.add('session-dot--done');
    } else {
      dot.classList.remove('session-dot--done');
    }
  });
}

function updateStartButton() {
  if (state.isRunning) {
    btnStart.textContent = '暂停';
  } else if (state.remainingSeconds < state.totalSeconds) {
    btnStart.textContent = '继续';
  } else {
    btnStart.textContent = '开始';
  }
}

function refreshUI() {
  updateTimerDisplay();
  updateSessionLabel();
  updateDots();
  updateStartButton();
}

// ── Timer Logic ───────────────────────────────────
function getSessionDuration(sessionType) {
  switch (sessionType) {
    case SESSION_TYPES.WORK:
      return state.workDuration * 60;
    case SESSION_TYPES.SHORT_BREAK:
      return state.shortBreakDuration * 60;
    case SESSION_TYPES.LONG_BREAK:
      return state.longBreakDuration * 60;
    default:
      return 25 * 60;
  }
}

function getNextSession() {
  if (state.currentSession === SESSION_TYPES.WORK) {
    state.completedSessions++;
    if (state.completedSessions % SESSIONS_BEFORE_LONG_BREAK === 0) {
      return SESSION_TYPES.LONG_BREAK;
    }
    return SESSION_TYPES.SHORT_BREAK;
  }
  // After any break, go back to work
  return SESSION_TYPES.WORK;
}

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  updateStartButton();

  state.intervalId = setInterval(() => {
    state.remainingSeconds--;

    // Smooth ring animation
    const progress = state.remainingSeconds / state.totalSeconds;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    timerRingProgress.setAttribute('stroke-dashoffset', offset);

    updateTimerDisplay();

    if (state.remainingSeconds <= 0) {
      clearInterval(state.intervalId);
      state.isRunning = false;

      // Play sound & notify
      playAlarm();

      if (state.currentSession === SESSION_TYPES.WORK) {
        showNotification('🍅 工作时间结束！', '干得好！休息一下吧~');
      } else {
        showNotification('☕ 休息时间结束！', '准备好开始新的番茄钟了吗？');
      }

      // Switch to next session
      const nextSession = getNextSession();
      state.currentSession = nextSession;
      state.totalSeconds = getSessionDuration(nextSession);
      state.remainingSeconds = state.totalSeconds;

      refreshUI();
      saveSettings();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.isRunning) return;
  clearInterval(state.intervalId);
  state.isRunning = false;
  updateStartButton();
}

function resetTimer() {
  pauseTimer();
  state.totalSeconds = getSessionDuration(state.currentSession);
  state.remainingSeconds = state.totalSeconds;
  timerRingProgress.setAttribute('stroke-dashoffset', '0');
  refreshUI();
}

function skipSession() {
  pauseTimer();

  if (state.currentSession === SESSION_TYPES.WORK) {
    showNotification('⏭ 跳过工作', '直接进入休息时间');
  }

  const nextSession = getNextSession();
  state.currentSession = nextSession;
  state.totalSeconds = getSessionDuration(nextSession);
  state.remainingSeconds = state.totalSeconds;
  timerRingProgress.setAttribute('stroke-dashoffset', '0');
  refreshUI();
  saveSettings();
}

// ── Settings ──────────────────────────────────────
function openSettings() {
  settingWork.value = state.workDuration;
  settingShortBreak.value = state.shortBreakDuration;
  settingLongBreak.value = state.longBreakDuration;
  settingsPanel.classList.add('settings--open');
}

function closeSettings() {
  const newWork = parseInt(settingWork.value, 10);
  const newShort = parseInt(settingShortBreak.value, 10);
  const newLong = parseInt(settingLongBreak.value, 10);

  if (newWork > 0 && newWork <= 120) state.workDuration = newWork;
  if (newShort > 0 && newShort <= 30) state.shortBreakDuration = newShort;
  if (newLong > 0 && newLong <= 60) state.longBreakDuration = newLong;

  settingsPanel.classList.remove('settings--open');
  resetTimer();
  saveSettings();
}

// ── Window Controls ───────────────────────────────
btnClose.addEventListener('click', () => {
  ipcRenderer.send('window-hide');
});

btnMinimize.addEventListener('click', () => {
  ipcRenderer.send('window-minimize');
});

btnPin.addEventListener('click', () => {
  state.alwaysOnTop = !state.alwaysOnTop;
  ipcRenderer.send('window-always-on-top', state.alwaysOnTop);
  btnPin.style.opacity = state.alwaysOnTop ? '1' : '0.4';
});

// ── Event Listeners ──────────────────────────────
btnStart.addEventListener('click', () => {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

btnSkip.addEventListener('click', () => {
  skipSession();
});

btnSettings.addEventListener('click', () => {
  openSettings();
});

btnSettingsClose.addEventListener('click', () => {
  closeSettings();
});

// Close settings on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (settingsPanel.classList.contains('settings--open')) {
      closeSettings();
    }
  }
  // Space bar to toggle start/pause
  if (e.key === ' ' && !settingsPanel.classList.contains('settings--open')) {
    e.preventDefault();
    if (state.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }
});

// ── Init ──────────────────────────────────────────
loadSettings();
state.totalSeconds = getSessionDuration(state.currentSession);
state.remainingSeconds = state.totalSeconds;

// Cap completed sessions display
state.completedSessions = state.completedSessions % SESSIONS_BEFORE_LONG_BREAK;

refreshUI();
