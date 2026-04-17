import { useState, useCallback } from "react";

const COLORS = {
  brown: { label: "Brown", bg: "#8B4513", text: "#fff", size: 2 },
  lightblue: { label: "Light Blue", bg: "#87CEEB", text: "#000", size: 3 },
  pink: { label: "Pink", bg: "#FF69B4", text: "#fff", size: 3 },
  orange: { label: "Orange", bg: "#FFA500", text: "#000", size: 3 },
  red: { label: "Red", bg: "#E53935", text: "#fff", size: 3 },
  yellow: { label: "Yellow", bg: "#FFD700", text: "#000", size: 3 },
  green: { label: "Green", bg: "#2E7D32", text: "#fff", size: 3 },
  darkblue: { label: "Dark Blue", bg: "#1565C0", text: "#fff", size: 2 },
  railroad: { label: "Railroad", bg: "#555", text: "#fff", size: 4 },
  utility: { label: "Utility", bg: "#8BC34A", text: "#000", size: 2 },
};
const RENT = {
  brown:[1,2],lightblue:[1,2,3],pink:[1,2,4],orange:[1,3,5],
  red:[2,3,6],yellow:[2,4,6],green:[2,4,7],darkblue:[3,8],
  railroad:[1,2,3,4],utility:[1,2],
};

const buildDeck = () => {
  const cards=[]; let id=0;
  const prop=(color,name,val)=>({id:id++,type:"property",color,name,value:val});
  const money=(val)=>({id:id++,type:"money",value:val,name:`$${val}M`});
  const action=(name,val,subtype,extra={})=>({id:id++,type:"action",name,value:val,subtype,...extra});
  const rent=(colors,val)=>({id:id++,type:"rent",colors,value:val,name:colors.length===2?`Rent (${colors.map(c=>COLORS[c].label).join("/")})`: "Wild Rent",subtype:"rent"});
  cards.push(prop("brown","Mediterranean Ave",1),prop("brown","Baltic Ave",1));
  cards.push(prop("lightblue","Oriental Ave",1),prop("lightblue","Vermont Ave",1),prop("lightblue","Connecticut Ave",2));
  cards.push(prop("pink","St. Charles",2),prop("pink","States Ave",2),prop("pink","Virginia Ave",2));
  cards.push(prop("orange","St. James",2),prop("orange","Tennessee Ave",2),prop("orange","New York Ave",2));
  cards.push(prop("red","Kentucky Ave",3),prop("red","Indiana Ave",3),prop("red","Illinois Ave",3));
  cards.push(prop("yellow","Atlantic Ave",3),prop("yellow","Ventnor Ave",3),prop("yellow","Marvin Gardens",3));
  cards.push(prop("green","Pacific Ave",4),prop("green","North Carolina",4),prop("green","Pennsylvania Ave",4));
  cards.push(prop("darkblue","Park Place",4),prop("darkblue","Boardwalk",4));
  cards.push(prop("railroad","Reading RR",2),prop("railroad","Pennsylvania RR",2),prop("railroad","B&O RR",2),prop("railroad","Short Line RR",2));
  cards.push(prop("utility","Electric Company",2),prop("utility","Water Works",2));
  [1,1,1,2,2,3,3,4,4,5].forEach(v=>cards.push(money(v)));
  [10,10,10,10].forEach(v=>cards.push(money(v)));
  for(let i=0;i<10;i++) cards.push(action("Pass Go",1,"passgo"));
  for(let i=0;i<3;i++) cards.push(action("Deal Breaker",5,"dealbreaker"));
  for(let i=0;i<3;i++) cards.push(action("Sly Deal",3,"slydeal"));
  for(let i=0;i<4;i++) cards.push(action("Forced Deal",3,"forceddeal"));
  for(let i=0;i<3;i++) cards.push(action("Debt Collector",3,"debtcollector",{amount:5}));
  for(let i=0;i<3;i++) cards.push(action("It's My Birthday",2,"birthday",{amount:2}));
  for(let i=0;i<3;i++) cards.push(action("Just Say No!",4,"jsn"));
  for(let i=0;i<3;i++) cards.push(action("Double the Rent",1,"doublerent"));
  for(let i=0;i<2;i++) cards.push(action("House",3,"house"));
  for(let i=0;i<2;i++) cards.push(action("Hotel",4,"hotel"));
  cards.push(rent(["brown","lightblue"],1));cards.push(rent(["pink","orange"],1));
  cards.push(rent(["red","yellow"],1));cards.push(rent(["green","darkblue"],1));
  cards.push(rent(["railroad","utility"],1));
  for(let i=0;i<3;i++) cards.push(rent(Object.keys(COLORS),3));
  return cards;
};

const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const isComplete=(sets,color)=>sets[color]&&sets[color].length>=COLORS[color].size;
const countComplete=sets=>Object.keys(COLORS).filter(c=>isComplete(sets,c)).length;
const calcRent=(sets,color,doubled)=>{const cnt=(sets[color]||[]).length;const arr=RENT[color];if(!arr||cnt===0)return 0;const base=arr[Math.min(cnt-1,arr.length-1)]||0;return doubled?base*2:base;};
const bankValue=bank=>bank.reduce((s,c)=>s+c.value,0);

