const DEMO_PRODUCTS=[
{id:'demo-1',name:'Custom Name Keychain',category:'Personalised',price:99,material:'PLA',emoji:'🔑',bg:'linear-gradient(135deg,#c9f6e8,#79d9b9)',description:'A compact personalised name keychain, ideal for bags, keys and small gifts.',active:true,sort_order:1},
{id:'demo-2',name:'Mechanical Gear Model',category:'Engineering',price:149,material:'PLA',emoji:'⚙️',bg:'linear-gradient(135deg,#d7e6ff,#91adf8)',description:'A display-friendly gear model for demos, classroom use and mechanical project presentations.',active:true,sort_order:2},
{id:'demo-3',name:'Phone Stand',category:'Utility',price:179,material:'PLA',emoji:'📱',bg:'linear-gradient(135deg,#ffe5c2,#ffb878)',description:'A simple desktop phone stand with a stable base and charging-cable clearance.',active:true,sort_order:3},
{id:'demo-4',name:'Miniature Rocket',category:'Models',price:229,material:'PLA',emoji:'🚀',bg:'linear-gradient(135deg,#eedcff,#c9a7f5)',description:'A decorative miniature rocket for desks, displays and student events.',active:true,sort_order:4},
{id:'demo-5',name:'Cable Organizer',category:'Utility',price:89,material:'PLA',emoji:'🔌',bg:'linear-gradient(135deg,#d7f0ff,#8dd2f0)',description:'A compact cable-management clip for desks and charging setups.',active:true,sort_order:5},
{id:'demo-6',name:'Bearing Cutaway Demo',category:'Engineering',price:249,material:'PETG',emoji:'🛞',bg:'linear-gradient(135deg,#dce4ec,#95a8ba)',description:'A simplified bearing demonstration model for mechanical engineering explanations.',active:true,sort_order:6},
{id:'demo-7',name:'Desk Name Plate',category:'Personalised',price:199,material:'PLA',emoji:'🏷️',bg:'linear-gradient(135deg,#fff0c8,#f7cb68)',description:'A custom desk name plate for students, faculty or project teams.',active:true,sort_order:7},
{id:'demo-8',name:'Low-Poly Planter',category:'Decor',price:299,material:'PLA',emoji:'🪴',bg:'linear-gradient(135deg,#d7f7d7,#90d890)',description:'A geometric low-poly planter for succulents or desk decoration.',active:true,sort_order:8}
];
const DEMO_ORDERS=[
{id:'demo-order-1',order_code:'CVR3D-1042',customer_name:'Demo Student',phone:'9876543210',email:'student@example.com',roll_number:'23B81A0305',request_type:'Print my model',material:'PLA',color:'Black',quality:'standard',quantity:1,dimensions:'',needed_by:'2026-09-16',notes:'Mechanical prototype for project review.',status:'Printing',created_at:'2026-09-11T10:30:00.000Z',file_name:'prototype.stl',lab_weight:72,print_time:'2 h 40 min',quote:240,quote_type:'Lab quotation'},
{id:'demo-order-2',order_code:'CVR3D-1039',customer_name:'Rahul K',phone:'9000000000',request_type:'Design + Print',material:'PETG',color:'Blue',quality:'standard',quantity:2,dimensions:'120 × 80 × 35 mm',needed_by:'2026-09-18',notes:'Custom enclosure with 4 screw holes.',status:'Awaiting Approval',created_at:'2026-09-10T08:10:00.000Z',file_name:'sketch.pdf',design_fee:200,lab_weight:85,print_time:'5 h 15 min',quote:760,quote_type:'Design + printing'},
{id:'demo-order-3',order_code:'CVR3D-1034',customer_name:'Priya S',phone:'9111111111',request_type:'Existing Design',product_name:'Desk Name Plate',material:'PLA',color:'White',quality:'standard',quantity:1,notes:'Text: PRIYA',status:'Ready',created_at:'2026-09-08T12:45:00.000Z',file_name:'Catalogue item',quote:199,quote_type:'Fixed catalogue price'}
];
const STATUS_FLOW=['Request Submitted','File Review','Quote Prepared','Awaiting Approval','Awaiting Payment','Payment Submitted','Paid','Printing','Ready','Completed'];
const PUBLIC_CATALOGUE_ENABLED=false;
const CUSTOMER_FLOW=['Request received','Under review','Quote ready','Payment','Paid','Printing','Ready for pickup','Completed'];
const STATUS_LABELS={'Request Submitted':'Request received','File Review':'Under review','Quote Prepared':'Quote ready','Awaiting Approval':'Awaiting quote approval','Awaiting Payment':'Awaiting payment','Payment Submitted':'Payment verification','Paid':'Paid','Approved':'Paid','Printing':'Printing','Ready':'Ready for pickup','Completed':'Completed','Rejected':'Rejected'};
const cfg=window.CVR3D_CONFIG||{};
const BACKEND_READY=/^https:\/\/.+\.supabase\.co\/?$/i.test(String(cfg.SUPABASE_URL||'').trim()) && /^sb_publishable_/i.test(String(cfg.SUPABASE_PUBLISHABLE_KEY||'').trim());
const sb=BACKEND_READY ? window.supabase.createClient(cfg.SUPABASE_URL.trim(),cfg.SUPABASE_PUBLISHABLE_KEY.trim()) : null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let products=[...DEMO_PRODUCTS], publicSettings={design_fee:200,payment_enabled:false,upi_id:'',upi_payee_name:'CVR 3D Print Lab'}, internalPricing={pla_per_gram:2.6,petg_per_gram:3.2,abs_per_gram:3.4,tpu_per_gram:4.2,machine_hour:25,handling:50};
let adminOrders=[], adminProducts=[], currentFilter='All', lastSubmittedId='', lastSubmittedPhone='', adminSession=false;

