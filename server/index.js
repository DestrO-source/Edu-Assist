import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadLocalEnv();
const DATA_DIR = path.join(ROOT, 'server-data');
const DB_FILE = path.join(DATA_DIR, 'users.json');
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');
const COOKIE = 'Edu-Assist_session';
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const CODE_AGE = 10 * 60 * 1000;
const users = new Map();
const sessions = new Map();
const rateLimits = new Map();

await loadUsers();

function loadLocalEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSyncText(file).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !match[1].startsWith('#') && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
function readFileSyncText(file) {
  return readFileSync(file, 'utf8');
}
async function loadUsers() {
  await mkdir(DATA_DIR, { recursive: true });
  try { const rows = JSON.parse(await readFile(DB_FILE, 'utf8')); for (const user of rows) users.set(user.email, user); }
  catch (error) { if (error.code !== 'ENOENT') console.error('Could not read user store:', error.message); }
}
async function saveUsers() { await writeFile(DB_FILE, JSON.stringify([...users.values()], null, 2), { mode: 0o600 }); }
const json = (res, status, body, extraHeaders={}) => { const data = JSON.stringify(body);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders});res.end(data); };
function allowedOrigin(origin) {
  if (!origin) return true;
  if (process.env.APP_ORIGIN && origin === process.env.APP_ORIGIN) return true;
  return !IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
function cors(req,res) {
  const origin=req.headers.origin;
  if (origin && allowedOrigin(origin)) { res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS'); }
}
function originOk(req) { return !req.headers.origin || allowedOrigin(req.headers.origin); }
function rateLimit(req,key,max=8,windowMs=60_000) {
  const ip=req.socket.remoteAddress||'local',now=Date.now(),id=`${ip}:${key}`,recent=(rateLimits.get(id)||[]).filter(time=>now-time<windowMs);
  if (recent.length>=max) return false;recent.push(now);rateLimits.set(id,recent);return true;
}
async function bodyJson(req) {
  let text='';for await(const part of req){text+=part;if(text.length>16_384)throw Object.assign(new Error('Request too large.'),{status:413});}
  try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('Enter valid form information.'),{status:400});}
}
function normalizeEmail(value){return String(value||'').trim().toLowerCase();}
function safeUser(user){return {id:user.id,name:user.name,email:user.email,verified:user.verified};}
function cookieValue(req){const pair=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));return pair?decodeURIComponent(pair.slice(COOKIE.length+1)):'';}
function sessionUser(req){const token=cookieValue(req),record=sessions.get(token);if(!record)return null;if(record.expires<Date.now()){sessions.delete(token);return null;}return users.get(record.email)||null;}
function sessionCookie(token,maxAge) { return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${IS_PROD?'; Secure':''}`; }
async function sendVerification(user, code) {
  const mode=process.env.EMAIL_MODE||'console';
  if(mode==='console'){console.log(`\nEdu-Assist verification code for ${user.email}: ${code}\n`);return 'console';}
  const key=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM;
  if(!key||!from)throw new Error('Email is not configured. Set RESEND_API_KEY and EMAIL_FROM in .env.');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[user.email],subject:'Your Edu-Assist verification code',text:`Hi ${user.name},\n\nYour Edu-Assist verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.\n\nEdu-Assist`,html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#202438"><h1 style="color:#7164e8">Verify your Edu-Assist account</h1><p>Hi ${escapeHtml(user.name)},</p><p>Enter this verification code to activate your account:</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px;background:#f2efff;padding:18px;border-radius:12px;text-align:center">${code}</p><p>This code expires in 10 minutes. If you did not create this account, ignore this email.</p></div>`})});
  if(!response.ok){const detail=await response.text();console.error('Email provider rejected verification message:',detail.slice(0,500));throw new Error('We could not send the verification email. Check the email settings and try again.');}
  return 'email';
}
function escapeHtml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function createCode(user){const code=String(randomInt(0,1_000_000)).padStart(6,'0');user.codeHash=createHash('sha256').update(`${user.id}:${code}`).digest('hex');user.codeExpires=Date.now()+CODE_AGE;user.codeAttempts=0;user.lastCodeSent=Date.now();await saveUsers();return await sendVerification(user,code);}
function rateLimitHeaders(res){res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000; base-uri 'self'; frame-ancestors 'none'");}
async function authRoute(req,res,url){
  if(req.method==='GET'&&url.pathname==='/api/auth/session'){const user=sessionUser(req);return json(res,200,{authenticated:!!user,user:user?safeUser(user):null});}
  if(req.method==='POST'&&!originOk(req))return json(res,403,{error:'Request origin is not allowed.'});
  if(req.method==='POST'&&url.pathname==='/api/auth/register'){
    if(!rateLimit(req,'register',6))return json(res,429,{error:'Too many attempts. Please wait a minute and try again.'});
    const input=await bodyJson(req),name=String(input.name||'').trim(),email=normalizeEmail(input.email),password=String(input.password||'');
    if(name.length<2||name.length>80)return json(res,400,{error:'Enter a name between 2 and 80 characters.'});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(res,400,{error:'Enter a valid email address.'});
    if(password.length<10||password.length>200)return json(res,400,{error:'Choose a password with at least 10 characters.'});
    let user=users.get(email);
    if(user?.verified)return json(res,200,{message:'If this address can be registered, a verification message will be sent.',needsVerification:false});
    if(!user){const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');user={id:randomBytes(16).toString('hex'),name,email,salt,passwordHash:hash,verified:false,createdAt:Date.now()};users.set(email,user);}
    else {const hash=await scrypt(password,user.salt,64);if(!timingSafeEqual(hash,Buffer.from(user.passwordHash,'hex')))return json(res,400,{error:'Use the same password you entered when you started registering this address.'});}
    let delivery;try{delivery=await createCode(user);}catch(error){console.error('Verification delivery failed:',error.message);return json(res,503,{error:error.message});}
    return json(res,200,{message:delivery==='console'?'Development mode: the verification code was printed in the Edu-Assist server terminal.':'A verification code was sent to your email address.',needsVerification:true,email:user.email});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/verify'){
    if(!rateLimit(req,'verify',10))return json(res,429,{error:'Too many attempts. Please wait a minute and try again.'});
    const input=await bodyJson(req),email=normalizeEmail(input.email),code=String(input.code||'').trim(),user=users.get(email);
    if(!user||user.verified||!user.codeHash)return json(res,400,{error:'That code is invalid or expired. Request a new code.'});
    if(user.codeExpires<Date.now()||user.codeAttempts>=5){user.codeHash=null;await saveUsers();return json(res,400,{error:'That code is invalid or expired. Request a new code.'});}
    user.codeAttempts++;
    const submitted=createHash('sha256').update(`${user.id}:${code}`).digest(),expected=Buffer.from(user.codeHash,'hex');
    if(!/^\d{6}$/.test(code)||!timingSafeEqual(submitted,expected)){await saveUsers();return json(res,400,{error:'That code is incorrect. Check the email and try again.'});}
    user.verified=true;user.codeHash=null;user.codeExpires=null;await saveUsers();const token=randomBytes(32).toString('hex');sessions.set(token,{email,expires:Date.now()+SESSION_AGE});return json(res,200,{message:'Email verified. Your account is active.',user:safeUser(user)},{'Set-Cookie':sessionCookie(token,Math.floor(SESSION_AGE/1000))});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/resend'){
    if(!rateLimit(req,'resend',4,60_000))return json(res,429,{error:'Please wait before requesting another code.'});
    const {email:rawEmail}=await bodyJson(req),email=normalizeEmail(rawEmail),user=users.get(email);
    let delivery='none';if(user&&!user.verified){if(Date.now()-(user.lastCodeSent||0)<30_000)return json(res,429,{error:'Please wait 30 seconds before requesting another code.'});try{delivery=await createCode(user);}catch(error){return json(res,503,{error:error.message});}}
    return json(res,200,{message:delivery==='console'?'Development mode: a new code was printed in the Edu-Assist server terminal.':'If the address has a pending registration, a new code has been sent.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
    if(!rateLimit(req,'login',8))return json(res,429,{error:'Too many sign-in attempts. Please wait a minute.'});
    const {email:rawEmail,password:rawPassword}=await bodyJson(req),email=normalizeEmail(rawEmail),password=String(rawPassword||''),user=users.get(email);
    if(!user)return json(res,401,{error:'Email or password is incorrect.'});
    const hash=await scrypt(password,user.salt,64);if(!timingSafeEqual(hash,Buffer.from(user.passwordHash,'hex')))return json(res,401,{error:'Email or password is incorrect.'});
    if(!user.verified)return json(res,403,{error:'Verify your email address before signing in.',code:'EMAIL_NOT_VERIFIED',email});
    const token=randomBytes(32).toString('hex');sessions.set(token,{email,expires:Date.now()+SESSION_AGE});return json(res,200,{message:'Signed in.',user:safeUser(user)},{'Set-Cookie':sessionCookie(token,Math.floor(SESSION_AGE/1000))});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){const token=cookieValue(req);if(token)sessions.delete(token);return json(res,200,{message:'Signed out.'},{'Set-Cookie':sessionCookie('',0)});}
  return false;
}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
async function serveStatic(req,res,url){let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';const file=path.resolve(ROOT,`.${pathname}`),relative=path.relative(ROOT,file),parts=relative.toLowerCase().split(path.sep);if(relative.startsWith('..')||path.isAbsolute(relative))return json(res,403,{error:'Forbidden'});if(relative.toLowerCase()==='.env'||['server','server-data','.git','node_modules'].includes(parts[0]))return json(res,404,{error:'Not found'});try{const content=await readFile(file);res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':path.basename(file)==='service-worker.js'?'no-cache':'no-store'});if(req.method==='HEAD')return res.end();res.end(content);}catch{return json(res,404,{error:'Not found'});}}
const server=http.createServer(async(req,res)=>{
  cors(req,res);rateLimitHeaders(res);
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const url=new URL(req.url,'http://localhost');
  try{const handled=await authRoute(req,res,url);if(handled!==false)return;if(url.pathname.startsWith('/api/'))return json(res,404,{error:'API route not found.'});if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});return await serveStatic(req,res,url);}
  catch(error){console.error('Request failed:',error.message);return json(res,error.status||500,{error:error.status?error.message:'Something went wrong. Please try again.'});}
});
server.listen(PORT,HOST,()=>console.log(`Edu-Assist is running at http://localhost:${PORT}\nEmail mode: ${process.env.EMAIL_MODE||'console'}${(process.env.EMAIL_MODE||'console')==='console'?' (verification codes appear only in this terminal)':''}`));
process.on('SIGINT',()=>{server.close(()=>process.exit(0));});
