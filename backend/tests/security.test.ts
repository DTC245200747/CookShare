import {afterAll,describe,it,expect} from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
process.env.DB_PASSWORD??='test-password';
process.env.JWT_SECRET??='test-only-secret-with-at-least-32-characters';
const {app}=await import('../src/app.js');
const {pool}=await import('../src/config/db.js');
describe('Security boundaries',()=>{
 it('rejects expired JWT and wrong audience before querying a user',async()=>{
  for(const payload of [{sub:'1',iss:'cookshare',aud:'cookshare-api',exp:1},{sub:'1',iss:'cookshare',aud:'another-app',exp:Math.floor(Date.now()/1000)+3600}]){
   const token=jwt.sign(payload,process.env.JWT_SECRET!);
   const response=await request(app).get('/api/v1/auth/me').auth(token,{type:'bearer'});
   expect(response.status).toBe(401);expect(response.body).not.toHaveProperty('stack');
  }
 });
 it('rejects passwords exceeding bcrypt UTF-8 byte limit',async()=>{const response=await request(app).post('/api/v1/auth/register').send({name:'UTF8',email:'utf8@example.test',password:'🔥'.repeat(19)});expect(response.status).toBe(400);});
 it('enforces payload size and security headers',async()=>{expect((await request(app).post('/api/v1/auth/register').send({padding:'x'.repeat(110000)})).status).toBe(413);const r=await request(app).get('/health/live').set('Origin','https://untrusted.example');expect(r.headers['x-content-type-options']).toBe('nosniff');expect(r.headers['content-security-policy']).toContain("default-src 'self'");expect(r.headers['access-control-allow-origin']).not.toBe('https://untrusted.example');expect(r.headers['x-powered-by']).toBeUndefined();});
 it('does not allow SQL fragments as IDs or order expressions',async()=>{expect((await request(app).get('/api/v1/recipes').query({category_id:'1 OR 1=1'})).status).toBe(400);expect((await request(app).get('/api/v1/recipes').query({sort:'id; DROP TABLE users'})).status).toBe(400);});
 it('auth attempts are rate limited',async()=>{let last=0;for(let i=0;i<31;i++)last=(await request(app).post('/api/v1/auth/login').send({})).status;expect(last).toBe(429);});
});
afterAll(async()=>{await pool.end()});
