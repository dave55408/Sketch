const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('elf sprites load and render at every home when image pixel readback is blocked',()=>{
  const elements=new Map(),drawCalls=[],canvases=[],images=[];
  function brush(){
    const target={globalCompositeOperation:'source-over',fills:[],
      getImageData(){
        if(this.input?.src?.startsWith('data:image/png;base64,'))return {data:new Uint8ClampedArray([196,164,92,255,25,51,46,255])};
        throw new Error('Local-file canvas pixel readback blocked');
      },
      putImageData(pixels){this.pixels=pixels.data;},clearRect(...args){this.openDoor=args;},
      drawImage(...args){this.input=args[0];drawCalls.push({brush:this,args,operation:this.globalCompositeOperation,shadowBlur:this.shadowBlur});},
      fillRect(...args){if(['source-in','multiply'].includes(this.globalCompositeOperation))this.tint=this.fillStyle;this.fills.push(this.fillStyle);drawCalls.push({brush:this,args:[],rect:args,color:this.fillStyle});},
      fillText(text,...args){drawCalls.push({brush:this,text,args});},
      strokeRect(...args){drawCalls.push({brush:this,box:args,color:this.strokeStyle});},
      fill(){this.bodyColor=this.fillStyle;},
      ellipse(...args){this.ellipseArgs=args;},
      setLineDash(dash){this.dash=dash;},
      scale(...args){drawCalls.push({brush:this,scale:args,args:[]});},
      stroke(){this.borderColor=this.strokeStyle;this.borderWidth=this.lineWidth;drawCalls.push({brush:this,ring:this.ellipseArgs,color:this.strokeStyle,blur:this.shadowBlur,dash:this.dash});},
      createRadialGradient(){const gradient={stops:[],addColorStop(at,color){this.stops.push([at,color]);}};this.glow=gradient;return gradient;}
    };
    return new Proxy(target,{get(object,key){return key in object?object[key]:()=>{};}});
  }
  const screen=brush();
  function element(id){
    if(!elements.has(id))elements.set(id,{dataset:{},style:{},hidden:true,
      classList:{add(){},remove(){},toggle(){}},getContext(){return screen;},
      querySelectorAll(){return [...(this.innerHTML||'').matchAll(/<canvas[^>]*data-elf="([^"]+)"/g)].map(match=>{const context=brush();return {dataset:{elf:match[1]},getContext(){return context;}};});},
      addEventListener(){},focus(){},setAttribute(){},getBoundingClientRect(){return {};},clientWidth:0
    });
    return elements.get(id);
  }
  const png=fs.readFileSync(__dirname+'/assets/elf-a1.png');
  const context={document:{getElementById:element,querySelectorAll(){return [];},addEventListener(){},body:{classList:{add(){},toggle(){}}},
    createElement(){const context=brush(),canvas={getContext(){return context;},toDataURL(){return 'data:image/png;base64,houseThumbnail';}};canvases.push(canvas);return canvas;}},
    window:{addEventListener(){}},Image:class{
      constructor(){images.push(this);}naturalWidth=png.readUInt32BE(16);naturalHeight=png.readUInt32BE(20);
      get src(){return this.imageUrl;}
      set src(value){this.imageUrl=value;if(value.startsWith('assets/')){const image=fs.readFileSync(__dirname+'/'+value);this.naturalWidth=image.readUInt32BE(16);this.naturalHeight=image.readUInt32BE(20);}}
    },
    Audio:class{pause(){}play(){return Promise.resolve();}},requestAnimationFrame(){},clearTimeout(){},setTimeout(){},performance:{now(){return 0;}}
  };
  const source=fs.readFileSync(__dirname+'/game.js','utf8').replace(/\}\)\(\);\s*$/,
    'globalThis.api={elfArtwork,houseArtwork,sprites,refresh,draw,drawItem,jewelFlashColor,pickup,drop,blocked,heldObjectColor,teleportToRoom,state:()=>state};})();');
  vm.runInNewContext(source,context);
  const api=context.api;
  assert.equal(api.elfArtwork.src,'assets/elf-b2.png');
  assert.doesNotThrow(()=>api.elfArtwork.onload());
  assert.equal(canvases.length,4);
  const tintCalls=drawCalls.slice();
  assert(Buffer.from(api.houseArtwork.src.split(',')[1],'base64').equals(fs.readFileSync(__dirname+'/assets/elf-house3.png')));
  assert.doesNotThrow(()=>api.houseArtwork.onload());
  assert(api.teleportToRoom('westInside'));const beforeBoxes=drawCalls.length;api.draw();
  const boxes=drawCalls.slice(beforeBoxes).filter(call=>call.box?.[2]===72&&call.box?.[3]===60);
  assert.equal(boxes.length,4);assert(boxes.every(box=>box.color==='#8F8B8F'));assert(boxes.every(box=>box.box[1]<385));
  assert(api.teleportToRoom('west'));drawCalls.length=0;api.draw();
  assert(!drawCalls.some(call=>call.text?.startsWith('Sentiment:')),'emotions start hidden');
  element('emotionsToggle').onclick({preventDefault(){}});
  assert.equal(element('emotionsToggle').textContent,'Hide emotions');
  drawCalls.length=0;api.draw();assert(drawCalls.some(call=>call.text==='Sentiment: Neutral (2)'));
  element('emotionsToggle').onclick({preventDefault(){}});
  assert.equal(element('emotionsToggle').textContent,'Show emotions');
  drawCalls.length=0;api.draw();assert(!drawCalls.some(call=>call.text?.startsWith('Sentiment:')));
  element('emotionsToggle').onclick({preventDefault(){}});
  assert.equal((elements.get('map').innerHTML.match(/class="map-house-icon"/g)||[]).length,1);
  for(const [home,rgb] of Object.entries({west:[139,21,21],blueGate:[0,128,96],redTrail:[0,52,184],blackApproach:[128,0,128]})){
    const house=api.sprites.elfHouses[home],context=house.getContext('2d');
    assert.deepEqual(Array.from(context.pixels),[...rgb,255,25,51,46,255]);
    assert.deepEqual(context.openDoor,[156,254,103,380]);
  }
  for(const [home,color] of Object.entries({west:'#ae5b5b',blueGate:'#4da690',redTrail:'#4d71cd',blackApproach:'#a64da6'})){
    const sprite=api.sprites.elves[home];assert(sprite);
    assert.equal(sprite.getContext('2d').tint,color,'elf face mixes 70% house color with 30% white');
    assert(!Object.hasOwn(sprite.getContext('2d'),'borderColor'),'elf faces have no circular border');
    assert(tintCalls.some(call=>call.brush===sprite.getContext('2d')&&call.operation==='destination-in'),'tint preserves the face silhouette');
    assert(api.teleportToRoom(home));drawCalls.length=0;api.draw();
    const inverted=false;
    assert.equal(drawCalls.some(call=>call.brush===screen&&call.scale?.[0]===-1&&call.scale?.[1]===-1),inverted);
    const homeName={west:'RUBY GROVE',blueGate:'EMERALD GLADE',redTrail:'SAPPHIRE SHORE',blackApproach:'AMETHYST HOLLOW'}[home];
    assert(elements.get('map').innerHTML.includes(`style="${inverted?'transform:rotate(180deg)':''}" src="data:image/png;base64,houseThumbnail" alt="${homeName}"`));
    assert(elements.get('map').innerHTML.includes('map-player-marker'));
    assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===sprite&&call.args[4]===68));
    assert(drawCalls.some(call=>call.brush===screen&&call.text==='Sentiment: Neutral (2)'&&call.args[1]<417));
    assert(drawCalls.some(call=>call.brush===screen&&call.text==='Attitude: Neutral (2)'&&call.args[1]<417));
    assert(api.teleportToRoom(home+'Inside'));drawCalls.length=0;api.draw();
    assert(drawCalls.some(call=>call.brush===screen&&call.ring?.[0]===800&&call.ring?.[1]===415&&call.dash?.join(',')==='6,5'&&call.blur===0),'awake elf maintains dashed jewel barrier');
    const owner=api.state().elves.find(elf=>elf.home===home);owner.stunTimer=30;drawCalls.length=0;api.draw();
    assert(!drawCalls.some(call=>call.brush===screen&&call.ring?.[0]===800&&call.ring?.[1]===415&&call.dash?.join(',')==='6,5'),'dashed barrier disappears while unconscious');
    owner.stunTimer=0;assert(api.teleportToRoom(home));drawCalls.length=0;api.draw();
    assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===api.sprites.elfHouses[home]&&call.args[1]===281&&call.args[2]===100));
  }
  for(const row of ['a','b','c'])for(const passion of [1,2,3]){
    const artwork=images.find(image=>image.src===`assets/elf-${row}${passion}.png`);assert(artwork);
    if(row!=='b'||passion!==2)assert.doesNotThrow(()=>artwork.onload());
  }
  for(const elf of api.state().elves){
    assert(api.teleportToRoom(elf.room));
    for(const [sentiment,row] of [[3,'a'],[2,'b'],[1,'c']])for(const passion of [3,2,1]){
      elf.emotionalState={sentiment,passion};drawCalls.length=0;api.draw();
      const sprite=api.sprites.elfEmotions[row+passion][elf.home];
      assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===sprite),`${elf.home} uses elf-${row}${passion}`);
      assert.equal(sprite.getContext('2d').tint,api.sprites.elves[elf.home].getContext('2d').tint);
      assert(!Object.hasOwn(sprite.getContext('2d'),'borderColor'),'emotion faces have no circular border');
    }
    elf.emotionalState={sentiment:2,passion:2};
  }
  const koArtwork=images.find(image=>image.src==='assets/elf-ko.png');assert(koArtwork);
  assert.doesNotThrow(()=>koArtwork.onload());
  const surprisedArtwork=images.find(image=>image.src==='assets/elf-surprised.png');assert(surprisedArtwork);
  assert.doesNotThrow(()=>surprisedArtwork.onload());
  for(const elf of api.state().elves){
    assert(api.teleportToRoom(elf.room));elf.surpriseTimer=.5;elf.stunTimer=30;drawCalls.length=0;api.draw();
    assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===api.sprites.elvesSurprised[elf.home]),'axe hit uses surprised sprite first');
    assert.equal(api.sprites.elvesSurprised[elf.home].getContext('2d').tint,api.sprites.elves[elf.home].getContext('2d').tint);
    elf.surpriseTimer=0;
    assert(api.teleportToRoom(elf.room));elf.stunTimer=30;drawCalls.length=0;api.draw();
    assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===api.sprites.elvesKO[elf.home]),'stunned elf uses knockout sprite');
    assert.equal(api.sprites.elvesKO[elf.home].getContext('2d').tint,api.sprites.elves[elf.home].getContext('2d').tint);
    elf.stunTimer=0;drawCalls.length=0;api.draw();
    assert(drawCalls.some(call=>call.brush===screen&&call.args[0]===api.sprites.elves[elf.home]),'recovered elf uses normal sprite');
  }
  elements.get('hints').hidden=false;drawCalls.length=0;api.refresh();
  assert.equal((elements.get('map').innerHTML.match(/class="map-elf-icon"/g)||[]).length,4);
  assert(drawCalls.some(call=>call.args[0]===api.sprites.elves.west&&call.args[3]===32&&call.args[4]===32&&call.shadowBlur===0));
  const redElf=api.state().elves.find(elf=>elf.home==='west'),originalRoom=redElf.room;
  redElf.room='stone';api.refresh();
  assert(/data-room="stone"[^]*?data-elf="west"/.test(elements.get('map').innerHTML));
  redElf.room='mazeTL';api.refresh();
  assert(elements.get('mazeMap').innerHTML.includes('data-elf="west"'));
  redElf.room=originalRoom;elements.get('hints').hidden=true;api.refresh();
  assert(!elements.get('map').innerHTML.includes('data-elf='));
  assert(api.teleportToRoom('crossroads'));
  for(const id of ['apple','coin','axe','flower','flute','jewel']){
    const artwork=images.find(image=>image.src===`assets/${id}.png`);assert(artwork);
    for(const image of images.filter(image=>image.src===`assets/${id}.png`))image.onload();drawCalls.length=0;
    api.drawItem(id,0,0);
    const sprite=api.sprites[id],drawing=drawCalls.find(call=>call.args[0]===sprite);assert(drawing);
    const expectedColor={apple:'#a5141b',coin:'#f6cc61',axe:'#000000',flower:'#006400',flute:'#ffffff',jewel:'#0034B8'}[id];
    assert.equal(sprite.getContext('2d').tint,expectedColor);
    assert(Math.abs(Math.max(drawing.args[7],drawing.args[8])-(id==='jewel'?Math.max(artwork.naturalWidth,artwork.naturalHeight)*.7:id==='axe'?54.4:id==='flower'||id==='flute'?40.8:34))<.001);
    if(id==='flute')assert(Math.abs(drawing.args[8]-(90*34/254)*.8)<.001);
    if(id==='flute'){
      const keys=drawCalls.filter(call=>call.brush===screen&&call.color==='#000000'&&call.rect);
      assert.equal(keys.length,0);
    }
    if(id==='jewel'){
      assert.equal(drawing.args[7],artwork.naturalWidth*.7);assert.equal(drawing.args[8],artwork.naturalHeight*.7);
      assert(Number.isInteger(drawing.args[5])&&Number.isInteger(drawing.args[6]));
    }
    if(id==='axe'){
      assert.equal(drawing.args[3],artwork.naturalWidth);
      assert.equal(drawing.args[4],artwork.naturalHeight);
      assert(Math.abs(drawing.args[7]/drawing.args[8]-artwork.naturalWidth/artwork.naturalHeight)<.001);
    }
    const state=api.state(),item=state.items[id],startingRoom=item.room;
    if(id==='jewel'){item.x=715;item.y=320;}
    const startingRooms={jewel:'redTrailInside',apple:'stone',coin:'crossroads',axe:'goldInside',flower:'blackApproach',flute:'blueGate'};
    assert.equal(startingRoom,startingRooms[id]);assert(api.teleportToRoom(startingRoom));
    state.held=null;state.pickupDelay=0;state.player.x=item.x;state.player.y=item.y;
    api.pickup();assert.equal(state.held,id);
    assert.equal(elements.get('itemIcon').style.backgroundColor,expectedColor);
    assert(elements.get('itemIcon').style.maskImage.includes(`assets/${id}.png`));
    assert.doesNotThrow(()=>api.heldObjectColor());
    api.drop();assert.equal(state.held,null);assert.equal(state.items[id].room,startingRoom);
  }
  const jewelColors={jewelOrange:'#D86000',jewelGold:'#C4A000',jewelRed:'#D01C00',jewelPurple:'#800080',jewel:'#0034B8',jewelGreen:'#008060'};
  const cycle=['#A8A8A8','#C4A000','#D86000','#D01C00','#B00020','#800080','#4010BC','#0034B8','#0068A0','#008060','#008818','#388400','#707400','#A05800','#B84000','#C02040'];
  for(const [id,base] of Object.entries(jewelColors)){
    const firstFlash=8-Object.keys(jewelColors).indexOf(id)*8/6;
    api.state().jewelFlashSchedule[id].start=firstFlash;
    const artwork=images.find(image=>image.src==='assets/jewel.png');
    for(const image of images.filter(image=>image.src==='assets/jewel.png'))image.onload();
    api.state().jewelFlashElapsed=firstFlash-.01;assert.equal(api.jewelFlashColor(id),base);
    for(const [index,color] of cycle.entries()){
      api.state().jewelFlashElapsed=firstFlash+index*.5334/16;assert.equal(api.jewelFlashColor(id),color);
    }
    api.state().jewelFlashElapsed=firstFlash;drawCalls.length=0;api.drawItem(id,0,0);
    for(const [other,normal] of Object.entries(jewelColors))if(other!==id)assert.equal(api.jewelFlashColor(other),normal,'other jewels stay at their normal color');
    const flash=drawCalls.find(call=>call.brush===screen&&call.args[0]===api.sprites.jewelFlashes[id]);assert(flash);
    assert.equal(flash.shadowBlur,0);assert(api.sprites.jewelFlashes[id].getContext('2d').fills.includes('#ffffff'));
    api.state().jewelFlashElapsed=firstFlash+.534;assert.equal(api.jewelFlashColor(id),base);
    api.state().jewelFlashSchedule[id].start=firstFlash+12;
    api.state().jewelFlashElapsed=firstFlash+12;assert.equal(api.jewelFlashColor(id),cycle[0]);
  }
  api.state().jewelFlashElapsed=0;
  assert.equal(api.sprites.axe2.getContext('2d').tint,'#000000');
  drawCalls.length=0;api.drawItem('axe2',0,0);
  const secondAxe=drawCalls.find(call=>call.args[0]===api.sprites.axe2);
  assert(Math.abs(Math.max(secondAxe.args[7],secondAxe.args[8])-54.4)<.001);
  assert.equal(Object.keys(api.state().items).filter(id=>id.startsWith('jewel')).length,6);
  for(const [id,color] of Object.entries(jewelColors)){
    const state=api.state(),item=state.items[id];
    if(item.room.endsWith('Inside')){item.x=715;item.y=320;}
    const startingRoom=item.room;assert(api.teleportToRoom(startingRoom));assert(!api.blocked(item.room,item.x,item.y));
    assert.equal(api.sprites[id].getContext('2d').tint,color);
    assert.equal(api.sprites[id].getContext('2d').bodyColor,color+'55');
    assert(!Object.hasOwn(api.sprites[id].getContext('2d'),'glow'));
    assert(api.sprites[id].getContext('2d').fills.includes('#ffffff'));
    state.held=null;state.pickupDelay=0;state.player.x=item.x;state.player.y=item.y;
    api.pickup();assert.equal(state.held,id);assert.equal(api.heldObjectColor(),color);
    api.drop();assert.equal(state.items[id].room,startingRoom);
  }
  assert(api.teleportToRoom('goldInside'));drawCalls.length=0;api.draw();
  assert(drawCalls.some(call=>call.brush===screen&&call.text==='POSSESSIONS'));
  assert(drawCalls.some(call=>call.brush===screen&&call.text==='YOUR TREASURES'));
  for(const [x,y] of [[715,185],[715,320],[715,435],[480,525]])assert(!api.blocked('goldInside',x,y,true),'castle possessions area and entry are walkable');
  const castleState=api.state();castleState.player.x=715;castleState.player.y=320;castleState.heldSide='up';castleState.held='coin';api.drop();
  assert.equal(castleState.items.coin.room,'goldInside');assert(castleState.message.includes('possessions area'));
  for(const home of ['west','blueGate','redTrail','blackApproach']){
    const room=home+'Inside';assert(api.teleportToRoom(room));
    const state=api.state();api.draw();
    for(const [x,y] of [[245,275],[715,275],[480,320],[480,585]])assert(!api.blocked(room,x,y));
    state.player.x=245;state.player.y=310;state.heldSide='up';state.held='apple';
    api.drop();assert.equal(state.items.apple.room,room);assert(state.message.includes('gift area'));
    assert(state.message.includes(home==='west'?'hates the apple':'likes the apple'));
    const preferences={west:{flower:'likes',flute:'likes'},blueGate:{flower:'likes',flute:'likes'},redTrail:{flower:'hates',flute:'likes'},blackApproach:{flower:'likes',flute:'hates'}};
    for(const [id,feeling] of Object.entries({coin:home==='blueGate'?'hates':'likes',...preferences[home]})){
      state.held=id;api.drop();
      assert.equal(state.items[id].room,room);
      assert(state.message.includes(feeling+' the '+id),`${home} ${feeling} ${id}`);
    }
    state.player.x=715;state.held='coin';
    api.drop();assert.equal(state.items.coin.room,room);assert(state.message.includes('possessions area'));
    assert(api.teleportToRoom(home));
    assert.equal(state.items.apple.room,room);assert.equal(state.items.coin.room,room);
  }
});
