import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, download, restoreSession, setSession, type Session } from './api';
import { brandConfig } from './config/brand.config';
import { Login } from './pages/Login';
import { AcceptInvite } from './pages/AcceptInvite';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { ImportProducts, ProductEditor } from './pages/ProductEditor';
import { CatalogManager } from './pages/CatalogManager';
type Row=Record<string,any>;
const statusLabels:Record<string,string>={new:'جديد',in_review:'قيد المراجعة',contacted:'تم التواصل',quote_sent:'أرسل العرض',
  accepted:'مقبول',rejected:'مرفوض',cancelled:'ملغي',closed:'مغلق'};
const units:Record<string,string>={piece:'قطعة',box:'صندوق',carton:'كرتون',meter:'متر',kilogram:'كيلوجرام',gram:'جرام',liter:'لتر',set:'طقم',roll:'لفة',pack:'عبوة'};
function useRemote<T>(path:string,initial:T){
  const[data,setData]=useState<T>(initial),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await api<T>(path));}catch(value){setError((value as Error).message);}finally{setLoading(false);}},[path]);
  useEffect(()=>{void load();},[load]);return{data,loading,error,load,setData};
}
function Page({title,description,action,children}:{title:string;description?:string;action?:ReactNode;children:ReactNode}){
  return <><div className="page-head"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>{children}</>;
}
function Empty({loading,label='لا توجد بيانات'}:{loading?:boolean;label?:string}){return <div className="empty">{loading?'جارٍ التحميل…':label}</div>;}
const nav:Array<{label:string;items:Array<[string,string]>}>=[
  {label:'العمل',items:[['dashboard','لوحة المعلومات'],['requests','طلبات عروض الأسعار'],['requests:new','الطلبات الجديدة'],['contacts','جهات الاتصال'],['notifications','الإشعارات']]},
  {label:'الكتالوج',items:[['products','المنتجات'],['categories','التصنيفات'],['brands','العلامات التجارية'],['attributes','الخصائص'],['filters','الفلاتر'],['media','الوسائط']]},
  {label:'الإدارة',items:[['team','الفريق والأدوار'],['reports','التقارير'],['audit','سجل العمليات']]},
];
export function App(){
  const[sessionState,setSessionState]=useState<Session|null>(()=>restoreSession()),[page,setPage]=useState('dashboard');
  const path = window.location.pathname;
  if(path === '/accept-invite') return <AcceptInvite />;
  if(path === '/reset-password') return <ResetPassword />;
  if(path === '/forgot-password') return <ForgotPassword />;
  if(!sessionState)return <Login onLogin={setSessionState}/>;
  const user=sessionState.user;
  const logout=async()=>{try{await api('/auth/logout',{method:'POST'});}finally{setSession(null);setSessionState(null);}};
  return <div className="app" dir="rtl"><aside className="sidebar"><div className="brand"><div className="brand-mark">RFQ</div>
    <div><strong>{brandConfig.name}</strong><small>إدارة الكتالوج والطلبات</small></div></div>
    {nav.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([key,label])=>
      <button key={key} className={'nav-button '+(page===key?'active':'')} onClick={()=>setPage(key)}>{label}</button>)}</div>)}</aside>
    <main className="main"><header className="topbar"><div><strong>{user.fullName}</strong><span className="muted"> · {user.role}</span></div>
      <button className="button secondary small" onClick={()=>void logout()}>تسجيل الخروج</button></header>
      <section className="content"><Router page={page}/></section></main></div>;
}
function Router({page}:{page:string}){
  if(page==='dashboard')return <Dashboard/>;
  if(page==='products')return <Products/>;
  if(['categories','brands','attributes','filters'].includes(page))return <CatalogManager kind={page}/>;
  if(page==='requests'||page.startsWith('requests:'))return <Requests initialStatus={page.split(':')[1]??''}/>;
  if(page==='contacts')return <Contacts/>;
  if(page==='notifications')return <Notifications/>;
  if(page==='team')return <Team/>;
  if(page==='media')return <Media/>;
  if(page==='reports')return <Reports/>;
  if(page==='audit')return <Audit/>;
  return <Dashboard/>;
}
function Dashboard(){
  const{data,error,loading}=useRemote<Row>('/admin/analytics/dashboard',{});
  const statuses=Object.fromEntries((data.statusCounts??[]).map((row:Row)=>[row.status,row.count]));
  return <Page title="لوحة المعلومات" description="مؤشرات طلبات عروض الأسعار وحركة الكتالوج.">{error&&<div className="error">{error}</div>}
    <div className="cards">{[['الطلبات الجديدة',statuses.new??0],['قيد المراجعة',statuses.in_review??0],['تم التواصل',statuses.contacted??0],
      ['أُرسل العرض',statuses.quote_sent??0],['جهات الاتصال',data.contactCount??0],['تحويل السلة',(data.cartConversionRate??0)+'%']].map(([label,value])=>
      <div className="card metric" key={String(label)}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div>
    {loading?<Empty loading/>:<div className="grid-two"><MetricTable title="المنتجات الأكثر طلبًا" rows={data.topProducts??[]}/>
      <MetricTable title="الطلبات حسب المدينة" rows={data.byCity??[]}/><MetricTable title="التصنيفات الأكثر طلبًا" rows={data.topCategories??[]}/>
      <MetricTable title="الطلبات حسب الموظف" rows={data.byAgent??[]}/></div>}</Page>;
}
function MetricTable({title,rows}:{title:string;rows:Row[]}){return <div className="panel"><h3>{title}</h3>{rows.length?rows.map((row,index)=>
  <div key={index} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #edf2f3'}}><span>{row.label}</span><strong>{row.request_count}</strong></div>):<Empty/>}</div>;}
function Products(){
  const{data,error,loading,load}=useRemote<{items:Row[];count:number}>('/admin/products',{items:[],count:0});
  const[editing,setEditing]=useState<Row|null>(null),[importing,setImporting]=useState(false);
  return <Page title="المنتجات" description="منتجات كتالوج بمواصفات ووحدات قياس دون أي حقول مالية."
    action={<div className="toolbar"><button className="button secondary" onClick={()=>setImporting(true)}>استيراد Excel</button><button className="button" onClick={()=>setEditing({})}>إضافة منتج</button></div>}>{error&&<div className="error">{error}</div>}
    <div className="table-wrap">{loading?<Empty loading/>:<table><thead><tr><th>المنتج</th><th>SKU</th><th>الحالة</th><th>التوفر</th><th>الوحدة</th><th></th></tr></thead>
      <tbody>{data.items.map(row=><tr key={row.id}><td><strong>{row.title_ar}</strong><div className="muted">{row.title_en}</div></td><td>{row.sku||'—'}</td>
        <td><span className="badge">{row.status}</span></td><td>{row.availability_status}</td><td>{units[row.unit_of_measure]??row.unit_of_measure}</td>
        <td><button className="button secondary small" onClick={()=>void api<Row>('/admin/products/'+row.id).then(setEditing)}>تعديل</button></td></tr>)}</tbody></table>}</div>
    {editing&&<ProductEditor product={editing} close={()=>setEditing(null)} saved={async()=>{setEditing(null);await load();}}/>}
    {importing&&<ImportProducts close={()=>setImporting(false)} done={load}/>}</Page>;
}
function Field({label,value,onChange,required,type='text',step}:{label:string;value:any;onChange:(value:string)=>void;required?:boolean;type?:string;step?:string}){
  return <label className="field"><span>{label}</span><input type={type} step={step} required={required} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
function Requests({initialStatus}:{initialStatus:string}){
  const[status,setStatus]=useState(initialStatus),[search,setSearch]=useState(''),[selected,setSelected]=useState<Row|null>(null);
  const path='/admin/quote-requests?'+new URLSearchParams({...status&&{status},...search&&{search}});const{data,error,loading,load}=useRemote<{items:Row[];count:number}>(path,{items:[],count:0});
  return <Page title="طلبات عروض الأسعار" description={'عدد النتائج: '+data.count}>{error&&<div className="error">{error}</div>}<div className="toolbar">
    <input placeholder="بحث برقم الطلب أو الهاتف" value={search} onChange={e=>setSearch(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="">كل الحالات</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
    <div className="table-wrap">{loading?<Empty loading/>:<table><thead><tr><th>رقم الطلب</th><th>جهة الاتصال</th><th>العناصر</th><th>الحالة</th><th>الموظف</th><th>التاريخ</th></tr></thead>
      <tbody>{data.items.map(row=><tr key={row.id} onClick={()=>setSelected(row)} style={{cursor:'pointer'}}><td><strong>{row.request_number}</strong></td>
        <td>{row.full_name}<div className="muted">{row.phone}</div></td><td>{row.item_count}</td><td><span className={'badge '+row.status}>{statusLabels[row.status]??row.status}</span></td>
        <td>{row.assignee_name??'غير معين'}</td><td>{new Date(row.created_at).toLocaleString('ar')}</td></tr>)}</tbody></table>}</div>
    {selected&&<RequestDialog id={selected.id} close={()=>setSelected(null)} changed={load}/>}</Page>;
}
function RequestDialog({id,close,changed}:{id:string;close:()=>void;changed:()=>Promise<void>}){
  const{data,error,loading,load}=useRemote<Row>('/admin/quote-requests/'+id,{});const[users,setUsers]=useState<Row[]>([]),[note,setNote]=useState('');
  useEffect(()=>{api<Row[]>('/admin/team/users').then(setUsers).catch(()=>setUsers([]));},[]);
  const setStatus=async(status:string)=>{await api('/admin/quote-requests/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});await load();await changed();};
  const assign=async(adminUserId:string)=>{await api('/admin/quote-requests/'+id+'/assignee',{method:'PATCH',body:JSON.stringify({adminUserId:adminUserId||undefined})});await load();await changed();};
  const addNote=async()=>{if(!note.trim())return;await api('/admin/quote-requests/'+id+'/notes',{method:'POST',body:JSON.stringify({content:note})});setNote('');await load();};
  return <div className="dialog-backdrop"><div className="dialog"><div className="dialog-head"><h2>{data.request_number??'تفاصيل الطلب'}</h2><button className="close" onClick={close}>×</button></div>
    {error&&<div className="error">{error}</div>}{loading?<Empty loading/>:<><div className="cards"><div className="card"><span className="muted">الحالة</span><h3>{statusLabels[data.status]}</h3></div>
      <div className="card"><span className="muted">جهة الاتصال</span><h3>{data.full_name}</h3><div>{data.phone}</div></div><div className="card"><span className="muted">المدينة</span><h3>{data.city||'—'}</h3></div></div>
      <div className="toolbar"><select value={data.status} onChange={e=>void setStatus(e.target.value)}>{[data.status,...(data.allowedTransitions??[])].map((key:string)=><option key={key} value={key}>{statusLabels[key]??key}</option>)}</select>
        <select value={data.assigned_to_admin_user_id??''} onChange={e=>void assign(e.target.value)}><option value="">غير معين</option>{users.map(user=><option key={user.id} value={user.id}>{user.full_name}</option>)}</select></div>
      <div className="grid-two"><div className="panel"><h3>العناصر وقت الإرسال</h3><div className="request-items">{(data.items??[]).map((item:Row)=><div className="request-item" key={item.id}>
        {item.image_url_snapshot&&<img src={item.image_url_snapshot} alt=""/>}<div><strong>{item.product_title_snapshot}</strong><div>{item.variant_title_snapshot}</div>
        <div>{item.quantity} {units[item.unit_snapshot]??item.unit_snapshot}</div>{item.item_note&&<small>{item.item_note}</small>}</div></div>)}</div></div>
        <div><div className="panel"><h3>ملاحظة داخلية</h3><textarea rows={3} style={{width:'100%'}} value={note} onChange={e=>setNote(e.target.value)}/><button className="button small" onClick={()=>void addNote()}>إضافة</button>
          {(data.notes??[]).map((item:Row)=><p key={item.id}><strong>{item.admin_name}</strong>: {item.content}</p>)}</div>
          <div className="panel"><h3>سجل الحالات</h3><div className="timeline">{(data.history??[]).map((item:Row)=><div className="timeline-item" key={item.id}>
            <strong>{statusLabels[item.new_status]??item.new_status}</strong><div className="muted">{new Date(item.created_at).toLocaleString('ar')}</div></div>)}</div></div></div></div></>}</div></div>;
}
function Contacts(){
  const[search,setSearch]=useState(''),[selected,setSelected]=useState<Row|null>(null);const{data,error,loading}=useRemote<Row[]>('/admin/contacts?search='+encodeURIComponent(search),[]);
  return <Page title="جهات الاتصال"><div className="toolbar"><input placeholder="بحث" value={search} onChange={e=>setSearch(e.target.value)}/></div>{error&&<div className="error">{error}</div>}
    <div className="table-wrap">{loading?<Empty loading/>:<table><thead><tr><th>الاسم</th><th>الهاتف</th><th>الشركة</th><th>المدينة</th><th>عدد الطلبات</th><th>آخر طلب</th></tr></thead>
      <tbody>{data.map(row=><tr key={row.id} style={{cursor:'pointer'}} onClick={()=>setSelected(row)}><td>{row.full_name}</td><td>{row.phone}</td><td>{row.company_name||'—'}</td><td>{row.city||'—'}</td><td>{row.request_count}</td>
        <td>{row.last_request_at?new Date(row.last_request_at).toLocaleDateString('ar'):'—'}</td></tr>)}</tbody></table>}</div>
    {selected&&<ContactDialog id={selected.id} close={()=>setSelected(null)}/>}</Page>;
}
function ContactDialog({id,close}:{id:string;close:()=>void}){
  const{data,error,loading}=useRemote<Row>('/admin/contacts/'+id,{});
  return <div className="dialog-backdrop"><div className="dialog"><div className="dialog-head"><h2>{data.full_name??'جهة الاتصال'}</h2><button className="close" onClick={close}>×</button></div>
    {error&&<div className="error">{error}</div>}{loading?<Empty loading/>:<><div className="cards"><div className="card"><strong>{data.phone}</strong><div>{data.email}</div></div>
      <div className="card"><strong>{data.company_name||'—'}</strong><div>{data.city||'—'}</div></div></div><h3>سجل الطلبات</h3>
      <div className="table-wrap"><table><thead><tr><th>رقم الطلب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{(data.requests??[]).map((request:Row)=>
        <tr key={request.id}><td>{request.request_number}</td><td>{statusLabels[request.status]??request.status}</td><td>{new Date(request.created_at).toLocaleString('ar')}</td></tr>)}</tbody></table></div></>}</div></div>;
}
function Notifications(){
  const{data,error,loading,load}=useRemote<Row[]>('/admin/notifications',[]);
  const read=async(id:string)=>{await api('/admin/notifications/'+id+'/read',{method:'PATCH'});await load();};
  return <Page title="الإشعارات" action={<button className="button secondary" onClick={async()=>{await api('/admin/notifications/read-all',{method:'PATCH'});await load();}}>تحديد الكل كمقروء</button>}>
    {error&&<div className="error">{error}</div>}{loading?<Empty loading/>:<div className="panel">{data.map(row=><div key={row.id} style={{padding:14,borderBottom:'1px solid #e6eef0',opacity:row.read_at?.8:1}} onClick={()=>void read(row.id)}>
      <strong>{row.title}</strong><p>{row.body}</p><small className="muted">{new Date(row.created_at).toLocaleString('ar')}</small></div>)}</div>}</Page>;
}
function Team(){
  const{data:users,error,loading}=useRemote<Row[]>('/admin/team/users',[]);const{data:roles}=useRemote<Row[]>('/admin/team/roles',[]);
  const[form,setForm]=useState({email:'',fullName:'',roleName:'quote_agent'}),[message,setMessage]=useState('');
  const invite=async(event:FormEvent)=>{event.preventDefault();try{await api('/admin/team/invites',{method:'POST',body:JSON.stringify(form)});setMessage('تم إرسال الدعوة.');}catch(value){setMessage((value as Error).message);}};
  return <Page title="الفريق والأدوار">{error&&<div className="error">{error}</div>}<div className="grid-two"><div className="table-wrap">{loading?<Empty loading/>:<table><thead><tr><th>المستخدم</th><th>الدور</th><th>الحالة</th></tr></thead>
    <tbody>{users.map(row=><tr key={row.id}><td>{row.full_name}<div className="muted">{row.email}</div></td><td>{row.roles?.join('، ')}</td><td>{row.is_active?'فعال':'موقوف'}</td></tr>)}</tbody></table>}</div>
    <form className="panel" onSubmit={invite}><h3>دعوة موظف</h3>{message&&<div className={message.startsWith('تم')?'success':'error'}>{message}</div>}
      <Field label="الاسم" value={form.fullName} onChange={fullName=>setForm(current=>({...current,fullName}))} required/>
      <Field label="البريد" type="email" value={form.email} onChange={email=>setForm(current=>({...current,email}))} required/>
      <label className="field"><span>الدور</span><select value={form.roleName} onChange={e=>setForm(current=>({...current,roleName:e.target.value}))}>{roles.map(role=><option key={role.id} value={role.name}>{role.name}</option>)}</select></label>
      <button className="button" style={{marginTop:16}}>إرسال الدعوة</button></form></div></Page>;
}
function Media(){
  const{data,error,loading,load}=useRemote<Row[]>('/admin/media',[]);const[message,setMessage]=useState('');
  const upload=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=new FormData(event.currentTarget);try{await api('/admin/media',{method:'POST',body:form});setMessage('تم رفع الملف.');await load();}catch(value){setMessage((value as Error).message);}};
  return <Page title="الوسائط">{message&&<div className={message.startsWith('تم')?'success':'error'}>{message}</div>}<form className="toolbar" onSubmit={upload}><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" required/><button className="button">رفع</button></form>
    {error&&<div className="error">{error}</div>}{loading?<Empty loading/>:<div className="cards">{data.map(row=><div className="card" key={row.id}><img src={row.public_url} alt="" style={{width:'100%',height:140,objectFit:'cover',borderRadius:8}}/>
      <small>{row.mime_type}</small></div>)}</div>}</Page>;
}
function Reports(){return <Page title="التقارير" description="تقارير تشغيلية لطلبات العروض والمنتجات الأكثر طلبًا."><div className="cards">
  <div className="card"><h3>طلبات عروض الأسعار</h3><p className="muted">تصدير قائمة الطلبات الحالية إلى Excel.</p><button className="button" onClick={()=>void download('/admin/quote-requests/export','quote-requests.xlsx')}>تصدير</button></div>
  <div className="card"><h3>المنتجات</h3><p className="muted">تصدير كتالوج المنتجات وخصائص الطلب.</p><button className="button" onClick={()=>void download('/admin/products/export','products.xlsx')}>تصدير</button></div></div></Page>;}
function Audit(){
  const{data,error,loading}=useRemote<Row[]>('/admin/audit',[]);
  return <Page title="سجل العمليات">{error&&<div className="error">{error}</div>}<div className="table-wrap">{loading?<Empty loading/>:<table><thead><tr><th>العملية</th><th>المستخدم</th><th>النوع</th><th>التاريخ</th></tr></thead>
    <tbody>{data.map(row=><tr key={row.id}><td>{row.action}</td><td>{row.actor_name||'النظام'}</td><td>{row.entity_type||'—'}</td><td>{new Date(row.created_at).toLocaleString('ar')}</td></tr>)}</tbody></table>}</div></Page>;
}
