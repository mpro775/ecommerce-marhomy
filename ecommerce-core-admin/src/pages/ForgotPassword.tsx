import { useState, type FormEvent } from 'react';
import { api } from '../api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
      setDone(true); }
    catch (value) { setError((value as Error).message); } finally { setBusy(false); }
  };
  if (done) return <main className="login-page" dir="rtl"><div className="login-card"><div className="success" style={{color: '#047857', background: '#d1fae5', padding: 12, borderRadius: 6}}>تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.</div><div style={{marginTop: 16, textAlign: 'center'}}><a href="/" style={{color: 'var(--primary, #007bff)', textDecoration: 'none'}}>العودة لتسجيل الدخول</a></div></div></main>;
  return <main className="login-page" dir="rtl"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark">RFQ</div><h1>نسيت كلمة المرور؟</h1><p className="muted">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيينها.</p>
    {error && <div className="error">{error}</div>}
    <div className="field"><label>البريد الإلكتروني</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
    <button className="button" disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال رابط الاستعادة'}</button>
    <div style={{marginTop: 16, textAlign: 'center'}}><a href="/" style={{color: 'var(--primary, #007bff)', textDecoration: 'none', fontSize: 14}}>العودة لتسجيل الدخول</a></div>
  </form></main>;
}
