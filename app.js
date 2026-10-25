/* Storage: the app's async shape, backed by the browser. If the browser refuses,
   we keep a memory copy so the session works, but flag it so the app can say so. */
(function () {
  var mem = {}, store = null;
  try { localStorage.setItem('__p__','1'); localStorage.removeItem('__p__'); store = localStorage; }
  catch (e) { store = null; }
  window.storage = {
    blocked: !store,
    get: function (k) { return new Promise(function (res, rej) {
      var v; try { v = store ? store.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return rej(e); }
      if (v === null || v === undefined) rej(new Error('not found')); else res({ key: k, value: v }); }); },
    set: function (k, v) { return new Promise(function (res, rej) {
      try { if (store) store.setItem(k, v); mem[k] = String(v); res({ key: k, value: v }); }
      catch (e) { mem[k] = String(v); rej(e); } }); },
    remove: function (k) { return new Promise(function (res) {
      try { if (store) store.removeItem(k); } catch (e) {} delete mem[k]; res({ key: k, deleted: true }); }); },
    list: function (p) { return new Promise(function (res) {
      var out = [], i, k;
      try { if (store) { for (i = 0; i < store.length; i++) { k = store.key(i);
        if (!p || k.indexOf(p) === 0) out.push(k); } } } catch (e) {}
      for (k in mem) if ((!p || k.indexOf(p) === 0) && out.indexOf(k) === -1) out.push(k);
      res({ keys: out }); }); }
  };
})();
try { if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist(); }); } } catch (e) {}


