export const categories=['call','listen','coffee','errand','think','family','chores','shopping','travel','work','waiting','other'] as const;
export type ValueType='movement'|'money_saved'|'social'|'experience'|'task_completed'|'time_saved'|'time_combined';
export type Idea={id:number;key:string;title:string;category:typeof categories[number];usual:string;body:string;minutes:number;extraMin:number;moneyCents:number;moneySource:'none'|'fee_avoided'|'transport_avoided'|'purchase_avoided';enjoy:string[];outdoor:boolean;effort:'gentle'|'moderate';exclude:string[];safety:string;social:boolean;output:string;family:string;mechanism:string;movementMode:string;source:'library'|'ai';image?:string;alt?:string;brief?:string};
type Row=[string,string,string,string,number,number,number,string[],boolean,'gentle'|'moderate',string[],string?,boolean?];
const rows:Row[]=[
['call-family-walk','call','Call family + Walk','Call from the sofa',24,0,0,['Family','Conversation'],true,'gentle',['Safety'],'Stay on familiar, well-lit routes.',true],
['call-pace-indoors','call','Call + Pace indoors','Seated call',15,0,0,['Conversation'],false,'gentle',[],'Clear the floor of trip hazards.'],
['call-friend-loop','call','Catch up + Loop the block','Catch-up call at home',20,0,0,['Friends','Conversation'],true,'gentle',['Safety','Walkability'],'Use one earbud near traffic.',true],
['call-work-standing','call','Work call + Walk','Audio-only meeting at the desk',25,0,0,['Accomplishment'],true,'gentle',['Unpredictable work'],'Pick a quiet route for audio.'],
['podcast-outside','listen','Podcast + Walk','Finish the episode on the sofa',18,0,0,['Podcasts','Learning'],true,'gentle',['Safety'],'Keep volume low enough to hear traffic.'],
['music-album-walk','listen','One album side + Stroll','Music in the background',20,0,0,['Music'],true,'gentle',['Safety']],
['audiobook-chores','listen','Audiobook + Tidy','Audiobook while sitting',15,-10,0,['Learning','Accomplishment'],false,'gentle',[],'Lift with care.'],
['podcast-commute-stop','listen','Podcast + Earlier stop','Ride to your usual stop',10,4,0,['Podcasts'],true,'gentle',['Walkability','Limited time','Physical limitations'],'Only on routes you know well.'],
['coffee-walk-further','coffee','Coffee + The nicer café','Closest coffee',12,6,0,['Coffee','Exploring'],true,'gentle',['Limited time','Walkability']],
['coffee-walk-home','coffee','Make coffee at home + Walk to drink it','Buy a coffee on the way',10,3,500,['Coffee','Solitude'],true,'gentle',[],'Use a lidded cup.'],
['coffee-catchup-walk','coffee','Coffee catch-up + Walk','Sit-down coffee with a friend',25,0,0,['Friends','Coffee','Conversation'],true,'gentle',['Weather'],'',true],
['collect-dinner','errand','Collect dinner instead','Order delivery',18,-2,700,['Food'],true,'gentle',['Walkability','Safety'],'Avoid poorly-lit routes after dark.'],
['post-walk','errand','Post office on foot','Drive to the post office',16,4,300,['Accomplishment'],true,'gentle',['Walkability','Limited time']],
['pharmacy-park-far','errand','Park at the quiet end','Circle for the closest space',6,-1,0,['Accomplishment'],true,'gentle',['Physical limitations']],
['bank-bike','errand','Errand by bike','Short drive',14,0,200,['Exploring'],true,'moderate',['Physical limitations','Fatigue','Safety'],'Helmet and lights.'],
['problem-walk','think','Take the problem for a walk','Stare at the screen',15,2,0,['Solitude','Accomplishment'],true,'gentle',['Unpredictable work']],
['plan-week-walk','think','Plan the week + Stroll','Plan the week at a table',15,0,0,['Accomplishment','Solitude'],true,'gentle',[]],
['decompress-walk','think','Decompress on foot','Scroll to unwind',12,0,0,['Solitude','Nature'],true,'gentle',['Recovery needs','Fatigue']],
['playground-laps','family','A few laps while they play','Sit on the bench',15,0,0,['Family'],true,'gentle',[],'Keep them in sight throughout.',true],
['school-walk','family','Walk the school run','Drive to school',20,5,200,['Family','Conversation'],true,'gentle',['Walkability','Limited time','Safety'],'Only on safe crossings.',true],
['after-dinner-stroll','family','After-dinner family stroll','TV straight after dinner',12,0,0,['Family','Conversation'],true,'gentle',['Recovery needs','Weather'],'',true],
['video-call-overseas','family','Video call + Slow walk','Video call at home',20,0,0,['Family','Conversation'],true,'gentle',['Safety'],'Watch your step on screen.',true],
['kids-garden-play','family','Join the game','Watch them play',15,0,0,['Family'],true,'moderate',['Physical limitations','Fatigue'],'',true],
['laundry-stairs','chores','Laundry in small loads','One heavy trip',6,2,0,['Accomplishment'],false,'gentle',['Physical limitations'],'Lift light loads only.'],
['garden-podcast','chores','Garden + Podcast','Podcast on the sofa, garden later',25,-15,0,['Gardening','Podcasts','Nature'],true,'moderate',['Physical limitations','Fatigue','Recovery needs'],'Kneel on padding.'],
['cooking-music','chores','Cook standing + Music','Ready meal',20,10,600,['Food','Music','Creativity'],false,'gentle',['Limited time','Fatigue']],
['bins-loop','chores','Bins + Round the block','Bins out, straight back in',7,7,0,['Solitude'],true,'gentle',['Limited time','Recovery needs']],
['groceries-walk','shopping','Top-up shop on foot','Drive for a few items',20,5,300,['Accomplishment'],true,'gentle',['Walkability','Limited time'],'Keep the load light.'],
['market-explore','shopping','Market instead of online','Order online',30,15,0,['Shopping','Exploring','Food'],true,'gentle',['Limited time','Financial pressure']],
['basket-not-trolley','shopping','Full-loop shop','Same aisles every time',6,4,0,['Shopping'],false,'gentle',['Limited time','Financial pressure']],
['commute-stop-early','travel','One stop early','Ride to the door',10,3,0,['Podcasts','Music'],true,'gentle',['Walkability','Physical limitations','Recovery needs'],'Only on routes you know.'],
['park-and-walk','travel','Park cheaper, walk in','Pay for the closest car park',12,5,900,['Accomplishment'],true,'gentle',['Limited time','Physical limitations'],'Well-lit car parks only.'],
['bike-commute-sometimes','travel',"Cycle when the weather’s kind",'Bus fare',30,5,400,['Exploring','Nature'],true,'moderate',['Physical limitations','Fatigue','Safety','Weather','Recovery needs'],'Helmet, lights, safe lanes.'],
['station-stairs','travel',"Stairs when it’s quiet",'Escalator',2,0,0,[],false,'moderate',['Physical limitations','Fatigue','Recovery needs'],'Use the handrail.'],
['walking-1on1','work','Walking one-to-one','Meeting-room one-to-one',25,0,0,['Conversation','Accomplishment'],true,'gentle',['Unpredictable work'],'',true],
['lunch-walk-out','work','Walk to get lunch','Eat at the desk',15,0,0,['Food','Solitude'],true,'gentle',['Unpredictable work','Financial pressure']],
['break-stretch','work','Break + Gentle stretch','Sit through the break',3,0,0,['Solitude'],false,'gentle',[],'Stop if anything hurts.'],
['water-refill-far','work','The far water fountain','Nearest refill',3,1,0,[],false,'gentle',['Already physically active']],
['wait-appointment','waiting','Wait on your feet','Sit in the waiting room',10,0,0,['Solitude'],true,'gentle',['Physical limitations'],'Stay within earshot.'],
['wait-pickup','waiting','Pickup wait + Stroll','Wait in the car',10,0,0,['Solitude'],true,'gentle',['Weather']],
['wait-laundry','waiting','Wash cycle walk','Wait for the cycle',15,0,0,['Nature','Solitude'],true,'gentle',['Weather']],
['photo-walk','other','Photo walk','Scroll photos on the sofa',25,10,0,['Photography','Exploring','Nature'],true,'gentle',['Limited time']],
['dog-longer','other','The longer dog walk','Usual short loop',10,10,0,['Animals','Nature'],true,'gentle',['Limited time','Recovery needs']],
['visit-friend-walk','other',"Walk to a friend’s",'Drive round',20,8,200,['Friends'],true,'gentle',['Walkability','Limited time','Safety'],'',true]
];
export const catalogue:Idea[]=rows.map((r,n)=>({id:n===0?1:n===11?0:n+2,key:r[0],category:r[1] as Idea['category'],title:n===11?'Dinner, with a little fresh air.':n===0?'Your next catch-up. Out in the world.':r[2],usual:r[3],minutes:r[4],extraMin:r[5],moneyCents:n===11?699:r[6],moneySource:r[6]?n===11?'fee_avoided':[9,25].includes(n)?'purchase_avoided':'transport_avoided':'none',enjoy:r[7],outdoor:r[8],effort:r[9],exclude:r[10],safety:r[11]||'Choose a setting, pace and movement that are comfortable for you.',social:!!r[12],output:['errand','chores','shopping','work'].includes(r[1])?r[2].split(' + ')[0]:'',family:r[1],mechanism:r[5]<=0?'combine':'substitute',movementMode:r[0]==='break-stretch'?'seated':/bike|cycle/.test(r[0])?'cycle':/stretch/.test(r[0])?'stretch':/stairs/.test(r[0])?'stairs':/garden|cooking|laundry|chores/.test(r[0])?'task':'walk',source:'library',body:r[0]==='break-stretch'?'Use an existing pause for a familiar, comfortable seated stretch. Leave it out if it does not suit you.':n===11?'Walk to pick up your takeaway. A little fresh air, and the delivery fee stays with you.':n===0?'Take your next family call outside. Keep the conversation; add a little room to breathe.':`Instead of ${r[3].charAt(0).toLowerCase()+r[3].slice(1)}, try ${r[2].charAt(0).toLowerCase()+r[2].slice(1)}. Keep what matters; choose a size that fits your day.`,...(n===11?{image:'dinner',alt:'A woman carrying takeaway dinner along a neighbourhood street at dusk'}:n===0?{minutes:12,image:'call',alt:'A man enjoying a phone conversation on a leafy park path'}:{})}));
export const byId=(id:number,generated:Idea[]=[])=>catalogue.find(i=>i.id===id)||generated.find(i=>i.id===id);
export function promised(idea:Idea):ValueType[]{return ['movement',...(idea.moneySource!=='none'&&idea.moneyCents>0?['money_saved' as const]:[]),...(idea.social?['social' as const]:['experience' as const]),...(idea.output?['task_completed' as const]:[]),...(idea.extraMin<0?['time_saved' as const]:idea.extraMin===0?['time_combined' as const]:[])];}
