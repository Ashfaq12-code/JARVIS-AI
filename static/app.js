/**
 * JARVIS Operating HUD & Client Application Controller
 * Ashfaq Personal Assistant, WhatsApp Workflow, and Transparent Chat HUD
 */

let avatarEngine = null;
let socket = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let speechRecognizer = null;
let isListening = false;
let wakeWordArmed = false;
let recognitionRestartTimer = null;
let voiceState = 'idle';
let calculatorSession = false;
let speechSuppressed = false;

// DOM Elements
const hudContainer = document.getElementById('hud-container');
const avatarTelemetry = document.getElementById('avatar-telemetry');
const avatarStatusLabel = document.getElementById('avatar-status-label');
const assemblyProgress = document.getElementById('assembly-progress');
const assemblyText = document.getElementById('assembly-text');
const toastEl = document.getElementById('toast');
const toastText = document.getElementById('toast-text');
const cpuFill = document.getElementById('cpu-fill');
const cpuText = document.getElementById('cpu-text');
const ramFill = document.getElementById('ram-fill');
const ramText = document.getElementById('ram-text');
const volFill = document.getElementById('vol-fill');
const volText = document.getElementById('vol-text');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const waveformCanvas = document.getElementById('waveform-canvas');
const stepButtons = document.querySelectorAll('.step-btn');

// Chat Panel Elements
const chatSidebar = document.getElementById('chat-sidebar');
const chatDotToggle = document.getElementById('chat-dot-toggle');
const minimizeChatBtn = document.getElementById('minimize-chat-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');

// Volume Dialog Elements
const volumeDialog = document.getElementById('volume-dialog');
const closeDialogBtn = document.getElementById('close-dialog-btn');
const volButtons = document.querySelectorAll('.vol-btn');
const customVolSlider = document.getElementById('custom-vol-slider');
const sliderVolVal = document.getElementById('slider-vol-val');
const applyVolBtn = document.getElementById('apply-vol-btn');
const volStatWidget = document.getElementById('vol-stat-widget');

// Apps Hub Elements
const appsHubToggle = document.getElementById('apps-hub-toggle');
const appsHubDialog = document.getElementById('apps-hub-dialog');
const closeAppsBtn = document.getElementById('close-apps-btn');
const appCards = document.querySelectorAll('.app-card');
const hudClock = document.getElementById('hud-clock');

document.addEventListener('DOMContentLoaded', () => {
  avatarEngine = new ParticleAvatarEngine('webgl-canvas');

  drawNetworkLines();
  window.addEventListener('resize', drawNetworkLines);

  initWebSocket();
  initWaveformVisualizer();

  setupNodeEvents();
  setupCommandBar();
  setupStepSwitcher();
  setupSpeechRecognition();
  setupVolumeDialog();
  setupAppsHub();
  setupChatPanel();
  setupWebcamTracking();
  setupMouseFaceTracking();
  updateHudClock();
  setInterval(updateHudClock, 1000);

  // Start the wake-word listener automatically. The browser asks for mic permission once.
  setTimeout(startListening, 250);

  // Unlock audio context and TTS on first click
  window.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }, { once: true });

  const handleScreenReturnToHome = (e) => {
    if (avatarEngine && avatarEngine.targetStep > 1) {
      if (
        e.target.closest('#chat-sidebar') ||
        e.target.closest('#chat-dot-toggle') ||
        e.target.closest('.command-bar') ||
        e.target.closest('.futuristic-dialog') ||
        e.target.closest('.step-btn') ||
        e.target.closest('.node-item') ||
        e.target.closest('.cam-track-btn') ||
        e.target.closest('button') ||
        e.target.closest('input')
      ) {
        return;
      }
      goToStep(1);
    }
  };

  window.addEventListener('click', handleScreenReturnToHome);
  window.addEventListener('touchstart', handleScreenReturnToHome, { passive: true });

  window.addEventListener('keydown', (e) => {
    const keyNum = parseInt(e.key);
    if (keyNum >= 1 && keyNum <= 5 && document.activeElement !== commandInput) {
      goToStep(keyNum);
    }
  });
});

