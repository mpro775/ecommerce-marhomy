import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, getAnonymousId, track } from './api';
import { brandConfig } from './config/brand.config';
import { pageFromLocation, pathForPage, type Page, type Row } from './navigation';
import { useSeo } from './seo';
type Lang='ar'|'en';
const text={ar:{home:'الرئيسية',catalog:'المنتجات',about:'من نحن',contact:'تواصل معنا',cart:'طلب العرض',browse:'تصفح الكتالوج',
  hero:'منتجات موثوقة، وعرض سعر يناسب احتياجك',heroText:'تصفح المواصفات والصور، حدّد الكميات المطلوبة، وأرسل طلبك لفريق المبيعات بسهولة.',
  details:'عرض التفاصيل',add:'أضف إلى طلب العرض',featured:'منتجات مختارة',all:'كل المنتجات',search:'ابحث عن منتج أو موديل',
  available:'متاح',on_request:'حسب الطلب',temporarily_unavailable:'غير متاح مؤقتًا',discontinued:'متوقف',
  empty:'لا توجد منتجات مطابقة',quantity:'الكمية المطلوبة',note:'ملاحظة حول المنتج',submit:'إرسال طلب عرض السعر'},
  en:{home:'Home',catalog:'Products',about:'About',contact:'Contact',cart:'Quote cart',browse:'Browse catalog',
  hero:'Reliable products, a quote tailored to your needs',heroText:'Explore specifications and images, choose quantities, and send your request directly to our sales team.',
  details:'View details',add:'Add to quote request',featured:'Featured products',all:'All products',search:'Search product or model',
  available:'Available',on_request:'On request',temporarily_unavailable:'Temporarily unavailable',discontinued:'Discontinued',
  empty:'No matching products',quantity:'Requested quantity',note:'Product note',submit:'Submit quote request'}};
