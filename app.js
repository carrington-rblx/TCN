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

/* Public story slots are populated only from approved newsroom content. */
(async function loadApprovedNewsroomFeed(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slugify=v=>String(v||'article').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'article';
 const norm=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
 try{
  const response=await fetch('published-content.json',{cache:'no-store'});if(!response.ok)return;
  const feed=await response.json(),articles=Array.isArray(feed.articles)?feed.articles:[],elections=Array.isArray(feed.elections)?feed.elections:[];
  const publicArticles=articles.filter(a=>a&&a.headline);
  storyIndex.splice(0,storyIndex.length,...publicArticles.map(a=>({title:a.headline,category:a.category||'TOP STORIES',summary:a.summary||'',url:'published-articles/'+slugify(a.headline)+'-'+String(a.id||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,8)+'.html'})));
  const card=a=>{const id=String(a.id||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,8),url='published-articles/'+slugify(a.headline)+'-'+id+'.html',image=a.image_url&&/^https:\/\//i.test(a.image_url)?'<img src="'+esc(a.image_url)+'" alt="">':'';return '<article class="story-card"><a class="published-card-image" href="'+url+'">'+image+'</a><div class="story-card-content"><div class="story-meta"><span class="category">'+esc(a.category||'TOP STORIES')+'</span></div><h3><a href="'+url+'">'+esc(a.headline)+'</a></h3><p>'+esc(a.summary||'')+'</p><span class="byline">'+esc(a.byline||'TCN NEWSROOM')+'</span></div></article>';};
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase(),desk=page==='world.html'?'world':page==='politics.html'?'politics':page==='elections.html'?'elections':'';
  const matching=publicArticles.filter(a=>!desk||norm(a.category)===desk),deskRoot=document.getElementById('managed-desk-stories');
  if(deskRoot)deskRoot.innerHTML=matching.length?matching.map(card).join(''):'<p class="managed-empty">No articles have been published in this section yet. Publish one from the newsroom.</p>';
  const topRoot=document.getElementById('managed-top-stories');if(topRoot){const top=publicArticles.filter(a=>norm(a.category)==='topstories');topRoot.innerHTML=top.length?top.slice(0,6).map(card).join(''):'<p class="managed-empty">No Top Stories have been published yet. Choose “Top Stories” as the desk when writing an article.</p>';}
  const allRoot=document.getElementById('managed-all-stories');if(allRoot)allRoot.innerHTML=publicArticles.length?publicArticles.slice(0,18).map(card).join(''):'<p class="managed-empty">Published newsroom articles will appear here automatically.</p>';
  if(searchInput)renderSearch(searchInput.value||'');
  const electionSection=document.getElementById('newsroom-live-elections'),electionRoot=document.getElementById('published-election-results');
  if(electionSection&&electionRoot&&elections.length){electionRoot.innerHTML=elections.map(e=>{const cs=Array.isArray(e.candidates)?e.candidates:[],total=cs.reduce((sum,c)=>sum+Math.max(0,Number(c.votes)||0),0);return '<article class="published-election-card"><div class="published-election-heading"><div><span class="eyebrow">'+esc(e.election_type||'ELECTION')+' · '+esc(e.counting_status||'RESULTS')+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.party_or_jurisdiction||'')+(e.election_date?' · '+esc(e.election_date):'')+'</p></div><span class="archive-count">'+total.toLocaleString()+' votes</span></div><div class="published-candidate-list">'+cs.map(c=>'<div class="published-candidate"><span>'+esc(c.name)+'</span><strong>'+Math.max(0,Number(c.votes)||0).toLocaleString()+' votes'+(c.seats!==null&&c.seats!==undefined?' · '+Number(c.seats)+' seats':'')+'</strong></div>').join('')+'</div>'+(e.notes?'<p class="result-explanation">'+esc(e.notes)+'</p>':'')+'<p class="nr-small">Last updated '+esc(e.updated_at?new Date(e.updated_at).toLocaleString():'')+'</p></article>';}).join('');electionSection.hidden=false;}
 }catch(error){console.warn('TCN published feed could not be loaded',error);}
})();