// -------------------------------------------------------------
// Chat Panel Setup & Typewriter Output
// -------------------------------------------------------------
function setupChatPanel() {
  if (chatDotToggle) {
    chatDotToggle.addEventListener('click', () => {
      chatSidebar.classList.toggle('collapsed');
      chatDotToggle.classList.toggle('active', !chatSidebar.classList.contains('collapsed'));
    });
  }

  if (minimizeChatBtn) {
    minimizeChatBtn.addEventListener('click', () => {
      chatSidebar.classList.add('collapsed');
      if (chatDotToggle) chatDotToggle.classList.remove('active');
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      chatMessages.innerHTML = '';
      showToast('Chat history cleared');
    });
  }
}

function appendUserMessage(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const card = document.createElement('div');
  card.className = 'msg-card user-msg';
  card.innerHTML = `
    <div class="msg-meta">
      <span class="sender-badge user-badge">ASHFAQ</span>
      <span class="msg-time">${time}</span>
    </div>
    <div class="msg-body">${escapeHTML(text)}</div>
    <div class="msg-actions">
      <button class="msg-btn copy-btn" onclick="copyMessageText(this)">COPY</button>
      <button class="msg-btn fwd-btn" onclick="forwardToWhatsApp(this)">FORWARD</button>
    </div>
  `;
  chatMessages.appendChild(card);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendJarvisMessage(text, typewriter = true) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const card = document.createElement('div');
  card.className = 'msg-card jarvis-msg';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'msg-body';

  card.innerHTML = `
    <div class="msg-meta">
      <span class="sender-badge jarvis-badge">JARVIS</span>
      <span class="msg-time">${time}</span>
    </div>
  `;
  card.appendChild(bodyEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'msg-actions';
  actionsEl.innerHTML = `
    <button class="msg-btn copy-btn" onclick="copyMessageText(this)">COPY</button>
    <button class="msg-btn fwd-btn" onclick="forwardToWhatsApp(this)">FORWARD</button>
  `;
  card.appendChild(actionsEl);

  chatMessages.appendChild(card);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (typewriter) {
    let charIdx = 0;
    const interval = setInterval(() => {
      bodyEl.textContent = text.slice(0, charIdx++);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      if (charIdx > text.length) {
        clearInterval(interval);
      }
    }, 12);
  } else {
    bodyEl.textContent = text;
  }
}

function appendWhatsAppCard(recipient, message) {
  const card = document.createElement('div');
  card.className = 'msg-card whatsapp-card';
  card.innerHTML = `
    <div class="whatsapp-card-title">
      <span>WHATSAPP DISPATCH READY</span>
    </div>
    <div class="whatsapp-field"><strong>Recipient:</strong> ${escapeHTML(recipient)}</div>
    <div class="whatsapp-field"><strong>Message:</strong> "${escapeHTML(message)}"</div>
    <div class="whatsapp-actions-row">
      <button class="confirm-send-btn" onclick="confirmWhatsAppSend('${escapeAttr(recipient)}', '${escapeAttr(message)}', this)">
        CONFIRM & SEND NOW
      </button>
      <button class="cancel-send-btn" onclick="cancelWhatsAppCard(this)">CANCEL</button>
    </div>
  `;
  chatMessages.appendChild(card);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendContactSuggestions(contacts) {
  const container = document.createElement('div');
  container.className = 'contact-chips-row';
  contacts.forEach((name) => {
    const chip = document.createElement('button');
    chip.className = 'contact-chip';
    chip.innerHTML = `${escapeHTML(name)}`;
    chip.onclick = () => {
      handleUserCommand(name);
    };
    container.appendChild(chip);
  });
  chatMessages.appendChild(container);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.copyMessageText = function (btn) {
  const card = btn.closest('.msg-card');
  const body = card.querySelector('.msg-body');
  if (body) {
    navigator.clipboard.writeText(body.innerText).then(() => {
      showToast('Text copied to clipboard!');
    });
  }
};

window.forwardToWhatsApp = function (btn) {
  const card = btn.closest('.msg-card');
  const body = card.querySelector('.msg-body');
  if (body) {
    const text = encodeURIComponent(body.innerText);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    showToast('Forwarding to WhatsApp...');
  }
};

window.confirmWhatsAppSend = function (recipient, message, btn) {
  sendSystemAction('send_whatsapp_message', { recipient: recipient, message: message });
  btn.innerText = 'DISPATCHED';
  btn.style.background = '#38ef7d';
  showToast(`WhatsApp message dispatched to ${recipient}`);
  speakJarvis('Sir, sending WhatsApp message now. Process complete.');
};

window.cancelWhatsAppCard = function (btn) {
  const card = btn.closest('.whatsapp-card');
  card.innerHTML = '<div style="font-size: 11px; color: #ff6666; font-family: monospace;">WhatsApp message cancelled.</div>';
  speakJarvis('WhatsApp message cancelled, Sir.');
};

function escapeHTML(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'");
}

// -------------------------------------------------------------
// Volume Dialog
// -------------------------------------------------------------
function setupVolumeDialog() {
  if (!volumeDialog) return;

  const openVolumeModal = () => {
    volumeDialog.classList.remove('hidden');
    speakJarvis('What percentage would you like me to set the volume to, Sir? (e.g., 50% or 45%)');
  };

  if (volStatWidget) volStatWidget.addEventListener('click', openVolumeModal);

  if (closeDialogBtn) {
    closeDialogBtn.addEventListener('click', () => {
      volumeDialog.classList.add('hidden');
    });
  }

  if (volButtons) {
    volButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const vol = parseInt(btn.dataset.vol);
        setVolumePercentage(vol);
        volumeDialog.classList.add('hidden');
      });
    });
  }

  if (customVolSlider && sliderVolVal) {
    customVolSlider.addEventListener('input', () => {
      sliderVolVal.textContent = `${customVolSlider.value}%`;
    });
  }

  if (applyVolBtn && customVolSlider) {
    applyVolBtn.addEventListener('click', () => {
      const vol = parseInt(customVolSlider.value);
      setVolumePercentage(vol);
      volumeDialog.classList.add('hidden');
    });
  }
}

