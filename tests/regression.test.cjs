const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
process.env.TZ = 'Europe/Moscow';
const root = path.join(__dirname, '..');
const source = ['words.js', 'app.js'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
function app(seed = {}, instant = '2026-09-09T09:00:00Z') {
  const storage = new Map(Object.entries(seed).map(([k,v]) => [k, JSON.stringify(v)]));
  let now = new Date(instant).getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  class Element {
    constructor() { this.children = []; this.style = {}; this.textContent = ''; this.classList = {add(){},remove(){},toggle(){},contains:()=>true}; }
    set innerHTML(value) { this.children = []; }
    appendChild(child) { this.children.push(child); }
    setAttribute() {} focus() {} before() {} addEventListener() {} querySelector() { return new Element(); } querySelectorAll() { return []; }
  }
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const context = vm.createContext({
    Date: Clock, console: {log(){},warn(){}}, navigator: {}, requestAnimationFrame(){}, setTimeout(){},
    localStorage: {getItem:key=>storage.get(key) ?? null, setItem:(key,value)=>storage.set(key,value)},
    document: {readyState:'loading', addEventListener(){}, getElementById:id=>id === 'confettiCanvas' ? null : get(id), createElement:()=>new Element(), querySelector:()=>new Element(), querySelectorAll:()=>[]},
  });
  context.window = context;
  context.addEventListener = () => {};
  context.matchMedia = () => ({matches:false});
  vm.runInContext(source, context);
  return {run: code=>vm.runInContext(code,context), get, setTime: date=>{now=new Date(date).getTime();}, storage};
}
test('190 stable unique cards, valid stress/vowels and disambiguated contexts', () => {
  const a = app();
  assert.equal(a.run('wordsData.length'), 190);
  assert.equal(a.run('new Set(wordsData.map(w=>w.id)).size'), 190);
  assert.equal(a.run("wordsData.every(w=>w.stress===w.word.search(/[АЕЁИОУЫЭЮЯ]/) && w.vowels.includes(w.stress))"),true);
  assert.equal(a.run("wordsData.filter(w=>w.clean==='отзыв').every(w=>w.context)"),true);
});
test('legacy smart progress migrates; ambiguous homographs start independently', () => {
  const a = app({ege4_smart:{банты:{level:3,next:100},отзыв:{level:5,next:100}}});
  assert.equal(a.run("loadSmartData()[wordsData.find(w=>w.clean==='банты').id].level"),3);
  assert.equal(a.run("wordsData.filter(w=>w.clean==='отзыв').every(w=>loadSmartData()[w.id].level===0)"),true);
  a.run("const pair=wordsData.filter(w=>w.clean==='отзыв'); const d=loadSmartData(); d[pair[0].id].level=4; saveSmartData(d)");
  assert.equal(a.run('loadSmartData()[pair[1].id].level'),0);
});
test('weekly cards return on their due date and continue at weekly intervals', () => {
  const a = app();
  a.run('const w=wordsData[0]; const d=loadSmartData(); d[w.id]={level:5,next:Date.now()+1000}; saveSmartData(d)');
  assert.equal(a.run('getDueWords().some(x=>x.id===w.id)'),false);
  a.setTime('2026-09-09T09:00:02Z');
  assert.equal(a.run('getDueWords().some(x=>x.id===w.id)'),true);
  a.run('handleSmartClick(w.stress,w)');
  assert.equal(a.run('loadSmartData()[w.id].next-Date.now()'),7*86400000);
  assert.equal(a.run('loadStats().total'),1);
});
test('smart count decreases; a wrong answer returns in ten minutes', () => {
  const a = app();
  a.run('startSmart(); handleSmartClick(0,smartQueue[0])');
  assert.match(a.get('smartPlayCount').textContent, /Осталось: 189/);
  assert.equal(a.run('loadStats().total'),1);
  assert.equal(a.run('loadSmartData()[smartQueue[0].id].next-Date.now()'),600000);
  a.run('nextSmart(); handleSmartClick(smartQueue[1].stress,smartQueue[1]); nextSmart()');
  assert.match(a.get('smartPlayCount').textContent, /Осталось: 188/);
});
test('legacy statistics retain totals and history; pending errors are resolved separately', () => {
  const a = app({ege4_stats:{total:12,correct:9,tests:1,mistakes:{отзыв:2,банты:1}}});
  assert.equal(a.run('getMistakeWords().length'),3);
  a.run("const w=wordsData.find(w=>w.clean==='банты'); recordAnswer(w,true)");
  assert.equal(a.run('loadStats().total'),13);
  assert.equal(a.run('getMistakeWords().length'),2);
  assert.equal(a.run('loadStats().mistakes[w.id]'),1);
  assert.equal(a.run('loadStats().tests'),1);
});
test('all four individual modes and battle record exactly one answer per card', () => {
  const a = app();
  a.run('initTrain(); handleTrainClick(trainQueue[0].stress,trainQueue[0]); handleTrainClick(trainQueue[0].stress,trainQueue[0])');
  a.run('initTest(); handleTestClick(testQueue[0].stress,testQueue[0])');
  a.run('startBattle(); handleBattleClick(battleQueue[0].stress,battleQueue[0])');
  a.run('startSmart(); handleSmartClick(smartQueue[0].stress,smartQueue[0])');
  a.run('initMarathon(); const m=loadMarathon(); const w=wordsById.get(m.daily.queue[0]); handleMarathonClick(w.stress,w)');
  assert.equal(a.run('loadStats().total'),5);
  assert.equal(a.run('loadStats().correct'),5);
});
test('exam finishes with a correct total and cannot be counted twice', () => {
  const a = app();
  a.run('initTest(); for(let i=0;i<10;i++){const w=testQueue[i];handleTestClick(i<7?w.stress:-1,w);nextTest();} nextTest()');
  assert.equal(a.get('resultScore').textContent,7);
  assert.equal(a.get('resultWrong').textContent,3);
  assert.equal(a.run('loadStats().tests'),1);
});
test('marathon uses local midnight and complete days for streaks', () => {
  const a = app({},'2026-09-08T21:30:00Z');
  assert.equal(a.run('getToday()'),'2026-09-09');
  assert.equal(a.run("calculateStreak({'2026-09-07':10,'2026-09-08':10,'2026-09-09':1})"),2);
  assert.equal(a.run("calculateStreak({'2026-09-07':10,'2026-09-08':10,'2026-09-09':10})"),3);
  assert.equal(a.run("calculateStreak({'2026-09-07':10,'2026-09-08':1,'2026-09-09':1})"),0);
});
test('marathon saves on answer, survives reopening and awards streak at ten answers', () => {
  const a = app();
  a.run('initMarathon(); const queueBefore=loadMarathon().daily.queue.join(); const first=wordsById.get(loadMarathon().daily.queue[0]); handleMarathonClick(first.stress,first); initMarathon()');
  assert.equal(a.run('loadMarathon().history[getToday()]'),1);
  assert.equal(a.run('loadMarathon().streak'),0);
  assert.equal(a.run('loadMarathon().daily.queue.join()===queueBefore'),true);
  a.run('for(let i=1;i<10;i++){const w=wordsById.get(loadMarathon().daily.queue[i]);handleMarathonClick(w.stress,w);nextMarathon();} nextMarathon()');
  assert.equal(a.run('loadMarathon().history[getToday()]'),10);
  assert.equal(a.run('loadMarathon().streak'),1);
  assert.equal(a.run('loadStats().total'),10);
});
test('marathon plan covers every card before repeating (19 completed days)', () => {
  const a = app();
  const seen = new Set();
  for(let day=1;day<=19;day++) {
    a.setTime('2026-09-' + String(day).padStart(2,'0') + 'T09:00:00Z');
    const ids = JSON.parse(a.run('JSON.stringify(ensureMarathonDay(loadMarathon()).daily.queue)'));
    assert.equal(new Set(ids).size,10);
    for(const id of ids) { assert.equal(seen.has(id),false); seen.add(id); }
    a.run('constForTest=loadMarathon(); constForTest.history[getToday()]=10; saveMarathon(constForTest)');
  }
  assert.equal(seen.size,190);
});
test('unfinished marathon cards remain in the plan after midnight', () => {
  const a = app();
  const queue = JSON.parse(a.run('JSON.stringify(ensureMarathonDay(loadMarathon()).daily.queue)'));
  a.run('const m=loadMarathon();m.history[getToday()]=3;saveMarathon(m)');
  a.setTime('2026-09-10T09:00:00Z');
  const next = JSON.parse(a.run('JSON.stringify(ensureMarathonDay(loadMarathon()).daily.queue)'));
  assert.deepEqual(next.slice(0,7),queue.slice(3));
});
test('empty mistake practice and corrupt saved shapes do not crash', () => {
  const a = app({ege4_stats:null,ege4_smart_v2:[],ege4_marathon:null});
  a.run('goMistakes(); startSmart(); initMarathon()');
  assert.equal(a.run('loadStats().total'),0);
  assert.equal(a.get('trainWord').textContent,'Готово!');
});

