import { interactiveStudyReply, api } from './services/api.js';

const seedModules = [
  { id:'mod-is', code:'INF 370', name:'Information Systems', exam:'2026-11-28', daily:45, topics:['Systems analysis','Requirements modelling','Information systems strategy'], confidence:{} },
  { id:'mod-db', code:'DBS 370', name:'Database Systems', exam:'2026-12-02', daily:60, topics:['Normalisation','SQL joins','Transactions and integrity'], confidence:{} },
  { id:'mod-net', code:'NET 370', name:'Computer Networks', exam:'2026-12-05', daily:30, topics:['OSI model','Routing and switching','Network security'], confidence:{} },
  { id:'mod-sd', code:'SDV 370', name:'Software Development', exam:'2026-12-09', daily:45, topics:['Version control','Testing','Software lifecycle'], confidence:{} }
];
const paperQuestions = [
  { module:'DBS 370', topic:'Normalisation', answer:0, prompt:'A student table stores StudentID, StudentName, ModuleCode and ModuleName. ModuleName repeats for every student in that module. What is the main issue?', choices:['Update anomaly caused by duplicated module data','A missing network route','A violation of the OSI model','An invalid primary key type'], memo:'Repeated module data can cause update anomalies. When module details change, every student record must be updated or inconsistencies occur. The solution is to separate module details into a Modules table and link through ModuleCode.' },
  { module:'DBS 370', topic:'SQL joins', answer:1, prompt:'Which join returns every row from the left table and matching rows from the right table?', choices:['INNER JOIN','LEFT JOIN','CROSS JOIN','SELF JOIN'], memo:'LEFT JOIN preserves all rows from the left table and adds matching right-side values. When no match exists on the right table, NULL values are returned for those columns.' },
  { module:'NET 370', topic:'OSI model', answer:1, prompt:'Which OSI layer is responsible for routing packets between networks?', choices:['Data Link','Network','Session','Presentation'], memo:'The Network layer (Layer 3) handles logical IP addressing and routing packets between different subnets and networks using routers.' },
  { module:'INF 370', topic:'Requirements modelling', answer:0, prompt:'A use case primarily describes…', choices:['How an actor interacts with a system to achieve a goal','How database tables are indexed','The physical network cable layout','The exact source code for a function'], memo:'A use case describes a goal-oriented interaction between an actor (user or external system) and the system, detailing the happy path and alternate flows.' },
  { module:'SDV 370', topic:'Testing', answer:0, prompt:'What does a unit test normally verify?', choices:['A small, isolated piece of program behaviour','The entire production environment','The visual brand identity','Every network device at once'], memo:'Unit tests check a small unit of code (typically a function, method or class) in isolation using test doubles/mocks so defects can be pinpointed immediately.' }
];
const uid=()=>globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

