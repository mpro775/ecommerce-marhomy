import { useState, type FormEvent } from 'react';
import { api } from '../api';

export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) });
      setDone(true); setTimeout(() => window.location.href = '/', 2000); }
    catch (value) { setError((value as Error).message); } finally { setBusy(false); }
  };
  if (done) return <main className="login-page" dir="rtl"><div className="login-card"><div className="success" style={{color: '#047857', background: '#d1fae5', padding: 12, borderRadius: 6}}>تم إعادة تعيين كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول...</div></div></main>;
  return <main className="login-page" dir="rtl"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark">RFQ</div><h1>إعادة تعيين كلمة المرور</h1><p className="muted">أدخل كلمة المرور الجديدة لحسابك (10 أحرف على الأقل).</p>
    {error && <div className="error">{error}</div>}
    <div className="field"><label>كلمة المرور الجديدة</label><input type="password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></div>
    <button className="button" disabled={busy || !token}>{busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button>
    {!token && <div className="error" style={{marginTop: 10}}>رابط الاستعادة غير صالح أو مفقود.</div>}
  </form></main>;
}
