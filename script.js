// Animated Sudoku: confetti, pop animations, theme toggle, wrong/correct feedback
const SIZE = 9, BLOCK = 3;

/* DOM refs */
const boardEl = document.getElementById('board');
const newBtn = document.getElementById('newBtn');
const solveBtn = document.getElementById('solveBtn');
const checkBtn = document.getElementById('checkBtn');
const hintBtn = document.getElementById('hintBtn');
const pencilToggle = document.getElementById('pencilToggle');
const pauseBtn = document.getElementById('pauseBtn');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const difficultySelector = document.getElementById('difficulty');
const mistakeCountEl = document.getElementById('mistakeCount');
const autoClearCheckbox = document.getElementById('autoClearWrong');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const confettiCanvas = document.getElementById('confetti-canvas');

let board = Array.from({length:SIZE},()=>Array(SIZE).fill(0));
let solution = null;
let givens = Array.from({length:SIZE},()=>Array(SIZE).fill(false));
let pencilMode = false;
let pencilMarks = Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>new Set()));
let selected = null;
let mistakeCount = 0;
const WRONG_AUTOCLEAR_DELAY = 700;

let timerInterval = null, startTime = 0, elapsed = 0;

/* ---------- THEME ---------- */
const THEME_KEY = 'sudoku_theme';
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(initial);
}
themeToggle.addEventListener('click', ()=>{
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  themeIcon.classList.add('spin');
  setTimeout(()=> themeIcon.classList.remove('spin'), 420);
  applyTheme(next);
});

/* ---------- UI creation ---------- */
function createBoardUI(){
  boardEl.innerHTML = '';
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      cell.dataset.r = r; cell.dataset.c = c;
      if((c+1)%3===0 && c!==8) cell.classList.add('border-right');
      if((r+1)%3===0 && r!==8) cell.classList.add('border-bottom');

      const inp = document.createElement('input');
      inp.maxLength = 1; inp.inputMode = 'numeric';
      inp.addEventListener('focus', ()=> selectCell(r,c));
      inp.addEventListener('keydown', (e)=> onCellKeyDown(e,r,c));
      inp.addEventListener('input', (e)=> onInput(e,r,c));
      cell.appendChild(inp);

      const pencil = document.createElement('div');
      pencil.className = 'pencil';
      for(let i=1;i<=9;i++){
        const p = document.createElement('div');
        p.className = 'pnum';
        p.dataset.num = i; p.textContent = '';
        pencil.appendChild(p);
      }
      cell.appendChild(pencil);

      cell.addEventListener('click', ()=> { inp.focus(); });

      boardEl.appendChild(cell);
    }
  }
}

/* ---------- Render ---------- */
function render(){
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const idx = r*SIZE + c;
      const cell = boardEl.children[idx];
      const inp = cell.querySelector('input');
      const pencil = cell.querySelector('.pencil');
      const val = board[r][c];
      inp.value = val === 0 ? '' : String(val);
      cell.classList.toggle('given', givens[r][c]);
      cell.classList.toggle('selected', selected && selected[0]===r && selected[1]===c);
      cell.classList.toggle('conflict', isConflictCell(r,c));
      cell.classList.toggle('has-value', val !== 0);
      cell.classList.toggle('empty', val === 0);

      for(let i=1;i<=9;i++){
        const p = pencil.querySelector(`[data-num="${i}"]`);
        if(p) p.textContent = (board[r][c]===0 && pencilMarks[r][c].has(i)) ? String(i) : '';
      }

      inp.disabled = givens[r][c];
    }
  }
  mistakeCountEl.textContent = String(mistakeCount);
}

/* ---------- Selection & Input ---------- */
function selectCell(r,c){ selected = [r,c]; render(); }
function onCellKeyDown(e,r,c){
  if(e.key==='Backspace' || e.key==='Delete'){ e.preventDefault(); setCell(r,c,0); return; }
  if(e.key>='1' && e.key<='9'){ e.preventDefault(); const num = parseInt(e.key,10); handleNumberInput(r,c,num); return; }
}
function onInput(e,r,c){
  const v = e.target.value.trim();
  if(!v){ setCell(r,c,0); return; }
  const n = parseInt(v[0],10);
  if(!Number.isNaN(n) && n>=1 && n<=9) handleNumberInput(r,c,n);
  else e.target.value='';
}
function handleNumberInput(r,c,n){
  if(givens[r][c]) return;
  if(pencilMode){
    if(pencilMarks[r][c].has(n)) pencilMarks[r][c].delete(n);
    else pencilMarks[r][c].add(n);
    setStatus('Pencil marks updated');
  } else {
    if(solution){
      if(n !== solution[r][c]){ onWrongEntry(r,c,n); return; }
      else { pencilMarks[r][c].clear(); setCell(r,c,n); onCorrectEntry(r,c); setStatus('Correct'); checkWin(); }
    } else { pencilMarks[r][c].clear(); setCell(r,c,n); setStatus('Placed ' + n); checkWin(); }
  }
  render();
}
function setCell(r,c,val){ if(givens[r][c]) return; board[r][c] = val; render(); }

