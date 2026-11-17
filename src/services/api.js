// Requests use the local Node API when served from Live Server, or same-origin
// routes when served by `npm start`. Never place private API keys in frontend files.
const API_BASE = globalThis.EDUASSIST_API_BASE || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && Number(location.port) >= 5000 ? `${location.protocol}//${location.hostname}:3000` : '');
async function request(path, options={}) {
  const response=await fetch(`${API_BASE}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});
  let data={};try{data=await response.json();}catch{}
  if(!response.ok){const error=new Error(data.error||'The request could not be completed.');error.code=data.code;error.status=response.status;error.email=data.email;throw error;}
  return data;
}
export const api = {
  getSession() { return request('/api/auth/session'); },
  register(data) { return request('/api/auth/register',{method:'POST',body:JSON.stringify(data)}); },
  verify(data) { return request('/api/auth/verify',{method:'POST',body:JSON.stringify(data)}); },
  resendCode(data) { return request('/api/auth/resend',{method:'POST',body:JSON.stringify(data)}); },
  login(data) { return request('/api/auth/login',{method:'POST',body:JSON.stringify(data)}); },
  logout() { return request('/api/auth/logout',{method:'POST',body:'{}'}); },
  async askAssistant(message) {
    // MVP uses a local helper. In production: POST /api/assistant with the user's session.
    return { answer: localStudyReply(message), source: 'demo' };
  }
};
function localStudyReply(message) {
  const text = message.toLowerCase();
  if (/(normalis|database)/.test(text)) return 'A useful way to think about normalisation is organising data to reduce duplication. Start with 1NF (single, atomic values), then 2NF (no partial dependency on part of a composite key), and 3NF (non-key attributes depend only on the key). Try explaining each rule in your own words, then test it against a small table.';
  if (/(plan|study|focus|time)/.test(text)) return 'Try one focused 25-minute block: choose a single topic, write a small goal, silence distractions, then take a 5-minute break. End by noting what you understand and what you want to revisit. You can add a session in your Study planner.';
  if (/(network|osi|router)/.test(text)) return 'For networking revision, draw the path a message takes from an application down the OSI layers and back up at the receiver. Then compare what a router does (connects networks) with what a switch does (forwards traffic within a LAN). Use one concrete example for each.';
  if (/(quiz|practice|test)/.test(text)) return 'Retrieval practice works well: answer a question without looking at your notes, check your reasoning, then revisit missed ideas tomorrow. Open Practice quizzes for a short sample set and use the results to choose your next study topic.';
  return 'I’m the EduAssist demo study helper. Tell me the subject and the part you are working on, and I can suggest a study approach. This demo gives guided study tips and does not send your message to an AI service.';
}
