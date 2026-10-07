const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = 8001;
const STATIC_DIR = path.join(__dirname, 'static');
const SETVOL_EXE = path.join(__dirname, 'setvol.exe');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function calculateVoiceExpression(input) {
  const numberWords = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const scales = { hundred: 100, thousand: 1000, million: 1000000 };

  function parseSpokenNumber(value) {
    const cleaned = value.toLowerCase().replace(/-/g, ' ').replace(/\band\b/g, ' ').trim();
    if (/^\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.some((token) => !(token in numberWords) && !(token in scales) && token !== 'point')) return null;

    const pointIndex = tokens.indexOf('point');
    const wholeTokens = pointIndex === -1 ? tokens : tokens.slice(0, pointIndex);
    const decimalTokens = pointIndex === -1 ? [] : tokens.slice(pointIndex + 1);
    let total = 0;
    let current = 0;

    for (const token of wholeTokens) {
      if (token in numberWords) {
        current += numberWords[token];
      } else if (token === 'hundred') {
        current = (current || 1) * 100;
      } else if (token === 'thousand' || token === 'million') {
        total += (current || 1) * scales[token];
        current = 0;
      }
    }

    const whole = total + current;
    if (pointIndex === -1) return whole;
    if (!decimalTokens.length || decimalTokens.some((token) => !(token in numberWords))) return null;
    const decimal = decimalTokens.map((token) => numberWords[token]).join('');
    return Number(`${whole}.${decimal}`);
  }

  const expression = input.toLowerCase()
    .replace(/[!?;,]/g, ' ')
    .replace(/\.$/, '')
    .replace(/what is|calculate|calculation|work out|please|equals|equal to|the answer|is/g, ' ')
    .replace(/multiplied by|multiply by|times|multiply/g, '*')
    .replace(/divided by|divide by|divide/g, '/')
    .replace(/plus|add/g, '+')
    .replace(/minus|subtract/g, '-')
    .replace(/\bx\b/g, '*');

  const parts = expression.split(/([+*/()\-])/).map((part) => {
    if (/^[+*/()\-]$/.test(part.trim())) return part.trim();
    const value = parseSpokenNumber(part);
    return value === null ? part : String(value);
  });
  const normalizedExpression = parts.join('').replace(/\s+/g, '');

  if (!normalizedExpression || !/^[0-9+*/().\-]+$/.test(normalizedExpression)) return null;
  const numbers = normalizedExpression.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return null;

  const result = Function(`"use strict"; return (${normalizedExpression});`)();
  return Number.isFinite(result) ? { expression: normalizedExpression, result: result } : null;
}

