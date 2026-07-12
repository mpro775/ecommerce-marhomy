const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(file)=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

test('refresh rotation locks the session row inside a transaction',()=>{
  const service=read('src/auth/auth.service.ts');
  const repository=read('src/auth/auth.repository.ts');
  assert.match(service,/database\.transaction/);
  assert.match(service,/findSession\(sessionId,client,true\)/);
  assert.match(repository,/FOR UPDATE/);
});

test('team updates protect the last owner and self deactivation',()=>{
  const service=read('src/team/team.service.ts');
  assert.match(service,/name='owner' FOR UPDATE/);
  assert.match(service,/last active owner/i);
  assert.match(service,/cannot deactivate your own account/i);
});

test('authentication exposes roles and keeps refresh tokens in an HttpOnly cookie',()=>{
  const types=read('src/auth/auth.types.ts');
  const controller=read('src/auth/auth.controller.ts');
  const guard=read('src/auth/access-token.guard.ts');
  assert.match(types,/roles:string\[\]/);
  assert.doesNotMatch(types,/role:string/);
  assert.match(guard,/array_agg\(DISTINCT r\.name\)/);
  assert.match(controller,/httpOnly:true/);
  assert.match(controller,/sameSite:'strict'/);
});

test('admin session stays in memory and nginx sends a CSP',()=>{
  const api=fs.readFileSync(path.resolve(__dirname,'..','..','ecommerce-core-admin','src','api.ts'),'utf8');
  const nginx=fs.readFileSync(path.resolve(__dirname,'..','..','ecommerce-core-admin','nginx.conf'),'utf8');
  assert.doesNotMatch(api,/localStorage\.setItem/);
  assert.match(api,/credentials:'include'/);
  assert.match(nginx,/Content-Security-Policy/);
});
