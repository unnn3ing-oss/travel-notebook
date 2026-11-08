import {afterEach,expect,it,vi} from 'vitest';
import {authorizeDrive,configuredClientId,DRIVE_SCOPE,downloadDriveBackup,DriveError,listDriveBackups,uploadDriveBackup,validClientId} from './googleDrive';
import {DEFAULT_GOOGLE_CLIENT_ID} from './googleDriveConfig';
import {MAX_BACKUP_BYTES} from './backup';
const clientId='123456-demo.apps.googleusercontent.com',session={accessToken:'DEMO-ONLY-TOKEN',expiresAt:Date.now()+3600000};
const file={id:'demo-file',name:'旅行手帳備份-demo.json',createdTime:'2026-11-08T10:00:00Z',size:20};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it('requests only drive.file and creates a short-lived in-memory session after consent',async()=>{
 const api={initTokenClient:vi.fn(config=>({requestAccessToken:vi.fn(()=>config.callback({access_token:'DEMO-ONLY-TOKEN',expires_in:3600,scope:DRIVE_SCOPE}))}))};
 expect(validClientId(clientId)).toBe(true);expect(validClientId('secret')).toBe(false);
 const result=await authorizeDrive(api,clientId);expect(result.accessToken).toBe('DEMO-ONLY-TOKEN');expect(result.expiresAt).toBeGreaterThan(Date.now());expect(api.initTokenClient.mock.calls[0][0]).toMatchObject({client_id:clientId,scope:DRIVE_SCOPE,include_granted_scopes:false});
});
it('does not connect when consent is denied or the requested scope is missing',async()=>{
 const api={initTokenClient:vi.fn(config=>({requestAccessToken:vi.fn(()=>config.callback({error:'access_denied'}))}))};
 await expect(authorizeDrive(api,clientId)).rejects.toMatchObject({code:'cancelled'});
 await expect(authorizeDrive(api,'')).rejects.toMatchObject({code:'configuration'});
 const missing={initTokenClient:vi.fn(config=>({requestAccessToken:()=>config.callback({access_token:'DEMO',expires_in:3600,scope:'unrelated'})}))};
 await expect(authorizeDrive(missing,clientId)).rejects.toMatchObject({code:'auth'});
});
it('does not call Drive with an expired token',async()=>{
 const fetcher=vi.fn();await expect(listDriveBackups({...session,expiresAt:0},{fetcher})).rejects.toMatchObject({code:'auth'});expect(fetcher).not.toHaveBeenCalled();
});
it('uploads a fresh file using a validated resumable session and reports success only after final metadata',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=demo'}})).mockResolvedValueOnce(new Response(JSON.stringify(file)));
 const blob=new Blob(['{}'],{type:'application/json'});expect(await uploadDriveBackup(session,file.name,blob,{fetcher})).toEqual(file);
 const [start,put]=fetcher.mock.calls;expect(start[0]).toContain('uploadType=resumable');expect(start[1].method).toBe('POST');expect(JSON.parse(start[1].body).appProperties.app).toBe('travel-notebook');expect(start[1].body).not.toContain(session.accessToken);expect(put[1]).toMatchObject({method:'PUT',body:blob,headers:{Authorization:'Bearer '+session.accessToken}});
});
it('never forwards a token to an unexpected resumable upload host',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(null,{headers:{Location:'https://not-google.example/upload/drive/v3/files'}}));
 await expect(uploadDriveBackup(session,file.name,new Blob(['{}']),{fetcher})).rejects.toMatchObject({code:'invalid'});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('lists only marked App JSON backups and supports pagination without broad Drive scopes',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({files:[{...file,mimeType:'application/json',appProperties:{app:'travel-notebook'}},{...file,id:'foreign',mimeType:'application/json',appProperties:{app:'different-app'}}],nextPageToken:'next-demo'})));
 const result=await listDriveBackups(session,{fetcher,pageToken:'previous'});expect(result).toEqual({files:[file],nextPageToken:'next-demo'});
 const url=new URL(fetcher.mock.calls[0][0]);expect(url.searchParams.get('pageToken')).toBe('previous');expect(url.searchParams.get('q')).toContain("value='travel-notebook'");expect(fetcher.mock.calls[0][1]).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer'});
});
it('surfaces 401, 403 and network failures without returning a successful upload or backup list',async()=>{
 for(const[status,code]of[[401,'auth'],[403,'forbidden'],[503,'network']]as const)await expect(listDriveBackups(session,{fetcher:vi.fn().mockResolvedValue(new Response('',{status}))})).rejects.toMatchObject({code});
 await expect(uploadDriveBackup(session,file.name,new Blob(['{}']),{fetcher:vi.fn().mockRejectedValue(new TypeError('offline'))})).rejects.toBeInstanceOf(DriveError);
});
it('downloads bytes only from the fixed Drive endpoint and rejects path injection or oversized files',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('{"format":"travel-notebook"}'));
 const result=await downloadDriveBackup(session,file,{fetcher});expect(await result.text()).toBe('{"format":"travel-notebook"}');expect(fetcher.mock.calls[0][0]).toBe('https://www.googleapis.com/drive/v3/files/demo-file?alt=media');
 const none=vi.fn();await expect(downloadDriveBackup(session,{...file,id:'../bad'},{fetcher:none})).rejects.toMatchObject({code:'invalid'});await expect(downloadDriveBackup(session,{...file,size:MAX_BACKUP_BYTES+1},{fetcher:none})).rejects.toMatchObject({code:'limit'});expect(none).not.toHaveBeenCalled();
 const tooLarge=new Blob(['demo']);Object.defineProperty(tooLarge,'size',{value:MAX_BACKUP_BYTES+1});await expect(uploadDriveBackup(session,file.name,tooLarge,{fetcher:none})).rejects.toMatchObject({code:'limit'});
});

it('uses the public site client ID by default and supports an explicit disable or override',()=>{
 vi.stubEnv('VITE_GOOGLE_CLIENT_ID',undefined);expect(configuredClientId()).toBe(DEFAULT_GOOGLE_CLIENT_ID);
 vi.stubEnv('VITE_GOOGLE_CLIENT_ID','');expect(configuredClientId()).toBe('');
 vi.stubEnv('VITE_GOOGLE_CLIENT_ID',clientId);expect(configuredClientId()).toBe(clientId);
});
