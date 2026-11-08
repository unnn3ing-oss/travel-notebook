import { useEffect, useRef, useState } from 'react';
import { DSheet } from '../design';
import { BackupError, createBackup, prepareBackup, restoreBackup, type PreparedBackup } from '../lib/backup';
import { authorizeDrive, configuredClientId, downloadDriveBackup, DriveError, listDriveBackups, loadGoogleIdentity, uploadDriveBackup, type DriveFile, type DriveSession } from '../lib/googleDrive';

type GoogleAPI = Awaited<ReturnType<typeof loadGoogleIdentity>>;
const readLast=()=>{try{return localStorage.getItem('travel-last-drive-backup')||'';}catch{return '';}};
const stamp=(value:string)=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('zh-TW',{hour12:false}):'時間未提供';};
const size=(bytes?:number)=>bytes===undefined?'大小未提供':bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.ceil(bytes/1024)} KB`;
function download(name:string,blob:Blob){const url=URL.createObjectURL(blob);Object.assign(document.createElement('a'),{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function GoogleDriveBackup({onBackup}:{onBackup?:(at:string)=>void}){
  const clientId=configuredClientId();
  const [api,setAPI]=useState<GoogleAPI>(),[sdkError,setSDKError]=useState(''),[retry,setRetry]=useState(0);
  const [session,setSession]=useState<DriveSession>(),[files,setFiles]=useState<DriveFile[]>([]),[pageToken,setPageToken]=useState<string>();
  const [listState,setListState]=useState<'idle'|'loading'|'success'|'error'>('idle');
  const [busy,setBusy]=useState(''),[note,setNote]=useState(''),[last,setLast]=useState(readLast);
  const [pending,setPending]=useState<{file:DriveFile;backup:PreparedBackup}>();
  const operation=useRef<AbortController|null>(null),mounted=useRef(true),working=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort();};},[]);
  useEffect(()=>{
    if(!clientId)return;let active=true;setSDKError('');
    loadGoogleIdentity().then(value=>{if(active)setAPI(value);},()=>{if(active)setSDKError('Google 連線元件未能載入，請確認網路後重試。');});
    return()=>{active=false;};
  },[clientId,retry]);
  useEffect(()=>{
    if(!session)return;const timer=setTimeout(()=>{operation.current?.abort();working.current=false;setBusy('');setSession(undefined);setFiles([]);setListState('idle');setPageToken(undefined);setPending(undefined);setNote('Google 連線已到期，請重新連接。');},Math.max(0,session.expiresAt-Date.now()));return()=>clearTimeout(timer);
  },[session]);
  async function run(label:string,task:(signal:AbortSignal)=>Promise<void>){
    if(working.current)return;working.current=true;operation.current?.abort();const controller=new AbortController();operation.current=controller;setBusy(label);setNote('');
    try{await task(controller.signal);}catch(error){if(mounted.current&&!controller.signal.aborted){if(error instanceof DriveError&&error.code==='auth'){setSession(undefined);setFiles([]);setListState('idle');setPageToken(undefined);setPending(undefined);}setNote(error instanceof DriveError||error instanceof BackupError?error.message:'備份操作未完成，請確認檔案或網路後重試；本機資料尚未變更。');}}
    finally{if(mounted.current&&operation.current===controller){working.current=false;setBusy('');}}
  }
  async function list(s:DriveSession,signal:AbortSignal,append=false){
    setListState('loading');
    try{const result=await listDriveBackups(s,{signal,pageToken:append?pageToken:undefined});if(!signal.aborted&&mounted.current){setFiles(old=>append?[...old,...result.files.filter(f=>!old.some(o=>o.id===f.id))]:result.files);setPageToken(result.nextPageToken);setListState('success');}}
    catch(error){if(!signal.aborted&&mounted.current)setListState('error');throw error;}
  }
  function disconnect(){operation.current?.abort();working.current=false;setBusy('');setSession(undefined);setFiles([]);setListState('idle');setPageToken(undefined);setPending(undefined);setNote('已中斷此頁連線；Google 備份與本機資料都保留。');}
  return <section className="drive-backup" aria-labelledby="drive-h">
    <div className="drive-heading"><h2 id="drive-h">Google Drive 備份</h2><span className="drive-state">{session?'已連接':clientId?'尚未連接':'尚未啟用'}</span></div>
    <p>手動保存一份完整備份，包含行程、筆記與附件；可在另一台裝置連接同一帳號後下載或還原。</p>
    {!clientId?<p className="drive-notice">Google Drive 連線尚未啟用。啟用前仍可使用上方「備份成檔案」。</p>:<>
      {!session?<><button className="btn primary" disabled={!api||!!busy} onClick={()=>api&&run('連接中…',async signal=>{const next=await authorizeDrive(api,clientId);if(signal.aborted||!mounted.current)return;setSession(next);await list(next,signal);})}>{busy||(!api&&!sdkError?'載入 Google 連線…':'連接 Google Drive')}</button>{sdkError&&<><p role="status" className="drive-error">{sdkError}</p><button className="btn" onClick={()=>setRetry(n=>n+1)}>重試載入</button></>}</>:<>
        <div className="drive-buttons"><button className="btn primary" disabled={!!busy} onClick={()=>run('上傳中…',async signal=>{
          const backup=await createBackup();if(signal.aborted)return;
          let file:DriveFile;try{file=await uploadDriveBackup(session,backup.name,backup.blob,{signal});}catch(error){if(error instanceof DriveError&&error.code!=='auth'&&error.code!=='forbidden'&&error.code!=='limit')throw new DriveError('尚未確認上傳結果，請重新整理備份清單查核後再試。',error.code);throw error;}
          if(signal.aborted||!mounted.current)return;setLast(file.createdTime);onBackup?.(file.createdTime);try{localStorage.setItem('travel-last-drive-backup',file.createdTime);}catch{/* Upload succeeded even if local metadata cannot persist. */}
          setFiles(old=>[file,...old.filter(f=>f.id!==file.id)]);setNote('已備份到 Google Drive，包含附件。');
        })}>備份到 Google Drive</button><button className="btn" disabled={!!busy} onClick={()=>run('讀取清單中…',signal=>list(session,signal))}>重新整理清單</button></div>
        <button className="drive-disconnect" onClick={disconnect}>中斷此頁連線</button>
        <h3>可用備份</h3>
        {!files.length&&!busy&&listState==='success'&&<p>此帳號還沒有這個 App 建立的備份。</p>}
        {!files.length&&!busy&&listState==='error'&&<p>備份清單尚未讀取成功，無法確認是否有備份。請依下方提示處理後重新整理清單。</p>}
        <ul className="drive-files">{files.map(file=><li key={file.id}><b>{file.name}</b><small>{stamp(file.createdTime)}・{size(file.size)}</small><div className="drive-buttons"><button className="btn" disabled={!!busy} aria-label={'下載 '+file.name} onClick={()=>run('下載中…',async signal=>{const blob=await downloadDriveBackup(session,file,{signal});prepareBackup(await blob.text());if(!signal.aborted){download(file.name,blob);setNote('已下載備份檔，包含附件。');}})}>下載</button><button className="btn" disabled={!!busy} aria-label={'還原 '+file.name} onClick={()=>run('檢查備份中…',async signal=>{const blob=await downloadDriveBackup(session,file,{signal});const backup=prepareBackup(await blob.text());if(!signal.aborted)setPending({file,backup});})}>還原</button></div></li>)}</ul>
        {pageToken&&<button className="btn" disabled={!!busy} onClick={()=>run('讀取清單中…',signal=>list(session,signal,true))}>載入更多備份</button>}
      </>}
    </>}
    {busy&&session&&<p role="status">{busy}</p>}
    {note&&<p role="status" className="drive-notice">{note}</p>}
    {last&&<p className="drive-last">上次成功上傳：{stamp(last)}</p>}
    <p className="drive-footnote">只存取此 App 建立的備份；不會自動同步或合併裝置資料。還原會取代本機全部資料，確認前不會寫入。單份備份上限 50 MB。</p>
    {pending&&<DSheet title="用 Google 備份還原？" onClose={()=>{if(!busy)setPending(undefined);}}>
      <p className="drive-restore-name">{pending.file.name}</p><p>{stamp(pending.file.createdTime)}<br/>{pending.backup.summary.trips} 趟旅程、{pending.backup.summary.items} 張卡片、{pending.backup.summary.documents} 份附件。</p>
      <p>目前這台裝置的全部旅程與附件會被這份備份取代。建議先保留一份目前的檔案備份。</p>
      <div className="drive-buttons"><button className="btn" disabled={!!busy} onClick={()=>setPending(undefined)}>取消</button><button className="btn danger" disabled={!!busy} onClick={()=>run('還原中…',async()=>{await restoreBackup(pending.backup);setPending(undefined);setNote('已用 Google 備份還原。');location.hash='#/';})}>確認還原</button></div>
    </DSheet>}
  </section>;
}
