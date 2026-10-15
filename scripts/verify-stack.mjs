// Run with Node 22 after `docker compose ... up -d --build`.
const web=process.env.WEB_URL||'http://localhost:8080';
const prometheus=process.env.PROMETHEUS_URL||'http://localhost:9090';
const grafana=process.env.GRAFANA_URL||'http://localhost:3001';
const loki=process.env.LOKI_URL||'http://localhost:3100';
async function fetchOk(url,options){const response=await fetch(url,options);if(!response.ok)throw Error(`${url}: HTTP ${response.status}`);return response;}
async function waitFor(name,check){let last;for(let i=0;i<30;i++){try{await check();console.log(`PASS ${name}`);return;}catch(e){last=e;await new Promise(resolve=>setTimeout(resolve,2000));}}throw last;}
await waitFor('web and MySQL',async()=>{const html=await (await fetchOk(web)).text();if(!html.includes('CookShare'))throw Error('Frontend not served');const ready=await (await fetchOk(web+'/health/ready')).json();if(ready.status!=='ready')throw Error('DB unavailable');});
for(let i=0;i<10;i++)await fetchOk(web+'/api/v1/recipes?limit=1');
await waitFor('Prometheus targets',async()=>{const targets=await (await fetchOk(prometheus+'/api/v1/targets')).json();for(const job of ['cookshare-api','mysql','containers']){if(!targets.data.activeTargets.some(t=>t.labels.job===job&&t.health==='up'))throw Error(`Target down: ${job}`);}});
for(const query of ['cookshare_http_requests_total','mysql_up','container_memory_working_set_bytes'])await waitFor(query,async()=>{const r=await(await fetchOk(prometheus+'/api/v1/query?query='+encodeURIComponent(query))).json();if(!r.data.result.length)throw Error('No samples: '+query);});
await waitFor('Grafana',()=>fetchOk(grafana+'/api/health'));
if(!process.env.GRAFANA_ADMIN_PASSWORD)throw Error('Set GRAFANA_ADMIN_PASSWORD to verify provisioned dashboard and data sources');
const headers={Authorization:'Basic '+Buffer.from('admin:'+process.env.GRAFANA_ADMIN_PASSWORD).toString('base64')};
await fetchOk(grafana+'/api/dashboards/uid/cookshare-overview',{headers});
for(const uid of ['prometheus','loki'])await fetchOk(grafana+`/api/datasources/uid/${uid}/health`,{headers});
await waitFor('Loki logs',async()=>{const query='{job="cookshare",service="api"}';const r=await(await fetchOk(loki+'/loki/api/v1/query_range?query='+encodeURIComponent(query)+'&limit=5')).json();if(!r.data.result.length)throw Error('No application logs received');});
console.log('All stack checks passed.');
