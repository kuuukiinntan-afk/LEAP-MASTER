(() => {
"use strict";

const words = Array.isArray(window.WORDS) ? window.WORDS : [];
const DATA_OK = words.length === 2300 && words[0]?.id === 1 && words[2299]?.id === 2300;
if (!DATA_OK) console.error("LEAP 2300 data load error:", words.length);

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const shuffle = a => [...a].sort(() => Math.random()-.5);
const norm = s => String(s ?? "").toLowerCase().trim().replace(/[ 　\t\r\n、。・,，.]/g,"").replace(/[〜～]/g,"~");
const range = (a,b) => words.filter(w => w.id >= a && w.id <= b);
const storeKey = "leap2300_v3";
const defaults = {view:"home",rp:0,rank:"BRONZE",known:{},weak:{},tests:0,correct:0,streak:0,settings:{compact:false},friends:[
{name:"Friend A",rp:2480,status:"学習中"},{name:"Friend B",rp:1860,status:"オンライン"},{name:"Friend C",rp:920,status:"オフライン"}]};
let state = JSON.parse(localStorage.getItem(storeKey)||"null") || defaults;
state.known ||= {}; state.weak ||= {}; state.friends ||= defaults.friends;

function save(){localStorage.setItem(storeKey,JSON.stringify(state));updateHeader()}
function updateHeader(){if($("#rpPill"))$("#rpPill").textContent=`${state.rp} RP`;if($("#rankPill"))$("#rankPill").textContent=state.rank}
function rankFor(rp){return rp>=5000?"DIAMOND":rp>=3500?"PLATINUM":rp>=2000?"GOLD":rp>=1000?"SILVER":"BRONZE"}
function addRP(n){state.rp=Math.max(0,state.rp+n);state.rank=rankFor(state.rp);save()}
function render(view=state.view){state.view=view;save();const fn={home,cards,list,testSetup,training,friends,battle,ranking,settings}[view]||home;$("#app").innerHTML=fn();bind();updateHeader();document.body.classList.toggle("compact",state.settings.compact)}
function home(){return `<section class="hero"><h1>NO LEAP NO LIFE.</h1><p>LEAP 2300 Vocabulary — 2300語を、もっと速く、もっと楽しく。</p><div class="grid"><div class="card"><div class="label">現在のRP</div><div class="value">${state.rp}</div></div><div class="card"><div class="label">正答率</div><div class="value">${state.tests?Math.round(state.correct/state.tests*100):0}%</div></div><div class="card"><div class="label">覚えた単語</div><div class="value">${Object.values(state.known).filter(Boolean).length}</div></div></div></section><div class="grid"><div class="panel"><h2>すぐ学習</h2><div class="actions"><button class="primary" data-go="test">テストを始める</button><button data-go="cards">単語カード</button><button data-go="training">トレーニング</button></div></div><div class="panel"><h2>データ</h2><p>${DATA_OK?"✅ 2300語を読み込み済み":"❌ 単語データの読み込みに失敗"}</p><p class="small">No.1: ${esc(words[0]?.word||"-")}　No.2300: ${esc(words[2299]?.word||"-")}</p></div></div>`}

let cardIndex=0,cardPool=words;
function cards(){
  if(!cardPool.length) cardPool=words.slice();
  const w=cardPool[cardIndex%cardPool.length];
  const flipped=window.__cardFlipped===true;
  return `<section class="panel">
  <div class="card-head"><h2>🃏 単語カード</h2><span class="small">No. ${w.id} / ${words.length}</span></div>
  <div class="controls">
    <div class="field"><label>開始</label><input id="cardFrom" type="number" min="1" max="2300" value="1"></div>
    <div class="field"><label>終了</label><input id="cardTo" type="number" min="1" max="2300" value="2300"></div>
    <div class="field"><label>順番</label><select id="cardOrder"><option value="seq">番号順</option><option value="random">ランダム</option><option value="weak">苦手優先</option></select></div>
  </div>
  <div id="flashcard" class="flashcard ${flipped?"flipped":""}" tabindex="0">
    <div class="flash-inner">
      <div class="flash-face"><span class="small">ENGLISH</span><div class="word">${esc(w.word)}</div><p>タップして意味を見る</p></div>
      <div class="flash-face flash-back"><span class="small">JAPANESE</span><div class="meaning">${esc(w.meaning)}</div><p>タップして英単語に戻る</p></div>
    </div>
  </div>
  <div class="actions"><button class="primary" id="cardApply">範囲を適用</button><button id="known">✓ 覚えた</button><button id="weak">★ 苦手</button><button id="nextCard" class="primary">次へ</button></div>
  </section>`;
}
render("home");
})();