function setVolumePercentage(percent) {
  sendSystemAction('set_volume', { percent: percent });
  if (volFill) volFill.style.width = `${percent}%`;
  if (volText) volText.textContent = `${percent}%`;
  showToast(`Volume set to ${percent}%`);
  const reply = `Master volume set to ${percent} percent, Sir.`;
  speakJarvis(reply);
  appendJarvisMessage(reply);
}

// -------------------------------------------------------------
// Apps Hub Setup
// -------------------------------------------------------------
function setupAppsHub() {
  if (appsHubToggle && appsHubDialog) {
    appsHubToggle.addEventListener('click', () => {
      appsHubDialog.classList.remove('hidden');
    });
  }

  if (closeAppsBtn && appsHubDialog) {
    closeAppsBtn.addEventListener('click', () => {
      appsHubDialog.classList.add('hidden');
    });
  }

  if (appCards) {
    appCards.forEach((card) => {
      card.addEventListener('click', () => {
        const app = card.dataset.app;
        sendSystemAction('launch_app', { app: app });
        if (appsHubDialog) appsHubDialog.classList.add('hidden');
        
        const appNames = {
          whatsapp: 'WhatsApp',
          code: 'Visual Studio Code',
          calc: 'Calculator',
          chrome: 'Google Chrome',
          notepad: 'Notepad',
          explorer: 'File Explorer',
          taskmgr: 'Task Manager'
        };
        const name = appNames[app] || app;
        const voiceText = `Sir, opening ${name}`;
        speakJarvis(voiceText);
        appendJarvisMessage(voiceText);
      });
    });
  }
}

