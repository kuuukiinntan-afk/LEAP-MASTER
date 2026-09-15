/* LEAP online adapter — Firebase Realtime Database */
(() => {
  const key = "leap_firebase_config_v2";
  let db = null, user = null;
  const api = {};
  const cfg = () => { try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null} };
  window.LEAP_ONLINE_API = api;
  window.LEAP_FIREBASE_STATUS = () => !!db;
  window.LEAP_SAVE_FIREBASE_CONFIG = async (config) => { localStorage.setItem(key, JSON.stringify(config)); return init(); };
  window.LEAP_CLEAR_FIREBASE_CONFIG = () => { localStorage.removeItem(key); location.reload(); };
  async function init(){
    const c=cfg();
    if(!c || !window.firebase || !c.apiKey || !c.databaseURL) return false;
    try{
      if(!firebase.apps.length) firebase.initializeApp(c);
      db=firebase.database();
      if(firebase.auth){ const cred=await firebase.auth().signInAnonymously(); user=cred.user; }
      window.LEAP_FIREBASE_READY=true;
      return true;
    }catch(e){ console.error("LEAP Firebase init failed",e); window.LEAP_FIREBASE_READY=false; return false; }
  }
  api.uid=()=>user?.uid||null;
  api.createRoom=async ({roomId,opponentId,count,ownerId,rp,questionIds})=>{
    if(!db) throw new Error("Firebase is not connected");
    await db.ref("rooms/"+roomId).set({roomId,ownerId,opponentId,count,status:"waiting",questionIds:questionIds||[],createdAt:firebase.database.ServerValue.TIMESTAMP,players:{[ownerId]:{rp,ready:false,score:0}}});
    if(opponentId) await db.ref("invites/"+opponentId+"/"+roomId).set({roomId,from:ownerId,count,status:"waiting",createdAt:firebase.database.ServerValue.TIMESTAMP});
    return roomId;
  };
  api.joinRoom=async ({roomId,playerId,rp})=>{
    if(!db) throw new Error("Firebase is not connected");
    const ref=db.ref("rooms/"+roomId), snap=await ref.once("value"); if(!snap.exists()) throw new Error("ルームが見つかりません");
    const room=snap.val();
    await ref.child("players/"+playerId).set({rp,ready:false,score:0});
    await ref.update({status:"ready"});
    return room;
  };
  api.watchRoom=(roomId,cb)=>db&&db.ref("rooms/"+roomId).on("value",s=>cb(s.val()));
  api.stopWatchRoom=(roomId)=>db&&db.ref("rooms/"+roomId).off();
  api.setReady=async(roomId,playerId)=>{if(!db)return;await db.ref(`rooms/${roomId}/players/${playerId}/ready`).set(true);};
  api.submitScore=async(roomId,playerId,score,correct,elapsed)=>{if(!db)return;await db.ref(`rooms/${roomId}/players/${playerId}`).update({score,correct,elapsed,finished:true});};
  api.publishProfile=async ({id,name,rp,streak})=>{if(!db||!id)return;await db.ref("users/"+id).update({name:name||id,rp:rp||0,streak:streak||0,online:true,updatedAt:firebase.database.ServerValue.TIMESTAMP});};
  api.watchProfile=(id,cb)=>db&&db.ref("users/"+id).on("value",s=>cb(s.val()));
  api.getRanking=async(ids)=>{if(!db)return[];const out=[];for(const id of ids){const s=await db.ref("users/"+id).once("value");if(s.exists())out.push({id,...s.val()});}return out;};
  api.getInvite=async(id)=>{if(!db||!id)return null;const s=await db.ref("invites/"+id).orderByChild("status").equalTo("waiting").limitToLast(1).once("value");let out=null;s.forEach(x=>{out=x.val()});return out;};
  init();
})();

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
  view:"home", rp:0, known:{}, weak:{}, tests:0, correct:0,
  streak:0, best:0, studied:0, history:{}, friends:[], friendId:"",
  settings:{theme:"glass",compact:false}, online:{room:"",opponent:""}
};
S.known ||= {}; S.weak ||= {}; S.history ||= {}; S.friends ||= [];
S.settings ||= {theme:"glass",compact:false};
S.online ||= {room:"",opponent:""};
S.settings.theme ||= "glass";

