import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.E2E_CHROME==='1'?'chrome':undefined});
try{
 const page=await browser.newPage();
 await page.goto(new URL('../docs/report.html',import.meta.url).href,{waitUntil:'load'});
 await page.emulateMedia({media:'print'});
 const layout=await page.evaluate(()=>({pages:document.querySelectorAll('.page').length,overflow:[...document.querySelectorAll('.page')].some(p=>p.scrollHeight>p.clientHeight),images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
 if(layout.pages!==10||layout.overflow||!layout.images)throw Error('Report layout/images failed: '+JSON.stringify(layout));
 const pdf=await page.pdf({path:fileURLToPath(new URL('../docs/CookShare-report.pdf',import.meta.url)),preferCSSPageSize:true,printBackground:true});
 const count=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 if(count!==10)throw Error(`Expected 10 PDF pages, got ${count}`);
 console.log('Report exported: 10 A4 pages, no content overflow, all images loaded.');
}finally{await browser.close()}