function title(row:Row,lang:Lang):string{return String(row[lang==='ar'?'title_ar':'title_en']||row.title_ar||'');}
function description(row:Row,lang:Lang):string{return String(row[lang==='ar'?'short_description_ar':'short_description_en']||row.short_description_ar||'');}
export function App(){
  const[lang,setLang]=useState<Lang>(()=>(localStorage.getItem('rfq-language') as Lang)||'ar');
  const[page,setPage]=useState<Page>(()=>pageFromLocation()),[menu,setMenu]=useState(false),[cartVersion,setCartVersion]=useState(0),[cart,setCart]=useState<Row|null>(null);
  const token=localStorage.getItem('rfq-cart-token');const t=text[lang];
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';localStorage.setItem('rfq-language',lang);},[lang]);
  useEffect(()=>{const onPopState=()=>setPage(pageFromLocation());window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState);},[]);
  useEffect(()=>{if(!token){setCart(null);return;}api<Row>('/quote-carts/'+token).then(setCart).catch(()=>{localStorage.removeItem('rfq-cart-token');setCart(null);});},[token,cartVersion]);
  const navigate=(next:Page)=>{window.history.pushState({},'',pathForPage(next));setPage(next);setMenu(false);window.scrollTo({top:0,behavior:'smooth'});};
  const ensureCart=async():Promise<string>=>{
    const current=localStorage.getItem('rfq-cart-token');if(current)return current;
    const created=await api<Row>('/quote-carts',{method:'POST',body:JSON.stringify({visitorId:getAnonymousId()})});
    localStorage.setItem('rfq-cart-token',created.public_token);return created.public_token;
  };
  const add=async(product:Row,quantity:number,variantId?:string,note?:string)=>{
    const cartToken=await ensureCart();await api('/quote-carts/'+cartToken+'/items',{method:'POST',body:JSON.stringify({
      productId:product.id,variantId:variantId||undefined,quantity,itemNote:note||undefined})});
    setCartVersion(value=>value+1);
  };
  return <div dir={lang==='ar'?'rtl':'ltr'}><PageSeo page={page} lang={lang}/><Header lang={lang} setLang={setLang} page={page} navigate={navigate} menu={menu} setMenu={setMenu} count={cart?.items?.length??0}/>
    {page.name==='home'&&<Home lang={lang} navigate={navigate} add={add}/>}
    {page.name==='catalog'&&<Catalog lang={lang} navigate={navigate} add={add} initialCategory={page.scope==='category'?page.key??'':''} initialBrand={page.scope==='brand'?page.key??'':''}/>}
    {page.name==='product'&&<Product lang={lang} slug={page.slug} navigate={navigate} add={add}/>}
    {page.name==='cart'&&<Cart lang={lang} cart={cart} token={token} reload={()=>setCartVersion(value=>value+1)} navigate={navigate}/>}
    {page.name==='static'&&<StaticPage lang={lang} pageKey={page.key??'about'}/>}
    {page.name==='success'&&<Success lang={lang} data={page.data??{}} navigate={navigate}/>}
    {page.name==='tracking'&&<Tracking lang={lang} requestNumber={page.requestNumber??''} token={page.token??''} navigate={navigate}/>}
    <Footer lang={lang} navigate={navigate}/></div>;
}
function PageSeo({page,lang}:{page:Page;lang:Lang}){
  const labels:Record<string,[string,string]>={home:['كتالوج المنتجات','Product catalog'],catalog:['المنتجات','Products'],product:['المنتج','Product'],cart:['طلب عرض السعر','Quote request'],
    success:['تم استلام الطلب','Request received'],tracking:['تتبع الطلب','Track request'],static:['صفحة معلومات','Information']};
  const label=labels[page.name];
  useSeo({title:label?.[lang==='ar'?0:1],canonicalPath:pathForPage(page),noIndex:['cart','success','tracking'].includes(page.name)});
  return null;
}
function Header({lang,setLang,page,navigate,menu,setMenu,count}:{lang:Lang;setLang:(lang:Lang)=>void;page:Page;navigate:(page:Page)=>void;menu:boolean;setMenu:(value:boolean)=>void;count:number}){
  const t=text[lang];return <header className="header"><div className="container header-row"><button className="menu-button" onClick={()=>setMenu(!menu)}>☰</button>
    <button className="logo" onClick={()=>navigate({name:'home'})} style={{border:0,background:'none'}}><span className="logo-mark">RFQ</span><span>{lang==='ar'?brandConfig.nameAr:brandConfig.nameEn}</span></button>
    <nav className={'nav '+(menu?'open':'')}><button onClick={()=>navigate({name:'home'})}>{t.home}</button><button onClick={()=>navigate({name:'catalog'})}>{t.catalog}</button>
      <button onClick={()=>navigate({name:'static',key:'about'})}>{t.about}</button><button onClick={()=>navigate({name:'static',key:'contact'})}>{t.contact}</button>
      <button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button>
      <button onClick={()=>navigate({name:'tracking'})}>{lang==='ar'?'تتبع الطلب':'Track request'}</button>
      <button className="cart-button" onClick={()=>navigate({name:'cart'})}>{t.cart} ({count})</button></nav></div></header>;
}
function Home({lang,navigate,add}:{lang:Lang;navigate:(page:Page)=>void;add:(product:Row,quantity:number,variantId?:string)=>Promise<void>}){
  const t=text[lang];const[products,setProducts]=useState<Row[]>([]),[categories,setCategories]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');Promise.all([api<{items:Row[]}>('/catalog/products?featured=true&pageSize=6',{signal:controller.signal}),api<Row[]>('/catalog/categories',{signal:controller.signal})])
    .then(([productResult,categoryResult])=>{setProducts(productResult.items);setCategories(categoryResult);}).catch(value=>{if((value as Error).name!=='AbortError')setError((value as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[retry]);
  return <><section className="hero"><div className="container hero-grid"><div><span className="eyebrow">{lang==='ar'?brandConfig.taglineAr:brandConfig.taglineEn}</span><h1>{t.hero}</h1>
    <p>{t.heroText}</p><div className="actions"><button className="button" onClick={()=>navigate({name:'catalog'})}>{t.browse}</button>
      <button className="button outline" onClick={()=>navigate({name:'static',key:'contact'})}>{t.contact}</button></div></div>
    <div className="hero-card"><h2>{lang==='ar'?'خطوات بسيطة':'Simple steps'}</h2><ul><li>01 · {lang==='ar'?'اختر المنتجات':'Choose products'}</li>
      <li>02 · {lang==='ar'?'حدّد الخيارات والكميات':'Set options and quantities'}</li><li>03 · {lang==='ar'?'أرسل بيانات التواصل':'Send contact details'}</li></ul></div></div></section>
    <section className="section"><div className="container"><div className="section-head"><div><span className="eyebrow" style={{color:'#b46600'}}>{t.featured}</span><h2>{t.featured}</h2></div>
      <button className="button secondary" onClick={()=>navigate({name:'catalog'})}>{t.all}</button></div>{loading?<LoadState lang={lang}/>:error?<ErrorState lang={lang} message={error} retry={()=>setRetry(value=>value+1)}/>:<ProductGrid products={products} lang={lang} navigate={navigate} add={add}/>}</div></section>
    <section className="section alt"><div className="container"><div className="section-head"><h2>{lang==='ar'?'تصفح حسب التصنيف':'Browse by category'}</h2></div>
      <div className="product-grid">{categories.slice(0,6).map(category=><button className="panel" style={{textAlign:'start',cursor:'pointer'}} key={category.id}
        onClick={()=>navigate({name:'catalog',scope:'category',key:category.slug})}><h3>{title(category,lang)}</h3><p className="muted">{lang==='ar'?category.description_ar:category.description_en}</p></button>)}</div></div></section></>;
}
function ProductGrid({products,lang,navigate,add}:{products:Row[];lang:Lang;navigate:(page:Page)=>void;add:(product:Row,quantity:number,variantId?:string)=>Promise<void>}){
  const t=text[lang];const[message,setMessage]=useState('');
  if(!products.length)return <div className="empty">{t.empty}</div>;
  return <><div className="product-grid">{products.map(product=><article className="product-card" key={product.id}><div className="product-image">
    {product.primary_image_url?<img src={product.primary_image_url} alt={title(product,lang)}/>:<span>RFQ</span>}</div><div className="product-body">
      <span className="availability">{(t as any)[product.availability_status]??product.availability_status}</span><h3>{title(product,lang)}</h3>
      <p className="muted">{description(product,lang)}</p><div className="product-actions"><button className="button secondary" onClick={()=>navigate({name:'product',slug:product.slug})}>{t.details}</button>
      <button className="button" disabled={!product.quote_enabled||['temporarily_unavailable','discontinued'].includes(product.availability_status)} onClick={async()=>{const count=Number(product.active_variant_count??0);
        if(count>0&&!(count===1&&product.active_default_variant_id)){navigate({name:'product',slug:product.slug});return;}
        try{await add(product,Number(product.minimum_request_quantity??1),product.active_default_variant_id??undefined);setMessage(lang==='ar'?'تمت الإضافة إلى السلة.':'Added to quote cart.');}catch(value){setMessage((value as Error).message);}}}>{t.add}</button></div></div></article>)}</div>
    {message&&<div className="notice" style={{position:'fixed',bottom:20,left:20,zIndex:20}}>{message}</div>}</>;
}
function Catalog({lang,navigate,add,initialCategory,initialBrand}:{lang:Lang;navigate:(page:Page)=>void;add:(product:Row,quantity:number,variantId?:string)=>Promise<void>;initialCategory:string;initialBrand:string}){
  const t=text[lang];const[search,setSearch]=useState(''),[debouncedSearch,setDebouncedSearch]=useState(''),[category,setCategory]=useState(initialCategory),[brand,setBrand]=useState(initialBrand);
  const[products,setProducts]=useState<Row[]>([]),[categories,setCategories]=useState<Row[]>([]),[brands,setBrands]=useState<Row[]>([]);
  const[filters,setFilters]=useState<Row[]>([]),[selectedFilters,setSelectedFilters]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const selectedEntry=category?categories.find(row=>row.slug===category):brand?brands.find(row=>row.slug===brand):undefined;
  useSeo({title:selectedEntry?String(selectedEntry[lang==='ar'?'seo_title_ar':'seo_title_en']||title(selectedEntry,lang)):t.all,
    description:selectedEntry?String(selectedEntry[lang==='ar'?'seo_description_ar':'seo_description_en']||selectedEntry[lang==='ar'?'description_ar':'description_en']||''):undefined,
    image:selectedEntry?.image_url||selectedEntry?.logo_url,canonicalPath:category?'/categories/'+category:brand?'/brands/'+brand:'/products'});
  useEffect(()=>{const timeout=window.setTimeout(()=>setDebouncedSearch(search.trim()),350);return()=>window.clearTimeout(timeout);},[search]);
  useEffect(()=>{setCategory(initialCategory);setBrand(initialBrand);},[initialCategory,initialBrand]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');const filterValues=Object.values(selectedFilters).filter(Boolean).join(',');
    const query=new URLSearchParams({...debouncedSearch&&{search:debouncedSearch},...category&&{category},...brand&&{brand},...filterValues&&{filterValues},pageSize:'60'});
    api<{items:Row[]}>('/catalog/products?'+query,{signal:controller.signal}).then(value=>setProducts(value.items)).catch(value=>{if((value as Error).name!=='AbortError')setError((value as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[debouncedSearch,category,brand,selectedFilters,retry]);
  useEffect(()=>{const controller=new AbortController();Promise.all([api<Row[]>('/catalog/categories',{signal:controller.signal}),api<Row[]>('/catalog/brands',{signal:controller.signal}),api<Row[]>('/catalog/filters',{signal:controller.signal})])
    .then(([categoryRows,brandRows,filterRows])=>{setCategories(categoryRows);setBrands(brandRows);setFilters(filterRows);}).catch(value=>{if((value as Error).name!=='AbortError')setError((value as Error).message);});return()=>controller.abort();},[retry]);
  useEffect(()=>{const selected=categories.find(row=>row.slug===category);if(selected)void track('category_viewed',{categoryId:selected.id});},[category,categories]);
  useEffect(()=>{const selected=brands.find(row=>row.slug===brand);if(selected)void track('brand_viewed',{brandId:selected.id});},[brand,brands]);
  return <main className="section"><div className="container"><div className="section-head"><h1>{t.all}</h1></div><div className="filters">
    <input placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)}/><select value={category} onChange={e=>{const value=e.target.value;setCategory(value);if(value)setBrand('');window.history.pushState({},'',value?'/categories/'+encodeURIComponent(value):'/products');}}><option value="">{lang==='ar'?'كل التصنيفات':'All categories'}</option>
      {categories.map(row=><option key={row.id} value={row.slug}>{title(row,lang)}</option>)}</select><select value={brand} onChange={e=>{const value=e.target.value;setBrand(value);if(value)setCategory('');window.history.pushState({},'',value?'/brands/'+encodeURIComponent(value):'/products');}}><option value="">{lang==='ar'?'كل العلامات':'All brands'}</option>
      {brands.map(row=><option key={row.id} value={row.slug}>{title(row,lang)}</option>)}</select>
      {filters.filter(item=>item.filter_type==='option').map(filter=><select key={filter.id} value={selectedFilters[filter.id]??''}
        onChange={e=>setSelectedFilters(current=>({...current,[filter.id]:e.target.value}))}><option value="">{lang==='ar'?filter.name_ar:filter.name_en||filter.name_ar}</option>
        {(filter.values??[]).map((value:Row)=><option key={value.id} value={value.id}>{lang==='ar'?value.value_ar:value.value_en||value.value_ar}</option>)}</select>)}</div>
    {loading?<LoadState lang={lang}/>:error?<ErrorState lang={lang} message={error} retry={()=>setRetry(value=>value+1)}/>:<ProductGrid products={products} lang={lang} navigate={navigate} add={add}/>}</div></main>;
}
function Product({lang,slug,navigate,add}:{lang:Lang;slug:string;navigate:(page:Page)=>void;add:(product:Row,quantity:number,variantId?:string,note?:string)=>Promise<void>}){
  const t=text[lang];const[product,setProduct]=useState<Row|null>(null),[related,setRelated]=useState<Row[]>([]),[image,setImage]=useState(''),[variant,setVariant]=useState(''),[quantity,setQuantity]=useState(1),[note,setNote]=useState(''),[message,setMessage]=useState('');
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useSeo({title:product?String(product[lang==='ar'?'seo_title_ar':'seo_title_en']||title(product,lang)):undefined,
    description:product?String(product[lang==='ar'?'seo_description_ar':'seo_description_en']||description(product,lang)):undefined,
    image:product?.images?.[0]?.image_url,canonicalPath:'/products/'+slug,structuredData:product?{'@context':'https://schema.org','@type':'Product',name:title(product,lang),
      description:description(product,lang),image:(product.images??[]).map((item:Row)=>item.image_url),sku:product.sku||undefined,
      brand:product.brand_title_ar?{'@type':'Brand',name:lang==='ar'?product.brand_title_ar:product.brand_title_en||product.brand_title_ar}:undefined}:null});
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setProduct(null);api<Row>('/catalog/products/'+slug,{signal:controller.signal}).then(value=>{setProduct(value);setImage(value.images?.[0]?.image_url??'');setQuantity(Number(value.minimum_request_quantity??1));
    const activeVariants=(value.variants??[]).filter((item:Row)=>item.is_active);setVariant(activeVariants.length===1&&activeVariants[0].is_default?activeVariants[0].id:'');void track('product_viewed',{productId:value.id});
    api<Row[]>('/catalog/products/'+value.id+'/related',{signal:controller.signal}).then(setRelated).catch(()=>setRelated([]));}).catch(value=>{if((value as Error).name!=='AbortError')setError((value as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[slug,retry]);
  if(loading)return <LoadState lang={lang}/>;if(error||!product)return <ErrorState lang={lang} message={error} retry={()=>setRetry(value=>value+1)}/>;
  const unavailable=!product.quote_enabled||['temporarily_unavailable','discontinued'].includes(product.availability_status);
  const specs=Object.entries(product.specifications??{}),activeVariants=(product.variants??[]).filter((item:Row)=>item.is_active);return <main className="container detail"><div><div className="gallery-main">{image?<img src={image} alt={title(product,lang)}/>:<span>RFQ</span>}</div>
    <div className="thumbs">{(product.images??[]).map((item:Row)=><button className={'thumb '+(image===item.image_url?'active':'')} key={item.id} onClick={()=>setImage(item.image_url)}>
      <img src={item.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></button>)}</div></div><div>
    <span className="availability">{(t as any)[product.availability_status]}</span><h1>{title(product,lang)}</h1><p className="muted">{description(product,lang)}</p>
    {product.brand_title_ar&&<p><strong>{lang==='ar'?'العلامة التجارية':'Brand'}:</strong> {lang==='ar'?product.brand_title_ar:product.brand_title_en||product.brand_title_ar}</p>}
    {product.model_code&&<p><strong>{lang==='ar'?'الموديل':'Model'}:</strong> {product.model_code}</p>}
    {product.sku&&<p><strong>SKU:</strong> {product.sku}</p>}
    <p style={{lineHeight:1.9}}>{lang==='ar'?product.detailed_description_ar:product.detailed_description_en||product.detailed_description_ar}</p>
    {product.youtube_url&&<p><a className="button secondary" href={product.youtube_url} target="_blank" rel="noreferrer">{lang==='ar'?'فيديو المنتج':'Product video'}</a></p>}
    {specs.length>0&&<><h3>{lang==='ar'?'المواصفات':'Specifications'}</h3><table className="specs"><tbody>{specs.map(([key,value])=><tr key={key}><td><strong>{key}</strong></td><td>{String(value)}</td></tr>)}</tbody></table></>}
    <div className="quote-box">{activeVariants.length>0&&<label className="field"><label>{lang==='ar'?'الخيار':'Option'}</label><select value={variant} onChange={e=>setVariant(e.target.value)}>
      <option value="">{lang==='ar'?'اختر':'Choose'}</option>{activeVariants.map((item:Row)=><option key={item.id} value={item.id}>{title(item,lang)}</option>)}</select></label>}
      <div className="form-grid"><label className="field"><label>{t.quantity} ({product.unit_of_measure})</label><input type="number" min={product.minimum_request_quantity} max={product.maximum_request_quantity??undefined}
        step={product.quantity_step} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><label className="field"><label>{t.note}</label><input value={note} onChange={e=>setNote(e.target.value)}/></label></div>
      {unavailable&&<div className="error">{lang==='ar'?'هذا المنتج غير متاح حاليًا لطلبات عروض الأسعار.':'This product is currently unavailable for quote requests.'}</div>}
      {message&&<div className={message.startsWith('تم')||message.startsWith('Added')?'notice':'error'}>{message}</div>}<button className="button" disabled={unavailable||(activeVariants.length>0&&!variant)} style={{marginTop:14}} onClick={async()=>{try{await add(product,quantity,variant||undefined,note);setMessage(lang==='ar'?'تمت الإضافة إلى طلب العرض.':'Added to quote request.');}catch(value){setMessage((value as Error).message);}}}>{t.add}</button></div>
    {related.length>0&&<div className="panel" style={{marginTop:18}}><h3>{lang==='ar'?'منتجات مرتبطة':'Related products'}</h3>{related.map(item=>
      <button key={item.id} style={{display:'block',border:0,background:'none',padding:'8px 0',color:'#0f5f73'}} onClick={()=>navigate({name:'product',slug:item.slug})}>{title(item,lang)}</button>)}</div>}</div></main>;
}
function Cart({lang,cart,token,reload,navigate}:{lang:Lang;cart:Row|null;token:string|null;reload:()=>void;navigate:(page:Page)=>void}){
  const t=text[lang];const[formStartedAt]=useState(()=>new Date().toISOString()),[error,setError]=useState(''),[sending,setSending]=useState(false),[idempotencyKey,setIdempotencyKey]=useState(()=>crypto.randomUUID());
  useEffect(()=>{if(cart?.items?.length)void track('quote_form_started');},[cart?.items?.length]);
  useEffect(()=>{setIdempotencyKey(crypto.randomUUID());},[cart]);
  const update=async(id:string,quantity:number)=>{if(!token)return;await api('/quote-carts/'+token+'/items/'+id,{method:'PATCH',body:JSON.stringify({quantity})});reload();};
  const remove=async(id:string)=>{if(!token)return;await api('/quote-carts/'+token+'/items/'+id,{method:'DELETE'});reload();};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!token)return;setSending(true);setError('');const data=Object.fromEntries(new FormData(event.currentTarget));
    try{const result=await api<Row>('/quote-requests',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({
      cartToken:token,fullName:data.fullName,phone:data.phone,email:data.email||undefined,companyName:data.companyName||undefined,
      city:data.city||undefined,addressText:data.addressText||undefined,preferredContactMethod:data.preferredContactMethod||undefined,
      customerNote:data.customerNote||undefined,website:data.website||undefined,formStartedAt,source:'web'})});
      localStorage.removeItem('rfq-cart-token');localStorage.setItem('rfq-last-tracking',JSON.stringify({requestNumber:result.requestNumber,trackingToken:result.trackingToken}));reload();navigate({name:'success',data:result});}
    catch(value){setError((value as Error).message);}finally{setSending(false);}};
  if(!cart?.items?.length)return <main className="container section"><h1>{t.cart}</h1><div className="empty">{lang==='ar'?'السلة فارغة. أضف المنتجات التي تحتاج إليها.':'Your quote cart is empty.'}</div>
    <button className="button" onClick={()=>navigate({name:'catalog'})}>{t.browse}</button></main>;
  return <main className="container section"><div className="section-head"><h1>{t.cart}</h1></div><div className="cart-layout"><div className="panel">{cart.items.map((item:Row)=><div className="cart-item" key={item.id}>
    {item.image_url?<img src={item.image_url} alt=""/>:<div/>}<div><strong>{lang==='ar'?item.title_ar:item.title_en||item.title_ar}</strong><div className="muted">{lang==='ar'?item.variant_title_ar:item.variant_title_en}</div>
      <p>{item.item_note}</p></div><div><input className="quantity" type="number" step="0.001" defaultValue={item.quantity} onBlur={e=>void update(item.id,Number(e.target.value))}/>
      <button className="button secondary" style={{display:'block',marginTop:8}} onClick={()=>void remove(item.id)}>{lang==='ar'?'حذف':'Remove'}</button></div></div>)}</div>
    <form className="panel" onSubmit={submit}><h2>{lang==='ar'?'بيانات التواصل':'Contact details'}</h2>{error&&<div className="error">{error}</div>}
      <div className="form-grid"><label className="field"><label>{lang==='ar'?'الاسم الكامل':'Full name'} *</label><input name="fullName" required/></label>
        <label className="field"><label>{lang==='ar'?'رقم الهاتف':'Phone'} *</label><input name="phone" dir="ltr" required/></label>
        <label className="field"><label>{lang==='ar'?'اسم الشركة':'Company'}</label><input name="companyName"/></label>
        <label className="field"><label>{lang==='ar'?'البريد الإلكتروني':'Email'}</label><input name="email" type="email"/></label>
        <label className="field"><label>{lang==='ar'?'المدينة':'City'}</label><input name="city"/></label>
        <label className="field"><label>{lang==='ar'?'طريقة التواصل':'Preferred contact'}</label><select name="preferredContactMethod"><option value="phone">{lang==='ar'?'هاتف':'Phone'}</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label>
        <label className="field full"><label>{lang==='ar'?'العنوان':'Address'}</label><textarea name="addressText" rows={2}/></label>
        <label className="field full"><label>{lang==='ar'?'ملاحظات عامة':'General notes'}</label><textarea name="customerNote" rows={3}/></label>
        <input name="website" tabIndex={-1} autoComplete="off" style={{display:'none'}}/></div>
      <button className="button" disabled={sending} style={{width:'100%',marginTop:16}}>{sending?(lang==='ar'?'جارٍ الإرسال…':'Submitting…'):t.submit}</button></form></div></main>;
}
function Success({lang,data,navigate}:{lang:Lang;data:Row;navigate:(page:Page)=>void}){
  const saved=useMemo(()=>{try{return JSON.parse(localStorage.getItem('rfq-last-tracking')||'{}') as Row;}catch{return{};}},[]);const result=data.requestNumber?data:saved;
  return <main className="container success-page"><div className="success-icon">✓</div><h1>{lang==='ar'?'تم استلام طلب عرض السعر بنجاح.':'Your quote request was received.'}</h1>
    <p className="muted">{lang==='ar'?'سيقوم فريقنا بمراجعة المنتجات والكميات والتواصل معك.':'Our team will review the products and quantities and contact you.'}</p>
    <div className="panel" style={{maxWidth:560,margin:'30px auto'}}><span className="muted">{lang==='ar'?'رقم الطلب':'Request number'}</span><h2 dir="ltr">{result.requestNumber||'—'}</h2>
      {result.trackingToken&&<><p className="muted">{lang==='ar'?'احتفظ برمز التتبع الخاص بك ولا تشاركه مع الآخرين.':'Keep your tracking token private.'}</p><code className="tracking-token" dir="ltr">{result.trackingToken}</code>
        <button className="button secondary" style={{marginTop:12}} onClick={()=>void navigator.clipboard?.writeText(result.trackingToken)}>{lang==='ar'?'نسخ رمز التتبع':'Copy tracking token'}</button></>}</div>
    <div className="actions" style={{justifyContent:'center'}}>{result.requestNumber&&result.trackingToken&&<button className="button" onClick={()=>navigate({name:'tracking',requestNumber:result.requestNumber,token:result.trackingToken})}>{lang==='ar'?'تتبع الطلب':'Track request'}</button>}
    <button className="button secondary" onClick={()=>navigate({name:'catalog'})}>{lang==='ar'?'العودة للكتالوج':'Back to catalog'}</button></div></main>;
}
function Tracking({lang,requestNumber,token,navigate}:{lang:Lang;requestNumber:string;token:string;navigate:(page:Page)=>void}){
  const saved=useMemo(()=>{try{return JSON.parse(localStorage.getItem('rfq-last-tracking')||'{}') as Row;}catch{return{};}},[]);
  const[number,setNumber]=useState(requestNumber||saved.requestNumber||''),[trackingToken,setTrackingToken]=useState(token||(requestNumber===saved.requestNumber?saved.trackingToken:'')||'');
  const[status,setStatus]=useState<Row|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const lookup=async(event?:FormEvent)=>{event?.preventDefault();if(!number.trim()||!trackingToken.trim())return;setLoading(true);setError('');setStatus(null);
    try{const result=await api<Row>('/quote-requests/public/'+encodeURIComponent(number.trim())+'?token='+encodeURIComponent(trackingToken.trim()));setStatus(result);
      localStorage.setItem('rfq-last-tracking',JSON.stringify({requestNumber:number.trim(),trackingToken:trackingToken.trim()}));window.history.replaceState({},'',pathForPage({name:'tracking',requestNumber:number.trim()}));}
    catch(value){setError((value as Error).message);}finally{setLoading(false);}};
  useEffect(()=>{if(number&&trackingToken)void lookup();},[]);
  const labels:Record<string,[string,string]>={new:['جديد','New'],in_review:['قيد المراجعة','In review'],contacted:['تم التواصل','Contacted'],quote_sent:['تم إرسال العرض','Quote sent'],accepted:['مقبول','Accepted'],rejected:['مرفوض','Rejected'],cancelled:['ملغي','Cancelled'],closed:['مغلق','Closed']};
  return <main className="container section tracking-page"><div className="section-head"><h1>{lang==='ar'?'تتبع طلب عرض السعر':'Track quote request'}</h1></div>
    <form className="panel tracking-form" onSubmit={lookup}><div className="form-grid"><label className="field"><label>{lang==='ar'?'رقم الطلب':'Request number'}</label><input dir="ltr" value={number} onChange={event=>setNumber(event.target.value)} required/></label>
      <label className="field"><label>{lang==='ar'?'رمز التتبع':'Tracking token'}</label><input dir="ltr" type="password" value={trackingToken} onChange={event=>setTrackingToken(event.target.value)} required autoComplete="off"/></label></div>
      {error&&<div className="error" style={{marginTop:14}}>{error}</div>}<button className="button" disabled={loading} style={{marginTop:14}}>{loading?(lang==='ar'?'جارٍ التحقق…':'Checking…'):(lang==='ar'?'عرض حالة الطلب':'View request status')}</button></form>
    {status&&<div className="panel tracking-result"><span className="muted">{lang==='ar'?'رقم الطلب':'Request number'}</span><h2 dir="ltr">{status.request_number}</h2><p><strong>{lang==='ar'?'الحالة':'Status'}:</strong> {labels[status.status]?.[lang==='ar'?0:1]||status.status}</p>
      <p className="muted">{lang==='ar'?'آخر تحديث':'Last updated'}: <span dir="ltr">{new Date(status.updated_at).toLocaleString(lang==='ar'?'ar-SA':'en-US')}</span></p></div>}
    <button className="button secondary" style={{marginTop:20}} onClick={()=>navigate({name:'catalog'})}>{lang==='ar'?'العودة للمنتجات':'Back to products'}</button></main>;
}
function LoadState({lang}:{lang:Lang}){return <div className="empty" role="status">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</div>;}
function ErrorState({lang,message,retry}:{lang:Lang;message:string;retry:()=>void}){return <div className="error state-error" role="alert"><p>{lang==='ar'?'تعذر تحميل البيانات. تحقق من الاتصال وحاول مرة أخرى.':'Could not load data. Check your connection and try again.'}</p>{message&&<small>{message}</small>}<button className="button" onClick={retry}>{lang==='ar'?'إعادة المحاولة':'Retry'}</button></div>;}
const staticContent:Record<string,{ar:[string,string[]];en:[string,string[]]}>={
  about:{ar:['من نحن',['نقدم كتالوجًا احترافيًا للمنتجات وحلولًا مرنة للشركات.','هدفنا تسهيل اختيار المنتجات والتواصل السريع للحصول على عرض مناسب.']],
    en:['About us',['We provide a professional product catalog and flexible business solutions.','Our goal is to simplify product discovery and quote requests.']]},
  contact:{ar:['تواصل معنا',['الهاتف: '+brandConfig.phone,'واتساب: '+brandConfig.whatsapp,'البريد: '+brandConfig.email]],
    en:['Contact us',['Phone: '+brandConfig.phone,'WhatsApp: '+brandConfig.whatsapp,'Email: '+brandConfig.email]]},
  privacy:{ar:['سياسة الخصوصية',['نستخدم بيانات التواصل لمعالجة طلب عرض السعر والرد عليك فقط.','لا نبيع بياناتك ولا ننشئ حسابًا تلقائيًا.']],
    en:['Privacy policy',['We use contact details only to process and respond to your quote request.','We do not sell your data or create an account automatically.']]},
  terms:{ar:['الشروط والأحكام',['إرسال الطلب لا يمثل عملية شراء أو التزامًا ماليًا.','يتم الاتفاق على العرض والتفاصيل مباشرة مع فريق المبيعات.']],
    en:['Terms and conditions',['Submitting a request is not a purchase or financial commitment.','Quote details are agreed directly with the sales team.']]},
  faq:{ar:['الأسئلة الشائعة',['هل تظهر الأسعار؟ لا، يتم إعداد العرض حسب الكميات والمواصفات.','هل يلزم حساب؟ لا، يكفي إدخال بيانات التواصل.']],
    en:['Frequently asked questions',['Are product rates shown? No, each quote is prepared for your quantities and specifications.','Is an account required? No, contact details are enough.']]},
};
function StaticPage({lang,pageKey}:{lang:Lang;pageKey:string}){const content=staticContent[pageKey]?.[lang]??staticContent.about[lang];
  return <main className="container section" style={{minHeight:'55vh'}}><h1>{content[0]}</h1>{content[1].map((paragraph,index)=><p key={index} style={{fontSize:18,lineHeight:1.9}}>{paragraph}</p>)}</main>;}
function Footer({lang,navigate}:{lang:Lang;navigate:(page:Page)=>void}){return <footer className="footer"><div className="container footer-grid"><div><h2>{lang==='ar'?brandConfig.nameAr:brandConfig.nameEn}</h2>
  <p>{lang==='ar'?brandConfig.taglineAr:brandConfig.taglineEn}</p></div><div><h3>{lang==='ar'?'روابط':'Links'}</h3><button onClick={()=>navigate({name:'static',key:'about'})}>{text[lang].about}</button>
    <button onClick={()=>navigate({name:'static',key:'contact'})}>{text[lang].contact}</button><button onClick={()=>navigate({name:'static',key:'faq'})}>FAQ</button></div>
  <div><h3>{lang==='ar'?'قانوني':'Legal'}</h3><button onClick={()=>navigate({name:'static',key:'privacy'})}>{lang==='ar'?'سياسة الخصوصية':'Privacy'}</button>
    <button onClick={()=>navigate({name:'static',key:'terms'})}>{lang==='ar'?'الشروط والأحكام':'Terms'}</button></div></div></footer>;}
