import {test,expect} from '@playwright/test';
test('Grafana provisions dashboard and live Prometheus/Loki datasources',async({page})=>{
 test.skip(!process.env.E2E_GRAFANA_URL||!process.env.E2E_GRAFANA_PASSWORD,'Set E2E_GRAFANA_URL and E2E_GRAFANA_PASSWORD');
 const base=process.env.E2E_GRAFANA_URL!;
 const login=await page.request.post(base+'/login',{data:{user:'admin',password:process.env.E2E_GRAFANA_PASSWORD}});expect(login.ok()).toBe(true);
 const dashboard=await page.request.get(base+'/api/dashboards/uid/cookshare-overview');expect(dashboard.ok()).toBe(true);expect((await dashboard.json()).dashboard.panels).toHaveLength(11);
 for(const uid of ['prometheus','loki']){const health=await page.request.get(base+`/api/datasources/uid/${uid}/health`);expect(health.ok()).toBe(true);expect((await health.json()).status).toBe('OK');}
 await page.goto(base+'/d/cookshare-overview');await expect(page.getByText('API availability',{exact:true})).toBeVisible();await expect(page.getByText('MySQL availability',{exact:true})).toBeVisible();await page.waitForTimeout(2000);await page.screenshot({path:'test-results/grafana-dashboard.png',fullPage:true});
});
