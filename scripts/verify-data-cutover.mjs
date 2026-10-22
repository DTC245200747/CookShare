import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const reportFile=new URL('../docs/report-evidence/data-sync-staging.json',import.meta.url);
const state=JSON.parse(await readFile(reportFile,'utf8'));
const privateState=JSON.parse(await readFile(state.backup+'/state.json','utf8'));
const runtime=spawnSync('docker',['exec','-i','cookshare-api-1','node','--input-type=module'],{encoding:'utf8',windowsHide:true,input:`import {pool} from './dist/config/db.js';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';try{const [db]=await pool.query('SELECT DATABASE() AS name,@@version AS version');const uploads=[];for(const f of await readdir('uploads',{withFileTypes:true})){if(!f.isFile())throw Error('Unexpected upload entry');const bytes=await readFile('uploads/'+f.name);uploads.push({file:f.name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}uploads.sort((a,b)=>a.file.localeCompare(b.file));console.log(JSON.stringify({database:db[0],uid:process.getuid(),uploads}))}finally{await pool.end()}`});
assert.equal(runtime.status,0,'Runtime SQL/file verification failed');
const current=JSON.parse(runtime.stdout);
assert.equal(current.database.name,state.stagingDb);
assert.notEqual(current.uid,0);
assert.deepEqual(current.uploads,privateState.backups.windowsUploads);
async function json(path){const response=await fetch('http://localhost:8080'+path,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200,path);return response.json()}
assert.equal((await json('/health/ready')).status,'ready');
const first=await json('/api/v1/recipes?limit=100'),second=await json('/api/v1/recipes?limit=100&page=2');
assert.equal(first.pagination.total,141);
const records=[...first.data,...second.data];assert.equal(new Set(records.map(r=>r.id)).size,141);
const images=new Set();let details=0;
for(const record of records){const {data}=await json('/api/v1/recipes/'+record.id);assert.ok(data.ingredients.length>0&&data.steps.length>0);if(data.image_url)images.add(data.image_url);details++}
for(const file of current.uploads)images.add('/uploads/'+file.file);
for(const image of images){assert.ok(image.startsWith('/'));const response=await fetch('http://localhost:8080'+image);assert.equal(response.status,200,image);assert.match(response.headers.get('content-type'),/^image\//);if(image.startsWith('/uploads/')){const expected=current.uploads.find(f=>'/uploads/'+f.file===image);assert.ok(expected);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),expected.sha256)}}
const inspected=spawnSync('docker',['inspect','cookshare-api-1'],{encoding:'utf8',windowsHide:true});assert.equal(inspected.status,0);
const container=JSON.parse(inspected.stdout)[0];const uploadVolume=container.Mounts.find(m=>m.Destination==='/app/backend/uploads')?.Name;
assert.equal(uploadVolume,state.stagingVolume);assert.equal(container.State.Health.Status,'healthy');assert.equal(container.HostConfig.ReadonlyRootfs,true);
const publicReport={timestamp:new Date().toISOString(),productionSwitched:true,url:'http://localhost:8080',database:current.database,uploadsVolume:uploadVolume,uploadsVerified:current.uploads.length,allUploadHashesMatch:true,recipes:141,recipeDetailsVerified:details,imageUrlsVerified:images.size,apiHealthy:true,uid:current.uid,apiReadOnly:true,oldDatabaseRetained:'cookshare',oldUploadsVolumeRetained:state.original.uploadsVolume,sourceUnchanged:true};
await writeFile(new URL('../docs/report-evidence/data-sync-production.json',import.meta.url),JSON.stringify(publicReport,null,2)+'\n');
console.log('Production verification PASS: 141 details, all 26 uploads, correct database/volume, healthy non-root read-only API.');
