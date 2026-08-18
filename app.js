/* Логика приложения «Ударник». Зависит от words.js (загружается первым через defer). */
/* === КОНФЕТТИ === */
(function(){
  const canvas = document.getElementById('confettiCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  function spawnConfetti(x, y) {
    const colors = ['#f472b6','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171'];
    for(let i=0;i<60;i++){
      particles.push({
        x: x || canvas.width/2, y: y || canvas.height/2,
        vx: (Math.random()-0.5)*12, vy: (Math.random()-1.5)*10,
        size: Math.random()*6+3, color: colors[Math.floor(Math.random()*colors.length)],
        rotation: Math.random()*360, rotSpeed: (Math.random()-0.5)*10,
        gravity: 0.25, drag: 0.96, life: 1
      });
    }
    if(!animating){ animating=true; requestAnimationFrame(loop); }
  }
  let animating = false;
  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach((p,i)=>{
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag;
      p.rotation += p.rotSpeed; p.life -= 0.015;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rotation*Math.PI/180);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0,p.life);
      ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore();
      if(p.life<=0) particles.splice(i,1);
    });
    if(particles.length){ requestAnimationFrame(loop); } else { animating=false; }
  }
  window.egeConfetti = spawnConfetti;
})();

/* === ВИБРАЦИЯ === */
function egeVibrate(type){
  if(!navigator.vibrate) return;
  if(type==='correct') navigator.vibrate([30,50,30]);
  else if(type==='wrong') navigator.vibrate([80,40,80]);
  else navigator.vibrate(20);
}

/* === АЧИВКИ === */
function showBadge(text){
  const b = document.getElementById('egeBadge');
  if(!b) return;
  b.innerHTML = '🏆&nbsp;' + text;
  b.classList.remove('show','hide');
  void b.offsetWidth;
  b.classList.add('show');
  setTimeout(()=>{
    b.classList.remove('show');
    b.classList.add('hide');
    setTimeout(()=>b.classList.remove('hide'), 350);
  }, 2200);
}

