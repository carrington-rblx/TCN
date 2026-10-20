import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.TCN_NEWSROOM_CONFIG || {};
const $ = (id) => document.getElementById(id);
const login = $("nr-login"), app = $("nr-app"), message = $("nr-message");
const configured = cfg.supabaseUrl && !cfg.supabaseUrl.includes("YOUR-PROJECT") && cfg.supabasePublishableKey && !cfg.supabasePublishableKey.includes("YOUR_");
let supabase = null, currentUser = null, currentProfile = null, articlesCache = [], electionsCache = [];
if (configured) supabase = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
else showMessage("Setup required: add your Supabase project URL and publishable key in newsroom-config.js, then deploy the SQL schema and Edge Functions.", "error");

function showMessage(text, type="") { if (!message) return; message.textContent = text; message.className = "nr-notice" + (type ? " " + type : ""); }
function clearMessage(){ if(message){message.textContent="";message.className="nr-notice nr-hidden";} }
function escapeText(v){ return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function isEditor(){ return ["editor","admin"].includes(String(currentUser?.app_metadata?.role || "")); }
function activeTab(name){
 document.querySelectorAll("[data-panel]").forEach(p=>p.classList.toggle("nr-hidden",p.dataset.panel!==name));
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 if(name==="submissions") renderMyArticles();
 if(name==="review") renderReviewQueue();
 if(name==="elections") renderElections();
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>activeTab(b.dataset.tab)));
function setEditorTools(){
 ["nr-review-tab","nr-accounts-tab","nr-elections-tab"].forEach(id=>$(id).classList.toggle("nr-hidden",!isEditor()));
}
async function refreshSession(){
 if(!supabase)return;
 const {data:{session}}=await supabase.auth.getSession();
 currentUser=session?.user||null;
 if(!currentUser){login.classList.remove("nr-hidden");app.classList.add("nr-hidden");$("nr-session").textContent="Not signed in";return;}
 login.classList.add("nr-hidden");app.classList.remove("nr-hidden");
 const {data:profile}=await supabase.from("newsroom_profiles").select("display_name").eq("id",currentUser.id).maybeSingle();
 currentProfile=profile;
 $("nr-session").textContent=(profile?.display_name||currentUser.email)+(currentUser?.app_metadata?.role==="admin"?" · ADMINISTRATOR":isEditor()?" · EDITOR":" · AUTHOR");
 setEditorTools();
 await refreshData();
}
async function refreshData(){
 if(!supabase||!currentUser)return;
 const [a,e]=await Promise.all([
  supabase.from("newsroom_articles").select("*").order("updated_at",{ascending:false}),
  supabase.from("newsroom_elections").select("*").order("updated_at",{ascending:false})
 ]);
 if(a.error) showMessage(a.error.message,"error"); else articlesCache=a.data||[];
 if(e.error && isEditor()) showMessage(e.error.message,"error"); else electionsCache=e.data||[];
 $("nr-my-count").textContent=articlesCache.filter(x=>x.author_id===currentUser.id).length;
 $("nr-pending-count").textContent=articlesCache.filter(x=>["submitted"].includes(x.status)).length;
 $("nr-results-count").textContent=electionsCache.filter(x=>x.publication_status==="published").length;
 renderMyArticles(); if(isEditor()){renderReviewQueue();renderElections();}
}
function renderMyArticles(){
 const root=$("nr-my-articles"); if(!root)return;
 const rows=articlesCache.filter(x=>x.author_id===currentUser?.id);
 if(!rows.length){root.innerHTML='<p class="nr-empty">No articles yet. Start with “Write article”.</p>';return;}
 root.innerHTML=rows.map(a=>'<article class="nr-item"><span class="nr-status">'+escapeText(a.status.replace("_"," "))+'</span><h3>'+escapeText(a.headline)+'</h3><p class="nr-muted">'+escapeText(a.category)+' · Updated '+escapeText(new Date(a.updated_at).toLocaleString())+'</p>'+(a.editor_note?'<p><strong>Editor note:</strong> '+escapeText(a.editor_note)+'</p>':'')+(['draft','revision_requested'].includes(a.status)?'<div class="nr-actions"><button class="nr-btn secondary" data-edit-article="'+a.id+'">Edit</button></div>':'')+'</article>').join("");
 root.querySelectorAll("[data-edit-article]").forEach(b=>b.addEventListener("click",()=>editArticle(b.dataset.editArticle)));
}
function renderReviewQueue(){
  const root=$("nr-review-list"); if(!root)return;
  if(!isEditor()){root.innerHTML='<p class="nr-empty">Editor access required.</p>';return;}
  const rows=articlesCache;
  if(!rows.length){root.innerHTML='<p class="nr-empty">No newsroom articles yet.</p>';return;}
  root.innerHTML=rows.map(a=>{
   const canReview=["submitted","revision_requested"].includes(a.status);
   const approved=a.status==="approved";
   return '<article class="nr-item"><span class="nr-status">'+escapeText(a.status.replace("_"," "))+'</span><h3>'+escapeText(a.headline)+'</h3><p class="nr-muted">'+escapeText(a.category)+' · '+escapeText(a.byline||"Uncredited")+' · '+escapeText(a.author_id)+'</p><p>'+escapeText(a.summary)+'</p><details><summary>Read full article</summary><div style="white-space:pre-wrap;margin-top:12px">'+escapeText(a.body)+'</div>'+(a.image_url?'<p>Image: '+escapeText(a.image_url)+'</p>':'')+'</details>'+(canReview?'<div class="nr-field"><label>Editorial note</label><input data-note-for="'+a.id+'" value="'+escapeText(a.editor_note||"")+'" placeholder="Feedback for the author"></div>':'')+'<div class="nr-actions">'+(canReview?'<button class="nr-btn" data-review="approved" data-id="'+a.id+'">Approve for hourly publishing</button><button class="nr-btn secondary" data-review="revision_requested" data-id="'+a.id+'">Request revisions</button><button class="nr-btn danger" data-review="rejected" data-id="'+a.id+'">Reject</button>':approved?'<span class="nr-status">Approved for publishing</span>':'')+'<button class="nr-btn secondary" type="button" data-edit-article="'+a.id+'">Edit article</button>'+(a.status!=="rejected"?'<button class="nr-btn" type="button" data-publish-now="'+a.id+'">Publish now</button>':'')+'<button class="nr-btn danger" type="button" data-delete-article="'+a.id+'">Delete article</button></div></article>';
  }).join("");
  root.querySelectorAll("[data-review]").forEach(b=>b.addEventListener("click",()=>reviewArticle(b.dataset.id,b.dataset.review)));
  root.querySelectorAll("[data-edit-article]").forEach(b=>b.addEventListener("click",()=>editArticle(b.dataset.editArticle)));
  root.querySelectorAll("[data-delete-article]").forEach(b=>b.addEventListener("click",()=>deleteArticle(b.dataset.deleteArticle)));
  root.querySelectorAll("[data-publish-now]").forEach(b=>b.addEventListener("click",()=>publishArticleNow(b.dataset.publishNow,b)));
 }
 async function deleteArticle(id){
  if(!isEditor()){showMessage("Editor permission required to delete articles.","error");return;}
  const article=articlesCache.find(a=>a.id===id);
  if(!article)return;
  if(!window.confirm('Permanently delete "'+article.headline+'"? This cannot be undone.'))return;
  const {error}=await supabase.from("newsroom_articles").delete().eq("id",id);
  if(error){showMessage(error.message,"error");return;}
  if($("nr-article-id").value===id)resetArticleForm();
  showMessage("Article deleted from the newsroom. Refreshing the public site…","success");
  await triggerFeedRefresh();
  await refreshData();
 }
 async function publishArticleNow(id,button){
 if(!isEditor()){showMessage("Editor permission required to publish articles.","error");return;}
 const article=articlesCache.find(a=>a.id===id); if(!article)return;
 if(!window.confirm('Publish "'+article.headline+'" now? This will approve it and trigger a site publishing run.'))return;
 const original=button?.textContent;
 if(button){button.disabled=true;button.textContent="Publishing…";}
 try{
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(cfg.supabaseUrl+"/functions/v1/publish-now",{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey,"Authorization":"Bearer "+(session?.access_token||"")},body:JSON.stringify({article_id:id})});
  const result=await response.json().catch(()=>({error:"Unexpected server response."}));
  if(!response.ok)throw new Error(result.error||"Immediate publishing failed.");
  showMessage("Article approved and the site publishing workflow has been triggered. The live page may take a few minutes to update.","success");
  await refreshData();
 }catch(error){showMessage(error.message||"Immediate publishing failed.","error");}
 finally{if(button){button.disabled=false;button.textContent=original||"Publish now";}}
}
async function reviewArticle(id,status){
 const note=document.querySelector('[data-note-for="'+id+'"]')?.value||"";
 const patch={status,editor_note:note,approved_by:status==="approved"?currentUser.id:null,approved_at:status==="approved"?new Date().toISOString():null,updated_at:new Date().toISOString()};
 const {error}=await supabase.from("newsroom_articles").update(patch).eq("id",id);
 if(error){showMessage(error.message,"error");return;}
 showMessage(status==="approved"?"Article approved. It will publish on the next successful hourly run.":"Editorial decision saved.","success");
 await refreshData();
}
function resetArticleForm(){
 $("nr-article-form").reset();$("nr-article-id").value="";$("nr-write-title").textContent="Submit an article";$("nr-cancel-edit").classList.add("nr-hidden");
}
async function saveArticle(status){
 const id=$("nr-article-id").value;
 const payload={headline:$("nr-article-headline").value.trim(),category:$("nr-article-category").value,summary:$("nr-article-summary").value.trim(),body:$("nr-article-body").value.trim(),byline:$("nr-article-byline").value.trim()||(currentProfile?.display_name||currentUser.email),image_url:$("nr-article-image").value.trim()||null,status,updated_at:new Date().toISOString()};
 if(!payload.headline||!payload.summary||payload.body.length<80){showMessage("Add a headline, summary, and article body of at least 80 characters.","error");return;}
 let result;
 if(id) result=await supabase.from("newsroom_articles").update(payload).eq("id",id).select().single();
 else result=await supabase.from("newsroom_articles").insert({...payload,author_id:currentUser.id}).select().single();
 if(result.error){showMessage(result.error.message,"error");return;}
 showMessage(status==="submitted"?"Submitted to the editor for review.":"Draft saved privately.","success");resetArticleForm();await refreshData();activeTab("submissions");
}
function editArticle(id){
 const a=articlesCache.find(x=>x.id===id);if(!a)return;
 $("nr-article-id").value=a.id;$("nr-article-headline").value=a.headline;$("nr-article-category").value=a.category;$("nr-article-summary").value=a.summary;$("nr-article-body").value=a.body;$("nr-article-byline").value=a.byline;$("nr-article-image").value=a.image_url||"";
 $("nr-write-title").textContent="Edit article";$("nr-cancel-edit").classList.remove("nr-hidden");activeTab("write");window.scrollTo({top:0,behavior:"smooth"});
}
const PARTY_COLORS={"Heritage Party":"#b21212","Progress Party":"#0144c8","Federalist Party":"#4b317c","Independent":"#615e5e"};
function candidateRow(candidate={name:"",votes:0,seats:"",party:"Independent",image_url:""}){
 const card=document.createElement("article");card.className="nr-candidate-editor-card";
 card.innerHTML='<div class="nr-candidate-editor-top"><strong class="nr-candidate-preview-name">Candidate profile</strong><button class="nr-btn danger nr-remove-candidate" type="button">Remove</button></div><div class="nr-grid"><div class="nr-field"><label>Candidate name</label><input class="nr-candidate" required maxlength="120" placeholder="Candidate name"></div><div class="nr-field"><label>Party affiliation</label><select class="nr-party"><option>Heritage Party</option><option>Progress Party</option><option>Federalist Party</option><option>Independent</option></select></div><div class="nr-field"><label>Current vote count</label><input class="nr-votes" type="number" min="0" step="1" value="0" required></div><div class="nr-field"><label>Seats (optional)</label><input class="nr-seats" type="number" min="0" step="1"></div><div class="nr-field"><label>Candidate photo</label><input class="nr-candidate-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><input class="nr-candidate-image-url" type="hidden"><span class="nr-small">Upload JPG, PNG, WebP or GIF (max 5 MB).</span></div><div class="nr-candidate-preview-wrap"><img class="nr-candidate-preview" alt="Candidate photo preview" hidden><span class="nr-candidate-color"></span><strong class="nr-candidate-percent">0.0%</strong><span class="nr-small nr-candidate-vote-preview">0 votes</span></div></div>';
 card.querySelector(".nr-candidate").value=candidate.name||"";
 card.querySelector(".nr-party").value=PARTY_COLORS[candidate.party]?candidate.party:"Independent";
 card.querySelector(".nr-votes").value=Math.max(0,Number(candidate.votes)||0);
 card.querySelector(".nr-seats").value=candidate.seats??"";
 card.querySelector(".nr-candidate-image-url").value=candidate.image_url||"";
 const preview=card.querySelector(".nr-candidate-preview");
 if(candidate.image_url){preview.src=candidate.image_url;preview.hidden=false;}
 const updatePreview=()=>{const party=card.querySelector(".nr-party").value;card.querySelector(".nr-candidate-preview-name").textContent=card.querySelector(".nr-candidate").value.trim()||"Candidate profile";card.querySelector(".nr-candidate-color").style.background=PARTY_COLORS[party];card.querySelector(".nr-candidate-color").textContent=party+" · "+PARTY_COLORS[party];card.querySelector(".nr-candidate-vote-preview").textContent=Math.max(0,Number(card.querySelector(".nr-votes").value)||0).toLocaleString()+" votes";refreshCandidatePercentages();};
 card.querySelector(".nr-candidate").addEventListener("input",updatePreview);
 card.querySelector(".nr-party").addEventListener("change",updatePreview);
 card.querySelector(".nr-votes").addEventListener("input",updatePreview);
 card.querySelector(".nr-candidate-image").addEventListener("change",()=>{const file=card.querySelector(".nr-candidate-image").files?.[0];if(file){if(file.size>5*1024*1024){showMessage("Candidate photos must be 5 MB or smaller.","error");card.querySelector(".nr-candidate-image").value="";return;}preview.src=URL.createObjectURL(file);preview.hidden=false;}updatePreview();});
 card.querySelector(".nr-remove-candidate").addEventListener("click",()=>{if($("nr-candidate-rows").children.length>1)card.remove();else{card.querySelector(".nr-candidate").value="";card.querySelector(".nr-votes").value=0;card.querySelector(".nr-candidate-image").value="";card.querySelector(".nr-candidate-image-url").value="";preview.removeAttribute("src");preview.hidden=true;}refreshCandidatePercentages();});
 updatePreview();return card;
}
function refreshCandidatePercentages(){
 const cards=[...$("nr-candidate-rows").children];
 const total=cards.reduce((sum,card)=>sum+Math.max(0,Number(card.querySelector(".nr-votes")?.value)||0),0);
 cards.forEach(card=>{const votes=Math.max(0,Number(card.querySelector(".nr-votes")?.value)||0);card.querySelector(".nr-candidate-percent").textContent=(total?votes/total*100:0).toFixed(1)+"%";});
}
$("nr-add-candidate").addEventListener("click",()=>$("nr-candidate-rows").append(candidateRow()));
if(!$("nr-candidate-rows").children.length)$("nr-candidate-rows").append(candidateRow());
function resetElectionForm(){ $("nr-election-form").reset();$("nr-election-id").value="";$("nr-candidate-rows").replaceChildren(candidateRow());$("nr-election-cancel").classList.add("nr-hidden"); }
async function readCandidates(){
 const cards=[...$("nr-candidate-rows").children],out=[];
 for(const card of cards){
  const name=card.querySelector(".nr-candidate").value.trim();if(!name)continue;
  let imageUrl=card.querySelector(".nr-candidate-image-url").value||null;
  const file=card.querySelector(".nr-candidate-image").files?.[0];
  if(file){
   if(file.size>5*1024*1024)throw new Error("Candidate photos must be 5 MB or smaller.");
   const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[file.type];
   if(!ext)throw new Error("Use a JPG, PNG, WebP or GIF candidate photo.");
   const path=currentUser.id+"/"+crypto.randomUUID()+"."+ext;
   const {error:uploadError}=await supabase.storage.from("tcn-candidate-images").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
   if(uploadError)throw new Error("Candidate photo upload failed: "+uploadError.message);
   imageUrl=supabase.storage.from("tcn-candidate-images").getPublicUrl(path).data.publicUrl;
  }
  out.push({name,votes:Math.max(0,Number(card.querySelector(".nr-votes").value)||0),seats:card.querySelector(".nr-seats").value===""?null:Number(card.querySelector(".nr-seats").value),party:card.querySelector(".nr-party").value,party_color:PARTY_COLORS[card.querySelector(".nr-party").value],image_url:imageUrl});
 }
 return out;
}
async function saveElection(publish){
 const id=$("nr-election-id").value;
 let candidates;
 try{candidates=await readCandidates();}catch(error){showMessage(error.message||"Could not prepare candidate photos.","error");return;}
 const payload={title:$("nr-election-title").value.trim(),election_type:$("nr-election-type").value,party_or_jurisdiction:$("nr-election-party").value.trim(),election_date:$("nr-election-date").value||null,counting_status:$("nr-election-status").value,candidates,notes:$("nr-election-notes").value.trim(),publication_status:publish?"published":"draft",published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString(),editor_id:currentUser.id};
 if(!payload.title||!payload.candidates.length){showMessage("Add an election title and at least one candidate or list.","error");return;}
 const result=id?await supabase.from("newsroom_elections").update(payload).eq("id",id).select().single():await supabase.from("newsroom_elections").insert(payload).select().single();
 if(result.error){showMessage(result.error.message,"error");return;}
 if(publish){
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch(cfg.supabaseUrl+"/functions/v1/publish-now",{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey,"Authorization":"Bearer "+(session?.access_token||"")},body:JSON.stringify({election_id:result.data.id})});
   const outcome=await response.json().catch(()=>({error:"Unexpected server response."}));
   if(!response.ok)throw new Error(outcome.error||"Could not start election publishing.");
   showMessage("Election results published and the site publishing workflow has been triggered.","success");
  }catch(error){showMessage(error.message||"Election results saved, but publishing could not be triggered.","error");resetElectionForm();await refreshData();return;}
 }else showMessage("Election results saved as a private draft.","success");
 resetElectionForm();await refreshData();
}
async function triggerFeedRefresh(){
 try{
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(cfg.supabaseUrl+"/functions/v1/publish-now",{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey,"Authorization":"Bearer "+(session?.access_token||"")},body:JSON.stringify({refresh_feed:true})});
  const result=await response.json().catch(()=>({error:"Unexpected server response."}));
  if(!response.ok)throw new Error(result.error||"Could not refresh the public feed.");
  return true;
 }catch(error){showMessage("The newsroom change was saved, but the public feed refresh failed: "+(error.message||"Unknown error")+". It will remain until a publishing run succeeds.","error");return false;}
}
async function deleteElection(id){
 if(!isEditor()){showMessage("Editor permission required to delete election results.","error");return;}
 const election=electionsCache.find(e=>e.id===id);if(!election)return;
 if(!window.confirm('Permanently delete "'+election.title+'"? This cannot be undone.'))return;
 const {error}=await supabase.from("newsroom_elections").delete().eq("id",id);
 if(error){showMessage(error.message,"error");return;}
 if($("nr-election-id").value===id)resetElectionForm();
 showMessage("Election results deleted from the newsroom. Refreshing the public site…","success");
 await triggerFeedRefresh();
 await refreshData();
}
function renderElections(){
 const root=$("nr-election-list");if(!root)return;
 if(!isEditor()){root.innerHTML='<p class="nr-empty">Editor access required.</p>';return;}
 if(!electionsCache.length){root.innerHTML='<p class="nr-empty">No election results entered yet.</p>';return;}
 root.innerHTML=electionsCache.map(e=>{
  const cs=Array.isArray(e.candidates)?e.candidates:[],total=cs.reduce((sum,c)=>sum+Math.max(0,Number(c.votes)||0),0);
  const final=["Official final results","Uncontested / unopposed","Canceled / unopposed"].includes(e.counting_status);
  const winner=cs.length?cs.reduce((best,c)=>!best||Number(c.votes||0)>Number(best.votes||0)?c:best,null):null;
  return '<article class="nr-item nr-election-saved"><span class="nr-status">'+escapeText(e.publication_status)+'</span><h3>'+escapeText(e.title)+'</h3><p class="nr-muted">'+escapeText(e.election_type)+' · '+escapeText(e.counting_status)+' · '+escapeText(e.election_date||"Date not set")+'</p><p>'+total.toLocaleString()+' votes across '+cs.length+' candidate(s)</p><div class="nr-saved-candidate-list">'+cs.map(c=>{const party=PARTY_COLORS[c.party]?c.party:"Independent",votes=Math.max(0,Number(c.votes)||0),pct=total?votes/total*100:0;return '<div class="nr-saved-candidate"><span class="nr-candidate-color" style="background:'+PARTY_COLORS[party]+'">'+escapeText(party)+'</span><strong>'+escapeText(c.name)+'</strong><span>'+votes.toLocaleString()+' votes · '+pct.toFixed(1)+'%</span></div>';}).join("")+'</div>'+(final&&winner?'<p><strong>'+(e.counting_status==="Uncontested / unopposed"?"Uncontested candidate: ":"Current leader: ")+escapeText(winner.name)+'</strong></p>':'')+'<div class="nr-actions"><button class="nr-btn secondary" data-edit-election="'+e.id+'">Edit results</button>'+(e.publication_status==="published"?'<button class="nr-btn secondary" data-unpublish-election="'+e.id+'">Unpublish</button>':'')+'<button class="nr-btn danger" type="button" data-delete-election="'+e.id+'">Delete election results</button></div></article>';
 }).join("");
 root.querySelectorAll("[data-edit-election]").forEach(b=>b.addEventListener("click",()=>editElection(b.dataset.editElection)));
 root.querySelectorAll("[data-unpublish-election]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await supabase.from("newsroom_elections").update({publication_status:"draft",published_at:null,updated_at:new Date().toISOString()}).eq("id",b.dataset.unpublishElection);if(error)showMessage(error.message,"error");else{showMessage("Results unpublished. Refreshing the public feed…","success");await triggerFeedRefresh();await refreshData();}}));
 root.querySelectorAll("[data-delete-election]").forEach(b=>b.addEventListener("click",()=>deleteElection(b.dataset.deleteElection)));
}
function editElection(id){
 const e=electionsCache.find(x=>x.id===id);if(!e)return;
 $("nr-election-id").value=e.id;$("nr-election-title").value=e.title;$("nr-election-type").value=e.election_type;$("nr-election-party").value=e.party_or_jurisdiction||"";$("nr-election-date").value=e.election_date||"";$("nr-election-status").value=e.counting_status;$("nr-election-notes").value=e.notes||"";
 $("nr-candidate-rows").replaceChildren(...(e.candidates||[]).map(candidateRow));if(!$("nr-candidate-rows").children.length)$("nr-candidate-rows").append(candidateRow());refreshCandidatePercentages();
 $("nr-election-cancel").classList.remove("nr-hidden");activeTab("elections");window.scrollTo({top:0,behavior:"smooth"});
}
$("nr-login-form").addEventListener("submit",async e=>{e.preventDefault();if(!supabase){showMessage("Supabase setup is incomplete.","error");return;}clearMessage();const {error}=await supabase.auth.signInWithPassword({email:$("nr-email").value.trim(),password:$("nr-password").value});if(error){showMessage(error.message,"error");return;}await refreshSession();showMessage("Signed in.","success");});
$("nr-article-form").addEventListener("submit",async e=>{e.preventDefault();await saveArticle("submitted");});
$("nr-save-draft").addEventListener("click",()=>saveArticle("draft"));
$("nr-cancel-edit").addEventListener("click",resetArticleForm);
$("nr-election-form").addEventListener("submit",async e=>{e.preventDefault();await saveElection(true);});
$("nr-election-save").addEventListener("click",()=>saveElection(false));
$("nr-election-cancel").addEventListener("click",resetElectionForm);
$("nr-account-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isEditor())return showMessage("Editor permission required.","error");
 const {data:{session}}=await supabase.auth.getSession();
 const response=await fetch(cfg.supabaseUrl+"/functions/v1/newsroom-admin",{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey,"Authorization":"Bearer "+session.access_token},body:JSON.stringify({display_name:$("nr-new-name").value.trim(),email:$("nr-new-email").value.trim(),password:$("nr-new-password").value})});
 const result=await response.json().catch(()=>({error:"Unexpected server response."}));
 if(!response.ok){showMessage(result.error||"Account creation failed.","error");return;}
 $("nr-account-form").reset();showMessage("Author account created for "+result.user.email+". Share the temporary password securely and ask them to change it.","success");
});
$("nr-signout").addEventListener("click",async()=>{await supabase?.auth.signOut();currentUser=null;app.classList.add("nr-hidden");login.classList.remove("nr-hidden");$("nr-session").textContent="Not signed in";showMessage("Signed out.","success");});
$("nr-refresh").addEventListener("click",refreshData);
if($("nr-cancel-edit"))$("nr-cancel-edit").classList.add("nr-hidden");
if($("nr-election-cancel"))$("nr-election-cancel").classList.add("nr-hidden");
if(supabase){
 supabase.auth.onAuthStateChange(()=>{setTimeout(()=>refreshSession(),0);});
 refreshSession().catch(e=>showMessage(e.message,"error"));
 supabase.channel("tcn-newsroom-election-live").on("postgres_changes",{event:"*",schema:"public",table:"newsroom_elections"},()=>{if(currentUser&&isEditor())refreshData();}).subscribe();
 window.setInterval(()=>{if(currentUser&&!document.hidden)refreshData();},15000);
}