function enterCalculatorExpression(expression) {
  const safeExpression = String(expression || '').replace(/[^0-9+*/().\-]/g, '');
  if (!safeExpression) return;

  const script = [
    '$shell = New-Object -ComObject WScript.Shell',
    '$shell.AppActivate("Calculator")',
    'Start-Sleep -Milliseconds 180',
    `$shell.SendKeys('${safeExpression.replace(/([+^%~(){}\[\]])/g, '{$1}')}')`,
    '$shell.SendKeys("{ENTER}")',
  ].join('; ');

  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', encodedScript], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

// System Action Execution
function executeSystemAction(action, params = {}) {
  action = (action || '').toLowerCase().trim();

  return new Promise((resolve) => {
    // Exact Volume Set by Percentage
    if (action === 'set_volume') {
      let percent = parseInt(params.percent !== undefined ? params.percent : params.level);
      if (isNaN(percent)) percent = 50;
      percent = Math.max(0, Math.min(100, percent));

      if (fs.existsSync(SETVOL_EXE)) {
        exec(`"${SETVOL_EXE}" ${percent}`, () => {
          resolve({
            status: 'success',
            message: `Master volume set to ${percent}%`,
            current_volume: percent,
          });
        });
      } else {
        resolve({ status: 'success', message: `Volume set to ${percent}%` });
      }
    } else if (action === 'get_volume') {
      if (fs.existsSync(SETVOL_EXE)) {
        exec(`"${SETVOL_EXE}"`, (err, stdout) => {
          const match = (stdout || '').match(/CURRENT:(\d+)/);
          const current = match ? parseInt(match[1]) : 50;
          resolve({ status: 'success', volume: current });
        });
      } else {
        resolve({ status: 'success', volume: 50 });
      }
    } else if (action === 'volume_up') {
      if (fs.existsSync(SETVOL_EXE)) {
        exec(`"${SETVOL_EXE}"`, (err, stdout) => {
          const match = (stdout || '').match(/CURRENT:(\d+)/);
          const current = match ? parseInt(match[1]) : 50;
          const next = Math.min(100, current + 10);
          exec(`"${SETVOL_EXE}" ${next}`, () => {
            resolve({ status: 'success', message: `Volume increased to ${next}%`, current_volume: next });
          });
        });
      } else {
        exec('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"', () => {
          resolve({ status: 'success', message: 'Volume increased' });
        });
      }
    } else if (action === 'volume_down') {
      if (fs.existsSync(SETVOL_EXE)) {
        exec(`"${SETVOL_EXE}"`, (err, stdout) => {
          const match = (stdout || '').match(/CURRENT:(\d+)/);
          const current = match ? parseInt(match[1]) : 50;
          const next = Math.max(0, current - 10);
          exec(`"${SETVOL_EXE}" ${next}`, () => {
            resolve({ status: 'success', message: `Volume reduced to ${next}%`, current_volume: next });
          });
        });
      } else {
        exec('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"', () => {
          resolve({ status: 'success', message: 'Volume decreased' });
        });
      }
    } else if (action === 'volume_mute') {
      exec('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', () => {
        resolve({ status: 'success', message: 'Audio mute toggled' });
      });
    }

    // Launch Applications with exact voice quotes
    else if (action === 'launch_app') {
      const app = (params.app || '').toLowerCase().trim();

      if (app === 'whatsapp') {
        exec('powershell -NoProfile -Command "Start-Process whatsapp:"', () => {
          resolve({ status: 'success', message: 'Sir, opening WhatsApp...', voice: 'Sir, opening WhatsApp' });
        });
      } else if (app === 'calc' || app === 'calculator') {
        // Windows Calculator may keep the shell callback open; acknowledge immediately.
        exec('start "" "calc.exe"');
        resolve({ status: 'success', message: 'Sir, opening Calculator...', voice: 'Sir, opening Calculator' });
      } else if (app === 'code' || app === 'vscode') {
        exec('start "" "code"', () => {
          resolve({ status: 'success', message: 'Sir, opening Visual Studio Code...', voice: 'Sir, opening Visual Studio Code' });
        });
      } else if (app === 'chrome') {
        exec('start "" "chrome.exe"', () => {
          resolve({ status: 'success', message: 'Sir, opening Google Chrome...', voice: 'Sir, opening Google Chrome' });
        });
      } else if (app === 'notepad') {
        exec('start "" "notepad.exe"', () => {
          resolve({ status: 'success', message: 'Sir, opening Notepad...', voice: 'Sir, opening Notepad' });
        });
      } else if (app === 'explorer' || app === 'drive') {
        exec('start "" "explorer.exe"', () => {
          resolve({ status: 'success', message: 'Sir, opening File Explorer...', voice: 'Sir, opening File Explorer' });
        });
      } else if (app === 'taskmgr') {
        exec('start "" "taskmgr.exe"', () => {
          resolve({ status: 'success', message: 'Sir, opening Task Manager...', voice: 'Sir, opening Task Manager' });
        });
      } else {
        exec(`start "" "${app}"`, () => {
          resolve({ status: 'success', message: `Sir, launching ${app}...`, voice: `Sir, launching ${app}` });
        });
      }
    }

    // WhatsApp Automatic Contact Search & Message Sending Action
    else if (action === 'send_whatsapp_message') {
      const recipient = (params.recipient || '').trim();
      const message = (params.message || '').trim();
      const psScript = path.join(__dirname, 'whatsapp_send.ps1');

      if (fs.existsSync(psScript)) {
        const contactArg = recipient.replace(/"/g, '`"');
        const msgArg = message.replace(/"/g, '`"');

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -Contact "${contactArg}" -Message "${msgArg}"`, (err, stdout) => {
          resolve({
            status: 'success',
            message: `Sir, searched ${recipient} in WhatsApp and dispatched message automatically.`,
            voice: `Sir, searching ${recipient} in WhatsApp and sending message now.`
          });
        });
      } else {
        // Fallback to URI scheme
        let cleanPhone = recipient.replace(/[^0-9]/g, '');
        let targetUrl = cleanPhone
          ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
          : `whatsapp://send?text=${encodeURIComponent(message)}`;
        exec(`powershell -NoProfile -Command "Start-Process '${targetUrl}'"`, () => {
          resolve({
            status: 'success',
            message: `Dispatched message to ${recipient}`,
            voice: `Sir, opening WhatsApp to message ${recipient}`
          });
        });
      }
    }

    // Web Search / URL
    else if (action === 'open_chrome' || action === 'open_url') {
      let url = params.url || 'https://www.google.com';
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      exec(`start "" "${url}"`, () => {
        resolve({ status: 'success', message: `Opened ${url}`, voice: 'Sir, opening Google Chrome' });
      });
    } else if (action === 'search_web') {
      const query = encodeURIComponent(params.query || 'Jarvis AI');
      const url = `https://www.google.com/search?q=${query}`;
      exec(`start "" "${url}"`, () => {
        resolve({ status: 'success', message: `Searching web for: ${params.query}` });
      });
    }

    // System Telemetry
    else if (action === 'get_system_stats') {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const ramPercent = Math.round((usedMem / totalMem) * 100);

      const cpus = os.cpus();
      let idle = 0;
      let total = 0;
      cpus.forEach((cpu) => {
        for (let type in cpu.times) {
          total += cpu.times[type];
        }
        idle += cpu.times.idle;
      });
      const cpuPercent = Math.round(100 - (idle / total) * 100);

      let currentVol = 50;
      if (fs.existsSync(SETVOL_EXE)) {
        try {
          const out = require('child_process').execSync(`"${SETVOL_EXE}"`).toString();
          const match = out.match(/CURRENT:(\d+)/);
          if (match) currentVol = parseInt(match[1]);
        } catch (e) {}
      }

      resolve({
        status: 'success',
        cpu: Math.max(8, cpuPercent),
        ram_percent: ramPercent,
        ram_used_gb: (usedMem / (1024 ** 3)).toFixed(1),
        ram_total_gb: (totalMem / (1024 ** 3)).toFixed(1),
        volume: currentVol,
      });
    } else {
      resolve({ status: 'error', message: `Unknown action: ${action}` });
    }
  });
}

// Intelligent Conversational AI Responder
function generateJarvisResponse(userText) {
  const text = (userText || '').trim();
  const lower = text.toLowerCase();

  // 1. Wake acknowledgement after the browser has captured the wake word.
  if (lower.includes('wake up') || lower === 'awake') {
    return {
      voice: 'I am awake, Sir. All core systems are ready.',
      text: 'I am awake, Sir. All core systems are ready.'
    };
  }

  // 2. Personal Greeting to Ashfaq
  if (lower.includes('how is day') || lower.includes('how is the day') || lower.includes('how are you') || lower.includes('hello jarvis') || lower.includes('hi jarvis')) {
    return {
      voice: "Day is going good, Ashfaq. All core systems are running at peak efficiency. What shall we explore or build today?",
      text: "Day is going good, Ashfaq. All core systems are running at peak performance. What shall we explore or build today, Sir?"
    };
  }

  // 2. Questions about building a website
  if (lower.includes('build website') || lower.includes('make website') || lower.includes('create a website') || lower.includes('web development')) {
    return {
      voice: "To build a modern high-performance website, Ashfaq, we structure it in 3 core layers: Frontend UI using React or Three.js for 3D visuals, Backend API using Node.js or FastAPI, and Cloud Hosting with real-time WebSockets. Tell me what type of website you want to create, and I will draft the architecture.",
      text: "### Website Architecture Overview (For Ashfaq)\n\n1. **Frontend Interface:** HTML5, CSS3 Glassmorphism, and Three.js for sci-fi 3D graphics or Next.js for high-speed web apps.\n2. **Backend & Automation:** Node.js (Express / WebSockets) or Python (FastAPI) for instant system control and data pipelines.\n3. **Database & Storage:** PostgreSQL, MongoDB, or Supabase for user data and real-time syncing.\n4. **Deployment:** Vercel, Netlify, or Docker containerization for 99.9% uptime.\n\n*What specific website concept would you like to build right now, Sir?*"
    };
  }

  // 3. General Knowledge / Technology questions
  if (lower.includes('who are you') || lower.includes('what is jarvis')) {
    return {
      voice: "I am Jarvis, your personal AI operating system and autonomous companion, engineered by reznikov_engineering with real-time neural avatars and deep system intelligence.",
      text: "I am **JARVIS**, your autonomous AI operating assistant. I monitor your system telemetry, control Windows volume and applications, animate a real-time 3D particle avatar, and execute communication workflows for you, Ashfaq."
    };
  }

  if (lower.includes('what is ai') || lower.includes('artificial intelligence')) {
    return {
      voice: "Artificial Intelligence, Ashfaq, is the capability of computing machines to simulate human cognitive functions such as learning, pattern recognition, problem solving, and autonomous execution.",
      text: "**Artificial Intelligence (AI)** is the simulation of human intelligence processes by machines and computer systems, encompassing Machine Learning, Deep Neural Networks, Natural Language Processing, and Autonomous Agents."
    };
  }

  // Default conversational answer
  return {
    voice: `I have analyzed your request, Ashfaq: "${text}". Standing by for your command.`,
    text: `Understood, Ashfaq. I have processed: *"${text}"*.\n\nLet me know if you would like me to execute this action, open an application, or research further details.`
  };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await executeSystemAction(payload.action, payload.params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/stats') {
    const stats = await executeSystemAction('get_system_stats');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = reqPath.startsWith('/static/')
    ? path.join(__dirname, reqPath)
    : path.join(STATIC_DIR, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const jsonStr = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

wss.on('connection', async (ws) => {
  // Keep each browser's guided voice conversation independent.
  const conversationState = {
    user_name: 'Ashfaq',
    mode: 'NORMAL',
    whatsappData: {
      recipient: '',
      message: '',
      attachment: null,
    },
  };
  const stats = await executeSystemAction('get_system_stats');
  ws.send(JSON.stringify({ type: 'stats', data: stats }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'action') {
        const result = await executeSystemAction(data.action, data.params);
        ws.send(JSON.stringify({ type: 'action_result', data: result }));
      } else if (data.type === 'voice_command') {
        const rawCmd = (data.command || '').trim();
        const lower = rawCmd.toLowerCase();

        if (conversationState.mode === 'CALCULATOR') {
          if (lower.includes('close calculator') || lower.includes('close calc') || lower === 'calculator close') {
            conversationState.mode = 'NORMAL';
            ws.send(JSON.stringify({
              type: 'jarvis_response',
              text: 'Calculator session closed, Sir.',
              voice: 'Calculator session closed, Sir.',
              calculator_mode: 'closed',
            }));
            return;
          }

          ws.send(JSON.stringify({ type: 'jarvis_response', text: 'Thinking...', calculator_mode: 'thinking' }));
          await new Promise((resolve) => setTimeout(resolve, 450));
          const calculation = calculateVoiceExpression(rawCmd);

          if (calculation === null) {
            const reply = 'I could not read that calculation, Sir. Please say the numbers and operation again.';
            conversationState.mode = 'CALCULATOR';
            ws.send(JSON.stringify({
              type: 'jarvis_response',
              text: reply,
              voice: reply,
              calculator_mode: 'retry',
            }));
          } else {
            conversationState.mode = 'NORMAL';
            enterCalculatorExpression(calculation.expression);
            const reply = `Done, Sir. The answer is ${calculation.result}.`;
            ws.send(JSON.stringify({
              type: 'jarvis_response',
              text: reply,
              voice: reply,
              calculator_mode: 'complete',
              calculation_result: calculation.result,
              calculator_expression: calculation.expression,
            }));
          }
          return;
        }

        // -------------------------------------------------------------
        // WHATSAPP GUIDED CONVERSATION STATE MACHINE
        // -------------------------------------------------------------
        if (conversationState.mode === 'WHATSAPP_RECIPIENT') {
          conversationState.whatsappData.recipient = rawCmd;
          conversationState.mode = 'WHATSAPP_MESSAGE';
          const reply = `Recipient noted as ${rawCmd}. What message would you like to send, Ashfaq?`;
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: reply,
            whatsapp_step: 'awaiting_message',
          }));
          return;
        }

        if (conversationState.mode === 'WHATSAPP_MESSAGE') {
          conversationState.whatsappData.message = rawCmd;
          conversationState.mode = 'WHATSAPP_CONFIRM';
          const recipient = conversationState.whatsappData.recipient;
          const msg = conversationState.whatsappData.message;
          const reply = `The message is: "${msg}" to ${recipient}. Shall I send it now, Sir?`;
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: `The message is: "${msg}" to ${recipient}. Shall I send it now, Sir?`,
            whatsapp_step: 'awaiting_confirm',
            whatsapp_card: {
              recipient: recipient,
              message: msg,
            }
          }));
          return;
        }

        if (conversationState.mode === 'WHATSAPP_CONFIRM') {
          if (lower.includes('yes') || lower.includes('send') || lower.includes('ok') || lower.includes('confirm')) {
            const recipient = conversationState.whatsappData.recipient;
            const msg = conversationState.whatsappData.message;
            conversationState.mode = 'NORMAL';
            await executeSystemAction('send_whatsapp_message', { recipient: recipient, message: msg });
            const reply = `Message sent to ${recipient} successfully, Ashfaq!`;
            ws.send(JSON.stringify({
              type: 'jarvis_response',
              text: reply,
              voice: `Sir, sending WhatsApp message now. Process complete.`,
              whatsapp_step: 'sent'
            }));
            return;
          } else if (lower.includes('no') || lower.includes('cancel') || lower.includes('stop')) {
            conversationState.mode = 'NORMAL';
            const reply = "WhatsApp message cancelled, Sir.";
            ws.send(JSON.stringify({
              type: 'jarvis_response',
              text: reply,
              voice: reply,
              whatsapp_step: 'cancelled'
            }));
            return;
          }
        }

        // Direct One-Liner: "send message to Infas B hello are you free" or "whatsapp to Munzil call me"
        const directMatch = rawCmd.match(/(?:send\s+(?:a\s+)?(?:whatsapp\s+)?message\s+to|whatsapp\s+to|send\s+whatsapp\s+to)\s+([a-zA-Z0-9\s\+]+?)\s+(?:saying|that|message|with|content)?\s*[:,-]?\s*(.+)$/i);
        if (directMatch && !lower.includes('send message on whatsapp')) {
          const contact = directMatch[1].trim();
          const messageText = directMatch[2].trim();
          conversationState.mode = 'WHATSAPP_CONFIRM';
          conversationState.whatsappData.recipient = contact;
          conversationState.whatsappData.message = messageText;

          const reply = `The message is: "${messageText}" to ${contact}. Shall I send it now, Sir?`;
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: `The message is: "${messageText}" to ${contact}. Shall I send it now, Sir?`,
            whatsapp_step: 'awaiting_confirm',
            whatsapp_card: {
              recipient: contact,
              message: messageText,
            }
          }));
          return;
        }

        // Trigger WhatsApp Guided Flow
        if (lower.includes('send message on whatsapp') || lower.includes('send whatsapp message') || lower.includes('whatsapp message') || lower.includes('send whatsapp') || lower.includes('send a message')) {
          conversationState.mode = 'WHATSAPP_RECIPIENT';
          const reply = "Who would you like to send the WhatsApp message to, Ashfaq? Please say the contact name or phone number.";
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: reply,
            whatsapp_step: 'awaiting_recipient',
            contact_suggestions: ['Infas B', 'Munzil', 'Aaysha Hutch', '3w Nisthar Fazal Nana House', 'My Number']
          }));
          return;
        }

        // -------------------------------------------------------------
        // VOLUME CONVERSATION STATE MACHINE
        // -------------------------------------------------------------
        const numberMatch = lower.match(/\b(\d{1,3})\b/);
        if (conversationState.mode === 'AWAITING_VOLUME' && numberMatch) {
          const percent = parseInt(numberMatch[1]);
          await executeSystemAction('set_volume', { percent: percent });
          conversationState.mode = 'NORMAL';
          const reply = `Master volume set to ${percent} percent, Sir.`;
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: reply,
            action: 'volume_updated',
            volume: percent
          }));
          return;
        }

        if (lower.includes('volume') && numberMatch) {
          const percent = parseInt(numberMatch[1]);
          await executeSystemAction('set_volume', { percent: percent });
          conversationState.mode = 'NORMAL';
          const reply = `Master volume set to ${percent} percent, Sir.`;
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: reply,
            action: 'volume_updated',
            volume: percent
          }));
          return;
        }

        if (lower.includes('reduce volume') || lower.includes('decrease volume') || lower.includes('change volume') || lower === 'volume') {
          conversationState.mode = 'AWAITING_VOLUME';
          const reply = 'What percentage would you like me to set the volume to, Sir? (e.g., 50% or 45%)';
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: reply,
            voice: reply,
            prompt_type: 'volume_selection',
            options: [25, 45, 50, 75, 100]
          }));
          return;
        }

        // -------------------------------------------------------------
        // APPLICATION LAUNCHING (With requested verbal confirmations)
        // -------------------------------------------------------------
        if (lower.includes('open whatsapp') || lower === 'whatsapp') {
          await executeSystemAction('launch_app', { app: 'whatsapp' });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Sir, opening WhatsApp...',
            voice: 'Sir, opening WhatsApp'
          }));
          return;
        }

        if (lower.includes('open calculator') || lower.includes('calc') || lower.includes('cluter') || lower.includes('caluter')) {
          await executeSystemAction('launch_app', { app: 'calc' });
          conversationState.mode = 'CALCULATOR';
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Sir, opening Calculator...',
            voice: 'Sir, opening Calculator. Say the calculation when ready.',
            calculator_mode: 'awaiting_expression'
          }));
          return;
        }

        if (lower.includes('open vs code') || lower.includes('open code') || lower.includes('vscode')) {
          await executeSystemAction('launch_app', { app: 'code' });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Sir, opening Visual Studio Code...',
            voice: 'Sir, opening Visual Studio Code'
          }));
          return;
        }

        // -------------------------------------------------------------
        // CHROME SEARCH & REAL-TIME URL NAVIGATION
        // -------------------------------------------------------------
        const domainMatch = rawCmd.match(/(?:search|open|go to|navigate to)?\s*([a-zA-Z0-9-]+\.(?:com|org|net|io|ai|co|in|edu|gov|me|app)[a-zA-Z0-9\/\-_\?\=\&]*)/i);
        const chromeSearchMatch = rawCmd.match(/(?:open\s+(?:the\s+)?chrome\s+and\s+search|search\s+(?:in\s+chrome|on\s+chrome|google|on\s+google|for)?)\s+(.+)$/i);

        if (domainMatch) {
          const site = domainMatch[1].trim();
          let fullUrl = site.startsWith('http://') || site.startsWith('https://') ? site : `https://${site}`;
          await executeSystemAction('open_url', { url: fullUrl });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: `Sir, opening and searching ${site} in Google Chrome...`,
            voice: `Sir, searching ${site} in Google Chrome`
          }));
          return;
        }

        if (chromeSearchMatch && (lower.includes('chrome') || lower.includes('search'))) {
          const query = chromeSearchMatch[1].trim();
          await executeSystemAction('search_web', { query: query });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: `Sir, searching "${query}" in Google Chrome...`,
            voice: `Sir, searching ${query} in Google Chrome`
          }));
          return;
        }

        // Natural voice aliases for every application exposed by the HUD.
        const openAppMatch = lower.match(/^(?:please\s+)?(?:open|launch|start)\s+(?:the\s+)?(.+?)\s*$/i);
        if (openAppMatch) {
          const requestedApp = openAppMatch[1].trim().replace(/\s+/g, ' ');
          const appAliases = [
            { names: ['calculator', 'calc', 'calcu later', 'cluter', 'caluter'], app: 'calc', label: 'Calculator' },
            { names: ['chrome', 'google chrome', 'browser'], app: 'chrome', label: 'Google Chrome' },
            { names: ['whatsapp', 'what sap'], app: 'whatsapp', label: 'WhatsApp' },
            { names: ['vs code', 'visual studio code', 'code', 'vscode'], app: 'code', label: 'Visual Studio Code' },
            { names: ['notepad', 'text editor', 'editor'], app: 'notepad', label: 'Notepad' },
            { names: ['file explorer', 'windows explorer', 'explorer', 'drive'], app: 'explorer', label: 'File Explorer' },
            { names: ['task manager', 'taskmgr', 'tasks'], app: 'taskmgr', label: 'Task Manager' },
          ];
          const matchedApp = appAliases.find((entry) => entry.names.includes(requestedApp));

          if (matchedApp) {
            await executeSystemAction('launch_app', { app: matchedApp.app });
            const reply = `Sir, opening ${matchedApp.label}.`;
            ws.send(JSON.stringify({ type: 'jarvis_response', text: reply, voice: reply }));
            return;
          }
        }

        if (lower.includes('open chrome') || lower === 'chrome' || lower === 'browser') {
          await executeSystemAction('launch_app', { app: 'chrome' });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Sir, opening Google Chrome...',
            voice: 'Sir, opening Google Chrome'
          }));
          return;
        }

        if (lower.includes('open notepad') || lower.includes('editor')) {
          await executeSystemAction('launch_app', { app: 'notepad' });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Sir, opening Notepad...',
            voice: 'Sir, opening Notepad'
          }));
          return;
        }

        if (lower.includes('face') || lower.includes('show me your face')) {
          broadcast({ type: 'morph_face', step: 5 });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Assembling neural face matrix, Ashfaq.',
            voice: 'Assembling neural face matrix, Ashfaq.'
          }));
          return;
        }

        if (lower.includes('hud') || lower.includes('interface') || lower.includes('close face')) {
          broadcast({ type: 'morph_face', step: 1 });
          ws.send(JSON.stringify({
            type: 'jarvis_response',
            text: 'Returning to main command HUD, Sir.',
            voice: 'Returning to main command HUD, Sir.'
          }));
          return;
        }

        // -------------------------------------------------------------
        // CONVERSATIONAL INTELLIGENCE / GENERAL KNOWLEDGE / CODING
        // -------------------------------------------------------------
        const aiResp = generateJarvisResponse(rawCmd);
        ws.send(JSON.stringify({
          type: 'jarvis_response',
          text: aiResp.text,
          voice: aiResp.voice,
        }));
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });
});

setInterval(async () => {
  if (wss.clients.size > 0) {
    const stats = await executeSystemAction('get_system_stats');
    broadcast({ type: 'stats', data: stats });
  }
}, 2500);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`===================================================`);
  console.log(`⚡ JARVIS AI CORE RUNNING AT http://localhost:${PORT}`);
  console.log(`⚡ Ashfaq Voice Assistant & WhatsApp Automation Ready`);
  console.log(`===================================================`);
});
