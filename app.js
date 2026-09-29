(() => {
  const $ = (id) => document.getElementById(id);
  const ids = ['boothFee','travelMiles','mileageRate','travelCost','lodging','extraFixed','eventHours','attendance','visitRate','conversionRate','aov','margin','laborHours'];
  const form = $('calcForm');
  const defaults = {boothFee:125,travelMiles:40,mileageRate:.70,travelCost:'',lodging:0,extraFixed:35,eventHours:6,attendance:1200,visitRate:8,conversionRate:20,aov:38,margin:68,laborHours:4};
  let started = false;
  let lastResult = null;

  const analytics = (event, props = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({event, ...props});
    window.dispatchEvent(new CustomEvent('marketworth:analytics', {detail:{event,...props}}));
  };
  window.marketWorthAnalytics = analytics;

  const num = (id) => {
    const value = parseFloat($(id).value);
    return Number.isFinite(value) ? value : 0;
  };
  const money = (value, digits = 0) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(Number.isFinite(value) ? value : 0);
  const whole = (value) => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Math.max(0, Math.ceil(Number.isFinite(value) ? value : 0)));
  const bounded = (v,min,max) => Math.min(max,Math.max(min,v));

  function validate() {
    const checks = [
      ['eventHours', .5, Infinity, 'Event hours must be at least 0.5.'],
      ['attendance', 1, Infinity, 'Expected attendance must be at least 1.'],
      ['visitRate', 0, 100, 'Booth visit rate must be between 0% and 100%.'],
      ['conversionRate', 0, 100, 'Conversion rate must be between 0% and 100%.'],
      ['aov', .01, Infinity, 'Average order value must be greater than $0.'],
      ['margin', .1, 100, 'Gross margin must be between 0.1% and 100%.']
    ];
    for (const [id,min,max,msg] of checks) {
      const v = num(id);
      if (!Number.isFinite(v) || v < min || v > max) return msg;
    }
    for (const id of ['boothFee','travelMiles','mileageRate','travelCost','lodging','extraFixed','laborHours']) {
      if (num(id) < 0) return 'Costs and hours cannot be negative.';
    }
    return '';
  }

  function calcScenario(base, factor) {
    const attendance = base.attendance * factor.attendance;
    const visit = bounded(base.visitRate * factor.visit, 0, 1);
    const conversion = bounded(base.conversion * factor.conversion, 0, 1);
    const aov = base.aov * factor.aov;
    const sales = attendance * visit * conversion;
    const revenue = sales * aov;
    const gross = revenue * base.margin;
    const net = gross - base.totalCost;
    return {sales,revenue,gross,net};
  }

  function calculate(track = true) {
    const error = validate();
    $('formError').hidden = !error;
    $('formError').textContent = error;
    if (error) return null;

    const travelOverrideRaw = $('travelCost').value.trim();
    const travel = travelOverrideRaw === '' ? num('travelMiles') * num('mileageRate') : num('travelCost');
    const totalCost = num('boothFee') + travel + num('lodging') + num('extraFixed');
    const margin = num('margin') / 100;
    const visitRate = num('visitRate') / 100;
    const conversion = num('conversionRate') / 100;
    const attendance = num('attendance');
    const aov = num('aov');
    const totalHours = num('eventHours') + num('laborHours');
    const estimatedVisitors = attendance * visitRate;
    const estimatedBuyers = estimatedVisitors * conversion;
    const estimatedRevenue = estimatedBuyers * aov;
    const grossProfit = estimatedRevenue * margin;
    const netProfit = grossProfit - totalCost;
    const breakEvenRevenue = totalCost / margin;
    const breakEvenSalesExact = breakEvenRevenue / aov;
    const breakEvenSales = Math.ceil(breakEvenSalesExact);
    const funnelRate = visitRate * conversion;
    const customersNeeded = funnelRate > 0 ? breakEvenSalesExact / funnelRate : Infinity;
    const profitPerHour = totalHours > 0 ? netProfit / totalHours : netProfit;
    const returnOnCost = totalCost > 0 ? netProfit / totalCost : (netProfit > 0 ? Infinity : 0);

    let verdict='Borderline', cls='warn', note='The expected result is close enough to break-even that a weaker day could erase the upside.';
    if (netProfit < 0 || estimatedBuyers < breakEvenSalesExact) { verdict='Likely unprofitable'; cls='bad'; note='At these assumptions, expected gross profit does not cover the event costs.'; }
    else if (returnOnCost >= 1 || netProfit >= 250) { verdict='Strong economics'; cls='good'; note='Your expected sales comfortably clear break-even and leave meaningful profit.'; }

    const base = {attendance,visitRate,conversion,aov,margin,totalCost};
    const low = calcScenario(base,{attendance:.75,visit:.8,conversion:.8,aov:.9});
    const expected = calcScenario(base,{attendance:1,visit:1,conversion:1,aov:1});
    const high = calcScenario(base,{attendance:1.2,visit:1.15,conversion:1.15,aov:1.08});

    $('verdict').textContent=verdict; $('verdict').className=`verdict ${cls}`; $('verdictNote').textContent=note;
    $('netProfit').textContent=money(netProfit); $('profitHour').textContent=`${money(profitPerHour,2)} per hour`;
    $('totalCost').textContent=money(totalCost); $('breakEvenRevenue').textContent=money(breakEvenRevenue); $('breakEvenSales').textContent=whole(breakEvenSales);
    $('customersNeeded').textContent=Number.isFinite(customersNeeded)?whole(customersNeeded):'—'; $('estimatedBuyers').textContent=whole(estimatedBuyers);
    $('estimatedRevenue').textContent=money(estimatedRevenue); $('grossProfit').textContent=money(grossProfit); $('totalHours').textContent=`${totalHours.toFixed(totalHours%1?1:0)} hrs`;
    $('plainMath').textContent=`You expect about ${whole(estimatedBuyers)} buyers. At ${money(aov,2)} per order, that is about ${money(estimatedRevenue)} in sales. With a ${Math.round(margin*100)}% gross margin, roughly ${money(grossProfit)} remains after product costs. Subtract ${money(totalCost)} in event costs and the estimated net is ${money(netProfit)}.`;

    const setScenario=(prefix,s)=>{ $(prefix+'Sales').textContent=whole(s.sales); $(prefix+'Revenue').textContent=money(s.revenue); $(prefix+'Net').textContent=money(s.net); };
    setScenario('low',low); setScenario('exp',expected); setScenario('high',high);

    lastResult={verdict,totalCost,breakEvenRevenue,breakEvenSales,customersNeeded,estimatedBuyers,estimatedRevenue,grossProfit,netProfit,profitPerHour,totalHours,low,expected,high,inputs:Object.fromEntries(ids.map(id=>[id,$(id).value])),travel};
    if (track) analytics('calculation_completed',{verdict,net_profit:Math.round(netProfit),estimated_revenue:Math.round(estimatedRevenue)});
    return lastResult;
  }

  form.addEventListener('submit',(e)=>{e.preventDefault();calculate(true);$('results').scrollIntoView({behavior:'smooth',block:'start'});});
  ids.forEach(id=>$(id).addEventListener('input',()=>{if(!started){started=true;analytics('calculator_started');}calculate(false);}));

  $('resetBtn').addEventListener('click',()=>{for(const [id,v] of Object.entries(defaults))$(id).value=v;started=false;calculate(false);showToast('Sample values restored.');});
  $('printBtn').addEventListener('click',()=>{calculate(false);analytics('print_summary_clicked');window.print();});
  $('downloadBtn').addEventListener('click',()=>{
    const r=calculate(false); if(!r)return;
    analytics('print_summary_clicked',{format:'download'});
    const lines=[
      'MARKETWORTH — MARKET SUMMARY','',`Verdict: ${r.verdict}`,'',
      `Total event cost: ${money(r.totalCost,2)}`,`Break-even revenue: ${money(r.breakEvenRevenue,2)}`,`Break-even sales: ${r.breakEvenSales}`,`Attendance needed to break even: ${Number.isFinite(r.customersNeeded)?whole(r.customersNeeded):'Unavailable with 0% funnel rate'}`,'',
      `Estimated buyers: ${whole(r.estimatedBuyers)}`,`Estimated revenue: ${money(r.estimatedRevenue,2)}`,`Estimated gross profit: ${money(r.grossProfit,2)}`,`Estimated net profit: ${money(r.netProfit,2)}`,`Expected profit per hour: ${money(r.profitPerHour,2)}`,'',
      'SCENARIOS',`Low: ${whole(r.low.sales)} sales · ${money(r.low.revenue)} revenue · ${money(r.low.net)} net`,`Expected: ${whole(r.expected.sales)} sales · ${money(r.expected.revenue)} revenue · ${money(r.expected.net)} net`,`High: ${whole(r.high.sales)} sales · ${money(r.high.revenue)} revenue · ${money(r.high.net)} net`,'',
      'MarketWorth estimates are decision-support projections, not guarantees.'
    ];
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='marketworth-summary.txt';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Summary downloaded.');
  });
  document.querySelectorAll('[data-purchase]').forEach(el=>el.addEventListener('click',(e)=>{
    analytics('purchase_clicked',{price:9.99});
    if(el.tagName==='BUTTON'){e.preventDefault();showToast('Checkout is ready for your payment link.');}
  }));

  function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2600)}

  calculate(false);
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
})();