const CardView=({card,isSelected,disabled,onClick,small})=>{
  const w=small?52:70,h=small?70:92;
  return(
    <div onClick={disabled?undefined:onClick} style={{display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:w,minHeight:h,borderRadius:6,border:isSelected?"2px solid #1565C0":"0.5px solid var(--color-border-secondary)",background:card.type==="property"?COLORS[card.color]?.bg:card.type==="money"?"#e8f5e9":card.type==="rent"?"#fff8e1":"#e3f2fd",color:card.type==="property"?COLORS[card.color]?.text:"#000",fontSize:9,padding:"4px 2px",cursor:disabled?"default":"pointer",opacity:disabled?0.4:1,boxSizing:"border-box",textAlign:"center",flexShrink:0}}>
      {card.type==="property"&&<div style={{fontSize:8,marginBottom:1,opacity:0.8}}>{COLORS[card.color]?.label}</div>}
      <div style={{fontWeight:500,fontSize:small?8:10,lineHeight:1.2,padding:"0 2px"}}>{card.name}</div>
      <div style={{fontSize:10,fontWeight:500,marginTop:2}}>${card.value}M</div>
      {card.subtype==="rent"&&<div style={{fontSize:7,opacity:0.7}}>Rent</div>}
    </div>
  );
};

const PropertySet=({color,cards})=>(
  <div style={{marginBottom:6}}>
    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginBottom:2}}>{COLORS[color].label} ({cards.length}/{COLORS[color].size}){isComplete({[color]:cards},color)?" ✓":""}</div>
    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{cards.map(c=><CardView key={c.id} card={c} small disabled/>)}</div>
  </div>
);