const menus = [
 ["home","⌂ ホーム"],["cards","🃏 単語カード"],["list","📚 単語一覧"],
 ["test","📝 テスト"],["training","⚡ トレーニング"],["friends","👥 フレンド"],
 ["battle","⚔️ オンライン対戦"],["ranking","🏆 ランク・ランキング"],["records","📅 学習記録"],["settings","⚙️ 設定"]
];

function save(){ localStorage.setItem(KEY,JSON.stringify(S)); header(); }
function rank(rp){ return rp>=5000?"DIAMOND":rp>=3500?"PLATINUM":rp>=2000?"GOLD":rp>=1000?"SILVER":"BRONZE"; }
function rankNext(rp){ if(rp<1000)return 1000; if(rp<2000)return 2000; if(rp<3500)return 3500; if(rp<5000)return 5000; return 6500; }
function rankFloor(rp){ if(rp<1000)return 0; if(rp<2000)return 1000; if(rp<3500)return 2000; if(rp<5000)return 3500; return 5000; }
function header(){ if($("#rankPill")) $("#rankPill").textContent=`${rank(S.rp)} · ${S.rp} RP`; }
function today(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function dayKey(offset){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function learnedCount(){return Object.values(S.known).filter(Boolean).length;}
function weakCount(){return Object.values(S.weak).filter(Boolean).length;}
function answerMeaning(input,meaning){
  const x=norm(input); if(!x)return false;
  return String(meaning).split(/[①②③④⑤⑥]|[、,，\/／;；|]/).map(norm).filter(Boolean)
    .some(p=>x===p || x.includes(p) || p.includes(x));
}
function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),1600)}
function recordStudy(n=1){
  const d=today(); S.history[d]=(S.history[d]||0)+n; S.studied=(S.studied||0)+n;
  S.streak=dailyStreak(); S.best=Math.max(S.best,S.streak); save();
}
function dailyStreak(){
  let n=0;
  for(let i=0;i<3660;i++){ if((S.history[dayKey(-i)]||0)>0)n++; else break; }
  return n;
}
function rankIllustration(){
  const r=rank(S.rp), icons={BRONZE:"◇",SILVER:"✦",GOLD:"★",PLATINUM:"✧",DIAMOND:"◆"};
  return `<div class="rankArt rank-${r.toLowerCase()}"><div class="rankGlow"></div><div class="rankBadge">${icons[r]}</div><span>${r}</span></div>`;
}
function menu(){
  const nav=$("#sideNav");
  if(!nav)return;
  const items=menus;
  nav.innerHTML=items.map(([v,t])=>
    `<button type="button" class="menuItem ${S.view===v?"active":""}" data-view="${v}">${t}</button>`
  ).join("")+`<div class="help glass"><b>LEAP 2300</b><br>${DATA_OK?"✅ 2300語読み込み済み":"❌ 単語データを確認してください"}<br><span class="small">単語学習・テスト・ランク・フレンド・対戦・学習記録</span></div>`;
  nav.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{const v=b.dataset.view;closeMenu();render(v)});
}

function openMenu(){$("#sideMenu").classList.add("open");$("#menuOverlay").hidden=false}
function closeMenu(){$("#sideMenu").classList.remove("open");$("#menuOverlay").hidden=true}
window.LEAPCloseMenu=closeMenu;
$("#menuBtn").onclick=openMenu; $("#menuOverlay").onclick=closeMenu;