(function () {
  var STORE = 'training-entries-v2';
  var INTENT = 'training-intent-v3';
  var SEEDED = 'training-seeded-v2';
  var BACKUP = 'training-backup-v2';
  var diag = { state: 'ok', msg: '', keys: [], lastWrite: null, offerSeed: false };

  async function seedNow() {
    entries = SEED.map(function (x, i) { return { id: x.id || ('seed' + i), leaf: x.leaf, date: x.date, v: x.v, at: x.at || i }; });
    await safeSet(STORE, JSON.stringify(entries));
    await safeSet(SEEDED, 'yes');
    diag.state = 'ok'; diag.offerSeed = false;
    diag.msg = 'Started from the history in your climbing doc.';
  }

  var DATA = {
    climbing: {
      name: 'Climbing', colour: 'var(--climb)',
      blocks: [
        { id: 'c1', name: 'Deadhangs + Light FB / Carry', target: 1, kind: 'all', children: [
          { id: 'wu-dh', name: 'Deadhangs 30/30', metric: 'reps', unit: 'hangs', timer: { work: 30, rest: 30, reps: 8, sets: 1, setRest: 0 } },
          { id: 'wu-fbc', name: 'FB carry', metric: 'reps', unit: 'carries', timer: { work: 10, rest: 15, reps: 6, sets: 1, setRest: 0 } }
        ]},
        { id: 'c2', name: 'FB 7:33 + Alt Arms', target: 1, kind: 'all', children: [
          { id: 'wu-fb', name: 'FB 7on, 33off, 3m rest', metric: 'reps', unit: 'hangs', timer: { work: 7, rest: 33, reps: 8, sets: 3, setRest: 180 } },
          { id: 'wu-alt', name: 'Alt Arms', metric: 'reps', unit: 'hangs' }
        ]},
        { id: 'c3', name: 'Warmup while training a skill', target: 1, kind: 'all', children: [
          { id: 'wu-skill', name: 'Skill', metric: 'skill', unit: 'goes', note: 'heel, toe, flag, inside flag — or add your own' }
        ]},
        { id: 'end', name: 'Volume Endurance', target: 1, kind: 'pick', metricLabel: 'time on wall', children: [
          { id: 'end-a', name: 'Traverse Wall 3, 2, 1', metric: 'times' },
          { id: 'end-b', name: 'AB Super Light - Rainbow', metric: 'times' }
        ]},
        { id: 'pe', name: 'Power Endurance', target: 1, kind: 'pick', metricLabel: 'count per grade', children: [
          { id: 'pe-a', name: 'Circuit board', metric: 'volume', note: 'hard but not max' },
          { id: 'pe-d', name: 'AB 6b / 6b+ / 6c', metric: 'volume' },
          { id: 'pe-e', name: 'Lead 6a+ / 6b / 6b+', metric: 'volume' },
          { id: 'pe-b', name: 'Traverse, both walls', metric: 'volume', retired: true },
          { id: 'pe-c', name: 'Boulders level 5', metric: 'volume', retired: true }
        ]},
        { id: 'sk', name: 'Pushing Max Skill', target: 1, kind: 'pick', metricLabel: 'sent vs tried', children: [
          { id: 'sk-a', name: 'Boulder 6 / 7', metric: 'sends' },
          { id: 'sk-b', name: 'Lead 7a & +', metric: 'sends' },
          { id: 'sk-c', name: 'AB 7a & +', metric: 'sends' }
        ]}
      ]
    },
    gym: {
      name: 'Gym', colour: 'var(--gym)',
      blocks: [
        { id: 'ab', name: 'Ab Flow', target: 2, kind: 'all', children: [
          { id: 'ab2', name: 'Bird dogs', metric: 'reps', unit: 'reps' },
          { id: 'ab1', name: 'Lying down leg raise', metric: 'hold', note: 'flat back, pelvic tilt — play with leg positions' },
          { id: 'ab4', name: 'Hanging leg raise', metric: 'reps', unit: 'reps' },
          { id: 'ab3', name: 'L-sit hold', metric: 'reps', unit: 'seconds' }
        ]},
        { id: 'gm', name: 'Good Mornings', target: 1, kind: 'all', children: [
          { id: 'lo3a', name: 'Hip ins and outs', metric: 'reps', unit: 'reps', note: 'warmup — cross over, cable, mat or band' },
          { id: 'lo1a', name: 'Single leg good mornings', metric: 'weight', note: 'crux — or deadlift' },
          { id: 'lo1b', name: 'Hip bench step down', metric: 'reps', unit: 'reps', note: 'combo' }
        ]},
        { id: 'ch', name: 'Cable Ham', target: 1, kind: 'all', children: [
          { id: 'lo2w', name: 'Leg swings and wide splits', metric: 'reps', unit: 'reps', note: 'warmup' },
          { id: 'lo2b', name: 'Cable hamstring eccentric', metric: 'weight', note: 'crux' },
          { id: 'lo2c', name: 'Hip flexor warrior pose', metric: 'reps', unit: 'reps', note: 'combo' }
        ]},
        { id: 'sl', name: 'Single Leg', target: 1, kind: 'all', children: [
          { id: 'lo1w', name: 'Single leg forward fold', metric: 'reps', unit: 'reps', note: 'warmup' },
          { id: 'lo3b', name: 'Single leg stand', metric: 'reps', unit: 'seconds', note: 'balance' },
          { id: 'lo3c', name: 'Single leg airplanes', metric: 'reps', unit: 'reps', note: 'balance' }
        ]},
        { id: 'uf1', name: 'Chest', target: 1, kind: 'all', children: [
          { id: 'up1', name: 'Incline chest + hold / dips + hold', metric: 'weight' },
          { id: 'up8', name: 'Flys', metric: 'weight' },
          { id: 'up9', name: 'Shoulder press', metric: 'weight' },
          { id: 'up3', name: 'Lat bench overhead', metric: 'weight' },
          { id: 'up2', name: 'Dip hold', metric: 'reps', unit: 'seconds', retired: true }
        ]},
        { id: 'uf2', name: 'Climbing Optimiser', target: 1, kind: 'all', children: [
          { id: 'up10', name: 'Reverse rows', metric: 'reps', unit: 'reps', note: 'on bar' },
          { id: 'up4', name: 'Side raise knee up', metric: 'weight' },
          { id: 'up5', name: 'Wrist curl reverse', metric: 'weight' },
          { id: 'up6', name: 'Wrist curls', metric: 'weight' }
        ]},
        { id: 'uf3', name: 'Pull', target: 1, kind: 'all', children: [
          { id: 'up11', name: 'Pull ups / pull downs', metric: 'reps', unit: 'reps' },
          { id: 'up12', name: 'Side raises lying on bench', metric: 'weight' },
          { id: 'up7', name: 'Wrist side twists', metric: 'reps', unit: 'reps', note: 'long stick' }
        ]}
      ]
    },
    mobility: {
      name: 'Mobility', colour: 'var(--stretch)',
      blocks: [
        { id: 'm1', name: 'Lower & Middle Back Mobility', target: 1, kind: 'all', children: [
          { id: 'mb-twist', name: 'Side twists', metric: 'hold' },
          { id: 'mb-foam', name: 'Foam roller', metric: 'hold' },
          { id: 'mb-pancake', name: 'Pancake', metric: 'hold', note: 'sit and hold' },
          { id: 'mb-arch', name: 'Arched back, bikram style', metric: 'hold', note: 'back and sides — standing, on knees or sitting' },
          { id: 'm1a', name: 'Lower & middle back', metric: 'hold', note: 'whole block, before it was split', retired: true }
        ]},
        { id: 'm2', name: 'Glutes / Arched Back', target: 1, kind: 'all', children: [
          { id: 'gl-fig4', name: 'Figure 4', metric: 'hold' },
          { id: 'gl-pigeon', name: 'Pigeon raise', metric: 'hold' },
          { id: 'gl-fig4foam', name: 'Figure 4 + foam', metric: 'hold' },
          { id: 'gl-yogi', name: 'Sitting yogi style', metric: 'hold' },
          { id: 'gl-child', name: 'Cross leg child pose', metric: 'hold' },
          { id: 'm2a', name: 'Glutes / arched back', metric: 'hold', note: 'whole block, before it was split', retired: true }
        ]},
        { id: 'm3', name: 'Hamstring', target: 1, kind: 'all', children: [
          { id: 'hm-cork', name: 'Cork ball', metric: 'hold', note: 'use it more, it gives a lot' },
          { id: 'hm-wide', name: 'Wide splits forward fold', metric: 'hold' },
          { id: 'hm-single', name: 'Single leg forward fold', metric: 'hold' },
          { id: 'hm-jeff', name: 'Jefferson curl', metric: 'hold' },
          { id: 'hm-long', name: 'Forward fold long', metric: 'hold' }
        ]},
        { id: 'm4', name: 'Inside / Outside Hip', target: 1, kind: 'all', children: [
          { id: 'ih-baby', name: 'Happy baby', metric: 'hold' },
          { id: 'ih-frog', name: 'Frog lizard pose', metric: 'hold' }
        ]},
        { id: 'm5', name: 'Hip Flexor w/ Quad', target: 1, kind: 'all', children: [
          { id: 'hq-lunge', name: 'Low lunge + quad', metric: 'hold' },
          { id: 'hq-nordic', name: 'Nordic hip flexor', metric: 'hold' },
          { id: 'hq-sit', name: 'Sitting on legs, leaning backwards', metric: 'hold' }
        ]},
        { id: 'm6', name: 'Chest / Shoulders', target: 1, kind: 'all', children: [
          { id: 'cs-side', name: 'Lying on one side', metric: 'hold', note: 'upper chest' },
          { id: 'cs-bolster', name: 'Bolster stretch / cactus pose', metric: 'hold' },
          { id: 'cs-puppy', name: 'Puppy pose', metric: 'hold' },
          { id: 'cs-bench', name: 'Weighted bench', metric: 'hold' }
        ]}
      ]
    },
    outdoor: {
      name: 'Outdoor', colour: 'var(--outdoor)', untracked: true,
      blocks: [
        { id: 'out', name: 'Outdoor Climbing', kind: 'all', children: [
          { id: 'out-f', name: 'Number of falls', metric: 'reps', unit: 'falls' },
          { id: 'out-log', name: 'Session log', metric: 'note', note: 'what happened, how it felt' }
        ]}
      ]
    },
    running: {
      name: 'Running', colour: 'var(--run)',
      blocks: [
        { id: 'rn', name: 'Running', target: 1, kind: 'pick', metricLabel: 'pace', children: [
          { id: 'rn-a', name: 'Run', metric: 'run' },
          { id: 'rn-b', name: 'Sprint', metric: 'run' }
        ]}
      ]
    }
  };
  var PROMPTS = {
    climbing: ['Take 10 practice falls', 'Fall once before I feel ready',
      'Climb one route thinking only about feet', 'Place each foot once, no readjusting',
      'Do at least 10 lead climbs', 'Climb for time on wall, not for grade',
      'Climb my session, not my friend\u2019s', 'Stick to the plan when something better appears'],
    gym: ['Leave one rep in the tank', 'Full range over heavy', 'Finish every block I start'],
    stretching: ['Breathe out into each hold', 'Hold past the point it gets boring',
      'Stop before it hurts, not after'],
    running: ['Keep it conversational', 'Finish faster than I started', 'Run by feel, not by pace']
  };

  var SEED = [
    { id: 'seed0', leaf: 'wu-dh', date: '2026-08-29', v: { reps:  "8" } },
    { id: 'seed1', leaf: 'end-a', date: '2026-08-29', v: { times:  "8.20, 5.20, 3.30" } },
    { id: 'seed2', leaf: 'pe-d', date: '2026-09-02', v: { count:  "7", grade:  "6b" } },
    { id: 'seed3', leaf: 'wu-dh', date: '2026-09-04', v: { reps:  "8" } },
    { id: 'seed4', leaf: 'wu-fb', date: '2026-09-07', v: { reps:  "3, 8" } },
    { id: 'seed5', leaf: 'wu-alt', date: '2026-09-07', v: { reps:  "16, 16" } },
    { id: 'seed6', leaf: 'up1', date: '2026-09-09', v: { weight:  "18", reps:  "8" } },
    { id: 'seed7', leaf: 'up5', date: '2026-09-09', v: { weight:  "10", reps:  "12" } },
    { id: 'seed8', leaf: 'end-a', date: '2026-09-15', v: { times:  "13.30, 7.45, 4.45" } },
    { id: 'seed9', leaf: 'pe-e', date: '2026-09-15', v: { count:  "3", grade:  "6b+" } },
    { id: 'seed10', leaf: 'end-b', date: '2026-09-19', v: { times:  "11.00, 9.00" } },
    { id: 'seed11', leaf: 'end-b', date: '2026-09-22', v: { times:  "10.00, 10.00, 10.00" } },
    { id: 'seed12', leaf: 'wu-fb', date: '2026-09-24', v: { reps:  "4, 2" } },
    { id: 'seed13', leaf: 'end-b', date: '2026-09-24', v: { times:  "19.00" } },
    { id: 'seed14', leaf: 'sk-c', date: '2026-09-24', v: { sent:  "0", tried:  "2", grade:  "7a", note:  "topped both, one fall" } },
    { id: 'seed15', leaf: 'wu-fb', date: '2026-09-29', v: { reps:  "3, 4" } },
    { id: 'seed16', leaf: 'end-a', date: '2026-09-29', v: { times:  "7.50" } },
    { id: 'seed17', leaf: 'sk-b', date: '2026-09-29', v: { sent:  "0", tried:  "1", grade:  "7a", note:  "topped with 5 takes" } },
    { id: 'seed18', leaf: 'out-log', date: '2026-10-04', v: { text:  "Outdoor 5+, could not do it clean. First climb, forgive yourself. 5+ clean after. 6a on top rope, nice." } },
    { id: 'seed19', leaf: 'out-log', date: '2026-10-05', v: { text:  "Started scared, took on an easy route. Decided to practise falls instead. Then used an ohm and did a 6a+ feeling chill. Happy." } },
    { id: 'seed20', leaf: 'pe-e', date: '2026-10-09', v: { count:  "2", grade:  "6b" } },
    { id: 'seed21', leaf: 'out-log', date: '2026-10-09', v: { text:  "Slow day at Itchy, taught a lot including cleaning. Much better the second time on the 6b." } },
    { id: 'seed22', leaf: 'sk-b', date: '2026-10-10', v: { sent:  "0", tried:  "3", grade:  "7a" } },
    { id: 'seed23', leaf: 'out-log', date: '2026-10-10', v: { text:  "Morning at Seismico, 5+ with falls, 6a, tried 6c. Then Itchchu for the 7a, nowhere near. Should have stuck on the 6b and worked perfection on a medium-hard route." } },
    { id: 'seed24', leaf: 'out-log', date: '2026-10-15', v: { text:  "Tallat, roig, Emo. Got lost, did not read the instructions properly. Eventually got a climb and practised falling high on a 5c. Good route." } },
    { id: 'e17922370951789gkp', leaf: 'out-f', date: '2026-10-15', v: { reps:  "4" }, at: 1792237095178 },
    { id: 'seed25', leaf: 'out-log', date: '2026-10-16', v: { text:  "Tallat, roig, Dalma. Aim was to fall 10x and work a 6b/+ three or four times really clean. The 6b after the warm up was impossible. Three hours on the first three clips, did not have it in me to finish." } },
    { id: 'e1792237085555grsn', leaf: 'out-f', date: '2026-10-16', v: { reps:  "10" }, at: 1792237085555 },
    { id: 'e1792259855549l5g0', leaf: 'out-f', date: '2026-10-17', v: { reps:  "3" }, at: 1792259855549 },
    { id: 'e1792259913175nzc2', leaf: 'out-log', date: '2026-10-17', v: { text:  "Dws. First freestyle low grade heart rate high, then commited to it and was good although tense. Then tried the harder section but the down climbing was hard so just had fun and fell/ jumped" }, at: 1792259913175 },
    { id: 'e1792521411333otdv', leaf: 'lo1a', date: '2026-10-20', v: { weight:  "20", reps:  "15,15" }, at: 1792521411333 },
    { id: 'e1792521419109kcz5', leaf: 'lo3a', date: '2026-10-20', v: { reps:  "15,15" }, at: 1792521419109 },
    { id: 'e1792521422956y2e3', leaf: 'lo1b', date: '2026-10-20', v: { reps:  "15,15" }, at: 1792521422956 },
    { id: 'e179252187812597nw', leaf: 'm1a', date: '2026-10-20', v: { mins:  "5" }, at: 1792521878125 },
    { id: 'e179252212369223ya', leaf: 'm2a', date: '2026-10-20', v: { mins:  "2.5" }, at: 1792522123692 },
    { id: 'e1792522217819tlwn', leaf: 'wu-dh', date: '2026-10-20', v: { reps:  "6" }, at: 1792522217819 },
    { id: 'e17925636732366n7l', leaf: 'gl-fig4foam', date: '2026-10-20', v: { mins:  "2.5" }, at: 1792563673238 },
    { id: 'e1792563704226x1om', leaf: 'mb-foam', date: '2026-10-20', v: { mins:  "5" }, at: 1792563704226 },
    { id: 'e17925673267679p1h', leaf: 'hm-long', date: '2026-10-21', v: { mins:  "7" }, at: 1792567326767 },
    { id: 'e1792567606986ce1s', leaf: 'gl-child', date: '2026-10-21', v: { mins:  "3.3" }, at: 1792567606986 },
    { id: 'e1792567967593bts4', leaf: 'ih-baby', date: '2026-10-21', v: { mins:  "2.5" }, at: 1792567967594 },
    { id: 'e1792567986562qqg0', leaf: 'gl-fig4', date: '2026-10-21', v: { mins:  "2.5" }, at: 1792567986562 },
    { id: 'e1792572819239kuzj', leaf: 'rn-a', date: '2026-10-21', v: { distance:  "3.75", time:  "21.29", desc:  "" }, at: 1792572819239 },
    { id: 'e179260326031230e8', leaf: 'wu-fb', date: '2026-10-21', v: { reps:  "4,3" }, at: 1792603260312 },
    { id: 'e1792928663777si9k', leaf: 'hm-cork', date: '2026-10-24', v: { mins:  "1" }, at: 1792928663777 },
    { id: 'e1792925678439keiu', leaf: 'up1', date: '2026-10-25', v: { weight:  "18", reps:  "10,10,10" }, at: 1792925678439 },
    { id: 'e1792925687096s4uf', leaf: 'up8', date: '2026-10-25', v: { weight:  "6", reps:  "10,10,10" }, at: 1792925687096 },
    { id: 'e1792926474197t7sj', leaf: 'up9', date: '2026-10-25', v: { weight:  "12", reps:  "12,12,12" }, at: 1792926474197 },
    { id: 'e17929264916260dri', leaf: 'up3', date: '2026-10-25', v: { weight:  "12", reps:  "8,10,8" }, at: 1792926491626 },
    { id: 'e1792926910045ktz4', leaf: 'lo2w', date: '2026-10-25', v: { reps:  "20,16" }, at: 1792926910045 },
    { id: 'e1792927407262b9e3', leaf: 'lo2b', date: '2026-10-25', v: { weight:  "6.75", reps:  "15,15,15" }, at: 1792927407262 },
    { id: 'e17929274149078smp', leaf: 'lo2c', date: '2026-10-25', v: { reps:  "10,10,10" }, at: 1792927414907 },
    { id: 'e17929275864625wq8', leaf: 'ab4', date: '2026-10-25', v: { reps:  "5,5,5" }, at: 1792927586462 },
    { id: 'e1792927889386x01q', leaf: 'ab1', date: '2026-10-25', v: { reps:  "2.5" }, at: 1792927889386 },
    { id: 'e179292796153990qs', leaf: 'ab2', date: '2026-10-25', v: { reps:  "20" }, at: 1792927961539 },
    { id: 'e17929286529170at7', leaf: 'hm-single', date: '2026-10-25', v: { mins:  "2.5" }, at: 1792928652917 },
    { id: 'e1792929145155b2e3', leaf: 'mb-foam', date: '2026-10-25', v: { mins:  "7" }, at: 1792929145155 }
  ];

  var entries = [];
  var state = { view: 'home', disc: null, block: null, leaf: null, toast: null, cal: false };
  var intents = {};
  var timer = null;

  var LEAF = {}, DISC = {}, BLOCK = {};
  Object.keys(DATA).forEach(function (d) {
    DATA[d].blocks.forEach(function (b) {
      BLOCK[b.id] = b;
      b.children.forEach(function (c) { LEAF[c.id] = c; DISC[c.id] = d; c.blockId = b.id; });
    });
  });
  function leafById(id) { return LEAF[id] || null; }
  function blockById(id) { return BLOCK[id] || null; }

  function today() { return new Date(); }
  function intentKey(d) { return dstr(today()) + '|' + d; }
  function getIntent(d) { return intents[intentKey(d)] || ''; }
  async function setIntent(d, text) {
    if (text) intents[intentKey(d)] = text; else delete intents[intentKey(d)];
    await safeSet(INTENT, JSON.stringify(intents));
  }
  function dstr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysSince(iso) {
    if (!iso) return null;
    var a = new Date(iso + 'T00:00:00');
    var b = new Date(dstr(today()) + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function entriesFor(leafId) {
    var out = [];
    entries.forEach(function (e, i) { if (e.leaf === leafId) out.push({ e: e, i: i }); });
    out.sort(function (x, y) {
      if (x.e.date !== y.e.date) return x.e.date < y.e.date ? 1 : -1;
      return y.i - x.i;
    });
    return out.map(function (o) { return o.e; });
  }
  function lastDate(leafId) { var e = entriesFor(leafId); return e.length ? e[0].date : null; }
  function liveKids(block) {
    return block.children.filter(function (c) { return !c.retired; });
  }
  function blockLastDate(block) {
    var best = null;
    liveKids(block).forEach(function (c) {
      var d = lastDate(c.id);
      if (d && (!best || d > best)) best = d;
    });
    return best;
  }
  function urgency(days, target) {
    if (!target) return -1;              // unscheduled: never competes for attention
    if (days === null) return 1e6;
    return days / (7 / target);
  }

  function skillOptions() {
    var base = ['Heel', 'Toe', 'Inside Flag', 'Flag'];
    entries.forEach(function (e) {
      if (e.v && e.v.skill && base.indexOf(e.v.skill) === -1) base.push(e.v.skill);
    });
    return base;
  }

  function nums(s) {
    return String(s || '').split(',').map(function (x) { return parseFloat(x.trim()); })
      .filter(function (n) { return !isNaN(n); });
  }
  function secs(t) {
    var p = String(t).trim().split('.');
    var m = parseInt(p[0], 10) || 0;
    var s = p.length > 1 ? parseInt(String(p[1]).padEnd(2, '0').slice(0, 2), 10) || 0 : 0;
    return m * 60 + s;
  }
  function fmtMin(total) {
    var m = Math.floor(total / 60), s = Math.round(total % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function totalOf(leaf, v) {
    if (leaf.metric === 'reps' || leaf.metric === 'skill') {
      var n = nums(v.reps);
      if (!n.length) return null;
      return n.reduce(function (a, b) { return a + b; }, 0) + ' ' + (leaf.unit || 'total');
    }
    if (leaf.metric === 'times') {
      var parts = String(v.times || '').split(',').filter(function (x) { return x.trim(); });
      if (!parts.length) return null;
      return fmtMin(parts.reduce(function (a, x) { return a + secs(x); }, 0)) + ' on wall';
    }
    if (leaf.metric === 'weight') {
      var vl = volumeLoad(v);
      return vl ? vl + ' kg lifted' : null;
    }
    if (leaf.metric === 'hold') {
      var h = nums(minsOf(v));
      if (!h.length) return null;
      return h.reduce(function (a, b) { return a + b; }, 0) + ' min held';
    }
    if (leaf.metric === 'volume') { return (nums(v.count)[0] || 0) + ' total'; }
    if (leaf.metric === 'sends') { return sentOf(v) + ' of ' + triedOf(v) + ' sent'; }
    if (leaf.metric === 'attempts') { return (nums(v.count)[0] || 0) + ' tries'; }
    return null;
  }

  // a hold entered before Lying leg raise moved to minutes was stored as reps
  function minsOf(v) {
    return (v.mins !== undefined && v.mins !== '') ? v.mins : (v.reps || '');
  }
  // weight and reps pair up set by set; one weight applies to every set
  function sets(v) {
    var w = nums(v.weight), r = nums(v.reps);
    var n = Math.max(w.length, r.length, 1);
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ w: w.length ? (w[i] !== undefined ? w[i] : w[w.length - 1]) : null,
                 r: r.length ? (r[i] !== undefined ? r[i] : null) : null });
    }
    return out;
  }
  function topWeight(v) { var w = nums(v.weight); return w.length ? Math.max.apply(null, w) : 0; }
  function volumeLoad(v) {
    return sets(v).reduce(function (a, s) { return a + ((s.w || 0) * (s.r || 0)); }, 0);
  }

  function sentOf(v) { return nums(v.sent)[0] || 0; }
  function triedOf(v) {
    var t = nums(v.tried)[0];
    if (t === undefined) t = nums(v.count)[0];   // entries logged before sends existed
    return t || 0;
  }

  function raw(leaf, v) {
    if (leaf.metric === 'times') return String(v.times).split(',').map(function (x) { return x.trim(); }).join(' / ');
    if (leaf.metric === 'volume') return v.count + ' \u00d7 ' + (v.grade || '\u2014');
    if (leaf.metric === 'attempts') return v.count + ' tries';
    if (leaf.metric === 'sends') return sentOf(v) + ' clean / ' + triedOf(v) + ' tried' +
      (v.grade ? ' \u00b7 ' + v.grade : '') + (v.note ? ' \u00b7 ' + v.note : '');
    if (leaf.metric === 'note') return (v.text || '').replace(/\s+/g, ' ').slice(0, 80) +
      ((v.text || '').length > 80 ? '\u2026' : '');
    if (leaf.metric === 'reps') return v.reps;
    if (leaf.metric === 'skill') return (v.skill || '?') + ' — ' + v.reps;
    if (leaf.metric === 'hold') return String(minsOf(v)).split(',').map(function (x) { return x.trim() + 'm'; }).join(' / ');
    if (leaf.metric === 'weight') {
      if (nums(v.weight).length > 1) {
        return sets(v).map(function (s) {
          return s.w + 'kg' + (s.r ? ' \u00d7 ' + s.r : '');
        }).join(', ');
      }
      return (v.weight ? v.weight + 'kg' : '') + (v.reps ? (v.weight ? ' \u00d7 ' : '') + v.reps : '');
    }
    if (leaf.metric === 'run') {
      var d = parseFloat(v.distance) || 0, t = secs(v.time);
      if (!d || !t) return v.distance + 'km';
      return fmtMin(Math.round(t / d)) + ' /km';
    }
    return '\u2014';
  }

  function brief(leaf, e) {
    if (!e) return null;
    var v = e.v, mt = leaf.metric;
    var sum = function (x) { return nums(x).reduce(function (a, b) { return a + b; }, 0); };
    if (mt === 'times') return fmtMin(String(v.times || '').split(',')
      .reduce(function (a, x) { return x.trim() ? a + secs(x) : a; }, 0));
    if (mt === 'reps') return sum(v.reps) + (leaf.unit ? ' ' + leaf.unit : '');
    if (mt === 'skill') return (v.skill || '?') + ' \u00b7 ' + sum(v.reps);
    if (mt === 'hold') return sum(minsOf(v)) + ' min';
    if (mt === 'volume') return v.count + ' \u00d7 ' + (v.grade || '\u2014');
    if (mt === 'attempts') return v.count + ' tries';
    if (mt === 'sends') return sentOf(v) + '/' + triedOf(v);
    if (mt === 'note') return 'logged';
    if (mt === 'weight') {
      var t = topWeight(v), n = nums(v.reps).reduce(function (a, b) { return a + b; }, 0);
      return (t ? t + 'kg' : '') + (n ? ' \u00d7 ' + n : '');
    }
    if (mt === 'run') {
      var dd = parseFloat(v.distance) || 0, tt = secs(v.time);
      return dd && tt ? fmtMin(Math.round(tt / dd)) + ' /km' : (v.distance || '') + 'km';
    }
    return '\u2014';
  }

  function spark(leaf, w, h) {
    var es = entriesFor(leaf.id).slice(0, 12).reverse();
    if (es.length < 2) return '';
    var vals = es.map(function (e) { return score(leaf, e); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = (hi - lo) || 1;
    var pts = vals.map(function (v, i) {
      var x = (i / (vals.length - 1)) * (w - 5) + 2.5;
      var y = (h - 3) - ((v - lo) / span) * (h - 6);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.75"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" fill="currentColor"/></svg>';
  }

  function gradeTally(leaf) {
    var tally = {}, order = [];
    entriesFor(leaf.id).forEach(function (e) {
      var g = (e.v.grade || '').trim();
      if (!g) return;
      var n = leaf.metric === 'sends' ? sentOf(e.v) : (nums(e.v.count)[0] || 0);
      if (!tally[g]) { tally[g] = 0; order.push(g); }
      tally[g] += n;
    });
    order.sort();
    return order.map(function (g) { return { grade: g, n: tally[g] }; });
  }

  function progress(leaf) {
    var es = entriesFor(leaf.id);
    if (!es.length) return '';
    var h = '<div class="prog">';
    var sv = spark(leaf, 220, 34);
    if (sv) {
      var first = es[es.length - 1], last = es[0];
      var up = score(leaf, last) - score(leaf, first);
      h += '<div class="prog-top"><div class="prog-spark">' + sv + '</div>' +
        '<div class="prog-n">' + es.length + ' session' + (es.length === 1 ? '' : 's') +
        '<small>since ' + shortDate(first.date) + '</small></div></div>';
      if (leaf.metric !== 'note' && es.length > 1) {
        h += '<div class="prog-line">' + (up > 0 ? '\u2191 up' : up < 0 ? '\u2193 down' : 'level') +
          ' on your first \u00b7 best ' + esc(brief(leaf, bestEntry(leaf.id))) + '</div>';
      }
    }
    var gt = gradeTally(leaf);
    if (gt.length) {
      h += '<div class="prog-line">' + gt.map(function (x) {
        return '<b>' + esc(x.grade) + '</b> \u00d7' + x.n;
      }).join(' &nbsp; ') + '</div>';
    }
    if (leaf.metric === 'sends') {
      var sent = 0, tried = 0;
      es.forEach(function (e) { sent += sentOf(e.v); tried += triedOf(e.v); });
      h += '<div class="prog-line">' + sent + ' clean from ' + tried + ' tries' +
        (tried ? ' \u00b7 ' + Math.round(sent / tried * 100) + '%' : '') + '</div>';
    }
    return h + '</div>';
  }

  function shortDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  }

  function recap(d) {
    var h = '<div class="recap">';
    DATA[d].blocks.forEach(function (b) {
      var days = daysSince(blockLastDate(b));
      h += '<div class="recap-b"><span>' + esc(b.name) + '</span><span class="recap-d">' +
        (days === null ? 'never' : days === 0 ? 'today' : days === 1 ? '1 day' : days + ' days') +
        '</span></div>';
      var kids = liveKids(b).filter(function (c) { return entriesFor(c.id).length; });
      if (!kids.length) { h += '<div class="recap-r recap-none">nothing logged yet</div>'; return; }
      kids.forEach(function (c) {
        var last = entriesFor(c.id)[0], bst = bestEntry(c.id);
        var isPB = bst && last && bst.id === last.id;
        h += '<div class="recap-r"><span class="recap-n">' + esc(c.name) + '</span>' +
          '<span class="recap-v">' + esc(brief(c, last)) +
          (isPB ? '<em>best</em>' : '<small>best ' + esc(brief(c, bst)) + '</small>') +
          '</span></div>';
      });
    });
    return h + '</div>';
  }

  function describe(leaf, e) {
    if (!e) return null;
    var r = raw(leaf, e.v), t = totalOf(leaf, e.v);
    if (leaf.metric === 'run') {
      var d = parseFloat(e.v.distance) || 0, s = secs(e.v.time);
      return r + (d && s ? ' \u00b7 ' + fmtMin(s) + ' \u00b7 ' + d + 'km' : '');
    }
    if (!t) return r;
    if (leaf.metric === 'volume' || leaf.metric === 'attempts' ||
        leaf.metric === 'sends' || leaf.metric === 'note') return r;
    var multi = (leaf.metric === 'weight' ? sets(e.v).length :
      leaf.metric === 'reps' || leaf.metric === 'skill' ? nums(e.v.reps).length : leaf.metric === 'hold' ? nums(minsOf(e.v)).length :
      String(e.v.times || '').split(',').filter(function (x) { return x.trim(); }).length) > 1;
    return multi ? r + ' \u00b7 ' + t : r;
  }

  function score(leaf, e) {
    var v = e.v;
    if (leaf.metric === 'times') return String(v.times || '').split(',').reduce(function (a, x) { return x.trim() ? a + secs(x) : a; }, 0);
    if (leaf.metric === 'volume' || leaf.metric === 'attempts') return nums(v.count)[0] || 0;
    if (leaf.metric === 'sends') return sentOf(v) * 1000 + triedOf(v);
    if (leaf.metric === 'note') return 0;
    if (leaf.metric === 'reps' || leaf.metric === 'skill') return nums(v.reps).reduce(function (a, b) { return a + b; }, 0);
    if (leaf.metric === 'hold') return nums(minsOf(v)).reduce(function (a, b) { return a + b; }, 0);
    if (leaf.metric === 'weight') {
      // heaviest wins; at equal weight, more total reps wins
      return topWeight(v) * 10000 + nums(v.reps).reduce(function (a, b) { return a + b; }, 0);
    }
    if (leaf.metric === 'run') {
      var d = parseFloat(v.distance) || 0, t = secs(v.time);
      if (!d || !t) return -1e9;
      return -(t / d);
    }
    return 0;
  }
  function bestEntry(leafId) {
    var leaf = leafById(leafId), es = entriesFor(leafId);
    if (!es.length) return null;
    return es.reduce(function (a, b) { return score(leaf, b) > score(leaf, a) ? b : a; });
  }

  async function safeSet(k, v) {
    try { await window.storage.set(k, v); return true; } catch (err) { return false; }
  }
  async function tryGet(k) {
    try { var r = await window.storage.get(k); return r && r.value ? r.value : null; }
    catch (err) { return undefined; }
  }

  async function load() {
    diag.ephemeral = !!(window.storage && window.storage.blocked);
    var keys = null;
    if (window.storage && typeof window.storage.list === 'function') {
      try { var lr = await window.storage.list('training-'); keys = lr && lr.keys ? lr.keys : []; }
      catch (err) { keys = null; }
    }
    diag.keys = keys || [];

    var present = keys === null ? null : keys.indexOf(STORE) !== -1;
    var rawVal = present === false ? null : await tryGet(STORE);
    var parsed = null, unreadable = false;

    if (rawVal === undefined) unreadable = true;
    else if (rawVal !== null) {
      try { parsed = JSON.parse(rawVal); } catch (err) { unreadable = true; }
    }

    if (parsed && parsed.length) {
      entries = parsed;
      diag.state = 'ok';
      diag.msg = entries.length + ' entries loaded.';
    } else if (unreadable || present === null) {
      entries = [];
      diag.state = 'error';
      diag.msg = 'Could not tell whether you have saved data here. NOTHING has been written \u2014 ' +
        'if you have history, reopening may fix it. If this really is a first run, start it off below.';
      diag.offerSeed = true;
      var b = await tryGet(BACKUP);
      if (b) {
        try {
          var bv = JSON.parse(b);
          if (bv && bv.length) {
            entries = bv;
            diag.state = 'recovered';
            diag.msg = 'The main store would not read. Recovered ' + bv.length +
              ' entries from the backup snapshot. Check them, then export a copy.';
          }
        } catch (err2) {}
      }
    } else {
      var seededBefore = await tryGet(SEEDED);
      if (seededBefore) {
        entries = [];
        diag.state = 'ok';
        diag.msg = 'The store is empty, and it has been seeded once already, so it will not be seeded again. ' +
          'If you had entries here, import a backup rather than starting over.';
      } else {
        entries = SEED.map(function (x, i) { return { id: x.id || ('seed' + i), leaf: x.leaf, date: x.date, v: x.v, at: x.at || i }; });
        await safeSet(STORE, JSON.stringify(entries));
        await safeSet(SEEDED, 'yes');
        diag.state = 'ok';
        diag.msg = 'First run. Started from the history in your climbing doc.';
      }
    }

    if ((diag.state === 'ok' || diag.state === 'recovered') && entries.length) {
      safeSet(BACKUP, JSON.stringify(entries));
    }

    var iv = await tryGet(INTENT);
    if (iv) { try { intents = JSON.parse(iv) || {}; } catch (err) { intents = {}; } }
    render();
  }

  function mergeIn(incoming) {
    if (!incoming || !incoming.length) return 0;
    var have = {};
    entries.forEach(function (e) { have[e.id] = true; });
    var added = 0;
    incoming.forEach(function (e) {
      if (e && e.id && e.leaf && e.date && e.v && !have[e.id] && leafById(e.leaf)) {
        entries.push(e); have[e.id] = true; added++;
      }
    });
    return added;
  }
  async function addEntry(leafId, v, date) {
    entries.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 6), leaf: leafId,
      date: date || dstr(today()), v: v, at: Date.now() });
    var wrote = await safeSet(STORE, JSON.stringify(entries));
    diag.lastWrite = wrote ? 'ok' : 'failed';
    return wrote;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function daysCell(days) {
    if (days === null) return '<div class="never">not yet<br>logged</div>';
    return '<div class="days">' + days + '<small>' + (days === 1 ? 'day' : 'days') + '</small></div>';
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function icsHref(hour, min) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0);
    if (d <= now) d = new Date(d.getTime() + 86400000);
    var end = new Date(d.getTime() + 60 * 60000);
    var f = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//training//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@training',
      'DTSTAMP:' + stamp,
      'DTSTART:' + f(d),
      'DTEND:' + f(end),
      'SUMMARY:Counter-session: stretch and gym',
      'DESCRIPTION:After climbing. Antagonist work and the stretch flow.',
      'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Counter-session', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    return { href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), when: d };
  }

  function calPanel() {
    var a = icsHref(13, 30), b = icsHref(14, 0);
    var dayWord = a.when.getDate() === today().getDate() ? 'today' : 'tomorrow';
    return '<div class="cal"><div class="cal-t">Book the counter-session</div>' +
      '<div class="cal-s">An hour of stretch and antagonist work, ' + dayWord + ', with a 10 minute alert. ' +
      'Opens your calendar with it filled in \u2014 you still tap add.</div>' +
      '<div class="cal-btns">' +
      '<a class="btn ghost" href="' + a.href + '" download="counter-session.ics">1:30pm</a>' +
      '<a class="btn ghost" href="' + b.href + '" download="counter-session.ics">2:00pm</a>' +
      '</div></div>';
  }

  function discLastDate(d) {
    var best = null;
    DATA[d].blocks.forEach(function (b) {
      var x = blockLastDate(b);
      if (x && (!best || x > best)) best = x;
    });
    return best;
  }
  function discNextUp(d) {
    var worst = null, worstU = -1;
    DATA[d].blocks.forEach(function (b) {
      var u = urgency(daysSince(blockLastDate(b)), b.target);
      if (u > worstU) { worstU = u; worst = b; }
    });
    return worst;
  }

  function viewHome() {
    var h = '<div class="datestamp">' + today().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>';
    h += '<div class="h1" style="padding-bottom:20px">Next to do</div>';
    Object.keys(DATA).forEach(function (d) {
      var next = discNextUp(d);
      var days = daysSince(discLastDate(d));
      var urgent = !DATA[d].untracked &&
        (days === null || urgency(daysSince(blockLastDate(next)), next.target) >= 1);
      h += '<button class="row' + (urgent ? ' urgent' : '') + '" data-go="blocks" data-disc="' + d + '">' +
        '<div class="row-main"><div class="row-title">' + DATA[d].name + '</div>' +
        '<div class="row-sub">' + esc(DATA[d].untracked ? 'whenever you get out' : next.name.toLowerCase()) +
        '</div></div>' + daysCell(days) + '</button>';
    });
    h += viewDays();
    h += '<button class="row" data-go="data" style="min-height:52px">' +
      '<div class="row-main"><div class="row-title" style="font-size:15px">Data and backup</div>' +
      '<div class="row-sub">' + entries.length + ' entries \u00b7 export a copy</div></div></button>';
    if (diag.ephemeral) {
      h = '<div class="warnbox bad" style="margin-top:16px"><b>Nothing is being saved.</b> ' +
        'This browser is refusing storage \u2014 private mode, or out of space. Anything you log ' +
        'will vanish when you close the app. Export from Data and backup before you do.</div>' + h;
    }
    if (diag.state === 'error') {
      h = '<div class="warnbox bad" style="margin-top:16px">' + esc(diag.msg) +
        (diag.offerSeed ? '<button class="btn ghost" id="seednow" style="margin-top:12px">Start fresh from my doc history</button>' : '') +
        '</div>' + h;
    }
    return h;
  }

  function viewDays() {
    var byDate = {};
    entries.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
    var dates = Object.keys(byDate).sort().reverse().slice(0, 12);
    var h = '<div class="section">Day by day</div>';
    if (!dates.length) return h + '<div class="empty">Nothing logged yet. Once you start, each day\u2019s work shows here with your best ever beside it.</div>';
    dates.forEach(function (dt) {
      var d = new Date(dt + 'T00:00:00');
      var ds = daysSince(dt);
      var label = ds === 0 ? 'Today' : ds === 1 ? 'Yesterday' :
        d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      var list = byDate[dt].slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      var seq = [], seen = null;
      list.forEach(function (e) {
        var lf = leafById(e.leaf);
        if (!lf) return;
        var bn = blockById(lf.blockId).name;
        if (bn !== seen) { seq.push(bn); seen = bn; }
      });
      h += '<div class="day"><div class="day-h">' + label + (ds > 1 ? ' \u00b7 ' + ds + ' days ago' : '') + '</div>';
      Object.keys(DATA).forEach(function (dk) {
        var it = intents[dt + '|' + dk];
        if (it) h += '<div class="day-intent">' + esc(it) + '</div>';
      });
      if (seq.length > 1) h += '<div class="seq">' + seq.map(esc).join(' \u2192 ') + '</div>';
      list.forEach(function (e) {
        var leaf = leafById(e.leaf);
        if (!leaf) return;
        var best = bestEntry(e.leaf);
        var isBest = best && best.id === e.id;
        var dot = '<div class="dot" style="background:' + DATA[DISC[e.leaf]].colour + '"></div>';
        if (leaf.metric === 'note') {
          h += '<div class="log log-stack">' + dot +
            '<div class="log-body"><div class="log-n">' + esc(leaf.name) + '</div>' +
            '<div class="log-text">' + esc(e.v.text || '') + '</div></div></div>';
          return;
        }
        h += '<div class="log">' + dot +
          '<div class="log-n">' + esc(leaf.name) + '</div>' +
          '<div class="log-v">' + esc(describe(leaf, e)) + '<small>' +
          (isBest ? 'best ever' : 'best ' + esc(describe(leaf, best))) + '</small></div></div>';
      });
      h += '</div>';
    });
    return h;
  }

  function viewData() {
    var days = {};
    entries.forEach(function (e) { days[e.date] = 1; });
    var h = '<div class="h1">Data and backup</div>';
    var cls = diag.state === 'error' ? 'warnbox bad' : diag.state === 'recovered' ? 'warnbox' : 'warnbox good';
    h += '<div class="' + cls + '">' + esc(diag.msg) + '</div>';
    h += '<div class="lb"><div class="lb-cell"><div class="lb-k">Entries held</div><div class="lb-v">' + entries.length + '</div></div>' +
      '<div class="lb-cell"><div class="lb-k">Days logged</div><div class="lb-v">' + Object.keys(days).length + '</div></div></div>';
    h += '<div class="section">Storage keys that exist</div><div class="hist">' +
      (diag.keys.length ? diag.keys.map(esc).join('<br>') : 'none found \u2014 this is the telling bit') + '</div>';
    h += '<div class="section">Export \u2014 keep a copy somewhere that is not this app</div>';
    h += '<textarea id="exp" readonly>' + esc(JSON.stringify(entries)) + '</textarea>';
    h += '<button class="btn ghost" id="copy">Copy it</button>';
    h += '<div class="section">Import</div>';
    h += '<textarea id="imp" placeholder="Paste an export here"></textarea>';
    h += '<button class="btn ghost" id="doimport">Merge it in</button>';
    h += '<div class="hint">Importing only adds what is missing, matched on entry id. It never deletes or replaces anything already here, so importing an old copy is always safe.</div>';
    return h;
  }

  function viewIntent() {
    var d = state.disc;
    var h = '<div class="intent-wrap">';
    h += '<div class="intent-kicker">Before you start</div>';
    h += '<div class="intent-h">What is today\u2019s ' + esc(DATA[d].name.toLowerCase()) + ' session for?</div>';
    h += '<div class="intent-sub">Here is where you are. Write today\u2019s intention against it \u2014 you will see it on every screen while you train.</div>';
    h += recap(d);
    h += '<div class="section" style="padding-top:16px">Today\u2019s intention</div>';
    h += '<textarea id="f-intent" rows="5" placeholder="Today I am climbing.&#10;Training, then endurance.&#10;I will commit to 5 boulders.">' +
      esc(getIntent(d)) + '</textarea>';
    var ps = PROMPTS[d] || [];
    if (ps.length) {
      h += '<div class="section" style="padding-top:6px">Or tap one to add it</div><div class="chips">' +
        ps.map(function (t) { return '<button class="chip" data-chip="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') +
        '</div>';
    }
    h += '<button class="btn" id="intent-go" style="margin-top:20px">Start the session</button>';
    h += '<button class="btn ghost" id="intent-skip" style="margin-top:10px">Skip for now</button>';
    h += '</div>';
    return h;
  }

  function intentBanner() {
    if (state.disc !== 'climbing') return '';
    var t = getIntent(state.disc);
    if (!t) return '<button class="banner banner-empty" data-go="intent-edit">' +
      '<div class="banner-k">Today\u2019s intention</div>' +
      '<div class="banner-t">Tap to set one before you start</div></button>';
    return '<button class="banner" data-go="intent-edit"><div class="banner-k">Today\u2019s intention</div>' +
      '<div class="banner-t">' + esc(t) + '</div></button>';
  }

  function viewBlocks() {
    var d = state.disc;
    var h = '<div class="h1">' + DATA[d].name + '</div>';
    h += '<div class="section">Blocks</div>';
    var next = discNextUp(d);
    DATA[d].blocks.forEach(function (b) {
      var days = daysSince(blockLastDate(b));
      var urgent = !DATA[d].untracked && b.id === next.id &&
        (days === null || urgency(days, b.target) >= 1);
      var sub = !b.target ? 'no schedule' :
        b.target > 1 ? 'target ' + b.target + '\u00d7 a week' : 'target weekly';
      if (b.metricLabel) sub = b.metricLabel + ' \u00b7 ' + sub;
      h += '<button class="row' + (urgent ? ' urgent' : '') + '" data-go="list" data-block="' + b.id + '">' +
        '<div class="row-main"><div class="row-title">' + esc(b.name) + '</div>' +
        '<div class="row-sub">' + esc(sub) + '</div></div>' + daysCell(days) + '</button>';
    });
    return h;
  }

  function viewList() {
    var b = blockById(state.block);
    var h = '<div class="h1">' + esc(b.name) + '</div>';
    h += '<div class="section">' + (b.kind === 'pick' ? 'Pick one \u2014 or several, logged separately' : 'Work through these') + '</div>';
    var stalest = null;
    if (b.kind === 'pick') {
      liveKids(b).forEach(function (c) {
        var u = urgency(daysSince(lastDate(c.id)), b.target);
        if (!stalest || u > stalest.u) stalest = { id: c.id, u: u };
      });
    }
    liveKids(b).forEach(function (c) {
      var days = daysSince(lastDate(c.id));
      var urgent = !!(stalest && stalest.id === c.id);
      var last = describe(c, entriesFor(c.id)[0]);
      var best = describe(c, bestEntry(c.id));
      var sub = last ? 'last ' + last + (best && best !== last ? ' \u00b7 best ' + best : '') : (c.note || 'no history yet');
      h += '<button class="row' + (urgent ? ' urgent' : '') + '" data-go="entry" data-leaf="' + c.id + '">' +
        '<div class="row-main"><div class="row-title">' + esc(c.name) + '</div>' +
        '<div class="row-sub">' + esc(sub) + '</div></div>' + daysCell(days) + '</button>';
    });
    var gone = b.children.filter(function (c) { return c.retired; });
    if (gone.length) {
      h += '<div class="section">Retired \u2014 history kept, not in the rotation</div>';
      gone.forEach(function (c) {
        var last = describe(c, entriesFor(c.id)[0]);
        h += '<button class="row" data-go="entry" data-leaf="' + c.id + '" style="opacity:0.55">' +
          '<div class="row-main"><div class="row-title">' + esc(c.name) + '</div>' +
          '<div class="row-sub">' + esc(last ? 'last ' + last : 'never logged') + '</div></div></button>';
      });
    }
    return h;
  }

  function fieldsFor(leaf) {
    var m = leaf.metric;
    if (m === 'times') return '<div class="field"><label>Time on wall, one per lap</label><input id="f-times" inputmode="decimal" placeholder="8.20, 5.20, 3.30"><div class="total" id="live"></div><div class="hint">Minutes and seconds, as you write them in the doc.</div></div>';
    if (m === 'volume') return '<div class="field"><label>How many</label><input id="f-count" inputmode="numeric" placeholder="7"></div>' +
      '<div class="field"><label>Grade</label><input id="f-grade" placeholder="6b+"></div>';
    if (m === 'attempts') return '<div class="field"><label>Good attempts</label><input id="f-count" inputmode="numeric" placeholder="10"></div>';
    if (m === 'sends') return '<div class="pair">' +
      '<div class="field"><label>Sent clean</label><input id="f-sent" inputmode="numeric" placeholder="0"></div>' +
      '<div class="field"><label>Tried</label><input id="f-tried" inputmode="numeric" placeholder="4"></div></div>' +
      '<div class="field"><label>Grade, optional</label><input id="f-grade" placeholder="7a"></div>' +
      '<div class="hint">Clean means no takes and no falls. Topping it with a rest is a try, not a send.</div>' +
      '<div class="field" style="padding-top:14px"><label>Note, optional</label>' +
      '<input id="f-note" placeholder="fell at the third clip"></div>';
    if (m === 'note') return '<div class="field"><label>What happened</label>' +
      '<textarea id="f-text" rows="5" placeholder="Tallat. Worked the first three clips. Fear on the top section."></textarea></div>';
    if (m === 'reps') return '<div class="field"><label>' + (leaf.unit === 'seconds' ? 'Seconds held, per set' : 'Reps or hangs, per set') + '</label>' +
      '<input id="f-reps" inputmode="decimal" placeholder="8   or   16, 16, 16"><div class="total" id="live"></div>' +
      '<div class="hint">Comma-separate sets and they add up for you.</div></div>';
    if (m === 'skill') {
      var opts = skillOptions();
      return '<div class="field"><label>Which skill</label><select id="f-skill">' +
        opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') +
        '<option value="__new">Add a new one\u2026</option></select></div>' +
        '<div class="field" id="newskill" style="display:none"><label>Name it</label>' +
        '<input id="f-newskill" placeholder="drop knee"></div>' +
        '<div class="field"><label>Good goes, per set</label>' +
        '<input id="f-reps" inputmode="decimal" placeholder="6   or   6, 4"><div class="total" id="live"></div></div>';
    }
    if (m === 'hold') return '<div class="field"><label>Minutes held</label><input id="f-mins" inputmode="decimal" placeholder="5   or   5, 3"><div class="total" id="live"></div></div>';
    if (m === 'weight') return '<div class="pair">' +
      '<div class="field"><label>Weight, kg</label><input id="f-weight" inputmode="decimal" placeholder="18   or   18, 20, 22"></div>' +
      '<div class="field"><label>Reps</label><input id="f-reps" inputmode="decimal" placeholder="10, 10, 10"></div></div>' +
      '<div class="total" id="live"></div>' +
      '<div class="hint">One weight covers every set. Comma-separate the weights too if they changed.</div>';
    if (m === 'run') return '<div class="field"><label>Distance, km</label><input id="f-distance" inputmode="decimal" placeholder="5.2"></div>' +
      '<div class="field"><label>Time</label><input id="f-time" inputmode="decimal" placeholder="27.40"><div class="total" id="live"></div>' +
      '<div class="hint">Minutes and seconds. Pace works itself out.</div></div>' +
      '<div class="field"><label>Notes, optional</label><input id="f-desc" placeholder="felt heavy, headwind"></div>';
    return '<div class="hint" style="padding-bottom:14px">Nothing to measure \u2014 just mark it done.</div>';
  }

  function readFields(leaf) {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var m = leaf.metric, v = {};
    if (m === 'times') { v.times = g('f-times'); if (!v.times) return null; }
    else if (m === 'volume') { v.count = g('f-count'); v.grade = g('f-grade'); if (!v.count) return null; }
    else if (m === 'attempts') { v.count = g('f-count'); if (!v.count) return null; }
    else if (m === 'sends') {
      v.sent = g('f-sent') || '0'; v.tried = g('f-tried');
      v.grade = g('f-grade'); v.note = g('f-note');
      if (!v.tried) return null;
    }
    else if (m === 'note') { v.text = g('f-text'); if (!v.text) return null; }
    else if (m === 'reps') { v.reps = g('f-reps'); if (!v.reps) return null; }
    else if (m === 'hold') { v.mins = g('f-mins'); if (!v.mins) return null; }
    else if (m === 'skill') {
      var sel = g('f-skill');
      v.skill = sel === '__new' ? g('f-newskill') : sel;
      v.reps = g('f-reps');
      if (!v.skill || !v.reps) return null;
    }
    else if (m === 'weight') { v.weight = g('f-weight'); v.reps = g('f-reps'); if (!v.weight && !v.reps) return null; }
    else if (m === 'run') { v.distance = g('f-distance'); v.time = g('f-time'); v.desc = g('f-desc'); if (!v.distance || !v.time) return null; }
    return v;
  }

  function viewEntry() {
    var leaf = leafById(state.leaf);
    var b = blockById(leaf.blockId);
    var last = entriesFor(leaf.id)[0], best = bestEntry(leaf.id);
    var h = '<div class="h1">' + esc(leaf.name) + '</div>';
    h += '<div class="prescription" style="padding-top:8px">' + esc(leaf.note || b.metricLabel || 'Log it as you finish.') + '</div>';
    h += '<div class="lb"><div class="lb-cell"><div class="lb-k">Last</div><div class="lb-v">' +
      (last ? esc(describe(leaf, last)) + '</div><div class="lb-k" style="margin-top:5px">' + daysSince(last.date) + ' days ago' : '\u2014') + '</div></div>';
    h += '<div class="lb-cell"><div class="lb-k">Best</div><div class="lb-v">' + (best ? esc(describe(leaf, best)) : '\u2014') + '</div></div></div>';
    h += progress(leaf);
    h += fieldsFor(leaf);
    h += '<div class="when"><label for="f-date">When</label>' +
      '<input type="date" id="f-date" value="' + dstr(today()) + '" max="' + dstr(today()) + '"></div>';
    h += '<button class="btn" id="save">Log it</button>';
    h += '<div id="err" class="hint" style="color:#F0883E"></div>';
    h += timerHTML(leaf);
    var hist = entriesFor(leaf.id).slice(1, 5);
    if (hist.length) {
      h += '<div class="section">Before that</div><div class="hist">' + hist.map(function (e) {
        return daysSince(e.date) + ' days ago &nbsp; <span>' + esc(describe(leaf, e)) + '</span>';
      }).join('<br>') + '</div>';
    }
    return h;
  }

  function defaultTimer(leaf) { return leaf.timer || { work: 60, rest: 0, reps: 10, sets: 1, setRest: 0 }; }
  function intervalBody(leaf) {
    var t = defaultTimer(leaf);
    return '<div class="params">' +
      '<div><label>work</label><input id="p-work" inputmode="numeric" value="' + t.work + '"></div>' +
      '<div><label>rest</label><input id="p-rest" inputmode="numeric" value="' + t.rest + '"></div>' +
      '<div><label>reps</label><input id="p-reps" inputmode="numeric" value="' + t.reps + '"></div>' +
      '<div><label>sets</label><input id="p-sets" inputmode="numeric" value="' + t.sets + '"></div>' +
      '<div><label>set rest</label><input id="p-setrest" inputmode="numeric" value="' + t.setRest + '"></div>' +
      '</div>' +
      '<div class="clock" id="clock">' + t.work + '</div>' +
      '<div class="phase" id="phase">Ready \u2014 ' + t.reps + ' reps' + (t.sets > 1 ? ', ' + t.sets + ' sets' : '') + '</div>' +
      '<div class="tctl"><button id="t-go">Start</button><button id="t-add">+30s rest</button>' +
      '<button id="t-reset">Reset</button></div>';
  }
  function timerHTML(leaf) {
    return '<div class="timer">' +
      '<div class="timer-head"><div class="timer-title">Timer</div>' +
      '<div class="switch"><button data-mode="interval" class="on">Intervals</button><button data-mode="stop">Stopwatch</button></div></div>' +
      '<div id="tbody">' + intervalBody(leaf) + '</div>' +
      '<div class="warnbar">The screen stays on while a timer runs. If you hear nothing, turn the media volume up \u2014 the beep plays as media, not as a ringtone.</div>' +
      '</div>';
  }

  var wake = null;
  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
      if (!on && wake) { wake.release(); wake = null; }
    } catch (err) {}
  }
  var actx = null;
  var comp = null;
  function audioOut() {
    // a limiter lets us push close to full scale without the crackle of clipping
    if (!comp) {
      comp = actx.createDynamicsCompressor();
      comp.threshold.value = -8; comp.knee.value = 0;
      comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.08;
      comp.connect(actx.destination);
    }
    return comp;
  }
  function beep(freq, dur) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var out = audioOut(), t0 = actx.currentTime;
      // fundamental plus an octave: the ear reads the stack as louder than either alone
      [[freq, 0.9], [freq * 2, 0.45]].forEach(function (pair) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.connect(g); g.connect(out);
        o.frequency.value = pair[0];
        o.type = 'square';            // richer in harmonics, so it carries over gym noise
        var peak = pair[1];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);   // fast attack, no click
        g.gain.setValueAtTime(peak, t0 + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch (err) {}
  }
  function unlockAudio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      // a silent one-sample play: the tap that starts the timer is what buys us sound
      var b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource();
      s.buffer = b; s.connect(actx.destination); s.start(0);
    } catch (err) {}
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (err) {} }
  function stopTimer() {
    if (timer && timer.h) clearInterval(timer.h);
    timer = null;
    keepAwake(false);
  }
  function startInterval() {
    unlockAudio();
    var gv = function (id, d) { var el = document.getElementById(id); var n = parseInt(el ? el.value : '', 10); return isNaN(n) ? d : n; };
    var cfg = { work: gv('p-work', 30), rest: gv('p-rest', 30), reps: gv('p-reps', 8), sets: gv('p-sets', 1), setRest: gv('p-setrest', 0) };
    var seq = [];
    for (var s = 0; s < cfg.sets; s++) {
      for (var r = 0; r < cfg.reps; r++) {
        seq.push({ p: 'work', d: cfg.work, label: 'Work \u2014 rep ' + (r + 1) + ' of ' + cfg.reps + (cfg.sets > 1 ? ', set ' + (s + 1) : '') });
        if (r < cfg.reps - 1 && cfg.rest > 0) seq.push({ p: 'rest', d: cfg.rest, label: 'Rest' });
      }
      if (s < cfg.sets - 1 && cfg.setRest > 0) seq.push({ p: 'rest', d: cfg.setRest, label: 'Set rest' });
    }
    if (!seq.length) return;
    timer = { mode: 'interval', seq: seq, i: 0, end: Date.now() + seq[0].d * 1000, h: null, counted: null };
    keepAwake(true);
    beep(880, 0.22); buzz(140);
    timer.h = setInterval(tickInterval, 100);
    tickInterval();
    document.getElementById('t-go').textContent = 'Stop';
  }
  function tickInterval() {
    if (!timer || timer.mode !== 'interval') return;
    var left = Math.ceil((timer.end - Date.now()) / 1000);
    // count it down: three short ticks at 3, 2, 1 before the phase turns over
    if (left > 0 && left <= 3 && timer.counted !== left) {
      timer.counted = left;
      beep(1180, 0.07);
      buzz(60);
    }
    var clock = document.getElementById('clock'), phase = document.getElementById('phase');
    if (!clock) { stopTimer(); return; }
    if (left <= 0) {
      timer.i++;
      if (timer.i >= timer.seq.length) {
        beep(660, 0.5); buzz([200, 120, 200]);
        clock.textContent = 'Done';
        clock.className = 'clock';
        phase.textContent = 'Finished \u2014 log it above';
        stopTimer();
        var g = document.getElementById('t-go');
        if (g) g.textContent = 'Start';
        return;
      }
      timer.end = Date.now() + timer.seq[timer.i].d * 1000;
      timer.counted = null;
      beep(timer.seq[timer.i].p === 'work' ? 880 : 520, 0.22);
      buzz(timer.seq[timer.i].p === 'work' ? 140 : [60, 60, 60]);
      left = timer.seq[timer.i].d;
    }
    var cur = timer.seq[timer.i];
    clock.textContent = left;
    clock.className = 'clock ' + cur.p;
    phase.textContent = cur.label;
  }
  function startStopwatch() {
    unlockAudio();
    timer = { mode: 'stop', t0: Date.now(), laps: [], h: null };
    keepAwake(true);
    timer.h = setInterval(tickStop, 100);
    document.getElementById('t-go').textContent = 'Lap';
  }
  function tickStop() {
    if (!timer || timer.mode !== 'stop') return;
    var clock = document.getElementById('clock');
    if (!clock) { stopTimer(); return; }
    clock.textContent = fmtMin(Math.floor((Date.now() - timer.t0) / 1000));
    clock.className = 'clock';
  }
  function renderStopwatchBody() {
    document.getElementById('tbody').innerHTML = '<div class="clock" id="clock">0:00</div>' +
      '<div class="phase" id="phase">Time on wall</div>' +
      '<div class="tctl"><button id="t-go">Start</button><button id="t-reset">Reset</button></div>' +
      '<div class="laps" id="laps"></div>';
  }

  function render() {
    stopTimer();
    var el = document.getElementById('app');
    var body = '', crumb = '';
    if (state.view === 'home') body = viewHome();
    else if (state.view === 'blocks') { crumb = 'Home'; body = viewBlocks(); }
    else if (state.view === 'list') {
      crumb = DATA[state.disc].blocks.length === 1 ? 'Home' : DATA[state.disc].name;
      body = viewList();
    }
    else if (state.view === 'entry') { crumb = blockById(state.block).name; body = viewEntry(); }
    else if (state.view === 'data') { crumb = 'Home'; body = viewData(); }
    else if (state.view === 'intent') { crumb = 'Home'; body = viewIntent(); }
    var top = state.view === 'home' ? '' :
      '<div class="topbar"><button class="back" id="back">\u2190 &nbsp;' + esc(crumb) + '</button></div>';
    el.innerHTML = '<div class="wrap">' + top +
      (state.toast ? '<div class="toast">' + esc(state.toast) + '</div>' : '') +
      (state.cal ? calPanel() : '') +
      (state.disc === 'climbing' && ['blocks', 'list', 'entry'].indexOf(state.view) !== -1 ? intentBanner() : '') +
      body + '</div>';
    state.toast = null;
    wire();
  }

  function liveTotal() {
    var leaf = leafById(state.leaf);
    var live = document.getElementById('live');
    if (!live || !leaf) return;
    var v = {}, m = leaf.metric;
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    if (m === 'reps' || m === 'skill') v.reps = g('f-reps');
    else if (m === 'times') v.times = g('f-times');
    else if (m === 'hold') v.mins = g('f-mins');
    else if (m === 'weight') { v.weight = g('f-weight'); v.reps = g('f-reps'); }
    else if (m === 'run') {
      var d = parseFloat(g('f-distance')) || 0, t = secs(g('f-time'));
      live.textContent = d && t ? fmtMin(Math.round(t / d)) + ' per km' : '';
      return;
    }
    var t2 = totalOf(leaf, v);
    live.textContent = t2 || '';
  }

  function wire() {
    var el = document.getElementById('app');
    el.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.onclick = function () {
        var go = btn.getAttribute('data-go');
        if (go === 'blocks') {
          state.disc = btn.getAttribute('data-disc');
          var bl = DATA[state.disc].blocks;
          if (bl.length === 1) { state.block = bl[0].id; state.view = 'list'; }
          else state.view = 'blocks';
        }
        else if (go === 'intent-edit') { state.view = 'intent'; }
        else if (go === 'list') { state.block = btn.getAttribute('data-block'); state.view = 'list'; }
        else if (go === 'entry') { state.leaf = btn.getAttribute('data-leaf'); state.cal = false; state.view = 'entry'; }
        else if (go === 'data') { state.view = 'data'; }
        render();
      };
    });
    var back = document.getElementById('back');
    if (back) back.onclick = function () {
      if (state.view === 'data' || state.view === 'intent') state.view = 'home';
      else if (state.view === 'entry') state.view = 'list';
      else if (state.view === 'list') state.view = DATA[state.disc].blocks.length === 1 ? 'home' : 'blocks';
      else state.view = 'home';
      state.cal = false;
      render();
    };
    ['f-reps', 'f-times', 'f-mins', 'f-distance', 'f-time'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.oninput = liveTotal;
    });
    var ta = document.getElementById('f-intent');
    el.querySelectorAll('[data-chip]').forEach(function (c) {
      c.onclick = function () {
        var t = c.getAttribute('data-chip');
        ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + '\n' + t : t;
        ta.focus();
      };
    });
    function leaveIntent() {
      var bl = DATA[state.disc].blocks;
      if (bl.length === 1) { state.block = bl[0].id; state.view = 'list'; }
      else state.view = 'blocks';
      render();
    }
    var ig = document.getElementById('intent-go');
    if (ig) ig.onclick = async function () {
      await setIntent(state.disc, ta.value.trim());
      leaveIntent();
    };
    var isk = document.getElementById('intent-skip');
    if (isk) isk.onclick = function () { leaveIntent(); };

    var sk = document.getElementById('f-skill');
    if (sk) sk.onchange = function () {
      var w = document.getElementById('newskill');
      if (w) w.style.display = sk.value === '__new' ? 'block' : 'none';
    };
    var save = document.getElementById('save');
    if (save) save.onclick = async function () {
      var leaf = leafById(state.leaf);
      var v = leaf.metric === 'done' ? { done: 'yes' } : readFields(leaf);
      var err = document.getElementById('err');
      if (!v) { err.textContent = 'Fill in at least one number first.'; return; }
      err.textContent = '';
      var de = document.getElementById('f-date');
      var when = de && de.value ? de.value : dstr(today());
      if (when > dstr(today())) when = dstr(today());
      var wrote = await addEntry(leaf.id, v, when);
      var back = daysSince(when);
      if (!wrote) {
        err.textContent = 'Saved on screen but the write failed. Do not close this \u2014 go to Data and export a copy first.';
      }
      state.toast = 'Logged \u00b7 ' + describe(leaf, entriesFor(leaf.id)[0]) +
        (back > 0 ? ' \u00b7 ' + (back === 1 ? 'yesterday' : back + ' days ago') : '');
      state.cal = DISC[leaf.id] === 'climbing' && back === 0;
      state.view = 'list';
      render();
    };
    var sn = document.getElementById('seednow');
    if (sn) sn.onclick = async function () { await seedNow(); render(); };
    var copy = document.getElementById('copy');
    if (copy) copy.onclick = function () {
      var ta = document.getElementById('exp');
      ta.removeAttribute('readonly'); ta.select(); ta.setSelectionRange(0, 999999);
      var done = false;
      try { done = document.execCommand('copy'); } catch (err) {}
      ta.setAttribute('readonly', 'readonly');
      if (!done && navigator.clipboard) {
        navigator.clipboard.writeText(ta.value).then(function () {
          copy.textContent = 'Copied';
        }, function () { copy.textContent = 'Select the text above and copy by hand'; });
      } else copy.textContent = done ? 'Copied' : 'Select the text above and copy by hand';
    };
    var imp = document.getElementById('doimport');
    if (imp) imp.onclick = async function () {
      var ta = document.getElementById('imp');
      var n = 0, bad = false;
      try { n = mergeIn(JSON.parse(ta.value)); } catch (err) { bad = true; }
      if (bad) { imp.textContent = 'That did not parse \u2014 paste the whole export'; return; }
      if (!n) { imp.textContent = 'Nothing new in there'; return; }
      var wrote = await safeSet(STORE, JSON.stringify(entries));
      state.toast = wrote ? 'Merged in ' + n + ' entries' : 'Merged ' + n + ' here, but the save failed \u2014 do not close this';
      state.view = 'data';
      render();
    };
    el.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        stopTimer();
        el.querySelectorAll('[data-mode]').forEach(function (x) { x.className = ''; });
        b.className = 'on';
        if (b.getAttribute('data-mode') === 'stop') renderStopwatchBody();
        else document.getElementById('tbody').innerHTML = intervalBody(leafById(state.leaf));
        wireTimer();
      };
    });
    wireTimer();
  }

  function wireTimer() {
    var go = document.getElementById('t-go'), rs = document.getElementById('t-reset');
    if (!go) return;
    go.onclick = function () {
      var sm = document.querySelector('[data-mode="stop"]');
      var isStop = sm && sm.className === 'on';
      if (isStop) {
        if (!timer) startStopwatch();
        else {
          timer.laps.push(fmtMin(Math.floor((Date.now() - timer.t0) / 1000)));
          document.getElementById('laps').innerHTML = timer.laps.map(function (l, i) {
            return 'Lap ' + (i + 1) + ' &nbsp; ' + l;
          }).join('<br>');
        }
      } else {
        if (timer) { stopTimer(); go.textContent = 'Start'; }
        else startInterval();
      }
    };
    var add = document.getElementById('t-add');
    if (add) add.onclick = function () {
      if (!timer || timer.mode !== 'interval') return;
      timer.end += 30000;
      var cur = timer.seq[timer.i];
      if (cur) cur.d += 30;
      tickInterval();
    };
    if (rs) rs.onclick = function () { stopTimer(); render(); };
  }

  load();
})();
