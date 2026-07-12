import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const directory=path.resolve('migrations');
const connectionString=process.env.DATABASE_URL??'postgres://ecommerce_core:password@localhost:5432/ecommerce_core_rfq';
const client=new pg.Client({connectionString});
await client.connect();
try{
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query(`CREATE TABLE schema_migrations(
    id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files=(await fs.readdir(directory)).filter((name)=>name.endsWith('.up.sql')).sort();
  for(const file of files){
    const sql=(await fs.readFile(path.join(directory,file),'utf8')).replace(/^\uFEFF/,'');
    await client.query('BEGIN');
    try{await client.query(sql);await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[file.replace('.up.sql','')]);await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}
  }
  console.log('Fresh schema created with',files.length,'migrations');
}finally{await client.end();}