function updateHudClock() {
  if (!hudClock) return;
  hudClock.textContent = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

function speakCurrentTime() {
  const timeText = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
  const reply = `The time is ${timeText}, Sir.`;
  appendJarvisMessage(reply);
  showToast(reply);
  speakJarvis(reply);
}

// -------------------------------------------------------------
// Step Morphing Controller (Steps 1 to 5)
// -------------------------------------------------------------
function goToStep(step) {
  if (avatarEngine) avatarEngine.targetStep = step;

  stepButtons.forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.step) === step);
  });

  if (step === 1) {
    hudContainer.classList.remove('hidden');
    hudContainer.classList.add('visible');
    avatarTelemetry.classList.add('hidden');
    showToast('Jarvis Operating HUD Active');
  } else {
    hudContainer.classList.remove('visible');
    hudContainer.classList.add('hidden');
    avatarTelemetry.classList.remove('hidden');

    if (step === 2) {
      assemblyProgress.classList.remove('hidden');
      assemblyText.textContent = 'ASSEMBLING... 25%';
      avatarStatusLabel.textContent = 'IGNITION: ARC SWIRL';
      showToast('Step 2: Particle Ignition Arc');
    } else if (step === 3) {
      assemblyProgress.classList.remove('hidden');
      assemblyText.textContent = 'ASSEMBLING... 50%';
      avatarStatusLabel.textContent = 'TRACING SILHOUETTE';
      showToast('Step 3: Contour Formation');
    } else if (step === 4) {
      assemblyProgress.classList.remove('hidden');
      assemblyText.textContent = 'ASSEMBLING... 85%';
      avatarStatusLabel.textContent = 'SCANNING MATRIX';
      showToast('Step 4: Horizontal Scan Grid');
    } else if (step === 5) {
      assemblyProgress.classList.add('hidden');
      avatarStatusLabel.textContent = 'STATUS: LISTENING';
      showToast('Step 5: Neural Face Activated');
      speakJarvis('Neural avatar online, Ashfaq. All systems fully operational.');
    }
  }
}

// -------------------------------------------------------------
// SVG Neural Orbit Lines
// -------------------------------------------------------------
function drawNetworkLines() {
  const svg = document.getElementById('network-lines');
  if (!svg) return;

  svg.innerHTML = '';
  const coreAnchor = document.getElementById('central-core-anchor');
  const coreRect = coreAnchor.getBoundingClientRect();
  const centerX = coreRect.left + coreRect.width / 2;
  const centerY = coreRect.top + coreRect.height / 2;

  const nodes = document.querySelectorAll('.node-item');
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const nodeX = rect.left + rect.width / 2;
    const nodeY = rect.top + rect.height / 2;

    const dx = nodeX - centerX;
    const dy = nodeY - centerY;
    const cpX = centerX + dx * 0.55;
    const cpY = centerY + dy * 0.15;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      `M ${centerX} ${centerY} Q ${cpX} ${cpY} ${nodeX} ${nodeY}`
    );
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#00e5ff');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-opacity', '0.35');
    path.setAttribute('stroke-dasharray', '4 4');

    svg.appendChild(path);
  });
}

// -------------------------------------------------------------
// Interactive Skill Nodes
// -------------------------------------------------------------
function setupNodeEvents() {
  const nodes = document.querySelectorAll('.node-item');
  nodes.forEach((node) => {
    node.addEventListener('click', () => {
      const action = node.dataset.action;
      const app = node.dataset.app;

      node.style.transform = 'translate(-50%, -50%) scale(1.15)';
      setTimeout(() => {
        node.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 200);

      if (action === 'morph_face') {
        speakJarvis('Sir, activating neural face. Assembling particle matrix now.');
        appendJarvisMessage('Sir, activating neural face. Assembling particle matrix now.');
        // Sequentially morph through steps 2 → 3 → 4 → 5 for full assembly animation
        goToStep(2);
        setTimeout(() => goToStep(3), 900);
        setTimeout(() => goToStep(4), 1800);
        setTimeout(() => goToStep(5), 2700);
      } else if (action === 'prompt_volume') {
        volumeDialog.classList.remove('hidden');
        speakJarvis('What percentage would you like me to set the volume to, Sir? (e.g., 50% or 45%)');
      } else if (action === 'launch_app') {
        sendSystemAction('launch_app', { app: app });
        const appNames = {
          whatsapp: 'WhatsApp',
          code: 'Visual Studio Code',
          calc: 'Calculator',
          chrome: 'Google Chrome',
          notepad: 'Notepad',
          explorer: 'File Explorer',
          taskmgr: 'Task Manager'
        };
        const name = appNames[app] || app;
        const voiceText = `Sir, opening ${name}`;
        speakJarvis(voiceText);
        appendJarvisMessage(voiceText);
      } else if (action === 'open_chrome') {
        sendSystemAction('launch_app', { app: 'chrome' });
        speakJarvis('Sir, opening Google Chrome');
        appendJarvisMessage('Sir, opening Google Chrome');
      } else if (action === 'open_url') {
        sendSystemAction('open_url', { url: 'https://techalh.com' });
      } else if (action === 'volume_up') {
        sendSystemAction('volume_up');
      } else if (action === 'volume_down') {
        sendSystemAction('volume_down');
      } else if (action === 'volume_mute') {
        sendSystemAction('volume_mute');
      } else if (action === 'search_web') {
        sendSystemAction('search_web', { query: 'Jarvis AI' });
      } else if (action === 'get_system_stats') {
        sendSystemAction('get_system_stats');
      } else if (action === 'ai_brain') {
        const reply = 'Strategist brain online, Ashfaq. What shall we design or execute?';
        speakJarvis(reply);
        appendJarvisMessage(reply);
      }
    });
  });
}

// -------------------------------------------------------------
// Step Switcher Buttons
// -------------------------------------------------------------
function setupStepSwitcher() {
  stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step);
      goToStep(step);
    });
  });
}

