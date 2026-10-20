const menuToggle=document.getElementById('menuToggle');const mainNav=document.getElementById('mainNav');if(menuToggle&&mainNav){menuToggle.addEventListener('click',()=>{const open=mainNav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));});}
const searchToggle=document.getElementById('searchToggle'),searchPanel=document.getElementById('searchPanel'),closeSearch=document.getElementById('closeSearch'),searchInput=document.getElementById('searchInput'),searchResults=document.getElementById('searchResults');
if(searchToggle&&searchPanel)searchToggle.addEventListener('click',()=>{searchPanel.hidden=false;searchInput?.focus();});
if(closeSearch&&searchPanel)closeSearch.addEventListener('click',()=>{searchPanel.hidden=true;searchToggle?.focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&searchPanel&&!searchPanel.hidden){searchPanel.hidden=true;searchToggle?.focus();}});
const storyIndex=[];
function renderSearch(query){if(!searchResults)return;const q=query.trim().toLocaleLowerCase();if(!q){searchResults.innerHTML='<p>Type a topic, headline or keyword to search stories across TCN.</p>';return;}const words=q.split(/\s+/).filter(Boolean);const matches=storyIndex.filter(s=>words.every(w=>(s.title+' '+s.category+' '+s.summary).toLocaleLowerCase().includes(w)));if(!matches.length){searchResults.innerHTML='<p class="no-results">No matching stories in this demo. Try “elections”, “world”, “Congress” or “policy”.</p>';return;}searchResults.replaceChildren();matches.forEach(s=>{const a=document.createElement('a');a.className='search-result';a.href=s.url;const c=document.createElement('span');c.textContent=s.category;const t=document.createElement('strong');t.textContent=s.title;const p=document.createElement('p');p.textContent=s.summary;a.append(c,t,p);searchResults.append(a);});}
if(searchInput)searchInput.addEventListener('input',()=>renderSearch(searchInput.value));const searchForm=document.getElementById('searchForm');if(searchForm)searchForm.addEventListener('submit',e=>{e.preventDefault();renderSearch(searchInput?.value||'');});
const dateEl=document.getElementById('today');if(dateEl)dateEl.textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();
const newsletterForm=document.getElementById('newsletterForm');if(newsletterForm)newsletterForm.addEventListener('submit',e=>{e.preventDefault();const note=document.getElementById('formNote');if(note)note.textContent='Thanks for your interest! This is a demo; no email address has been saved.';});
/* Interactive election results archive */
const electionCategoryButtons=[...document.querySelectorAll('[data-election-category]')];
const archivePanels=[...document.querySelectorAll('[data-archive]')];
const electionDetails=[...document.querySelectorAll('.election-detail')];
const archiveTitle=document.getElementById('selected-election-title');
const archiveCount=document.getElementById('archive-count');
const categoryTitles={presidential:'Presidential Elections',house:'House Elections',senate:'Senate Elections',party:'Party Elections'};
function showElectionCategory(category){
 electionCategoryButtons.forEach(button=>{const active=button.dataset.electionCategory===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 archivePanels.forEach(panel=>{panel.hidden=panel.dataset.archive!==category;});
 electionDetails.forEach(detail=>detail.hidden=true);
 if(archiveTitle)archiveTitle.textContent=categoryTitles[category]||'Election Results';
 const activePanel=archivePanels.find(panel=>panel.dataset.archive===category);
 const count=activePanel?activePanel.querySelectorAll('[data-show-result]').length:0;
 if(archiveCount)archiveCount.textContent=count+' '+(count===1?'result':'results');
 const list=document.querySelector('.election-archive-list');if(list)list.hidden=false;
}
electionCategoryButtons.forEach(button=>button.addEventListener('click',()=>showElectionCategory(button.dataset.electionCategory)));
document.querySelectorAll('[data-show-result]').forEach(button=>button.addEventListener('click',()=>{
 const id='result-'+button.dataset.showResult;
 electionDetails.forEach(detail=>detail.hidden=detail.id!==id);
 const list=document.querySelector('.election-archive-list');if(list)list.hidden=true;
}));
document.querySelectorAll('[data-back-archive]').forEach(button=>button.addEventListener('click',()=>{
 electionDetails.forEach(detail=>detail.hidden=true);
 const list=document.querySelector('.election-archive-list');if(list)list.hidden=false;
}));
showElectionCategory('presidential');

/* Public newsroom feed: cards and election results update in place while the page stays open. */
(async function loadApprovedNewsroomFeed(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slugify=v=>String(v||'article').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'article';
 const norm=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
 const areasOf=a=>{const values=Array.isArray(a.categories)?a.categories.filter(Boolean):[];if(!values.length&&a.category)values.push(a.category);return [...new Set(values)];};
 const partyColors={'Heritage Party':'#b21212','Progress Party':'#0144c8','Federalist Party':'#4b317c','Independent':'#615e5e'};
 const finalStatus=e=>['Official final results','Uncontested / unopposed','Canceled / unopposed','Canceled'].includes(String(e.counting_status||''));
 const partyOf=c=>partyColors[c.party]?c.party:'Independent';
 const electionCard=e=>{
  const candidates=Array.isArray(e.candidates)?e.candidates:[],total=candidates.reduce((sum,c)=>sum+Math.max(0,Number(c.votes)||0),0);
  const winner=candidates.length?candidates.reduce((best,c)=>!best||Number(c.votes||0)>Number(best.votes||0)?c:best,null):null;
  const finished=finalStatus(e),uncontested=String(e.counting_status||'').toLowerCase().includes('uncontested')||String(e.counting_status||'').toLowerCase().includes('unopposed');
  const winnerPct=winner&&total?Math.max(0,Number(winner.votes)||0)/total*100:0;
  const winnerParty=winner?partyOf(winner):'Independent',winnerColor=partyColors[winnerParty];
  const canceled=String(e.counting_status||'').toLowerCase().includes('canceled');
  const electionKey=String(e.id||e.title||'election').replace(/[^a-zA-Z0-9_-]/g,'');
  const winnerImage=winner&&winner.image_url&&/^https:\/\//i.test(winner.image_url)?'<span class="election-winner-portrait-frame" style="background:'+winnerColor+'"><img class="election-winner-photo" src="'+esc(winner.image_url)+'" alt="Portrait of '+esc(winner.name)+'" loading="lazy"></span>':'<span class="election-winner-portrait-frame election-winner-placeholder" style="background:'+winnerColor+'" aria-hidden="true">TCN</span>';
  const winnerBlock=finished&&winner&&!canceled?'<button type="button" class="election-winner-feature election-archive-trigger" data-toggle-election="'+electionKey+'" aria-expanded="false" aria-controls="election-details-'+electionKey+'" style="--candidate-party:'+winnerColor+'">'+winnerImage+'<span class="election-winner-copy"><span class="election-winner-kicker">'+(e.election_date?new Date(e.election_date+'T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()+' · ':'')+(uncontested?'UNCONTESTED · VIEW RESULTS':'FINAL RESULTS · VIEW DETAILS')+'</span><strong class="election-winner-name">'+esc(winner.name)+'</strong><span class="election-party-pill">'+esc(winnerParty)+'</span><strong class="election-winner-share">'+(uncontested?'Unopposed':winnerPct.toFixed(1)+'%')+'</strong><span>'+Math.max(0,Number(winner.votes)||0).toLocaleString()+' votes · Click to view full results</span></span><span class="election-archive-chevron" aria-hidden="true">＋</span></button>':(finished&&canceled?'<p class="election-canceled-label">Election canceled · no winner declared</p>':'');
  const rows=candidates.map(c=>{
   const votes=Math.max(0,Number(c.votes)||0),pct=total?votes/total*100:0,party=partyOf(c),color=partyColors[party];
   const isWinner=finished&&!canceled&&winner&&c.name===winner.name&&partyOf(c)===partyOf(winner);
   const img='<span class="election-candidate-portrait-frame" style="background:'+color+'">'+(c.image_url&&/^https:\/\//i.test(c.image_url)?'<img class="election-candidate-photo" src="'+esc(c.image_url)+'" alt="" loading="lazy">':'<span class="election-candidate-photo election-candidate-placeholder" aria-hidden="true">TCN</span>')+'</span>';
   return '<article class="election-candidate-row '+(isWinner?'is-winning-candidate':'')+'" style="--candidate-party:'+color+'">'+img+'<div class="election-candidate-main"><div class="election-candidate-name-line"><strong>'+esc(c.name)+'</strong><span class="election-party-pill">'+esc(party)+'</span></div><div class="election-vote-bar"><span style="width:'+pct.toFixed(2)+'%;background:'+color+'"></span></div><span class="election-candidate-meta">'+votes.toLocaleString()+' votes · '+pct.toFixed(1)+'%'+(c.seats!==null&&c.seats!==undefined?' · '+Number(c.seats)+' seats':'')+'</span></div></article>';
  }).join('');
  return '<article class="published-election-card '+(finished?'is-complete':'is-live')+'"><div class="published-election-heading"><div><span class="eyebrow">'+esc(e.election_type||'ELECTION')+' · '+esc(e.counting_status||'RESULTS')+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.party_or_jurisdiction||'')+(e.election_date?' · '+esc(e.election_date):'')+'</p></div><span class="archive-count">'+total.toLocaleString()+' total votes</span></div>'+winnerBlock+'<div id="election-details-'+electionKey+'" class="election-details-body"'+(finished?' hidden':'')+'><div class="published-candidate-list">'+rows+'</div>'+(e.notes?'<p class="result-explanation">'+esc(e.notes)+'</p>':'')+'<p class="election-last-updated">Last updated '+esc(e.updated_at?new Date(e.updated_at).toLocaleString():'')+'</p></div></article>';
 };
 let loading=false;
 async function refreshFeed(){
  if(loading)return;loading=true;
  try{
   const response=await fetch('published-content.json?refresh='+Date.now(),{cache:'no-store'});if(!response.ok)return;
   const feed=await response.json(),articles=Array.isArray(feed.articles)?feed.articles:[],elections=Array.isArray(feed.elections)?feed.elections:[];
   const publicArticles=articles.filter(a=>a&&a.headline);
   storyIndex.splice(0,storyIndex.length,...publicArticles.map(a=>({title:a.headline,category:(areasOf(a)[0]||a.category||'TOP STORIES'),categories:areasOf(a),summary:a.summary||'',url:'published-articles/'+slugify(a.headline)+'-'+String(a.id||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,8)+'.html'})));
   const card=a=>{const id=String(a.id||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,8),url='published-articles/'+slugify(a.headline)+'-'+id+'.html',hasImage=Boolean(a.image_url&&/^https:\/\//i.test(a.image_url)),image=hasImage?'<a class="published-card-image" href="'+url+'" aria-label="Read '+esc(a.headline)+'"><img src="'+esc(a.image_url)+'" alt="'+esc(a.headline)+'" loading="lazy"></a>':'';return '<article class="story-card'+(hasImage?' has-image':'')+'">'+image+'<div class="story-card-content"><div class="story-meta"><span class="category">'+esc(a.category||'TOP STORIES')+'</span></div><h3><a href="'+url+'">'+esc(a.headline)+'</a></h3><p>'+esc(a.summary||'')+'</p><span class="byline">'+esc(a.byline||'TCN NEWSROOM')+'</span></div></article>';};
   const page=(location.pathname.split('/').pop()||'index.html').toLowerCase(),desk=page==='world.html'?'world':page==='politics.html'?'politics':page==='elections.html'?'elections':'';
   const matching=publicArticles.filter(a=>!desk||areasOf(a).some(category=>norm(category)===desk)),deskRoot=document.getElementById('managed-desk-stories');
   if(deskRoot)deskRoot.innerHTML=matching.length?matching.map(card).join(''):'<p class="managed-empty">No articles have been published in this section yet. Publish one from the newsroom.</p>';
   const topRoot=document.getElementById('managed-top-stories');if(topRoot){const top=publicArticles.filter(a=>areasOf(a).some(category=>norm(category)==='topstories'));topRoot.innerHTML=top.length?top.slice(0,6).map(card).join(''):'<p class="managed-empty">No Top Stories have been published yet. Choose “Top Stories” as the desk when writing an article.</p>';}
   const allRoot=document.getElementById('managed-all-stories');if(allRoot)allRoot.innerHTML=publicArticles.length?publicArticles.slice(0,18).map(card).join(''):'<p class="managed-empty">Published newsroom articles will appear here automatically.</p>';
   if(searchInput)renderSearch(searchInput.value||'');
   const electionSection=document.getElementById('newsroom-live-elections'),electionRoot=document.getElementById('published-election-results');
   if(electionSection&&electionRoot){
    electionSection.hidden=!elections.length;
    electionRoot.onclick=event=>{
     const trigger=event.target.closest('[data-toggle-election]');
     if(!trigger)return;
     const details=document.getElementById(trigger.getAttribute('aria-controls'));
     if(!details)return;
     const open=details.hidden;
     details.hidden=!open;
     trigger.setAttribute('aria-expanded',String(open));
     const label=trigger.querySelector('.election-winner-kicker');
     if(label)label.textContent=(open?'FINAL RESULTS · HIDE DETAILS':(trigger.textContent.includes('UNCONTESTED')?'UNCONTESTED · VIEW RESULTS':'FINAL RESULTS · VIEW DETAILS'));
     const chevron=trigger.querySelector('.election-archive-chevron');if(chevron)chevron.textContent=open?'−':'＋';
    };
    if(elections.length){
     const live=elections.filter(e=>!finalStatus(e)),complete=elections.filter(finalStatus);
     const archiveType=e=>{const t=norm(e.election_type||'');if(t.includes('president'))return 'president';if(t.includes('house')||t.includes('representative')||t.includes('congress'))return 'house';if(t.includes('senate')||t.includes('senator'))return 'senate';return 'party';};
     const archiveNames={president:'President',house:'House',senate:'Senate',party:'Party Elections'};
     const archiveGroups=['president','house','senate','party'].map(key=>({key,name:archiveNames[key],items:complete.filter(e=>archiveType(e)===key).sort((a,b)=>String(b.election_date||b.updated_at||'').localeCompare(String(a.election_date||a.updated_at||'')))}));
     const archiveNav=archiveGroups.map((g,i)=>'<button type="button" class="election-archive-tab '+(i===0?'active':'')+'" data-archive-tab="'+g.key+'" aria-pressed="'+(i===0?'true':'false')+'">'+g.name+' <span>'+g.items.length+'</span></button>').join('');
     const archivePanels=archiveGroups.map((g,i)=>'<section class="election-archive-panel" data-archive-panel="'+g.key+'"'+(i===0?'':' hidden')+'><div class="election-archive-stack">'+(g.items.length?g.items.map(electionCard).join(''):'<p class="election-archive-empty">No '+esc(g.name.toLowerCase())+' results have been published yet.</p>')+'</div></section>').join('');
     electionRoot.innerHTML=(live.length?'<section class="election-results-group"><div class="section-heading section-heading-small"><div><span class="eyebrow">LIVE COUNTING</span><h3>Live Election Night Results</h3></div><p>Vote totals and percentages update automatically.</p></div>'+live.map(electionCard).join('')+'</section>':'')+(complete.length?'<section class="election-results-group completed-election-group"><div class="section-heading section-heading-small"><div><span class="eyebrow">CERTIFIED / COMPLETED</span><h3>Election Results Archive</h3></div><p>Choose an office to browse past elections. Select an election card to open its full results.</p></div><nav class="election-archive-tabs" aria-label="Election archive categories">'+archiveNav+'</nav>'+archivePanels+'</section>':'');
     electionRoot.querySelectorAll('[data-archive-tab]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.archiveTab;electionRoot.querySelectorAll('[data-archive-tab]').forEach(tab=>{const active=tab===button;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active));});electionRoot.querySelectorAll('[data-archive-panel]').forEach(panel=>panel.hidden=panel.dataset.archivePanel!==key);}));
    }
   }
  }catch(error){console.warn('TCN published feed could not be loaded',error);}
  finally{loading=false;}
 }
 await refreshFeed();
 window.setInterval(refreshFeed,3000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFeed();});
})();
