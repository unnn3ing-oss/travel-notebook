import { MAX_BACKUP_BYTES } from './backup';
import { DEFAULT_GOOGLE_CLIENT_ID } from './googleDriveConfig';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const API='https://www.googleapis.com/drive/v3/';
const MARKER='travel-notebook';
export interface DriveSession { accessToken:string; expiresAt:number }
export interface DriveFile { id:string; name:string; createdTime:string; size?:number }
export class DriveError extends Error { constructor(message:string,readonly code:'configuration'|'auth'|'forbidden'|'network'|'invalid'|'limit'|'cancelled'){super(message);} }
interface TokenResponse { access_token?:string; expires_in?:number|string; scope?:string; error?:string }
interface GoogleOAuth { initTokenClient(config:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(response:TokenResponse)=>void;error_callback:()=>void}):{requestAccessToken(options:{prompt:string}):void} }
declare global { interface Window { google?:{accounts?:{oauth2?:GoogleOAuth}} } }
export const validClientId=(id:string)=>/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id);
export const configuredClientId=()=>{const id=String(import.meta.env.VITE_GOOGLE_CLIENT_ID??DEFAULT_GOOGLE_CLIENT_ID).trim();return validClientId(id)?id:'';};
let sdkPromise:Promise<GoogleOAuth>|undefined;
export function loadGoogleIdentity():Promise<GoogleOAuth>{
  if(window.google?.accounts?.oauth2)return Promise.resolve(window.google.accounts.oauth2);
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise<GoogleOAuth>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
    const fail=()=>{clearTimeout(timer);script.remove();sdkPromise=undefined;reject(new DriveError('Google 連線元件載入失敗，請確認網路後重試。','network'));};
    const timer=setTimeout(fail,15000);script.onerror=fail;script.onload=()=>{clearTimeout(timer);const api=window.google?.accounts?.oauth2;if(api)resolve(api);else fail();};document.head.append(script);
  });
  return sdkPromise;
}
/** Call from a click after the SDK is ready, preserving the user gesture for Google's popup. */
export function authorizeDrive(api:GoogleOAuth,clientId:string):Promise<DriveSession>{
  if(!validClientId(clientId))return Promise.reject(new DriveError('Google Drive 尚未啟用。','configuration'));
  return new Promise((resolve,reject)=>{
    let settled=false;const timer=setTimeout(()=>finish(new DriveError('Google 登入逾時，請再連接一次。','network')),120000);
    const finish=(result:DriveSession|DriveError)=>{if(settled)return;settled=true;clearTimeout(timer);if(result instanceof DriveError)reject(result);else resolve(result);};
    try{api.initTokenClient({client_id:clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,callback:response=>{
      if(response.error){finish(new DriveError('未完成 Google 授權，沒有上傳或還原資料。','cancelled'));return;}
      const seconds=Number(response.expires_in);
      if(!response.access_token||!response.scope?.split(/\s+/).includes(DRIVE_SCOPE)||!Number.isFinite(seconds)||seconds<=60){finish(new DriveError('Google 未授予所需的備份權限，請重新連接。','auth'));return;}
      finish({accessToken:response.access_token,expiresAt:Date.now()+Math.min(seconds,86400)*1000-60000});
    },error_callback:()=>finish(new DriveError('登入視窗未能開啟或已關閉，請允許此網站開啟 Google 登入視窗後重試。','cancelled'))}).requestAccessToken({prompt:'select_account'});}catch{finish(new DriveError('Google 登入未能啟動，請重新連接。','network'));}
  });
}
const safeId=(id:string)=>/^[A-Za-z0-9_-]{1,200}$/.test(id);
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function validSession(session:DriveSession){if(!session.accessToken||session.expiresAt<=Date.now())throw new DriveError('Google 連線已到期，請重新連接。','auth');}
async function request(session:DriveSession,url:string,options:RequestInit={},signal?:AbortSignal,fetcher:typeof fetch=fetch){
  if(signal?.aborted)throw new DriveError('操作已取消。','cancelled');
  validSession(session);
  try{
    const response=await fetcher(url,{...options,headers:{...options.headers,Authorization:'Bearer '+session.accessToken},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),credentials:'omit',referrerPolicy:'no-referrer'});
    if(response.status===401)throw new DriveError('Google 連線已到期，請重新連接。','auth');
    if(response.status===403){
      let reasons:string[]=[];
      try{const error=object(object(await response.json()).error);reasons=[...(Array.isArray(error.errors)?error.errors:[]),...(Array.isArray(error.details)?error.details:[])].map(value=>object(value).reason).filter((v):v is string=>typeof v==='string');}catch{/* An unreadable error body must still produce a safe fallback. */}
      if(reasons.some(r=>r==='SERVICE_DISABLED'||r==='accessNotConfigured'))throw new DriveError('此網站的 Google Drive API 尚未啟用。請網站擁有者在建立 OAuth 用戶端的同一個 Google Cloud 專案啟用 Google Drive API，稍候幾分鐘後重新整理清單。','configuration');
      if(reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED'].includes(r)))throw new DriveError('Google Drive 請求次數已達限制，請稍後再試。','limit');
      if(reasons.includes('storageQuotaExceeded'))throw new DriveError('Google Drive 儲存空間不足，請先釋放空間後再試。','limit');
      throw new DriveError('Google 拒絕備份存取。請確認已授予備份權限，以及帳號或組織是否限制此 App；若權限未完整授予，請中斷後重新連接。','forbidden');
    }
    if(!response.ok)throw new DriveError('Google Drive 暫時無法完成操作，請稍後重試。','network');
    return response;
  }catch(error){if(error instanceof DriveError)throw error;if(signal?.aborted)throw new DriveError('操作已取消。','cancelled');throw new DriveError('無法連接 Google Drive，請確認網路後重試。','network');}
}
function parseFile(raw:unknown):DriveFile|undefined{
  const file=object(raw),size=file.size===undefined?undefined:Number(file.size);
  if(typeof file.id!=='string'||!safeId(file.id)||typeof file.name!=='string'||!file.name.endsWith('.json')||typeof file.createdTime!=='string'||!Number.isFinite(Date.parse(file.createdTime)))return;
  if(size!==undefined&&(!Number.isFinite(size)||size<0))return;
  return{id:file.id,name:file.name.slice(0,250),createdTime:file.createdTime,size};
}
export async function listDriveBackups(session:DriveSession,options:{pageToken?:string;signal?:AbortSignal;fetcher?:typeof fetch}={}){
  const url=new URL(API+'files');url.search=new URLSearchParams({q:`trashed = false and mimeType = 'application/json' and appProperties has { key='app' and value='${MARKER}' }`,spaces:'drive',pageSize:'20',orderBy:'createdTime desc',fields:'files(id,name,createdTime,size,mimeType,appProperties),nextPageToken',...(options.pageToken?{pageToken:options.pageToken}:{})}).toString();
  const root=object(await(await request(session,url.href,{},options.signal,options.fetcher)).json());
  if(!Array.isArray(root.files))throw new DriveError('Google 備份清單格式不完整。','invalid');
  const files=root.files.filter(raw=>{const f=object(raw);return f.mimeType==='application/json'&&object(f.appProperties).app===MARKER;}).map(parseFile).filter((f):f is DriveFile=>!!f);
  return{files,nextPageToken:typeof root.nextPageToken==='string'?root.nextPageToken:undefined};
}
export async function uploadDriveBackup(session:DriveSession,name:string,blob:Blob,options:{signal?:AbortSignal;fetcher?:typeof fetch}={}){
  if(blob.size>MAX_BACKUP_BYTES)throw new DriveError('備份超過 50 MB，請先精簡附件。','limit');
  const metadata={name,mimeType:'application/json',appProperties:{app:MARKER,format:'2'}};
  const start=await request(session,'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,createdTime,size',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(metadata)},options.signal,options.fetcher);
  const location=start.headers.get('Location');let url:URL;
  try{url=new URL(location||'');}catch{throw new DriveError('Google 未提供有效的上傳位置。','invalid');}
  if(url.protocol!=='https:'||url.hostname!=='www.googleapis.com'||url.username||url.password||url.port||url.pathname!=='/upload/drive/v3/files')throw new DriveError('Google 上傳位置無法驗證，已停止上傳。','invalid');
  const done=await request(session,url.href,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob},options.signal,options.fetcher);
  const file=parseFile(await done.json());if(!file)throw new DriveError('尚未確認 Google 已完成備份，請重新整理清單查核。','invalid');return file;
}
export async function downloadDriveBackup(session:DriveSession,file:DriveFile,options:{signal?:AbortSignal;fetcher?:typeof fetch}={}){
  if(!safeId(file.id))throw new DriveError('備份檔案編號不正確。','invalid');
  if(file.size!==undefined&&file.size>MAX_BACKUP_BYTES)throw new DriveError('此備份超過 50 MB，請改用較小的備份。','limit');
  const response=await request(session,API+'files/'+encodeURIComponent(file.id)+'?alt=media',{},options.signal,options.fetcher);
  const length=response.headers.get('Content-Length');if(length&&Number(length)>MAX_BACKUP_BYTES)throw new DriveError('備份超過 50 MB。','limit');
  const reader=response.body?.getReader();if(!reader)throw new DriveError('無法讀取 Google 備份。','invalid');
  const chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
  for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BACKUP_BYTES){await reader.cancel();throw new DriveError('備份超過 50 MB。','limit');}chunks.push(new Uint8Array(value));}
  return new Blob(chunks,{type:'application/json'});
}