function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`}
function slug(s=''){return String(s).replace(/[^a-z0-9]+/gi,'-')}
function statusLabel(s=''){return STATUS_LABELS[s]||s||'—'}
function customerStageIndex(status=''){const map={'Request Submitted':0,'File Review':1,'Quote Prepared':2,'Awaiting Approval':2,'Awaiting Payment':3,'Payment Submitted':3,'Paid':4,'Approved':4,'Printing':5,'Ready':6,'Completed':7};return map[status]??0}
function formatDate(v){if(!v)return '—';return new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
function normalizeIndianMobile(value){let d=String(value||'').replace(/\D/g,'');if(d.startsWith('91')&&d.length>10)d=d.slice(2);return d.slice(0,10)}
function validPhone(v){return /^[6-9]\d{9}$/.test(String(v||''))}
function parseWeightGrams(value){
  const raw=String(value??'').trim().toLowerCase();
  if(!raw)return null;
  const n=parseFloat(raw.replace(/,/g,''));
  if(!Number.isFinite(n)||n<=0)return NaN;
  return /kg\b/.test(raw)?Math.round(n*1000*100)/100:Math.round(n*100)/100;
}
function bindPhone(input){if(input)input.addEventListener('input',()=>input.value=normalizeIndianMobile(input.value))}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2400)}
function localOrders(){try{return JSON.parse(localStorage.getItem('cvr3d_v2_orders')||'null')||[...DEMO_ORDERS]}catch{return [...DEMO_ORDERS]}}
function saveLocalOrders(v){localStorage.setItem('cvr3d_v2_orders',JSON.stringify(v))}
function localOrderCode(){const n=1000+Math.floor(Math.random()*8999);return `CVR3D-${n}`}

function setBackendBadge(){const p=$('#backendPill');if(p){if(BACKEND_READY){p.textContent='Service online';p.className='backend-pill online'}else{p.textContent='Local demo';p.className='backend-pill demo'}}const hint=$('#demoTrackHint'),reset=$('#resetDemoBtn');if(BACKEND_READY){if(hint)hint.classList.add('hidden');if(reset)reset.classList.add('hidden')}}
async function loadPublicData(){
  if(!BACKEND_READY){products=[...DEMO_PRODUCTS];publicSettings={design_fee:200};renderProducts();updateRequestTypeUI();return}
  try{
    const [{data:p,error:pe},{data:s,error:se}]=await Promise.all([
      sb.from('products').select('*').eq('active',true).order('sort_order',{ascending:true}),
      sb.from('public_settings').select('*').eq('id',1).single()
    ]);
    if(pe)throw pe;if(se)throw se;products=(p||[]).map(x=>({...x,description:x.description||''}));publicSettings=s||{design_fee:200,payment_enabled:false,upi_id:'',upi_payee_name:'CVR 3D Print Lab'};
  }catch(e){console.error(e);showToast('Could not load catalogue data');products=[]}
  renderProducts();updateRequestTypeUI();
}

function route(page){
  if(page==='explore'&&!PUBLIC_CATALOGUE_ENABLED)page='custom';
  $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
  $$('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.route===page));
  $('#siteFooter').style.display=page==='admin'?'none':'';
  $('#mobileNav').classList.remove('open');

  // Avoid animated full-page scrolling on phones; it can feel very janky on
  // lower-powered devices, especially when the tracking page is being laid out.
  const mobile=window.matchMedia('(max-width:680px)').matches;
  window.scrollTo({top:0,behavior:mobile?'auto':'smooth'});

  // Prefill the most recently submitted order, but do not automatically start
  // a Supabase tracking request just because the customer opened Track Order.
  // The customer starts the lookup explicitly with the Track order button.
  if(page==='orders'&&lastSubmittedId){
    $('#trackingId').value=lastSubmittedId;
    $('#trackingPhone').value=lastSubmittedPhone;
  }

  if(page==='admin')renderAdmin();
  if(location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);
}
$$('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();const p=el.dataset.route;if(p==='admin')openAdmin();else route(p)}));
$('#menuBtn').onclick=()=>$('#mobileNav').classList.toggle('open');
$('#adminNavBtn').onclick=openAdmin;$('#mobileAdminBtn').onclick=openAdmin;
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(p==='admin')openAdmin();else if(['home','explore','custom','orders'].includes(p))route(p)});

function productCard(p){return `<article class="product-card" data-product-id="${p.id}"><div class="product-image" style="background:${p.bg}"><span class="product-chip">${escapeHtml(p.material)}</span><div class="product-object">${p.emoji||'◈'}</div></div><div class="product-body"><small>${escapeHtml(p.category)}</small><h3>${escapeHtml(p.name)}</h3><div class="product-meta"><span>Ready to print</span><strong class="select-to-price">Select to view price →</strong></div></div></article>`}
function renderProducts(){
  $('#homeProductGrid').innerHTML=products.slice(0,4).map(productCard).join('');
  const cats=['All',...new Set(products.map(p=>p.category))];$('#filterTabs').innerHTML=cats.map(c=>`<button class="${c==='All'?'active':''}" data-filter="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  renderCatalog();bindProductCards();$$('#filterTabs button').forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;$$('#filterTabs button').forEach(x=>x.classList.toggle('active',x===b));renderCatalog();bindProductCards()});
}
function renderCatalog(){const q=($('#catalogSearch').value||'').toLowerCase();const f=products.filter(p=>(currentFilter==='All'||p.category===currentFilter)&&`${p.name} ${p.category} ${p.material}`.toLowerCase().includes(q));$('#catalogGrid').innerHTML=f.length?f.map(productCard).join(''):'<p>No matching designs found.</p>'}
function bindProductCards(){$$('.product-card').forEach(c=>c.onclick=()=>openProductModal(c.dataset.productId))}
$('#catalogSearch').addEventListener('input',()=>{renderCatalog();bindProductCards()});

