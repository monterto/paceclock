const state = {
  dark: true,
  trackRest: false,
  guard: true,
  ghostHand: true,
  thickerHands: true,
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
  mode: 'lap',
  digitalTimerRunning: false,
  isFinished: false,
  lapCount: 1
};

const MIN_PRESS = 1000;

const canvas = document.getElementById('clock');
const ctx = canvas.getContext('2d');
const digital = document.getElementById('digital');
const totalClock = document.getElementById('totalClock');
const list = document.getElementById('list');
const toggleRestBtn = document.getElementById('toggleRestBtn');

const ghostToggle = document.getElementById('ghostToggle');
const thickerHandsToggle = document.getElementById('thickerHandsToggle');
const optionsBtn = document.getElementById('optionsBtn');
const darkToggle = document.getElementById('darkToggle');
const guardToggle = document.getElementById('guardToggle');
const resetBtn = document.getElementById('resetBtn');

let digitalTimerInterval = null;

/* ---------- Wake Lock ---------- */
let wakeLock = null;

async function requestWakeLock(){
  if ('wakeLock' in navigator) {
    wakeLock = await navigator.wakeLock.request('screen');
  }
}

document.addEventListener('visibilitychange', () => {
  document.visibilityState === 'visible' ? requestWakeLock() : wakeLock?.release();
});

requestWakeLock();

/* ---------- Utilities ---------- */
function fmt(ms){
  const t = Math.floor(ms/100);
  return `${String(Math.floor(t/600)).padStart(2,'0')}:${String(Math.floor(t/10)%60).padStart(2,'0')}.${t%10}`;
}

/* ---------- Clock Drawing ---------- */
function drawClock(){
  ctx.clearRect(0,0,360,360);
  const cx=180, cy=180, r=162;

  ctx.fillStyle = state.dark ? '#0b0f14' : '#f2f2f2';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();

  ctx.strokeStyle = state.dark ? '#444':'#111';
  ctx.lineWidth=4;
  ctx.stroke();

  for(let i=0;i<60;i++){
    const a=i*Math.PI/30-Math.PI/2;
    ctx.lineWidth=i%5===0?3:1;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
    ctx.lineTo(cx+Math.cos(a)*(r-20),cy+Math.sin(a)*(r-20));
    ctx.stroke();
  }

  const base=(Date.now()/1000)%60;
  state.hands.forEach(h=>{
    const s=(base+h.offset)%60;
    const a=s*Math.PI/30-Math.PI/2;
    ctx.strokeStyle=h.color;
    ctx.lineWidth=state.thickerHands?6:3;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(a)*(r-28),cy+Math.sin(a)*(r-28));
    ctx.stroke();
  });
}

(function render(){
  drawClock();
  requestAnimationFrame(render);
})();

/* ---------- Interaction ---------- */
canvas.addEventListener('pointerdown',()=>{
  if(state.isFinished) return;

  const now=Date.now();
  if(!state.sessionStart) state.sessionStart=now;
  if(state.guard && state.lastTap && now-state.lastTap<MIN_PRESS) return;

  if(state.lastTap){
    const duration=now-state.lastTap;
    state.laps.push({type:state.mode,time:duration});
    addRow(state.laps.at(-1));
  }

  state.lastTap=now;
  digital.classList.toggle('rest', state.mode==='rest');

  if(!state.digitalTimerRunning){
    startDigitalTimer();
    state.digitalTimerRunning=true;
  }
});

function addRow(l){
  const row=document.createElement('div');
  row.className='row';
  row.innerHTML=`<span>Lap ${state.lapCount++}</span><span>${fmt(l.time)}</span>`;
  list.prepend(row);
}

function startDigitalTimer(){
  digitalTimerInterval=setInterval(()=>{
    digital.textContent=fmt(Date.now()-state.lastTap);
    totalClock.textContent=fmt(Date.now()-state.sessionStart);
  },100);
}

resetBtn.onclick=()=>location.reload();
optionsBtn.onclick=()=>options.classList.add('open');
darkToggle.onchange=e=>state.dark=e.target.checked;
ghostToggle.onchange=e=>state.ghostHand=e.target.checked;
thickerHandsToggle.onchange=e=>state.thickerHands=e.target.checked;
guardToggle.onchange=e=>state.guard=e.target.checked;