/* ---------- Feedback: correct/wrong ---------- */
function onWrongEntry(r,c,wrongVal){
  mistakeCount++;
  render();
  const idx = r*SIZE + c;
  const cell = boardEl.children[idx];
  cell.classList.add('wrong');
  setStatus('Wrong! Mistakes: ' + mistakeCount);

  if(autoClearCheckbox && autoClearCheckbox.checked){
    setTimeout(()=> {
      cell.classList.remove('wrong');
      const currentVal = board[r][c];
      if(currentVal === 0 || currentVal === wrongVal) board[r][c] = 0;
      render();
    }, WRONG_AUTOCLEAR_DELAY);
  } else {
    board[r][c] = wrongVal;
    setTimeout(()=> { cell.classList.remove('wrong'); }, 700);
  }
}
function onCorrectEntry(r,c){
  const idx = r*SIZE + c;
  const cell = boardEl.children[idx];
  cell.classList.add('correct');
  setTimeout(()=> cell.classList.remove('correct'), 520);
}

/* ---------- Solver / Generator ---------- */
function isValid(bd,r,c,val){
  if(val===0) return true;
  for(let i=0;i<SIZE;i++){ if(i!==c && bd[r][i]===val) return false; if(i!==r && bd[i][c]===val) return false; }
  const br = Math.floor(r/BLOCK)*BLOCK, bc = Math.floor(c/BLOCK)*BLOCK;
  for(let i=br;i<br+BLOCK;i++) for(let j=bc;j<bc+BLOCK;j++) if((i!==r || j!==c) && bd[i][j]===val) return false;
  return true;
}
function isConflictCell(r,c){
  const val = board[r][c];
  if(val===0) return false;
  return !isValid(board,r,c,val);
}
function findEmpty(bd){ for(let i=0;i<SIZE;i++) for(let j=0;j<SIZE;j++) if(bd[i][j]===0) return [i,j]; return null; }
function solveBacktrack(bd){ const loc=findEmpty(bd); if(!loc) return true; const [r,c]=loc; for(let v=1;v<=9;v++){ if(isValid(bd,r,c,v)){ bd[r][c]=v; if(solveBacktrack(bd)) return true; bd[r][c]=0; } } return false; }
function countSolutions(bd, limit=2){ const loc=findEmpty(bd); if(!loc) return 1; const [r,c]=loc; let cnt=0; for(let v=1;v<=9;v++){ if(isValid(bd,r,c,v)){ bd[r][c]=v; cnt += countSolutions(bd, limit); bd[r][c]=0; if(cnt>=limit) return cnt; } } return cnt; }
function shuffle(array){ for(let i=array.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [array[i],array[j]]=[array[j],array[i]]; } }
function fillFull(bd){ const loc=findEmpty(bd); if(!loc) return true; const [r,c]=loc; const nums=[1,2,3,4,5,6,7,8,9]; shuffle(nums); for(const v of nums){ if(isValid(bd,r,c,v)){ bd[r][c]=v; if(fillFull(bd)) return true; bd[r][c]=0; } } return false; }

/* ---------- Generator ---------- */
function generatePuzzle(emptyTarget=45){
  setStatus('Generating puzzle...');
  stopTimer(); elapsed = 0; updateTimerDisplay(); mistakeCount = 0;
  let full = Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  fillFull(full);
  solution = full.map(r=>r.slice());

  let puzzle = solution.map(r=>r.slice());
  const positions = [];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) positions.push([r,c]);
  shuffle(positions);
  let removed=0;
  for(const [r,c] of positions){
    const backup = puzzle[r][c];
    puzzle[r][c]=0;
    const copy = puzzle.map(row=>row.slice());
    const sols = countSolutions(copy,2);
    if(sols!==1) puzzle[r][c]=backup;
    else removed++;
    if(removed>=emptyTarget) break;
  }

  board = puzzle.map(r=>r.slice());
  givens = board.map(r=>r.map(v=>v!==0));
  pencilMarks = Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>new Set()));
  selected = null;
  render();
  setStatus('Puzzle ready');
  startTimer();
}

/* ---------- Timer ---------- */
function formatTime(ms){ const totalSec=Math.floor(ms/1000); const mm=String(Math.floor(totalSec/60)).padStart(2,'0'); const ss=String(totalSec%60).padStart(2,'0'); return `${mm}:${ss}`; }
function updateTimerDisplay(){ const ms = elapsed + (timerInterval ? (Date.now()-startTime) : 0); timerEl.textContent = formatTime(ms); }
function startTimer(){ stopTimer(); startTime = Date.now(); timerInterval = setInterval(updateTimerDisplay, 250); pauseBtn.textContent = 'Pause'; }
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval = null; elapsed += (Date.now() - startTime); updateTimerDisplay(); } }
function resetTimer(){ stopTimer(); elapsed = 0; startTime = 0; updateTimerDisplay(); }