function openProductModal(id){
  const p=products.find(x=>String(x.id)===String(id));if(!p)return;
  $('#productModalContent').innerHTML=`<div class="modal-product-grid"><div class="modal-product-image" style="background:${p.bg}">${p.emoji||'◈'}</div><div><div class="eyebrow">${escapeHtml(p.category)}</div><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description||'')}</p><div class="modal-price">${money(p.price)}<small style="font:500 11px Inter;color:#7d8796"> fixed product price</small></div><div class="form-grid"><label>Your name<input id="catalogName" placeholder="Your name" /></label><label>Phone / WhatsApp<input type="tel" id="catalogPhone" inputmode="numeric" maxlength="10" placeholder="9876543210" /></label><label>Preferred colour<select id="quickColor"><option>Black</option><option>White</option><option>Red</option><option>Blue</option><option>Grey</option><option>Other / Ask lab</option></select></label><label>Quantity<input type="number" id="catalogQty" min="1" max="50" value="1" /></label></div><p class="catalog-price-note">The price shown here applies only to this ready-made model.</p><div class="modal-actions"><button class="btn primary" id="quickOrderBtn">Place request — ${money(p.price)}</button><button class="btn secondary" data-close-modal>Cancel</button></div></div></div>`;
  $('#productModalBackdrop').classList.add('open');bindPhone($('#catalogPhone'));const qty=$('#catalogQty'),btn=$('#quickOrderBtn');qty.oninput=()=>{qty.value=Math.max(1,Math.min(50,Number(qty.value)||1));btn.textContent=`Place request — ${money(p.price*Number(qty.value))}`};btn.onclick=()=>createCatalogueOrder(p);$$('[data-close-modal]').forEach(x=>x.onclick=()=>$('#productModalBackdrop').classList.remove('open'));
}
async function ensureAuthenticated(){
  if(!BACKEND_READY)return null;const {data:{session}}=await sb.auth.getSession();if(session)return session.user;const {data,error}=await sb.auth.signInAnonymously();if(error)throw error;return data.user;
}
async function createCatalogueOrder(p){
  const name=$('#catalogName').value.trim(),phone=normalizeIndianMobile($('#catalogPhone').value),qty=Math.max(1,Math.min(50,Number($('#catalogQty').value)||1));$('#catalogPhone').value=phone;
  if(!name)return showToast('Please enter your name');if(!validPhone(phone))return showToast('Enter a valid 10-digit Indian mobile number');
  try{
    let code;if(BACKEND_READY){await ensureAuthenticated();const {data,error}=await sb.rpc('create_order',{p_customer_name:name,p_phone:phone,p_email:'',p_roll_number:'',p_request_type:'Existing Design',p_product_id:p.id,p_material:p.material,p_color:$('#quickColor').value,p_quality:'standard',p_quantity:qty,p_dimensions:'',p_needed_by:null,p_notes:`Catalogue item: ${p.name}`});if(error)throw error;code=data.order_code}else{code=localOrderCode();const o=localOrders();o.unshift({id:crypto.randomUUID?.()||Date.now(),order_code:code,customer_name:name,phone,request_type:'Existing Design',product_name:p.name,material:p.material,color:$('#quickColor').value,quality:'standard',quantity:qty,status:'Awaiting Payment',created_at:new Date().toISOString(),file_name:'Catalogue item',quote:Number(p.price)*qty,quote_type:'Fixed catalogue price',payment_status:'Not Started',payment_method:'UPI'});saveLocalOrders(o)}
    $('#productModalBackdrop').classList.remove('open');showSuccess(code,phone);
  }catch(e){console.error(e);showToast(`Order could not be created: ${e.message||e}`)}
}