export function createFeatureSuite({storage,esc,toast,getSessions=()=>[],onSessionsChanged=()=>{}}) {
  let modules=storage.get('modules',seedModules), groups=storage.get('groups',[]), feed=storage.get('activity',[]), chat=storage.get('chat',[]), paperIndex=0, paperAnswered=false;
  const labels={map:'Learning map',modules:'Modules & exams',practice:'Past-paper practice',assistant:'Study chat',stream:'Study stream',groups:'Study groups'};
  const persist=()=>{storage.set('modules',modules);storage.set('groups',groups);storage.set('activity',feed);storage.set('chat',chat);};
  const log=(title,detail='')=>{feed.unshift({id:uid(),title,detail,time:new Date().toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'})});feed=feed.slice(0,40);persist();};
  const moduleBy=id=>modules.find(m=>m.id===id);

  function mapPage(){
    return `<div class="welcome-row"><div><div class="eyebrow">How your learning fits together</div><h1 class="page-title">Learning map</h1><p class="page-subtitle">Move from your qualification to a module, then a topic, resource and practice activity.</p></div><button class="secondary-button" data-feature-action="low-data">◉ Low-data ${document.body.classList.contains('low-data')?'on':'off'}</button></div><div class="hierarchy-banner"><span>QUALIFICATION</span><b>Information Technology</b><i>›</i><span>MODULES</span><b>${modules.length} active modules</b><i>›</i><span>TOPICS</span><b>${modules.reduce((n,m)=>n+m.topics.length,0)} focus areas</b></div><div class="module-map">${modules.map(m=>`<details class="map-module"><summary><span class="module-code">${esc(m.code)}</span><span class="map-module-name"><strong>${esc(m.name)}</strong><small>Exam ${fmtDate(m.exam)} · ${m.daily} study min/day</small></span><span class="map-open">Explore topics⌄</span></summary><div class="map-topics">${m.topics.map((t,i)=>`<article class="map-topic"><span class="topic-step">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(t)}</strong><small>${confidenceLabel(m,t)}</small><div class="topic-meter"><div style="width:${confidencePercent(m,t)}%"></div></div></div><div class="topic-actions"><button class="topic-read-btn ${m.confidence[t]==='got-it'?'done':''}" data-feature-action="mark-topic-read" data-module="${esc(m.id)}" data-topic="${esc(t)}">${m.confidence[t]==='got-it'?'✓ Read':'Mark as Read'}</button><button class="quiet-link" data-feature-view="practice" data-module="${esc(m.code)}">Practise →</button></div></article>`).join('')}<div class="topic-resources"><b>Resources</b><span>Notes and past papers in My documents</span><button class="quiet-link" data-view="documents">Open library →</button></div></div></details>`).join('')}</div><p class="footer-note">All module progress and confidence ratings are saved to this browser.</p>`;
  }

  function modulesPage(){
    return `<div class="welcome-row"><div><div class="eyebrow">Plan around your real assessments</div><h1 class="page-title">Modules &amp; exams</h1><p class="page-subtitle">Set exam dates and available study time. EduAssist builds a suggested revision rhythm.</p></div><button class="primary-button" data-feature-action="add-module">＋ Add module</button></div><div class="module-cards">${modules.map(m=>{const days=daysTo(m.exam),topicCount=m.topics.length,completedCount=Object.values(m.confidence).filter(v=>v==='got-it').length,progPercent=Math.round((completedCount/Math.max(1,topicCount))*100);return `<article class="module-card"><div class="module-card-head"><span class="module-code">${esc(m.code)}</span><span class="tag ${days<8?'orange':'green'}">${days<0?'Date passed':`${days} days to exam`}</span></div><h2>${esc(m.name)}</h2><p>Exam ${fmtDate(m.exam)} · ${m.daily} min available daily</p><div class="module-focus"><strong>Topics to revise (${completedCount}/${topicCount} completed)</strong>${m.topics.map(t=>`<div class="topic-check-row"><label><input type="checkbox" class="topic-confidence" data-module="${esc(m.id)}" data-topic="${esc(t)}" ${m.confidence[t]==='got-it'?'checked':''}><span>${esc(t)}</span><small>${confidenceLabel(m,t)}</small></label><button class="topic-read-btn-inline ${m.confidence[t]==='got-it'?'done':''}" data-feature-action="mark-topic-read" data-module="${esc(m.id)}" data-topic="${esc(t)}" title="Mark topic read and update progress">${m.confidence[t]==='got-it'?'✓ Read':'Mark as Read'}</button></div>`).join('')}</div><div class="progress-track" title="Module revision progress: ${progPercent}%"><div class="progress-fill" style="width:${progPercent}%"></div></div><div class="module-card-actions"><button class="secondary-button" data-feature-action="make-plan" data-module="${esc(m.id)}">Build revision plan</button><button class="quiet-link" data-feature-view="practice" data-module="${esc(m.code)}">Practise topic →</button></div></article>`}).join('')}</div><div class="panel" style="margin-top:18px"><div class="panel-heading"><div><h2>How the plan is made</h2><p>Exam date + available daily time + topics needing confidence</p></div></div><p class="page-subtitle">The suggested plan spreads review blocks across the days remaining, gives “need help” topics extra attention, and leaves a short recap before exam day.</p></div>`;
  }

  function practicePage(){
    const question=paperQuestions[paperIndex%paperQuestions.length];
    return `<div class="welcome-row"><div><div class="eyebrow">Past-paper practice</div><h1 class="page-title">Practice one question at a time</h1><p class="page-subtitle">Select your answer to immediately reveal the memo, compare your reasoning, and move forward.</p></div><button class="secondary-button" data-view="documents">Find my papers →</button></div><div class="practice-layout"><div class="panel practice-question"><div class="panel-heading"><div><span class="tag">Question ${paperIndex+1} of ${paperQuestions.length}</span><h2 style="margin-top:10px">${esc(question.topic)}</h2></div><label class="form-field" style="margin:0"><span class="sr-only">Choose module</span><select id="paper-module">${modules.map(m=>`<option ${m.code===question.module?'selected':''}>${esc(m.code)}</option>`).join('')}</select></label></div><p class="practice-prompt">${esc(question.prompt)}</p><div class="practice-answers">${question.choices.map((c,i)=>`<button class="practice-choice" data-choice="${i}"><span class="choice-letter">${String.fromCharCode(65+i)}</span> <span>${esc(c)}</span></button>`).join('')}</div><div id="memo-feedback" class="memo-feedback" aria-live="polite" hidden></div><div class="practice-actions"><button class="primary-button" id="next-paper-btn" data-feature-action="next-paper" ${paperAnswered?'':'disabled'} style="${paperAnswered?'':'opacity:0.5;cursor:not-allowed;'}">${paperAnswered?'Next question →':'Answer above to proceed →'}</button></div><div class="confidence-row"><span>Rate your confidence for ${esc(question.topic)}:</span>${[['got-it','Got it (100%)'],['unsure','Unsure (55%)'],['need-help','Need help (20%)']].map(([v,l])=>`<button class="confidence-chip" data-feature-action="confidence" data-value="${v}" data-topic="${esc(question.topic)}" data-module-code="${esc(question.module)}">${l}</button>`).join('')}</div></div><aside class="panel practice-side"><div class="panel-heading"><div><h2>Your practice workflow</h2><p>Step-by-step revision</p></div></div><ol class="workflow-list"><li><b>1. Attempt from memory</b><span>Select an answer choice without checking notes.</span></li><li><b>2. Memo reveals automatically</b><span>Compare the solution reasoning right away.</span></li><li><b>3. Move to next question</b><span>Next question unlocks once an answer attempt is made.</span></li><li><b>4. Progress bar updates</b><span>Rating confidence marks topics as read and updates modules.</span></li></ol><button class="quiet-link" data-feature-view="modules">Review module confidence →</button><p class="footer-note">Past-paper questions reflect key syllabus concepts from university assessments.</p></aside></div>`;
  }

  function chatPage(){
    return `<div class="welcome-row"><div><div class="eyebrow">Interactive AI Study Assistant</div><h1 class="page-title">Ask, explore, understand.</h1><p class="page-subtitle">Get instant concept explanations, worked code examples, flashcards, or interactive quizzes.</p></div><span class="tag green">● Live Assistant Active</span></div><div class="chat-layout"><section class="assistant-panel chat-page-panel"><div class="chat-head"><span class="online-dot"></span><strong>EduAssist AI Study Assistant</strong><span class="tag green" style="margin-left:auto">Live &amp; Interactive</span></div><div class="chat-messages chat-page-messages" id="feature-chat" aria-live="polite">${chat.length?chat.map(m=>`<div class="message ${m.role==='user'?'user':''}">${esc(m.text).replace(/\n/g,'<br>')}</div>`).join(''):'<div class="message">Hello Lehlohonolo! I am your interactive EduAssist study assistant. What topic or exam question would you like to explore today? Ask me any question, request code or an explanation, or type "quiz me" to test your recall.</div>'}</div><div class="chat-tools"><label>Help style<select id="help-style"><option value="explain">Explain simply</option><option value="example">Worked example</option><option value="flashcards">Make flashcards</option><option value="quiz">Quick self-check</option></select></label><div class="chat-chips"><button data-chat-prompt="Explain database normalisation and 3NF simply">Explain 3NF</button><button data-chat-prompt="Give me a worked example of an SQL INNER and LEFT join">SQL Joins</button><button data-chat-prompt="How does the OSI model route packets between subnets?">OSI Model</button><button data-chat-prompt="Quiz me on Computer Networks">Quiz Me</button><button data-chat-prompt="What is the difference between unit and integration tests?">Testing</button></div></div><form id="feature-chat-form" class="chat-form"><input name="message" placeholder="Ask about any subject, question, or code topic…" autocomplete="off" required><button aria-label="Send message">↑</button></form></section><aside class="panel chat-context"><h2>Helpful context</h2><p>Pick a module to target your responses.</p><select id="chat-module"><option value="">General study help</option>${modules.map(m=>`<option value="${esc(m.code)}">${esc(m.code)} · ${esc(m.name)}</option>`).join('')}</select><div class="context-note"><b>Interactive Study Assistant</b><p>EduAssist understands full conversations and answers questions across Database Systems, Networks, Software Development, and Systems Analysis.</p></div><div class="api-key-config" style="margin-top:12px;"><button class="secondary-button" data-feature-action="config-ai" style="width:100%;font-size:10px;">⚙ AI Settings &amp; API Key</button></div><button class="quiet-link" data-feature-action="clear-chat" style="margin-top:14px;display:block;">Clear chat history</button></aside></div>`;
  }

  function streamPage(){
    return `<div class="welcome-row"><div><div class="eyebrow">Your learning activity</div><h1 class="page-title">Study stream</h1><p class="page-subtitle">A timeline of your study sessions, practice and group goals on this device.</p></div><button class="secondary-button" data-feature-action="low-data">◉ Low-data ${document.body.classList.contains('low-data')?'on':'off'}</button></div><div class="stream-layout"><div class="stream-list">${feed.length?feed.map((item,i)=>`<article class="stream-item"><span class="stream-marker">${i===0?'●':'○'}</span><div class="stream-card"><small>${esc(item.time)}</small><h2>${esc(item.title)}</h2><p>${esc(item.detail||'Activity recorded in your personal study timeline.')}</p></div></article>`).join(''):'<div class="panel empty-state"><div class="empty-icon">◷</div><strong>Your stream starts with your next study action</strong><p>Complete a quiz, read a document, or mark a topic as read to see it here.</p></div>'}</div><aside class="panel"><h2>Today at a glance</h2><p>${modules.length} modules · ${groups.length} study groups</p><div class="stream-stat"><b>${feed.length}</b><span>recent activity items</span></div><button class="quiet-link" data-feature-action="clear-stream">Clear this activity view</button><p class="footer-note">Activity is private to this browser and is saved locally.</p></aside></div>`;
  }

  function groupsPage(){
    return `<div class="welcome-row"><div><div class="eyebrow">Study together</div><h1 class="page-title">Study groups</h1><p class="page-subtitle">Set a shared revision goal and exchange a compact invite code with classmates.</p></div><button class="primary-button" data-feature-action="create-group">＋ Create a group</button></div><div class="group-notice"><b>Local-first sharing:</b> groups stay in this browser. Export an invite code to share a group snapshot; classmates can import it into their copy.</div>${groups.length?`<div class="group-grid">${groups.map(g=>`<article class="panel group-card"><div class="panel-heading"><div><span class="module-code">${esc(g.code)}</span><h2 style="margin-top:9px">${esc(g.name)}</h2></div><span class="tag green">${g.goals.filter(x=>x.done).length}/${g.goals.length} goals</span></div><p>${esc(g.module||'General study group')} · ${g.members} members</p><div class="group-goals">${g.goals.map((goal,i)=>`<label><input type="checkbox" data-group="${esc(g.id)}" data-goal="${i}" ${goal.done?'checked':''}><span>${esc(goal.text)}</span></label>`).join('')||'<p class="page-subtitle">No goals yet. Add the first one.</p>'}</div><div class="group-actions"><button class="secondary-button" data-feature-action="add-goal" data-group="${esc(g.id)}">＋ Add goal</button><button class="quiet-link" data-feature-action="export-group" data-group="${esc(g.id)}">Share invite code ↗</button></div></article>`).join('')}`:'<div class="empty-state panel"><div class="empty-icon">◇</div><strong>Start with one shared goal</strong><p>Create a group for a module, agree on a small revision goal, and track it together.</p><button class="primary-button" data-feature-action="create-group">Create your first group</button></div>'}<div class="panel import-panel"><div><h2>Have an invite code?</h2><p>Paste a group code shared by a classmate to add their current group snapshot.</p></div><button class="secondary-button" data-feature-action="import-group">Import invite</button></div>`;
  }

  function render(view){const renderers={map:mapPage,modules:modulesPage,practice:practicePage,assistant:chatPage,stream:streamPage,groups:groupsPage};return renderers[view]?renderers[view]():null;}
  function showModal(title,body,formId){const d=document.querySelector('#modal'),c=document.querySelector('#modal-content');c.innerHTML=`<h2>${title}</h2>${body}`;d.showModal();return document.querySelector(`#${formId}`);}

  function onClick(e){
    const viewBtn=e.target.closest('[data-feature-view]');
    if(viewBtn){
      const target=viewBtn.dataset.featureView;
      if(viewBtn.dataset.module)paperIndex=Math.max(0,paperQuestions.findIndex(q=>q.module===viewBtn.dataset.module));
      paperAnswered=false;
      document.querySelector(`[data-view="${target}"]`)?.click();
      return true;
    }
    const actionBtn=e.target.closest('[data-feature-action]');
    if(actionBtn){
      const a=actionBtn.dataset.featureAction;
      if(a==='low-data'){document.body.classList.toggle('low-data');storage.set('low-data',document.body.classList.contains('low-data'));actionBtn.textContent=`◉ Low-data ${document.body.classList.contains('low-data')?'on':'off'}`;toast(`Low-data view ${document.body.classList.contains('low-data')?'on':'off'}.`);return true;}
      if(a==='mark-topic-read'){
        const m=moduleBy(actionBtn.dataset.module);
        const topic=actionBtn.dataset.topic;
        if(m&&topic){
          m.confidence[topic]='got-it';
          persist();
          log('Marked topic as read',`${m.code} · ${topic}`);
          toast(`Marked "${topic}" as read! Progress updated.`);
          const activeView=document.querySelector('.nav-item.active')?.dataset?.view;
          if(activeView==='map')document.querySelector('#page-content').innerHTML=mapPage();
          else if(activeView==='modules')document.querySelector('#page-content').innerHTML=modulesPage();
        }
        return true;
      }
      if(a==='add-module'){
        const form=showModal('Add a module',`<p>Give the planner a real exam date and your available study time.</p><form id="feature-module-form"><div class="form-field"><label>Module code</label><input name="code" required placeholder="e.g. INF 370"></div><div class="form-field"><label>Module name</label><input name="name" required placeholder="e.g. Information Systems"></div><div class="form-field"><label>Exam date</label><input name="exam" type="date" required></div><div class="form-field"><label>Available study time each day (minutes)</label><input name="daily" type="number" min="10" max="600" value="45" required></div><div class="form-field"><label>Topics (separate with commas)</label><textarea name="topics" placeholder="Topic one, Topic two"></textarea></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close">Cancel</button><button class="primary-button">Add module</button></div></form>`,'feature-module-form');
        form.addEventListener('submit',ev=>{ev.preventDefault();const fd=new FormData(form);modules.push({id:uid(),code:String(fd.get('code')).trim().toUpperCase(),name:String(fd.get('name')).trim(),exam:String(fd.get('exam')),daily:Number(fd.get('daily')),topics:String(fd.get('topics')).split(',').map(x=>x.trim()).filter(Boolean),confidence:{}});persist();log('Added a module',String(fd.get('name')));document.querySelector('#modal').close();document.querySelector('#page-content').innerHTML=modulesPage();toast('Module added.');});
        return true;
      }
      if(a==='make-plan'){makePlan(actionBtn.dataset.module);return true;}
      if(a==='reveal-memo'){
        const q=paperQuestions[paperIndex%paperQuestions.length],feedback=document.querySelector('#memo-feedback');
        feedback.hidden=false;
        feedback.innerHTML=`<div class="memo-result revealed"><b>Memorandum Solution</b><p><b>Correct Answer:</b> ${esc(q.choices[q.answer])}</p><p>${esc(q.memo)}</p></div>`;
        paperAnswered=true;
        const nextBtn=document.querySelector('#next-paper-btn');
        if(nextBtn){nextBtn.disabled=false;nextBtn.style.opacity='1';nextBtn.style.cursor='pointer';nextBtn.textContent='Next question →';}
        return true;
      }
      if(a==='next-paper'){
        if(!paperAnswered){
          toast('Please attempt to answer the question first before moving forward!');
          return true;
        }
        paperIndex=(paperIndex+1)%paperQuestions.length;
        paperAnswered=false;
        persist();
        document.querySelector('#page-content').innerHTML=practicePage();
        return true;
      }
      if(a==='confidence'){
        const code=actionBtn.dataset.moduleCode,topic=actionBtn.dataset.topic,m=modules.find(x=>x.code===code||x.name===code);
        if(m){
          const targetTopic=m.topics.includes(topic)?topic:m.topics[0];
          m.confidence[targetTopic]=actionBtn.dataset.value;
          persist();
          log(`Rated confidence: ${actionBtn.dataset.value}`,`${m.code} · ${targetTopic}`);
          toast(`Confidence updated for ${targetTopic}. Progress bar refreshed.`);
        }
        return true;
      }
      if(a==='config-ai'){
        const currentKey=globalThis.localStorage?.getItem('eduassist.ai_api_key')||'';
        const form=showModal('AI Assistant Settings',`<p>EduAssist includes an interactive built-in tutor. You can also optionally connect your Google Gemini API Key for live multimodal intelligence.</p><form id="ai-config-form"><div class="form-field"><label>Google Gemini API Key (Optional)</label><input name="apiKey" type="password" value="${esc(currentKey)}" placeholder="AIzaSy..."></div><p style="font-size:10px;color:var(--muted)">Keys are stored only in your browser local storage.</p><div class="form-actions"><button type="button" class="secondary-button" data-action="close">Cancel</button><button class="primary-button">Save Settings</button></div></form>`,'ai-config-form');
        form.addEventListener('submit',ev=>{ev.preventDefault();const val=new FormData(form).get('apiKey')?.trim()||'';if(val)localStorage.setItem('eduassist.ai_api_key',val);else localStorage.removeItem('eduassist.ai_api_key');document.querySelector('#modal').close();toast(val?'Gemini Live API key saved!':'Using built-in interactive study tutor.');});
        return true;
      }
      if(a==='create-group'){const form=showModal('Create a study group',`<p>Create a local group space for a module and a shared revision goal.</p><form id="feature-group-form"><div class="form-field"><label>Group name</label><input name="name" required placeholder="e.g. Database exam prep"></div><div class="form-field"><label>Module</label><select name="module"><option>General</option>${modules.map(m=>`<option>${esc(m.code)} · ${esc(m.name)}</option>`).join('')}</select></div><div class="form-field"><label>First shared goal</label><input name="goal" required placeholder="e.g. Finish normalisation practice"></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close">Cancel</button><button class="primary-button">Create group</button></div></form>`,'feature-group-form');form.addEventListener('submit',ev=>{ev.preventDefault();const fd=new FormData(form),g={id:uid(),code:`EA-${Math.random().toString(36).slice(2,7).toUpperCase()}`,name:String(fd.get('name')).trim(),module:String(fd.get('module')),members:1,goals:[{text:String(fd.get('goal')).trim(),done:false}]};groups.unshift(g);persist();log('Created a study group',g.name);document.querySelector('#modal').close();document.querySelector('#page-content').innerHTML=groupsPage();toast('Study group created on this device.');});return true;}
      if(a==='add-goal'){const g=groups.find(x=>x.id===actionBtn.dataset.group);if(!g)return true;const form=showModal('Add a shared goal',`<form id="feature-goal-form"><div class="form-field"><label>Goal for ${esc(g.name)}</label><input name="goal" required placeholder="e.g. Review chapter 4 together"></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close">Cancel</button><button class="primary-button">Add goal</button></div></form>`,'feature-goal-form');form.addEventListener('submit',ev=>{ev.preventDefault();g.goals.push({text:new FormData(form).get('goal'),done:false});persist();log('Added a group goal',g.name);document.querySelector('#modal').close();document.querySelector('#page-content').innerHTML=groupsPage();});return true;}
      if(a==='export-group'){const g=groups.find(x=>x.id===actionBtn.dataset.group);if(!g)return true;const code=btoa(unescape(encodeURIComponent(JSON.stringify({v:1,name:g.name,module:g.module,goals:g.goals.map(x=>x.text)}))));navigator.clipboard?.writeText(code).then(()=>toast(`Invite code copied: ${code.slice(0,18)}…`)).catch(()=>showShareCode(code));if(!navigator.clipboard)showShareCode(code);return true;}
      if(a==='import-group'){const form=showModal('Import a group invite',`<p>Paste an EduAssist invite code. It imports a snapshot; it does not create live syncing.</p><form id="feature-import-form"><div class="form-field"><label>Invite code</label><textarea name="code" required rows="4"></textarea></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close">Cancel</button><button class="primary-button">Import group</button></div></form>`,'feature-import-form');form.addEventListener('submit',ev=>{ev.preventDefault();try{const data=JSON.parse(decodeURIComponent(escape(atob(String(new FormData(form).get('code')).trim()))));if(data.v!==1||!data.name)throw Error();groups.push({id:uid(),code:`EA-${Math.random().toString(36).slice(2,7).toUpperCase()}`,name:data.name,module:data.module,members:2,goals:data.goals.map(text=>({text,done:false}))});persist();log('Imported a study group',data.name);document.querySelector('#modal').close();document.querySelector('#page-content').innerHTML=groupsPage();toast('Group snapshot imported.');}catch{toast('That invite code does not look valid.');}});return true;}
      if(a==='clear-chat'){chat=[];persist();document.querySelector('#page-content').innerHTML=chatPage();toast('Chat history cleared from this browser.');return true;}
      if(a==='clear-stream'){feed=[];persist();document.querySelector('#page-content').innerHTML=streamPage();return true;}
    }
    const choice=e.target.closest('[data-choice]');
    if(choice){
      const q=paperQuestions[paperIndex%paperQuestions.length];
      const chosenIndex=Number(choice.dataset.choice);
      const isCorrect=chosenIndex===q.answer;
      
      document.querySelectorAll('.practice-choice').forEach((b,idx)=>{
        b.classList.remove('selected','correct','incorrect');
        if(idx===q.answer)b.classList.add('correct');
      });
      if(!isCorrect)choice.classList.add('incorrect');
      choice.classList.add('selected');

      // Requirement 3: Memo reveals automatically after an attempt to answer
      const feedback=document.querySelector('#memo-feedback');
      if(feedback){
        feedback.hidden=false;
        feedback.innerHTML=`<div class="memo-result ${isCorrect?'correct':'incorrect'}"><div class="memo-result-header"><span class="memo-result-badge ${isCorrect?'green':'orange'}">${isCorrect?'✓ Correct attempt!':'✕ Incorrect attempt'}</span><strong>${isCorrect?'Great recall! Model answer verified.':'Review the memorandum explanation below:'}</strong></div><div class="memo-body"><p><b>Correct Answer:</b> Option ${String.fromCharCode(65+q.answer)} — ${esc(q.choices[q.answer])}</p><p><b>Memorandum Explanation:</b> ${esc(q.memo)}</p></div><div class="memo-next-note"><span>👉 You may now proceed to the next question.</span></div></div>`;
      }
      
      paperAnswered=true;
      const nextBtn=document.querySelector('#next-paper-btn');
      if(nextBtn){
        nextBtn.disabled=false;
        nextBtn.style.opacity='1';
        nextBtn.style.cursor='pointer';
        nextBtn.textContent='Next question →';
      }
      return true;
    }
    const prompt=e.target.closest('[data-chat-prompt]');
    if(prompt){
      const input=document.querySelector('#feature-chat-form input[name="message"]');
      if(input){input.value=prompt.dataset.chatPrompt;input.focus();}
      return true;
    }
    return false;
  }

  function showShareCode(code){showModal('Share this group snapshot',`<p>Copy this code and send it to classmates. The code contains the group name, module and goal text.</p><div class="share-code">${esc(code)}</div><div class="form-actions"><button class="primary-button" data-action="close">Done</button></div>`);}
  
  function onChange(e){
    if(e.target.id==='paper-module'){
      const qIndex=paperQuestions.findIndex(q=>q.module===e.target.value);
      if(qIndex>=0)paperIndex=qIndex;
      paperAnswered=false;
      document.querySelector('#page-content').innerHTML=practicePage();
      return true;
    }
    const check=e.target.closest('[data-group][data-goal]');
    if(check){
      const g=groups.find(x=>x.id===check.dataset.group);
      if(g){g.goals[Number(check.dataset.goal)].done=check.checked;persist();log(check.checked?'Completed a group goal':'Reopened a group goal',g.name);}
      return true;
    }
    const confidence=e.target.closest('.topic-confidence');
    if(confidence){
      const m=moduleBy(confidence.dataset.module);
      if(m){
        m.confidence[confidence.dataset.topic]=confidence.checked?'got-it':'unsure';
        persist();
        log('Updated topic confidence',`${m.code} · ${confidence.dataset.topic}`);
        // Update module progress bar in real-time
        const card=confidence.closest('.module-card');
        if(card){
          const comp=Object.values(m.confidence).filter(v=>v==='got-it').length;
          const pct=Math.round((comp/Math.max(1,m.topics.length))*100);
          const bar=card.querySelector('.progress-fill');
          if(bar)bar.style.width=`${pct}%`;
        }
      }
      return true;
    }
    return false;
  }

  function onSubmit(e){
    if(e.target.id==='feature-chat-form'){
      e.preventDefault();
      sendChat(new FormData(e.target).get('message'),e.target);
      return true;
    }
    return false;
  }

  async function sendChat(raw,form){
    const text=String(raw||'').trim();
    if(!text)return;
    const style=document.querySelector('#help-style')?.value||'explain';
    const module=document.querySelector('#chat-module')?.value||'';
    const area=document.querySelector('#feature-chat');
    chat.push({role:'user',text});
    persist();
    area.insertAdjacentHTML('beforeend',`<div class="message user">${esc(text)}</div><div class="message" id="streaming-answer"><span class="stream-cursor" aria-hidden="true">▍</span></div>`);
    form.reset();
    area.scrollTop=area.scrollHeight;
    
    const bubble=document.querySelector('#streaming-answer');
    let answerText='';
    try {
      const res=await api.askAssistant(text,{style,module,history:chat});
      answerText=res.answer;
    } catch(err) {
      answerText=interactiveStudyReply(text,{style,module,history:chat});
    }

    let rendered='';
    for(let i=0;i<answerText.length;i+=5){
      rendered+=answerText.slice(i,i+5);
      bubble.innerHTML=`${esc(rendered).replace(/\n/g,'<br>')}<span class="stream-cursor" aria-hidden="true">▍</span>`;
      area.scrollTop=area.scrollHeight;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    bubble.innerHTML=esc(answerText).replace(/\n/g,'<br>');
    bubble.removeAttribute('id');
    chat.push({role:'assistant',text:answerText});
    persist();
    log('Asked study assistant',module?`${module} · ${text.slice(0,25)}…`:`${text.slice(0,30)}…`);
  }

  function confidenceLabel(m,t){return ({'got-it':'Feeling confident (100%)','unsure':'Needs another review (55%)','need-help':'Prioritise this topic (20%)'})[m.confidence[t]]||'Not rated yet (0%)';}
  function confidencePercent(m,t){return ({'got-it':100,'unsure':55,'need-help':20})[m.confidence[t]]||0;}
  function fmtDate(value){if(!value)return 'No date';const d=new Date(`${value}T12:00:00`);return d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});}
  function daysTo(value){if(!value)return 0;return Math.ceil((new Date(`${value}T12:00:00`)-new Date(new Date().toDateString()))/86400000);}

  function makePlan(id){
    const m=moduleBy(id);
    if(!m)return;
    const days=Math.max(1,daysTo(m.exam)),topics=m.topics.length?m.topics:['Review key concepts'];
    const priorities=[...topics.filter(t=>m.confidence[t]==='need-help'),...topics.filter(t=>m.confidence[t]==='unsure'),...topics.filter(t=>!m.confidence[t]||m.confidence[t]==='got-it')];
    const blocks=Math.max(1,Math.min(days,Math.ceil(topics.length*2)));
    const all=getSessions().filter(s=>!s.title.startsWith(`${m.code}: `));
    for(let i=0;i<blocks;i++){
      const topic=priorities[i%priorities.length],day=new Date();
      day.setDate(day.getDate()+Math.min(i,days-1));
      const dateLabel=day.toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'});
      all.push({title:`${m.code}: ${topic}`,detail:`${dateLabel} · ${m.daily} min · ${i<topics.length?'Review and recall':'Exam-style practice'}`,time:'16:00',progress:0});
    }
    storage.set('sessions',all);
    onSessionsChanged();
    log('Built a revision plan',`${m.code} · ${days} days remaining · ${m.daily} min/day`);
    toast(`Suggested revision blocks added for ${m.code}.`);
    document.querySelector('#page-content').innerHTML=modulesPage();
  }

  if(storage.get('low-data',false))document.body.classList.add('low-data');
  return {labels,render,onClick,onChange,onSubmit,log};
}

