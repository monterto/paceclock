/*
Copyright © 2026 monterto

Licensed under the PolyForm Noncommercial License 1.0.0.
Commercial use is prohibited.
See the LICENSE file for details.
*/

const state = {
  dark: true, //Dark/Light face
  trackRest: true, // Default is on
  guard: true, //Double tap guard
  ghostHand: true, // Default ghost hand visibility to true
  thickerHands: true, // Default hands thickness to true
  hands: [
    { color:'#ff4d4d', offset:0 },
    { color:'#4da3ff', offset:15 },
    { color:'#4dff88', offset:30 },
    { color:'#ffd24d', offset:45 }
  ],
  ghost: null,
  laps: [],
  lastTap: null,
  sessionStart: null,
  mode: 'rest',  // Start in rest mode (first)
  hasCompletedLap: false,
  lastSplit: 0,
  timerRunning: false,
  digitalTimerRunning: false,
  isFinished: false,
  lapCount: 1  // Start lap count at 1
};
// save state
const saved = localStorage.getItem('clockSettings');
if (saved) {
  const s = JSON.parse(saved);
  state.dark = s.dark ?? state.dark;
  state.trackRest = s.trackRest ?? state.trackRest;
  state.guard = s.guard ?? state.guard;
  state.ghostHand = s.ghostHand ?? state.ghostHand;
  state.thickerHands = s.thickerHands ?? state.thickerHands;
}

const MIN_PRESS = 1000;

const canvas = document.getElementById('clock');
const ctx = canvas.getContext('2d');
const digital = document.getElementById('digital');
const totalClock = document.getElementById('totalClock');
const list = document.getElementById('list');
const toggleRestBtn = document.getElementById('toggleRestBtn');
const ghostToggle = document.getElementById('ghostToggle'); // Reference to the ghost toggle checkbox
const thickerHandsToggle = document.getElementById('thickerHandsToggle'); // Reference to thicker hands toggle checkbox
const guardToggle = document.getElementById('guardToggle'); // Reference to guard toggle checkbox
const infoBtn = document.getElementById('infoBtn');
const infoPanel = document.getElementById('infoPanel');
const optionsBtn = document.getElementById('optionsBtn');
const options = document.getElementById('options');
const darkToggle = document.getElementById('darkToggle');
const resetBtn = document.getElementById('resetBtn');

// Panels toggle: only one open at a time
infoBtn.addEventListener('click', () => {
  options.classList.remove('open');     // Close options
  infoPanel.classList.toggle('open');   // Toggle info panel
});

optionsBtn.addEventListener('click', () => {
  infoPanel.classList.remove('open');   // Close info
  options.classList.toggle('open');     // Toggle options panel
});

// Close panels when clicking outside content
infoPanel.addEventListener('click', (e) => {
  if (e.target === infoPanel) infoPanel.classList.remove('open');
});

options.addEventListener('click', (e) => {
  if (e.target === options) options.classList.remove('open');
});


// Initialize the UI to match the restored state
darkToggle.checked = state.dark;
toggleRestBtn.textContent = state.trackRest ? 'Rest ✓' : 'Rest ✗';
digital.classList.toggle('rest', state.mode === 'rest');
ghostToggle.checked = state.ghostHand;
thickerHandsToggle.checked = state.thickerHands;
guardToggle.checked = state.guard;

let timerInterval = null;
let digitalTimerInterval = null;

// Request the wake lock to keep the screen on
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    }
  } catch (err) {
    console.error('Error requesting wake lock:', err);
  }
}

// Release wake lock when the app is closed or switched
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}

// Request wake lock when the app is focused
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
});

// Request wake lock when the app is first opened
requestWakeLock();

// function for savestate
function saveSettings() {
  const settings = {
    dark: state.dark,
    trackRest: state.trackRest,
    guard: state.guard,
    ghostHand: state.ghostHand,
    thickerHands: state.thickerHands
  };
  localStorage.setItem('clockSettings', JSON.stringify(settings));
}


// Format function for displaying time
function fmt(ms){
  const t = Math.floor(ms/100);
  return `${String(Math.floor(t/600)).padStart(2,'0')}:${String(Math.floor(t/10)%60).padStart(2,'0')}.${t%10}`;
}

function drawClock(){
  ctx.clearRect(0,0,360,360);
  const cx=180, cy=180, r=162;

  ctx.fillStyle = state.dark ? '#0b0f14' : '#f2f2f2';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();

  ctx.lineWidth=4;
  ctx.strokeStyle = state.dark ? '#444':'#111';
  ctx.stroke();

  for(let i=0;i<60;i++){
    const a=i*Math.PI/30-Math.PI/2;
    const m=i%5===0;
    ctx.lineWidth=m?3:1;
    ctx.strokeStyle=state.dark?'#555':'#111';
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
    ctx.lineTo(cx+Math.cos(a)*(r-(m?28:14)),cy+Math.sin(a)*(r-(m?28:14)));
    ctx.stroke();
  }

  ctx.fillStyle=state.dark?'#9aa4b2':'#000';
  ctx.font='bold 28px system-ui';  // Set font size for the clock numbers
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  for(let n=5;n<=60;n+=5){
    const a=n*Math.PI/30-Math.PI/2;
    ctx.fillText(n,cx+Math.cos(a)*(r-52),cy+Math.sin(a)*(r-52));
  }

  const base=(Date.now()/1000)%60;
  state.hands.forEach(h=>{
    const s=(base+h.offset)%60;
    const a=s*Math.PI/30-Math.PI/2;
    const length = r - 28;
const baseWidth = state.thickerHands ? 6 : 3; 

// --- outline ---
ctx.strokeStyle = '#000';
ctx.lineWidth = baseWidth + 2; // 1px outline on each side
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(
  cx + Math.cos(a) * length,
  cy + Math.sin(a) * length
);
ctx.stroke();

// --- colored hand ---
ctx.strokeStyle = h.color;
ctx.lineWidth = baseWidth;
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(
  cx + Math.cos(a) * length,
  cy + Math.sin(a) * length
);
ctx.stroke();

  });

  if(state.ghost && state.ghostHand){  // Check if ghost hand is enabled
    const a=state.ghost.seconds*Math.PI/30-Math.PI/2;
    ctx.globalAlpha=.4;
    ctx.strokeStyle=state.ghost.color;
    ctx.lineWidth=6;  // Ghost hand uses thicker line if enabled
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(a)*(r-28),cy+Math.sin(a)*(r-28));
    ctx.stroke();
    ctx.globalAlpha=1;
  }

  ctx.fillStyle=state.dark?'#777':'#000';
  ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2); ctx.fill();
}