$$('#requestTypeChoices .choice').forEach(c=>c.addEventListener('click',()=>{setTimeout(()=>{$$('#requestTypeChoices .choice').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));updateRequestTypeUI()},0)}));
function updateRequestTypeUI(){const type=$('input[name="requestType"]:checked')?.value||'Print my model';const design=type==='Design + Print';$('#designFeeBox').classList.toggle('hidden',!design);$('#designFeeValue').textContent=money(publicSettings.design_fee||200);$('#pricingSideTitle').textContent=design?'Fixed design fee + print quote':'Quote after lab review';$('#quoteSideCopy').textContent=design?'The CAD design fee is fixed. Printing is quoted separately after the design is finalized and sliced.':'Upload your model and submit the request. Our team will review and slice it before issuing the final price.'}
$('#modelFile').addEventListener('change',e=>{const f=e.target.files[0];$('#fileName').textContent=f?`${f.name} • ${(f.size/1024/1024).toFixed(2)} MB`:'No file selected'});bindPhone($('#customPhone'));bindPhone($('#trackingPhone'));
$('#customOrderForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;const fd=new FormData(form),type=fd.get('requestType'),phone=normalizeIndianMobile(fd.get('phone')),file=$('#modelFile').files[0],notes=String(fd.get('notes')||'').trim();$('#customPhone').value=phone;
  if(!validPhone(phone))return showToast('Enter a valid 10-digit Indian mobile number');if(Number(fd.get('quantity'))<1||Number(fd.get('quantity'))>50)return showToast('Quantity must be between 1 and 50');if(type==='Print my model'&&!file)return showToast('Please upload your 3D model file');if(type==='Design + Print'&&!file&&!notes)return showToast('Upload a sketch/image or describe your idea in the notes');if(file&&file.size>25*1024*1024)return showToast('File must be 25 MB or smaller');
  try{
    let code,orderUuid;if(BACKEND_READY){const user=await ensureAuthenticated();const {data,error}=await sb.rpc('create_order',{p_customer_name:String(fd.get('customerName')).trim(),p_phone:phone,p_email:String(fd.get('email')||'').trim(),p_roll_number:String(fd.get('rollNumber')||'').trim(),p_request_type:type,p_product_id:null,p_material:fd.get('material'),p_color:fd.get('color'),p_quality:fd.get('quality'),p_quantity:Number(fd.get('quantity')),p_dimensions:String(fd.get('dimensions')||'').trim(),p_needed_by:fd.get('neededBy')||null,p_notes:notes});if(error)throw error;code=data.order_code;orderUuid=data.order_uuid;
      if(file){const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${user.id}/${orderUuid}/${Date.now()}-${safe}`;const up=await sb.storage.from('order-files').upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error)throw up.error;const at=await sb.rpc('attach_order_file',{p_order_code:code,p_phone:phone,p_file_path:path,p_file_name:file.name});if(at.error)throw at.error;}
    }else{code=localOrderCode();const o=localOrders();o.unshift({id:crypto.randomUUID?.()||Date.now(),order_code:code,customer_name:String(fd.get('customerName')).trim(),phone,email:String(fd.get('email')||''),roll_number:String(fd.get('rollNumber')||''),request_type:type,material:fd.get('material'),color:fd.get('color'),quality:fd.get('quality'),quantity:Number(fd.get('quantity')),dimensions:String(fd.get('dimensions')||''),needed_by:fd.get('neededBy')||null,notes,status:'Request Submitted',created_at:new Date().toISOString(),file_name:file?.name||null,design_fee:type==='Design + Print'?(publicSettings.design_fee||200):null});saveLocalOrders(o)}
    form.reset();$('#fileName').textContent='No file selected';updateRequestTypeUI();showSuccess(code,phone);
  }catch(err){console.error(err);showToast(`Request failed: ${err.message||err}`)}
});
function showSuccess(code,phone){lastSubmittedId=code;lastSubmittedPhone=phone;$('#successOrderId').textContent=code;$('#successModalBackdrop').classList.add('open')}
$$('[data-close-success]').forEach(x=>x.onclick=()=>$('#successModalBackdrop').classList.remove('open'));$('#trackSubmittedBtn').onclick=()=>{$('#successModalBackdrop').classList.remove('open');route('orders')};

$('#trackBtn').onclick=trackOrder;$('#demoOrderBtn').onclick=()=>{$('#trackingId').value='CVR3D-1042';$('#trackingPhone').value='9876543210';trackOrder()};
async function trackOrder(){const code=$('#trackingId').value.trim().toUpperCase(),phone=normalizeIndianMobile($('#trackingPhone').value);$('#trackingPhone').value=phone;if(!code)return showToast('Enter your order ID');if(!validPhone(phone))return showToast('Enter the same valid 10-digit mobile number used for the order');$('#trackingResult').classList.remove('hidden');$('#trackingResult').innerHTML='<p class="loading-note">Checking order…</p>';
  try{let o;if(BACKEND_READY){await ensureAuthenticated();const {data,error}=await sb.rpc('track_order',{p_order_code:code,p_phone:phone});if(error)throw error;o=data}else{o=localOrders().find(x=>x.order_code.toUpperCase()===code&&x.phone===phone)||null}if(!o){$('#trackingResult').innerHTML='<p class="error-note">No matching order was found. Check both the order ID and mobile number.</p>';return}renderTracking(o,phone)}catch(e){console.error(e);$('#trackingResult').innerHTML=`<p class="error-note">Could not track this order: ${escapeHtml(e.message||e)}</p>`}}
function buildUpiUri(order){
  const amount=Number(order.quote||0);
  const payee=publicSettings.upi_payee_name||'CVR 3D Print Lab';
  return `upi://pay?pa=${encodeURIComponent(publicSettings.upi_id)}&pn=${encodeURIComponent(payee)}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(order.order_code)}`;
}
function launchUpiPayment(uri){
  if(!uri)return showToast('UPI payment link is unavailable');
  const isAndroid=/Android/i.test(navigator.userAgent);
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  try{
    if(isAndroid){
      const intent=uri.replace(/^upi:\/\//,'intent://')+'#Intent;scheme=upi;end';
      window.location.href=intent;
      return;
    }
    if(isIOS){window.location.href=uri;return;}
    showToast('Open this page on a phone with a UPI app, or copy the UPI ID.');
  }catch(e){
    console.error('UPI launch failed:',e);
    showToast('Could not open a UPI app. Copy the UPI ID and pay manually.');
  }
}
async function copyUpiId(){
  const value=String(publicSettings.upi_id||'').trim();
  if(!value)return showToast('UPI ID is not configured');
  try{await navigator.clipboard.writeText(value);showToast('UPI ID copied')}catch(e){showToast(`UPI ID: ${value}`)}
}
function paymentPanel(o,phone){
  const amount=Number(o.quote||0);
  if(!amount)return '';
  const paymentStatus=o.payment_status||'Not Started';
  const canPay=['Awaiting Payment','Payment Submitted'].includes(o.status)||paymentStatus==='Rejected';
  if(o.status==='Paid'||paymentStatus==='Verified')return `<div class="payment-box payment-success"><div><span>Payment</span><strong>✓ Verified</strong><small>${o.payment_reference?`UPI reference: ${escapeHtml(o.payment_reference)}`:'Payment verified by the lab.'}</small></div></div>`;
  if(paymentStatus==='Submitted'||o.status==='Payment Submitted')return `<div class="payment-box"><div><span>Payment submitted</span><strong>Verification pending</strong><small>Reference: ${escapeHtml(o.payment_reference||'—')}. The lab will verify your payment before printing begins.</small></div></div>`;
  if(!canPay)return '';
  if(!publicSettings.payment_enabled||!publicSettings.upi_id)return `<div class="payment-box"><div><span>Payment</span><strong>Payment details pending</strong><small>The quotation is approved, but the lab has not configured online UPI details yet. Please contact the lab.</small></div></div>`;
  const payee=publicSettings.upi_payee_name||'CVR 3D Print Lab';
  const upi=buildUpiUri(o);
  return `<div class="payment-box"><div><span>Amount to pay</span><strong>${money(amount)}</strong><small>UPI ID: <b>${escapeHtml(publicSettings.upi_id)}</b> • Payee: ${escapeHtml(payee)}</small><small>If the UPI app does not open, copy the UPI ID and pay manually, then tap <b>I have paid</b>.</small></div><div class="payment-actions"><button class="btn primary" id="openUpiBtn" data-upi="${escapeHtml(upi)}">Open UPI app</button><button class="btn secondary" id="copyUpiBtn">Copy UPI ID</button><button class="btn secondary" id="submitPaymentRefBtn">I have paid</button></div></div>`;
}
function renderTracking(o,phone){const idx=customerStageIndex(o.status),awaiting=['Quote Prepared','Awaiting Approval'].includes(o.status)&&Number(o.quote)>0&&o.request_type!=='Existing Design';$('#trackingResult').innerHTML=`<div class="order-head"><div><small>ORDER</small><h3>${escapeHtml(o.order_code)}</h3><span>Submitted ${formatDate(o.created_at)}</span></div><span class="status-pill status-${slug(o.status)}">${escapeHtml(statusLabel(o.status))}</span></div><div class="track-steps track-steps-wide">${CUSTOMER_FLOW.map((stage,i)=>`<div class="track-step ${i<=idx?'done':''}"><b>${i<idx?'✓':i+1}</b><span>${stage}</span></div>`).join('')}</div>${Number(o.quote)>0?`<div class="customer-quote"><div><span>${escapeHtml(o.quote_type||'Final quotation')}</span><strong>${money(o.quote)}</strong>${o.request_type==='Design + Print'&&o.design_fee?`<small>Fixed CAD design fee: ${money(o.design_fee)}. Printing may be quoted separately or included in the final amount as specified by the lab.</small>`:''}</div>${awaiting?'<button class="btn primary" id="acceptQuoteBtn">Accept quotation</button>':''}</div>`:`<div class="quote-pending"><strong>Price not issued yet</strong><span>The lab will review the model and issue a final quotation before printing.</span>${o.request_type==='Design + Print'&&o.design_fee?`<small>Fixed CAD design fee: ${money(o.design_fee)}.</small>`:''}</div>`}${paymentPanel(o,phone)}<div class="order-info-grid"><div><span>Request</span><strong>${escapeHtml(o.request_type)}</strong></div><div><span>Material</span><strong>${escapeHtml(o.material||'—')} • ${escapeHtml(o.color||'—')}</strong></div><div><span>Quantity</span><strong>${o.quantity||1}</strong></div><div><span>Dimensions</span><strong>${escapeHtml(o.dimensions||'Not provided')}</strong></div><div><span>Lab-calculated weight</span><strong>${o.lab_weight!=null&&Number(o.lab_weight)>0?`${Number(o.lab_weight)} g`:'Pending review'}</strong></div><div><span>Estimated print time</span><strong>${escapeHtml(o.print_time||'Pending review')}</strong></div><div><span>File / model</span><strong>${escapeHtml(o.product_name||o.file_name||'—')}</strong></div></div>${o.notes?`<p style="font-size:12px;color:#697588;margin-top:18px"><b style="color:#344054">Notes:</b> ${escapeHtml(o.notes)}</p>`:''}`;if(awaiting)$('#acceptQuoteBtn').onclick=()=>acceptQuote(o.order_code,phone);const openUpiBtn=$('#openUpiBtn');if(openUpiBtn)openUpiBtn.onclick=()=>launchUpiPayment(openUpiBtn.dataset.upi);const copyBtn=$('#copyUpiBtn');if(copyBtn)copyBtn.onclick=copyUpiId;const payBtn=$('#submitPaymentRefBtn');if(payBtn)payBtn.onclick=()=>submitPaymentReference(o.order_code,phone)}
async function acceptQuote(code,phone){try{if(BACKEND_READY){await ensureAuthenticated();const {data,error}=await sb.rpc('accept_order_quote',{p_order_code:code,p_phone:phone});if(error)throw error;if(!data)throw new Error('Quote could not be accepted')}else{const arr=localOrders();const o=arr.find(x=>x.order_code===code);if(o){o.status='Awaiting Payment';o.approved_at=new Date().toISOString();o.payment_status='Not Started';saveLocalOrders(arr)}}showToast('Quotation accepted — complete payment to continue');trackOrder()}catch(e){showToast(e.message||'Could not accept quotation')}}
async function submitPaymentReference(code,phone){const ref=prompt('Enter the UPI transaction / UTR reference number shown in your payment app:');if(ref===null)return;const clean=String(ref).trim().replace(/\s+/g,'');if(clean.length<6||clean.length>40)return showToast('Enter a valid payment reference / UTR number');try{if(BACKEND_READY){await ensureAuthenticated();const {data,error}=await sb.rpc('submit_payment_reference',{p_order_code:code,p_phone:phone,p_payment_reference:clean});if(error)throw error;if(!data)throw new Error('Payment reference could not be submitted')}else{const arr=localOrders();const o=arr.find(x=>x.order_code===code);if(o){o.payment_reference=clean;o.payment_status='Submitted';o.payment_submitted_at=new Date().toISOString();o.status='Payment Submitted';saveLocalOrders(arr)}}showToast('Payment reference submitted for verification');trackOrder()}catch(e){showToast(e.message||'Could not submit payment reference')}}

async function openAdmin(){if(!BACKEND_READY){adminSession=true;route('admin');return}try{const {data:{session}}=await sb.auth.getSession();if(session){const {data,error}=await sb.rpc('am_i_admin');if(!error&&data){adminSession=true;route('admin');return}}}catch(e){console.error(e)}$('#adminLoginBackdrop').classList.add('open')}
$('#closeAdminLogin').onclick=()=>$('#adminLoginBackdrop').classList.remove('open');
$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();const help=$('#adminLoginHelp');help.textContent='Signing in…';try{const {data,error}=await sb.auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(error)throw error;const {data:isAdmin,error:aerr}=await sb.rpc('am_i_admin');if(aerr)throw aerr;if(!isAdmin){await sb.auth.signOut();throw new Error('This account is not authorized as a lab admin.')}adminSession=true;$('#adminUserEmail').textContent=data.user.email||'Admin';help.textContent='';$('#adminLoginBackdrop').classList.remove('open');route('admin')}catch(err){help.textContent=err.message||'Sign-in failed'}});
$('#adminLogoutBtn').onclick=async()=>{if(BACKEND_READY)await sb.auth.signOut();adminSession=false;route('home');showToast('Signed out')};

async function loadAdminData(){
  if(!BACKEND_READY){adminOrders=localOrders();adminProducts=[...products];return}
  const [{data:o,error:oe},{data:p,error:pe},{data:pub,error:pue},{data:ip,error:ie}]=await Promise.all([
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('products').select('*').order('sort_order',{ascending:true}),
    sb.from('public_settings').select('*').eq('id',1).single(),
    sb.from('internal_pricing').select('*').eq('id',1).single()
  ]);if(oe)throw oe;if(pe)throw pe;if(pue)throw pue;if(ie)throw ie;adminOrders=o||[];adminProducts=p||[];publicSettings=pub||publicSettings;internalPricing=ip||internalPricing;
}
async function renderAdmin(){if(BACKEND_READY&&!adminSession)return;$('#adminDateLabel').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('#statsGrid').innerHTML='<div class="loading-note">Loading dashboard…</div>';try{await loadAdminData();const orders=adminOrders;$('#orderCountBadge').textContent=orders.filter(o=>['Request Submitted','File Review'].includes(o.status)).length||'';const stats=[['Total orders',orders.length,'▤','All requests'],['Needs action',orders.filter(o=>['Request Submitted','File Review','Payment Submitted'].includes(o.status)).length,'●','Files / payments to check'],['Printing now',orders.filter(o=>o.status==='Printing').length,'⚙','Active queue'],['Ready to collect',orders.filter(o=>o.status==='Ready').length,'✓','Awaiting pickup']];$('#statsGrid').innerHTML=stats.map(x=>`<div class="stat-card card"><div class="stat-top"><span>${x[0]}</span><div class="stat-icon">${x[2]}</div></div><strong>${x[1]}</strong><small>${x[3]}</small></div>`).join('');$('#recentOrders').innerHTML=orders.slice(0,5).map(o=>`<div class="recent-order"><div><strong>${o.order_code}</strong><br><span>${escapeHtml(o.customer_name)}</span></div><span>${escapeHtml(o.material||o.product_name||'—')} • ${o.quantity} pc</span><strong>${o.quote?money(o.quote):'Pending'}</strong><span class="status-pill status-${slug(o.status)}">${escapeHtml(statusLabel(o.status))}</span></div>`).join('')||'<p>No orders yet.</p>';const q=orders.filter(o=>['Paid','Approved','Printing'].includes(o.status));$('#queueList').innerHTML=q.length?q.slice(0,5).map(o=>`<div class="queue-item"><div><strong>${o.order_code}</strong><span>${escapeHtml(statusLabel(o.status))}</span></div><div><span>${escapeHtml(o.customer_name)}</span><span>${escapeHtml(o.material||'—')}</span></div><div class="progress"><i style="width:${o.status==='Printing'?72:35}%"></i></div></div>`).join(''):'<p style="font-size:12px;color:#7c8797">No active jobs in the queue.</p>';renderOrdersTable();renderProductAdmin();renderPricingEditor()}catch(e){console.error(e);$('#statsGrid').innerHTML=`<p class="error-note">Admin data could not be loaded: ${escapeHtml(e.message||e)}</p>`}}

$$('.admin-tab[data-admin-tab], [data-admin-tab].text-btn').forEach(b=>b.onclick=()=>switchAdminTab(b.dataset.adminTab));
function switchAdminTab(tab){$$('.admin-panel').forEach(p=>p.classList.toggle('active',p.dataset.adminPanel===tab));$$('.admin-tab[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));$('#adminPageTitle').textContent=({overview:'Dashboard overview',requests:'Order management',products:'Catalogue setup',pricing:'Pricing settings'})[tab]||'Admin';if(tab==='requests')renderOrdersTable();if(tab==='products')renderProductAdmin();if(tab==='pricing')renderPricingEditor()}
$('#adminSearch').addEventListener('input',renderOrdersTable);
function renderOrdersTable(){const q=($('#adminSearch').value||'').toLowerCase();const rows=adminOrders.filter(o=>`${o.order_code} ${o.customer_name} ${o.material||''} ${o.request_type} ${o.product_name||''}`.toLowerCase().includes(q));$('#ordersTableBody').innerHTML=rows.map(o=>`<tr><td><strong>${o.order_code}</strong><br><span style="color:#8994a5">${formatDate(o.created_at)}</span></td><td><strong>${escapeHtml(o.customer_name)}</strong><br><span style="color:#8994a5">${escapeHtml(o.phone)}</span></td><td>${escapeHtml(o.request_type)}${o.product_name?`<br><span style="color:#8994a5">${escapeHtml(o.product_name)}</span>`:''}</td><td>${escapeHtml(o.material||'—')}<br><span style="color:#8994a5">${escapeHtml(o.color||'—')}</span></td><td><strong>${o.quote?money(o.quote):(o.design_fee?`Design ${money(o.design_fee)}`:'Pending')}</strong></td><td><select class="status-select" data-status-id="${o.id}">${[...new Set([...STATUS_FLOW,o.status,'Rejected'])].map(s=>`<option value="${escapeHtml(s)}" ${o.status===s?'selected':''}>${escapeHtml(statusLabel(s))}</option>`).join('')}</select></td><td><div class="table-actions"><button class="table-action" data-quote-id="${o.id}">${o.request_type==='Existing Design'?'Details':'Prepare quote'}</button><button class="table-action" data-view-id="${o.id}">View</button></div></td></tr>`).join('');$$('[data-status-id]').forEach(s=>s.onchange=()=>updateOrderStatus(s.dataset.statusId,s.value));$$('[data-quote-id]').forEach(b=>b.onclick=()=>editQuote(b.dataset.quoteId));$$('[data-view-id]').forEach(b=>b.onclick=()=>viewAdminOrder(b.dataset.viewId))}
async function updateOrderStatus(id,status){try{if(BACKEND_READY){const {error}=await sb.from('orders').update({status}).eq('id',id);if(error)throw error}else{const arr=localOrders(),o=arr.find(x=>String(x.id)===String(id));if(o){o.status=status;saveLocalOrders(arr)}}showToast('Order status updated');renderAdmin()}catch(e){showToast(e.message||'Update failed')}}
async function editQuote(id){const o=adminOrders.find(x=>String(x.id)===String(id));if(!o)return;if(o.request_type==='Existing Design')return viewAdminOrder(id);const weightInput=prompt('Lab-calculated filament weight (examples: 35, 35 g, or 0.035 kg):',o.lab_weight||'');if(weightInput===null)return;const weight=parseWeightGrams(weightInput);if(Number.isNaN(weight))return showToast('Enter a valid positive weight, for example 35 or 35 g');const time=prompt('Estimated print time (example: 2 h 40 min):',o.print_time||'');if(time===null)return;const amount=prompt(`Final customer quotation in ₹${o.request_type==='Design + Print'&&o.design_fee?` (fixed CAD fee: ${money(o.design_fee)})`:''}:`,o.quote||'');if(amount===null)return;const quote=Number(String(amount).replace(/[^0-9.]/g,''));if(!Number.isFinite(quote)||quote<=0)return showToast('Enter a valid quotation');const update={lab_weight:weight,print_time:String(time).trim()||null,quote,quote_type:o.request_type==='Design + Print'?'Design + printing':'Lab quotation',status:'Awaiting Approval',quote_prepared_at:new Date().toISOString()};try{if(BACKEND_READY){const {error}=await sb.from('orders').update(update).eq('id',id);if(error)throw error}else{const arr=localOrders(),x=arr.find(a=>String(a.id)===String(id));Object.assign(x,update);saveLocalOrders(arr)}showToast(`Quotation saved: ${money(quote)}${weight?` • ${weight} g`:''}`);renderAdmin()}catch(e){showToast(e.message||'Could not save quote')}}
function viewAdminOrder(id){const o=adminOrders.find(x=>String(x.id)===String(id));if(!o)return;const paymentState=o.payment_status||'Not Started';$('#adminActionContent').innerHTML=`<div class="eyebrow">ORDER DETAILS</div><h2>${escapeHtml(o.order_code)}</h2><div class="admin-action-grid"><div><span>Customer</span><strong>${escapeHtml(o.customer_name)}</strong></div><div><span>Mobile</span><strong>${escapeHtml(o.phone)}</strong></div><div><span>Email</span><strong>${escapeHtml(o.email||'—')}</strong></div><div><span>Roll / ID</span><strong>${escapeHtml(o.roll_number||'—')}</strong></div><div><span>Request</span><strong>${escapeHtml(o.request_type)}</strong></div><div><span>Status</span><strong>${escapeHtml(statusLabel(o.status))}</strong></div><div><span>Material / colour</span><strong>${escapeHtml(o.material||'—')} • ${escapeHtml(o.color||'—')}</strong></div><div><span>Quality</span><strong>${escapeHtml(o.quality||'—')}</strong></div><div><span>Quantity</span><strong>${o.quantity||1}</strong></div><div><span>Dimensions</span><strong>${escapeHtml(o.dimensions||'—')}</strong></div><div><span>Preferred date</span><strong>${formatDate(o.needed_by)}</strong></div><div><span>File</span><strong>${escapeHtml(o.file_name||o.product_name||'—')}</strong></div><div><span>Lab weight</span><strong>${o.lab_weight!=null&&Number(o.lab_weight)>0?`${Number(o.lab_weight)} g`:'Pending'}</strong></div><div><span>Print time</span><strong>${escapeHtml(o.print_time||'Pending')}</strong></div><div><span>Quote</span><strong>${o.quote?money(o.quote):'Pending'}</strong></div><div><span>Payment</span><strong>${escapeHtml(paymentState)}</strong></div><div><span>UPI reference</span><strong>${escapeHtml(o.payment_reference||'—')}</strong></div></div>${o.notes?`<p><b>Customer notes:</b> ${escapeHtml(o.notes)}</p>`:''}<div class="admin-modal-actions">${o.file_path?'<button class="btn secondary file-action" id="downloadOrderFileBtn">Download uploaded file</button>':''}${paymentState==='Submitted'||o.status==='Payment Submitted'?'<button class="btn primary" id="verifyPaymentBtn">Verify payment</button><button class="btn secondary" id="rejectPaymentBtn">Reject payment reference</button>':''}</div>`;$('#adminActionBackdrop').classList.add('open');if(o.file_path)$('#downloadOrderFileBtn').onclick=()=>downloadOrderFile(o);if($('#verifyPaymentBtn'))$('#verifyPaymentBtn').onclick=()=>verifyPayment(o.id,true);if($('#rejectPaymentBtn'))$('#rejectPaymentBtn').onclick=()=>verifyPayment(o.id,false)}
async function verifyPayment(id,approved){const o=adminOrders.find(x=>String(x.id)===String(id));if(!o)return;if(!confirm(approved?'Confirm that you have verified this payment in the receiving UPI/bank account?':'Reject this submitted payment reference and ask the customer to submit it again?'))return;const update=approved?{payment_status:'Verified',status:'Paid',payment_verified_at:new Date().toISOString()}:{payment_status:'Rejected',status:'Awaiting Payment',payment_verified_at:null};try{if(BACKEND_READY){const {error}=await sb.from('orders').update(update).eq('id',id);if(error)throw error}else{const arr=localOrders(),x=arr.find(a=>String(a.id)===String(id));Object.assign(x,update);saveLocalOrders(arr)}$('#adminActionBackdrop').classList.remove('open');showToast(approved?'Payment verified — order marked Paid':'Payment reference rejected');renderAdmin()}catch(e){showToast(e.message||'Could not update payment')}}
async function downloadOrderFile(o){
  const btn=$('#downloadOrderFileBtn');
  if(!o||!o.file_path){showToast('No uploaded file is attached to this order');return}
  const oldText=btn?btn.textContent:'';
  try{
    if(btn){btn.disabled=true;btn.textContent='Preparing download…'}
    // Use a short-lived signed download URL for private Supabase Storage files.
    // This is more reliable on deployed HTTPS sites than fetching a Blob and
    // triggering a synthetic browser download after an async request.
    const {data,error}=await sb.storage
      .from('order-files')
      .createSignedUrl(o.file_path,60,{download:true});
    if(error)throw error;
    if(!data||!data.signedUrl)throw new Error('Could not create a secure download link');
    showToast('Download starting…');
    window.location.assign(data.signedUrl);
  }catch(e){
    console.error('Order file download failed:',e);
    showToast(`Download failed: ${e.message||'Could not download file'}`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'Download uploaded file'}
  }
}
$('#closeAdminAction').onclick=()=>$('#adminActionBackdrop').classList.remove('open');

function renderProductAdmin(){$('#productAdminGrid').innerHTML=adminProducts.map(p=>`<div class="product-admin-item"><div class="product-admin-thumb" style="background:${p.bg}">${p.emoji||'◈'}</div><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.category)} • ${escapeHtml(p.material)} • fixed ${money(p.price)}${p.active===false?' • hidden':''}</span></div><button class="table-action" data-edit-product="${p.id}">Edit</button></div>`).join('');$$('[data-edit-product]').forEach(b=>b.onclick=()=>editProduct(b.dataset.editProduct))}
$('#addProductBtn').onclick=addProduct;
async function addProduct(){if(!BACKEND_READY)return showToast('Connect Supabase to add products permanently');const name=prompt('Product name:');if(!name)return;const category=prompt('Category:','Engineering')||'Other';const price=Number(prompt('Fixed price in ₹:','100'));if(!price)return;const material=prompt('Material:','PLA')||'PLA';try{const {error}=await sb.from('products').insert({name,category,price,material,emoji:'◈',description:'',sort_order:adminProducts.length+1});if(error)throw error;showToast('Product added');await loadPublicData();renderAdmin()}catch(e){showToast(e.message||'Could not add product')}}
async function editProduct(id){const p=adminProducts.find(x=>String(x.id)===String(id));if(!p)return;if(!BACKEND_READY)return showToast('Connect Supabase to edit products permanently');const name=prompt('Product name:',p.name);if(name===null)return;const price=Number(prompt('Fixed price in ₹:',p.price));if(!price)return;const active=confirm('Click OK to keep this product visible. Click Cancel to hide it.');try{const {error}=await sb.from('products').update({name,price,active}).eq('id',id);if(error)throw error;showToast('Product updated');await loadPublicData();renderAdmin()}catch(e){showToast(e.message||'Could not edit product')}}

function renderPricingEditor(){const d=publicSettings.design_fee||200,ip=internalPricing;const rows=[['design_fee','Fixed CAD design fee',d],['pla_per_gram','Internal PLA rate / gram',ip.pla_per_gram],['petg_per_gram','Internal PETG rate / gram',ip.petg_per_gram],['abs_per_gram','Internal ABS rate / gram',ip.abs_per_gram],['tpu_per_gram','Internal TPU rate / gram',ip.tpu_per_gram],['machine_hour','Internal machine rate / hour',ip.machine_hour],['handling','Internal handling reference',ip.handling]];$('#pricingEditor').innerHTML=`<div class="payment-settings"><h4>UPI payment settings</h4><label class="payment-toggle"><input type="checkbox" id="paymentEnabled" ${publicSettings.payment_enabled?'checked':''}> Enable customer UPI payments</label><label><span>UPI ID</span><input type="text" id="upiIdInput" value="${escapeHtml(publicSettings.upi_id||'')}" placeholder="example@upi"></label><label><span>Payee / lab name</span><input type="text" id="upiPayeeInput" value="${escapeHtml(publicSettings.upi_payee_name||'CVR 3D Print Lab')}" placeholder="CVR 3D Print Lab"></label><small>Use only a UPI ID officially approved for the lab/college. Customers will see this after accepting a quotation.</small></div>`+rows.map(([k,l,v])=>`<div class="price-row"><label><span>${l}</span><div style="display:flex;align-items:center;gap:6px"><b>₹</b><input type="number" step="0.1" min="0" value="${v??0}" data-price-key="${k}"></div></label></div>`).join('')+`<div class="pricing-note">Internal rates are admin-only. Customers with uploaded models see only the final quotation issued after slicing/review.</div><button class="btn primary" id="savePricingBtn">Save payment & pricing settings</button>`;$('#savePricingBtn').onclick=savePricingSettings}
async function savePricingSettings(){const vals={};$$('[data-price-key]').forEach(i=>vals[i.dataset.priceKey]=Number(i.value));const payment={payment_enabled:$('#paymentEnabled').checked,upi_id:$('#upiIdInput').value.trim(),upi_payee_name:$('#upiPayeeInput').value.trim()||'CVR 3D Print Lab'};if(payment.payment_enabled&&!/^[\w.\-]+@[\w.\-]+$/i.test(payment.upi_id))return showToast('Enter a valid UPI ID before enabling payments');if(!BACKEND_READY){Object.assign(publicSettings,{design_fee:vals.design_fee,...payment});Object.assign(internalPricing,vals);updateRequestTypeUI();return showToast('Saved for this demo session')}try{const {error:e1}=await sb.from('public_settings').update({design_fee:vals.design_fee,...payment}).eq('id',1);if(e1)throw e1;const {design_fee,...rest}=vals;const {error:e2}=await sb.from('internal_pricing').update(rest).eq('id',1);if(e2)throw e2;showToast('Payment & pricing settings saved');await loadPublicData();renderAdmin()}catch(e){showToast(e.message||'Could not save settings')}}
$('#resetDemoBtn').onclick=()=>{if(BACKEND_READY)return showToast('Reset demo is disabled while connected to Supabase');if(confirm('Reset local demo orders?')){localStorage.removeItem('cvr3d_v2_orders');showToast('Demo reset');renderAdmin()}};

setBackendBadge();const dateInput=$('#neededBy');if(dateInput)dateInput.min=new Date().toISOString().slice(0,10);loadPublicData();const initial=location.hash.slice(1);if(initial==='admin')openAdmin();else route(['custom','orders'].includes(initial)?initial:'home');
