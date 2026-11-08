// Hypothetical commercial model. Reads commercial/assumptions.json, writes commercial/scenarios.md and .json.
// Every figure is a function of editable assumptions; none are forecasts or claims.
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const A=JSON.parse(readFileSync(resolve(here,'assumptions.json'),'utf8'));
const aud=n=>n.toLocaleString('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});
export function scenario(s){
 const revenueMonth=s.employeesCovered*s.pricePerEmployeeMonth;
 // Active users settle where new activations balance churn (steady state of the activation/retention model).
 const active=s.employeesCovered*s.activationRate;
 const variable=active*(s.aiCostPerActiveUserMonth+s.hostingPerActiveUserMonth+s.supportPerActiveUserMonth);
 const grossMonth=revenueMonth-active*(s.aiCostPerActiveUserMonth+s.hostingPerActiveUserMonth);
 const contributionMonth=revenueMonth-variable-s.fixedMonthly;
 return {annualRevenue:revenueMonth*12,activeUsers:Math.round(active),grossMarginPct:revenueMonth?grossMonth/revenueMonth:0,annualContribution:contributionMonth*12,contributionMarginPct:revenueMonth?contributionMonth/revenueMonth:0,
  firstYearAfterIntegration:contributionMonth*12-s.integrationOneOff,averageActiveLifetimeMonths:1/(1-s.monthlyRetention)};
}
const res=Object.fromEntries(Object.entries(A.scenarios).map(([k,s])=>[k,scenario(s)]));
const b=A.buildVsBuy;const buildCost=b.buildTeam.engineers*b.buildTeam.fullyLoadedAnnualCostPerEngineer*b.buildTeam.months/12+b.buildTeam.productDesign*b.buildTeam.designAnnualCost*b.buildTeam.months/12;
const buildDelay=b.buildTeam.months*b.opportunityCostPerMonthOfDelay;const buyDelay=b.acquireIntegrationMonths*b.opportunityCostPerMonthOfDelay;
const bvb={build:{cost:buildCost,monthsToMarket:b.buildTeam.months,opportunityCost:buildDelay,total:buildCost+buildDelay},acquire:{cost:b.acquirePrice+b.acquireIntegrationCost,monthsToMarket:b.acquireIntegrationMonths,opportunityCost:buyDelay,total:b.acquirePrice+b.acquireIntegrationCost+buyDelay}};
writeFileSync(resolve(here,'scenarios.json'),JSON.stringify({hypothetical:true,scenarios:res,buildVsBuy:bvb},null,1));
const pct=x=>`${(x*100).toFixed(0)}%`;
writeFileSync(resolve(here,'scenarios.md'),`# Commercial scenarios (HYPOTHETICAL)\n\nGenerated from \`commercial/assumptions.json\` by \`node commercial/model.mjs\`. These are illustrations of how value would depend on assumptions. They are **not** forecasts, not Employment Hero figures, and not validated by any customer or pilot.\n\nPricing basis: ${A.pricingBasis}.\n\n| | Conservative | Base | Optimistic |\n|---|---|---|---|\n| Employees covered | ${Object.values(A.scenarios).map(s=>s.employeesCovered.toLocaleString('en-AU')).join(' | ')} |\n| Price / employee / month | ${Object.values(A.scenarios).map(s=>aud(s.pricePerEmployeeMonth).replace(/\.00$/,'')+(s.pricePerEmployeeMonth%1?'':'')).join(' | ')} |\n| Activation | ${Object.values(A.scenarios).map(s=>pct(s.activationRate)).join(' | ')} |\n| Active users (steady state) | ${Object.values(res).map(r=>r.activeUsers.toLocaleString('en-AU')).join(' | ')} |\n| Annual revenue | ${Object.values(res).map(r=>aud(r.annualRevenue)).join(' | ')} |\n| Gross margin | ${Object.values(res).map(r=>pct(r.grossMarginPct)).join(' | ')} |\n| Annual contribution | ${Object.values(res).map(r=>aud(r.annualContribution)).join(' | ')} |\n| Contribution margin | ${Object.values(res).map(r=>pct(r.contributionMarginPct)).join(' | ')} |\n| Year 1 after integration cost | ${Object.values(res).map(r=>aud(r.firstYearAfterIntegration)).join(' | ')} |\n\n## Build internally vs acquire (placeholder rates; replace with the buyer's own)\n\n| | Build | Acquire |\n|---|---|---|\n| Direct cost | ${aud(bvb.build.cost)} | ${aud(bvb.acquire.cost)} |\n| Months to market | ${bvb.build.monthsToMarket} | ${bvb.acquire.monthsToMarket} |\n| Opportunity cost of delay | ${aud(bvb.build.opportunityCost)} | ${aud(bvb.acquire.opportunityCost)} |\n| Total (cost + delay) | ${aud(bvb.build.total)} | ${aud(bvb.acquire.total)} |\n\nNot modelled: technical risk, validation cost (a user study and pilot), integration risk, retention of know-how, and the risk that the benefit doesn't drive engagement. Acquisition is **not** assumed to be preferable; with these placeholders the totals are close and depend mostly on the cost of delay.\n`);
console.log(JSON.stringify({scenarios:Object.fromEntries(Object.entries(res).map(([k,r])=>[k,{annualRevenue:Math.round(r.annualRevenue),annualContribution:Math.round(r.annualContribution)}])),buildVsBuy:{build:Math.round(bvb.build.total),acquire:Math.round(bvb.acquire.total)}}));
