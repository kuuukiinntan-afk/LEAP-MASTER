(() => {
  "use strict";
  const words = Array.isArray(window.WORDS) ? window.WORDS : [];
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const shuffle = a => [...a].sort(()=>Math.random()-.5);
  const norm = s => String(s??'').toLowerCase().trim().replace(/[ 　\t\r\n、。・,，.]/g,'');
  const DATA_OK = words.length===2300 && words[0]?.id===1 && words[2299]?.id===2300 && words.every((w,i)=>w.id===i+1 && w.word && w.meaning);
  let state = JSON.parse(localStorage.getItem('leap2300_fixed')||'null') || {view:'home',rp:0,rank:'BRONZE',known:{},weak:{},tests:0,correct:0,streak:0,settings:{}};
  const save=()=>localStorage.setItem('leap2300_fixed',JSON.stringify(state));
  const rankFor=rp=>rp>=5000?'DIAMOND':rp>=3500?'PLATINUM':rp>=2000?'GOLD':rp>=1000?'SILVER':'BRONZE';
  const addRP=n=>{state.rp=Math.max(0,state.rp+n);state.rank=rankFor(state.rp);save();updateHeader()};
  function updateHeader(){if($('#rpPill'))$('#rpPill').textContent=`${state.rp} RP`;if($('#rankPill'))$('#rankPill').textContent=state.rank}

  let cardPool=words.slice(), cardIndex=0, flipped=false;
  function cards(){
    if(!cardPool.length) cardPool=words.slice(); const w=cardPool[cardIndex%cardPool.length];
    return `<section class="panel"><div class="card-head"><h2>🃏 単語カード</h2><span class="small">No. ${w.id} / ${words.length}</span></div>
      <div class="controls"><div class="field"><label>開始</label><input id="cardFrom" type="number" min="1" max="2300" value="1"></div><div class="field"><label>終了</label><input id="cardTo" type="number" min="1" max="2300" value="2300"></div><div class="field"><label>順番</label><select id="cardOrder"><option value="seq">番号順</option><option value="random">ランダム</option><option value="weak">苦手優先</option></select></div></div>
      <div id="flashcard" class="flashcard ${flipped?'flipped':''}" tabindex="0"><div class="flash-inner"><div class="flash-face"><span class="small">ENGLISH</span><div class="word">${esc(w.word)}</div><p>タップして意味を見る</p></div><div class="flash-face flash-back"><span class="small">JAPANESE</span><div class="meaning">${esc(w.meaning)}</div><p>タップして英単語に戻る</p></div></div></div>
      <div class="actions"><button class="primary" id="cardApply">範囲を適用</button><button id="known">✓ 覚えた</button><button id="weak">★ 苦手</button><button id="nextCard" class="primary">次へ</button></div></section>`;
  }
  function home(){return `<section class="hero"><h1>NO LEAP NO LIFE.</h1><p>LEAP 2300 Vocabulary — 2300語を、もっと速く、もっと楽しく。</p><div class="grid"><div class="card"><div class="label">現在のRP</div><div class="value">${state.rp}</div></div><div class="card"><div class="label">正答率</div><div class="value">${state.tests?Math.round(state.correct/state.tests*100):0}%</div></div><div class="card"><div class="label">覚えた単語</div><div class="value">${Object.values(state.known).filter(Boolean).length}</div></div></div></section><div class="grid"><div class="panel"><h2>すぐ学習</h2><div class="actions"><button class="primary" data-go="test">テストを始める</button><button data-go="cards">単語カード</button><button data-go="training">トレーニング</button></div></div><div class="panel"><h2>データ</h2><p>${DATA_OK?'✅ 2300語を読み込み済み':'❌ 単語データの読み込みに失敗'}</p><p class="small">No.1: ${esc(words[0]?.word||'-')}　No.2300: ${esc(words[2299]?.word||'-')}</p></div></div>`}
  function list(){return `<section class="panel"><h2>📚 単語一覧</h2><div class="controls"><div class="field"><label>検索</label><input id="listSearch" placeholder="英単語・日本語"></div><div class="field"><label>開始</label><input id="listFrom" type="number" value="1" min="1" max="2300"></div><div class="field"><label>終了</label><input id="listTo" type="number" value="2300" min="1" max="2300"></div></div><div id="wordList" style="margin-top:14px"></div></section>`}
  function renderList(){const box=$('#wordList');if(!box)return;let q=norm($('#listSearch')?.value||''),a=+( $('#listFrom')?.value||1),b=+( $('#listTo')?.value||2300);let arr=words.filter(w=>w.id>=a&&w.id<=b&&(!q||norm(w.word).includes(q)||norm(w.meaning).includes(q)));box.innerHTML=arr.slice(0,300).map(w=>`<div class="row"><span>No.${w.id} <b>${esc(w.word)}</b></span><span>${esc(w.meaning)}</span></div>`).join('')||'<p class="small">該当する単語がありません。</p>';if(arr.length>300)box.innerHTML+=`<p class="small">表示は先頭300語まで。検索・範囲指定で絞れます。</p>`}
  let testSession=null;
  function testSetup(){return `<section class="panel"><h2>📝 テスト</h2><div class="controls"><div class="field"><label>形式</label><select id="testType"><option value="enjp">英語 → 日本語</option><option value="jpen">日本語 → 英語</option><option value="choice">4択</option></select></div><div class="field"><label>開始</label><input id="testFrom" type="number" value="1" min="1" max="2300"></div><div class="field"><label>終了</label><input id="testTo" type="number" value="2300" min="1" max="2300"></div><div class="field"><label>問題数</label><input id="testCount" type="number" value="10" min="1" max="100"></div><div class="field"><label>制限時間(分)</label><input id="testTime" type="number" value="5" min="0"></div></div><div class="actions"><button class="primary" id="startTest">テスト開始</button></div></section>`}
  function testView(){const s=testSession,w=s.words[s.i];if(!w)return `<section class="panel"><h2>結果</h2><p>正解 ${s.correct} / ${s.words.length}</p><div class="actions"><button data-go="test">もう一度</button></div></section>`;let q=s.type==='enjp'?w.word:w.meaning;let input=s.type==='choice'?`<div class="choices">${s.choices.map(x=>`<button data-choice="${esc(x)}">${esc(x)}</button>`).join('')}</div>`:`<input id="answer" style="width:100%;padding:14px;border-radius:12px;border:1px solid var(--line);background:#0b1425;color:var(--text);font-size:18px" placeholder="答えを入力">`;return `<section class="panel"><div class="small">${s.i+1} / ${s.words.length}${s.left!=null?`　残り ${s.left}s`:''}</div><h2 style="text-align:center;margin:28px 0">${esc(q)}</h2><div id="testArea">${input}</div>${s.type!=='choice'?'<div class="actions"><button class="primary" id="submitAnswer">回答</button></div>':''}<p id="hint" class="small">${s.type==='jpen'?`ヒント：${esc(w.word.slice(0,1))}…`:''}</p></section>`}
  function startTest(){let a=Math.max(1,Math.min(2300,+($('#testFrom').value||1))),b=Math.max(1,Math.min(2300,+($('#testTo').value||2300)));if(a>b)[a,b]=[b,a];let n=Math.min(100,Math.max(1,+($('#testCount').value||10)));let pool=shuffle(words.filter(w=>w.id>=a&&w.id<=b));if(!pool.length){alert('この範囲には単語がありません。');return}n=Math.min(n,pool.length);testSession={type:$('#testType').value,words:pool.slice(0,n),i:0,correct:0,left:Math.max(0,+($('#testTime').value||0)*60),timer:null,choices:[]};nextTestChoices();render('testRun');if(testSession.left)testSession.timer=setInterval(()=>{testSession.left--;if(testSession.left<=0){clearInterval(testSession.timer);testSession.i=testSession.words.length;render('testRun')}else{const el=$('.small');}},1000)}
  function nextTestChoices(){if(!testSession)return;const w=testSession.words[testSession.i];if(testSession.type==='choice'&&w){const distractors=shuffle(words.filter(x=>x.id!==w.id && x.meaning!==w.meaning)).slice(0,3).map(x=>x.meaning);testSession.choices=shuffle([w.meaning,...distractors]);}}
  function answer(ans){const s=testSession,w=s.words[s.i];const expected=s.type==='enjp'?w.meaning:w.word;const ok=norm(ans)===norm(expected) || (s.type==='enjp' && norm(expected).includes(norm(ans)) && norm(ans).length>=2);s.tests=(state.tests||0)+1;state.tests++;if(ok){s.correct++;state.correct++;state.streak++;addRP(10)}else state.streak=0;state.known[w.id]=ok;state.weak[w.id]=!ok;s.i++;if(s.i>=s.words.length){if(s.timer)clearInterval(s.timer);save()}else nextTestChoices();render('testRun')}
  function training(){const w=shuffle(words)[0];return `<section class="panel"><h2>⚡ トレーニング</h2><p class="small">ランダム単語</p><div class="word">${esc(w.word)}</div><div class="meaning">${esc(w.meaning)}</div><div class="actions"><button id="trainingNext" class="primary">次の単語</button></div></section>`}
  function friends(){return `<section class="panel"><h2>👥 フレンド</h2><div class="row"><span>Friend A</span><span>学習中</span></div><div class="row"><span>Friend B</span><span>オンライン</span></div><div class="row"><span>Friend C</span><span>オフライン</span></div></section>`}
  function battle(){return `<section class="panel"><h2>⚔️ 対戦</h2><p>オンライン対戦の画面です。</p><p class="small">現在はローカル版。Firebase接続時にリアルタイム対戦へ拡張できます。</p></section>`}
  function ranking(){return `<section class="panel"><h2>🏆 ランキング</h2><div class="row"><span>あなた</span><b>${state.rp} RP</b></div><div class="row"><span>Friend A</span><b>2480 RP</b></div><div class="row"><span>Friend B</span><b>1860 RP</b></div></section>`}
  function settings(){return `<section class="panel"><h2>⚙️ 設定</h2><p>現在のランク：${state.rank}</p><button id="resetData">学習データをリセット</button></section>`}
  function render(view=state.view){state.view=view;save();const fn={home,cards,list,test:testSetup,testSetup,training,friends,battle,ranking,settings,testRun:testView}[view]||home;const app=$('#app');if(!app)return;app.innerHTML=fn();updateHeader();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));bind();if(view==='list')renderList()}
  function bind(){
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>render(b.dataset.view));
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>render(b.dataset.go));
    document.querySelectorAll('[data-menu-view]').forEach(b=>b.onclick=()=>{render(b.dataset.menuView);closeMenu()});
    $('#flashcard')?.addEventListener('click',()=>{flipped=!flipped;render('cards')});
    $('#nextCard')?.addEventListener('click',()=>{cardIndex++;flipped=false;render('cards')});
    $('#known')?.addEventListener('click',()=>{const w=cardPool[cardIndex%cardPool.length];state.known[w.id]=true;state.weak[w.id]=false;save();cardIndex++;flipped=false;render('cards')});
    $('#weak')?.addEventListener('click',()=>{const w=cardPool[cardIndex%cardPool.length];state.weak[w.id]=true;save();cardIndex++;flipped=false;render('cards')});
    $('#cardApply')?.addEventListener('click',()=>{let a=+$('#cardFrom').value||1,b=+$('#cardTo').value||2300,order=$('#cardOrder').value;cardPool=words.filter(w=>w.id>=a&&w.id<=b);if(order==='random')cardPool=shuffle(cardPool);if(order==='weak')cardPool=cardPool.filter(w=>state.weak[w.id]).concat(cardPool.filter(w=>!state.weak[w.id]));cardIndex=0;flipped=false;render('cards')});
    $('#listSearch')?.addEventListener('input',renderList);$('#listFrom')?.addEventListener('input',renderList);$('#listTo')?.addEventListener('input',renderList);
    $('#startTest')?.addEventListener('click',startTest);
    $('#submitAnswer')?.addEventListener('click',()=>answer($('#answer')?.value||''));
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>answer(b.dataset.choice));
    $('#answer')?.addEventListener('keydown',e=>{if(e.key==='Enter')answer($('#answer').value)});
    $('#trainingNext')?.addEventListener('click',()=>render('training'));
    $('#resetData')?.addEventListener('click',()=>{localStorage.removeItem('leap2300_fixed');location.reload()});
  }
  function openMenu(){const m=$('#sideMenu'),o=$('#menuOverlay');m?.classList.add('open');if(o)o.hidden=false}
  function closeMenu(){const m=$('#sideMenu'),o=$('#menuOverlay');m?.classList.remove('open');if(o)o.hidden=true}
  $('#menuBtn')?.addEventListener('click',openMenu);$('#menuClose')?.addEventListener('click',closeMenu);$('#menuOverlay')?.addEventListener('click',closeMenu);
  if(!DATA_OK) console.error('LEAP data error',words.length);
  render('home');
})();
