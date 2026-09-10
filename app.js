(() => {
"use strict";

const W = Array.isArray(window.WORDS) ? window.WORDS : [];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm = s => String(s ?? "").toLowerCase().trim().replace(/[ 　\t\r\n、。・,，.［］\[\]〜～]/g,"");
const shuffle = a => [...a].sort(() => Math.random()-.5);
const DATA_OK = W.length===2300 && W.every((w,i)=>w.id===i+1 && w.word && w.meaning);

const KEY = "leap_master_final_v1";
let S = JSON.parse(localStorage.getItem(KEY)||"null") || {
  view:"home", rp:0, known:{}, weak:{}, tests:0, correct:0, streak:0, best:0,
  studied:0, history:{}, friends:[], pet:{name:"LEAP",rarity:"Common",level:1,xp:0},
  settings:{compact:false,focus:false}
};
S.known ||= {}; S.weak ||= {}; S.history ||= {}; S.friends ||= [];
S.pet ||= {name:"LEAP",rarity:"Common",level:1,xp:0};
S.settings ||= {compact:false,focus:false};

const menus = [
 ["home","⌂ ホーム"],["cards","🃏 単語カード"],["list","📚 単語一覧"],
 ["test","📝 テスト"],["training","⚡ トレーニング"],["friends","👥 フレンド"],
 ["battle","⚔️ 対戦"],["ranking","🏆 ランキング"],["pet","🐾 ペット"],
 ["gacha","🎁 ガチャ"],["records","📅 学習記録"],["settings","⚙️ 設定"]
];

function save(){ localStorage.setItem(KEY,JSON.stringify(S)); header(); }
function rank(rp){ return rp>=5000?"DIAMOND":rp>=3500?"PLATINUM":rp>=2000?"GOLD":rp>=1000?"SILVER":"BRONZE"; }
function addRP(n){ S.rp=Math.max(0,S.rp+n); save(); }
function header(){ if($("#rankPill")) $("#rankPill").textContent=`${rank(S.rp)} · ${S.rp} RP`; }
function today(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function learnedCount(){return Object.values(S.known).filter(Boolean).length;}
function weakCount(){return Object.values(S.weak).filter(Boolean).length;}
function answerMeaning(input,meaning){
  const x=norm(input); if(!x)return false;
  return String(meaning).split(/[①②③④⑤⑥]|[、,，\/／;；|]/).map(norm).filter(Boolean)
    .some(p=>x===p || x.includes(p) || p.includes(x));
}
function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),1600)}

