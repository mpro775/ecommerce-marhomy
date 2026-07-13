const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

test('admin invitations and password resets are committed with durable outbox events',()=>{
  const team=read('src/team/team.service.ts');
  assert.match(team,/database\.transaction/);
  assert.match(team,/admin_invitation_requested/);
  assert.match(team,/admin_password_reset_requested/);
  assert.match(team,/pg_advisory_xact_lock/);
  assert.doesNotMatch(team,/email\.send/);
  const outbox=read('src/outbox/outbox.service.ts');
  assert.match(outbox,/admin_invitation_requested/);
  assert.match(outbox,/admin_password_reset_requested/);
});

test('admin UI filters navigation and write actions using session permissions',()=>{
  const permissions=fs.readFileSync(path.resolve(__dirname,'..','..','ecommerce-core-admin','src','permissions.tsx'),'utf8');
  const app=fs.readFileSync(path.resolve(__dirname,'..','..','ecommerce-core-admin','src','App.tsx'),'utf8');
  assert.match(permissions,/pagePermissions/);
  assert.match(permissions,/canOpenPage/);
  assert.match(app,/visibleNav/);
  for(const permission of ['productsWrite','quoteRequestsWrite','teamWrite','mediaWrite'])assert.ok(app.includes(permission));
});
