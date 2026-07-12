import { useState, type FormEvent } from 'react';
import { api, setSession, type Session } from '../api';

export function Login({onLogin}:{onLogin:(session:Session)=>void}){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{const next=await api<Session>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    setSession(next);onLogin(next);}catch(value){setError((value as Error).message);}finally{setBusy(false);}};
  return <main className="login-page" dir="rtl"><form className="login-card" onSubmit={submit}><div className="brand-mark">RFQ</div>
    <h1>لوحة إدارة الكتالوج</h1><p className="muted">تسجيل دخول الفريق لإدارة طلبات عروض الأسعار.</p>{error&&<div className="error">{error}</div>}
    <div className="field"><label>البريد الإلكتروني</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
    <div className="field"><label>كلمة المرور</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>
    <button className="button" disabled={busy}>{busy?'جارٍ الدخول…':'تسجيل الدخول'}</button>
    <div style={{marginTop: 16, textAlign: 'center'}}><a href="/forgot-password" style={{color: 'var(--primary, #007bff)', textDecoration: 'none', fontSize: 14}}>نسيت كلمة المرور؟</a></div>
    </form></main>;
}