function menu(){
  $("#sideNav").innerHTML=menus.map(([v,t])=>`<button class="menuItem ${S.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")
    + `<div class="help glass"><b>LEAP 2300</b><br>${DATA_OK?"✅ 2300語読み込み済み":"❌ 単語データを確認してください"}<br><span class="small">上部タブなし・☰メニューで全機能へ</span></div>`;
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{render(b.dataset.view);closeMenu()});
}
function openMenu(){$("#sideMenu").classList.add("open");$("#menuOverlay").hidden=false}
function closeMenu(){$("#sideMenu").classList.remove("open");$("#menuOverlay").hidden=true}
$("#menuBtn").onclick=openMenu; $("#menuClose").onclick=closeMenu; $("#menuOverlay").onclick=closeMenu;

function home(){
  const learned=learnedCount(), weak=weakCount();
  const acc=S.tests?Math.round(S.correct/S.tests*100):0;
  return `<section class="home">
    <div class="hero glass">
      <div><div class="eyebrow">LEAP 2300</div><h1>NO LEAP<br>NO LIFE.</h1><p class="muted">2300語を、毎日の習慣に。</p></div>
      <button class="btn primary" data-go="cards">単語学習を始める →</button>
    </div>
    <div class="grid">
      <div class="card stat glass"><div class="ico">📚</div><div class="label">覚えた単語</div><div class="val">${learned}<small> / 2300</small></div></div>
      <div class="card stat glass"><div class="ico">⭐</div><div class="label">RP</div><div class="val">${S.rp}</div></div>
      <div class="card stat glass"><div class="ico">🎯</div><div class="label">正答率</div><div class="val">${acc}<small>%</small></div></div>
      <div class="card stat glass"><div class="ico">🔥</div><div class="label">連続正解</div><div class="val">${S.streak}</div></div>
    </div>
    <div class="homegrid">
      <div class="card glass"><div class="between"><h2>学習進捗</h2><span class="small">苦手 ${weak}語</span></div><div class="progress"><i style="width:${Math.min(100,learned/2300*100)}%"></i></div><p class="small">${learned} / 2300語</p></div>
      <div class="card glass"><h2>すぐ学習</h2><div class="quick"><div class="card" data-go="test">📝<br>テスト</div><div class="card" data-go="training">⚡<br>苦手特訓</div><div class="card" data-go="friends">👥<br>フレンド</div></div></div>
    </div>
  </section>`;
}

let deck=W.slice(), cardIndex=0, flipped=false;
function cards(){
  const w=deck[cardIndex%Math.max(1,deck.length)]||W[0];
  return `<section class="panel">
    <div class="row"><h2>🃏 単語カード</h2><span class="small">No.${w.id} / 2300</span></div>
    <div class="controls">
      <div class="field"><label>開始</label><input id="cf" type="number" min="1" max="2300" value="1"></div>
      <div class="field"><label>終了</label><input id="ct" type="number" min="1" max="2300" value="2300"></div>
      <div class="field"><label>順番</label><select id="co"><option value="seq">番号順</option><option value="random">ランダム</option><option value="weak">苦手優先</option></select></div>
    </div>
    <div id="flashcard" class="flashcard ${flipped?"flipped":""}" tabindex="0">
      <div class="flash-inner">
        <div class="flash-face"><span class="small">ENGLISH</span><div class="word">${esc(w.word)}</div><p>タップして意味を見る</p></div>
        <div class="flash-face flash-back"><span class="small">JAPANESE</span><div class="meaning">${esc(w.meaning)}</div><p>タップして英語に戻る</p></div>
      </div>
    </div>
    <div class="actions"><button id="applyCard" class="primary">範囲を適用</button><button id="known">✓ 覚えた</button><button id="weak">★ 苦手</button><button id="nextCard">次へ</button></div>
  </section>`;
}
function list(){
 return `<section class="panel"><h2>📚 単語一覧</h2>
  <div class="controls">
   <div class="field" style="grid-column:1/-1"><label>検索</label><input id="ls" placeholder="英単語・日本語"></div>
   <div class="field"><label>開始</label><input id="lf" type="number" min="1" max="2300" value="1"></div>
   <div class="field"><label>終了</label><input id="lt" type="number" min="1" max="2300" value="2300"></div>
   <div class="field"><label>状態</label><select id="lstatus"><option value="all">すべて</option><option value="known">覚えた</option><option value="weak">苦手</option><option value="new">未判定</option></select></div>
  </div><div id="wordList" class="rows"></div></section>`;
}
function renderList(){
 const q=norm($("#ls")?.value),a=Math.max(1,+($("#lf")?.value||1)),b=Math.min(2300,+($("#lt")?.value||2300)),st=$("#lstatus")?.value||"all";
 const arr=W.filter(w=>w.id>=Math.min(a,b)&&w.id<=Math.max(a,b)&&(!q||norm(w.word).includes(q)||norm(w.meaning).includes(q))&&(st==="all"||(st==="known"&&S.known[w.id])||(st==="weak"&&S.weak[w.id])||(st==="new"&&!S.known[w.id]&&!S.weak[w.id])));
 $("#wordList").innerHTML=arr.map(w=>`<div class="rowword"><span class="num">No.${w.id}</span><div><div class="en">${esc(w.word)}</div><div class="jp">${esc(w.meaning)}</div></div><span class="status">${S.known[w.id]?"覚えた":S.weak[w.id]?"苦手":"未判定"}</span></div>`).join("")||'<div class="notice">該当する単語がありません。</div>';
}

let quiz=null;
function test(){
 return `<section class="panel"><h2>📝 テスト</h2>
 <div class="controls">
  <div class="field"><label>形式</label><select id="tm"><option value="enjp">英語 → 日本語</option><option value="jpen">日本語 → 英語</option><option value="choice">4択</option></select></div>
  <div class="field"><label>開始</label><input id="tf" type="number" min="1" max="2300" value="1"></div>
  <div class="field"><label>終了</label><input id="tt" type="number" min="1" max="2300" value="2300"></div>
  <div class="field"><label>問題数</label><input id="tc" type="number" min="1" max="100" value="10"></div>
  <div class="field"><label>制限時間(分)</label><input id="tmn" type="number" min="0" value="0"></div>
 </div><button id="startTest" class="primary full">TEST START</button></section>`;
}
function startTest(){
 let a=Math.max(1,Math.min(2300,+$("#tf").value||1)),b=Math.max(1,Math.min(2300,+$("#tt").value||2300));if(a>b)[a,b]=[b,a];
 const pool=shuffle(W.filter(w=>w.id>=a&&w.id<=b));if(!pool.length)return toast("その範囲に単語がありません。");
 const n=Math.min(100,Math.max(1,+$("#tc").value||10),pool.length);
 quiz={mode:$("#tm").value,items:pool.slice(0,n),i:0,ok:0,answered:false,results:[],left:Math.max(0,+$("#tmn").value||0)*60,timer:null};
 if(quiz.left)quiz.timer=setInterval(()=>{quiz.left--;if(quiz.left<=0){clearInterval(quiz.timer);quiz.i=quiz.items.length;render("testRun")}},1000);
 render("testRun");
}
function choices(){
 const w=quiz.items[quiz.i];if(quiz.mode!=="choice")return [];
 return shuffle([w.meaning,...shuffle(W.filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.meaning)]);
}
function testRun(){
 if(quiz.i>=quiz.items.length){if(quiz.timer)clearInterval(quiz.timer);return testResult();}
 const w=quiz.items[quiz.i],q=quiz.mode==="enjp"?w.word:w.meaning,opts=choices();
 const body=quiz.mode==="choice"?`<div class="choices">${opts.map(x=>`<button data-choice="${esc(x)}">${esc(x)}</button>`).join("")}</div>`:`<div class="answer"><input id="answer" autocomplete="off" placeholder="${quiz.mode==="enjp"?"日本語で答える":"英語で答える"}"><button id="submitAnswer" class="primary">回答</button></div>`;
 return `<section class="panel"><div class="row"><span>${quiz.i+1} / ${quiz.items.length}</span><span>${quiz.left?Math.ceil(quiz.left)+"s":""}</span></div>
 <div class="progress"><i style="width:${quiz.i/quiz.items.length*100}%"></i></div><div class="small">${quiz.mode==="enjp"?"ENGLISH → JAPANESE":quiz.mode==="jpen"?"JAPANESE → ENGLISH":"4 CHOICE"}</div>
 <div class="qword">${esc(q)}</div>${quiz.mode==="jpen"?`<div class="hint">💡 頭文字ヒント：${esc(w.word[0].toUpperCase())}…</div>`:""}${body}<div id="feedback"></div></section>`;
}
function answer(ans){
 if(quiz.answered)return;quiz.answered=true;
 const w=quiz.items[quiz.i],expected=quiz.mode==="enjp"?w.meaning:w.word;
 const ok=quiz.mode==="enjp"?answerMeaning(ans,expected):norm(ans)===norm(expected);
 quiz.results.push({w,ans,expected,ok});
 S.tests++;S.studied++;S.correct+=ok?1:0;S.streak=ok?S.streak+1:0;S.best=Math.max(S.best,S.streak);S.rp+=ok?10:0;
 S.known[w.id]=ok;S.weak[w.id]=!ok;S.history[today()]=(S.history[today()]||0)+1;save();
 $("#feedback").innerHTML=`<div class="feedback ${ok?"good":"bad"}"><b>${ok?"⭕ 正解！":"❌ 不正解"}</b><br>あなたの答え：${esc(ans||"（未回答）")}<br><strong>正解：${esc(expected)}</strong></div><button id="nextQ" class="primary full">次の問題 →</button>`;
 if(quiz.mode==="choice")document.querySelectorAll("[data-choice]").forEach(b=>{b.disabled=true;if(b.dataset.choice===expected)b.classList.add("correct");if(b.dataset.choice===ans&&!ok)b.classList.add("wrong")});
 $("#nextQ").onclick=()=>{quiz.i++;quiz.answered=false;render("testRun")};
}
function testResult(){
 const total=quiz.items.length,rate=total?Math.round(quiz.ok/total*100):0;
 // quiz.ok is derived from results so the result remains correct after the last render.
 const ok=quiz.results.filter(x=>x.ok).length;
 return `<section class="panel result"><div class="eyebrow">RESULT</div><div class="score">${ok} / ${total}</div><h2>${rate}%</h2>
 <div class="resultgrid"><div><small>正解</small><strong>${ok}</strong></div><div><small>不正解</small><strong>${total-ok}</strong></div><div><small>獲得RP</small><strong>${ok*10}</strong></div></div>
 <div class="rows" style="margin-top:18px;text-align:left">${quiz.results.map(x=>`<div class="rowword"><span class="num">No.${x.w.id}</span><div><div class="en">${esc(x.w.word)}</div><div class="jp">あなた：${esc(x.ans||"（未回答）")} / 正解：${esc(x.expected)}</div></div><span class="status">${x.ok?"正解":"不正解"}</span></div>`).join("")}</div>
 <button class="primary" data-go="test">もう一度</button></section>`;
}
function training(){
 const pool=W.filter(w=>S.weak[w.id]);const w=shuffle(pool.length?pool:W)[0];
 return `<section class="panel"><h2>⚡ トレーニング</h2><p class="small">${pool.length?"苦手単語を優先中":"苦手単語がないので全2300語から出題"}</p><div class="flashcard"><div><div class="small">No.${w.id}</div><div class="word">${esc(w.word)}</div><div class="meaning">${esc(w.meaning)}</div></div></div><button class="primary full" id="trainNext">次の単語</button></section>`;
}
function friends(){
 return `<section class="panel"><h2>👥 フレンド</h2><div class="controls"><div class="field" style="grid-column:1/-1"><label>フレンド名</label><input id="fname" placeholder="名前"></div></div><button id="addFriend" class="primary full">＋ 追加</button>
 <div class="rows">${S.friends.map((f,i)=>`<div class="rowword"><span>${esc(f)}</span><button data-remove="${i}">削除</button></div>`).join("")||'<div class="notice">まだフレンドがいません。</div>'}</div>
 <p class="small">※複数端末のリアルタイム同期はFirebase等のバックエンド接続が必要です。</p></section>`;
}
function battle(){return `<section class="panel"><h2>⚔️ 対戦</h2><div class="notice">対戦UI</div><p>ルーム作成・参加のUIを用意しています。リアルタイム通信はFirebase接続後に有効化できます。</p><div class="actions"><button class="primary" data-go="test">対戦練習を開始</button></div></section>`}
function ranking(){
 const arr=[["あなた",S.rp],["Friend A",2480],["Friend B",1860],["Friend C",920]].sort((a,b)=>b[1]-a[1]);
 return `<section class="panel"><h2>🏆 ランキング</h2><div class="rows">${arr.map((x,i)=>`<div class="row"><b>${i+1}　${esc(x[0])}</b><span>${x[1]} RP</span></div>`).join("")}</div></section>`;
}
function pet(){return `<section class="panel"><h2>🐾 ペット</h2><div class="card petcard"><div class="pet">🐣</div><h2>${esc(S.pet.name)}</h2><p>${esc(S.pet.rarity)} ・ Lv.${S.pet.level}</p><button id="feedPet" class="primary">学習で育てる</button></div></section>`}
function gacha(){return `<section class="panel"><h2>🎁 ガチャ</h2><p>所持RP：<b>${S.rp}</b></p><div class="actions"><button data-gacha="100">1回 100 RP</button><button data-gacha="900">10連 900 RP</button></div><div id="gachaResult"></div></section>`}
function records(){const k=learnedCount(),acc=S.tests?Math.round(S.correct/S.tests*100):0;return `<section class="panel"><h2>📅 学習記録</h2><div class="grid"><div class="stat"><div class="label">覚えた</div><div class="value">${k} / 2300</div></div><div class="stat"><div class="label">苦手</div><div class="value">${weakCount()}</div></div><div class="stat"><div class="label">回答数</div><div class="value">${S.tests}</div></div><div class="stat"><div class="label">正答率</div><div class="value">${acc}%</div></div></div><div class="calendarClock"><div class="card"><h3>今月の学習</h3>${Object.entries(S.history).slice(-14).map(([d,n])=>`<div class="row"><span>${d}</span><span>${n}問</span></div>`).join("")||'<p class="small">まだ記録がありません。</p>'}</div><div class="card"><h3>進捗</h3><div class="progress"><i style="width:${Math.min(100,k/2300*100)}%"></i></div><p class="small">${k} / 2300語</p></div></div></section>`}
function settings(){return `<section class="panel"><h2>⚙️ 設定</h2><div class="settings"><div class="setting"><b>集中モード</b><button id="focusToggle" class="toggle ${S.settings.focus?"on":""}"><i></i></button></div><div class="setting"><b>学習データ</b><button id="resetData" class="danger">リセット</button></div></div></section>`}

function render(view="home"){
 S.view=view;save();menu();
 const fn={home,cards,list,test,training,friends,battle,ranking,pet,gacha,records,settings,testRun}[view]||home;
 $("#app").innerHTML=fn();header();bind();
 if(view==="list")renderList();
}
function bind(){
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
 $("#flashcard")?.addEventListener("click",()=>{flipped=!flipped;render("cards")});
 $("#nextCard")?.addEventListener("click",()=>{cardIndex++;flipped=false;render("cards")});
 $("#known")?.addEventListener("click",()=>{const w=deck[cardIndex%deck.length];S.known[w.id]=true;S.weak[w.id]=false;cardIndex++;flipped=false;save();render("cards")});
 $("#weak")?.addEventListener("click",()=>{const w=deck[cardIndex%deck.length];S.weak[w.id]=true;S.known[w.id]=false;cardIndex++;flipped=false;save();render("cards")});
 $("#applyCard")?.addEventListener("click",()=>{let a=+$("#cf").value||1,b=+$("#ct").value||2300;deck=W.filter(w=>w.id>=Math.min(a,b)&&w.id<=Math.max(a,b));if($("#co").value==="random")deck=shuffle(deck);if($("#co").value==="weak")deck=[...deck.filter(w=>S.weak[w.id]),...deck.filter(w=>!S.weak[w.id])];cardIndex=0;flipped=false;render("cards")});
 ["ls","lf","lt","lstatus"].forEach(id=>$("#"+id)?.addEventListener("input",renderList));
 $("#startTest")?.addEventListener("click",startTest);
 $("#submitAnswer")?.addEventListener("click",()=>answer($("#answer").value));
 $("#answer")?.addEventListener("keydown",e=>{if(e.key==="Enter")answer($("#answer").value)});
 document.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>answer(b.dataset.choice));
 $("#trainNext")?.addEventListener("click",()=>render("training"));
 $("#addFriend")?.addEventListener("click",()=>{const n=$("#fname").value.trim();if(n){S.friends.push(n);save();render("friends")}});
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{S.friends.splice(+b.dataset.remove,1);save();render("friends")});
 document.querySelectorAll("[data-gacha]").forEach(b=>b.onclick=()=>{const c=+b.dataset.gacha;if(S.rp<c){toast("RPが足りません");return}S.rp-=c;const rs=["Common","Uncommon","Rare","Epic","Legend","God"];S.pet={name:["LEAP","FLASH","NOVA","BOOST"][Math.floor(Math.random()*4)],rarity:rs[Math.floor(Math.random()*rs.length)],level:1,xp:0};save();render("gacha");$("#gachaResult").innerHTML=`<div class="feedback">🎉 ${S.pet.rarity}「${S.pet.name}」を獲得！</div>`});
 $("#feedPet")?.addEventListener("click",()=>{S.pet.xp+=20;if(S.pet.xp>=100){S.pet.xp-=100;S.pet.level++}save();render("pet")});
 $("#focusToggle")?.addEventListener("click",()=>{S.settings.focus=!S.settings.focus;document.body.classList.toggle("focusMode",S.settings.focus);save();render("settings")});
 $("#resetData")?.addEventListener("click",()=>{if(confirm("学習データをリセットしますか？")){localStorage.removeItem(KEY);location.reload()}});
}
document.body.classList.toggle("focusMode",!!S.settings.focus);
if(!DATA_OK)console.error("LEAP 2300 data error:",W.length);
render("home");
})();