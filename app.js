/*
Copyright © 2026

Licensed under the PolyForm Noncommercial License 1.0.0.
Commercial use is prohibited.
See the LICENSE file for details.
*/

const state = {
  dark: true,
  trackRest: false, // Default is off, no rest tracking
  guard: true,
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
  mode: 'lap',  // Start in lap mode (first)
  hasCompletedLap: false,
  lastSplit: 0,
  timerRunning: false,
  digitalTimerRunning: false,
  isFinished: false,
  lapCount: 1  // Start lap count at 1
};

const MIN_PRESS = 1000;

const canvas = document.getElementById('clock');
const ctx = canvas.getContext('2d');
const digital = document.getElementById('digital');
const totalClock = document.getElementById('totalClock');
const list = document.getElementById('list');
const toggleRestBtn = document.getElementById('toggleRestBtn');
const ghostToggle = document.getElementById('ghostToggle'); // Reference to the ghost toggle checkbox
const thickerHandsToggle = document.getElementById('thickerHandsToggle'); // Reference to thicker hands toggle checkbox

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
  ctx.font='bold 28px system-ui';  // Set font size to 28px for the clock numbers
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
    ctx.strokeStyle=h.color;
    ctx.lineWidth = state.thickerHands ? 6 : 3;  // Change line width based on the toggle state
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(a)*(r-28),cy+Math.sin(a)*(r-28));
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

optionsBtn.onclick = () => options.classList.add('open');
darkToggle.onchange = e => state.dark = e.target.checked;

// Toggle Rest Mode without refreshing the clock
toggleRestBtn.addEventListener('click', () => {
  state.trackRest = !state.trackRest;  // Toggle rest mode on/off
  // Update the button text based on the current state
  toggleRestBtn.textContent = state.trackRest ? 'Rest ✓' : 'Rest ✗';

  // Update the mode to reflect the toggle
  if (!state.trackRest) {
    state.mode = 'lap';  // Force lap mode if rest tracking is off
  } else if (state.mode === 'lap') {
    state.mode = 'rest';  // If rest is on, switch to rest mode
  }
});

// Ghost hand toggle
ghostToggle.onchange = () => {
  state.ghostHand = ghostToggle.checked;  // Toggle ghost hand visibility
};

// Thicker hands toggle
thickerHandsToggle.onchange = () => {
  state.thickerHands = thickerHandsToggle.checked;  // Toggle thicker hands visibility
};

guardToggle.onchange = e => state.guard = e.target.checked;