/* ---------- Controls ---------- */
function setStatus(msg){ statusEl.textContent = msg; }
pencilToggle.addEventListener('click', ()=>{ pencilMode = !pencilMode; pencilToggle.textContent = pencilMode ? 'Pencil ✓' : 'Pencil'; setStatus('Pencil ' + (pencilMode ? 'on' : 'off')); });
document.querySelectorAll('.kbd button').forEach(b=>{ b.addEventListener('click', ()=>{ const key = b.dataset.key; if(key){ if(!selected) return setStatus('Select a cell first'); const r=selected[0], c=selected[1]; if(key==='0'){ setCell(r,c,0); setStatus('Erased'); render(); return; } const n=parseInt(key,10); handleNumberInput(r,c,n); render(); } }); });
hintBtn.addEventListener('click', ()=>{ if(!solution) return setStatus('No solution ready'); for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]===0){ board[r][c] = solution[r][c]; render(); setStatus('Hint placed'); checkWin(); return; } setStatus('No empty cells'); });
newBtn.addEventListener('click', ()=> { const empties = parseInt(difficultySelector.value,10); generatePuzzle(empties); });
solveBtn.addEventListener('click', ()=> { if(!solution) return setStatus('No solution stored yet'); board = solution.map(r=>r.slice()); render(); setStatus('Solved!'); stopTimer(); });
pauseBtn.addEventListener('click', ()=> { if(timerInterval){ stopTimer(); pauseBtn.textContent = 'Resume'; setStatus('Timer paused'); } else { startTimer(); pauseBtn.textContent = 'Pause'; setStatus('Timer resumed'); } });
checkBtn.addEventListener('click', ()=>{ let problems=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]!==0 && !isValid(board,r,c,board[r][c])) problems++; if(problems) setStatus('Conflicts found (highlighted)'); else setStatus('No conflicts — good so far!'); render(); });

/* ---------- Win detection + confetti ---------- */
function checkWin(){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]===0) return false;
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!isValid(board,r,c,board[r][c])) return false;
  stopTimer();
  setStatus('Congratulations — puzzle complete! Time: ' + timerEl.textContent + ' Mistakes: ' + mistakeCount);
  triggerConfetti();
  return true;
}

/* ---------- Confetti implementation (simple) ---------- */
function triggerConfetti(){
  if(!confettiCanvas) return;
  const ctx = confettiCanvas.getContext('2d');
  resizeCanvasToDisplaySize(confettiCanvas);
  confettiCanvas.style.opacity = '1';

  const W = confettiCanvas.width, H = confettiCanvas.height;
  const count = Math.min(160, Math.floor(W * 0.18));
  const pieces = [];
  const colors = ['#ff4d6d','#ffb86b','#ffd166','#8be78b','#6ec1ff','#b591ff','#ff7bda'];

  for(let i=0;i<count;i++){
    pieces.push({
      x: Math.random() * W,
      y: Math.random() * -H,
      w: 6 + Math.random()*10,
      h: 8 + Math.random()*12,
      vx: (Math.random()-0.5)*2,
      vy: 2 + Math.random()*6,
      r: Math.random()*360,
      vr: (Math.random()-0.5)*10,
      color: colors[Math.floor(Math.random()*colors.length)],
      tilt: Math.random()*Math.PI
    });
  }

  let t0 = null;
  function frame(ts){
    if(!t0) t0 = ts;
    const dt = (ts - t0)/1000;
    t0 = ts;
    ctx.clearRect(0,0,W,H);
    for(const p of pieces){
      p.x += p.vx * (dt*60);
      p.y += p.vy * (dt*60);
      p.vy += 0.02 * (dt*60);
      p.r += p.vr * (dt*60);
      p.tilt += 0.05;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    for(let i=pieces.length-1;i>=0;i--){
      if(pieces[i].y > H + 50) pieces.splice(i,1);
    }
    if(pieces.length>0) requestAnimationFrame(frame);
    else {
      confettiCanvas.style.opacity = '0';
      ctx.clearRect(0,0,W,H);
    }
  }
  requestAnimationFrame(frame);
}
function resizeCanvasToDisplaySize(canvas){
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  if(canvas.width !== width || canvas.height !== height){
    canvas.width = width; canvas.height = height;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
}
window.addEventListener('resize', ()=> { if(confettiCanvas) resizeCanvasToDisplaySize(confettiCanvas); });

/* ---------- Global keyboard ---------- */
document.addEventListener('keydown',(e)=>{ if(!selected) return; if(e.key>='1' && e.key<='9'){ e.preventDefault(); handleNumberInput(selected[0], selected[1], parseInt(e.key,10)); render(); } if(e.key==='Backspace' || e.key==='Delete'){ e.preventDefault(); setCell(selected[0], selected[1], 0); render(); } });

/* ---------- Init ---------- */
initTheme();
createBoardUI();
generatePuzzle(parseInt(difficultySelector.value,10));
render();
updateTimerDisplay();