(function render(){
  drawClock();
  requestAnimationFrame(render);
})();

canvas.addEventListener('pointerdown',()=>{
  if (state.isFinished) return;

  const now=Date.now();
  if(!state.sessionStart) state.sessionStart=now;

  if(state.guard && state.lastTap && now-state.lastTap<MIN_PRESS) return;

  if(state.lastTap){
    const duration=now-state.lastTap;
    state.laps.push({type:state.mode,time:duration});
    if(state.mode==='lap') state.hasCompletedLap=true;
    addRow(state.laps[state.laps.length-1]);

    if(state.laps.length > 1) {
      const lastLap = state.laps[state.laps.length - 1];
      const prevLap = state.laps[state.laps.length - 2];
      state.lastSplit = lastLap.time - prevLap.time;
    }
  }

  state.lastTap=now;

  // If rest tracking is enabled, after a lap, switch to rest mode
  if (state.trackRest && state.mode === 'lap') {
    state.mode = 'rest';  // Switch to rest mode after lap
  } else if (state.mode === 'rest') {
    state.mode = 'lap';  // Switch to lap mode after rest
  }

  digital.classList.toggle('rest', state.mode === 'rest');

  const base = (now / 1000) % 60;
  let best = { d: Infinity };
  state.hands.forEach(h => {
    const s = (base + h.offset) % 60;
    const d = 60 - s;
    if (d >= 0 && d < best.d) best = { seconds: s, color: h.color, d };
  });
  state.ghost = best;

  if (!state.digitalTimerRunning) {
    startDigitalTimer();
    state.digitalTimerRunning = true;
  }
});

function addRow(l) {
  if (l.type === 'rest' && !state.trackRest) return;

  let delta = '', cls = '';
  if (l.type === 'lap') {
    const lapsOnly = state.laps.filter(x => x.type === 'lap');
    if (lapsOnly.length > 1) {
      const prev = lapsOnly[lapsOnly.length - 2].time;
      const diff = l.time - prev;
      delta = (diff < 0 ? '-' : '+') + fmt(Math.abs(diff));
      cls = diff < 0 ? 'fast' : 'slow';
    }
    // Add lap number before lap time
    l.number = state.lapCount++;
  }

  const row = document.createElement('div');
  row.className = 'row' + (l.type === 'rest' ? ' rest' : '');
  row.innerHTML = `
    <span>${l.type === 'lap' ? `Lap ${l.number}` : l.type}</span>
    <span>
      ${delta ? `<span class="delta ${cls}">${delta}</span>` : ''}
      ${fmt(l.time)}
    </span>`;
  list.prepend(row);
}

function startDigitalTimer() {
  digitalTimerInterval = setInterval(() => {
    if (state.lastTap) {
      const now = Date.now();
      digital.textContent = fmt(now - state.lastTap);
      totalClock.textContent = fmt(now - state.sessionStart);
    }
  }, 100);
}

resetBtn.onclick = () => {
  location.reload();  // Refresh the page to reset everything
};

document.getElementById('finishBtn').addEventListener('click', () => {
  clearInterval(digitalTimerInterval);
  state.isFinished = true;
  digital.textContent = 'Session Finished';
  totalClock.textContent = 'Session Finished';
  state.hasCompletedLap = false;
  state.trackRest = false;
});


//toggle dark clock face and call save state change
darkToggle.onchange = e => { 
  state.dark = e.target.checked; 
  saveSettings(); 
};

// Toggle Rest Mode without refreshing the clock call save change
toggleRestBtn.addEventListener('click', () => {
  state.trackRest = !state.trackRest;

  // Update mode immediately after changing trackRest
  if (!state.trackRest) state.mode = 'lap';
  else if (state.mode === 'lap') state.mode = 'rest';

  toggleRestBtn.textContent = state.trackRest ? 'Rest ✓' : 'Rest ✗';
  digital.classList.toggle('rest', state.mode === 'rest');
  digital.style.color = ''; // Reset inline color so CSS handles it
  saveSettings();
});


// Ghost hand toggle
ghostToggle.onchange = () => {
  state.ghostHand = ghostToggle.checked;
  saveSettings();
};

// Thicker hands toggle
thickerHandsToggle.onchange = () => {
  state.thickerHands = thickerHandsToggle.checked;
  saveSettings();
};

guardToggle.onchange = e => {
  state.guard = e.target.checked;
  saveSettings();
};