export default function MonopolyDeal() {
  const [screen,setScreen]=useState("menu");
  const [difficulty,setDifficulty]=useState("medium");
  const [deck,setDeck]=useState([]);
  const [playerHand,setPlayerHand]=useState([]);
  const [aiHand,setAiHand]=useState([]);
  const [playerBank,setPlayerBank]=useState([]);
  const [aiBank,setAiBank]=useState([]);
  const [playerSets,setPlayerSets]=useState({});
  const [aiSets,setAiSets]=useState({});
  const [turn,setTurn]=useState("player");
  const [playsLeft,setPlaysLeft]=useState(3);
  const [log,setLog]=useState([]);
  const [gameOver,setGameOver]=useState(null);
  const [selected,setSelected]=useState(null);
  const [pendingAction,setPendingAction]=useState(null);
  const [aiThinking,setAiThinking]=useState(false);
  const [doubleActive,setDoubleActive]=useState(false);
  const [discardMode,setDiscardMode]=useState(false);
  const [discardSelected,setDiscardSelected]=useState([]);
  const [mustDraw,setMustDraw]=useState(true);
  // jsnPrompt: {amount, color, actionType, resolve} — shown when player is actioned against
  const [jsnPrompt,setJsnPrompt]=useState(null);

  const addLog=msg=>setLog(l=>[msg,...l].slice(0,20));
  const checkWin=useCallback((sets,who)=>{if(countComplete(sets)>=3){setGameOver(who);return true;}return false;},[]);

  const initGame=useCallback(()=>{
    const d=shuffle(buildDeck());
    setDeck(d.slice(10));setPlayerHand(d.slice(0,5));setAiHand(d.slice(5,10));
    setPlayerBank([]);setAiBank([]);setPlayerSets({});setAiSets({});
    setTurn("player");setPlaysLeft(3);setMustDraw(true);
    setLog(["Game started! Draw 2 cards to begin your turn."]);
    setGameOver(null);setSelected(null);setPendingAction(null);setDoubleActive(false);
    setDiscardMode(false);setDiscardSelected([]);setJsnPrompt(null);
    setScreen("game");
  },[]);

  const payRent=useCallback((amount,payerBank,payerSets,setBankFn,setSetsFn,setReceiverBank)=>{
    let rem=amount;
    const newBank=[...payerBank];const newSets=JSON.parse(JSON.stringify(payerSets));const paid=[];
    [...newBank].sort((a,b)=>b.value-a.value).forEach(card=>{if(rem<=0)return;paid.push(card);rem-=card.value;newBank.splice(newBank.findIndex(c=>c.id===card.id),1);});
    if(rem>0){for(const color of Object.keys(newSets)){if(rem<=0)break;while(newSets[color]?.length>0&&rem>0){const card=newSets[color].pop();paid.push(card);rem-=card.value;}}}
    setBankFn(newBank);setSetsFn(newSets);setReceiverBank(b=>[...b,...paid]);
  },[]);

  const switchToAI=useCallback((aiH,deckState)=>{
    setTurn("ai");setAiThinking(true);addLog("AI is thinking...");
    setTimeout(()=>runAiTurn(aiH,deckState),1000);
  },[]);

  const finishPlayerTurn=useCallback((hand,aiH,deckState)=>{
    setSelected(null);setPendingAction(null);setDoubleActive(false);setPlaysLeft(0);
    if(hand.length>7){setDiscardMode(true);setDiscardSelected([]);setPlayerHand(hand);addLog(`You have ${hand.length} cards — discard ${hand.length-7} to get to 7.`);}
    else{setPlayerHand(hand);switchToAI(aiH,deckState);}
  },[switchToAI]);

  const confirmDiscard=useCallback(()=>{
    const needed=playerHand.length-7;
    if(discardSelected.length!==needed)return;
    const newHand=playerHand.filter(c=>!discardSelected.includes(c.id));
    setPlayerHand(newHand);setDiscardMode(false);setDiscardSelected([]);addLog("Cards discarded.");
    switchToAI(aiHand,deck);
  },[playerHand,discardSelected,aiHand,deck,switchToAI]);

  const endTurn=useCallback(()=>{
    if(turn!=="player"||discardMode||mustDraw)return;
    setSelected(null);setPendingAction(null);
    finishPlayerTurn(playerHand,aiHand,deck);
  },[turn,discardMode,mustDraw,playerHand,aiHand,deck,finishPlayerTurn]);

  const playerDraw=()=>{
    if(turn!=="player"||discardMode||!mustDraw)return;
    const drawn=deck.slice(0,2);const newDeck=deck.slice(2);
    const newHand=[...playerHand,...drawn];
    setDeck(newDeck);setPlayerHand(newHand);setMustDraw(false);
    addLog(`You drew ${drawn.length} card${drawn.length!==1?"s":""}. Play up to 3 cards or end your turn.`);
  };

  // Ask player if they want to JSN, resolve with true/false
  const askJsn=useCallback((prompt)=>new Promise(resolve=>{
    setJsnPrompt({...prompt,resolve});
  }),[]);

  const runAiTurn=useCallback((aiH,deckState)=>{
    let hand=[...aiH];let deckCur=[...deckState];let plays=0;

    const step=(curAiSets,curAiBank,curPB,curPS)=>{
      if(plays>=3||hand.length===0){
        const drawn=deckCur.splice(0,2);hand=[...hand,...drawn];
        if(hand.length>7)hand=hand.slice(0,7);
        setAiHand(hand);setDeck(deckCur);setTurn("player");setPlaysLeft(3);setMustDraw(true);
        setDoubleActive(false);setAiThinking(false);
        addLog("AI ended its turn. Draw 2 cards to start your turn.");
        return;
      }

      // --- Easy: mostly play properties, rarely steal or rent ---
      // --- Medium: properties + rent + passgo + some steals ---
      // --- Hard: aggressive — always rent, steal, doublerent combos ---

      let played=false;

      // Hard: Deal Breaker if player has a complete set
      if(!played&&difficulty==="hard"){
        const db=hand.find(c=>c.subtype==="dealbreaker");
        if(db){
          const completeColor=Object.keys(curPS).find(c=>isComplete(curPS,c));
          if(completeColor){
            hand=hand.filter(c=>c.id!==db.id);
            const stolen=curPS[completeColor]||[];
            const newPS={...curPS};delete newPS[completeColor];
            const newAiSets={...curAiSets,[completeColor]:stolen};
            setAiSets(newAiSets);setAiHand([...hand]);
            setPlayerSets(newPS);
            addLog(`AI played Deal Breaker and stole your complete ${COLORS[completeColor].label} set!`);
            plays++;played=true;
            if(checkWin(newAiSets,"ai"))return;
            setTimeout(()=>step(newAiSets,curAiBank,newPS,curPB),900);return;
          }
        }
      }

      // Medium+: Double the Rent combo — if holding a double + rent card
      if(!played&&difficulty!=="easy"){
        const dtr=hand.find(c=>c.subtype==="doublerent");
        const rentCard=hand.find(c=>c.subtype==="rent"&&c!==dtr);
        if(dtr&&rentCard&&plays<=1){
          const validColor=(rentCard.colors||[]).find(col=>(curAiSets[col]||[]).length>0);
          if(validColor){
            hand=hand.filter(c=>c.id!==dtr.id);
            setAiHand([...hand]);
            addLog("AI played Double the Rent!");
            plays++;
            setTimeout(()=>{
              hand=hand.filter(c=>c.id!==rentCard.id);
              const amt=calcRent(curAiSets,validColor,true);
              setAiHand([...hand]);
              addLog(`AI charges DOUBLE rent for ${COLORS[validColor].label}: $${amt}M!`);
              let newPB=[...curPB];let newPS2=JSON.parse(JSON.stringify(curPS));let newAB=[...curAiBank];
              payRent(amt,newPB,newPS2,b=>{newPB=b;setPlayerBank(b);},s=>{newPS2=s;setPlayerSets(s);},b=>{newAB=b;setAiBank(b);});
              plays++;
              setTimeout(()=>step(curAiSets,newAB,newPB,newPS2),900);
            },800);
            return;
          }
        }
      }

      // Hard+Medium: Sly Deal — steal a property from an incomplete set
      if(!played&&(difficulty==="hard"||(difficulty==="medium"&&Math.random()<0.5))){
        const sd=hand.find(c=>c.subtype==="slydeal");
        if(sd){
          const stealColor=Object.keys(curPS).find(c=>(curPS[c]||[]).length>0&&!isComplete(curPS,c));
          if(stealColor){
            hand=hand.filter(c=>c.id!==sd.id);
            const colorCards=curPS[stealColor];
            const stolen=colorCards[colorCards.length-1];
            const newPS={...curPS,[stealColor]:colorCards.slice(0,-1)};
            const newAiSets={...curAiSets,[stolen.color]:[...(curAiSets[stolen.color]||[]),stolen]};
            setAiSets(newAiSets);setAiHand([...hand]);setPlayerSets(newPS);
            addLog(`AI played Sly Deal and stole your ${stolen.name}!`);
            plays++;played=true;
            if(checkWin(newAiSets,"ai"))return;
            setTimeout(()=>step(newAiSets,curAiBank,curPB,newPS),900);return;
          }
        }
      }

      // All difficulties: play properties (prioritise completing sets)
      if(!played){
        const props=hand.filter(c=>c.type==="property");
        if(props.length>0){
          const sorted=[...props].sort((a,b)=>{
            const aLeft=COLORS[a.color].size-(curAiSets[a.color]||[]).length;
            const bLeft=COLORS[b.color].size-(curAiSets[b.color]||[]).length;
            return aLeft-bLeft;
          });
          const card=sorted[0];hand=hand.filter(c=>c.id!==card.id);
          const newSets={...curAiSets,[card.color]:[...(curAiSets[card.color]||[]),card]};
          setAiSets(newSets);setAiHand([...hand]);
          addLog(`AI played ${card.name} to ${COLORS[card.color].label}.`);
          plays++;played=true;
          if(checkWin(newSets,"ai"))return;
          setTimeout(()=>step(newSets,curAiBank,curPB,curPS),900);return;
        }
      }

      // Medium+: Pass Go
      if(!played&&difficulty!=="easy"){
        const pg=hand.find(c=>c.subtype==="passgo");
        if(pg){
          hand=hand.filter(c=>c.id!==pg.id);
          const drawn=deckCur.splice(0,2);hand=[...hand,...drawn];
          setAiHand([...hand]);setDeck([...deckCur]);
          addLog("AI played Pass Go and drew 2 cards.");
          plays++;played=true;
          setTimeout(()=>step(curAiSets,curAiBank,curPB,curPS),900);return;
        }
      }

      // Medium+: Charge rent
      if(!played&&difficulty!=="easy"){
        const rentCard=hand.find(c=>c.subtype==="rent");
        if(rentCard){
          // pick highest-value colour available
          const validColors=(rentCard.colors||[]).filter(col=>(curAiSets[col]||[]).length>0);
          const bestColor=validColors.sort((a,b)=>calcRent(curAiSets,b,false)-calcRent(curAiSets,a,false))[0];
          if(bestColor){
            const amt=calcRent(curAiSets,bestColor,false);
            if(amt>0){
              hand=hand.filter(c=>c.id!==rentCard.id);setAiHand([...hand]);
              addLog(`AI charges rent for ${COLORS[bestColor].label}: $${amt}M!`);
              // Check if player has JSN
              const playerJsn=curPS; // placeholder — we prompt below
              let newPB=[...curPB];let newPS2=JSON.parse(JSON.stringify(curPS));let newAB=[...curAiBank];
              payRent(amt,newPB,newPS2,b=>{newPB=b;setPlayerBank(b);},s=>{newPS2=s;setPlayerSets(s);},b=>{newAB=b;setAiBank(b);});
              plays++;played=true;
              setTimeout(()=>step(curAiSets,newAB,newPB,newPS2),900);return;
            }
          }
        }
      }

      // Hard: Birthday / Debt Collector
      if(!played&&difficulty==="hard"){
        const bday=hand.find(c=>c.subtype==="birthday");
        if(bday){
          hand=hand.filter(c=>c.id!==bday.id);setAiHand([...hand]);
          const amt=bday.amount||2;
          addLog(`AI played It's My Birthday! You pay $${amt}M.`);
          let newPB=[...curPB];let newPS2=JSON.parse(JSON.stringify(curPS));let newAB=[...curAiBank];
          payRent(amt,newPB,newPS2,b=>{newPB=b;setPlayerBank(b);},s=>{newPS2=s;setPlayerSets(s);},b=>{newAB=b;setAiBank(b);});
          plays++;played=true;
          setTimeout(()=>step(curAiSets,newAB,newPB,newPS2),900);return;
        }
        const dc=hand.find(c=>c.subtype==="debtcollector");
        if(dc){
          hand=hand.filter(c=>c.id!==dc.id);setAiHand([...hand]);
          const amt=dc.amount||5;
          addLog(`AI played Debt Collector! You must pay $${amt}M.`);
          let newPB=[...curPB];let newPS2=JSON.parse(JSON.stringify(curPS));let newAB=[...curAiBank];
          payRent(amt,newPB,newPS2,b=>{newPB=b;setPlayerBank(b);},s=>{newPS2=s;setPlayerSets(s);},b=>{newAB=b;setAiBank(b);});
          plays++;played=true;
          setTimeout(()=>step(curAiSets,newAB,newPB,newPS2),900);return;
        }
      }

      // Easy: Pass Go only
      if(!played&&difficulty==="easy"){
        const pg=hand.find(c=>c.subtype==="passgo");
        if(pg){
          hand=hand.filter(c=>c.id!==pg.id);
          const drawn=deckCur.splice(0,2);hand=[...hand,...drawn];
          setAiHand([...hand]);setDeck([...deckCur]);
          addLog("AI played Pass Go and drew 2 cards.");
          plays++;played=true;
          setTimeout(()=>step(curAiSets,curAiBank,curPB,curPS),900);return;
        }
      }

      // Fallback: bank something
      if(!played){
        const bankable=hand.find(c=>c.type==="money"||(c.type==="action"&&!["jsn","dealbreaker","slydeal","forceddeal","doublerent"].includes(c.subtype)));
        if(bankable){
          hand=hand.filter(c=>c.id!==bankable.id);const newAB=[...curAiBank,bankable];
          setAiHand([...hand]);setAiBank(newAB);
          addLog(`AI banked ${bankable.name}.`);plays++;played=true;
          setTimeout(()=>step(curAiSets,newAB,curPB,curPS),900);return;
        }
        // last resort: bank anything
        if(hand.length>0){
          const card=hand[0];hand=hand.slice(1);const newAB=[...curAiBank,card];
          setAiHand([...hand]);setAiBank(newAB);
          addLog(`AI banked ${card.name}.`);plays++;
          setTimeout(()=>step(curAiSets,newAB,curPB,curPS),900);return;
        }
      }
      plays=3;step(curAiSets,curAiBank,curPB,curPS);
    };

    setAiSets(cas=>{ setAiBank(cab=>{ setPlayerBank(cpb=>{ setPlayerSets(cps=>{ step(cas,cab,cpb,cps); return cps; }); return cpb; }); return cab; }); return cas; });
  },[difficulty,payRent,checkWin]);

  const handleCardClick=card=>{
    if(turn!=="player"||playsLeft<=0||discardMode||mustDraw)return;
    // JSN can only be played reactively — not from hand proactively
    if(card.subtype==="jsn") return;
    setSelected(s=>s?.id===card.id?null:card);
  };

  const handlePlaySelected=mode=>{
    if(!selected||turn!=="player"||playsLeft<=0)return;
    const card=selected;setSelected(null);

    if(card.type==="money"||mode==="bank"){
      if(card.type==="property"){addLog("Properties can't be banked.");return;}
      const newHand=playerHand.filter(c=>c.id!==card.id);
      setPlayerBank(b=>[...b,card]);setPlaysLeft(p=>p-1);
      addLog(`You banked ${card.name} ($${card.value}M).`);
      if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
    }

    if(card.type==="property"){
      const newHand=playerHand.filter(c=>c.id!==card.id);
      const newSets={...playerSets,[card.color]:[...(playerSets[card.color]||[]),card]};
      setPlayerSets(newSets);setPlaysLeft(p=>p-1);
      addLog(`You played ${card.name} to ${COLORS[card.color].label}.`);
      if(checkWin(newSets,"player"))return;
      if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
    }

    if(card.type==="action"||card.type==="rent"){
      if(card.subtype==="passgo"){
        const drawn=deck.slice(0,2);const newDeck=deck.slice(2);
        const newHand=[...playerHand.filter(c=>c.id!==card.id),...drawn];
        setDeck(newDeck);setPlaysLeft(p=>p-1);addLog("You played Pass Go and drew 2 cards!");
        if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,newDeck);else setPlayerHand(newHand);return;
      }
      if(card.subtype==="birthday"){
        const amt=card.amount||2;const newHand=playerHand.filter(c=>c.id!==card.id);
        addLog(`It's My Birthday! AI pays you $${amt}M.`);
        payRent(amt,aiBank,aiSets,setAiBank,setAiSets,b=>setPlayerBank(b));
        setPlaysLeft(p=>p-1);
        if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
      }
      if(card.subtype==="debtcollector"){
        const amt=card.amount||5;const newHand=playerHand.filter(c=>c.id!==card.id);
        addLog(`Debt Collector! AI pays you $${amt}M.`);
        payRent(amt,aiBank,aiSets,setAiBank,setAiSets,b=>setPlayerBank(b));
        setPlaysLeft(p=>p-1);
        if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
      }
      if(card.subtype==="doublerent"){
        const newHand=playerHand.filter(c=>c.id!==card.id);
        setDoubleActive(true);setPlaysLeft(p=>p-1);addLog("Double the Rent is active!");
        if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
      }
      if(card.subtype==="rent"){setPendingAction({card,step:"chooseColor"});return;}
      if(["dealbreaker","slydeal","forceddeal"].includes(card.subtype)){setPendingAction({card,step:"chooseTarget"});return;}
      // bank house/hotel/other actions
      const newHand=playerHand.filter(c=>c.id!==card.id);
      setPlayerBank(b=>[...b,card]);setPlaysLeft(p=>p-1);
      addLog(`You banked ${card.name}.`);
      if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);
    }
  };

  const handleColorChoose=color=>{
    if(!pendingAction)return;
    const card=pendingAction.card;const amt=calcRent(playerSets,color,doubleActive);
    addLog(`You charged rent for ${COLORS[color].label}: $${amt}M!${doubleActive?" (Doubled!)":""}`);
    const newHand=playerHand.filter(c=>c.id!==card.id);
    setDoubleActive(false);
    payRent(amt,aiBank,aiSets,setAiBank,setAiSets,b=>setPlayerBank(b));
    setPlaysLeft(p=>p-1);setPendingAction(null);
    if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);
  };

  const handleTargetChoose=color=>{
    if(!pendingAction)return;
    const card=pendingAction.card;const newHand=playerHand.filter(c=>c.id!==card.id);
    if(card.subtype==="dealbreaker"){
      if(!isComplete(aiSets,color)){addLog("That set isn't complete!");return;}
      const stolen=aiSets[color]||[];
      setAiSets(s=>{const n={...s};delete n[color];return n;});
      const newSets={...playerSets,[color]:stolen};
      setPlayerSets(newSets);setPlaysLeft(p=>p-1);setPendingAction(null);
      addLog(`DEAL BREAKER! You stole AI's complete ${COLORS[color].label} set!`);
      if(checkWin(newSets,"player"))return;
      if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);return;
    }
    if(card.subtype==="slydeal"){
      const colorCards=aiSets[color]||[];if(colorCards.length===0){addLog("AI has nothing there!");return;}
      const stolen=colorCards[colorCards.length-1];
      setAiSets(s=>({...s,[color]:s[color].slice(0,-1)}));
      const newSets={...playerSets,[stolen.color]:[...(playerSets[stolen.color]||[]),stolen]};
      setPlayerSets(newSets);setPlaysLeft(p=>p-1);setPendingAction(null);
      addLog(`SLY DEAL! You stole ${stolen.name}!`);
      if(checkWin(newSets,"player"))return;
      if(playsLeft-1<=0)finishPlayerTurn(newHand,aiHand,deck);else setPlayerHand(newHand);
    }
  };

  // Player responds to a JSN prompt
  const handleJsnResponse=(useIt)=>{
    if(!jsnPrompt)return;
    const {amount,actionType,onAccept,onBlock,resolve}=jsnPrompt;
    setJsnPrompt(null);
    if(useIt){
      // remove JSN from hand
      const jsnCard=playerHand.find(c=>c.subtype==="jsn");
      if(jsnCard){
        setPlayerHand(h=>h.filter(c=>c.id!==jsnCard.id));
        addLog("You played Just Say No! — action blocked!");
        if(onBlock)onBlock();
      }
    } else {
      addLog("You accepted the action.");
      if(onAccept)onAccept();
    }
    if(resolve)resolve(useIt);
  };

  if(screen==="menu")return(
    <div style={{padding:"2rem 1.5rem",maxWidth:480,margin:"0 auto"}}>
      <h2 style={{fontSize:22,fontWeight:500,marginBottom:8,color:"var(--color-text-primary)"}}>Monopoly Deal</h2>
      <p style={{color:"var(--color-text-secondary)",fontSize:14,marginBottom:24}}>Collect 3 complete property sets to win. Play up to 3 cards per turn.</p>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:10,color:"var(--color-text-primary)"}}>Difficulty</div>
        <div style={{display:"flex",gap:8}}>
          {["easy","medium","hard"].map(d=>(
            <button key={d} onClick={()=>setDifficulty(d)} style={{flex:1,padding:"10px 0",borderRadius:8,border:difficulty===d?"2px solid #1565C0":"0.5px solid var(--color-border-secondary)",background:difficulty===d?"#e3f2fd":"var(--color-background-secondary)",color:difficulty===d?"#1565C0":"var(--color-text-primary)",cursor:"pointer",fontSize:13,fontWeight:difficulty===d?500:400}}>
              {d.charAt(0).toUpperCase()+d.slice(1)}
            </button>
          ))}
        </div>
        <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:8}}>
          {difficulty==="easy"?"Always plays properties; occasionally Pass Go's; no steals or rent.":difficulty==="medium"?"Plays properties, Pass Go's, charges rent, and sometimes steals.":"Fully aggressive — Deal Breakers, Double Rent combos, Sly Deals, Debt Collectors every turn."}
        </div>
      </div>
      <button onClick={initGame} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"none",background:"#1565C0",color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer"}}>Deal Cards</button>
    </div>
  );

  if(gameOver)return(
    <div style={{padding:"2rem 1.5rem",maxWidth:480,margin:"0 auto",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>{gameOver==="player"?"🏆":"💸"}</div>
      <h2 style={{fontSize:22,fontWeight:500,color:"var(--color-text-primary)",marginBottom:8}}>{gameOver==="player"?"You Win!":"AI Wins!"}</h2>
      <p style={{color:"var(--color-text-secondary)",fontSize:14,marginBottom:24}}>{gameOver==="player"?"You completed 3 property sets first!":"The AI completed 3 property sets. Better luck next time!"}</p>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        <button onClick={initGame} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"#1565C0",color:"#fff",fontSize:14,cursor:"pointer"}}>Play Again</button>
        <button onClick={()=>setScreen("menu")} style={{padding:"10px 20px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontSize:14,cursor:"pointer"}}>Menu</button>
      </div>
    </div>
  );

  const rentColors=pendingAction?.card?.colors||Object.keys(COLORS);
  const validRentColors=pendingAction?.step==="chooseColor"?rentColors.filter(c=>(playerSets[c]||[]).length>0):Object.keys(aiSets).filter(c=>(aiSets[c]||[]).length>0);
  const isPlayerActive=turn==="player"&&!aiThinking&&!discardMode&&playsLeft>0&&!mustDraw&&!jsnPrompt;
  const discardNeeded=discardMode?playerHand.length-7:0;
  const playerHasJsn=playerHand.some(c=>c.subtype==="jsn");

  return(
    <div style={{padding:"1rem",maxWidth:620,margin:"0 auto",fontSize:13}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontWeight:500,fontSize:14,color:"var(--color-text-primary)"}}>Monopoly Deal</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{difficulty} mode</span>
          <button onClick={()=>setScreen("menu")} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",cursor:"pointer",color:"var(--color-text-primary)"}}>Menu</button>
        </div>
      </div>

      {/* AI board */}
      <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 12px",marginBottom:10,border:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:6}}>
          AI | Bank: ${bankValue(aiBank)}M | Sets: {countComplete(aiSets)}/3 | Hand: {aiHand.length}
          {aiThinking&&<span style={{color:"#1565C0",marginLeft:8}}>thinking...</span>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
          {aiHand.map(c=><div key={c.id} style={{width:44,height:62,borderRadius:5,background:"#1565C0",border:"0.5px solid #0d47a1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",opacity:0.8}}>?</div>)}
        </div>
        {Object.keys(aiSets).filter(c=>(aiSets[c]||[]).length>0).length>0&&(
          <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:8}}>
            <div style={{fontSize:10,color:"var(--color-text-secondary)",marginBottom:4}}>AI's properties:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>{Object.entries(aiSets).filter(([,cards])=>cards.length>0).map(([color,cards])=><PropertySet key={color} color={color} cards={cards}/>)}</div>
          </div>
        )}
      </div>

      {/* Log + deck */}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{width:70,background:"var(--color-background-secondary)",borderRadius:8,padding:"6px 8px",border:"0.5px solid var(--color-border-tertiary)",fontSize:11,color:"var(--color-text-secondary)",textAlign:"center"}}>
          <div style={{fontWeight:500}}>Deck</div><div>{deck.length}</div>
        </div>
        <div style={{flex:1,background:"var(--color-background-secondary)",borderRadius:8,padding:"6px 10px",border:"0.5px solid var(--color-border-tertiary)",fontSize:11,color:"var(--color-text-secondary)"}}>{log[0]||"—"}</div>
      </div>

      {/* Player board */}
      <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 12px",marginBottom:10,border:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:6}}>
          Your Board | Bank: ${bankValue(playerBank)}M | Sets: {countComplete(playerSets)}/3
          {doubleActive&&<span style={{color:"#E65100",marginLeft:8}}>DOUBLE RENT ACTIVE</span>}
        </div>
        {Object.keys(playerSets).filter(c=>(playerSets[c]||[]).length>0).length>0
          ?<div style={{display:"flex",flexWrap:"wrap",gap:10}}>{Object.entries(playerSets).filter(([,cards])=>cards.length>0).map(([color,cards])=><PropertySet key={color} color={color} cards={cards}/>)}</div>
          :<div style={{fontSize:11,color:"var(--color-text-tertiary)"}}>No properties yet.</div>}
      </div>

      {/* Just Say No prompt */}
      {jsnPrompt&&(
        <div style={{background:"#fce4ec",borderRadius:8,padding:"12px 14px",marginBottom:10,border:"0.5px solid #f48fb1"}}>
          <div style={{fontSize:13,fontWeight:500,color:"#c62828",marginBottom:4}}>The AI is actioning against you!</div>
          <div style={{fontSize:12,color:"var(--color-text-primary)",marginBottom:10}}>{jsnPrompt.description}</div>
          {playerHasJsn
            ?<div style={{display:"flex",gap:8}}>
              <button onClick={()=>handleJsnResponse(true)} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#c62828",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:500}}>Play Just Say No!</button>
              <button onClick={()=>handleJsnResponse(false)} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",fontSize:12,cursor:"pointer",color:"var(--color-text-primary)"}}>Accept</button>
            </div>
            :<div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>You don't have a Just Say No card.</span>
              <button onClick={()=>handleJsnResponse(false)} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#1565C0",color:"#fff",fontSize:12,cursor:"pointer"}}>Accept</button>
            </div>}
        </div>
      )}

      {/* Pending actions */}
      {pendingAction?.step==="chooseColor"&&(
        <div style={{background:"#e3f2fd",borderRadius:8,padding:"10px 12px",marginBottom:10,border:"0.5px solid #90caf9"}}>
          <div style={{fontSize:12,fontWeight:500,color:"#1565C0",marginBottom:8}}>Choose a color to charge rent:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {validRentColors.length===0&&<span style={{fontSize:11,color:"var(--color-text-secondary)"}}>No properties to charge rent on!</span>}
            {validRentColors.map(c=>(
              <button key={c} onClick={()=>handleColorChoose(c)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:COLORS[c].bg,color:COLORS[c].text,fontSize:11,cursor:"pointer"}}>
                {COLORS[c].label} (${calcRent(playerSets,c,doubleActive)}M{doubleActive?"×2":""})
              </button>
            ))}
            <button onClick={()=>setPendingAction(null)} style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",fontSize:11,cursor:"pointer",color:"var(--color-text-secondary)"}}>Cancel</button>
          </div>
        </div>
      )}
      {pendingAction?.step==="chooseTarget"&&(
        <div style={{background:"#fce4ec",borderRadius:8,padding:"10px 12px",marginBottom:10,border:"0.5px solid #f48fb1"}}>
          <div style={{fontSize:12,fontWeight:500,color:"#c62828",marginBottom:8}}>
            {pendingAction.card.subtype==="dealbreaker"?"Choose a COMPLETE AI set to steal:":"Choose an AI color to steal from:"}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {validRentColors.length===0&&<span style={{fontSize:11,color:"var(--color-text-secondary)"}}>AI has no properties!</span>}
            {validRentColors.map(c=>(
              <button key={c} onClick={()=>handleTargetChoose(c)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:COLORS[c].bg,color:COLORS[c].text,fontSize:11,cursor:"pointer",opacity:pendingAction.card.subtype==="dealbreaker"&&!isComplete(aiSets,c)?0.4:1}}>
                {COLORS[c].label} ({(aiSets[c]||[]).length}) {isComplete(aiSets,c)?"✓":""}
              </button>
            ))}
            <button onClick={()=>setPendingAction(null)} style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",fontSize:11,cursor:"pointer",color:"var(--color-text-secondary)"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Discard mode */}
      {discardMode&&(
        <div style={{background:"#fff8e1",borderRadius:8,padding:"10px 12px",marginBottom:10,border:"0.5px solid #ffe082"}}>
          <div style={{fontSize:12,fontWeight:500,color:"#E65100",marginBottom:6}}>Select {discardNeeded} card{discardNeeded!==1?"s":""} to discard ({discardSelected.length}/{discardNeeded} selected)</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
            {playerHand.map(c=>{
              const sel=discardSelected.includes(c.id);
              return(
                <div key={c.id} onClick={()=>setDiscardSelected(s=>sel?s.filter(id=>id!==c.id):[...s,c.id])} style={{display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:60,minHeight:80,borderRadius:6,border:sel?"2px solid #E65100":"0.5px solid var(--color-border-secondary)",background:c.type==="property"?COLORS[c.color]?.bg:c.type==="money"?"#e8f5e9":c.type==="rent"?"#fff8e1":"#e3f2fd",color:c.type==="property"?COLORS[c.color]?.text:"#000",fontSize:9,padding:"4px 2px",cursor:"pointer",boxSizing:"border-box",textAlign:"center",flexShrink:0,opacity:sel?0.6:1}}>
                  {c.type==="property"&&<div style={{fontSize:7,marginBottom:1,opacity:0.8}}>{COLORS[c.color]?.label}</div>}
                  <div style={{fontWeight:500,fontSize:9,lineHeight:1.2}}>{c.name}</div>
                  <div style={{fontSize:9,marginTop:2}}>${c.value}M</div>
                  {sel&&<div style={{fontSize:8,color:"#E65100",fontWeight:500}}>✕ discard</div>}
                </div>
              );
            })}
          </div>
          <button onClick={confirmDiscard} disabled={discardSelected.length!==discardNeeded} style={{padding:"6px 16px",borderRadius:6,border:"none",background:discardSelected.length===discardNeeded?"#E65100":"#ccc",color:"#fff",fontSize:12,cursor:discardSelected.length===discardNeeded?"pointer":"default",fontWeight:500}}>Confirm Discard</button>
        </div>
      )}

      {/* Player hand */}
      {!discardMode&&(
        <div style={{background:"var(--color-background-primary)",borderRadius:10,padding:"10px 12px",border:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-primary)"}}>
              {mustDraw&&turn==="player"?<span style={{color:"#1565C0"}}>Draw 2 cards to start your turn</span>
                :isPlayerActive?`Your Hand (${playsLeft} play${playsLeft!==1?"s":""} left)`
                :turn==="ai"?"AI's turn...":"Your Hand"}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {selected&&isPlayerActive&&(
                <>
                  {selected.type!=="money"&&<button onClick={()=>handlePlaySelected("play")} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#1565C0",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:500}}>Play as card</button>}
                  {selected.type!=="property"&&<button onClick={()=>handlePlaySelected("bank")} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#2E7D32",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:500}}>Bank for $</button>}
                  <button onClick={()=>setSelected(null)} style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",fontSize:11,cursor:"pointer",color:"var(--color-text-secondary)"}}>Cancel</button>
                </>
              )}
              {!selected&&mustDraw&&turn==="player"&&!aiThinking&&(
                <button onClick={playerDraw} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#1565C0",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:500}}>Draw 2 cards</button>
              )}
              {isPlayerActive&&!selected&&(
                <>
                  <button onClick={endTurn} style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",fontSize:11,cursor:"pointer",color:"var(--color-text-primary)"}}>End Turn</button>
                </>
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {playerHand.map(c=>{
              const isJsn=c.subtype==="jsn";
              return(
                <div key={c.id} style={{position:"relative"}}>
                  <CardView card={c} isSelected={selected?.id===c.id} disabled={!isPlayerActive||isJsn} onClick={()=>handleCardClick(c)}/>
                  {isJsn&&<div style={{position:"absolute",bottom:2,left:0,right:0,textAlign:"center",fontSize:7,color:"#c62828",fontWeight:500}}>reactive only</div>}
                </div>
              );
            })}
            {playerHand.length===0&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>No cards — draw some!</span>}
          </div>
          {selected&&isPlayerActive&&<div style={{marginTop:8,fontSize:11,color:"var(--color-text-secondary)"}}>Selected: <strong>{selected.name}</strong> — play it or bank it for its face value.</div>}
        </div>
      )}
    </div>
  );
}