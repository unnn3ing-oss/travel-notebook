import { useState } from 'react';
import { DSheet } from '../design';
import { removeEntry } from '../lib/entryStore';

export function DeleteEntry({id,title,back,paired=false,label='刪除行程'}:{id:string;title:string;back:string;paired?:boolean;label?:string}) {
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function remove(){if(busy)return;setBusy(true);try{await removeEntry(id);location.hash=back;}catch{setError('沒能刪除，請再試一次。');setBusy(false);}}
 return <><button type="button" className="delete-filled" onClick={()=>setOpen(true)}>{label}</button>{open&&<DSheet title="確定刪除這個行程？" onClose={()=>!busy&&setOpen(false)}><p className="detail-confirm-text">「{title}」將從這台裝置移除。{paired?'入住、退房卡片及附件會一起刪除。':'相關路線及附件也會一起刪除。'}此操作無法復原。</p>{error&&<p className="error" role="alert">{error}</p>}<button type="button" className="delete-filled" disabled={busy} onClick={remove}>{busy?'刪除中…':'確定刪除'}</button><button type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>取消</button></DSheet>}</>;
}