/* === SAFE LOCALSTORAGE === */
function egeGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
}
function egeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch(e) { console.warn('localStorage blocked'); }
}


  let currentFilter = 'all';

  let trainQueue = [], trainIndex = 0, trainAnswered = false, trainStreak = 0;
  let testQueue = [], testIndex = 0, testScore = 0, testAnswered = false, testStreak = 0;

  function loadStats() {
    return egeGet('ege4_stats', {total:0,correct:0,tests:0,mistakes:{}});
  }
  function saveStats(s) { egeSet('ege4_stats', s); }
  function recordAnswer(wordClean, isCorrect) {
    const s = loadStats();
    s.total++;
    if (isCorrect) s.correct++;
    else s.mistakes[wordClean] = (s.mistakes[wordClean] || 0) + 1;
    saveStats(s);
  }

  function showScreen(id) {
    document.querySelectorAll('.ege-screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
  window.goHome = () => showScreen('screenHome');
  window.goTrain = () => { initTrain(); showScreen('screenTrain'); };
  window.goTest = () => { initTest(); showScreen('screenTest'); };
  window.goDict = () => { renderDict(); showScreen('screenDict'); };
  window.goStats = () => { renderStats(); showScreen('screenStats'); };
  window.goModes = () => showScreen('screenModes');
  window.goBattle = () => { initBattle(); showScreen('screenBattle'); };
  window.goSmart = () => { initSmartIntro(); showScreen('screenSmart'); };
  window.goMarathon = () => { initMarathon(); showScreen('screenMeme'); };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fitFont(wordEl) {
    const box = wordEl.parentElement;
    if (!box) return;
    wordEl.style.fontSize = '';
    const available = box.clientWidth - 12;
    if (wordEl.scrollWidth > available) {
      const ratio = available / wordEl.scrollWidth;
      const base = parseFloat(getComputedStyle(wordEl).fontSize);
      const newSize = Math.max(20, Math.floor(base * ratio * 0.97));
      wordEl.style.fontSize = newSize + 'px';
    }
  }
  function renderWordBox(containerId, catId, w, clickHandler) {
    document.getElementById(catId).textContent = w.category;
    const box = document.getElementById(containerId);
    box.innerHTML = '';
    for (let i = 0; i < w.clean.length; i++) {
      const ch = w.clean[i];
      const span = document.createElement('span');
      span.className = 'ege-char';
      span.textContent = ch;
      if ('аеёиоуыэюя'.includes(ch)) {
        span.classList.add('vowel');
        span.onclick = () => clickHandler(i, w);
      }
      box.appendChild(span);
    }
    requestAnimationFrame(() => fitFont(box));
  }

  function showFeedback(id, isCorrect, correctWord) {
    const fb = document.getElementById(id);
    fb.textContent = isCorrect ? '✓ Верно!' : '✗ Неверно. Правильно: ' + correctWord;
    fb.className = 'ege-feedback show ' + (isCorrect ? 'ok' : 'err');
  }

  function markChars(containerId, stressIdx, chosenIdx) {
    const chars = document.getElementById(containerId).children;
    for (let i = 0; i < chars.length; i++) {
      if (!chars[i].classList.contains('vowel')) continue;
      chars[i].classList.remove('selected','correct','wrong','dim');
      if (i === stressIdx) chars[i].classList.add('correct');
      else if (i === chosenIdx && chosenIdx !== stressIdx) chars[i].classList.add('wrong');
      else chars[i].classList.add('dim');
    }
  }

  // TRAINING
  function initTrain() {
    trainQueue = shuffle(wordsData);
    trainIndex = 0;
    trainAnswered = false;
    trainStreak = 0;
    renderTrain();
  }
  function updateStreak(containerId, numId, streak) {
    const el = document.getElementById(containerId);
    const num = document.getElementById(numId);
    if(!el || !num) return;
    num.textContent = streak;
    el.classList.toggle('show', streak > 0);
  }
  function renderTrain() {
    const w = trainQueue[trainIndex];
    document.getElementById('trainCounter').textContent = (trainIndex + 1) + '/' + trainQueue.length;
    document.getElementById('trainProgress').style.width = ((trainIndex / trainQueue.length) * 100) + '%';
    document.getElementById('trainFeedback').className = 'ege-feedback';
    document.getElementById('trainNextBtn').style.display = 'none';
    trainAnswered = false;
    renderWordBox('trainWord', 'trainCat', w, handleTrainClick);
    updateStreak('trainStreak', 'trainStreakNum', trainStreak);
  }
  function handleTrainClick(idx, w) {
    if (trainAnswered) return;
    trainAnswered = true;
    const isCorrect = idx === w.stress;
    recordAnswer(w.clean, isCorrect);
    markChars('trainWord', w.stress, idx);
    showFeedback('trainFeedback', isCorrect, w.word);
    document.getElementById('trainNextBtn').style.display = 'block';
    // Дофамин
    if (isCorrect) {
      trainStreak++;
      egeVibrate('correct');
      window.egeConfetti && window.egeConfetti();
      const correctChar = document.getElementById('trainWord').children[w.stress];
      if(correctChar) { correctChar.classList.add('pop'); setTimeout(()=>correctChar.classList.remove('pop'), 400); }
      if(trainStreak >= 5) showBadge(trainStreak + ' правильных подряд!');
    } else {
      trainStreak = 0;
      egeVibrate('wrong');
      const wrongChar = document.getElementById('trainWord').children[idx];
      if(wrongChar) { wrongChar.classList.add('shake'); setTimeout(()=>wrongChar.classList.remove('shake'), 400); }
    }
    updateStreak('trainStreak', 'trainStreakNum', trainStreak);
  }
  window.nextTrain = () => {
    trainIndex++;
    if (trainIndex >= trainQueue.length) trainIndex = 0;
    renderTrain();
  };

  // TEST
  function initTest() {
    testQueue = shuffle(wordsData).slice(0, 10);
    testIndex = 0;
    testScore = 0;
    testAnswered = false;
    testStreak = 0;
    renderTest();
  }
  function renderTest() {
    const w = testQueue[testIndex];
    document.getElementById('testCounter').textContent = (testIndex + 1) + '/10';
    document.getElementById('testProgress').style.width = ((testIndex / 10) * 100) + '%';
    document.getElementById('testFeedback').className = 'ege-feedback';
    document.getElementById('testNextBtn').style.display = 'none';
    testAnswered = false;
    renderWordBox('testWord', 'testCat', w, handleTestClick);
    updateStreak('testStreak', 'testStreakNum', testStreak);
  }
  function handleTestClick(idx, w) {
    if (testAnswered) return;
    testAnswered = true;
    const isCorrect = idx === w.stress;
    if (isCorrect) testScore++;
    recordAnswer(w.clean, isCorrect);
    markChars('testWord', w.stress, idx);
    showFeedback('testFeedback', isCorrect, w.word);
    document.getElementById('testNextBtn').style.display = 'block';
    // Дофамин
    if (isCorrect) {
      testStreak++;
      egeVibrate('correct');
      window.egeConfetti && window.egeConfetti();
      const correctChar = document.getElementById('testWord').children[w.stress];
      if(correctChar) { correctChar.classList.add('pop'); setTimeout(()=>correctChar.classList.remove('pop'), 400); }
      if(testStreak >= 5) showBadge(testStreak + ' правильных подряд!');
    } else {
      testStreak = 0;
      egeVibrate('wrong');
      const wrongChar = document.getElementById('testWord').children[idx];
      if(wrongChar) { wrongChar.classList.add('shake'); setTimeout(()=>wrongChar.classList.remove('shake'), 400); }
    }
    updateStreak('testStreak', 'testStreakNum', testStreak);
  }
  window.nextTest = () => {
    testIndex++;
    if (testIndex >= testQueue.length) {
      const s = loadStats(); s.tests++; saveStats(s);
      document.getElementById('resultScore').textContent = testScore;
      document.getElementById('resultCorrect').textContent = testScore;
      document.getElementById('resultWrong').textContent = 10 - testScore;
      showScreen('screenResult');
      if(testScore === 10) { setTimeout(()=>showBadge('Идеальный результат! 10/10'), 400); window.egeConfetti && window.egeConfetti(); }
      else if(testScore >= 8) { setTimeout(()=>showBadge('Отлично! ' + testScore + '/10'), 400); }
    } else {
      renderTest();
    }
  };



  // === MARATHON ===
  const MARATHON_DAILY = 10;
  let marathonQueue = [], marathonIndex = 0, marathonAnswered = false;

  function loadMarathon() {
    return egeGet('ege4_marathon', {streak:0,lastDate:'',history:{},badges:[]});
  }
  function saveMarathon(m) { egeSet('ege4_marathon', m); }
  function getToday() { return new Date().toISOString().slice(0,10); }
  function getDayKey(d) { return d || getToday(); }

  function initMarathon() {
    const m = loadMarathon();
    const today = getToday();
    // streak logic
    if (m.lastDate) {
      const last = new Date(m.lastDate);
      const now = new Date(today);
      const diff = Math.floor((now - last) / 86400000);
      if (diff > 1) m.streak = 0;
    }
    saveMarathon(m);
    renderMarathonUI();
    // build today's queue
    const shuffled = shuffle(wordsData);
    marathonQueue = shuffled.slice(0, MARATHON_DAILY);
    marathonIndex = 0; marathonAnswered = false;
    renderMarathonWord();
  }
  function renderMarathonUI() {
    const m = loadMarathon();
    document.getElementById('marathonStreakNum').textContent = m.streak;
    const today = getToday();
    const doneToday = (m.history[today] || 0);
    document.getElementById('marathonCounter').textContent = Math.min(doneToday, MARATHON_DAILY) + '/' + MARATHON_DAILY;
    document.getElementById('marathonProgress').style.width = (Math.min(doneToday, MARATHON_DAILY) / MARATHON_DAILY * 100) + '%';
    // week strip
    const weekEl = document.getElementById('marathonWeek');
    weekEl.innerHTML = '';
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;justify-content:center;gap:8px;max-width:360px;margin:0 auto;';
    const wdays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dKey = d.toISOString().slice(0,10);
      const count = m.history[dKey] || 0;
      const isToday = i === 0;
      const cell = document.createElement('div');
      cell.style.cssText = 'flex:1;text-align:center;';
      const dot = document.createElement('div');
      dot.style.cssText = 'width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin:0 auto 4px;' +
        (count >= MARATHON_DAILY ? 'background:#22c55e;color:#fff;' :
         count > 0 ? 'background:#86efac;color:#166534;' :
         isToday ? 'background:#111;color:#fff;' :
         'background:#f0f0f0;color:#bbb;');
      dot.textContent = d.getDate();
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:11px;color:' + (isToday ? '#111' : '#bbb') + ';font-weight:' + (isToday ? '600' : '400');
      lbl.textContent = wdays[d.getDay()];
      cell.appendChild(dot);
      cell.appendChild(lbl);
      strip.appendChild(cell);
    }
    weekEl.appendChild(strip);
    // badges
    const badgeEl = document.getElementById('marathonBadges');
    const badges = [];
    if (m.streak >= 7) badges.push('🐺 Недельный волк');
    if (m.streak >= 14) badges.push('🔥 Две недели');
    if (m.streak >= 30) badges.push('👑 Марафонец');
    badgeEl.innerHTML = badges.length ? '<div style="font-size:13px;color:#888">' + badges.map(b => '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;margin:3px;font-weight:600">' + b + '</span>').join('') + '</div>' : '';
    // status text
    if (doneToday >= MARATHON_DAILY) {
      document.getElementById('marathonStatus').textContent = '✅ Норма на сегодня выполнена!';
      document.getElementById('marathonStatus').style.color = '#22c55e';
    } else {
      document.getElementById('marathonStatus').textContent = 'Норма: ' + MARATHON_DAILY + ' слов в день';
      document.getElementById('marathonStatus').style.color = '#888';
    }
  }
  function renderMarathonWord() {
    const m = loadMarathon();
    const today = getToday();
    const doneToday = (m.history[today] || 0);
    if (doneToday >= MARATHON_DAILY) {
      document.getElementById('marathonWord').innerHTML = '<div style="font-size:48px;margin-bottom:12px">🎉</div><div style="font-size:18px;font-weight:600">Норма выполнена!</div>';
      document.getElementById('marathonCat').textContent = '';
      document.getElementById('marathonNextBtn').style.display = 'none';
      document.getElementById('marathonFeedback').className = 'ege-feedback';
      window.egeConfetti && window.egeConfetti();
      return;
    }
    const w = marathonQueue[marathonIndex];
    document.getElementById('marathonCounter').textContent = (doneToday + 1) + '/' + MARATHON_DAILY;
    document.getElementById('marathonProgress').style.width = ((doneToday + 1) / MARATHON_DAILY * 100) + '%';
    document.getElementById('marathonFeedback').className = 'ege-feedback';
    document.getElementById('marathonNextBtn').style.display = 'none';
    marathonAnswered = false;
    renderWordBox('marathonWord', 'marathonCat', w, handleMarathonClick);
    requestAnimationFrame(() => fitFont(document.getElementById('marathonWord')));
  }
  function handleMarathonClick(idx, w) {
    if (marathonAnswered) return;
    marathonAnswered = true;
    const isCorrect = idx === w.stress;
    recordAnswer(w.clean, isCorrect);
    markChars('marathonWord', w.stress, idx);
    showFeedback('marathonFeedback', isCorrect, w.word);
    if (isCorrect) {
      egeVibrate('correct');
      const correctChar = document.getElementById('marathonWord').children[w.stress];
      if(correctChar) { correctChar.classList.add('pop'); setTimeout(()=>correctChar.classList.remove('pop'), 400); }
    } else {
      egeVibrate('wrong');
      const wrongChar = document.getElementById('marathonWord').children[idx];
      if(wrongChar) { wrongChar.classList.add('shake'); setTimeout(()=>wrongChar.classList.remove('shake'), 400); }
    }
    document.getElementById('marathonNextBtn').style.display = 'block';
  }
  window.nextMarathon = () => {
    const m = loadMarathon();
    const today = getToday();
    m.history[today] = (m.history[today] || 0) + 1;
    // streak
    if (m.lastDate !== today) {
      if (m.lastDate) {
        const last = new Date(m.lastDate);
        const now = new Date(today);
        const diff = Math.floor((now - last) / 86400000);
        if (diff === 1) m.streak++;
        else if (diff > 1) m.streak = 1;
      } else {
        m.streak = 1;
      }
      m.lastDate = today;
    }
    saveMarathon(m);
    renderMarathonUI();
    marathonIndex++;
    if (marathonIndex >= marathonQueue.length) {
      // done for today
      renderMarathonWord();
      if (m.streak >= 7) setTimeout(()=>showBadge(m.streak + ' дней подряд!'), 400);
    } else {
      renderMarathonWord();
    }
  };
  // === BATTLE ===
  let battleQueue = [], battleIndex = 0, battlePlayer = 1, battleScores = [0,0], battleAnswered = false;
  const BATTLE_TOTAL = 10; // 5 слов на каждого, всего 10 разных

  function initBattle() {
    document.getElementById('battleStart').style.display = 'block';
    document.getElementById('battlePlay').style.display = 'none';
    document.getElementById('battleResult').style.display = 'none';
  }
  window.startBattle = () => {
    battleQueue = shuffle(wordsData).slice(0, BATTLE_TOTAL);
    battleIndex = 0; battleScores = [0,0]; battlePlayer = 1; battleAnswered = false;
    document.getElementById('battleStart').style.display = 'none';
    document.getElementById('battleResult').style.display = 'none';
    document.getElementById('battlePlay').style.display = 'block';
    renderBattle();
  };
  function renderBattle() {
    const w = battleQueue[battleIndex];
    document.getElementById('battleScore1').textContent = battleScores[0];
    document.getElementById('battleScore2').textContent = battleScores[1];
    document.getElementById('battleTurn').textContent = 'Ход Игрока ' + battlePlayer + ' · Слово ' + (Math.floor(battleIndex/2)+1) + '/5';
    document.getElementById('battleTurn').style.color = battlePlayer === 1 ? '#3b82f6' : '#ef4444';
    document.getElementById('battleFeedback').className = 'ege-feedback';
    document.getElementById('battleNextBtn').style.display = 'none';
    battleAnswered = false;
    renderWordBox('battleWord', 'battleCat', w, handleBattleClick);
    requestAnimationFrame(() => fitFont(document.getElementById('battleWord')));
  }
  function handleBattleClick(idx, w) {
    if (battleAnswered) return;
    battleAnswered = true;
    const isCorrect = idx === w.stress;
    if (isCorrect) battleScores[battlePlayer - 1]++;
    markChars('battleWord', w.stress, idx);
    showFeedback('battleFeedback', isCorrect, w.word);
    if (isCorrect) {
      egeVibrate('correct');
      const correctChar = document.getElementById('battleWord').children[w.stress];
      if(correctChar) { correctChar.classList.add('pop'); setTimeout(()=>correctChar.classList.remove('pop'), 400); }
    } else {
      egeVibrate('wrong');
      const wrongChar = document.getElementById('battleWord').children[idx];
      if(wrongChar) { wrongChar.classList.add('shake'); setTimeout(()=>wrongChar.classList.remove('shake'), 400); }
    }
    document.getElementById('battleNextBtn').style.display = 'block';
  }
  window.nextBattle = () => {
    battleIndex++;
    if (battleIndex >= BATTLE_TOTAL) {
      showBattleResult();
    } else {
      battlePlayer = battlePlayer === 1 ? 2 : 1;
      battleAnswered = false;
      renderBattle();
    }
  };
  function showBattleResult() {
    document.getElementById('battlePlay').style.display = 'none';
    document.getElementById('battleResult').style.display = 'block';
    document.getElementById('battleFinal1').textContent = battleScores[0];
    document.getElementById('battleFinal2').textContent = battleScores[1];
    const s1 = battleScores[0], s2 = battleScores[1];
    const winnerEl = document.getElementById('battleWinner');
    const subEl = document.getElementById('battleResultSub');
    const iconEl = document.getElementById('battleResultIcon');
    if (s1 > s2) { winnerEl.textContent = 'Победил Игрок 1!'; iconEl.textContent = '🥇'; subEl.textContent = 'Счёт: ' + s1 + ' : ' + s2; }
    else if (s2 > s1) { winnerEl.textContent = 'Победил Игрок 2!'; iconEl.textContent = '🥇'; subEl.textContent = 'Счёт: ' + s1 + ' : ' + s2; }
    else { winnerEl.textContent = 'Ничья!'; iconEl.textContent = '🤝'; subEl.textContent = 'Счёт: ' + s1 + ' : ' + s2; }
    if (s1 === 5 || s2 === 5) { setTimeout(()=>showBadge('Идеальная игра!'), 400); window.egeConfetti && window.egeConfetti(); }
  }

  // === SMART REPETITION ===
  const SMART_INTERVALS = [0, 10*60*1000, 60*60*1000, 24*60*60*1000, 3*24*60*60*1000, 7*24*60*60*1000];
  const SMART_LABELS = ['Сейчас','10 мин','Час','День','3 дня','Неделя'];
  const SMART_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'];
  let smartQueue = [], smartIndex = 0, smartAnswered = false;

  function loadSmartData() {
    return egeGet('ege4_smart', {});
  }
  function saveSmartData(d) { egeSet('ege4_smart', d); }
  function initSmartData() {
    const d = loadSmartData();
    if (Object.keys(d).length === 0) {
      wordsData.forEach(w => { d[w.clean] = { level: 0, next: 0 }; });
      saveSmartData(d);
    }
    return d;
  }
  function getSmartStats() {
    const d = loadSmartData();
    const counts = [0,0,0,0,0,0];
    wordsData.forEach(w => {
      const entry = d[w.clean] || { level: 0 };
      counts[Math.min(entry.level, 5)]++;
    });
    return counts;
  }
  function renderSmartPills(containerId) {
    const counts = getSmartStats();
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    counts.forEach((c, i) => {
      if (!c) return;
      const pill = document.createElement('div');
      pill.className = 'ege-smart-pill';
      pill.style.background = SMART_COLORS[i];
      pill.style.width = Math.max(4, c * 2.5) + 'px';
      pill.title = SMART_LABELS[i] + ': ' + c + ' слов';
      container.appendChild(pill);
    });
  }
  function initSmartIntro() {
    const counts = getSmartStats();
    const learned = counts[5];
    const total = wordsData.length;
    document.getElementById('smartCount').innerHTML = 'Выучено <b>' + learned + '</b> из ' + total + ' слов';
    renderSmartPills('smartProgress');
  }
  function getDueWords() {
    const d = loadSmartData();
    const now = Date.now();
    return wordsData.filter(w => {
      const entry = d[w.clean] || { level: 0, next: 0 };
      return entry.next <= now && entry.level < 5;
    }).sort((a, b) => {
      const na = (d[a.clean] || { next: 0 }).next;
      const nb = (d[b.clean] || { next: 0 }).next;
      return na - nb;
    });
  }
  function formatTimeLeft(ms) {
    if (ms <= 0) return 'сейчас';
    const m = Math.ceil(ms / 60000);
    if (m < 60) return 'через ' + m + ' мин';
    const h = Math.ceil(ms / 3600000);
    if (h < 24) return 'через ' + h + ' ч';
    const d = Math.ceil(ms / 86400000);
    return 'через ' + d + ' д';
  }
  window.startSmart = () => {
    initSmartData();
    smartQueue = getDueWords();
    if (!smartQueue.length) {
      document.getElementById('smartIntro').style.display = 'none';
      document.getElementById('smartPlay').style.display = 'none';
      document.getElementById('smartEmpty').style.display = 'block';
      const d = loadSmartData();
      let minNext = Infinity;
      wordsData.forEach(w => {
        const entry = d[w.clean] || { next: 0 };
        if (entry.level < 5 && entry.next < minNext) minNext = entry.next;
      });
      if (minNext === Infinity) {
        document.getElementById('smartEmptyText').textContent = 'Ты выучил все 190 слов! 🎓';
      } else {
        document.getElementById('smartEmptyText').textContent = 'Следующее слово ' + formatTimeLeft(minNext - Date.now());
      }
      renderSmartPills('smartEmptyProgress');
      return;
    }
    smartIndex = 0; smartAnswered = false;
    document.getElementById('smartIntro').style.display = 'none';
    document.getElementById('smartEmpty').style.display = 'none';
    document.getElementById('smartPlay').style.display = 'block';
    renderSmartPlayCount();
    renderSmart();
  };
  function renderSmartPlayCount() {
    const d = loadSmartData();
    const learned = wordsData.filter(w => (d[w.clean] || { level: 0 }).level >= 5).length;
    document.getElementById('smartPlayCount').innerHTML = 'Осталось: <b>' + smartQueue.length + '</b> · Выучено: <b>' + learned + '</b>';
  }
  function renderSmart() {
    const w = smartQueue[smartIndex];
    document.getElementById('smartFeedback').className = 'ege-feedback';
    document.getElementById('smartNextBtn').style.display = 'none';
    smartAnswered = false;
    renderWordBox('smartWord', 'smartCat', w, handleSmartClick);
    requestAnimationFrame(() => fitFont(document.getElementById('smartWord')));
  }
  function handleSmartClick(idx, w) {
    if (smartAnswered) return;
    smartAnswered = true;
    const isCorrect = idx === w.stress;
    const d = loadSmartData();
    const entry = d[w.clean] || { level: 0 };
    if (isCorrect) {
      entry.level = Math.min(entry.level + 1, 5);
      entry.next = Date.now() + SMART_INTERVALS[entry.level];
      egeVibrate('correct');
      const correctChar = document.getElementById('smartWord').children[w.stress];
      if(correctChar) { correctChar.classList.add('pop'); setTimeout(()=>correctChar.classList.remove('pop'), 400); }
      const fb = document.getElementById('smartFeedback');
      fb.textContent = '✓ Верно! Следующее повторение: ' + SMART_LABELS[entry.level];
      fb.className = 'ege-feedback show ok';
    } else {
      entry.level = 0;
      entry.next = Date.now() + SMART_INTERVALS[0];
      egeVibrate('wrong');
      markChars('smartWord', w.stress, idx);
      const fb = document.getElementById('smartFeedback');
      fb.textContent = '✗ Неверно. Правильно: ' + w.word + '. Начинаем сначала.';
      fb.className = 'ege-feedback show err';
      const wrongChar = document.getElementById('smartWord').children[idx];
      if(wrongChar) { wrongChar.classList.add('shake'); setTimeout(()=>wrongChar.classList.remove('shake'), 400); }
    }
    d[w.clean] = entry;
    saveSmartData(d);
    renderSmartPlayCount();
    document.getElementById('smartNextBtn').style.display = 'block';
  }
  window.nextSmart = () => {
    smartIndex++;
    if (smartIndex >= smartQueue.length) {
      document.getElementById('smartPlay').style.display = 'none';
      document.getElementById('smartEmpty').style.display = 'block';
      const d = loadSmartData();
      let minNext = Infinity;
      wordsData.forEach(w => {
        const entry = d[w.clean] || { next: 0 };
        if (entry.level < 5 && entry.next < minNext) minNext = entry.next;
      });
      if (minNext === Infinity) {
        document.getElementById('smartEmptyText').textContent = 'Ты выучил все 190 слов! 🎓';
      } else {
        document.getElementById('smartEmptyText').textContent = 'Следующее слово ' + formatTimeLeft(minNext - Date.now());
      }
      renderSmartPills('smartEmptyProgress');
      if (smartQueue.length > 0) { setTimeout(()=>showBadge('Серия завершена!'), 400); window.egeConfetti && window.egeConfetti(); }
    } else {
      renderSmart();
    }
  };
  // DICTIONARY
  function renderDict() {
    const search = document.getElementById('dictSearch').value.toLowerCase().trim();
    const filterWrap = document.getElementById('dictFilters');
    if (!filterWrap.children.length) {
      const allBtn = document.createElement('button');
      allBtn.className = 'ege-filter active';
      allBtn.textContent = 'Все';
      allBtn.onclick = () => { currentFilter = 'all'; updateFilterUI(); renderDict(); };
      filterWrap.appendChild(allBtn);
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'ege-filter';
        btn.textContent = cat;
        btn.onclick = () => { currentFilter = cat; updateFilterUI(); renderDict(); };
        filterWrap.appendChild(btn);
      });
    }
    const list = document.getElementById('dictList');
    list.innerHTML = '';
    let filtered = wordsData;
    if (currentFilter !== 'all') filtered = filtered.filter(w => w.category === currentFilter);
    if (search) filtered = filtered.filter(w => w.clean.includes(search));
    if (!filtered.length) { list.innerHTML = '<div class="ege-dict-empty">Ничего не найдено</div>'; return; }
    filtered.forEach(w => {
      const item = document.createElement('div');
      item.className = 'ege-dict-item';
      const wordHtml = w.clean.split('').map((ch, i) => i === w.stress ? '<span class="stress">' + ch + '</span>' : ch).join('');
      item.innerHTML = '<div class="ege-dict-word">' + wordHtml + '</div><div class="ege-dict-cat">' + w.category + '</div>';
      list.appendChild(item);
    });
  }
  function updateFilterUI() {
    document.querySelectorAll('.ege-filter').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === (currentFilter === 'all' ? 'Все' : currentFilter));
    });
  }

  // STATS
  function renderStats() {
    const s = loadStats();
    document.getElementById('statTotal').textContent = s.total;
    document.getElementById('statCorrect').textContent = s.correct;
    document.getElementById('statAccuracy').textContent = s.total ? Math.round((s.correct / s.total) * 100) + '%' : '0%';
    document.getElementById('statTests').textContent = s.tests;
    const list = document.getElementById('mistakesList');
    list.innerHTML = '';
    const mistakesArr = Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]);
    if (!mistakesArr.length) { list.innerHTML = '<div class="ege-empty-state">Пока нет ошибок — так держать!</div>'; return; }
    mistakesArr.forEach(([word, count]) => {
      const w = wordsData.find(x => x.clean === word);
      const item = document.createElement('div');
      item.className = 'ege-mistake-item';
      item.innerHTML = '<div class="ege-mistake-word">' + (w ? w.word : word) + '</div><div class="ege-mistake-count">' + count + ' ошиб' + (count === 1 ? 'ка' : count < 5 ? 'ки' : 'ок') + '</div>';
      list.appendChild(item);
    });
  }


/* === ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ === */
function egeInitHandlers() {
  document.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      var action = el.getAttribute('data-action');
      switch(action) {
        case 'home': goHome(); break;
        case 'train': goTrain(); break;
        case 'test': goTest(); break;
        case 'dict': goDict(); break;
        case 'stats': goStats(); break;
        case 'modes': goModes(); break;
        case 'battle': goBattle(); break;
        case 'smart': goSmart(); break;
        case 'marathon': goMarathon(); break;
        case 'nextTrain': nextTrain(); break;
        case 'nextTest': nextTest(); break;
        case 'nextMarathon': nextMarathon(); break;
        case 'nextBattle': nextBattle(); break;
        case 'nextSmart': nextSmart(); break;
        case 'startBattle': startBattle(); break;
      }
    });
  });
  console.log('Udarink handlers attached (readyState: ' + document.readyState + ')');
}
// Скрипт стоит в конце body: если DOMContentLoaded уже прошёл (оптимизаторы типа Cloudflare Rocket Loader
// задерживают inline-скрипты) — запускаем сразу, иначе ждём события как раньше.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', egeInitHandlers);
} else {
  egeInitHandlers();
}
window.__egeReady = true;
console.log('Udarink script loaded successfully');