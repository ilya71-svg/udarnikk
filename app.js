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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
  let trainMistakesOnly = false;
  let testQueue = [], testIndex = 0, testScore = 0, testAnswered = false, testStreak = 0;

  const wordsById = new Map(wordsData.map(w => [w.id, w]));
  const wordLabel = w => w.word + (w.context ? ' — ' + w.context : '');
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const countValue = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  function loadStats() {
    const raw = egeGet('ege4_stats', {});
    const s = isObject(raw) ? raw : {};
    s.total = countValue(s.total);
    s.correct = Math.min(s.total, countValue(s.correct));
    s.tests = countValue(s.tests);
    const mistakes = Object.create(null);
    Object.entries(isObject(s.mistakes) ? s.mistakes : {}).forEach(([key, value]) => {
      const matches = wordsData.filter(w => w.clean === key);
      const id = matches.length === 1 ? matches[0].id : key;
      mistakes[id] = countValue(mistakes[id]) + countValue(value);
    });
    s.mistakes = mistakes;
    if (!isObject(s.pending)) {
      s.pending = {};
      // Старые ошибки не имеют id: сохраняем историю и предлагаем все подходящие карточки.
      wordsData.forEach(w => {
        if (countValue(s.mistakes[w.id]) || countValue(s.mistakes[w.clean])) s.pending[w.id] = true;
      });
    }
    return s;
  }
  function saveStats(s) { egeSet('ege4_stats', s); }
  function recordAnswer(w, isCorrect) {
    const s = loadStats();
    s.total++;
    if (isCorrect) { s.correct++; delete s.pending[w.id]; }
    else {
      s.mistakes[w.id] = countValue(s.mistakes[w.id]) + 1;
      s.pending[w.id] = true;
    }
    saveStats(s);
  }
  function getMistakeWords() {
    const s = loadStats();
    return wordsData.filter(w => s.pending[w.id]);
  }

  function showScreen(id) {
    document.querySelectorAll('.ege-screen').forEach(el => el.classList.remove('active'));
    const screen = document.getElementById(id);
    screen.classList.add('active');
    const heading = screen.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll: true}); }
    requestAnimationFrame(() => screen.querySelectorAll('.ege-word').forEach(fitFont));
  }
  window.goHome = () => showScreen('screenHome');
  window.goTrain = () => { initTrain(); showScreen('screenTrain'); };
  window.goMistakes = () => { initTrain(true); showScreen('screenTrain'); };
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
    if (!wordEl.parentElement || !wordEl.parentElement.clientWidth) return;
    wordEl.style.fontSize = '';
    let size = parseFloat(getComputedStyle(wordEl).fontSize);
    while (wordEl.scrollWidth > wordEl.clientWidth && size > 16) {
      wordEl.style.fontSize = (--size) + 'px';
    }
  }
  function renderWordBox(containerId, catId, w, clickHandler) {
    document.getElementById(catId).textContent = w.category + (w.context ? ' · ' + w.context : '');
    const box = document.getElementById(containerId);
    const hint = box.parentElement?.previousElementSibling;
    if (hint?.classList.contains('ege-word-hint')) hint.hidden = false;
    box.innerHTML = '';
    for (let i = 0; i < w.clean.length; i++) {
      const ch = w.clean[i];
      const vowel = 'аеёиоуыэюя'.includes(ch);
      const span = document.createElement(vowel ? 'button' : 'span');
      span.className = 'ege-char';
      span.textContent = ch;
      if (vowel) {
        span.type = 'button';
        span.classList.add('vowel');
        span.setAttribute('aria-label', 'Ударение на «' + ch + '», буква ' + (i + 1));
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
      chars[i].disabled = true;
      chars[i].classList.remove('selected','correct','wrong','dim');
      if (i === stressIdx) chars[i].classList.add('correct');
      else if (i === chosenIdx && chosenIdx !== stressIdx) chars[i].classList.add('wrong');
      else chars[i].classList.add('dim');
    }
  }

  // TRAINING
  function initTrain(mistakesOnly = false) {
    trainMistakesOnly = mistakesOnly;
    trainQueue = shuffle(mistakesOnly ? getMistakeWords() : wordsData);
    document.querySelector('#screenTrain h1').textContent = mistakesOnly ? 'Работа над ошибками' : 'Тренировка';
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
    if (!trainQueue.length || trainIndex >= trainQueue.length) {
      const hint = document.getElementById('trainWord').parentElement?.previousElementSibling;
      if (hint?.classList.contains('ege-word-hint')) hint.hidden = true;
      document.getElementById('trainWord').textContent = 'Готово!';
      document.getElementById('trainCat').textContent = getMistakeWords().length ? 'Оставшиеся ошибки можно повторить из статистики' : 'Ошибок для повторения нет';
      document.getElementById('trainFeedback').textContent = '';
      document.getElementById('trainFeedback').className = 'ege-feedback';
      document.getElementById('trainNextBtn').style.display = 'none';
      document.getElementById('trainCounter').textContent = trainQueue.length + '/' + trainQueue.length;
      document.getElementById('trainProgress').style.width = '100%';
      return;
    }
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
    recordAnswer(w, isCorrect);
    markChars('trainWord', w.stress, idx);
    showFeedback('trainFeedback', isCorrect, wordLabel(w));
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
    if (!trainAnswered) return;
    trainAnswered = false;
    trainIndex++;
    if (!trainMistakesOnly && trainIndex >= trainQueue.length) { trainQueue = shuffle(wordsData); trainIndex = 0; }
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
    recordAnswer(w, isCorrect);
    markChars('testWord', w.stress, idx);
    showFeedback('testFeedback', isCorrect, wordLabel(w));
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
    if (!testAnswered) return;
    testAnswered = false;
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
  let marathonAnswered = false, marathonDate = '';
  function getDayKey(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function getToday() { return getDayKey(); }
  function previousDay(key) {
    const [year, month, day] = key.split('-').map(Number);
    return getDayKey(new Date(year, month - 1, day - 1, 12));
  }
  function calculateStreak(history, today = getToday()) {
    let key = countValue(history[today]) >= MARATHON_DAILY ? today : previousDay(today);
    let streak = 0;
    while (countValue(history[key]) >= MARATHON_DAILY) { streak++; key = previousDay(key); }
    return streak;
  }
  function loadMarathon() {
    const raw = egeGet('ege4_marathon', {});
    const m = isObject(raw) ? raw : {};
    m.history = isObject(m.history) ? m.history : {};
    m.remaining = Array.isArray(m.remaining) ? [...new Set(m.remaining)].filter(id => wordsById.has(id)) : [];
    m.streak = calculateStreak(m.history);
    return m;
  }
  function saveMarathon(m) { egeSet('ege4_marathon', m); }
  function ensureMarathonDay(m) {
    const today = getToday();
    if (!m.daily || m.daily.date !== today || !Array.isArray(m.daily.queue) || m.daily.queue.length !== MARATHON_DAILY || m.daily.queue.some(id => !wordsById.has(id))) {
      // Неотвеченные карточки прошлого дня возвращаются в общий план.
      if (m.daily && Array.isArray(m.daily.queue)) {
        const unfinished = m.daily.queue.slice(countValue(m.history[m.daily.date])).filter(id => wordsById.has(id));
        m.remaining = [...new Set([...unfinished, ...m.remaining])];
      }
      const queue = [];
      while (queue.length < MARATHON_DAILY) {
        if (!m.remaining.length) m.remaining = shuffle(wordsData.map(w => w.id));
        const index = m.remaining.findIndex(id => !queue.includes(id));
        queue.push(m.remaining.splice(index, 1)[0]);
      }
      m.daily = {date: today, queue};
      saveMarathon(m);
    }
    return m;
  }
  function initMarathon() {
    ensureMarathonDay(loadMarathon());
    renderMarathonUI();
    renderMarathonWord();
  }
  function renderMarathonUI() {
    const m = loadMarathon(), today = getToday();
    const done = Math.min(MARATHON_DAILY, countValue(m.history[today]));
    document.getElementById('marathonStreakNum').textContent = m.streak;
    document.getElementById('marathonCounter').textContent = done + '/' + MARATHON_DAILY;
    document.getElementById('marathonProgress').style.width = done / MARATHON_DAILY * 100 + '%';
    const week = document.getElementById('marathonWeek');
    week.innerHTML = '';
    const names = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    for (let i = -6; i <= 0; i++) {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
      const count = countValue(m.history[getDayKey(d)]);
      const cell = document.createElement('div');
      cell.className = 'ege-day' + (i === 0 ? ' today' : '') + (count >= MARATHON_DAILY ? ' done' : '');
      cell.textContent = names[d.getDay()] + ' ' + d.getDate();
      cell.title = count + ' из ' + MARATHON_DAILY;
      week.appendChild(cell);
    }
    const milestones = [[7, '🐺 Неделя подряд'], [14, '🔥 Две недели'], [30, '👑 Марафонец']];
    document.getElementById('marathonBadges').textContent = milestones.filter(([n]) => m.streak >= n).map(([, label]) => label).join(' · ');
    document.getElementById('marathonStatus').textContent = done >= MARATHON_DAILY ? '✅ Норма на сегодня выполнена!' : 'Норма: 10 ответов в день. Серия растёт после полной нормы.';
  }
  function renderMarathonWord() {
    const m = ensureMarathonDay(loadMarathon());
    marathonDate = getToday();
    marathonAnswered = false;
    const done = countValue(m.history[marathonDate]);
    document.getElementById('marathonNextBtn').style.display = 'none';
    document.getElementById('marathonFeedback').textContent = '';
    document.getElementById('marathonFeedback').className = 'ege-feedback';
    if (done >= MARATHON_DAILY) {
      const hint = document.getElementById('marathonWord').parentElement?.previousElementSibling;
      if (hint?.classList.contains('ege-word-hint')) hint.hidden = true;
      document.getElementById('marathonWord').textContent = '🎉 Готово!';
      document.getElementById('marathonCat').textContent = 'Возвращайся завтра за новой десяткой';
      return;
    }
    renderWordBox('marathonWord', 'marathonCat', wordsById.get(m.daily.queue[done]), handleMarathonClick);
  }
  function handleMarathonClick(idx, w) {
    if (marathonAnswered) return;
    if (marathonDate !== getToday()) { initMarathon(); return; }
    marathonAnswered = true;
    const isCorrect = idx === w.stress;
    recordAnswer(w, isCorrect);
    markChars('marathonWord', w.stress, idx);
    showFeedback('marathonFeedback', isCorrect, wordLabel(w));
    egeVibrate(isCorrect ? 'correct' : 'wrong');
    const m = loadMarathon();
    m.history[marathonDate] = Math.min(MARATHON_DAILY, countValue(m.history[marathonDate]) + 1);
    m.streak = calculateStreak(m.history);
    saveMarathon(m);
    renderMarathonUI();
    const button = document.getElementById('marathonNextBtn');
    button.textContent = m.history[marathonDate] >= MARATHON_DAILY ? 'Завершить' : 'Далее';
    button.style.display = 'block';
    if (m.history[marathonDate] === MARATHON_DAILY) showBadge('Дневная норма выполнена!');
  }
  window.nextMarathon = () => {
    if (!marathonAnswered) return;
    initMarathon();
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
    recordAnswer(w, isCorrect);
    markChars('battleWord', w.stress, idx);
    showFeedback('battleFeedback', isCorrect, wordLabel(w));
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
    if (!battleAnswered) return;
    battleAnswered = false;
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
  const SMART_INTERVALS = [10*60*1000, 10*60*1000, 60*60*1000, 24*60*60*1000, 3*24*60*60*1000, 7*24*60*60*1000];
  const SMART_LABELS = ['Новые / повторить','10 мин','Час','День','3 дня','Неделя'];
  const SMART_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'];
  let smartQueue = [], smartIndex = 0, smartAnswered = false;
  function loadSmartData() {
    let data = egeGet('ege4_smart_v2', null);
    if (!isObject(data)) {
      const old = egeGet('ege4_smart', {});
      data = {};
      wordsData.forEach(w => {
        const matching = wordsData.filter(other => other.clean === w.clean);
        // У старого «отзыв» общий прогресс двух значений: их следует проверить заново.
        if (isObject(old) && matching.every(other => other.stress === w.stress) && isObject(old[w.clean])) data[w.id] = old[w.clean];
      });
    }
    wordsData.forEach(w => {
      const entry = isObject(data[w.id]) ? data[w.id] : {};
      data[w.id] = {level: Math.min(5, countValue(entry.level)), next: countValue(entry.next)};
    });
    saveSmartData(data);
    return data;
  }
  function saveSmartData(data) { egeSet('ege4_smart_v2', data); }
  function getSmartStats() {
    const data = loadSmartData(), counts = [0,0,0,0,0,0];
    wordsData.forEach(w => counts[data[w.id].level]++);
    return counts;
  }
  function renderSmartPills(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    getSmartStats().forEach((count, i) => {
      if (!count) return;
      const pill = document.createElement('div');
      pill.className = 'ege-smart-pill';
      pill.style.background = SMART_COLORS[i];
      pill.style.flexGrow = count;
      pill.title = SMART_LABELS[i] + ' · карточек: ' + count;
      container.appendChild(pill);
    });
  }
  function getDueWords() {
    const data = loadSmartData(), now = Date.now();
    return wordsData.filter(w => data[w.id].next <= now).sort((a, b) => data[a.id].next - data[b.id].next);
  }
  function initSmartIntro() {
    document.getElementById('smartIntro').style.display = 'block';
    document.getElementById('smartPlay').style.display = 'none';
    document.getElementById('smartEmpty').style.display = 'none';
    document.getElementById('smartCount').textContent = 'На недельном повторении: ' + getSmartStats()[5] + ' из ' + wordsData.length + '. Сейчас доступно: ' + getDueWords().length;
  }
  function formatTimeLeft(ms) {
    if (ms <= 0) return 'сейчас';
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return 'через ' + minutes + ' мин';
    const hours = Math.ceil(ms / 3600000);
    return hours < 24 ? 'через ' + hours + ' ч' : 'через ' + Math.ceil(ms / 86400000) + ' д';
  }
  function showSmartEmpty() {
    document.getElementById('smartIntro').style.display = 'none';
    document.getElementById('smartPlay').style.display = 'none';
    document.getElementById('smartEmpty').style.display = 'block';
    const data = loadSmartData();
    const minNext = Math.min(...wordsData.map(w => data[w.id].next));
    const due = getDueWords().length;
    document.getElementById('smartEmptyTitle').textContent = due ? 'Есть карточки для повторения' : 'На сейчас всё!';
    document.getElementById('smartEmptyText').textContent = due ? 'Доступно карточек: ' + due : 'Следующее повторение ' + formatTimeLeft(minNext - Date.now()) + '. Выученные слова тоже вернутся.';
    renderSmartPills('smartEmptyProgress');
  }
  window.startSmart = () => {
    smartQueue = getDueWords();
    smartIndex = 0; smartAnswered = false;
    if (!smartQueue.length) { showSmartEmpty(); return; }
    document.getElementById('smartIntro').style.display = 'none';
    document.getElementById('smartEmpty').style.display = 'none';
    document.getElementById('smartPlay').style.display = 'block';
    renderSmart();
  };
  function renderSmartPlayCount() {
    const remaining = Math.max(0, smartQueue.length - smartIndex - (smartAnswered ? 1 : 0));
    document.getElementById('smartPlayCount').textContent = 'Осталось: ' + remaining + ' · На недельном повторении: ' + getSmartStats()[5];
    renderSmartPills('smartProgress');
  }
  function renderSmart() {
    document.getElementById('smartFeedback').textContent = '';
    document.getElementById('smartFeedback').className = 'ege-feedback';
    document.getElementById('smartNextBtn').style.display = 'none';
    smartAnswered = false;
    renderSmartPlayCount();
    renderWordBox('smartWord', 'smartCat', smartQueue[smartIndex], handleSmartClick);
  }
  function handleSmartClick(idx, w) {
    if (smartAnswered) return;
    smartAnswered = true;
    const isCorrect = idx === w.stress, data = loadSmartData();
    const entry = data[w.id];
    entry.level = isCorrect ? Math.min(entry.level + 1, 5) : 0;
    entry.next = Date.now() + SMART_INTERVALS[entry.level];
    saveSmartData(data);
    recordAnswer(w, isCorrect);
    markChars('smartWord', w.stress, idx);
    egeVibrate(isCorrect ? 'correct' : 'wrong');
    const feedback = document.getElementById('smartFeedback');
    feedback.textContent = (isCorrect ? '✓ Верно!' : '✗ Неверно. Правильно: ' + wordLabel(w) + '.') + ' Повторение ' + formatTimeLeft(entry.next - Date.now());
    feedback.className = 'ege-feedback show ' + (isCorrect ? 'ok' : 'err');
    renderSmartPlayCount();
    document.getElementById('smartNextBtn').style.display = 'block';
  }
  window.nextSmart = () => {
    if (!smartAnswered) return;
    smartAnswered = false;
    smartIndex++;
    if (smartIndex >= smartQueue.length) showSmartEmpty();
    else renderSmart();
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
      if (w.context) { const context = document.createElement('div'); context.className = 'ege-word-context'; context.textContent = w.context; item.appendChild(context); }
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
    document.getElementById('statAccuracy').textContent = s.total ? Math.round(s.correct / s.total * 100) + '%' : '0%';
    document.getElementById('statTests').textContent = s.tests;
    const pending = getMistakeWords().length;
    const button = document.getElementById('repeatMistakesBtn');
    button.disabled = !pending;
    button.textContent = pending ? 'Повторить мои ошибки (' + pending + ')' : 'Все ошибки отработаны';
    const list = document.getElementById('mistakesList');
    list.innerHTML = '';
    const entries = Object.entries(s.mistakes).filter(([, n]) => countValue(n)).sort((a,b) => b[1] - a[1]);
    if (!entries.length) { list.textContent = 'Пока нет ошибок. Здесь появятся слова для повторения.'; return; }
    entries.forEach(([key, value]) => {
      const w = wordsById.get(key);
      const item = document.createElement('div'); item.className = 'ege-mistake-item';
      const label = document.createElement('div'); label.className = 'ege-mistake-word';
      const legacy = wordsData.filter(card => card.clean === key);
      label.textContent = w ? wordLabel(w) : legacy.length && legacy.every(card => card.stress === legacy[0].stress) ? wordLabel(legacy[0]) : key + ' (старые ответы без контекста)';
      const count = document.createElement('div'); count.className = 'ege-mistake-count';
      count.textContent = 'Ошибок: ' + countValue(value);
      item.appendChild(label); item.appendChild(count); list.appendChild(item);
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
        case 'mistakes': goMistakes(); break;
        case 'startSmart': startSmart(); break;
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
  document.getElementById('dictSearch').addEventListener('input', renderDict);
  document.querySelectorAll('.ege-feedback').forEach(el => { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); });
  document.querySelectorAll('.ege-word-box').forEach(box => {
    const hint = document.createElement('p'); hint.className = 'ege-word-hint';
    hint.textContent = 'Нажми на ударную гласную'; box.before(hint);
  });
  window.addEventListener('resize', () => document.querySelectorAll('.ege-screen.active .ege-word').forEach(fitFont));
  window.__egeReady = true;
}
// Скрипт стоит в конце body: если DOMContentLoaded уже прошёл (оптимизаторы типа Cloudflare Rocket Loader
// задерживают inline-скрипты) — запускаем сразу, иначе ждём события как раньше.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', egeInitHandlers);
} else {
  egeInitHandlers();
}
console.log('Udarink script loaded successfully');