// -------------------------------------------------------------
// Command Bar Input & Execution (Enter Key & Voice)
// -------------------------------------------------------------
function setupCommandBar() {
  if (!commandInput || !sendBtn) return;

  const executeInput = () => {
    const text = commandInput.value.trim();
    if (!text) return;
    commandInput.value = '';
    handleUserCommand(text);
  };

  sendBtn.addEventListener('click', executeInput);
  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeInput();
    }
  });
}

function handleUserCommand(cmd) {
  showToast(`Command: ${cmd}`);
  appendUserMessage(cmd);

  const normalized = cmd.toLowerCase().replace(/[!?.,]/g, '');
  if (normalized.includes('show time') || normalized === 'time' || normalized.includes('what time')) {
    speakCurrentTime();
    return;
  }

  // Send directly to WebSocket Conversational AI & Automation Controller
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'voice_command', command: cmd }));
  }
}

// -------------------------------------------------------------
// WebSocket Communication
// -------------------------------------------------------------
function initWebSocket() {
  const wsUrl = `ws://${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    showToast('Jarvis Synchronized // User: Ashfaq');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'stats') {
        updateTelemetry(msg.data);
      } else if (msg.type === 'action_result') {
        showToast(msg.data.message || 'Action executed');
      } else if (msg.type === 'morph_face') {
        goToStep(msg.step);
      } else if (msg.type === 'jarvis_response') {
        showToast(msg.text);
        appendJarvisMessage(msg.text);

        if (msg.calculator_mode === 'awaiting_expression') {
          calculatorSession = true;
          setCalculatorNodeState(true);
          setVoiceState('waiting');
        } else if (msg.calculator_mode === 'thinking') {
          setCalculatorNodeState(true);
          setVoiceState('thinking');
        } else if (msg.calculator_mode === 'complete' || msg.calculator_mode === 'error') {
          calculatorSession = false;
          setCalculatorNodeState(false);
        } else if (msg.calculator_mode === 'retry') {
          calculatorSession = true;
          setCalculatorNodeState(true);
          setVoiceState('waiting');
        } else if (msg.calculator_mode === 'closed') {
          calculatorSession = false;
          setCalculatorNodeState(false);
          setVoiceState('waiting');
        }
        if (msg.calculator_mode !== 'thinking' && msg.voice) {
          speakJarvis(msg.voice);
        } else if (msg.calculator_mode !== 'thinking') {
          speakJarvis(msg.text);
        }

        if (msg.prompt_type === 'volume_selection') {
          volumeDialog.classList.remove('hidden');
        }

        if (msg.contact_suggestions && Array.isArray(msg.contact_suggestions)) {
          appendContactSuggestions(msg.contact_suggestions);
        }

        if (msg.whatsapp_card) {
          appendWhatsAppCard(msg.whatsapp_card.recipient, msg.whatsapp_card.message);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  socket.onclose = () => {
    calculatorSession = false;
    if (isListening) setVoiceState('waiting');
    setTimeout(initWebSocket, 2000);
  };
}

function sendSystemAction(action, params = {}) {
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, params: params }),
  })
    .then((res) => res.json())
    .then((data) => {
      showToast(data.message || 'Executed');
    })
    .catch((err) => console.error(err));
}

function updateTelemetry(stats) {
  if (!stats) return;
  if (stats.cpu !== undefined) {
    cpuFill.style.width = `${Math.min(100, stats.cpu)}%`;
    cpuText.textContent = `${Math.round(stats.cpu)}%`;
  }
  if (stats.ram_percent !== undefined) {
    ramFill.style.width = `${Math.min(100, stats.ram_percent)}%`;
    ramText.textContent = `${Math.round(stats.ram_percent)}%`;
  }
  if (stats.volume !== undefined) {
    volFill.style.width = `${stats.volume}%`;
    volText.textContent = `${stats.volume}%`;
  }
}

// -------------------------------------------------------------
// Audio Visualizer Wave
// -------------------------------------------------------------
function initWaveformVisualizer() {
  const ctx = waveformCanvas.getContext('2d');
  const width = waveformCanvas.width;
  const height = waveformCanvas.height;

  let waveOffset = 0;

  function renderWave() {
    requestAnimationFrame(renderWave);
    ctx.clearRect(0, 0, width, height);

    waveOffset += 0.08;
    if (avatarEngine && voiceState === 'hearing') {
      avatarEngine.audioLevel = 0.16 + Math.abs(Math.sin(waveOffset * 1.8)) * 0.28;
    }
    const visualBoost = avatarEngine ? avatarEngine.audioLevel * 14 : 0;
    const audioBoost = isListening || document.body.classList.contains('jarvis-speaking')
      ? Math.max(visualBoost, 3)
      : visualBoost;

    // Golden wave
    ctx.beginPath();
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 183, 0, 0.8)';

    for (let x = 0; x < width; x++) {
      const normX = (x / width) * 2 - 1;
      const envelope = Math.exp(-normX * normX * 4.0);
      const y =
        height / 2 +
        Math.sin(x * 0.12 + waveOffset) * (4 + audioBoost) * envelope +
        Math.sin(x * 0.28 - waveOffset * 1.5) * (2 + audioBoost * 0.5) * envelope;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Cyan wave
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00e5ff';

    for (let x = 0; x < width; x++) {
      const normX = (x / width) * 2 - 1;
      const envelope = Math.exp(-normX * normX * 3.5);
      const y =
        height / 2 -
        Math.sin(x * 0.1 + waveOffset * 0.7) * (3 + audioBoost * 0.7) * envelope;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderWave();
}

// -------------------------------------------------------------
// Microphone & Speech Recognition (Voice-to-Chat Transcription)
// -------------------------------------------------------------
function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onstart = () => {
      setVoiceState('hearing');
    };

    speechRecognizer.onend = () => {
      if (isListening && !speechSuppressed) {
        clearTimeout(recognitionRestartTimer);
        recognitionRestartTimer = setTimeout(() => {
          try { speechRecognizer.start(); } catch (e) {}
        }, 180);
      }
    };

    speechRecognizer.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopListening('Microphone permission is required once to hear the wake word.');
        return;
      }
      if (isListening) setVoiceState('waiting');
    };

    speechRecognizer.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim && typingIndicator) {
        typingIndicator.classList.remove('hidden');
        typingIndicator.querySelector('.typing-text').textContent = `Hearing: "${interim}"...`;
      }

      if (finalTranscript.trim()) {
        if (typingIndicator) typingIndicator.classList.add('hidden');
        handleVoiceTranscript(finalTranscript.trim());
      }
    };
  }

  if (!speechRecognizer) {
    setVoiceState('idle');
    showToast('Voice recognition is unavailable in this browser.');
  }
}

function startListening() {
  if (!speechRecognizer || isListening) return;
  isListening = true;
  wakeWordArmed = false;
  setVoiceState('waiting');
  showToast('Jarvis standby // Say “Jarvis” to give a command');
  playCommsBeep(true);

  if (speechRecognizer) {
    try {
      speechRecognizer.start();
    } catch (e) {}
  }

}

function handleVoiceTranscript(transcript) {
  const text = transcript.trim();

  if (calculatorSession) {
    calculatorSession = false;
    setVoiceState('thinking');
    handleUserCommand(text);
    return;
  }

  const wakeMatch = text.match(/\b(?:hey\s+)?(?:jarvis|javis)\b[\s,:-]*(.*)$/i);

  if (!wakeWordArmed) {
    if (!wakeMatch) return;
    wakeWordArmed = true;
    setVoiceState('hearing');
    const command = wakeMatch[1].trim();
    if (!command) {
      speakJarvis('Yes, Sir.');
      setVoiceState('waiting');
      return;
    }
    handleUserCommand(command);
    wakeWordArmed = false;
    return;
  }

  handleUserCommand(text);
  wakeWordArmed = false;
}

let lastClapTimestamp = 0;
let prevAudioLevel = 0.0;

function stopListening(message = 'Jarvis standby') {
  isListening = false;
  wakeWordArmed = false;
  clearTimeout(recognitionRestartTimer);
  if (typingIndicator) typingIndicator.classList.add('hidden');
  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (e) {}
  }
  if (avatarEngine) avatarEngine.audioLevel = 0.0;
  setVoiceState('idle');
  showToast(message);
}

function setVoiceState(state) {
  const listeningText = document.querySelector('.listening-text');
  voiceState = state;
  document.body.classList.toggle('jarvis-hearing', state === 'hearing' || state === 'waiting');
  document.body.classList.toggle('jarvis-thinking', state === 'thinking');
  document.body.classList.toggle('jarvis-speaking', state === 'speaking');
  if (!listeningText) return;
  const labels = {
    idle: 'STANDBY',
    waiting: 'SAY JARVIS',
    hearing: 'HEARING',
    thinking: 'THINKING',
    speaking: 'SPEAKING',
  };
  listeningText.textContent = labels[state] || 'STANDBY';
}

function setCalculatorNodeState(active) {
  const calculatorNode = document.getElementById('node-calculator');
  if (calculatorNode) calculatorNode.classList.toggle('calculator-active', active);
}

// -------------------------------------------------------------
// Realistic Voice & Acoustic Mic Echo Simulation
// -------------------------------------------------------------
function playCommsBeep(isStart = true) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    if (isStart) {
      // Sci-Fi mic key-on click / chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(860, now);
      osc.frequency.exponentialRampToValueAtTime(1520, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.start(now);
      osc.stop(now + 0.055);
    } else {
      // Mic key-off squelch
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.045);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.start(now);
      osc.stop(now + 0.055);
    }
    osc.connect(gain);
    gain.connect(audioContext.destination);
  } catch (e) {}
}

function playAcousticResonanceEcho(durationSeconds = 2.0) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const biquad = audioContext.createBiquadFilter();
    const delay = audioContext.createDelay();
    const feedback = audioContext.createGain();
    const masterGain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now); // Warm spatial sub-harmonic

    biquad.type = 'bandpass';
    biquad.frequency.setValueAtTime(1350, now);
    biquad.Q.setValueAtTime(4.0, now);

    delay.delayTime.setValueAtTime(0.18, now); // 180ms spatial mic echo delay
    feedback.gain.setValueAtTime(0.35, now);

    masterGain.gain.setValueAtTime(0.04, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    osc.connect(biquad);
    biquad.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);
    biquad.connect(masterGain);
    masterGain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);
  } catch (e) {}
}

let currentSpeechUtterance = null;
function speakJarvis(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    // Trigger acoustic comms chirp and spatial echo resonance
    playCommsBeep(true);
    playAcousticResonanceEcho(Math.max(1.8, text.length * 0.075));

    currentSpeechUtterance = new SpeechSynthesisUtterance(text);
    currentSpeechUtterance.rate = 0.98;
    currentSpeechUtterance.pitch = 0.92;
    currentSpeechUtterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    // Prioritize deep, natural realistic voice profiles
    const voice = voices.find(v => v.lang.startsWith('en') && (
      v.name.includes('Natural') || 
      v.name.includes('Google UK English Male') || 
      v.name.includes('David') || 
      v.name.includes('Mark') || 
      v.name.includes('George') || 
      v.name.includes('Guy')
    ));
    if (voice) {
      currentSpeechUtterance.voice = voice;
    }

    currentSpeechUtterance.onstart = () => {
      speechSuppressed = true;
      if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
      }
      setVoiceState('speaking');
      if (avatarEngine) avatarEngine.audioLevel = 0.85;
    };
    currentSpeechUtterance.onend = () => {
      playCommsBeep(false);
      if (avatarEngine) avatarEngine.audioLevel = 0.0;
      speechSuppressed = false;
      if (isListening) {
        setVoiceState('waiting');
        clearTimeout(recognitionRestartTimer);
        recognitionRestartTimer = setTimeout(() => {
          try { speechRecognizer.start(); } catch (e) {}
        }, 250);
      } else {
        setVoiceState('idle');
      }
    };
    currentSpeechUtterance.onerror = (e) => {
      console.warn('TTS error:', e);
      if (avatarEngine) avatarEngine.audioLevel = 0.0;
      speechSuppressed = false;
      if (isListening) {
        setVoiceState('waiting');
        clearTimeout(recognitionRestartTimer);
        recognitionRestartTimer = setTimeout(() => {
          try { speechRecognizer.start(); } catch (error) {}
        }, 250);
      } else {
        setVoiceState('idle');
      }
    };

    setTimeout(() => {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(currentSpeechUtterance);
    }, 45);
  } catch (err) {
    console.warn('SpeechSynthesis exception:', err);
  }
}

// -------------------------------------------------------------
// Real-Time Webcam Hand Tracking & Optical Motion
// -------------------------------------------------------------
let isHandTracking = false;
let webcamStream = null;
let lastPrevFrame = null;

function setupWebcamTracking() {
  const camBtn = document.getElementById('cam-track-btn');
  const video = document.getElementById('webcam-feed');
  const canvas = document.getElementById('motion-canvas');

  if (!camBtn || !video || !canvas) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  camBtn.addEventListener('click', async () => {
    if (!isHandTracking) {
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 160, height: 120, facingMode: 'user' },
        });
        video.srcObject = webcamStream;
        await video.play();
        isHandTracking = true;
        camBtn.classList.add('active');
        showToast('Hand Tracking Active // Move Hand to Rotate 3D Face');
        trackHandMotionLoop();
      } catch (err) {
        console.warn('Webcam access error:', err);
        showToast('Webcam access unavailable. Using interactive mouse tracking.');
      }
    } else {
      stopWebcamTracking();
    }
  });

  function stopWebcamTracking() {
    isHandTracking = false;
    if (camBtn) camBtn.classList.remove('active');
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      webcamStream = null;
    }
    if (avatarEngine) {
      avatarEngine.setHeadRotation(0, 0);
    }
    showToast('Hand Tracking Standby');
  }

  function trackHandMotionLoop() {
    if (!isHandTracking) return;

    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      ctx.drawImage(video, 0, 0, 80, 60);
      const frame = ctx.getImageData(0, 0, 80, 60);
      const data = frame.data;

      if (lastPrevFrame) {
        const prevData = lastPrevFrame.data;
        let sumX = 0;
        let sumY = 0;
        let motionPixels = 0;

        for (let y = 0; y < 60; y += 2) {
          for (let x = 0; x < 80; x += 2) {
            const i = (y * 80 + x) * 4;
            const diff =
              Math.abs(data[i] - prevData[i]) +
              Math.abs(data[i + 1] - prevData[i + 1]) +
              Math.abs(data[i + 2] - prevData[i + 2]);

            // Motion or hand presence
            if (diff > 45) {
              sumX += x;
              sumY += y;
              motionPixels++;
            }
          }
        }

        if (motionPixels > 10) {
          const avgX = sumX / motionPixels;
          const avgY = sumY / motionPixels;

          // Invert X so user moving hand to their right rotates face to the right
          const targetYaw = (0.5 - avgX / 80) * 1.5;
          const targetPitch = (0.5 - avgY / 60) * 0.7;

          if (avatarEngine) {
            avatarEngine.setHeadRotation(targetYaw, targetPitch);
          }
        }
      }

      lastPrevFrame = frame;
    }

    requestAnimationFrame(trackHandMotionLoop);
  }
}

function setupMouseFaceTracking() {
  window.addEventListener('mousemove', (e) => {
    if (isHandTracking) return;
    const normX = (e.clientX / window.innerWidth - 0.5) * 2.0;
    const normY = (e.clientY / window.innerHeight - 0.5) * 2.0;
    if (avatarEngine) {
      avatarEngine.setHeadRotation(-normX * 0.65, -normY * 0.3);
    }
  });
}

let toastTimer = null;
function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  toastText.textContent = message;
  toastEl.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}