let deck=W.slice(), cardIndex=0, flipped=false, touchStartX=0, touchStartY=0, swiped=false;
let cardFrom=1, cardTo=2300, cardOrder="seq", cardStarted=false;
function cards(){
  if(!cardStarted){
    return `<section class="panel cardSetup">
      <div class="eyebrow">FLASHCARDS</div><h2>🃏 単語カード</h2>
      <p class="small">2300語から好きな範囲を選んで学習できます。</p>
      <div class="rangeBox">
        <div class="controls"><div class="field"><label>開始番号</label><input id="cf" type="number" min="1" max="2300" value="${cardFrom}"></div>
        <div class="field"><label>終了番号</label><input id="ct" type="number" min="1" max="2300" value="${cardTo}"></div>
        <div class="field"><label>順番</label><select id="co"><option value="seq" ${cardOrder==='seq'?'selected':''}>番号順</option><option value="random" ${cardOrder==='random'?'selected':''}>ランダム</option><option value="weak" ${cardOrder==='weak'?'selected':''}>苦手優先</option></select></div></div>
      </div>
      <div class="cardStartInfo"><b>${Math.abs(cardTo-cardFrom)+1}語</b><span>この範囲から学習</span></div>
      <button id="startCards" class="primary full startLearning">学習を始める →</button>
    </section>`;
  }
  const w=deck[cardIndex%Math.max(1,deck.length)]||W[0];
  return `<section class="studyScreen">
    <div class="studyTop"><button id="exitCards" class="studyBack">← 範囲選択</button><span class="studyCount">${cardIndex+1} / ${deck.length}</span></div>
    <div class="studyProgress"><i style="width:${Math.min(100,(cardIndex+1)/Math.max(1,deck.length)*100)}%"></i></div>
    <div id="flashcard" class="flashcard ${flipped?'flipped':''}" tabindex="0" aria-label="単語カード。タップで裏返し、右スワイプで覚えた、左スワイプで覚えていない">
      <div class="swipeLabel swipeLeft">← もう一度</div><div class="swipeLabel swipeRight">覚えた →</div>
      <div class="flash-inner">
        <div class="flash-face"><span class="cardSide">ENGLISH</span><div class="word">${esc(w.word)}</div><p>タップして意味を見る</p></div>
        <div class="flash-face flash-back"><span class="cardSide">日本語</span><div class="meaning">${esc(w.meaning)}</div><p>左右にスワイプして判定</p></div>
      </div>
    </div>
    <div class="swipeGuide"><span>← 覚えてない</span><span>タップで裏返す</span><span>覚えた →</span></div>
  </section>`;
}
function startCards(){
  let a=Math.max(1,Math.min(2300,+$("#cf").value||1)),b=Math.max(1,Math.min(2300,+$("#ct").value||2300));
  cardFrom=Math.min(a,b);cardTo=Math.max(a,b);cardOrder=$("#co").value||"seq";
  deck=W.filter(w=>w.id>=cardFrom&&w.id<=cardTo);
  if(cardOrder==='random')deck=shuffle(deck);
  if(cardOrder==='weak')deck=[...deck.filter(w=>S.weak[w.id]),...deck.filter(w=>!S.weak[w.id])];
  if(!deck.length)deck=W.slice();
  cardIndex=0;flipped=false;cardStarted=true;render("cards");
}
function rateCard(known){
  if(!deck.length)return;
  const w=deck[cardIndex%deck.length];
  S.known[w.id]=!!known; S.weak[w.id]=!known;
  recordStudy(1);
  cardIndex=(cardIndex+1)%deck.length; flipped=false; render("cards");
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
  <div class="field"><label>形式</label><select id="tm"><option value="choice">4択</option><option value="enjp">英語 → 日本語</option><option value="jpen">日本語 → 英語</option></select></div>
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
 <div class="progress"><i style="width:${quiz.i/quiz.items.length*100}%"></i></div><div class="small">${quiz.mode==="enjp"?"英語 → 日本語":quiz.mode==="jpen"?"日本語 → 英語":"4択"}</div>
 <div class="qword">${esc(q)}</div>${quiz.mode==="jpen"?`<div class="hint">💡 頭文字ヒント：${esc(w.word[0].toUpperCase())}…</div>`:""}${body}<div id="feedback"></div></section>`;
}
function answer(ans){
 if(quiz.answered)return;quiz.answered=true;
 const w=quiz.items[quiz.i],expected=quiz.mode==="enjp"?w.meaning:w.word;
 const ok=quiz.mode==="enjp"?answerMeaning(ans,expected):norm(ans)===norm(expected);
 quiz.results.push({w,ans,expected,ok});
 S.tests++;S.correct+=ok?1:0;S.rp=Math.max(0,S.rp+(ok?10:0));
 S.known[w.id]=ok;S.weak[w.id]=!ok;recordStudy(1);
 $("#feedback").innerHTML=`<div class="feedback ${ok?"good":"bad"}"><b>${ok?"⭕ 正解！":"❌ 不正解"}</b><br>あなたの答え：${esc(ans||"（未回答）")}<br><strong>正解：${esc(expected)}</strong></div><button id="nextQ" class="primary full">次の問題 →</button>`;
 if(quiz.mode==="choice")document.querySelectorAll("[data-choice]").forEach(b=>{b.disabled=true;if(b.dataset.choice===expected)b.classList.add("correct");if(b.dataset.choice===ans&&!ok)b.classList.add("wrong")});
 $("#nextQ").onclick=()=>{quiz.i++;quiz.answered=false;render("testRun")};
}
function testResult(){
 const total=quiz.items.length,ok=quiz.results.filter(x=>x.ok).length,rate=total?Math.round(ok/total*100):0;
 return `<section class="panel result"><div class="eyebrow">RESULT</div><div class="score">${ok} / ${total}</div><h2>${rate}%</h2>
 <div class="resultgrid"><div><small>正解</small><strong>${ok}</strong></div><div><small>不正解</small><strong>${total-ok}</strong></div><div><small>獲得RP</small><strong>${ok*10}</strong></div></div>
 <div class="rows" style="margin-top:18px;text-align:left">${quiz.results.map(x=>`<div class="rowword"><span class="num">No.${x.w.id}</span><div><div class="en">${esc(x.w.word)}</div><div class="jp">あなた：${esc(x.ans||"（未回答）")} / 正解：${esc(x.expected)}</div></div><span class="status">${x.ok?"正解":"不正解"}</span></div>`).join("")}</div>
 <button class="primary" data-go="test">もう一度</button></section>`;
}
function training(){
 const pool=W.filter(w=>S.weak[w.id]);const w=shuffle(pool.length?pool:W)[0];
 return `<section class="panel"><h2>⚡ トレーニング</h2><p class="small">${pool.length?`苦手単語を優先中（${pool.length}語）`:"苦手単語がないので全2300語から出題"}</p><div class="trainCard"><div class="small">No.${w.id}</div><div class="word">${esc(w.word)}</div><div class="meaning">${esc(w.meaning)}</div><div class="trainSpark">✦</div></div><button class="primary full" id="trainNext">次の単語</button></section>`;
}

// Online layer: the UI works offline immediately. If a Firebase adapter is supplied,
// it can expose LEAP_FIREBASE_READY + LEAP_ONLINE_API to make rooms/friends real-time.
function watchBattleRoom(roomId){
  if(!firebaseReady()||!roomId)return;
  window.LEAP_ONLINE_API.watchRoom(roomId,room=>{
    if(!room)return;
    const box=$("#battleResult"); if(!box)return;
    const players=Object.entries(room.players||{});
    const ready=players.filter(([,p])=>p.ready).length;
    const finished=players.filter(([,p])=>p.finished).length;
    if(room.status==="waiting") box.innerHTML=`<div class="battleRoom"><b>ルームコード：${esc(roomId)}</b><p>相手の参加を待っています…</p><p class="small">問題数：${room.count}問</p></div>`;
    else if(finished>=2){
      const sorted=players.sort((a,b)=>(b[1].score||0)-(a[1].score||0));
      box.innerHTML=`<div class="battleRoom"><b>対戦終了！</b><p>${sorted.map(([id,p],i)=>`${i+1}位：${esc(id)}　${p.score||0}問正解`).join("<br>")}</p></div>`;
    } else box.innerHTML=`<div class="battleRoom"><b>対戦中</b><p>${ready}/2人が準備完了</p><p class="small">ルーム：${esc(roomId)}　問題：${room.count}問</p></div>`;
  });
}

function firebaseReady(){return !!(window.LEAP_FIREBASE_READY && window.LEAP_ONLINE_API)}
function onlineStatus(){return firebaseReady()?'<span class="onlineDot">● オンライン接続</span>':'<span class="offlineDot">● オンライン準備中</span>'}
function makeFriendId(){
 if(!S.friendId)S.friendId="L"+Math.random().toString(36).slice(2,8).toUpperCase();
 save();
 if(firebaseReady() && window.LEAP_ONLINE_API.publishProfile) window.LEAP_ONLINE_API.publishProfile({id:S.friendId,name:S.friendId,rp:S.rp,streak:dailyStreak()}).catch(console.error);
 render("friends"); toast("フレンドIDを作成しました");
}
function friends(){
 return `<section class="panel"><div class="row"><h2>👥 フレンド</h2>${onlineStatus()}</div>
   <div class="friendHero"><div class="miniPeople">● ● ●</div><div><b>友達と学習状況を共有</b><p class="small">フレンドを登録すると、ランキングと対戦につなげられます。</p></div></div>
   <div class="controls"><div class="field"><label>あなたのフレンドID</label><input id="myFriendId" readonly value="${esc(S.friendId||"未作成")}"></div><div class="field"><label>フレンドID</label><input id="fname" placeholder="例：L8K3Q2A"></div></div>
   <div class="actions"><button id="makeId" class="primary">自分のIDを作る</button><button id="addFriend">＋ フレンド追加</button></div>
   <div class="rows">${S.friends.map((f,i)=>{const o=typeof f==="string"?{name:f}:f;return `<div class="rowword"><span class="num">${i+1}</span><div><div class="en">${esc(o.name||o.id||"Friend")}</div><div class="jp">${esc(o.status||"待機中")} ${o.rp!=null?`・${o.rp} RP`:""}</div></div><button data-challenge="${i}">対戦</button><button class="danger miniDanger" data-remove="${i}">削除</button></div>`}).join("")||'<div class="notice">まだフレンドがいません。</div>'}</div>
   <div class="notice">${firebaseReady()?"リアルタイム同期が有効です。":"この4ファイルだけで安全に動くオフライン版です。リアルタイム対戦はFirebase等のオンラインDBを接続すると有効化できます。"}</div>
 </section>`;
}
function battle(){
  return `<section class="panel"><div class="row"><h2>⚔️ オンライン対戦</h2>${onlineStatus()}</div>
    <div class="battleHero"><div class="battleIllustration"><span>VS</span><i>✦</i></div><div><div class="eyebrow">LEAP BATTLE</div><h2>友達と同じ問題で勝負</h2><p class="small">問題セットを共有して、正答数と回答時間で競います。</p></div></div>
    <div class="controls"><div class="field"><label>対戦相手ID</label><input id="battleFriend" placeholder="フレンドID"></div><div class="field"><label>問題数</label><select id="battleCount"><option>10</option><option>20</option><option>30</option></select></div></div>
    <div class="actions"><button id="createBattle" class="primary">ルームを作る</button><button id="joinBattle">ルームコードで参加</button></div>
    <div id="battleResult"></div>
    <div class="notice">${firebaseReady()?"オンライン接続済み。ルームを作成するとフレンドへ招待が届きます。":"オンライン対戦を使うには、設定でFirebaseを接続してください。"}</div>
  </section>`;
}
function rankProgress(){
 const floor=rankFloor(S.rp),next=rankNext(S.rp),pct=Math.min(100,Math.max(0,(S.rp-floor)/(next-floor)*100));
 return {floor,next,pct};
}
function ranking(){
  const local=[{id:S.friendId,name:"あなた",rp:S.rp,streak:dailyStreak(),me:true},...S.friends.map(f=>typeof f==="string"?{id:f,name:f,rp:0,streak:0}:{id:f.id,name:f.name||f.id||"Friend",rp:f.rp||0,streak:f.streak||0})].sort((a,b)=>b.rp-a.rp);
  const p=rankProgress();
  return `<section class="panel"><div class="row"><h2>🏆 ランク</h2>${onlineStatus()}</div>
    <div class="rankHero">${rankIllustration()}<div><div class="eyebrow">CURRENT RANK</div><div class="rankBig">${rank(S.rp)}</div><div class="rpBig">${S.rp} RP</div><div class="progress"><i style="width:${p.pct}%"></i></div><p class="small">次のランクまで ${Math.max(0,p.next-S.rp)} RP</p></div></div>
    <div class="streakBox"><span class="streakIcon">🔥</span><div><b>連続学習 ${dailyStreak()}日</b><small>最長 ${S.best||0}日</small></div></div>
    <div class="row" style="margin-top:14px"><h3>フレンドランキング</h3><button id="syncRanking">↻ 更新</button></div>
    <div class="rows" id="rankingRows">${local.map((x,i)=>`<div class="rankItem ${x.me?"me":""}"><span><b>${i+1}位</b>　${esc(x.name)} <small>${x.streak?`🔥${x.streak}日`:""}</small></span><strong>${x.rp} RP</strong></div>`).join("")}</div>
  </section>`;
}
function records(){
 const k=learnedCount(),acc=S.tests?Math.round(S.correct/S.tests*100):0,st=dailyStreak();
 const recent=Object.entries(S.history).sort((a,b)=>new Date(b[0])-new Date(a[0])).slice(0,14);
 return `<section class="panel"><h2>📅 学習記録</h2>
   <div class="grid"><div class="stat"><div class="label">覚えた</div><div class="value">${k} / 2300</div></div><div class="stat"><div class="label">苦手</div><div class="value">${weakCount()}</div></div><div class="stat"><div class="label">回答数</div><div class="value">${S.tests}</div></div><div class="stat"><div class="label">正答率</div><div class="value">${acc}%</div></div></div>
   <div class="streakBox bigStreak"><span class="streakIcon">🔥</span><div><b>連続学習 ${st}日</b><small>今日の学習：${S.history[today()]||0}問　・　最長：${S.best||0}日</small></div></div>
   <div class="calendarClock"><div class="card"><h3>最近の学習</h3>${recent.map(([d,n])=>`<div class="row"><span>${d}</span><span>${n}問</span></div>`).join("")||'<p class="small">まだ記録がありません。</p>'}</div><div class="card"><h3>進捗</h3><div class="progress"><i style="width:${Math.min(100,k/2300*100)}%"></i></div><p class="small">${k} / 2300語</p><div class="weekDots">${[-6,-5,-4,-3,-2,-1,0].map(o=>`<span class="${S.history[dayKey(o)]?"done":""}" title="${dayKey(o)}"></span>`).join("")}</div><p class="small">直近7日</p></div></div>
 </section>`;
}
function themeButtons(){
 const themes=[['glass','Liquid Glass','透明感'],['midnight','Midnight','ダーク'],['paper','Paper','明るくシンプル'],['mint','Mint','爽やか'],['ocean','Ocean','落ち着いた青'],['sunset','Sunset','暖色系']];
 return themes.map(([id,name,sub])=>`<button class="themeCard ${S.settings.theme===id?"selected":""}" data-theme="${id}"><span class="themeSwatch ${id}"></span><b>${name}</b><small>${sub}</small></button>`).join("");
}
function settings(){
 return `<section class="panel"><h2>⚙️ 設定</h2><p class="small">LEAP全体の見た目をここから変更できます。</p>
   <h3>テーマ</h3><div class="themeGrid">${themeButtons()}</div>
   <div class="settings" style="margin-top:14px"><div class="setting"><div><b>コンパクト表示</b><p class="small">一覧やカードの余白を少し小さくする</p></div><button id="compactToggle" class="toggle ${S.settings.compact?"on":""}"><i></i></button></div>
   <div class="setting"><div><b>学習データ</b><p class="small">覚えた単語・苦手・RP・記録など</p></div><button id="resetData" class="danger">リセット</button></div></div>
   <div class="onlineSetup"><div class="eyebrow">ONLINE</div><h3>オンライン接続</h3><p class="small">Firebaseを設定すると、フレンド・ランキング・対戦ルームがリアルタイム化します。設定値はこの端末のブラウザに保存されます。</p><div class="firebaseFields"><input id="fbApiKey" placeholder="apiKey"><input id="fbDatabaseURL" placeholder="databaseURL（https://...firebaseio.com）"><input id="fbProjectId" placeholder="projectId"><button id="saveFirebase" class="primary">Firebase接続を保存</button><button id="clearFirebase" class="danger">接続設定を削除</button></div></div>
 </section>`;
}
function home(){
 const p=rankProgress(),st=dailyStreak();
 return `<section class="homegrid">
   <div class="hero panel"><div class="heroCopy"><div class="eyebrow">LEAP 2300</div><h1>No LEAP,<br><span>No Life.</span></h1><p>2300語を、あなたの武器に。</p><div class="heroBtns"><button class="primary" data-go="cards">単語カードを始める</button><button data-go="test">テストする</button></div></div><div class="heroArt"><div class="orbit o1"></div><div class="orbit o2"></div><div class="bookArt"><div>LEAP</div><span>2300</span></div><i class="spark s1">✦</i><i class="spark s2">✧</i></div></div>
   <div class="grid homeStats"><div class="stat"><div class="label">ランク</div><div class="value">${rank(S.rp)}</div><div class="statSub">${S.rp} RP</div></div><div class="stat"><div class="label">連続学習</div><div class="value">🔥 ${st}日</div><div class="statSub">最長 ${S.best||0}日</div></div><div class="stat"><div class="label">覚えた単語</div><div class="value">${learnedCount()}</div><div class="statSub">/ 2300語</div></div><div class="stat"><div class="label">正答率</div><div class="value">${S.tests?Math.round(S.correct/S.tests*100):0}%</div><div class="statSub">${S.tests}問回答</div></div></div>
   <div class="panel rankHome"><div class="row"><h2>🏆 ランク進捗</h2><b>${S.rp} RP</b></div><div class="rankLine"><span>${rank(S.rp)}</span><div class="progress"><i style="width:${p.pct}%"></i></div><span>${p.next>=6500?"MAX":p.next+" RP"}</span></div><p class="small">正解1問 = +10 RP　・　連続学習 ${st}日</p></div>
   <div class="panel quickPanel"><div class="row"><h2>すぐ学習</h2><span class="small">今日 ${S.history[today()]||0}問</span></div><div class="quick"><button data-go="training">⚡ 苦手トレーニング</button><button data-go="list">📚 単語一覧</button><button data-go="friends">👥 フレンド</button><button data-go="battle">⚔️ 対戦</button></div></div>
 </section>`;
}

function render(view="home"){
 S.view=view; save(); menu();
 const fn={home,cards,list,test,training,friends,battle,ranking,records,settings,testRun}[view]||home;
 $("#app").innerHTML=fn(); header(); bind();
 if(view==="list")renderList();
}
window.LEAPRender=render;
function applyTheme(){document.body.dataset.theme=S.settings.theme||"glass";document.body.classList.toggle("compact",!!S.settings.compact)}
function bind(){
  const nav=$("#sideNav");
  if(nav && !nav.dataset.bound){
    nav.dataset.bound="1";
    nav.addEventListener("click",e=>{
      const b=e.target.closest("[data-view]");
      if(!b || !nav.contains(b)) return;
      e.preventDefault();
      const view=b.dataset.view;
      closeMenu();
      render(view);
    });
  }
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
 document.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{S.settings.theme=b.dataset.theme;save();applyTheme();render("settings")});
 $("#startCards")?.addEventListener("click",startCards);
 $("#exitCards")?.addEventListener("click",()=>{cardStarted=false;render("cards")});
 const fc=$("#flashcard");
 if(fc){
   fc.addEventListener("click",()=>{if(swiped){swiped=false;return;}flipped=!flipped;render("cards")});
   fc.addEventListener("touchstart",e=>{const t=e.changedTouches[0];touchStartX=t.clientX;touchStartY=t.clientY;swiped=false},{passive:true});
   fc.addEventListener("touchend",e=>{const t=e.changedTouches[0],dx=t.clientX-touchStartX,dy=t.clientY-touchStartY;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)){swiped=true;rateCard(dx>0)}},{passive:true});
   fc.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"){rateCard(false)}else if(e.key==="ArrowRight"){rateCard(true)}else if(e.key==="Enter"||e.key===" "){e.preventDefault();flipped=!flipped;render("cards")}});
 }
 ["ls","lf","lt","lstatus"].forEach(id=>$("#"+id)?.addEventListener("input",renderList));
 $("#startTest")?.addEventListener("click",startTest);
 $("#submitAnswer")?.addEventListener("click",()=>answer($("#answer").value));
 $("#answer")?.addEventListener("keydown",e=>{if(e.key==="Enter")answer($("#answer").value)});
 document.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>answer(b.dataset.choice));
 $("#trainNext")?.addEventListener("click",()=>{recordStudy(1);render("training")});
 $("#makeId")?.addEventListener("click",makeFriendId);
 $("#addFriend")?.addEventListener("click",()=>{const n=$("#fname").value.trim();if(!n)return toast("フレンドIDを入力してください");if(!S.friendId)makeFriendId();if(!S.friends.some(f=>(typeof f==="string"?f:f.id)===n)){S.friends.push({id:n,name:n,status:"待機中",rp:0});save();render("friends")}else toast("すでに追加されています")});
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{S.friends.splice(+b.dataset.remove,1);save();render("friends")});
 document.querySelectorAll("[data-challenge]").forEach(b=>b.onclick=()=>{const f=S.friends[+b.dataset.challenge];const id=typeof f==="string"?f:(f.id||f.name);render("battle");setTimeout(()=>{if($("#battleFriend"))$("#battleFriend").value=id},0)});
 $("#createBattle")?.addEventListener("click",async()=>{
   const opponent=$("#battleFriend").value.trim(),count=+$("#battleCount").value||10;
   if(!opponent)return toast("対戦相手のIDを入力してください");
   if(!firebaseReady())return toast("設定からFirebaseを接続してください");
   if(!S.friendId){ makeFriendId(); return; }
   S.online.opponent=opponent; S.online.room="LEAP-"+Math.random().toString(36).slice(2,8).toUpperCase(); save();
   const questionIds=shuffle(W).slice(0,count).map(w=>w.id);
   try{
     await window.LEAP_ONLINE_API.createRoom({roomId:S.online.room,opponentId:opponent,count,ownerId:S.friendId,rp:S.rp,questionIds});
     const box=$("#battleResult"); box.innerHTML=`<div class="battleRoom"><b>ルームコード：${esc(S.online.room)}</b><p>相手の参加を待っています…</p><p class="small">${count}問・同じ問題セットを共有</p><button id="battleCopy">コードをコピー</button></div>`;
     $("#battleCopy")?.addEventListener("click",()=>navigator.clipboard?.writeText(S.online.room).then(()=>toast("コピーしました")));
     watchBattleRoom(S.online.room);
   }catch(e){toast("ルーム作成に失敗しました");console.error(e)}
 });
 $("#joinBattle")?.addEventListener("click",async()=>{
   if(!firebaseReady())return toast("設定からFirebaseを接続してください");
   const roomId=prompt("ルームコードを入力"); if(!roomId)return;
   if(!S.friendId){makeFriendId();return;}
   try{await window.LEAP_ONLINE_API.joinRoom({roomId:roomId.trim(),playerId:S.friendId,rp:S.rp});S.online.room=roomId.trim();save();render("battle");toast("ルームに参加しました");watchBattleRoom(S.online.room);}catch(e){toast("参加できませんでした");console.error(e)}
 });
 $("#compactToggle")?.addEventListener("click",()=>{S.settings.compact=!S.settings.compact;save();applyTheme();render("settings")});
 $("#saveFirebase")?.addEventListener("click",async()=>{const config={apiKey:$("#fbApiKey").value.trim(),databaseURL:$("#fbDatabaseURL").value.trim(),projectId:$("#fbProjectId").value.trim()};if(!config.apiKey||!config.databaseURL)return toast("apiKeyとdatabaseURLを入力してください");if(typeof window.LEAP_SAVE_FIREBASE_CONFIG!=="function")return toast("オンライン接続機能を読み込めません");const ok=await window.LEAP_SAVE_FIREBASE_CONFIG(config);toast(ok?"オンライン接続しました":"接続に失敗しました");render("settings")});
 $("#clearFirebase")?.addEventListener("click",()=>{if(confirm("Firebaseの接続設定を削除しますか？"))window.LEAP_CLEAR_FIREBASE_CONFIG?.()});
 $("#resetData")?.addEventListener("click",()=>{if(confirm("学習データをリセットしますか？")){localStorage.removeItem(KEY);location.reload()}});
}
applyTheme();
if(!DATA_OK)console.error("LEAP 2300 data error:",W.length);
S.view="home";
render("home");
})();
