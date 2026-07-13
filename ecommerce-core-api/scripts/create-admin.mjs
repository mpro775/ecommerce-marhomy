import 'dotenv/config';
import pg from 'pg';
import argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const [email,fullName,password,roleName='owner']=process.argv.slice(2);
if(!email||!fullName||!password)throw new Error('Usage: npm run admin:create -- <email> <full-name> <password> [role]');

const client = new pg.Client({ connectionString });

await client.connect();
try{
  await client.query('BEGIN');const hash=await argon2.hash(password,{type:argon2.argon2id});
  const user=await client.query('INSERT INTO admin_users(email,full_name,password_hash) VALUES($1,$2,$3) RETURNING id',[email.toLowerCase(),fullName,hash]);
  const role=await client.query('SELECT id FROM roles WHERE name=$1',[roleName]);if(!role.rows[0])throw new Error('Role not found');
  await client.query('INSERT INTO admin_user_roles(admin_user_id,role_id) VALUES($1,$2)',[user.rows[0].id,role.rows[0].id]);
  await client.query('COMMIT');console.log('Admin user created:',email);
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
