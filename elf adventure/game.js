(() => {
  'use strict';
  const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
  const titleCursorCtx=document.getElementById('titleCursor').getContext('2d');
  const $=id=>document.getElementById(id);
  const W=960,H=640, SPEED=313.5, SWALLOWED_SPEED=49.875, BOUNCE_SECONDS=.12, BOUNCE_DISTANCE=6, CASTLE_Y=100, CASTLE_H=380, CASTLE_SHIFT=CASTLE_Y-60, VICTORY_MESSAGE_DELAY=2;
  const BRIDGE_SCALE=1.3, BRIDGE_WIDTH=162, BRIDGE_HEIGHT=144, BRIDGE_HOLD_DISTANCE=88;
  const BRIDGE_IDS=['bridge','bridge2'];
  // Pixel geometry traced from the supplied castle reference, with a transparent room background.
  const GOLD_CASTLE_ART={w:864,h:798,body:[
    [23,111,285,324],[550,111,282,324],[23,274,809,161],
    [105,435,648,163],[105,598,242,161],[508,598,245,161],
    ...[23,105,184,266,550,632,711,793].map(x=>[x,26,x===266?42:x===793?39:40,85])
  ],windows:[[309,311,21,89],[367,311,22,89],[471,311,22,89],[529,311,22,89]],gate:{x:387,y:598,w:72,h:161,travel:132}};
  const PLAYER_HALF_SIZE=21.06/2;
  // Match the visible bounds of Chalice Quest's 163-by-149 castle sprite.
  function castleTransform(){const sx=(415*160/163)/809,sy=(CASTLE_H*145/149)/733;return {sx,sy,x:281-23*sx,y:CASTLE_Y+3*CASTLE_H/149-26*sy};}
  function goldCastleDoorway(){const {sx,sy,x,y}=castleTransform();return {x:x+347*sx,y:y+598*sy,w:161*sx,h:161*sy};}
  function castleDoorway(castle){return ELF_HOME_COLORS[castle]?{x:ELF_HOUSE.doorX,y:ELF_HOUSE.doorY,w:ELF_HOUSE.doorW,h:126}:goldCastleDoorway();}
  const JEWEL_COLORS=['#A8A8A8','#C4A000','#D86000','#D01C00','#B00020','#800080','#4010BC','#0034B8','#0068A0','#008060','#008818','#388400','#707400','#A05800','#B84000','#C02040'];
  const JEWEL_FLASH_SECONDS=.5334;
  const ELF_HOME_COLORS={west:'#8B1515',blueGate:'#008060',redTrail:'#0034B8',blackApproach:'#800080'};
  const ELF_GIFT_PREFERENCES={
    west:{likes:['coin','flower','flute'],hates:['apple']},
    blueGate:{likes:['apple','flower','flute'],hates:['coin']},
    redTrail:{likes:['apple','coin','flute'],hates:['flower']},
    blackApproach:{likes:['apple','coin','flower'],hates:['flute']}
  };
  const ELF_NAMES={west:'Rhaelin',blueGate:'Galenor',redTrail:'Belthir',blackApproach:'Pelendil'};
  const ELF_PERSONALITIES={
    west:{name:'Bold',distance:120,flank:0},
    blueGate:{name:'Cautious',distance:260,flank:Math.PI/3},
    redTrail:{name:'Flanker',distance:180,flank:-Math.PI/2},
    blackApproach:{name:'Stalker',distance:320,flank:-Math.PI/4}
  };
  const ELF_SIZE=68;
  const ELF_HOUSE={x:281,y:CASTLE_Y,w:415,h:CASTLE_H,doorX:437,doorY:CASTLE_Y+254,doorW:103,gateH:20};
  function houseUpsideDown(room){return false;}
  function houseWorldY(room,y){return houseUpsideDown(room)?ELF_HOUSE.y*2+ELF_HOUSE.h-y:y;}
  const ELF_INTERIORS={westInside:'west',blueGateInside:'blueGate',redTrailInside:'redTrail',blackApproachInside:'blackApproach'};
  const ELF_ROOM_ZONES={gifts:{x:95,y:135,w:300,h:350},possessions:{x:565,y:135,w:300,h:350}};
  const ELF_TREASURE_SLOTS=[...[265,340].flatMap(y=>[625,715,805].map(x=>({x,y,w:72,h:60}))),{x:800,y:415,w:72,h:60}];
  const ELF_JEWEL_CORNER={x:750,y:365,w:100,h:100};
  const JEWEL_VARIANTS=[['jewelOrange','Amber',2],['jewelGold','Citrine',1],['jewelRed','Ruby',3],['jewelPurple','Amethyst',5],['jewel','Sapphire',7],['jewelGreen','Emerald',9]];
  const ELF_TREASURES={jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'};
  const AXE_IDS=['axe','axe2','axe3','axe4','axe5'];
  const ELF_AXES={axe2:'west',axe3:'blueGate',axe4:'redTrail',axe5:'blackApproach'};
  const ELF_HOME_KEYS={westKey:'west',blueGateKey:'blueGate',redTrailKey:'redTrail',blackApproachKey:'blackApproach'};
  const CROSSING_ITEMS={apple:{src:'assets/apple.png',crop:[14,3,247,280]},coin:{src:'assets/coin.png',crop:[12,39,248,244]},axe:{src:'assets/axe.png',crop:null},axe2:{src:'assets/axe.png',crop:null},flower:{src:'assets/flower.png',crop:[30,0,208,281]},flute:{src:'assets/flute.png',crop:[8,115,254,90]},...Object.fromEntries(JEWEL_VARIANTS.map(([id])=>[id,{src:'assets/jewel.png',crop:null}]))};
  const MAZE_BRIDGE_X=340,MAZE_BRIDGE_Y=427,BRIDGE_LEG_OFFSET=Math.round(BRIDGE_WIDTH*65/180),BRIDGE_TOUCH_RADIUS=22;
  const EXTRA_GIFTS={apple2:'apple',apple3:'apple',apple4:'apple',coin2:'coin',coin3:'coin',coin4:'coin'};
  for(const [id,kind] of Object.entries(EXTRA_GIFTS))CROSSING_ITEMS[id]=CROSSING_ITEMS[kind];
  for(const id of AXE_IDS)CROSSING_ITEMS[id]=CROSSING_ITEMS.axe;
  const DUNGEON_WALL_HEIGHT=BRIDGE_HEIGHT-32, DUNGEON_WALL_Y=322.5-DUNGEON_WALL_HEIGHT/2;
  const ENTRY_WALL=40,ENTRY_TOP=40,ENTRY_BOTTOM=600,ENTRY_OPEN_LEFT=386,ENTRY_OPEN_RIGHT=574;
  const TREE_SCALE=.8,TREE_PARTS=[[-12,-58,24,24],[-35,-34,70,24],[-12,-10,24,22],[-55,12,110,24],[-12,36,24,24]];
  const BLACK_APPROACH_TREES=[{x:275,y:315},{x:600,y:470}];
  const STONE_PASSAGE_TREES=[{x:220,y:160},{x:740,y:160},{x:220,y:480},{x:740,y:480}];
  const LABYRINTH_APPROACH_TREES=[{x:240,y:220},{x:720,y:420}];
  const WINDING_WOOD_TREES=[{x:210,y:165},{x:690,y:470}];
  const WINDING_WOOD_WALLS=[{x:155,y:445,w:160,h:45},{x:635,y:145,w:165,h:45},{x:390,y:115,w:45,h:100},{x:515,y:435,w:45,h:95}];
  const ELF_CROSSING_WALLS=[{x:226,y:120,w:48,h:180},{x:686,y:340,w:48,h:180}];
  const BLACK_APPROACH_WALLS=[{x:180,y:100,w:50,h:145},{x:685,y:115,w:145,h:45},{x:150,y:465,w:150,h:45},{x:700,y:425,w:50,h:125}];
  const chompSound=new Audio('assets/chomp.mp3');
  const dragonDeathSound=new Audio('assets/slay.mp3');
  const playerDeathSound=new Audio('assets/death.mp3');
  const pickupSound=new Audio('assets/pick-up.mp3');
  const fluteSound=new Audio('assets/pan-flute-loop.mp3?v='+Date.now());
  let flutePlayback='idle';
  fluteSound.onended=()=>{flutePlayback='finished';};
  const dropSound=new Audio('assets/drop.mp3');
  const elfOuchSound=new Audio('assets/ouch.mp3');
  const axePoofSound=new Audio('assets/gaster-disapear.mp3');
  let axePoofAudioContext;
  const winSound=new Audio('assets/win-good.mp3');
  const artwork=new Image(),sprites={},spriteUrls={bat:'assets/bat_down.png'},dragonIconUrls={},houseIconUrls={};let castleMask=null,bridgePixelData=null;
  sprites.batUp=new Image();sprites.batDown=new Image();
  sprites.batUp.onload=sprites.batDown.onload=()=>{if(state)refresh();};
  sprites.batUp.src='assets/bat_up.png';sprites.batDown.src='assets/bat_down.png';
  const houseArtwork=new Image();
  sprites.elfHouses={};
  houseArtwork.onload=()=>{
    for(const [home,color] of Object.entries(ELF_HOME_COLORS)){
      const sprite=document.createElement('canvas');sprite.width=ELF_HOUSE.w;sprite.height=ELF_HOUSE.h;
      const brush=sprite.getContext('2d');brush.imageSmoothingEnabled=false;brush.drawImage(houseArtwork,0,0,sprite.width,sprite.height);
      const pixels=brush.getImageData(0,0,sprite.width,sprite.height),tint=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
      for(let i=0;i<pixels.data.length;i+=4){
        const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
        if(pixels.data[i+3]&&r>100&&r>g&&g>b){pixels.data[i]=tint[0];pixels.data[i+1]=tint[1];pixels.data[i+2]=tint[2];}
      }
      brush.putImageData(pixels,0,0);
      brush.clearRect(ELF_HOUSE.doorX-ELF_HOUSE.x,ELF_HOUSE.doorY-ELF_HOUSE.y,ELF_HOUSE.doorW,ELF_HOUSE.h);
      sprites.elfHouses[home]=sprite;
      houseIconUrls[home]=sprite.toDataURL();
    }
    if(state)refresh();
  };
  // Embedded elf-house3.png keeps house color sampling safe when opened from disk.
  houseArtwork.src='data:image/png;base64,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';
  const elfArtwork=new Image();
  sprites.elves={};sprites.elvesKO={};
  sprites.elvesSurprised={};
  const elfSurprisedArtwork=new Image();
  elfSurprisedArtwork.onload=()=>loadElfSprites(elfSurprisedArtwork,sprites.elvesSurprised);
  elfSurprisedArtwork.src='assets/elf-surprised.png';
  sprites.elfEmotions={b2:sprites.elves};
  const elfKOArtwork=new Image();
  elfKOArtwork.onload=()=>loadElfSprites(elfKOArtwork,sprites.elvesKO);
  elfKOArtwork.src='assets/elf-ko.png';
  elfArtwork.onload=()=>loadElfSprites(elfArtwork,sprites.elves);
  const ELF_FACE_INTERIOR_ROWS={"elf-a1.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-a2.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-a3.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,46],[10,46],[10,46],[13,46],[13,46],[13,46],[16,30],[16,30],[-1,-1]],"elf-b1.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-b2.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-b3.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,46],[10,46],[10,46],[13,46],[13,46],[13,46],[16,30],[16,30],[-1,-1]],"elf-c1.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-c2.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-c3.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,46],[10,46],[10,46],[13,46],[13,46],[13,46],[16,30],[16,30],[-1,-1]],"elf-ko.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]],"elf-surprised.png":[[-1,-1],[11,35],[11,35],[11,35],[9,37],[9,37],[9,37],[9,37],[8,38],[8,38],[8,38],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[1,45],[4,42],[4,42],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[7,39],[10,36],[10,36],[10,36],[13,33],[13,33],[13,33],[16,30],[16,30],[-1,-1]]};
  function loadElfSprites(artwork,target){
    for(const [home,color] of Object.entries(ELF_HOME_COLORS)){
      const sprite=document.createElement('canvas');sprite.width=artwork.naturalWidth;sprite.height=artwork.naturalHeight;
      const brush=sprite.getContext('2d');brush.drawImage(artwork,0,0);
      const faceTint='#'+[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*.7+255*.3).toString(16).padStart(2,'0')).join('');
      brush.globalCompositeOperation='multiply';brush.fillStyle=faceTint;brush.fillRect(0,0,sprite.width,sprite.height);
      brush.globalCompositeOperation='destination-in';brush.drawImage(artwork,0,0);
      const artworkName=artwork.src.split('/').pop();
      // This expression has a stray six-pixel column outside the cheek.
      if(artworkName==='elf-c3.png')brush.clearRect(46,59,1,6);
      // Back the head interior with black, leaving its top two fill rows and outer edges transparent.
      brush.globalCompositeOperation='destination-over';brush.fillStyle='#000000';
      const rows=ELF_FACE_INTERIOR_ROWS[artworkName];
      rows.forEach(([left,right],y)=>{
        if(artworkName==='elf-c3.png'&&y>=59&&y<=64)right=y<62?36:33;
        if(left>=0&&y>=3)brush.fillRect(left,y,right-left+1,1);
      });
      brush.globalCompositeOperation='source-over';
      target[home]=sprite;
    }
    if(state)refresh();
  };
  elfArtwork.src='assets/elf-b2.png';
  for(const row of ['a','b','c'])for(const passion of [1,2,3]){
    const key=row+passion;if(key==='b2')continue;
    const artwork=new Image(),target={};sprites.elfEmotions[key]=target;
    artwork.onload=()=>loadElfSprites(artwork,target);
    artwork.src='assets/elf-'+key+'.png';
  }
  function elfSprite(elf){
    if(elf.surpriseTimer>0)return sprites.elvesSurprised[elf.home]||sprites.elves[elf.home];
    if(elf.stunTimer>0)return sprites.elvesKO[elf.home]||sprites.elves[elf.home];
    const {sentiment,passion}=elf.emotionalState;
    const key=['','c','b','a'][sentiment]+passion;
    return sprites.elfEmotions[key]?.[elf.home]||sprites.elves[elf.home];
  }
  for(const [id,art] of Object.entries(CROSSING_ITEMS)){
    const source=new Image();source.onload=()=>{
      const sprite=document.createElement('canvas');sprite.width=source.naturalWidth;sprite.height=source.naturalHeight;
      const brush=sprite.getContext('2d');brush.drawImage(source,0,0);
      brush.globalCompositeOperation='source-in';brush.fillStyle=itemInfo[id][2];brush.fillRect(0,0,sprite.width,sprite.height);
      brush.globalCompositeOperation='source-over';
      if(JEWEL_VARIANTS.some(([jewelId])=>jewelId===id))decorateJewel(sprite,itemInfo[id][2]);
      sprites[id]=sprite;objectColors.set(sprite,itemInfo[id][2]);
      if(state)refresh();
    };
    spriteUrls[id]=art.src;source.src=art.src;
  }
  artwork.onload=()=>{
    function cut(x,y,w,h,keep,tint,openGate=false){
      const piece=document.createElement('canvas');piece.width=w;piece.height=h;
      const brush=piece.getContext('2d');brush.drawImage(artwork,x,y,w,h,0,0,w,h);
      const pixels=brush.getImageData(0,0,w,h),castle=x===165&&y===0&&w===163&&h===149;
      for(let i=0;i<pixels.data.length;i+=4){
        const col=(i/4)%w,row=Math.floor(i/4/w),px=x+col,py=y+row;
        const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
        const yellow=r===210&&g===210&&b===64,purple=r===146&&g===70&&b===192,background=r===170&&g===170&&b===170;
        const strayKey=castle&&col<=3&&row>=128;
        const gateBar=px>=237&&px<=250&&py>=116&&py<=147&&r===0&&g===0&&b===0;
        if(castle&&(strayKey||(!yellow&&!(gateBar&&!openGate)))){pixels.data[i+3]=0;continue;}
        if(!castle&&(background||(keep==='yellow'&&!yellow)||(keep==='purple'&&!purple))){pixels.data[i+3]=0;continue;}
        if(tint&&yellow){pixels.data[i]=tint[0];pixels.data[i+1]=tint[1];pixels.data[i+2]=tint[2];}
      }
      brush.putImageData(pixels,0,0);return piece;
    }
    sprites.goldCastle=cut(165,0,163,149);
    castleMask=sprites.goldCastle.getContext('2d').getImageData(0,0,163,149).data;
    sprites.goldCastleOpen=cut(165,0,163,149,null,null,true);
    for(const [name,x,tint] of [['Yorgle',2],['Grundle',56],['Rhindle',110],['Vesper',2,[146,70,192]]]){
      sprites[name+'Pursue']=cut(x,56,16,44,null,tint);
      sprites[name+'Attack']=cut(x+18,56,16,44,null,tint);
      sprites[name+'Dead']=cut(x+36,56,16,44,null,tint);
      dragonIconUrls[name]={alive:sprites[name+'Pursue'].toDataURL(),dead:sprites[name+'Dead'].toDataURL()};
    }
    sprites.goldKey=cut(153,128,16,6);
    sprites.blackKey=cut(153,128,16,6,null,[0,0,0]);
    sprites.whiteKey=cut(153,128,16,6,null,[255,255,255]);
    for(const [id,home] of Object.entries(ELF_HOME_KEYS)){
      const color=ELF_HOME_COLORS[home],rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
      sprites[id]=cut(153,128,16,6,null,rgb);spriteUrls[id]=sprites[id].toDataURL();
    }
    sprites.sword=cut(153,153,16,10,'yellow');
    sprites.bridge=cut(82,152,70,51,'purple');sprites.bridge2=sprites.bridge;
    bridgePixelData=sprites.bridge.getContext('2d').getImageData(0,0,70,51).data;
    for(const id of ['goldKey','blackKey','whiteKey','sword',...BRIDGE_IDS])spriteUrls[id]=sprites[id].toDataURL();
    if(state)refresh();
  };
  artwork.src='data:image/png;base64,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';
  const grid=[
    ['west',null,'gold',null,'blueGate'],
    ['homeCrossing','stone','crossroads','blueMaze','blueVault'],
    ['redTrail',null,'south','labyrinthApproach','blackApproach'],
    [null,null,null,'labyrinthGate',null],
    [null,null,null,'labyrinthVault','white']
  ];
  const hardGrid=grid.map(row=>row.slice());
  const easyGrid=[
    [null,null,'gold',null,null],
    [null,'west','crossroads','blackApproach',null],
    [null,null,null,'blackApproachSouth','labyrinthApproach'],
    [null,'greyDungeon',null,null,'labyrinthGate'],
    [null,null,null,null,'labyrinthVault','white']
  ];
  const easyConnections={
    gold:{down:'crossroads'},
    crossroads:{up:'gold',left:'west',right:'blackApproach'},west:{right:'crossroads'},
    blackApproach:{left:'crossroads',down:'blackApproachSouth'},blackApproachSouth:{up:'blackApproach',down:'greyDungeon'},
    greyDungeon:{up:'blackApproachSouth'}
  };
  const hardConnections={};
  const mazeMapRooms=[null,'black','mazeTL','mazeTR','mazeML','mazeMR',null,'mazeBR'];
  const dragonMapRoom={goldInside:'gold',whiteInside:'white',blackInside:'black',blackDungeon:'black',nightfallInside:'black',greyDungeon:'mazeTR',...ELF_INTERIORS};
  const rooms={
    entry:{name:'THE FIRST GLADE',type:'entry'},
    labyrinthApproach:{name:'LABYRINTH APPROACH',type:'field'},
    labyrinthGate:{name:'BLUE LABYRINTH GATE',type:'maze'},labyrinthVault:{name:'BLUE VAULT',type:'maze'},
    white:{name:'WHITE CASTLE',type:'whiteCastle'},whiteInside:{name:'WHITE CASTLE HALL',type:'whiteInside'},
    black:{name:'BLACK CASTLE',type:'blackCastle'},blackInside:{name:'BLACK CASTLE HALL',type:'blackInside'},
    blackDungeon:{name:'GREY DUNGEON',type:'greyDungeon'},nightfallInside:{name:'EMBER VAULT',type:'blackInside'},
    blackApproachSouth:{name:'MISTWOOD THICKET',type:'field'},
    west:{name:"RUBY GROVE",type:'field'},gold:{name:'GOLDEN KEEP',type:'goldCastle'},blueGate:{name:"EMERALD GLADE",type:'maze'},
    homeCrossing:{name:'WILLOW CROSSING',type:'field'},
    stone:{name:'MOSSWOOD FOREST',type:'field'},crossroads:{name:'THE CROSSROADS',type:'field'},blueMaze:{name:'WINDING WOOD',type:'maze'},blueVault:{name:'MOONWELL VAULT',type:'maze'},
    redTrail:{name:"SAPPHIRE SHORE",type:'field'},south:{name:'WYRMWOOD WILDS',type:'field'},blackApproach:{name:"AMETHYST HOLLOW",type:'field'},
    westInside:{name:"RUBY COTTAGE",type:'elfInside'},blueGateInside:{name:"EMERALD COTTAGE",type:'elfInside'},
    redTrailInside:{name:"SAPPHIRE COTTAGE",type:'elfInside'},blackApproachInside:{name:"AMETHYST COTTAGE",type:'elfInside'},
    greyDungeon:{name:'ROOTBOUND VAULT',type:'greyDungeon'},goldInside:{name:'JEWELKEEP TREASURY',type:'goldInside'},
    mazeTL:{name:'WESTERN MAZE · FERN GALLERY',type:'newMaze'},mazeTR:{name:'WESTERN MAZE · TWILIGHT CROSSING',type:'newMaze'},
    mazeML:{name:'WESTERN MAZE · ROOT GALLERY',type:'newMaze'},mazeMR:{name:'WESTERN MAZE · MOONLIT CROSSING',type:'newMaze'},
    mazeBR:{name:'WESTERN MAZE · HEARTWOOD CHAMBER',type:'newMaze'}
  };
  const originalRoomNames=Object.fromEntries(Object.entries(rooms).map(([id,room])=>[id,room.name]));
  const easyRoomNames={};
  const MAZE_COLS=40,MAZE_ROWS=12,MAZE_CELL_W=W/MAZE_COLS,MAZE_CELL_H=H/MAZE_ROWS;
  // Blue Maze rooms 9, 6, 8, 7, 10 in panel order; # is wall, . is floor.
  // https://github.com/RoccoLoxPrograms/Adventure/blob/main/src/main.c#L2952-L2959
  const mazePatterns={
    mazeTL:[
      '########################################',
      '........................................',
      '........................................',
      '##########..################..##########',
      '##########..################..##########',
      '####..............####..............####',
      '####..............####..............####',
      '####..##########..####..##########..####',
      '####..##########..####..##########..####',
      '......##......##..####..##......##......',
      '......##......##..####..##......##......',
      '########..##..##..####..##..##..########'
    ],
    mazeTR:[
      '################........################',
      '........##....##........##....##........',
      '........##....##........##....##........',
      '####....##....####....####....##....####',
      '####....##....####....####....##....####',
      '####....##....................##....####',
      '####....##....................##....####',
      '##################....##################',
      '##################....##################',
      '......##........##....##........##......',
      '......##........##....##........##......',
      '####..##..########....########..##..####'
    ],
    mazeML:[
      '########..##..##..####..##..##..########',
      '......##..##..##........##..##..##......',
      '......##..##..##........##..##..##......',
      '####..##..##..############..##..##..####',
      '####..##..##..############..##..##..####',
      '......##..##................##..##......',
      '......##..##................##..##......',
      '########..####################..########',
      '########..####################..########',
      '........................................',
      '........................................',
      '################........################'
    ],
    mazeMR:[
      '####..##..########....########..##..####',
      '......##......####....####......##......',
      '......##......####....####......##......',
      '############..####....####..############',
      '############..####....####..############',
      '..........##..####....####..##..........',
      '..........##..####....####..##..........',
      '####..##..##..####....####..##..##..####',
      '####..##..##..####....####..##..##..####',
      '......##..##..##........##..##..##......',
      '......##..##..##........##..##..##......',
      '########..##..##........##..##..########'
    ],
    mazeBR:[
      '########..##..##........##..##..########',
      '......##......##........##......##......',
      '......##......##........##......##......',
      '####..##########........##########..####',
      '####..##########........##########..####',
      '####................................####',
      '####................................####',
      '########........................########',
      '########........................########',
      '......##........................##......',
      '......##........................##......',
      '########################################'
    ]
  };
  const mazeTiles=Object.fromEntries(Object.entries(mazePatterns).map(([room,rows])=>[room,rows.map(row=>[...row].map(tile=>tile==='.'))]));
  const mazePortals=[];
  function addMazePortal(label,from,edge,at,to,entryEdge,entryAt=at,width=(edge==='left'||edge==='right'?MAZE_CELL_H*2:MAZE_CELL_W*2)){
    mazePortals.push({label,from,edge,at,width,to,entryEdge,entryAt});
    mazePortals.push({label,from:to,edge:entryEdge,at:entryAt,width,to:from,entryEdge:edge,entryAt:at});
  }
  const mazeX=col=>(col+.5)*MAZE_CELL_W,mazeY=row=>(row+.5)*MAZE_CELL_H;
  const upperMazeSide=mazeY(1.5),middleMazeSide=mazeY(5.5),lowerMazeSide=mazeY(9.5);
  addMazePortal('Z','stone','up',W/2,'mazeML','down',W/2,MAZE_CELL_W*8);
  addMazePortal('G','mazeTR','up',480,'black','down',480,MAZE_CELL_W*8);
  addMazePortal('WOOD','blueMaze','down',480,'labyrinthApproach','up',480,180);
  addMazePortal('GATE','labyrinthApproach','down',480,'labyrinthGate','up',480,180);
  addMazePortal('VAULT','labyrinthGate','down',480,'labyrinthVault','up',480,180);
  for(const [label,y] of [['A',lowerMazeSide],['B',middleMazeSide],['C',upperMazeSide]])addMazePortal(label,'mazeML','left',y,'mazeMR','right');
  addMazePortal('D','mazeTL','left',lowerMazeSide,'mazeTR','right');
  addMazePortal('E','mazeTL','left',upperMazeSide,'mazeTR','right');
  addMazePortal('F','mazeTL','right',upperMazeSide,'mazeBR','left');
  addMazePortal('5','mazeTR','left',upperMazeSide,'mazeBR','right');
  addMazePortal('Y','mazeTL','right',lowerMazeSide,'mazeTR','left');
  for(const [label,col] of [['H',8.5],['K',16.5],['L',22.5],['M',26.5],['N',30.5]])addMazePortal(label,'mazeTL','down',mazeX(col),'mazeML','up');
  // I and J share the second gray opening in the source diagram.
  for(const [label,col] of [['I',12],['J',13]])addMazePortal(label,'mazeTL','down',mazeX(col),'mazeML','up',mazeX(col),20);
  for(const [label,col] of [['O',4.5],['P',8.5],['Q',19.5],['R',30.5],['S',34.5]])addMazePortal(label,'mazeTR','down',mazeX(col),'mazeMR','up');
  for(const [label,col] of [['T',8.5],['U',12.5],['V',19.5],['W',26.5],['X',30.5]])addMazePortal(label,'mazeMR','down',mazeX(col),'mazeBR','up',mazeX(col),MAZE_CELL_W*(label==='V'?8:2));
  for(const [label,y] of [['1',upperMazeSide],['2',middleMazeSide],['3',lowerMazeSide]])addMazePortal(label,'mazeML','right',y,'mazeMR','left');
  function mazePortal(room,edge,at){return mazePortals.find(p=>p.from===room&&p.edge===edge&&Math.abs(p.at-at)<p.width/2);}
  function mazeEntry(p){return {x:p.entryEdge==='left'?30:p.entryEdge==='right'?W-30:p.entryAt,y:p.entryEdge==='up'?(mazeTiles[p.to]?30:55):p.entryEdge==='down'?(mazeTiles[p.to]?H-30:H-55):p.entryAt};}
  function mazeDoor(p){return {to:p.to,exit:{x:p.edge==='left'?35:p.edge==='right'?W-35:p.at,y:p.edge==='up'?35:p.edge==='down'?H-35:p.at},entry:mazeEntry(p)};}
  function mazeBaseFloor(room,x,y){const col=Math.max(0,Math.min(MAZE_COLS-1,Math.floor(x/MAZE_CELL_W))),row=Math.max(0,Math.min(MAZE_ROWS-1,Math.floor(y/MAZE_CELL_H)));return mazeTiles[room][row][col];}
  function mazeFloor(room,x,y){
    return bridgeCovers(room,x,y)||mazeBaseFloor(room,x,y);
  }
  function mazeBlocked(room,x,y){
    if(x<-40||x>W+40||y<-40||y>H+40)return true;
    for(const sx of [-9,9])for(const sy of [-9,9])if(!mazeFloor(room,x+sx,y+sy))return true;
    return x<0&&!mazePortal(room,'left',y)||x>W&&!mazePortal(room,'right',y)||y<0&&!mazePortal(room,'up',x)||y>H&&!mazePortal(room,'down',x);
  }
  const itemInfo={whiteKey:['White key','\u26bf','#ffffff'],blackKey:['Black key','⚿','#000000'],goldKey:['Gold key','⚿','#f6cc61'],bridge:['Bridge','||','#d9b576'],bridge2:['Bridge','||','#d9b576'],sword:['Sword','⚔','#d9e8ef'],magnet:['Magnet','∩','#080808'],bat:['Bat','✦','#dce0d0'],apple:['Apple','●','#a5141b'],coin:['Coin','●','#f6cc61'],axe:['Axe','⚒','#000000'],axe2:['Axe','⚒','#000000'],flower:['Flower','✿','#006400'],flute:['Flute','♫','#ffffff']};
  for(const [id,name,colorIndex] of JEWEL_VARIANTS)itemInfo[id]=[name,'◆',JEWEL_COLORS[colorIndex]];
  for(const [id,kind] of Object.entries(EXTRA_GIFTS))itemInfo[id]=[...itemInfo[kind]];
  for(const id of AXE_IDS)itemInfo[id]=[...itemInfo.axe];
  for(const [id,home] of Object.entries(ELF_HOME_KEYS))itemInfo[id]=[ELF_NAMES[home]+"'s home key",itemInfo.goldKey[1],ELF_HOME_COLORS[home]];
  const itemStarts={blackKey:['crossroads',800,530],goldKey:['gold',210,285],bridge:['south',180,500],bridge2:['placed',MAZE_BRIDGE_X,MAZE_BRIDGE_Y],sword:['crossroads',600,465],magnet:['blueVault',730,320],apple:['crossroads',330,365],coin:['crossroads',480,365],axe:['crossroads',710,400],flower:['crossroads',330,465],flute:['crossroads',480,465]};
  JEWEL_VARIANTS.forEach(([id],index)=>{itemStarts[id]=['crossroads',330+index*90,530];});
  Object.assign(itemStarts,{apple2:['crossroads',260,365],apple3:['crossroads',400,365],coin2:['crossroads',550,365],coin3:['crossroads',620,365]});
  for(const [id,home] of Object.entries(ELF_AXES))itemStarts[id]=[home+'Inside',650,415];
  const dragonStarts=[['Yorgle','#e7c859','west',180,320,105],['Grundle','#7ac475','south',480,320,88],['Rhindle','#e97568','whiteInside',480,195,133]];
  const dir={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  let state,keys=new Set(),last=0,moveDelay=0,noticeTimer=0,batTimer=0,magnetPulse=0;
  const overlay=$('overlay'),transitionScreen=$('transitionScreen'),hints=$('hints'),hintsToggle=$('hintsToggle');
  const emotionsToggle=$('emotionsToggle'),behaviorToggle=$('behaviorToggle'),behaviorDialog=$('behaviorDialog');
  let emotionsVisible=true;
  let fadeTimer=0,fadeToken=0;
  function createDragon([name,color,room,x,y,speed]){return {name,color,room,x,y,speed,dead:false,biting:false,biteTimer:0,follow:[],escape:null,path:[],pathTimer:0};}
  function randomWildsTrees(){return [[135,285,125,195],[675,825,125,195],[135,285,445,515],[675,825,445,515]].map(([minX,maxX,minY,maxY])=>({x:Math.round(minX+Math.random()*(maxX-minX)),y:Math.round(minY+Math.random()*(maxY-minY))}));}
  function roomTrees(room){if(room==='stone')return STONE_PASSAGE_TREES;if(room==='labyrinthApproach')return LABYRINTH_APPROACH_TREES;if(room==='blueMaze')return WINDING_WOOD_TREES;if(state.questMode==='easy')return [];return room==='south'?state.trees:room==='blackApproachSouth'?BLACK_APPROACH_TREES:[];}
  function shuffleCastles(){
    const slots=[];
    for(let row=0;row<grid.length;row++)for(let col=0;col<grid[row].length;col++){
      if(grid[row][col]&&!['west','greyDungeon','south'].includes(grid[row][col])){
        const above=grid.slice(0,row).reverse().map(r=>r[col]).find(Boolean),below=grid.slice(row+1).map(r=>r[col]).find(Boolean);
        // The castle has only vertical exits, so its random slot needs one.
        if([above,below].some(id=>id&&id!=='south'))slots.push([row,col]);
      }
    }
    for(const castle of ['gold']){
      const chosen=slots.splice(Math.floor(Math.random()*slots.length),1)[0];
      const origin=currentGrid(castle);
      [grid[chosen[0]][chosen[1]],grid[origin[1]][origin[0]]]=[grid[origin[1]][origin[0]],grid[chosen[0]][chosen[1]]];
    }
  }
  function randomFloorLocations(room){
    const step=30,cols=31,rows=20,points=[],open=new Set(),visited=new Set(),queue=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const point={x:30+col*step,y:20+row*step},index=row*cols+col;
      points[index]=point;if(!blocked(room,point.x,point.y))open.add(index);
    }
    const entrances=room.endsWith('Inside')?[{x:480,y:525}]:[
      {x:90,y:320},{x:870,y:320},{x:480,y:85},{x:480,y:555}
    ].filter((point,index)=>Object.values(visibleExits(room))[index]);
    for(const entrance of entrances){
      const seed=[...open].filter(index=>Math.hypot(points[index].x-entrance.x,points[index].y-entrance.y)<65&&clearDragonRoute(room,entrance.x,entrance.y,points[index].x,points[index].y))
        .sort((a,b)=>Math.hypot(points[a].x-entrance.x,points[a].y-entrance.y)-Math.hypot(points[b].x-entrance.x,points[b].y-entrance.y))[0];
      if(seed!==undefined&&!visited.has(seed)){visited.add(seed);queue.push(seed);}
    }
    for(let i=0;i<queue.length;i++){
      const index=queue[i],col=index%cols,row=Math.floor(index/cols);
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nextCol=col+dc,nextRow=row+dr,next=nextRow*cols+nextCol;
        if(nextCol<0||nextCol>=cols||nextRow<0||nextRow>=rows||!open.has(next)||visited.has(next))continue;
        if(!clearDragonRoute(room,points[index].x,points[index].y,points[next].x,points[next].y))continue;
        visited.add(next);queue.push(next);
      }
    }
    return queue.map(index=>points[index]);
  }
  function randomizeQuest(){
    shuffleCastles();delete state.placedBridges.bridge2;state.items.bridge2={room:'unplaced',x:0,y:0};
    const roomIds=[...grid.flat().filter(Boolean),'goldInside'];
    const floors=Object.fromEntries(roomIds.map(room=>[room,randomFloorLocations(room)]));
    const occupied=Object.entries(state.items).filter(([id])=>CROSSING_ITEMS[id]||id==='bridge'||id==='sword').map(([,item])=>({...item}));
    function place(allowedRooms,margin=35){
      const choices=allowedRooms.map(room=>({room,points:floors[room].filter(point=>
        !blocked(room,point.x-margin/2,point.y-margin/2)&&!blocked(room,point.x+margin/2,point.y-margin/2)&&
        !blocked(room,point.x-margin/2,point.y+margin/2)&&!blocked(room,point.x+margin/2,point.y+margin/2)&&
        occupied.every(other=>other.room!==room||Math.hypot(point.x-other.x,point.y-other.y)>100)
      )})).filter(choice=>choice.points.length);
      const choice=choices[Math.floor(Math.random()*choices.length)];
      if(!choice)throw new Error('No accessible random quest location');
      const point=choice.points[Math.floor(Math.random()*choice.points.length)];
      const location={room:choice.room,x:point.x,y:point.y};occupied.push(location);return location;
    }
    const outside=grid.flat().filter(Boolean),allRooms=[...outside,'goldInside'];
    const player=place(outside);state.room=player.room;state.player.x=player.x;state.player.y=player.y;state.seen=new Set([player.room]);
    for(const id of Object.keys(state.items)){
      if(id==='blackKey'||id==='bridge'||id==='sword'||CROSSING_ITEMS[id])continue;
      state.items[id]=place(id==='goldKey'?['gold']:id.endsWith('Key')?outside:allRooms,id.startsWith('bridge')?155:35);
    }
  }
  function initial(room='entry'){
    stopFluteSound();
    const easy=room==='easy',layout=easy?easyGrid:hardGrid;
    for(const [id,name] of Object.entries(originalRoomNames))rooms[id].name=easy?(easyRoomNames[id]||name):name;
    for(let row=0;row<grid.length;row++)grid[row]=layout[row].slice();
    const mapColumns=Math.max(...grid.map(row=>row.length));
    for(const row of grid)while(row.length<mapColumns)row.push(null);
    if(easy)room='gold';
    const batRoom='south';
    state={room,player:{x:480,y:room==='entry'?470:530,face:'up',contact:'',bounce:{x:0,y:0,time:BOUNCE_SECONDS}},held:null,heldSide:'up',heldBridgeOffset:null,pickupDelay:0,touchingBridgeLeg:null,items:Object.fromEntries(Object.entries(itemStarts).map(([id,[itemRoom,x,y]])=>[id,{room:itemRoom,x,y}])),gates:{gold:false,black:false,white:false},gateLatched:{gold:false,black:false,white:false},gateLift:{gold:0,black:0,white:0},placedBridges:{bridge2:{room:'mazeTR',x:MAZE_BRIDGE_X,y:MAZE_BRIDGE_Y,vertical:true}},dragons:dragonStarts.map(createDragon),bat:{room:batRoom,x:70+Math.random()*(W-140),y:70+Math.random()*(H-140),vx:.8,vy:.6,mazeDestination:null,mazePortal:null,carrying:null,carryingDragon:null,pickupCooldown:0,sightCooldown:1,chaseTimer:0},seen:new Set(room==='entry'?[]:['gold']),swallowedBy:null,winTimer:0,mode:'title',message:'Bring all six jewels back to the Jewelkeep Treasury.'};
    for(const home of Object.keys(ELF_HOME_COLORS)){state.gates[home]=true;state.gateLatched[home]=false;state.gateLift[home]=1;}
    state.roomEnteredAt=performance.now();
    state.jewelFlashElapsed=0;
    state.jewelFlashSchedule=Object.fromEntries(JEWEL_VARIANTS.map(([id],index)=>[id,{start:null,next:4-index*4/JEWEL_VARIANTS.length}]));
    state.questMode=easy?'easy':room==='random'?'random':'hard';
    state.trees=randomWildsTrees();
    state.elves=Object.keys(ELF_HOME_COLORS).map((home,index)=>({home,room:grid.flat().includes(home)?home:'crossroads',x:grid.flat().includes(home)?770:620+index*70,y:grid.flat().includes(home)?445:160,goal:null,path:[],stunTimer:0,surpriseTimer:0,giftsReceived:0,trusted:false,emotionalState:{sentiment:2,passion:2},wait:1+index*.6}));
    state.axeFlights=Object.fromEntries(AXE_IDS.map(id=>[id,null]));
    state.axePickupDirections=Object.fromEntries(AXE_IDS.map(id=>[id,null]));
    state.axeRecoveries=Object.fromEntries(AXE_IDS.map(id=>[id,null]));
    state.usedAxes=new Set();
    state.axeFades={};
    if(easy){
      for(const item of Object.values(state.items))item.room='absent';
      Object.assign(state.items,{
        goldKey:{room:'gold',x:210,y:285},blackKey:{room:'crossroads',x:800,y:530},
        sword:{room:'crossroads',x:600,y:465},bridge:{room:'south',x:180,y:500},
        magnet:{room:'blackApproachSouth',x:790,y:555},
        bridge2:{room:'placed',x:MAZE_BRIDGE_X,y:MAZE_BRIDGE_Y}
      });
    }
    for(const [id,home] of Object.entries(ELF_TREASURES))state.items[id]={room:home+'Inside',x:800,y:415,treasureOwner:home,elfAssessment:{home,x:800,y:415}};
    if(room==='random')randomizeQuest();
    for(const [items,slot] of [[ELF_AXES,ELF_TREASURE_SLOTS[0]],[ELF_HOME_KEYS,ELF_TREASURE_SLOTS[1]]]){
      for(const [id,home] of Object.entries(items))state.items[id]={room:home+'Inside',x:slot.x,y:slot.y,treasureOwner:home,elfAssessment:{home,x:slot.x,y:slot.y}};
    }
    const secondBlackRoom=easy?'nightfallInside':'blackDungeon';
    state.items.sword={room:'goldInside',x:310,y:330};
    state.items.axe={room:'goldInside',x:180,y:330};
    const kingdomGifts={
      apple:['stone',480,200],apple2:['homeCrossing',480,420],apple3:['blueVault',480,320],
      coin:['crossroads',330,200],coin2:['blueMaze',480,320],coin3:['redTrail',150,320],
      flower:['blackApproach',150,320],flute:['blueGate',150,320]
    };
    const easyGifts={apple:['west',150,320],apple2:['crossroads',330,200],apple3:['blackApproach',150,320],
      coin:['gold',210,365],coin2:['blackApproachSouth',480,100],coin3:['greyDungeon',480,320],
      flower:['labyrinthVault',780,320],flute:['labyrinthApproach',480,150]};
    for(const [id,[room,x,y]] of Object.entries(easy?easyGifts:kingdomGifts))state.items[id]={room,x,y};
    state.items.apple4={room:'mazeBR',x:240,y:530};
    state.items.coin4={room:'mazeML',x:720,y:530};
    state.items.whiteKey={room:'stone',x:475,y:455};
    state.items.blackKey={room:'labyrinthVault',x:480,y:320};
    state.items.jewelOrange={room:'whiteInside',x:480,y:320};
    state.items.jewelGold={room:secondBlackRoom,x:480,y:320};
    state.dragons.push(createDragon(['Vesper','#9246c0',secondBlackRoom,600,320,110]));
    positionLooseObjectsNearWalls();
    const bridgeTree=state.trees[2];
    state.items.bridge={room:'south',x:bridgeTree.x+150,y:Math.min(485,bridgeTree.y)};
    const guardian=state.dragons.find(dragon=>dragon.name==='Rhindle'),amber=state.items.jewelOrange;
    const guardSpot=[[0,110],[-110,0],[110,0],[0,-110]].map(([dx,dy])=>({x:amber.x+dx,y:amber.y+dy})).find(point=>!blocked(guardian.room,point.x,point.y,true));
    if(guardSpot){guardian.x=guardSpot.x;guardian.y=guardSpot.y;}
    state.bat.x=480;state.bat.y=240;
    keys.clear();moveDelay=0;batTimer=0;magnetPulse=0;refresh();
  }
  function say(t){state.message=t;noticeTimer=4;refresh();}
  function positionLooseObjectsNearWalls(){
    const positioned=[];
    for(const [id,item] of Object.entries(state.items)){
      if(!rooms[item.room]||item.treasureOwner||item.room==='goldInside'||id==='goldKey'||id==='whiteKey')continue;
      const margin=isBridge(id)?155:85,halfW=isBridge(id)?BRIDGE_WIDTH/2:20,halfH=isBridge(id)?BRIDGE_HEIGHT/2:20;
      const doors=connectedRooms(item.room).flatMap(room=>dragonDoors(item.room,room));
      for(const castle of ['gold','black','white']){
        if(item.room===castle)doors.push(...dragonDoors(castle,castle+'Inside'));
        if(item.room===castle+'Inside')doors.push(...dragonDoors(item.room,castle));
      }
      const candidates=[];
      for(let y=margin;y<=H-margin;y+=30)for(const x of [margin,W-margin])candidates.push({x,y});
      for(let x=margin;x<=W-margin;x+=30)for(const y of [margin,H-margin])candidates.push({x,y});
      candidates.sort((a,b)=>Math.hypot(a.x-item.x,a.y-item.y)-Math.hypot(b.x-item.x,b.y-item.y));
      const spot=candidates.find(point=>
        [[0,0],[-halfW,-halfH],[halfW,-halfH],[-halfW,halfH],[halfW,halfH]].every(([dx,dy])=>!blocked(item.room,point.x+dx,point.y+dy,true))&&
        doors.every(door=>Math.hypot(point.x-door.exit.x,point.y-door.exit.y)>110)&&
        positioned.every(other=>other.room!==item.room||Math.hypot(point.x-other.x,point.y-other.y)>halfW+other.halfW+35)&&
        (item.room!==state.room||Math.hypot(point.x-state.player.x,point.y-state.player.y)>80)
      );
      if(spot){item.x=spot.x;item.y=spot.y;positioned.push({room:item.room,...spot,halfW});}
    }
  }
  function showOverlay(title,description,button){$('overlayTitle').textContent=title;$('overlayText').textContent=description;$('overlayBtn').textContent=button;overlay.classList.toggle('game-over',state.mode==='lost');overlay.classList.toggle('title',state.mode==='title');overlay.hidden=false;}
  function hideOverlay(){overlay.hidden=true;overlay.classList.remove('game-over','title','fading','transitioning');}
  function sideTouched(p,item){const dx=item.x-p.x,dy=item.y-p.y;if(Math.abs(dx)<1&&Math.abs(dy)<1)return p.face;return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
  function heldPosition(distance=35){const p=state.player,d=dir[state.heldSide];return {x:p.x+d.x*distance,y:p.y+d.y*distance};}
  function heldBridgePosition(){const offset=state.heldBridgeOffset;return offset?{x:state.player.x+offset.x,y:state.player.y+offset.y}:heldPosition(BRIDGE_HOLD_DISTANCE);}
  function hasCarriedItem(id){return state.held===id||state.held==='bat'&&state.bat.carrying===id;}
  function isBridge(id){return BRIDGE_IDS.includes(id);}
  function isAxe(id){return AXE_IDS.includes(id);}
  function bridgeDimensions(){return {width:BRIDGE_WIDTH,height:BRIDGE_HEIGHT};}
  function touchesLooseItem(id,item,p){return isBridge(id)?touchesBridgeShape(item,p):Math.hypot(item.x-p.x,item.y-p.y)<32;}
  function touchesBridgeShape(bridge,p){
    const left=Math.max(0,Math.floor((p.x-BRIDGE_TOUCH_RADIUS-bridge.x+BRIDGE_WIDTH/2)*70/BRIDGE_WIDTH));
    const right=Math.min(70,Math.ceil((p.x+BRIDGE_TOUCH_RADIUS-bridge.x+BRIDGE_WIDTH/2)*70/BRIDGE_WIDTH));
    const top=Math.max(0,Math.floor((p.y-BRIDGE_TOUCH_RADIUS-bridge.y+BRIDGE_HEIGHT/2)*51/BRIDGE_HEIGHT));
    const bottom=Math.min(51,Math.ceil((p.y+BRIDGE_TOUCH_RADIUS-bridge.y+BRIDGE_HEIGHT/2)*51/BRIDGE_HEIGHT));
    if(left>=right||top>=bottom)return false;
    if(bridgePixelData){for(let row=top;row<bottom;row++)for(let col=left;col<right;col++)if(bridgePixelData[(row*70+col)*4+3])return true;return false;}
    const across=Math.abs(p.x-bridge.x),along=Math.abs(p.y-bridge.y);
    return across>=BRIDGE_LEG_OFFSET&&across<=BRIDGE_WIDTH/2+11&&Math.abs(along-BRIDGE_HEIGHT/2)<=20;
  }
  function carriedBridgeId(){return isBridge(state.held)?state.held:state.held==='bat'&&isBridge(state.bat.carrying)?state.bat.carrying:null;}
  function batCarriedPosition(id){
    const b=state.bat;
    if(state.held==='bat'){syncHeldBat();const side=dir[state.heldSide],distance=isBridge(id)?BRIDGE_HOLD_DISTANCE:35;return {room:b.room,x:b.x+side.x*distance,y:b.y+side.y*distance};}
    return {room:b.room,x:b.x,y:b.y+(isBridge(id)?Math.round(55*BRIDGE_SCALE):39)};
  }
  function elfCarriedPosition(elf){
    const id=elf.carrying,sprite=sprites[id],resident=elfSprite(elf);
    const elfWidth=resident?ELF_SIZE*resident.width/resident.height:47;
    let width=isAxe(id)?48:34,height=isAxe(id)?54.4:14;
    if(isBridge(id))({width,height}=bridgeDimensions(id));
    else if(id==='sword'){width=36;height=22;}
    else if(CROSSING_ITEMS[id]&&sprite?.width&&sprite?.height){
      const [, ,sw,sh]=CROSSING_ITEMS[id].crop||[0,0,sprite.width,sprite.height];
      const jewel=JEWEL_VARIANTS.some(([jewelId])=>jewelId===id);
      const scale=jewel?.7:(isAxe(id)?54.4:id==='flower'?40.8:34)/Math.max(sw,sh);
      width=sw*scale*(id==='flute'?1.2:1);height=sh*scale*(id==='flute'?.8:1);
    }
    // Include the elf's 3px shadow on its right and bottom edges.
    if(isAxe(id)){
      elf.axeSide??='right';
      const left=elf.axeSide==='left',distance=elfWidth/2+width/2+4+(left?0:3);
      return {room:elf.room,x:elf.x+(left?-distance:distance),y:elf.y};
    }
    return {room:elf.room,x:elf.x,y:elf.y+ELF_SIZE/2+3+4+height/2};
  }
  function itemPosition(id){
    if(state.held===id)return {room:state.room,...(isBridge(id)?heldBridgePosition():heldPosition())};
    if(state.bat.carrying===id)return batCarriedPosition(id);
    const elf=state.elves.find(elf=>elf.carrying===id);
    if(elf)return elfCarriedPosition(elf);
    return state.items[id];
  }
  function bridgeCovers(room,x,y){
    return Object.values(state.placedBridges).some(bridge=>{
      if(bridge.room!==room)return false;
      const across=Math.abs(x-bridge.x);
      const along=Math.abs(y-bridge.y);
      return across<=BRIDGE_LEG_OFFSET&&along<=BRIDGE_HEIGHT/2+(mazeTiles[room]?0:15);
    });
  }
  function syncHeldBat(){const pos=heldPosition(),b=state.bat;b.room=state.room;b.x=Math.max(25,Math.min(W-25,pos.x));b.y=Math.max(25,Math.min(H-25,pos.y));}
  function enter(room,x,y,usedDoor=null){
    const arrival=safeArrival(room,x,y);x=arrival.x;y=arrival.y;
    const from=state.room,door=usedDoor||dragonDoor(from,room);
    if(from===room+'Inside'&&Object.hasOwn(state.gateLatched,room)&&hasCarriedItem(room+'Key'))state.gateLatched[room]=state.heldSide==='down';
    if(door)for(const d of state.dragons){
      if(d.dead)continue;
      if(d.room===from){if(!hasCarriedItem('sword')&&!d.escape)d.follow=[door];d.path=[];d.pathTimer=0;d.biting=false;}
      else if(d.follow.length&&d.follow[d.follow.length-1].to===from)d.follow.push(door);
    }
    state.room=room;state.roomEnteredAt=performance.now();state.player.x=x;state.player.y=y;state.player.contact='';state.player.bounce.time=BOUNCE_SECONDS;state.touchingBridgeLeg=null;if(state.held==='bat')syncHeldBat();state.seen.add(room);moveDelay=.32;refresh();
  }
  function currentGrid(room=state.room){for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(grid[y][x]===room)return [x,y];return null;}
  function safeArrival(room,x,y){
    const clear=(px,py)=>!blocked(room,px,py)&&[[6,0],[-6,0],[0,6],[0,-6]].every(([dx,dy])=>!blocked(room,px+dx,py+dy));
    if(clear(x,y))return {x,y};
    let best=null,distance=Infinity;
    for(let py=Math.max(20,y-160);py<=Math.min(H-20,y+160);py+=8)for(let px=Math.max(20,x-160);px<=Math.min(W-20,x+160);px+=8){
      const next=Math.hypot(px-x,py-y);if(next<distance&&clear(px,py)){best={x:px,y:py};distance=next;}
    }
    return best||mapLanding(room)||{x,y};
  }
  function mapLanding(room){
    const target={x:480,y:ELF_HOME_COLORS[room]?530:320};let best=null,bestDistance=Infinity;
    for(let y=70;y<=570;y+=20)for(let x=70;x<=890;x+=20){
      if(blocked(room,x,y)||[[6,0],[-6,0],[0,6],[0,-6]].some(([dx,dy])=>blocked(room,x+dx,y+dy)))continue;
      if(![[24,0],[-24,0],[0,24],[0,-24]].some(([dx,dy])=>!blocked(room,x+dx,y+dy)))continue;
      if(state.dragons.some(d=>d.room===room&&Math.hypot(x-d.x,y-d.y)<90))continue;
      const distance=Math.hypot(x-target.x,y-target.y);
      if(distance<bestDistance){best={x,y};bestDistance=distance;}
    }
    return best;
  }
  function teleportToRoom(room){
    if(!rooms[room]||!['playing','paused'].includes(state.mode))return false;
    const landing=mapLanding(room);if(!landing)return false;
    keys.clear();state.mode='playing';hideOverlay();enter(room,landing.x,landing.y);canvas.focus();return true;
  }
  function visibleExits(room=state.room){
    if(room==='blackInside')return {left:false,right:false,up:true,down:true};
    if(room==='blackDungeon'||room==='nightfallInside')return {left:false,right:false,up:false,down:true};
    if(room==='goldInside'||room==='whiteInside')return {left:false,right:false,up:false,down:true};
    return Object.fromEntries(Object.entries(dir).map(([edge,d])=>[edge,neighbor(room,d)!==room]));
  }
  function neighbor(room,d){
    if(room==='labyrinthVault'&&d.x>0)return 'white';
    if(room==='white')return d.x<0?'labyrinthVault':room;
    if(room==='whiteInside')return d.y>0?'white':room;
    if(room==='blackInside')return d.y<0?(state.questMode==='easy'?'nightfallInside':'blackDungeon'):d.y>0?'black':room;
    if(room==='blackDungeon'||room==='nightfallInside')return d.y>0?'blackInside':room;
    if(room==='labyrinthApproach')return d.y<0?'blueMaze':d.y>0?'labyrinthGate':room;
    if(room==='labyrinthGate')return d.y<0?'labyrinthApproach':d.y>0?'labyrinthVault':room;
    if(room==='labyrinthVault')return d.y<0?'labyrinthGate':room;
    if(room==='blueMaze'&&d.y>0)return 'labyrinthApproach';
    if(state.questMode!=='easy'&&room==='greyDungeon'&&d.y<0)return room;
    if(ELF_INTERIORS[room])return d.y>0?ELF_INTERIORS[room]:room;
    if(room==='south')return d.y<0?'crossroads':room;
    if(room==='crossroads'&&d.y>0)return 'south';
    if(room==='gold'&&d.x)return room;
    const edge=d.x<0?'left':d.x>0?'right':d.y<0?'up':'down';
    if(state.questMode==='easy'&&easyConnections[room])return easyConnections[room][edge]||room;
    if(state.questMode!=='easy'&&hardConnections[room]?.[edge])return hardConnections[room][edge];
    const portal=mazePortals.find(p=>p.from===room&&p.edge===edge);
    if(portal)return portal.to;
    const pos=currentGrid(room);if(!pos)return room;
    // Keep the original map slots; cross gaps left by removed rooms directly.
    for(let x=pos[0]+d.x,y=pos[1]+d.y;y>=0&&y<grid.length&&x>=0&&x<grid[y].length;x+=d.x,y+=d.y){
      if(grid[y][x])return grid[y][x]==='white'||grid[y][x]==='south'||grid[y][x]==='gold'&&d.x||d.x&&['labyrinthApproach','labyrinthGate','labyrinthVault'].includes(grid[y][x])?room:grid[y][x];
    }
    return room;
  }
  function dragonDoor(from,to){
    const dungeon=state.questMode==='easy'?'nightfallInside':'blackDungeon';
    if(from==='blackInside'&&to===dungeon)return {to,exit:{x:480,y:55},entry:{x:480,y:555}};
    if(from===dungeon&&to==='blackInside')return {to,exit:{x:480,y:585},entry:{x:480,y:110}};
    if(from==='south'&&to==='crossroads')return {to,exit:{x:480,y:55},entry:{x:480,y:585}};
    if(from==='crossroads'&&to==='south')return {to,exit:{x:480,y:585},entry:{x:480,y:55}};
    if(ELF_HOME_COLORS[from]&&to===from+'Inside')return {to,exit:{x:488.5,y:houseWorldY(from,400)},entry:{x:480,y:525}};
    if(ELF_INTERIORS[from]===to)return {to,exit:{x:480,y:585},entry:{x:488.5,y:houseWorldY(to,515)}};
    const maze=mazePortals.find(p=>p.from===from&&p.to===to);
    if(maze)return mazeDoor(maze);
    if(currentGrid(from)&&currentGrid(to)||state.questMode!=='easy'&&hardConnections[from]?.up===to||state.questMode!=='easy'&&hardConnections[from]?.down===to){
      if(neighbor(from,dir.right)===to)return {to,exit:{x:925,y:320},entry:{x:35,y:320}};
      if(neighbor(from,dir.left)===to)return {to,exit:{x:35,y:320},entry:{x:925,y:320}};
      if(neighbor(from,dir.down)===to)return {to,exit:{x:480,y:585},entry:{x:480,y:55}};
      if(neighbor(from,dir.up)===to)return {to,exit:{x:480,y:55},entry:{x:480,y:585}};
    }
    for(const castle of ['gold','black','white']){
      if(from===castle&&to===castle+'Inside')return {to,exit:{x:480,y:465+CASTLE_SHIFT},entry:{x:480,y:525}};
      if(from===castle+'Inside'&&to===castle)return {to,exit:{x:480,y:585},entry:{x:480,y:510+CASTLE_SHIFT}};
    }
    return null;
  }
  function roomWalls(room){const type=rooms[room].type;
    if(room==='labyrinthApproach')return [{x:0,y:DUNGEON_WALL_Y,w:W,h:DUNGEON_WALL_HEIGHT}];
    if(room==='labyrinthGate'||room==='labyrinthVault')return [{x:185,y:90,w:50,h:160},{x:665,y:390,w:50,h:160},{x:155,y:445,w:160,h:45},{x:635,y:145,w:165,h:45},{x:390,y:115,w:45,h:100},{x:515,y:435,w:45,h:95}];
    if(room==='homeCrossing')return ELF_CROSSING_WALLS;
    if(ELF_HOME_COLORS[room])return [];
    if(ELF_INTERIORS[room])return [];
    if(state.questMode==='easy')return [];
    if(room==='goldInside'||room==='whiteInside')return [];
    if(room==='blackApproachSouth')return BLACK_APPROACH_WALLS;
    if(room==='blueMaze')return WINDING_WOOD_WALLS;
    if(type==='redDungeon')return [{x:0,y:DUNGEON_WALL_Y,w:W,h:DUNGEON_WALL_HEIGHT}];
    if(type==='maze'||type==='greyDungeon')return [{x:185,y:90,w:50,h:160},{x:665,y:390,w:50,h:160},{x:155,y:445,w:160,h:45},{x:635,y:145,w:165,h:45},{x:390,y:115,w:45,h:100},{x:515,y:435,w:45,h:95}];
    if(type==='dark')return [{x:220,y:100,w:48,h:150},{x:680,y:380,w:48,h:155},{x:240,y:460,w:150,h:45},{x:600,y:140,w:130,h:45}];
    if(type.endsWith('Inside'))return [{x:135,y:160,w:160,h:50},{x:665,y:160,w:160,h:50},{x:135,y:410,w:150,h:45},{x:675,y:410,w:150,h:45}];
    return [];
  }
  function castleBlocked(x,y,r,room=state.room){
    r=PLAYER_HALF_SIZE;
    const {sx,sy,x:originX,y:originY}=castleTransform();
    const hit=([ax,ay,w,h])=>x+r>originX+ax*sx&&x-r<originX+(ax+w)*sx&&y+r>originY+ay*sy&&y-r<originY+(ay+h)*sy;
    if(GOLD_CASTLE_ART.body.some(hit))return true;
    const gate=GOLD_CASTLE_ART.gate,height=Math.max(0,gate.h-gate.travel*state.gateLift[room]);
    return hit([gate.x,gate.y,gate.w,height]);
  }
  function elfHouseBlocked(room,x,y,r){
    y=houseWorldY(room,y);
    const house=ELF_HOUSE;
    if(x+r<=house.x||x-r>=house.x+house.w||y+r<=house.y||y-r>=house.y+house.h)return false;
    const gateHeight=126-(126-house.gateH)*state.gateLift[room];
    return !(x-r>=house.doorX&&x+r<=house.doorX+house.doorW&&y-r>=house.doorY+gateHeight);
  }
  function elfBlocked(room,x,y,r,ignoreElf=null){
    if(ignoreElf===true||typeof ignoreElf==='string')return false;
    return (state.elves||[]).some(elf=>{
      if(elf.room!==room||elf.home===ignoreElf)return false;
      return elfDistanceSquared(elf,x,y,r)<1;
    });
  }
  function elfDistanceSquared(elf,x,y,r){
    const sprite=sprites.elves[elf.home],width=sprite?ELF_SIZE*sprite.width/sprite.height:ELF_SIZE;
    const dx=(x-elf.x)/(width/2+r),dy=(y-elf.y)/(ELF_SIZE/2+r);return dx*dx+dy*dy;
  }
  function playerBlocked(x,y,fromX,fromY){
    if(blocked(state.room,x,y,true,true))return true;
    if(protectedJewelFields(state.room).some(pos=>{
      const before=jewelProtectionDistance(pos,fromX,fromY),after=jewelProtectionDistance(pos,x,y);
      return after<1&&!(before<1&&after>before);
    }))return true;
    return state.elves.some(elf=>{
      if(elf.room!==state.room)return false;
      const before=elfDistanceSquared(elf,fromX,fromY,15),after=elfDistanceSquared(elf,x,y,15);
      return after<1&&!(before<1&&after>before);
    });
  }
  function elfObjectBlocked(room,x,y){
    const radius=ELF_SIZE/2;
    return Object.entries(state.items).some(([id,item])=>{
      if(item.room.startsWith('elf:'))return false;
      if(isAxe(id)&&(state.usedAxes.has(id)||state.axeFlights[id]))return false;
      const pos=state.placedBridges[id]||itemPosition(id);if(pos.room!==room)return false;
      let halfW=17,halfH=17;
      if(isBridge(id)){halfW=BRIDGE_WIDTH/2;halfH=BRIDGE_HEIGHT/2;}
      else if(isAxe(id)){halfW=24;halfH=27.2;}
      else if(id==='sword'){halfW=18;halfH=11;}
      else if(id.endsWith('Key'))halfH=7;
      else if(id==='flute'){halfW=20.4;halfH=5;}
      else if(id==='flower'){halfW=16;halfH=20.4;}
      return Math.abs(x-pos.x)<radius+halfW&&Math.abs(y-pos.y)<radius+halfH;
    });
  }
  const WAYFARER_DOOR_TOP=H*.1,WAYFARER_DOOR_BOTTOM=H*.9;
  function wideSideDoors(room,edge){return state.questMode==='easy'&&(room==='crossroads'||room==='west'&&edge==='right'||room==='blackApproach'&&edge==='left');}
  function sideDoorOpen(room,y,edge){return wideSideDoors(room,edge)?y>WAYFARER_DOOR_TOP+15&&y<WAYFARER_DOOR_BOTTOM-15:y>245&&y<395;}
  function roomLineWall(room){return room==='homeCrossing'?{x:76,y:0,w:9,h:H}:room==='blueVault'?{x:W-85,y:0,w:9,h:H}:null;}
  function blocked(room,x,y,ignoreElf=null,ignoreProtection=false){if(!ignoreProtection&&typeof ignoreElf!=='string'&&protectedJewelFields(room).some(pos=>jewelProtectionDistance(pos,x,y)<1))return true;const r=15,line=roomLineWall(room);if(line&&x+r>line.x&&x-r<line.x+line.w&&y+r>line.y&&y-r<line.y+line.h&&!bridgeCovers(room,x,y))return true;if(typeof ignoreElf==='string'&&elfObjectBlocked(room,x,y))return true;if(mazeTiles[room])return mazeBlocked(room,x,y)||elfBlocked(room,x,y,r,ignoreElf);if(room==='entry')return x<ENTRY_WALL+r||x>W-ENTRY_WALL-r||y<ENTRY_TOP+r||y>H-r||y>ENTRY_BOTTOM-r&&(x<ENTRY_OPEN_LEFT+r||x>ENTRY_OPEN_RIGHT-r);const exits=visibleExits(room),castle=rooms[room].type.endsWith('Castle'),topEdge=55;if(((x<55&&exits.left)||(x>W-55&&exits.right))&&wideSideDoors(room,x<55?'left':'right'))return !sideDoorOpen(room,y,x<55?'left':'right')||elfBlocked(room,x,y,r,ignoreElf);if(x<55&&!(exits.left&&y>245&&y<395))return true;if(x>W-55&&!(exits.right&&y>245&&y<395))return true;if(y<topEdge&&!(exits.up&&x>370&&x<590))return true;if(y>H-55&&!(exits.down&&x>370&&x<590))return true;if(roomTrees(room).some(tree=>TREE_PARTS.some(([tx,ty,w,h])=>x+r>tree.x+tx*TREE_SCALE&&x-r<tree.x+(tx+w)*TREE_SCALE&&y+r>tree.y+ty*TREE_SCALE&&y-r<tree.y+(ty+h)*TREE_SCALE)))return true;if(castle&&castleBlocked(x,y,r,room))return true;if(ELF_HOME_COLORS[room]&&elfHouseBlocked(room,x,y,r))return true;if(elfBlocked(room,x,y,r,ignoreElf))return true;return roomWalls(room).some(w=>x+r>w.x+1e-7&&x-r<w.x+w.w-1e-7&&y+r>w.y+1e-7&&y-r<w.y+w.h-1e-7)&&!bridgeCovers(room,x,y);}
  function clearDragonRoute(room,ax,ay,bx,by,ignoreElf=null){
    const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/3);
    for(let i=1;i<=steps;i++)if(blocked(room,ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps,ignoreElf))return false;
    return true;
  }
  function findDragonRoute(dragon,player){
    const ignoreElf=dragon.home??true;
    const columns=31,rows=20,spacing=30,total=columns*rows,walkable=new Uint8Array(total);
    const point=index=>({x:30+(index%columns)*spacing,y:30+Math.floor(index/columns)*spacing});
    const open=index=>{if(!walkable[index]){const pos=point(index);walkable[index]=blocked(dragon.room,pos.x,pos.y,ignoreElf)?2:1;}return walkable[index]===1;};
    // Only inspect nearby anchors, nearest first, instead of testing the whole room.
    function nearestAnchor(position,fromPosition){
      const candidates=[];
      const minX=Math.max(0,Math.floor((position.x-90-30)/spacing)),maxX=Math.min(columns-1,Math.ceil((position.x+90-30)/spacing));
      const minY=Math.max(0,Math.floor((position.y-90-30)/spacing)),maxY=Math.min(rows-1,Math.ceil((position.y+90-30)/spacing));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const index=y*columns+x,pos=point(index),distance=(pos.x-position.x)**2+(pos.y-position.y)**2;
        if(distance<90*90)candidates.push({index,pos,distance});
      }
      candidates.sort((a,b)=>a.distance-b.distance||a.index-b.index);
      for(const {index,pos} of candidates)if(open(index)&&(fromPosition
        ?clearDragonRoute(dragon.room,position.x,position.y,pos.x,pos.y,ignoreElf)
        :clearDragonRoute(dragon.room,pos.x,pos.y,position.x,position.y,ignoreElf)))return index;
      return -1;
    }
    const start=nearestAnchor(dragon,true),goal=nearestAnchor(player,false);
    if(start<0||goal<0)return [];
    const previous=new Int16Array(total),cost=new Float64Array(total),queue=[start];previous.fill(-1);cost.fill(Infinity);previous[start]=start;cost[start]=0;
    const heuristic=index=>Math.abs(index%columns-goal%columns)+Math.abs(Math.floor(index/columns)-Math.floor(goal/columns));
    while(queue.length){
      // Search toward the goal instead of flooding every reachable part of the room.
      let best=0;
      for(let i=1;i<queue.length;i++)if(cost[queue[i]]+heuristic(queue[i])<cost[queue[best]]+heuristic(queue[best]))best=i;
      const here=queue.splice(best,1)[0];if(here===goal)break;
      const x=here%columns,y=Math.floor(here/columns),origin=point(here);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||nx>=columns||ny<0||ny>=rows)continue;
        const next=ny*columns+nx;if(cost[next]<=cost[here]+1||!open(next))continue;
        const destination=point(next);if(!clearDragonRoute(dragon.room,origin.x,origin.y,destination.x,destination.y,ignoreElf))continue;
        previous[next]=here;cost[next]=cost[here]+1;if(!queue.includes(next))queue.push(next);
      }
    }
    if(previous[goal]<0)return [];
    const route=[];for(let at=goal;;at=previous[at]){route.unshift(point(at));if(at===start)break;}
    return route;
  }
  function bounceOnContact(p,hitX,hitY,dx,dy){
    const contact=hitX||hitY?`${hitX?Math.sign(dx):0},${hitY?Math.sign(dy):0}`:'';
    if(contact&&(contact!==p.contact||p.bounce.time>=BOUNCE_SECONDS))p.bounce={x:hitX?-Math.sign(dx):0,y:hitY?-Math.sign(dy):0,time:0};
    p.contact=contact;
  }
  const deadDragonPixels=new WeakMap();
  function touchesDeadDragon(d,x,y){
    const radius=21.06/2,left=Math.round(d.x-20),top=Math.round(d.y-50);
    if(x+radius<=left||x-radius>=left+40||y+radius<=top||y-radius>=top+100)return false;
    const sprite=sprites[d.name+'Dead'];if(!sprite)return true;
    if(!deadDragonPixels.has(sprite))deadDragonPixels.set(sprite,sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data);
    const pixels=deadDragonPixels.get(sprite);
    const x0=Math.max(0,Math.floor((x-radius-left)*sprite.width/40)),x1=Math.min(sprite.width,Math.ceil((x+radius-left)*sprite.width/40));
    const y0=Math.max(0,Math.floor((y-radius-top)*sprite.height/100)),y1=Math.min(sprite.height,Math.ceil((y+radius-top)*sprite.height/100));
    for(let row=y0;row<y1;row++)for(let col=x0;col<x1;col++)if(pixels[(row*sprite.width+col)*4+3])return true;
    return false;
  }
  function deadDragonBlocks(x,y,fromX,fromY){
    return state.dragons.some(d=>d.dead&&d.room===state.room&&d.name!==state.bat.carryingDragon&&touchesDeadDragon(d,x,y)&&
      !(touchesDeadDragon(d,fromX,fromY)&&Math.hypot(x-d.x,y-d.y)>Math.hypot(fromX-d.x,fromY-d.y)));
  }
  function movePlayer(dt){if(state.mode!=='playing'&&state.mode!=='title')return;let dx=window.joystickInput?.x||0,dy=window.joystickInput?.y||0;for(const key of keys){const d=dir[key];if(d){dx+=d.x;dy+=d.y;}}if(!dx&&!dy){state.player.contact='';return;}state.player.face=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}dx*=SPEED*dt;dy*=SPEED*dt;const p=state.player;
    const hitX=dx!==0&&(playerBlocked(p.x+dx,p.y,p.x,p.y)||deadDragonBlocks(p.x+dx,p.y,p.x,p.y));if(!hitX)p.x+=dx;
    const hitY=dy!==0&&(playerBlocked(p.x,p.y+dy,p.x,p.y)||deadDragonBlocks(p.x,p.y+dy,p.x,p.y));if(!hitY)p.y+=dy;
    bounceOnContact(p,hitX,hitY,dx,dy);
    if(state.mode==='title'||moveDelay>0)return;
    const houseY=houseWorldY(state.room,p.y);
    if(ELF_HOME_COLORS[state.room]&&(houseUpsideDown(state.room)?dy>0:dy<0)&&p.x>=ELF_HOUSE.doorX+15&&p.x<=ELF_HOUSE.doorX+ELF_HOUSE.doorW-15&&houseY>=ELF_HOUSE.doorY+ELF_HOUSE.gateH+15&&houseY<=ELF_HOUSE.doorY+46){
      if(state.gates[state.room]&&state.gateLift[state.room]>=1)enter(state.room+'Inside',480,525);
      else if(noticeTimer<=0)say('The cottage gate needs its matching key.');
      return;
    }
    if(p.x<-14||p.x>W+14||p.y<-14||p.y>H+14){
      if(mazeTiles[state.room]){const edge=p.x<0?'left':p.x>W?'right':p.y<0?'up':'down',portal=mazePortal(state.room,edge,edge==='left'||edge==='right'?p.y:p.x);if(portal){const door=mazeDoor(portal);enter(door.to,door.entry.x,door.entry.y,door);return;}}
      {const edge=p.x<0?'left':p.x>W?'right':p.y<0?'up':'down',portal=mazePortal(state.room,edge,edge==='left'||edge==='right'?p.y:p.x);if(portal){const door=mazeDoor(portal);enter(door.to,door.entry.x,door.entry.y,door);return;}}
      if(state.room==='goldInside'&&p.y>H){enter('gold',480,510+CASTLE_SHIFT);return;}
      if(state.room==='whiteInside'&&p.y>H){enter('white',480,510+CASTLE_SHIFT);return;}
      if(state.room==='blackInside'&&p.y>H){enter('black',480,510+CASTLE_SHIFT);return;}
      if((state.room==='blackDungeon'||state.room==='nightfallInside')&&p.y>H){enter('blackInside',480,110);return;}
      if(state.room==='blackInside'&&p.y<0){enter(state.questMode==='easy'?'nightfallInside':'blackDungeon',480,555);return;}
      if(ELF_INTERIORS[state.room]&&p.y>H){const home=ELF_INTERIORS[state.room];enter(home,488.5,houseWorldY(home,515));return;}
      const g=currentGrid();if(g||state.questMode!=='easy'&&hardConnections[state.room]){let d=null;if(p.x<0&&sideDoorOpen(state.room,p.y,'left'))d=dir.left;else if(p.x>W&&sideDoorOpen(state.room,p.y,'right'))d=dir.right;else if(p.y<0&&p.x>370&&p.x<590)d=dir.up;else if(p.y>H&&p.x>370&&p.x<590)d=dir.down;if(d){const next=neighbor(state.room,d);if(next!==state.room){const wide=d.x!==0&&wideSideDoors(state.room,d.x<0?'left':'right');enter(next,d.x<0?(wide?890:925):d.x>0?(wide?70:35):p.x,d.y<0?605:d.y>0?35:wide?Math.max(55,Math.min(H-55,p.y)):p.y);return;}}}
      p.x=Math.max(18,Math.min(W-18,p.x));p.y=Math.max(18,Math.min(H-18,p.y));
    }
    pickupPlacedBridgeOnTouch();
  }
  function moveSwallowed(dt){
    const dragon=state.dragons.find(d=>d.name===state.swallowedBy),p=state.player;if(!dragon)return;
    let dx=window.joystickInput?.x||0,dy=window.joystickInput?.y||0;for(const key of keys){const direction=dir[key];if(direction){dx+=direction.x;dy+=direction.y;}}
    if(!dx&&!dy){p.contact='';return;}
    p.face=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
    const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length;}dx*=SWALLOWED_SPEED*dt;dy*=SWALLOWED_SPEED*dt;
    const hitX=p.x+dx<dragon.x-4||p.x+dx>dragon.x+4;
    const hitY=p.y+dy<dragon.y+11||p.y+dy>dragon.y+19;
    p.x=Math.max(dragon.x-4,Math.min(dragon.x+4,p.x+dx));
    p.y=Math.max(dragon.y+11,Math.min(dragon.y+19,p.y+dy));
    bounceOnContact(p,hitX,hitY,dx,dy);
    if(state.held==='bat'){syncHeldBat();syncCarriedDragon();}
  }
  function keyTouchesGate(castle){
    const pos=itemPosition(castle+'Key');
    const door=castleDoorway(castle);
    return pos.room===castle&&pos.x+17>=door.x&&pos.x-17<=door.x+door.w&&pos.y+7>=door.y&&pos.y-7<=door.y+door.h;
  }
  function keyKeepsGateOpen(castle){
    if(state.gateLatched[castle])return true;
    const pos=itemPosition(castle+'Key');
    if(pos.room===castle+'Inside')return true;
    if(pos.room!==castle)return false;
    const door=castleDoorway(castle),p=state.player;
    // Recognize a carried key on any side while its carrier approaches the doorway.
    if(state.room===castle&&hasCarriedItem(castle+'Key'))return p.x+PLAYER_HALF_SIZE>=door.x&&p.x-PLAYER_HALF_SIZE<=door.x+door.w&&p.y+PLAYER_HALF_SIZE>=door.y&&p.y-PLAYER_HALF_SIZE<=door.y+door.h+35;
    return pos.x+17>=door.x&&pos.x-17<=door.x+door.w&&pos.y+7>=door.y-35&&pos.y-7<=door.y+door.h;
  }
  function gateCheck(){
    for(const castle of Object.keys(state.gates)){
      const open=keyKeepsGateOpen(castle);
      if(open!==state.gates[castle]){state.gates[castle]=open;if(state.room===castle)say(castle.toUpperCase()+(open?' GATE OPENED':' GATE CLOSED'));}
    }
    if(moveDelay>0)return;
    const castle={gold:'gold',black:'black',white:'white'}[state.room];if(!castle)return;
    const p=state.player,movingUp=keys.has('up')||(window.joystickInput?.y??0)<0,door=castleDoorway(castle);
    if(!movingUp||p.x<door.x+PLAYER_HALF_SIZE||p.x>door.x+door.w-PLAYER_HALF_SIZE||p.y<door.y||p.y>door.y+door.h+PLAYER_HALF_SIZE)return;
    if(!state.gates[castle]){if(noticeTimer<=0)say('The '+castle+' gate needs its matching key.');return;}
    if(state.gateLift[castle]<1)return;
    enter(castle+'Inside',480,525);
  }
  function exposedBridgeLeg(id){
    const bridge=state.placedBridges[id],p=state.player;
    if(!bridge||bridge.room!==state.room)return false;
    return touchesBridgeShape(bridge,p);
  }
  function pickupPlacedBridgeOnTouch(){
    const touching=BRIDGE_IDS.find(exposedBridgeLeg)||null;
    if(touching&&touching!==state.touchingBridgeLeg&&state.pickupDelay<=0)pickup(true);
    state.touchingBridgeLeg=touching;
  }
  function takeElfTreasure(item){
    const home=ELF_INTERIORS[item.room],zone=ELF_ROOM_ZONES.possessions;
    const owner=item.treasureOwner||(home&&item.x>=zone.x&&item.x<=zone.x+zone.w&&item.y>=zone.y&&item.y<=zone.y+zone.h?home:null);
    const elf=state.elves.find(elf=>elf.home===owner);if(!elf)return '';
    elf.emotionalState.sentiment=Math.max(1,elf.emotionalState.sentiment-1);
    delete item.treasureOwner;
    return ' '+ELF_NAMES[elf.home]+' lost 1 Sentiment.';
  }
  function treasureAreaOwner(pos){
    const home=ELF_INTERIORS[pos.room],zone=ELF_ROOM_ZONES.possessions;
    return home&&pos.x>=zone.x&&pos.x<=zone.x+zone.w&&pos.y>=zone.y&&pos.y<=zone.y+zone.h?home:null;
  }
  function updateTreasureRemoval(){
    state.treasureWatch??={};
    for(const [id,item] of Object.entries(state.items)){
      const pos=state.placedBridges[id]||itemPosition(id),home=treasureAreaOwner(pos),owner=state.treasureWatch[id]||item.treasureOwner;
      if(owner)state.treasureWatch[id]=owner;
      const carrier=state.elves.find(elf=>elf.carrying===id);
      if(carrier&&carrier.home===owner)continue;
      if(owner&&home!==owner){
        const reaction=takeElfTreasure({treasureOwner:owner});
        delete state.treasureWatch[id];delete item.treasureOwner;
        if(reaction)say(reaction.trim());
      }else if(!owner&&home&&!carrier)state.treasureWatch[id]=home;
    }
  }
  function pickup(placedOnly=false){
    for(const id of AXE_IDS)axePickupLocked(id);
    if(state.pickupDelay>0)return;
    const p=state.player;
    for(const [id,item] of Object.entries(state.items)){
      if(isAxe(id)&&(state.usedAxes.has(id)||state.axeFlights[id]||axePickupLocked(id)||axeRecoveryLocked(id)))continue;
      const placedBridge=!!state.placedBridges[id];
      const carrier=state.elves.find(elf=>elf.carrying===id);
      if(carrier&&(!(carrier.stunTimer>0)||carrier.surpriseTimer>0))continue;
      const pickupPosition=carrier?itemPosition(id):item;
      const unlockedJewel=JEWEL_VARIANTS.some(([jewelId])=>jewelId===id)&&elfJewelCornerOwner(pickupPosition)&&!elfJewelProtected(pickupPosition);
      if(JEWEL_VARIANTS.some(([jewelId])=>jewelId===id)&&elfJewelProtected(pickupPosition))continue;
      if(placedBridge){if(!placedOnly||!exposedBridgeLeg(id))continue;}
      else if(placedOnly||pickupPosition.room!==state.room||!(unlockedJewel?Math.hypot(pickupPosition.x-p.x,pickupPosition.y-p.y)<=80:touchesLooseItem(id,pickupPosition,p)))continue;
      const previous=state.held,nextSide=sideTouched(p,pickupPosition);
      const bridgePosition=placedBridge?state.placedBridges[id]:pickupPosition;
      const nextBridgeOffset=isBridge(id)?{x:bridgePosition.x-p.x,y:bridgePosition.y-p.y}:null;
      state.treasureWatch??={};
      const treasureOwner=treasureAreaOwner(bridgePosition);
      if(treasureOwner)state.treasureWatch[id]=treasureOwner;
      if(carrier){carrier.carrying=null;carrier.giftTask=null;carrier.goal=null;carrier.path=[];delete item.treasureOwner;}
      if(previous==='bat'){
        syncHeldBat();state.bat.pickupCooldown=.5;batTimer=1;
      }else if(previous){
        const pos=isBridge(previous)?itemPosition(previous):placedBridge?{x:p.x,y:p.y}:heldPosition();
        state.items[previous]={room:state.room,x:Math.max(35,Math.min(925,pos.x)),y:Math.max(35,Math.min(605,pos.y))};
      }
      if(placedBridge)delete state.placedBridges[id];
      state.heldSide=nextSide;state.held=id;state.heldBridgeOffset=nextBridgeOffset;item.room='held';
      if(isAxe(id))state.axeRecoveries[id]=null;
      if(previous==='bat')syncCarriedDragon();
      if(previous)state.pickupDelay=.45;
      if(id==='flute')playFluteSound();else playPickup();say(previous?'Swapped '+itemInfo[previous][0]+' for '+itemInfo[id][0]+'.':'Picked up '+itemInfo[id][0]+'.');
      updateTreasureRemoval();
      break;
    }
  }
  function elfGiftReaction(home,id){
    const feeling=elfGiftPreference(home,id);
    if(!feeling)return '';
    const elf=ELF_NAMES[home];
    return ' '+elf+' '+feeling+' the '+itemInfo[id][0].toLowerCase()+'.';
  }
  function drop(){if(state.mode!=='playing'||!state.held)return;const id=state.held,pos=isBridge(id)?heldBridgePosition():heldPosition(),x=Math.max(35,Math.min(925,pos.x)),y=Math.max(35,Math.min(605,pos.y));if(id==='bat'){state.bat.room=state.room;state.bat.x=x;state.bat.y=y;batTimer=1;state.bat.pickupCooldown=.5;}else state.items[id]={room:state.room,x,y};state.held=null;state.heldBridgeOffset=null;state.pickupDelay=.55;playDrop();const zone=(ELF_INTERIORS[state.room]||state.room==='goldInside')&&id!=='bat'?Object.entries(state.room==='goldInside'?{possessions:ELF_ROOM_ZONES.possessions}:ELF_ROOM_ZONES).find(([,area])=>x>=area.x&&x<=area.x+area.w&&y>=area.y&&y<=area.y+area.h)?.[0]:null;const reaction=zone==='gifts'?elfGiftReaction(ELF_INTERIORS[state.room],id):'';say((zone==='gifts'?'Left '+itemInfo[id][0]+' in the gift area.':zone==='possessions'?'Stored '+itemInfo[id][0]+' in the possessions area.':'Dropped '+itemInfo[id][0]+'.')+reaction);refresh();}
  function placeBridge(){
    const id=carriedBridgeId();if(state.mode!=='playing'||!id)return;
    const {x,y}=itemPosition(id);
    state.placedBridges[id]={room:state.room,x,y,vertical:true};
    if(state.held==='bat')state.bat.carrying=null;else state.held=null;
    state.heldBridgeOffset=null;
    state.items[id]={room:'placed',x,y};state.pickupDelay=.55;
    state.touchingBridgeLeg=exposedBridgeLeg(id)?id:null;
    playDrop();say('Bridge placed. Touch its purple shape to pick it up.');refresh();
  }
  function throwAxe(){
    const id=state.held;
    let dx=window.joystickInput?.x||0,dy=window.joystickInput?.y||0;
    for(const key of keys){const direction=dir[key];if(direction){dx+=direction.x;dy+=direction.y;}}
    const p=state.player;
    if(dx&&(blocked(state.room,p.x+Math.sign(dx)*3,p.y)||deadDragonBlocks(p.x+Math.sign(dx)*3,p.y,p.x,p.y)))dx=0;
    if(dy&&(blocked(state.room,p.x,p.y+Math.sign(dy)*3)||deadDragonBlocks(p.x,p.y+Math.sign(dy)*3,p.x,p.y)))dy=0;
    const length=Math.hypot(dx,dy);if(!length){drop();return;}
    dx/=length;dy/=length;
    state.axePickupDirections[id]={x:dx,y:dy};
    state.axeRecoveries[id]=null;
    const launch=itemPosition(id);
    state.items[id]={room:state.room,x:launch.x,y:launch.y};
    state.axeFlights[id]={room:state.room,vx:dx*650,vy:dy*650,travelled:0,age:0};
    state.held=null;state.heldBridgeOffset=null;state.pickupDelay=0;playDrop();say('Axe thrown!');
  }
  function axePickupLocked(id){
    const direction=state.axePickupDirections[id];if(!direction)return false;
    let dx=window.joystickInput?.x||0,dy=window.joystickInput?.y||0;
    for(const key of keys){const d=dir[key];if(d){dx+=d.x;dy+=d.y;}}
    const length=Math.hypot(dx,dy);
    if(!length||(dx*direction.x+dy*direction.y)/length<.95){state.axePickupDirections[id]=null;return false;}
    return true;
  }
  function axeHits(room,x,y,flightAge,axeId){
    const thrower=state.axeFlights[axeId]?.thrower;
    const offsets=[[0,0],[-10,0],[10,0],[0,-13],[0,13]];
    if(offsets.some(([dx,dy])=>blocked(room,x+dx,y+dy,true)))return true;
    const elf=state.elves.find(elf=>elf.room===room&&!(thrower===elf.home&&flightAge<.5)&&offsets.some(([dx,dy])=>elfDistanceSquared(elf,x+dx,y+dy,15)<1));
    if(elf){
      elfOuchSound.currentTime=0;elfOuchSound.play().catch(()=>{});
      elf.emotionalState.sentiment=1;elf.emotionalState.passion=3;
      elf.surpriseTimer=.5;elf.stunTimer=20;elf.goal=null;elf.path=[];elf.wait=0;
      return true;
    }
    for(const [id,item] of Object.entries(state.items)){
      if(id===axeId||state.usedAxes.has(id))continue;
      const pos=state.placedBridges[id]||itemPosition(id);if(pos.room!==room)continue;
      if(isBridge(id)?Math.abs(x-pos.x)<BRIDGE_WIDTH/2+22&&Math.abs(y-pos.y)<BRIDGE_HEIGHT/2+25:Math.hypot(x-pos.x,y-pos.y)<38)return true;
    }
    const dragon=state.dragons.find(d=>d.room===room&&Math.abs(x-d.x)<42&&Math.abs(y-d.y+15)<70);
    if(dragon){if(!dragon.dead)dragon.axePauseTimer=.4;return true;}
    if(state.bat.room===room&&Math.abs(x-state.bat.x)<42&&Math.abs(y-state.bat.y)<50)return true;
    if((thrower||flightAge>=.5)&&state.room===room&&Math.hypot(x-state.player.x,y-state.player.y)<36){
      if(thrower){
        state.mode='lost';state.swallowedBy=null;playPlayerDeath();
        state.message=ELF_NAMES[thrower]+"'s axe hit you. Game over.";
        showOverlay('GAME OVER',state.message,'NEW QUEST');refresh();
      }
      return true;
    }
    return false;
  }
  function landAxe(id){
    state.axeFlights[id]=null;state.axeRecoveries[id]=null;state.axePickupDirections[id]=null;
    state.usedAxes.add(id);state.axeFades[id]=0;
  }
  function axeRecoveryLocked(id){
    const recovery=state.axeRecoveries[id];if(!recovery)return false;
    const axe=state.items[id],distance=state.room===axe.room?Math.hypot(state.player.x-axe.x,state.player.y-axe.y):Infinity;
    if(distance>64)recovery.mustLeave=false;
    return recovery.mustLeave||distance>18;
  }
  function updateAxe(dt){
    updateAxeFades(dt);
    for(const id of AXE_IDS){updateAxeFlight(id,dt);if(state.mode==='lost')break;}
  }
  function updateAxeFades(dt){
    for(const id of Object.keys(state.axeFades)){
      const previous=state.axeFades[id];
      state.axeFades[id]+=dt;
      if(previous<.4&&state.axeFades[id]>=.4)playAxePoof();
      if(state.axeFades[id]>=1){state.items[id].room='absent';delete state.axeFades[id];}
    }
  }
  function updateAxeFlight(id,dt){
    axePickupLocked(id);
    const flight=state.axeFlights[id];if(!flight){axeRecoveryLocked(id);return;}
    const axe=state.items[id],distance=Math.hypot(flight.vx,flight.vy)*dt,steps=Math.max(1,Math.ceil(distance/4));
    for(let step=0;step<steps;step++){
      const x=axe.x+flight.vx*dt/steps,y=axe.y+flight.vy*dt/steps;
      if(axeHits(flight.room,x,y,flight.age+dt/steps,id)){
        landAxe(id);return;
      }
      const edge=x<0?'left':x>W?'right':y<0?'up':y>H?'down':null;
      if(edge){
        const portal=mazePortal(flight.room,edge,edge==='left'||edge==='right'?y:x);
        const interiorExit=edge==='down'&&(ELF_INTERIORS[flight.room]||['goldInside','blackInside','whiteInside'].includes(flight.room)&&flight.room.slice(0,-6));
        const next=portal?.to||interiorExit||neighbor(flight.room,dir[edge]);
        if(next===flight.room){landAxe(id);return;}
        const entry=portal?mazeEntry(portal):interiorExit?dragonDoor(flight.room,next).entry:{x:edge==='left'?W-35:edge==='right'?35:x,y:edge==='up'?H-35:edge==='down'?35:y};
        if(axeHits(next,entry.x,entry.y,flight.age+dt/steps,id)){landAxe(id);return;}
        flight.room=next;axe.room=next;axe.x=entry.x;axe.y=entry.y;
      }else{axe.x=x;axe.y=y;}
      flight.travelled+=distance/steps;
      flight.age+=dt/steps;
    }
  }
  function useAction(){if(state.mode==='lost'){if(state.held==='bat'){syncHeldBat();state.held=null;syncCarriedDragon();playDrop();refresh();}return;}if(state.mode!=='playing')return;if(isAxe(state.held)){throwAxe();return;}if(BRIDGE_IDS.some(exposedBridgeLeg)){pickup(true);return;}if(carriedBridgeId())placeBridge();else drop();}
  function magnet(){if(state.mode!=='playing')return;if(!hasCarriedItem('magnet')){say('You need to carry the magnet.');return;}if(!Object.entries(state.items).some(([id,item])=>id!=='magnet'&&item.room===state.room)){say('No loose object is nearby.');return;}magnetPulse=2;say('The magnet pulls loose objects faster.');}
  function magnetPosition(){
    const pos=itemPosition('magnet');return rooms[pos.room]?pos:null;
  }
  function updateMagnet(dt){
    const target=magnetPosition();
    const speed=magnetPulse>0?160:80;magnetPulse=Math.max(0,magnetPulse-dt);
    for(const [id,item] of Object.entries(state.items)){
      if(id==='magnet')continue;
      if(isAxe(id)&&(state.usedAxes.has(id)||state.axeFlights[id]))continue;
      item.floating=false;
      if(!target||item.room!==target.room)continue;
      const dx=target.x-item.x,dy=target.y-item.y,distance=Math.hypot(dx,dy);
      if(distance<=30)continue;
      const step=Math.min(distance-30,speed*dt);
      item.x+=dx/distance*step;item.y+=dy/distance*step;item.floating=true;
    }
  }
  function die(dragon){const p=state.player;p.x=dragon.x;p.y=dragon.y+15;p.contact='';p.bounce.time=BOUNCE_SECONDS;state.swallowedBy=dragon.name;if(state.held==='bat'){syncHeldBat();syncCarriedDragon();}state.mode='lost';playPlayerDeath();state.message=dragon.name+' swallowed you. Game over.';showOverlay('GAME OVER',dragon.name+' swallowed you.','NEW QUEST');refresh();}
  function playChomp(){chompSound.currentTime=0;chompSound.play().catch(()=>{});}
  function playAxePoof(){
    // Local media routed through Web Audio can be silenced by browser origin rules.
    const AudioContext=window.location?.protocol==='file:'?null:window.AudioContext||window.webkitAudioContext;
    if(AudioContext&&!axePoofAudioContext){
      axePoofAudioContext=new AudioContext();
      const source=axePoofAudioContext.createMediaElementSource(axePoofSound),gain=axePoofAudioContext.createGain();
      gain.gain.value=4;
      source.connect(gain);gain.connect(axePoofAudioContext.destination);
    }
    if(axePoofAudioContext?.state==='suspended')axePoofAudioContext.resume().catch(()=>{});
    axePoofSound.volume=1;axePoofSound.currentTime=0;axePoofSound.play().catch(()=>{});
  }
  function playDragonDeath(){dragonDeathSound.currentTime=0;dragonDeathSound.play().catch(()=>{});}
  function playPlayerDeath(){playerDeathSound.currentTime=0;playerDeathSound.play().catch(()=>{});}
  function playPickup(volume=1){pickupSound.volume=volume;pickupSound.currentTime=0;pickupSound.play().catch(()=>{});}
  function stopFluteSound(){
    if(flutePlayback!=='idle'){fluteSound.pause();fluteSound.currentTime=0;}
    fluteSound.loop=false;flutePlayback='idle';
  }
  function playFluteSound(){
    fluteSound.currentTime=0;flutePlayback='playing';
    fluteSound.loop=state.elves.some(elf=>elf.home==='blackApproach'&&elf.room===state.room);
    fluteSound.play().catch(()=>{});
  }
  function syncFluteSound(){
    const pelendilHere=state?.elves.find(elf=>elf.home==='blackApproach'&&elf.room===state.room);
    const pelendilCarrying=pelendilHere?.carrying==='flute';
    if(!state||state.held!=='flute'&&!pelendilCarrying){stopFluteSound();return;}
    if(state.mode!=='playing'||behaviorDialog.open){
      if(flutePlayback==='playing'){fluteSound.pause();flutePlayback='paused';}
      return;
    }
    fluteSound.loop=!!pelendilHere;
    if(flutePlayback==='paused'||(flutePlayback==='idle'||flutePlayback==='finished')&&fluteSound.loop){
      if(flutePlayback==='idle'||flutePlayback==='finished')fluteSound.currentTime=0;
      flutePlayback='playing';fluteSound.play().catch(()=>{});
    }
  }
  function playDrop(volume=1){dropSound.volume=volume;dropSound.currentTime=0;dropSound.play().catch(()=>{});}
  function moveDragonToward(d,target,dt,fear=false,ignoreElf=true){
    if(fear){d.path=[];d.pathTimer=0;}
    else if(clearDragonRoute(d.room,d.x,d.y,target.x,target.y,ignoreElf)){d.path=[];d.pathTimer=0;}
    else{
      d.pathTimer=Math.max(0,d.pathTimer-dt);
      while(d.path.length&&Math.hypot(d.x-d.path[0].x,d.y-d.path[0].y)<8)d.path.shift();
      const previous=d.pathTarget;
      const changed=!previous||previous.room!==d.room||previous.ignoreElf!==ignoreElf||Math.hypot(previous.x-target.x,previous.y-target.y)>30;
      const routeBlocked=d.path.length&&!clearDragonRoute(d.room,d.x,d.y,d.path[0].x,d.path[0].y,ignoreElf);
      if(d.pathTimer<=0&&(changed||!d.path.length||routeBlocked)){
        d.path=findDragonRoute({...d,home:ignoreElf},target);
        d.pathTarget={room:d.room,x:target.x,y:target.y,ignoreElf};d.pathTimer=d.path.length?.35:.75;
      }
      let waypoint=null;
      // Limit visibility checks to a few upcoming points rather than the entire route.
      for(let i=Math.min(3,d.path.length-1);i>=0;i--)if(clearDragonRoute(d.room,d.x,d.y,d.path[i].x,d.path[i].y,ignoreElf)){waypoint=d.path[i];d.path=d.path.slice(i);break;}
      if(!waypoint)return;
      target=waypoint;
    }
    const distance=Math.hypot(target.x-d.x,target.y-d.y)||1;let vx=(target.x-d.x)/distance,vy=(target.y-d.y)/distance;if(fear){vx=-vx;vy=-vy;}
    const nx=Math.max(26,Math.min(934,d.x+vx*d.speed*dt)),ny=Math.max(26,Math.min(614,d.y+vy*d.speed*dt));if(!blocked(d.room,nx,d.y,ignoreElf))d.x=nx;if(!blocked(d.room,d.x,ny,ignoreElf))d.y=ny;
    slayDragonIfSword(d);
  }
  function slayDragonIfSword(d){
    const sword=itemPosition('sword');
    if(d.dead||sword.room!==d.room||Math.hypot(sword.x-d.x,sword.y-d.y)>=38)return false;
    d.dead=true;d.biting=false;d.escape=null;d.follow=[];playDragonDeath();say(d.name+' was slain by the sword.');return true;
  }
  function connectedRooms(room){return [...new Set([...Object.values(dir).map(direction=>neighbor(room,direction)).filter(other=>other!==room),...mazePortals.filter(p=>p.from===room).map(p=>p.to),...(ELF_HOME_COLORS[room]&&state.gates[room]&&state.gateLift[room]>=1?[room+'Inside']:[])])];}
  function elfGiftPreference(home,id){
    id=EXTRA_GIFTS[id]||id;
    const preferences=ELF_GIFT_PREFERENCES[home];
    return preferences.likes.includes(id)?'likes':preferences.hates.includes(id)?'hates':null;
  }
  function elfJewelCornerOwner(pos){
    const area=ELF_JEWEL_CORNER;
    return pos.x>=area.x&&pos.x<=area.x+area.w&&pos.y>=area.y&&pos.y<=area.y+area.h?ELF_INTERIORS[pos.room]:null;
  }
  function elfJewelProtected(pos){
    const home=elfJewelCornerOwner(pos);if(!home)return false;
    const elf=state.elves.find(elf=>elf.home===home);
    return !(elf?.stunTimer>0&&!(elf.surpriseTimer>0));
  }
  function protectedJewelFields(room){
    return Object.entries(state.items).filter(([id,item])=>item.room===room&&JEWEL_VARIANTS.some(([jewelId])=>jewelId===id)&&elfJewelProtected(item)).map(([,item])=>item);
  }
  function jewelProtectionDistance(pos,x,y){return ((x-pos.x)/45)**2+((y-pos.y)/55)**2;}
  function updateElfJewelTrust(elf){
    const trusting=elf.emotionalState.passion===1;
    if(elf.wasTrusting&&!trusting)elf.reclaimJewel=true;
    elf.wasTrusting=trusting;
    if(trusting){
      elf.reclaimJewel=false;
      if(elf.giftTask?.reclaim){elf.giftTask={id:elf.giftTask.id,feeling:'likes',offering:true,sharePause:1};elf.goal=null;elf.path=[];elf.wait=0;}
    }else if(elf.giftTask?.offering){
      elf.reclaimJewel=true;
      const id=elf.giftTask.id;
      elf.giftTask=elf.carrying===id?{id,feeling:'likes',reclaim:true}:null;
      elf.goal=null;elf.path=[];elf.wait=0;
    }
  }
  function startElfJewelReclaim(elf){
    if(!elf.reclaimJewel||elf.giftTask||elf.carrying)return;
    const id=Object.keys(ELF_TREASURES).find(id=>ELF_TREASURES[id]===elf.home),item=state.items[id];
    if(item.room!==elf.home+'Inside')return;
    if(elfJewelCornerOwner(item)===elf.home){elf.reclaimJewel=false;return;}
    elf.giftTask={id,feeling:'likes',reclaim:true};elf.hunting=false;elf.goal=null;elf.path=[];elf.wait=0;
  }
  function updateElfOffering(elf){
    if(elf.giftTask||elf.emotionalState.passion!==1||!elf.trusted&&elf.emotionalState.sentiment!==3)return;
    const id=Object.keys(ELF_TREASURES).find(id=>ELF_TREASURES[id]===elf.home),item=state.items[id];
    if(item.room!==elf.home+'Inside'||treasureAreaOwner(item)!==elf.home)return;
    if(elf.trusted&&isAxe(elf.carrying)){
      state.items[elf.carrying]={room:elf.room,x:elf.x,y:elf.y+60};elf.carrying=null;playDrop(.3);
    }
    if(elf.carrying)return;
    if(item.room===elf.home+'Inside'&&treasureAreaOwner(item)===elf.home){
      elf.giftTask={id,feeling:'likes',offering:true,sharePause:1};elf.goal=null;elf.path=[];elf.wait=0;
    }
  }
  function elfGiftDelivery(elf,room,offering=false,reclaim=false){
    if(reclaim){
      const area=ELF_JEWEL_CORNER;
      for(const [x,y] of [[area.x+area.w/2,area.y+area.h/2],[area.x+25,area.y+25],[area.x+75,area.y+75]]){
        const approach={x:x-70,y};
        if(!blocked(room,x,y,elf.home)&&!blocked(room,approach.x,approach.y,elf.home))return {room,x,y,approach};
      }
      return null;
    }
    if(!offering&&room===elf.home+'Inside'){
      const id=elf.giftTask?.id;
      const slots=ELF_TREASURE_SLOTS.filter(slot=>ELF_TREASURES[id]===elf.home
        ?slot.x===800&&slot.y===415
        :slot.x!==800||slot.y!==415);
      for(const {x,y} of slots){
        if(Object.keys(state.items).some(other=>{
          if(other===id)return false;
          const pos=itemPosition(other);return pos.room===room&&Math.abs(pos.x-x)<45&&Math.abs(pos.y-y)<35;
        }))continue;
        for(const [dx,dy] of [[-65,0],[65,0],[0,-65],[0,65]]){
          const approach={x:x+dx,y:y+dy},area=ELF_ROOM_ZONES.possessions;
          if(approach.x<area.x+20||approach.x>area.x+area.w-20||approach.y<area.y+20||approach.y>area.y+area.h-20)continue;
          if(!blocked(room,x,y,elf.home)&&!blocked(room,approach.x,approach.y,elf.home))return {room,x,y,approach};
        }
      }
      return null;
    }
    const area=offering?ELF_ROOM_ZONES.gifts:room===elf.home+'Inside'?ELF_ROOM_ZONES.possessions:{x:130,y:100,w:700,h:440};
    for(let y=area.y+110;y<area.y+area.h-25;y+=60)for(let x=area.x+85;x<area.x+area.w-25;x+=65){
      for(const offset of [-60,60]){
        const approach={x:x+offset,y};
        if(approach.x<area.x+20||approach.x>area.x+area.w-20)continue;
        if(!blocked(room,x,y,elf.home)&&!blocked(room,approach.x,y,elf.home))return {room,x,y,approach};
      }
    }
    return null;
  }
  function elfHasLikedObject(elf,id){
    const kind=EXTRA_GIFTS[id]||id;
    return Object.entries(state.items).some(([other,item])=>other!==id&&(EXTRA_GIFTS[other]||other)===kind&&item.room===elf.home+'Inside'&&treasureAreaOwner(item)===elf.home);
  }
  function elfPendingGift(elf){
    return Object.entries(state.items).find(([id,item])=>item.room===elf.home+'Inside'&&!(item.elfAssessment?.home===elf.home&&item.elfAssessment.x===item.x&&item.elfAssessment.y===item.y));
  }
  function elfDiscardRoom(elf){
    const origin=dragonDoor(elf.home+'Inside',elf.home).entry;
    const exits=connectedRooms(elf.home).filter(room=>room!==elf.home&&!ELF_INTERIORS[room]).flatMap(room=>dragonDoors(elf.home,room));
    exits.sort((a,b)=>Math.hypot(a.exit.x-origin.x,a.exit.y-origin.y)-Math.hypot(b.exit.x-origin.x,b.exit.y-origin.y));
    return exits.find(door=>elfGiftDelivery(elf,door.to))?.to||'crossroads';
  }
  function elfGiftTargetRoom(elf,task){
    if(task.feeling==='likes'&&!task.excess)return elf.home+'Inside';
    if(task.feeling==='hates')return task.discardRoom??=elfDiscardRoom(elf);
    return 'crossroads';
  }
  function finishElfGiftReaction(elf,task,placed=true){
    if(task.offering||task.reclaim||task.foraging||task.tidy||task.reactionApplied)return;
    task.reactionApplied=true;
    elf.giftsReceived++;elf.trusted=elf.giftsReceived>=2;
    if(elf.trusted)elf.emotionalState.passion=1;
    if(task.feeling)elf.emotionalState.sentiment=Math.max(1,Math.min(3,elf.emotionalState.sentiment+(task.feeling==='likes'?1:-1)));
    if(state.room===elf.room)say(ELF_NAMES[elf.home]+(placed?' placed the ':' picked up the ')+itemInfo[task.id][0].toLowerCase()+'.'+elfGiftReaction(elf.home,task.id));
  }
  function updateElfGift(elf,dt=0){
    if(!elf.giftTask){
      const gift=elfPendingGift(elf);
      if(!gift)return;
      const [id,item]=gift;
      const tidy=item.treasureOwner===elf.home&&treasureAreaOwner(item)===elf.home&&!ELF_TREASURE_SLOTS.some(slot=>Math.hypot(item.x-slot.x,item.y-slot.y)<2);
      elf.giftTask={id,feeling:tidy?'likes':elfGiftPreference(elf.home,id),tidy};elf.goal=null;elf.path=[];elf.wait=0;
    }
    const task=elf.giftTask,item=state.items[task.id];
    if(task.offering&&task.sharePause>0){
      task.sharePause=Math.max(0,task.sharePause-dt);
      if(task.sharePause<1e-8)task.sharePause=0;
      if(task.sharePause>0)return;
    }
    if(!elf.carrying&&(task.foraging?!rooms[item.room]||!!item.treasureOwner||elfHasLikedObject(elf,task.id):item.room!==elf.home+'Inside')){
      elf.giftTask=null;elf.goal=null;elf.path=[];return;
    }
    if(task.retryTimer>0){
      const previous=task.retryScene;
      const changed=previous.room!==state.room||Math.hypot(previous.playerX-state.player.x,previous.playerY-state.player.y)>=16||
        previous.itemRoom!==item.room||Math.hypot(previous.itemX-item.x,previous.itemY-item.y)>=12;
      task.retryTimer=changed?0:Math.max(0,task.retryTimer-dt);
      if(task.retryTimer>0)return;
    }
    if(task.foraging&&!elf.carrying){
      task.repathTimer=Math.max(0,(task.repathTimer||0)-dt);
      const previous=task.target;
      if(!previous||previous.room!==item.room||task.repathTimer<=0&&Math.hypot(previous.x-item.x,previous.y-item.y)>12){
        task.target={room:item.room,x:item.x,y:item.y};task.repathTimer=.25;
        elf.goal=null;elf.path=[];elf.wait=0;
      }
    }
    let targetRoom=elf.carrying?elfGiftTargetRoom(elf,task):task.foraging?item.room:elf.home+'Inside';
    if(elf.room===targetRoom&&!elf.carrying&&Math.hypot(elf.x-item.x,elf.y-item.y)<=80){
      if(task.feeling==='likes'&&!task.offering&&!task.reclaim&&!task.tidy)task.excess=elfHasLikedObject(elf,task.id);
      if(!task.feeling){
        finishElfGiftReaction(elf,task);
        item.elfAssessment={home:elf.home,x:item.x,y:item.y};
        elf.giftTask=null;elf.goal=null;elf.path=[];elf.wait=.5;return;
      }
      elf.carrying=task.id;item.room='elf:'+elf.home;elf.goal=null;elf.path=[];elf.wait=0;
      if(task.feeling==='hates')finishElfGiftReaction(elf,task,false);
      if(task.offering){delete item.treasureOwner;if(state.treasureWatch)delete state.treasureWatch[task.id];}
      playPickup(.3);
      targetRoom=elfGiftTargetRoom(elf,task);
    }
    if(elf.goal)return;
    let goal;
    if(elf.room!==targetRoom){
      const door=stalkerDoor(elf,targetRoom);if(door)goal={...door.exit,door};
    }else if(elf.carrying){
      task.delivery=elfGiftDelivery(elf,targetRoom,task.offering,task.reclaim);
      if(task.delivery)goal=task.delivery.approach;
    }else{
      const options=[[-70,0],[70,0],[0,-70],[0,70]].map(([dx,dy])=>({x:item.x+dx,y:item.y+dy})).sort((a,b)=>Math.hypot(a.x-elf.x,a.y-elf.y)-Math.hypot(b.x-elf.x,b.y-elf.y));
      goal=options.find(point=>!blocked(elf.room,point.x,point.y,elf.home)&&(clearDragonRoute(elf.room,elf.x,elf.y,point.x,point.y,elf.home)||findDragonRoute(elf,point).length));
    }
    if(!goal){delayElfGiftRetry(elf,item);return;}
    if(elf.carrying&&elf.room===targetRoom&&Math.hypot(elf.x-goal.x,elf.y-goal.y)<8){
      const {x,y}=task.delivery;state.items[task.id]={room:targetRoom,x,y,elfAssessment:{home:elf.home,x,y},treasureOwner:task.feeling==='likes'&&!task.offering&&!task.excess?elf.home:null};
      playDrop(.3);
      finishElfGiftReaction(elf,task);
      if(task.reclaim)elf.reclaimJewel=false;
      elf.carrying=null;elf.giftTask=null;elf.wait=.5;return;
    }
    elf.goal=goal;elf.path=clearDragonRoute(elf.room,elf.x,elf.y,goal.x,goal.y,elf.home)?[goal]:findDragonRoute(elf,goal);
    if(!elf.path.length){elf.goal=null;delayElfGiftRetry(elf,item);}
  }
  function delayElfGiftRetry(elf,item){
    elf.wait=.35;elf.giftTask.retryTimer=.35;
    elf.giftTask.retryScene={room:state.room,playerX:state.player.x,playerY:state.player.y,itemRoom:item.room,itemX:item.x,itemY:item.y};
  }
  function elfClearShot(elf,origin=elf){
    const start=isAxe(elf.carrying)?elfCarriedPosition({...elf,...origin}):{x:origin.x,y:origin.y+35},p=state.player,steps=Math.ceil(Math.hypot(p.x-start.x,p.y-start.y)/6);
    // Positions stay fixed during one shot check; resolve obstacles once per shot.
    const protection=protectedJewelFields(elf.room),offsets=[[-10,0],[10,0],[0,-13],[0,13]];
    const otherElves=state.elves.filter(other=>other!==elf&&other.room===elf.room);
    const obstacles=[];
    for(const id of Object.keys(state.items)){
      if(id===elf.carrying||state.usedAxes.has(id))continue;
      const pos=itemPosition(id);if(pos.room===elf.room)obstacles.push({pos,bridge:isBridge(id)});
    }
    for(let i=1;i<=steps;i++){
      const x=start.x+(p.x-start.x)*i/steps,y=start.y+(p.y-start.y)*i/steps;
      if(offsets.some(([dx,dy])=>protection.some(pos=>jewelProtectionDistance(pos,x+dx,y+dy)<1)||blocked(elf.room,x+dx,y+dy,true,true)))return false;
      if(otherElves.some(other=>elfDistanceSquared(other,x,y,22)<1))return false;
      if(obstacles.some(({pos,bridge})=>bridge?Math.abs(x-pos.x)<BRIDGE_WIDTH/2+22&&Math.abs(y-pos.y)<BRIDGE_HEIGHT/2+25:Math.hypot(x-pos.x,y-pos.y)<38))return false;
    }
    return true;
  }
  let elfShotBudget=0,elfRouteBudget=0;
  function elfThrowingPosition(elf){
    const p=state.player,personality=ELF_PERSONALITIES[elf.home];
    const preferredAngle=(elf.huntBearing??Math.atan2(elf.y-p.y,elf.x-p.x))+personality.flank;
    const spaced=point=>!state.elves.some(other=>other!==elf&&other.room===elf.room&&other.hunting&&
      (Math.hypot(point.x-other.x,point.y-other.y)<75||other.goal?.firingPosition&&Math.hypot(point.x-other.goal.x,point.y-other.goal.y)<75));
    // Keep a useful destination while walking around the obstacle.
    if(elf.goal?.firingPosition&&Math.hypot(elf.goal.x-p.x,elf.goal.y-p.y)<=400&&
      Math.hypot(p.x-elf.goal.playerX,p.y-elf.goal.playerY)<80&&spaced(elf.goal)&&
      !blocked(elf.room,elf.goal.x,elf.goal.y,elf.home)&&elfClearShot(elf,elf.goal))return elf.goal;
    const scene=elf.room+'|'+Math.round(p.x/20)+','+Math.round(p.y/20)+'|'+state.held+'|'+state.heldSide+'|'+
      Object.entries(state.items).filter(([,item])=>item.room===elf.room).map(([id,item])=>id+':'+Math.round(item.x/10)+','+Math.round(item.y/10)).join('|');
    let search=elf.shotSearch;
    if(!search||search.scene!==scene||search.done&&elf.shotRetry<=0){
      search=elf.shotSearch={scene,candidates:[],index:0,done:false};
    for(const radius of [personality.distance,100,160,240,320,390])for(let i=0;i<24;i++){
      const angle=preferredAngle+i*Math.PI/12,point={x:p.x+Math.cos(angle)*radius,y:p.y+Math.sin(angle)*radius,firingPosition:true,playerX:p.x,playerY:p.y};
      const angleDifference=Math.abs(Math.atan2(Math.sin(angle-preferredAngle),Math.cos(angle-preferredAngle)));
      point.score=Math.hypot(point.x-elf.x,point.y-elf.y)*.35+Math.abs(radius-personality.distance)+angleDifference*personality.distance*.7;
      search.candidates.push(point);
    }
      search.candidates.sort((a,b)=>a.score-b.score);
    }
    if(search.done)return null;
    // Bound expensive checks across all elves, and continue next frame.
    let checked=0;
    while(search.index<search.candidates.length&&checked<2&&elfShotBudget>0){
      const point=search.candidates[search.index];
      checked++;elfShotBudget--;
      if(!spaced(point)||blocked(elf.room,point.x,point.y,elf.home)||!elfClearShot(elf,point)){search.index++;continue;}
      let path;
      if(clearDragonRoute(elf.room,elf.x,elf.y,point.x,point.y,elf.home))path=[point];
      else{
        if(elfRouteBudget<=0)return null;
        elfRouteBudget--;path=findDragonRoute(elf,point);
      }
      search.index++;
      if(path.length){point.searchPath=path;search.done=true;elf.shotRetry=.8;return point;}
    }
    if(search.index>=search.candidates.length){search.done=true;elf.shotRetry=.8;}
    return null;
  }
  function elfChaseDirection(elf,dx,dy,dt){
    let vx=dx,vy=dy;
    const homes=Object.keys(ELF_PERSONALITIES),index=homes.indexOf(elf.home);
    for(const other of state.elves){
      if(other===elf||other.room!==elf.room)continue;
      let sx=elf.x-other.x,sy=elf.y-other.y,distance=Math.hypot(sx,sy);
      if(distance>=85)continue;
      if(distance<.01){
        // Opposite, deterministic nudges also separate identical spawn positions.
        const otherIndex=homes.indexOf(other.home),sign=index<otherIndex?1:-1;
        const angle=(Math.min(index,otherIndex)*4+Math.max(index,otherIndex))*2.4;
        sx=Math.cos(angle)*sign;sy=Math.sin(angle)*sign;distance=1;
      }
      const strength=4*(1-distance/85);
      vx+=sx/distance*strength;vy+=sy/distance*strength;
    }
    const target={x:vx-dx,y:vy-dy};
    const previous=elf.chaseDirection;
    if(previous){
      const blend=1-Math.exp(-12*dt);
      target.x=previous.x+(target.x-previous.x)*blend;target.y=previous.y+(target.y-previous.y)*blend;
    }
    elf.chaseDirection=target;
    const length=Math.hypot(dx+target.x,dy+target.y)||1;
    return {x:(dx+target.x)/length,y:(dy+target.y)/length};
  }
  function updateElfHunt(elf,dt){
    if(elf.emotionalState.sentiment!==1||elf.emotionalState.passion!==3){
      if(elf.hunting){
        elf.hunting=false;elf.goal=null;elf.path=[];elf.shotSearch=null;elf.chaseDirection=null;
        if(isAxe(elf.carrying)){state.items[elf.carrying]={room:elf.room,x:elf.x,y:elf.y+60};elf.carrying=null;playDrop(.3);}
      }
      return false;
    }
    if(!elf.hunting){elf.hunting=true;elf.huntBearing=Math.atan2(elf.y-state.player.y,elf.x-state.player.x);elf.giftTask=null;elf.goal=null;elf.path=[];elf.wait=0;elf.huntTimer=0;}
    if(elf.huntBearingRoom!==elf.room){elf.huntBearingRoom=elf.room;elf.huntBearing=Math.atan2(elf.y-state.player.y,elf.x-state.player.x);}
    const huntContext=elf.room+'|'+state.room+'|'+elf.carrying+'|'+AXE_IDS.map(id=>{
      const item=state.items[id];return item.room+':'+!!state.axeFlights[id]+':'+Math.floor(item.x/60)+':'+Math.floor(item.y/60);
    }).join('|');
    if(elf.huntContext!==huntContext){elf.huntContext=huntContext;elf.huntTimer=0;}
    elf.shotRetry=Math.max(0,(elf.shotRetry||0)-dt);
    elf.huntTimer=Math.max(0,(elf.huntTimer||0)-dt);
    if(elf.huntTimer>0&&!(elf.shotSearch&&!elf.shotSearch.done&&isAxe(elf.carrying)&&elf.room===state.room))return true;
    elf.huntTimer=.4;
    if(elf.carrying&&!isAxe(elf.carrying)){
      state.items[elf.carrying]={room:elf.room,x:elf.x,y:elf.y+60};elf.carrying=null;playDrop(.3);
    }
    let targetRoom,point;
    if(isAxe(elf.carrying)){
      targetRoom=state.room;const p=state.player,distance=Math.hypot(p.x-elf.x,p.y-elf.y);
      if(elf.room===targetRoom&&distance<=400&&elfClearShot(elf)){
        const id=elf.carrying,start=itemPosition(id),dx=p.x-start.x,dy=p.y-start.y,length=Math.hypot(dx,dy)||1;
        state.items[id]={...start};state.axeFlights[id]={room:elf.room,vx:dx/length*650,vy:dy/length*650,age:0,travelled:0,thrower:elf.home};
        state.axePickupDirections[id]=null;state.axeRecoveries[id]=null;
        elf.carrying=null;elf.goal=null;elf.path=[];elf.shotSearch=null;elf.wait=.7;elf.huntTimer=.7;playDrop(.3);return true;
      }
      point=elf.room===targetRoom?elfThrowingPosition(elf):null;
      if(!point&&elf.shotSearch&&!elf.shotSearch.done&&elf.room===targetRoom)return true;
      const personality=ELF_PERSONALITIES[elf.home],angle=(elf.huntBearing??Math.atan2(elf.y-p.y,elf.x-p.x))+personality.flank;
      point??={x:p.x+Math.cos(angle)*personality.distance,y:p.y+Math.sin(angle)*personality.distance};
    }else{
      const homeAxe=Object.keys(ELF_AXES).find(id=>ELF_AXES[id]===elf.home);
      const axes=AXE_IDS.filter(id=>!state.usedAxes.has(id)&&!state.axeFlights[id]&&rooms[state.items[id].room]).sort((a,b)=>{
        if(a===homeAxe)return -1;
        if(b===homeAxe)return 1;
        const aa=state.items[a],bb=state.items[b];
        return (aa.room===elf.room?0:2000)+Math.hypot(aa.x-elf.x,aa.y-elf.y)-(bb.room===elf.room?0:2000)-Math.hypot(bb.x-elf.x,bb.y-elf.y);
      });
      const id=axes.find(id=>state.items[id].room===elf.room||stalkerDoor(elf,state.items[id].room));
      if(!id){elf.goal=null;elf.path=[];elf.wait=.5;return true;}
      const axe=state.items[id];targetRoom=axe.room;
      if(elf.room===targetRoom&&Math.hypot(elf.x-axe.x,elf.y-axe.y)<=75){
        elf.carrying=id;elf.axeSide=state.player.x<elf.x?'left':'right';axe.room='elf:'+elf.home;state.axeRecoveries[id]=null;state.axePickupDirections[id]=null;
        elf.goal=null;elf.path=[];elf.wait=0;elf.huntTimer=0;playPickup(.3);return true;
      }
      const approaches=[[-65,0],[65,0],[0,-65],[0,65]].map(([dx,dy])=>({x:axe.x+dx,y:axe.y+dy}));
      point=approaches.sort((a,b)=>Math.hypot(a.x-elf.x,a.y-elf.y)-Math.hypot(b.x-elf.x,b.y-elf.y)).find(pos=>!blocked(targetRoom,pos.x,pos.y,elf.home));
    }
    let goal=point;
    if(elf.room!==targetRoom){const door=stalkerDoor(elf,targetRoom);goal=door?{...door.exit,door}:null;}
    if(goal&&elf.goal&&elf.huntPlanRoom===elf.room&&elf.goal.door?.to===goal.door?.to&&Math.hypot(elf.goal.x-goal.x,elf.goal.y-goal.y)<35)return true;
    if(!goal||blocked(elf.room,goal.x,goal.y,elf.home)){elf.goal=null;elf.path=[];elf.wait=.2;return true;}
    elf.huntPlanRoom=elf.room;elf.goal=goal;elf.path=goal.searchPath|| (clearDragonRoute(elf.room,elf.x,elf.y,goal.x,goal.y,elf.home)?[goal]:findDragonRoute(elf,goal));delete goal.searchPath;elf.wait=0;
    if(!elf.path.length){elf.goal=null;elf.wait=.2;}
    return true;
  }
  function elfNearDoorway(room,x,y,radius=95){
    return connectedRooms(room).some(other=>[
      ...dragonDoors(room,other).map(door=>door.exit),
      ...dragonDoors(other,room).map(door=>door.entry)
    ].some(point=>Math.hypot(x-point.x,y-point.y)<radius));
  }
  function clearElfDoorway(elf){
    const points=[];
    for(let y=80;y<=560;y+=30)for(let x=80;x<=880;x+=30){
      if(!elfNearDoorway(elf.room,x,y,120)&&!blocked(elf.room,x,y,elf.home))points.push({x,y,clearDoorway:true});
    }
    points.sort((a,b)=>Math.hypot(a.x-elf.x,a.y-elf.y)-Math.hypot(b.x-elf.x,b.y-elf.y));
    for(const point of points.slice(0,40)){
      const path=clearDragonRoute(elf.room,elf.x,elf.y,point.x,point.y,elf.home)?[point]:findDragonRoute(elf,point);
      if(path.length){elf.goal=point;elf.path=path;elf.wait=0;return true;}
    }
    elf.goal=null;elf.path=[];elf.wait=.1;return false;
  }
  function updateElves(dt){
    elfShotBudget=8;elfRouteBudget=1;
    for(const elf of state.elves){
      updateElfJewelTrust(elf);
      let elapsed=dt;
      if(elf.surpriseTimer>0){
        const used=Math.min(elapsed,elf.surpriseTimer);elf.surpriseTimer-=used;elapsed-=used;
        if(elf.surpriseTimer<1e-8)elf.surpriseTimer=0;
        if(elf.surpriseTimer>0)continue;
      }
      if(elf.stunTimer>0){elf.stunTimer=Math.max(0,elf.stunTimer-elapsed);if(elf.stunTimer<1e-8)elf.stunTimer=0;if(elf.stunTimer>0)continue;}
      const elfDt=dt*(elf.emotionalState.sentiment===1&&elf.emotionalState.passion===3?1.1:1);
      const elfMoveSpeed=78.65*(elf.emotionalState.passion===3?1.2:1);
      startElfJewelReclaim(elf);
      if(elf.hunting&&(elf.emotionalState.sentiment!==1||elf.emotionalState.passion!==3))updateElfHunt(elf,0);
      if(!elf.goal?.clearDoorway){
        if(!elf.goal&&elfNearDoorway(elf.room,elf.x,elf.y))clearElfDoorway(elf);
        if(!elf.goal?.clearDoorway){
          if(elf.giftTask||elfPendingGift(elf)){
            if(elf.hunting){
              elf.hunting=false;elf.goal=null;elf.path=[];elf.wait=0;
              if(isAxe(elf.carrying)){
                const x=elf.x,y=elf.y+60;
                state.items[elf.carrying]={room:elf.room,x,y,elfAssessment:{home:elf.home,x,y}};elf.carrying=null;playDrop(.3);
              }
            }
            updateElfGift(elf,dt);
          }else{
            updateElfOffering(elf);
            if(elf.giftTask?.offering){elf.hunting=false;updateElfGift(elf,dt);}
            else updateElfHunt(elf,elfDt);
          }
        }
      }
      if(elf.giftTask&&!elf.goal)continue;
      elf.wait-=elfDt;if(elf.wait>0)continue;
      if(elf.hunting&&!elf.goal)continue;
      if(!elf.goal){
        const insideHome=!!ELF_INTERIORS[elf.room];
        const doors=connectedRooms(elf.room).filter(room=>!ELF_INTERIORS[room]).flatMap(room=>dragonDoors(elf.room,room));
        let goal=null,path=[];
        for(let attempt=0;attempt<8;attempt++){
          const door=doors.length&&(insideHome||Math.random()<.55)?doors[Math.floor(Math.random()*doors.length)]:null;
          if(insideHome&&!door)break;
          const point=door?door.exit:{x:90+Math.random()*780,y:90+Math.random()*460};
          if(!door&&elfNearDoorway(elf.room,point.x,point.y))continue;
          if(blocked(elf.room,point.x,point.y,elf.home))continue;
          path=clearDragonRoute(elf.room,elf.x,elf.y,point.x,point.y,elf.home)?[point]:findDragonRoute(elf,point);
          if(path.length){goal={...point,door};break;}
        }
        if(!goal){elf.wait=1;continue;}
        elf.goal=goal;elf.path=path;
      }
      while(elf.path.length&&Math.hypot(elf.path[0].x-elf.x,elf.path[0].y-elf.y)<3)elf.path.shift();
      const target=elf.path[0]||elf.goal,dx=target.x-elf.x,dy=target.y-elf.y,distance=Math.hypot(dx,dy);
      if(distance<8&&(!elf.path.length||target===elf.goal)){
        const door=elf.goal.door;
        if(door&&!blocked(door.to,door.entry.x,door.entry.y,elf.home)){
          elf.room=door.to;elf.x=door.entry.x;elf.y=door.entry.y;
        }
        if(door){clearElfDoorway(elf);continue;}
        elf.goal=null;elf.path=[];elf.wait=.8+Math.random()*2;continue;
      }
      const movement=Math.min(distance,elfMoveSpeed*dt),steps=Math.max(1,Math.ceil(movement/4));let moved=false;
      for(let step=0;step<steps;step++){
        const direction=elf.hunting?elfChaseDirection(elf,dx/distance,dy/distance,elfDt/steps):{x:dx/distance,y:dy/distance};
        const x=elf.x+direction.x*movement/steps,y=elf.y+direction.y*movement/steps;
        if(blocked(elf.room,x,y,elf.home))break;
        elf.x=x;elf.y=y;moved=true;
      }
      if(!moved){
        elf.path=findDragonRoute(elf,elf.goal);
        if(elf.path.length)elf.wait=.1;
        else{elf.goal=null;elf.path=[];elf.wait=.5;}
      }
    }
  }
  function dragonDoors(from,to){const portals=mazePortals.filter(p=>p.from===from&&p.to===to);return portals.length?portals.map(mazeDoor):[dragonDoor(from,to)].filter(Boolean);}
  function dragonEscapeDoor(d,player){
    const destinations=connectedRooms(d.room);
    for(const castle of ['gold','black','white']){
      if(d.room===castle&&state.gates[castle]&&state.gateLift[castle]>=1)destinations.push(castle+'Inside');
      if(d.room===castle+'Inside')destinations.push(castle);
    }
    let best=null,bestScore=-Infinity;
    for(const room of destinations)for(const door of dragonDoors(d.room,room)){
      if(!clearDragonRoute(d.room,d.x,d.y,door.exit.x,door.exit.y,true)&&!findDragonRoute(d,door.exit).length)continue;
      const score=Math.hypot(door.exit.x-player.x,door.exit.y-player.y)-.2*Math.hypot(door.exit.x-d.x,door.exit.y-d.y);
      if(score>bestScore){best=door;bestScore=score;}
    }
    return best;
  }
  function elfWorldDoor(elf,target){
    state.elfRoomRoutes??=new Map();
    const key=elf.room+'|'+target+'|'+Object.keys(state.gates).map(home=>state.gates[home]+':'+(state.gateLift[home]>=1)).join('|');
    let next=state.elfRoomRoutes.get(key);
    if(next===undefined){
      const queue=[{room:elf.room,first:null}],seen=new Set([elf.room]);next=null;
      for(let head=0;head<queue.length;head++){
        const here=queue[head],neighbors=connectedRooms(here.room);
        for(const castle of ['gold','black','white'])if(here.room===castle&&state.gates[castle]&&state.gateLift[castle]>=1)neighbors.push(castle+'Inside');
        if(here.room==='goldInside'||here.room==='blackInside'||here.room==='whiteInside')neighbors.push(here.room.slice(0,-6));
        for(const room of neighbors){
          if(seen.has(room)||!dragonDoors(here.room,room).length)continue;
          const first=here.first||room;
          if(room===target){next=first;break;}
          seen.add(room);queue.push({room,first});
        }
        if(next)break;
      }
      state.elfRoomRoutes.set(key,next);
    }
    if(!next)return null;
    return dragonDoors(elf.room,next).sort((a,b)=>Math.hypot(a.exit.x-elf.x,a.exit.y-elf.y)-Math.hypot(b.exit.x-elf.x,b.exit.y-elf.y))[0]||null;
  }
  function stalkerDoor(d,target){
    if(d.home)return elfWorldDoor(d,target);
    const queue=[{room:d.room,x:d.x,y:d.y,firstDoor:null}],seen=new Set([`${d.room}:${Math.round(d.x)},${Math.round(d.y)}`]);
    for(let i=0;i<queue.length;i++){
      const {room,x,y,firstDoor}=queue[i],next=connectedRooms(room);
      for(const castle of ['gold','black','white']){
        if(room===castle&&state.gates[castle]&&state.gateLift[castle]>=1)next.push(castle+'Inside');
        if(room===castle+'Inside')next.push(castle);
      }
      for(const other of new Set(next))for(const door of dragonDoors(room,other)){
        const key=`${other}:${Math.round(door.entry.x)},${Math.round(door.entry.y)}`;
        if(seen.has(key))continue;
        if(!clearDragonRoute(room,x,y,door.exit.x,door.exit.y,true)&&!findDragonRoute({room,x,y},door.exit).length)continue;
        if(other===target)return firstDoor||door;
        seen.add(key);queue.push({room:other,x:door.entry.x,y:door.entry.y,firstDoor:firstDoor||door});
      }
    }
    return null;
  }
  function updateDragons(elapsed){
    for(const d of state.dragons){
      if(d.dead||slayDragonIfSword(d))continue;
      let dt=elapsed;
      if(d.axePauseTimer>0){
        const used=Math.min(dt,d.axePauseTimer);d.axePauseTimer-=used;dt-=used;
        if(d.axePauseTimer<1e-8)d.axePauseTimer=0;
        if(dt<1e-8)continue;
      }
      if(d.name===state.bat.carryingDragon){d.biting=false;d.follow=[];d.escape=null;continue;}
      if(d.room!==state.room){
        d.biting=false;
        if(d.escape){const door=d.escape;moveDragonToward(d,door.exit,dt);if(d.dead)continue;if(Math.hypot(d.x-door.exit.x,d.y-door.exit.y)<24){d.room=door.to;d.x=door.entry.x;d.y=door.entry.y;d.escape=null;d.follow=[];d.path=[];d.pathTimer=0;}continue;}
        const door=d.follow[0];if(!door)continue;
        moveDragonToward(d,door.exit,dt);
        if(d.dead)continue;
        if(Math.hypot(d.x-door.exit.x,d.y-door.exit.y)<24){d.room=door.to;d.x=door.entry.x;d.y=door.entry.y;d.follow.shift();d.path=[];d.pathTimer=0;}
        continue;
      }
      d.follow=[];
      const p=state.player,dist=Math.hypot(p.x-d.x,p.y-d.y);
      const swordHeld=hasCarriedItem('sword');
      if(swordHeld)d.biting=false;
      if(d.biting){if(dist>55){d.biting=false;}else{d.biteTimer-=dt;if(d.biteTimer<=0){die(d);return;}continue;}}
      if(dist<38){d.biting=true;d.biteTimer=.65;playChomp();say(d.name+' lunges! Move away!');continue;}
      if(swordHeld){
        if(!d.escape)d.escape=dragonEscapeDoor(d,p);
        if(d.escape){const door=d.escape;moveDragonToward(d,door.exit,dt);if(d.dead)continue;if(Math.hypot(d.x-door.exit.x,d.y-door.exit.y)<24){d.room=door.to;d.x=door.entry.x;d.y=door.entry.y;d.escape=null;d.follow=[];d.path=[];d.pathTimer=0;}continue;}
      }else d.escape=null;
      moveDragonToward(d,p,dt,swordHeld);
    }
  }
  function batNeighbor(room,d){
    if(room==='south')return neighbor(room,d);
    if(room==='gold'&&d.x)return room;
    const next=neighbor(room,d);if(next!==room)return next;
    if(state.questMode==='easy')return room;
    const row=grid.findIndex(r=>r.includes(room));if(row<0)return room;
    const col=grid[row].indexOf(room);
    const wrapped=grid[(row+d.y+grid.length)%grid.length][(col+d.x+grid[row].length)%grid[row].length];
    return wrapped&&wrapped!=='south'&&!(wrapped==='gold'&&d.x)?wrapped:room;
  }
  function batMazeRoute(b){
    if(!b.mazeDestination||mazeTiles[b.mazeDestination]){
      b.mazeDestination=b.room==='mazeML'?'stone':'black';
    }
    const distance={[b.mazeDestination]:0},queue=[b.mazeDestination];
    for(let i=0;i<queue.length;i++)for(const portal of mazePortals){
      if(portal.to!==queue[i]||distance[portal.from]!==undefined)continue;
      distance[portal.from]=distance[queue[i]]+1;queue.push(portal.from);
    }
    if(b.mazePortal?.from===b.room&&distance[b.mazePortal.to]<distance[b.room])return b.mazePortal;
    const exits=mazePortals.filter(portal=>portal.from===b.room&&distance[portal.to]<distance[b.room]);
    b.mazePortal=exits.reduce((best,portal)=>{
      const point=mazeDoor(portal).exit;
      const near=Math.hypot(point.x-b.x,point.y-b.y);
      if(!best||near<best.distance)return {portal,distance:near};
      return best;
    },null)?.portal||null;
    b.mazeCrossing=false;
    return b.mazePortal;
  }
  function moveBatAcrossWorld(b){
    if(mazeTiles[b.room]){
      const edge=b.x<0?'left':b.x>W?'right':b.y<0?'up':b.y>H?'down':null;
      if(edge){const portal=mazePortal(b.room,edge,edge==='left'||edge==='right'?b.y:b.x);
        if(portal){const entry=mazeEntry(portal);b.room=portal.to;b.x=entry.x;b.y=entry.y;b.chaseTimer=0;b.mazePortal=null;b.mazeCrossing=false;
          if(!mazeTiles[b.room]){b.mazeDestination=null;b.vx=portal.entryEdge==='left'?.8:portal.entryEdge==='right'?-.8:0;b.vy=portal.entryEdge==='up'?.6:portal.entryEdge==='down'?-.6:0;}
          return;}
        b.mazeCrossing=false;
        if(edge==='left'||edge==='right'){b.x=Math.max(0,Math.min(W,b.x));b.vx*=-1;}else{b.y=Math.max(0,Math.min(H,b.y));b.vy*=-1;}
      }
      return;
    }
    if(b.x<0){const next=batNeighbor(b.room,dir.left);if(next!==b.room){b.room=next;b.x+=W;b.chaseTimer=0;}else{b.x=-b.x;b.vx=Math.abs(b.vx);}}
    else if(b.x>W){const next=batNeighbor(b.room,dir.right);if(next!==b.room){b.room=next;b.x-=W;b.chaseTimer=0;}else{b.x=2*W-b.x;b.vx=-Math.abs(b.vx);}}
    if(b.y<0){const from=b.room,next=batNeighbor(from,dir.up);if(next!==from){b.room=next;b.y+=H;b.chaseTimer=0;if(mazeTiles[next]){b.mazeDestination=from==='black'?'stone':'black';b.mazePortal=null;b.mazeCrossing=false;}}else{b.y=-b.y;b.vy=Math.abs(b.vy);}}
    else if(b.y>H){const from=b.room,next=batNeighbor(from,dir.down);if(next!==from){b.room=next;b.y-=H;b.chaseTimer=0;if(mazeTiles[next]){b.mazeDestination=from==='black'?'stone':'black';b.mazePortal=null;b.mazeCrossing=false;}}else{b.y=2*H-b.y;b.vy=-Math.abs(b.vy);}}
  }
  function syncCarriedDragon(){
    const b=state.bat,d=state.dragons.find(dragon=>dragon.name===b.carryingDragon);
    if(!d)return;
    const side=state.held==='bat'?dir[state.heldSide]:null;
    d.room=b.room;d.x=b.x+(side?side.x*65:0);d.y=b.y+(side?side.y*65:65);
  }
  function updateBat(dt){
    const b=state.bat,p=state.player,playerActive=state.mode==='playing';
    batTimer=Math.max(0,batTimer-dt);b.pickupCooldown=Math.max(0,b.pickupCooldown-dt);b.sightCooldown=Math.max(0,b.sightCooldown-dt);b.chaseTimer=Math.max(0,b.chaseTimer-dt);
    if(state.held==='bat'){syncHeldBat();syncCarriedDragon();return;}
    if(playerActive&&b.room===state.room&&state.held&&b.sightCooldown<=0){b.sightCooldown=1.5+Math.random()*1.5;if(Math.random()<.55)b.chaseTimer=2.5;}
    let vx=b.vx,vy=b.vy;
    if(playerActive&&b.room===state.room&&state.held&&b.chaseTimer>0){
      const dx=p.x-b.x,dy=p.y-b.y,distance=Math.hypot(dx,dy)||1;vx=dx/distance;vy=dy/distance;
      if(Math.abs(dx)>20)b.vx=Math.sign(dx)*.8;
      if(Math.abs(dy)>20)b.vy=Math.sign(dy)*.6;
    }
    else if(!b.carrying&&!b.carryingDragon){
      let nearest=null,best=190;
      for(const [id,item] of Object.entries(state.items)){
        if(isAxe(id)&&(state.usedAxes.has(id)||state.axeFlights[id]))continue;const castle={goldKey:'gold',blackKey:'black',whiteKey:'white'}[id];if(item.room!==b.room||(castle&&keyTouchesGate(castle)))continue;
        const distance=Math.hypot(item.x-b.x,item.y-b.y);if(distance<best){nearest=item;best=distance;}
      }
      for(const d of state.dragons){if(d.room!==b.room)continue;const distance=Math.hypot(d.x-b.x,d.y-b.y);if(distance<best){nearest=d;best=distance;}}
      if(nearest&&best>0){const dx=nearest.x-b.x,dy=nearest.y-b.y;vx=dx/best;vy=dy/best;if(Math.abs(dx)>20)b.vx=Math.sign(dx)*.8;if(Math.abs(dy)>20)b.vy=Math.sign(dy)*.6;}
    }
    if(mazeTiles[b.room]){
      const portal=batMazeRoute(b);
      if(portal){
        const target=mazeDoor(portal).exit,dx=target.x-b.x,dy=target.y-b.y,distance=Math.hypot(dx,dy);
        if(distance<=8)b.mazeCrossing=true;
        if(!b.mazeCrossing){vx=dx/distance;vy=dy/distance;}
        else{vx=portal.edge==='left'?-1:portal.edge==='right'?1:0;vy=portal.edge==='up'?-1:portal.edge==='down'?1:0;}
      }
    }
    b.x+=vx*280*dt;b.y+=vy*280*dt;moveBatAcrossWorld(b);syncCarriedDragon();
    if(playerActive&&b.room===state.room&&!state.held&&state.pickupDelay<=0&&batTimer<=0&&Math.hypot(p.x-b.x,p.y-b.y)<36){
      state.heldSide=sideTouched(p,b);state.held='bat';state.heldBridgeOffset=null;b.chaseTimer=0;batTimer=.8;syncHeldBat();syncCarriedDragon();playPickup();say('Picked up the bat.');return;
    }
    if(playerActive&&b.room===state.room&&state.held&&batTimer<=0&&Math.hypot(p.x-b.x,p.y-b.y)<36){
      const offered=state.held,received=b.carrying,receivedPosition=received&&isBridge(received)?batCarriedPosition(received):null;state.heldSide=sideTouched(p,b);
      b.carryingDragon=null;
      state.items[offered].room='bat';b.carrying=offered;state.held=received;state.heldBridgeOffset=receivedPosition?{x:receivedPosition.x-p.x,y:receivedPosition.y-p.y}:null;
      if(received){state.items[received].room='held';say('The bat swapped your '+itemInfo[offered][0]+' for '+itemInfo[received][0]+'.');}
      else say('The bat stole your '+itemInfo[offered][0]+'!');
      batTimer=1.2;b.pickupCooldown=1.2;b.chaseTimer=0;return;
    }
    if(b.pickupCooldown>0)return;
    if(!b.carrying&&!b.carryingDragon)for(const d of state.dragons){
      if(d.room!==b.room||Math.hypot(d.x-b.x,d.y-b.y)>=40)continue;
      d.biting=false;d.follow=[];d.escape=null;d.path=[];d.pathTimer=0;
      b.carryingDragon=d.name;b.pickupCooldown=1.5;syncCarriedDragon();if(b.room===state.room)say('The bat carried off '+d.name+'.');return;
    }
    if(b.carryingDragon)return;
    for(const [id,item] of Object.entries(state.items)){
      if(isAxe(id)&&(state.usedAxes.has(id)||state.axeFlights[id]))continue;const castle={goldKey:'gold',blackKey:'black',whiteKey:'white'}[id];if(castle&&keyTouchesGate(castle))continue;
      if(item.room!==b.room||Math.hypot(item.x-b.x,item.y-b.y)>=40)continue;
      if(b.carrying)state.items[b.carrying]={room:b.room,x:b.x,y:b.y};
      item.room='bat';b.carrying=id;b.pickupCooldown=1.5;
      if(b.room===state.room)say('The bat carried off '+itemInfo[id][0]+'.');
      break;
    }
  }
  function beginVictory(){
    startVictory();
  }
  function returnedJewelCount(){
    const zone=ELF_ROOM_ZONES.possessions;
    return JEWEL_VARIANTS.filter(([id])=>{
      const item=state.items[id];
      return item.room==='goldInside'&&item.x>=zone.x&&item.x<=zone.x+zone.w&&item.y>=zone.y&&item.y<=zone.y+zone.h;
    }).length;
  }
  function checkJewelVictory(){
    if(state.mode==='playing'&&state.room==='goldInside'&&returnedJewelCount()===JEWEL_VARIANTS.length)beginVictory();
  }
  function startVictory(){state.mode='winning';state.winTimer=0;state.message='All six jewels have returned to the Jewelkeep Treasury!';winSound.currentTime=0;winSound.play().catch(()=>{});refresh();}
  function finishVictory(){state.mode='won';showOverlay('THE SIX JEWELS RETURN','You brought all six jewels back to the Jewelkeep Treasury!','PLAY AGAIN');refresh();}
  function update(dt){if(behaviorDialog.open)return;if(state.mode==='title'){state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);if(window.matchMedia?.('(max-width: 399px), (pointer: coarse)').matches)return;movePlayer(dt);const screen=canvas.getBoundingClientRect(),p=state.player,px=screen.left+p.x*screen.width/W,py=screen.top+p.y*screen.height/H;for(const id of ['hardModeBtn']){const button=$(id).getBoundingClientRect();if(px>=button.left&&px<=button.right&&py>=button.top&&py<=button.bottom){start();break;}}return;}if(state.mode==='winning'){state.winTimer+=dt;const duration=Number.isFinite(winSound.duration)&&winSound.duration>0?winSound.duration:4;if(state.winTimer>=Math.max(3,duration)+VICTORY_MESSAGE_DELAY&&(winSound.ended||winSound.paused))finishVictory();return;}if(state.mode==='lost'){state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);moveSwallowed(dt);updateAxeFades(dt);updateBat(dt);refresh();return;}if(state.mode!=='playing')return;updateJewelFlashes(dt);state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);moveDelay=Math.max(0,moveDelay-dt);noticeTimer=Math.max(0,noticeTimer-dt);state.pickupDelay=Math.max(0,state.pickupDelay-dt);for(const castle of Object.keys(state.gates))state.gateLift[castle]=Math.max(0,Math.min(1,state.gateLift[castle]+(state.gates[castle]?1:-1)*dt/.8));updateTreasureRemoval();movePlayer(dt);updateTreasureRemoval();gateCheck();checkJewelVictory();if(state.mode!=='playing')return;updateElves(dt);updateAxe(dt);if(state.mode!=='playing')return;updateMagnet(dt);pickup();updateDragons(dt);if(state.mode!=='playing')return;updateBat(dt);updateTreasureRemoval();checkJewelVictory();refresh();}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function decorateJewel(sprite,color,fillInterior=true){
    const brush=sprite.getContext('2d'),w=sprite.width,h=sprite.height;
    brush.save();
    if(fillInterior){
      brush.globalCompositeOperation='destination-over';brush.fillStyle=color+'55';brush.beginPath();
      brush.moveTo(w*.5,h*.18);brush.lineTo(w*.78,h*.35);brush.lineTo(w*.78,h*.65);
      brush.lineTo(w*.5,h*.82);brush.lineTo(w*.22,h*.65);brush.lineTo(w*.22,h*.35);brush.closePath();brush.fill();
    }
    // White square inside the upper-left corner, matching the reference shine.
    brush.globalCompositeOperation='source-over';
    const shineSize=Math.max(3,Math.round(w*.15));
    brush.fillStyle='#ffffff';brush.fillRect(Math.round(w*.33),Math.round(h*.3),shineSize,shineSize);
    brush.restore();brush.globalCompositeOperation='source-over';
  }
  function label(t,x,y,size=20,color='#f5e8bc',align='left'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(t,x,y);ctx.textAlign='left';}
  const objectColors=new WeakMap();
  function jewelCycleColor(seconds){
    const phase=seconds/(JEWEL_FLASH_SECONDS/JEWEL_COLORS.length),step=Math.floor(phase+1e-9);
    const blend=Math.max(0,phase-step),from=JEWEL_COLORS[step%JEWEL_COLORS.length],to=JEWEL_COLORS[(step+1)%JEWEL_COLORS.length];
    let color='#';
    for(const offset of [1,3,5]){
      const a=parseInt(from.slice(offset,offset+2),16),b=parseInt(to.slice(offset,offset+2),16);
      color+=Math.round(a+(b-a)*blend).toString(16).padStart(2,'0');
    }
    return color.toUpperCase();
  }
  function jewelFlashColor(id){
    const start=state.jewelFlashSchedule[id].start,phase=state.jewelFlashElapsed-start;
    return start!==null&&phase>=-1e-9&&phase<JEWEL_FLASH_SECONDS?jewelCycleColor(Math.max(0,phase)):itemInfo[id][2];
  }
  function updateJewelFlashes(dt){
    state.jewelFlashElapsed+=dt;
    for(const schedule of Object.values(state.jewelFlashSchedule)){
      while(state.jewelFlashElapsed+1e-9>=schedule.next){
        schedule.start=schedule.next;schedule.next+=4+Math.random()*3.5;
      }
    }
  }
  function tintedJewelSprite(id){
    const source=sprites[id],color=jewelFlashColor(id);
    if(!source||color===itemInfo[id][2])return source;
    sprites.jewelFlashes??={};
    let tint=sprites.jewelFlashes[id];
    if(!tint){tint=document.createElement('canvas');tint.width=source.width;tint.height=source.height;sprites.jewelFlashes[id]=tint;}
    if(tint.flashColor!==color){
      const brush=tint.getContext('2d');brush.clearRect(0,0,tint.width,tint.height);brush.save();brush.drawImage(source,0,0);
      brush.globalCompositeOperation='source-in';brush.fillStyle=color;brush.fillRect(0,0,tint.width,tint.height);brush.restore();
      decorateJewel(tint,color,false);tint.flashColor=color;
    }
    return tint;
  }
  function heldObjectColor(){
    const id=state.held,sprite=sprites[id];
    if(!id)return '#000000';
    if(!sprite||!sprite.getContext)return itemInfo[id][2];
    if(!objectColors.has(sprite)){
      const pixels=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data,counts=new Map();
      let color=itemInfo[id][2],most=0;
      for(let i=0;i<pixels.length;i+=4){
        if(!pixels[i+3])continue;
        const value=`rgb(${pixels[i]},${pixels[i+1]},${pixels[i+2]})`,count=(counts.get(value)||0)+1;
        counts.set(value,count);if(count>most){most=count;color=value;}
      }
      objectColors.set(sprite,color);
    }
    return objectColors.get(sprite);
  }
  function drawItem(id,x,y){const info=itemInfo[id];if(!info)return;ctx.save();ctx.translate(Math.round(x),Math.round(y));const jewel=JEWEL_VARIANTS.some(([jewelId])=>jewelId===id);const sprite=jewel?tintedJewelSprite(id):sprites[id];if(jewel)ctx.shadowBlur=0;if(sprite){ctx.imageSmoothingEnabled=false;if(id==='sword')ctx.drawImage(sprites.sword,-18,-11,36,22);else if(isBridge(id)){const {width,height}=bridgeDimensions(id);ctx.drawImage(sprites.bridge,-width/2,-height/2,width,height);}else if(CROSSING_ITEMS[id]){ctx.imageSmoothingEnabled=jewel||['apple','coin','flute','flower'].includes(EXTRA_GIFTS[id]||id);ctx.imageSmoothingQuality='high';const [sx,sy,sw,sh]=CROSSING_ITEMS[id].crop||[0,0,sprite.width,sprite.height],scale=jewel?.7:(isAxe(id)?54.4:id==='flower'?40.8:34)/Math.max(sw,sh),w=sw*scale*(id==='flute'?1.2:1),h=sh*scale*(id==='flute'?.8:1);ctx.drawImage(sprite,sx,sy,sw,sh,jewel?Math.round(-w/2):-w/2,jewel?Math.round(-h/2):-h/2,w,h);}else ctx.drawImage(sprite,-17,-7,34,14);}else label(info[1],0,id==='magnet'?20:10,id==='magnet'?56:isBridge(id)?Math.round(28*BRIDGE_SCALE):28,jewel?jewelFlashColor(id):info[2],'center');ctx.restore();}
  function drawDragon(d){const sprite=sprites[d.name+(d.dead?'Dead':d.biting?'Attack':'Pursue')];if(sprite){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,Math.round(d.x-20),Math.round(d.y-50),40,100);return;}ctx.save();ctx.translate(Math.round(d.x),Math.round(d.y));rect(-24,-13,48,26,d.color);rect(12,-25,17,20,d.color);rect(-22,11,14,15,d.color);rect(4,11,14,15,d.color);rect(-34,-8,13,10,d.color);rect(20,-18,5,5,'#1a2524');rect(27,-3,13,5,'#fff2cb');ctx.restore();}
  function drawCastle(color,gateOpen,type){
    const lift=state.gateLift[type.slice(0,-6)],celebrating=type==='goldCastle'&&state.mode==='winning',hue=(state.winTimer*300)%360;
    color=celebrating?`hsl(${hue} 85% 65%)`:type==='blackCastle'?'#000000':type==='whiteCastle'?'#ffffff':'#d2d240';
    const {sx,sy,x,y}=castleTransform();
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
    ctx.fillStyle=color;ctx.beginPath();
    for(const part of GOLD_CASTLE_ART.body)ctx.rect(...part);
    ctx.fill();
    ctx.fillStyle='#8f8b8f';for(const window of GOLD_CASTLE_ART.windows)ctx.fillRect(...window);
    const gate=GOLD_CASTLE_ART.gate;ctx.beginPath();ctx.rect(gate.x,gate.y,gate.w,gate.h);ctx.clip();
    ctx.fillStyle='#000000';const gateY=gate.y-gate.travel*lift;
    for(const offset of [0,21,42,62])ctx.fillRect(gate.x+offset,gateY,10,gate.h);
    for(let y=gateY+8;y<gateY+gate.h;y+=20)ctx.fillRect(gate.x,y,gate.w,10);
    ctx.restore();
    if(celebrating)for(let i=0;i<16;i++){const x=305+(i*79)%355,y=75+(i*137)%310,size=5+(i%3)*3;rect(x,y,size,size,`hsl(${(hue+i*35)%360} 100% 75%)`);}
  }
  function usesBlueGateStyle(roomId){return ['blueGate','blueVault','labyrinthGate','labyrinthVault'].includes(roomId);}
  function wallColor(roomId){if(roomId==='stone')return '#657789';if(ELF_HOME_COLORS[roomId])return ELF_HOME_COLORS[roomId];if(roomId==='blueVault')return '#71658C';if(ELF_INTERIORS[roomId])return ELF_HOME_COLORS[ELF_INTERIORS[roomId]];if(roomId==='west')return '#84B468';if(state.questMode==='easy'&&roomId==='greyDungeon')return '#8C58B8';if(wideSideDoors(roomId))return '#74B474';if(state.questMode==='easy'&&roomId==='blackApproach')return '#9CA864';if(state.questMode==='easy'&&roomId==='blackApproachSouth')return '#C06848';const type=rooms[roomId].type;const castleColor={whiteCastle:'#ffffff',whiteInside:'#ffffff',blackCastle:'#000000',blackInside:'#000000',goldCastle:'#d2d240',goldInside:'#d2d240'}[type];return roomId==='entry'?'#FD41FF':usesBlueGateStyle(roomId)?'#8f8b8f':castleColor||(type==='newMaze'?'#505cc0':type==='redDungeon'?'#ad596f':type==='maze'?'#718b95':type==='dark'||type==='greyDungeon'?'#777386':'#ad596f');}
  function drawTree(x,y){
    ctx.save();ctx.translate(x,y);ctx.scale(TREE_SCALE,TREE_SCALE);
    for(const [tx,ty,w,h] of TREE_PARTS)rect(tx+6,ty+6,w,h,'#132528');
    for(const [tx,ty,w,h] of TREE_PARTS)rect(tx,ty,w,h,'#236b42');
    for(const [hx,hy] of [[-27,-28],[7,-28],[-45,18],[-10,18],[26,18]])rect(hx,hy,19,4,'#abc09b');
    ctx.restore();
  }
  function drawNewMaze(room){
    rect(0,0,W,H,'#505cc0');
    for(let row=0;row<MAZE_ROWS;row++)for(let col=0;col<MAZE_COLS;col++)if(mazeTiles[room][row][col]){
      const x0=Math.round(col*MAZE_CELL_W),x1=Math.round((col+1)*MAZE_CELL_W),y0=Math.round(row*MAZE_CELL_H),y1=Math.round((row+1)*MAZE_CELL_H);
      rect(x0,y0,x1-x0,y1-y0,'#8F8B8F');
    }
  }
  function drawPlacedBridge(bridge){
    ctx.save();ctx.translate(bridge.x,bridge.y);
    const channel={x:bridge.x-BRIDGE_LEG_OFFSET,y:bridge.y-BRIDGE_HEIGHT/2,w:BRIDGE_LEG_OFFSET*2,h:BRIDGE_HEIGHT};
    const drawSolidChannel=(x,y,w,h,color)=>{
      const left=Math.max(channel.x,x),top=Math.max(channel.y,y);
      const right=Math.min(channel.x+channel.w,x+w),bottom=Math.min(channel.y+channel.h,y+h);
      if(right>left&&bottom>top)rect(left-bridge.x,top-bridge.y,right-left,bottom-top,color);
    };
    ctx.globalAlpha=.2;
    if(mazeTiles[bridge.room]){
      const firstRow=Math.max(0,Math.floor(channel.y/MAZE_CELL_H)),lastRow=Math.min(MAZE_ROWS-1,Math.ceil((channel.y+channel.h)/MAZE_CELL_H)-1);
      const firstCol=Math.max(0,Math.floor(channel.x/MAZE_CELL_W)),lastCol=Math.min(MAZE_COLS-1,Math.ceil((channel.x+channel.w)/MAZE_CELL_W)-1);
      for(let row=firstRow;row<=lastRow;row++)for(let col=firstCol;col<=lastCol;col++)if(!mazeTiles[bridge.room][row][col]){
        const x0=Math.round(col*MAZE_CELL_W),x1=Math.round((col+1)*MAZE_CELL_W),y0=Math.round(row*MAZE_CELL_H),y1=Math.round((row+1)*MAZE_CELL_H);
        drawSolidChannel(x0,y0,x1-x0,y1-y0,'#8f8b8f');
      }
    }else for(const wall of roomWalls(bridge.room))drawSolidChannel(wall.x,wall.y,wall.w,wall.h,'#c39b68');
    ctx.globalAlpha=1;
    if(sprites.bridge){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprites.bridge,-BRIDGE_WIDTH/2,-BRIDGE_HEIGHT/2,BRIDGE_WIDTH,BRIDGE_HEIGHT);}
    else for(let y=-BRIDGE_HEIGHT/2+7;y<BRIDGE_HEIGHT/2;y+=15)rect(-BRIDGE_LEG_OFFSET+7,y,BRIDGE_LEG_OFFSET*2-14,5,'#67523c');
    ctx.restore();
  }
  function drawDoorFrame(exits,type){
    const wall=wallColor(state.room),topHeight=40;
    const left=0,right=W;
    const side=(x,open)=>{if(open&&wideSideDoors(state.room,x===0?'left':'right')){rect(x,topHeight,40,WAYFARER_DOOR_TOP-topHeight,wall);rect(x,WAYFARER_DOOR_BOTTOM,40,H-topHeight-WAYFARER_DOOR_BOTTOM,wall);return;}rect(x,topHeight,40,open?250-topHeight:600-topHeight,wall);if(open)rect(x,390,40,210,wall);};
    ctx.save();if(type==='goldCastle'&&state.mode==='winning')ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;
    rect(left,0,(exits.up?390:right)-left,topHeight,wall);if(exits.up)rect(570,0,right-570,topHeight,wall);
    rect(left,H-40,(exits.down?390:right)-left,40,wall);if(exits.down)rect(570,H-40,right-570,40,wall);
    side(0,exits.left);side(W-40,exits.right);ctx.restore();
  }
  function drawTitleRoom(){const wall=wallColor('entry');rect(0,0,W,H,'#8F8B8F');rect(0,0,W,ENTRY_TOP,wall);rect(0,ENTRY_TOP,ENTRY_WALL,H-ENTRY_TOP,wall);rect(W-ENTRY_WALL,ENTRY_TOP,ENTRY_WALL,H-ENTRY_TOP,wall);rect(ENTRY_WALL,ENTRY_BOTTOM,ENTRY_OPEN_LEFT-ENTRY_WALL,H-ENTRY_BOTTOM,wall);rect(ENTRY_OPEN_RIGHT,ENTRY_BOTTOM,W-ENTRY_OPEN_RIGHT-ENTRY_WALL,H-ENTRY_BOTTOM,wall);const p=state.player,bump=BOUNCE_DISTANCE*Math.sin(Math.PI*p.bounce.time/BOUNCE_SECONDS);titleCursorCtx.clearRect(0,0,W,H);titleCursorCtx.fillStyle=wall;titleCursorCtx.fillRect(Math.round(p.x-10.53+p.bounce.x*bump),Math.round(p.y-10.53+p.bounce.y*bump),Math.round(21.06),Math.round(21.06));}
  function drawElfInterior(){
    const color=ELF_HOME_COLORS[ELF_INTERIORS[state.room]];
    for(const [id,zone] of Object.entries(ELF_ROOM_ZONES)){
      const zoneColor=id==='gifts'?'#3a3a3a':color;
      rect(zone.x,zone.y,zone.w,zone.h,zoneColor);
      rect(zone.x+4,zone.y+4,zone.w-8,zone.h-8,'#a8a4a8');
      label(id==='gifts'?'GIFTS':'POSSESSIONS',zone.x+zone.w/2,zone.y+42,28,zoneColor,'center');
      label(id==='gifts'?'LEAVE GIFTS HERE':"THE ELF'S TREASURES",zone.x+zone.w/2,zone.y+76,18,id==='gifts'?zoneColor:'#242424','center');
    }
    ctx.save();ctx.strokeStyle='#8F8B8F';ctx.lineWidth=2;
    for(const slot of ELF_TREASURE_SLOTS.slice(0,6))ctx.strokeRect(slot.x-slot.w/2,slot.y-slot.h/2,slot.w,slot.h);
    ctx.restore();
  }
  function drawJewelProtection(id,pos){
    if(!JEWEL_VARIANTS.some(([jewelId])=>jewelId===id)||!elfJewelProtected(pos))return;
    ctx.save();ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.strokeStyle=ELF_HOME_COLORS[elfJewelCornerOwner(pos)];
    ctx.lineWidth=2;ctx.setLineDash([6,5]);
    ctx.beginPath();ctx.ellipse(pos.x,pos.y,30,40,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  function drawGoldenPossessions(){
    const armory=ELF_ROOM_ZONES.gifts,armoryColor=wallColor('goldInside');
    rect(armory.x,armory.y,armory.w,armory.h,armoryColor);
    rect(armory.x+4,armory.y+4,armory.w-8,armory.h-8,'#a8a4a8');
    label('ARMORY',armory.x+armory.w/2,armory.y+42,28,armoryColor,'center');
    label('YOUR WEAPONS',armory.x+armory.w/2,armory.y+76,18,'#242424','center');
    const zone=ELF_ROOM_ZONES.possessions,color=wallColor('goldInside');
    rect(zone.x,zone.y,zone.w,zone.h,color);
    rect(zone.x+4,zone.y+4,zone.w-8,zone.h-8,'#a8a4a8');
    label('POSSESSIONS',zone.x+zone.w/2,zone.y+42,28,color,'center');
    label('YOUR TREASURES',zone.x+zone.w/2,zone.y+76,18,'#242424','center');
    label('JEWELS: '+returnedJewelCount()+' / '+JEWEL_VARIANTS.length,zone.x+zone.w/2,zone.y+104,18,'#242424','center');
  }
  function drawElfEmotions(elf){
    if(!emotionsVisible)return;
    ctx.save();ctx.globalAlpha=.6;
    const {sentiment,passion}=elf.emotionalState;
    const width=160,height=43,x=Math.round(Math.max(5,Math.min(W-width-5,elf.x-width/2))),y=Math.round(Math.max(5,elf.y-ELF_SIZE/2-height-6));
    rect(x,y,width,height,'#ffffff');
    label(ELF_NAMES[elf.home]+' — Emotions',x+width/2,y+13,11,'#303030','center');
    label('Sentiment: '+['','Sad','Neutral','Happy'][sentiment]+' ('+sentiment+')',x+width/2,y+26,10,'#303030','center');
    label('Attitude: '+['','Trust','Neutral','Disgust'][passion]+' ('+passion+')',x+width/2,y+38,10,'#303030','center');
    ctx.restore();
  }
  let objectHover=null;
  function updateObjectTooltip(){
    let name='';
    if(objectHover&&state.mode!=='title'){
      const bounds=canvas.getBoundingClientRect();
      if(bounds.width>0&&bounds.height>0){
        const x=(objectHover.x-bounds.left)*W/bounds.width,y=(objectHover.y-bounds.top)*H/bounds.height;
        let nearest=Infinity;
        for(const id of [...Object.keys(state.items),'bat']){
          const pos=id==='bat'?state.bat:state.placedBridges[id]||itemPosition(id);
          if(!pos||pos.room!==state.room)continue;
          let width=34,height=14;
          if(id==='bat'){width=40;height=55;}
          else if(isBridge(id)){width=BRIDGE_WIDTH;height=BRIDGE_HEIGHT;}
          else if(id==='sword'){width=36;height=22;}
          else if(CROSSING_ITEMS[id]){
            const art=CROSSING_ITEMS[id],sprite=sprites[id],crop=art.crop;
            const sw=crop?.[2]||sprite?.width||34,sh=crop?.[3]||sprite?.height||49;
            const jewel=JEWEL_VARIANTS.some(([jewelId])=>jewelId===id),scale=jewel?.7:(isAxe(id)?54.4:id==='flower'?40.8:34)/Math.max(sw,sh);
            width=sw*scale*(id==='flute'?1.2:1);height=sh*scale*(id==='flute'?.8:1);
          }
          const dx=x-pos.x,dy=y-pos.y,distance=Math.hypot(dx,dy);
          if(Math.abs(dx)<=Math.max(12,width/2+4)&&Math.abs(dy)<=Math.max(12,height/2+4)&&distance<nearest){name=itemInfo[id][0]+(JEWEL_VARIANTS.some(([jewelId])=>jewelId===id)?' jewel':'');nearest=distance;}
        }
      }
    }
    if(canvas.title!==name)canvas.title=name;
  }
  canvas.addEventListener('mousemove',event=>{objectHover={x:event.clientX,y:event.clientY};updateObjectTooltip();});
  canvas.addEventListener('mouseleave',()=>{objectHover=null;updateObjectTooltip();});
  function draw(){if(state.mode==='title'){drawTitleRoom();return;}const room=rooms[state.room],type=room.type;ctx.clearRect(0,0,W,H);rect(0,0,W,H,'#8f8b8f');
    if(state.room==='labyrinthGate'||state.room==='labyrinthVault'){const {x,y}=state.player;ctx.save();ctx.shadowColor='#E5BC00';ctx.shadowBlur=18;rect(x-54,y-54,108,108,'#E5BC00');ctx.restore();}
    const exits=visibleExits();
    if(type==='newMaze')drawNewMaze(state.room);
    else for(const w of roomWalls(state.room)){
      if(['blueGate','labyrinthGate','labyrinthVault'].includes(state.room)){rect(w.x,w.y,w.w,w.h,wallColor(state.room));continue;}
      const elfColor=ELF_HOME_COLORS[ELF_INTERIORS[state.room]];
      rect(w.x+5,w.y+5,w.w,w.h,'#132528');
      rect(w.x,w.y,w.w,w.h,elfColor||(type==='redDungeon'||state.room==='labyrinthApproach'?'#8a5045':'#7b8e79'));
      for(let j=w.x+12;j<w.x+w.w-12;j+=36)rect(j,w.y+7,24,5,elfColor?'#ffffff55':'#abc09b');
    }
    if(type.endsWith('Castle'))drawCastle('#c5a45c',state.gates[type.slice(0,-6)],type);
    if(ELF_INTERIORS[state.room])drawElfInterior();
    if(state.room==='goldInside')drawGoldenPossessions();
    if(ELF_HOME_COLORS[state.room]){
      ctx.save();
      if(houseUpsideDown(state.room)){ctx.translate(ELF_HOUSE.x*2+ELF_HOUSE.w,ELF_HOUSE.y*2+ELF_HOUSE.h);ctx.scale(-1,-1);}
      const houseSprite=sprites.elfHouses[state.room];
      if(houseSprite){ctx.imageSmoothingEnabled=false;ctx.drawImage(houseSprite,ELF_HOUSE.x,ELF_HOUSE.y,ELF_HOUSE.w,ELF_HOUSE.h);}
      else rect(ELF_HOUSE.x,ELF_HOUSE.y,ELF_HOUSE.w,ELF_HOUSE.h,ELF_HOME_COLORS[state.room]);
      const {doorX,doorY,doorW}=ELF_HOUSE,doorH=126;
      rect(doorX,doorY,doorW,doorH,'#8f8b8f');
      const lift=state.gateLift[state.room],gateH=doorH-(doorH-ELF_HOUSE.gateH)*lift,barW=7;
      const gateW=doorW-(doorW-47)*lift,gateX=doorX+(doorW-gateW)/2;
      for(let y=doorY+7;y<doorY+gateH;y+=20)rect(gateX,y,gateW,7,'#000000');
      for(let bar=0;bar<4;bar++)rect(gateX+Math.round(bar*(gateW-barW)/3),doorY,barW,gateH,'#000000');
      ctx.restore();
    }
    const celebratingInside=type==='goldInside'&&state.mode==='winning';
    if(celebratingInside){ctx.save();ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;}
    for(const bridge of Object.values(state.placedBridges))if(bridge.room===state.room)drawPlacedBridge(bridge);
    if(type!=='newMaze')drawDoorFrame(exits,type);
    const roomElapsed=performance.now()-state.roomEnteredAt;
    if((state.room==='homeCrossing'||state.room==='blueVault')&&roomElapsed>=100){
      const color=roomElapsed>=200?heldObjectColor():'#000000';
      ctx.save();
      const line=roomLineWall(state.room);
      rect(line.x,line.y,line.w,line.h,color);
      ctx.restore();
    }
    for(const {x,y} of roomTrees(state.room))drawTree(x,y);
    for(const elf of state.elves.filter(elf=>elf.room===state.room)){
      const residentElf=elfSprite(elf);if(!residentElf)continue;
      ctx.save();ctx.shadowColor='#132528';ctx.shadowBlur=0;ctx.shadowOffsetX=3;ctx.shadowOffsetY=3;
      ctx.imageSmoothingEnabled=false;
      const width=ELF_SIZE*residentElf.width/residentElf.height;
      const x=Math.round(elf.x-width/2),y=Math.round(elf.y-ELF_SIZE/2);
      ctx.drawImage(residentElf,x,y,width,ELF_SIZE);
      ctx.restore();
      if(elf.carrying){const pos=elfCarriedPosition(elf);drawItem(elf.carrying,pos.x,pos.y);}
    }
    if(celebratingInside){for(let i=0;i<16;i++){const x=305+(i*79)%355,y=75+(i*137)%310,size=5+(i%3)*3;rect(x,y,size,size,`hsl(${(state.winTimer*300+i*35)%360} 100% 75%)`);}ctx.restore();}
    for(const [id,item] of Object.entries(state.items))if(item.room===state.room){
      drawJewelProtection(id,item);
      ctx.save();
      if(state.axeFades[id]!==undefined)ctx.globalAlpha=1-Math.max(0,state.axeFades[id]-.4)/.6;
      drawItem(id,item.x,item.y+(item.floating?Math.sin(performance.now()/200+item.x/50)*3:0));
      ctx.restore();
    }
    for(const d of state.dragons)if(d.room===state.room&&d.name===state.bat.carryingDragon)drawDragon(d);
    const b=state.bat;if(b.room===state.room){const up=Math.floor(performance.now()/180)%2===0,sprite=sprites[up?'batUp':'batDown'];if(sprite.complete&&sprite.naturalWidth){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,Math.round(b.x-20),Math.round(b.y-27.5),40,55);}else{ctx.save();ctx.translate(b.x,b.y);rect(-25,-7,18,13,'#111821');rect(7,-7,18,13,'#111821');rect(-8,-12,16,22,'#111821');ctx.restore();}if(b.carrying){const carried=batCarriedPosition(b.carrying);drawItem(b.carrying,carried.x,carried.y);}}
    for(const d of state.dragons)if(d.room===state.room&&d.name!==state.bat.carryingDragon)drawDragon(d);
    const p=state.player,playerSize=21.06,bump=(state.swallowedBy?2:BOUNCE_DISTANCE)*Math.sin(Math.PI*p.bounce.time/BOUNCE_SECONDS),px=p.x+p.bounce.x*bump,py=p.y+p.bounce.y*bump;ctx.save();if(state.mode==='winning'&&(state.room==='gold'||state.room==='goldInside'))ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;ctx.fillStyle=wallColor(state.room);ctx.fillRect(px-playerSize/2,py-playerSize/2,playerSize,playerSize);ctx.restore();if(state.held&&state.held!=='bat'){const pos=isBridge(state.held)?heldBridgePosition():heldPosition();drawItem(state.held,pos.x+px-p.x,pos.y+py-p.y);}
    for(const elf of state.elves.filter(elf=>elf.room===state.room))drawElfEmotions(elf);
    updateObjectTooltip();
    if(state.mode==='paused'){rect(0,0,W,H,'#0b1418aa');label('PAUSED',480,330,52,'#f5d691','center');}
  }
  function mapItemRoom(id,item){
    if(state.usedAxes.has(id))return 'absent';
    const room=state.held===id?state.room:state.bat.carrying===id?state.bat.room:state.placedBridges[id]?.room||itemPosition(id).room;
    return dragonMapRoom[room]||room;
  }
  function mapDragonIcons(room){
    if(hints.hidden)return '';
    return state.dragons.filter(d=>(dragonMapRoom[d.room]||d.room)===room).map(d=>{
      const title=d.name+' — '+rooms[d.room].name+(d.dead?' (slain)':''),src=dragonIconUrls[d.name]?.[d.dead?'dead':'alive'];
      return src?`<img class="dragon-icon${d.dead?' dead':''}" src="${src}" alt="${title}" title="${title}">`:`<b class="dragon-icon-fallback" style="color:${d.color}" title="${title}">◆</b>`;
    }).join('');
  }
  function mapElfIcons(room){
    if(hints.hidden)return '';
    return state.elves.filter(elf=>(dragonMapRoom[elf.room]||elf.room)===room).map(elf=>{
      const title=ELF_NAMES[elf.home]+' — '+rooms[elf.room].name;
      return sprites.elves[elf.home]?`<canvas class="map-elf-icon" data-elf="${elf.home}" width="32" height="32" role="img" aria-label="${title}" title="${title}"></canvas>`:`<span class="map-elf-icon" style="color:${ELF_HOME_COLORS[elf.home]}" title="${title}">●</span>`;
    }).join('');
  }
  function drawMapElfIcons(){
    for(const id of ['map','mazeMap'])for(const icon of $(id).querySelectorAll('.map-elf-icon[data-elf]')){
      const elf=state.elves.find(elf=>elf.home===icon.dataset.elf),sprite=elfSprite(elf),brush=icon.getContext('2d');
      brush.clearRect(0,0,32,32);brush.save();brush.shadowBlur=0;
      brush.imageSmoothingEnabled=true;brush.drawImage(sprite,0,0,32,32);brush.restore();
    }
  }
  function mapItemIcons(room){
    if(hints.hidden)return '';
    return Object.entries(state.items).filter(([itemId,item])=>mapItemRoom(itemId,item)===room).map(([itemId])=>{
      const treasure=itemId==='magnet',symbol=itemInfo[itemId][1];
      return `<span class="map-item-icon${treasure?' map-item-treasure':''}${itemId.endsWith('Key')?' map-item-key':''}${itemId==='blackKey'?' map-item-black-key':''}${isBridge(itemId)?' map-item-bridge':''}"${itemId==='blackKey'?'':` style="color:${treasure?itemInfo.bridge[2]:itemInfo[itemId][2]}"`} title="${itemInfo[itemId][0]}" aria-label="${itemInfo[itemId][0]}">${symbol}</span>`;
    }).join('');
  }
  function refreshHints(){
    for(const id of Object.keys(state.items)){
      const item=state.items[id];let location;
      if(state.usedAxes.has(id))location='Used up';
      else if(state.held===id)location='With you in '+rooms[state.room].name;
      else if(state.bat.carrying===id)location='With the bat in '+rooms[state.bat.room].name;
      else if(item.room.startsWith('elf:'))location='With '+ELF_NAMES[item.room.slice(4)]+' in '+rooms[itemPosition(id).room].name;
      else if(state.placedBridges[id])location=rooms[state.placedBridges[id].room].name+' (placed)';
      else location=item.room==='absent'?'Not in this mode':rooms[item.room]?.name||'Unknown location';
      const node=$('hint'+id[0].toUpperCase()+id.slice(1));if(node&&node.textContent!==location)node.textContent=location;
    }
  }
  function refresh(){
    if(!state)return;
    syncFluteSound();
    document.body.classList.toggle('western-maze',rooms[state.room].type==='newMaze');
    $('roomName').textContent=rooms[state.room].name;
    $('message').textContent=state.message;
    $('jewelProgress').textContent='Jewels in treasury: '+returnedJewelCount()+' / 6';
    $('itemName').textContent=state.held?itemInfo[state.held][0]:'Nothing';
    const icon=$('itemIcon'),id=state.held||'',sprite=spriteUrls[id],iconState=id+(sprite?'sprite':'text');
    if(icon.dataset.sprite!==iconState){icon.dataset.sprite=iconState;icon.textContent=sprite?'':id?itemInfo[id][1]:'□';icon.style.backgroundImage=CROSSING_ITEMS[id]?'':sprite?`url("${sprite}")`:'';icon.style.maskImage=CROSSING_ITEMS[id]?`url("${CROSSING_ITEMS[id].src}")`:'none';icon.style.maskSize='contain';icon.style.maskRepeat='no-repeat';icon.style.maskPosition='center';icon.style.backgroundColor=CROSSING_ITEMS[id]?itemInfo[id][2]:id==='blackKey'||id==='magnet'||id==='bat'?'#b9b7aa':'transparent';icon.style.color=id?itemInfo[id][2]:'#f4e4be';icon.style.fontSize=id==='magnet'?'36px':'';icon.style.width=id==='magnet'?'54px':'';icon.style.height=id==='magnet'?'54px':'';}
    const pauseLabel=state.mode==='paused'?'RESUME':'PAUSE';
    $('pauseBtn').textContent=pauseLabel;$('mobilePauseBtn').textContent=pauseLabel;
    const dropLabel=BRIDGE_IDS.some(exposedBridgeLeg)?'PICK UP BRIDGE':carriedBridgeId()?'PLACE BRIDGE':'BUTTON';
    $('dropBtn').textContent=dropLabel;$('mobileDropBtn').textContent=dropLabel;
    const map=$('map'),mapState=[state.room,hints.hidden,!!dragonIconUrls.Yorgle,Object.keys(houseIconUrls).join(','),Object.values(sprites.elfEmotions).map(set=>Object.keys(set).join(',')).join(';')+Object.keys(sprites.elvesKO).join(',')+Object.keys(sprites.elvesSurprised).join(','),...state.elves.map(elf=>elf.home+':'+elf.room+':'+(elf.stunTimer>0)+':'+(elf.surpriseTimer>0)+':'+elf.emotionalState.sentiment+':'+elf.emotionalState.passion),[...state.seen].join(','),...state.dragons.map(d=>d.room+':'+d.dead),...Object.entries(state.items).map(([id,item])=>id+':'+mapItemRoom(id,item))].join('|');
    map.dataset.mode=state.questMode;
    const mapColumns=grid[0].length;
    map.style.gridTemplateColumns=`repeat(${mapColumns},1fr)`;
    if(map.dataset.state!==mapState){
      map.dataset.state=mapState;
      map.innerHTML=grid.flatMap(row=>row.map(id=>{
        if(!id)return '<span class="empty" aria-hidden="true"></span>';
        const r=rooms[id],home=!!ELF_HOME_COLORS[id],current=id===state.room||ELF_INTERIORS[state.room]===id||dragonMapRoom[state.room]===id,revealed=!hints.hidden||state.seen.has(id)||(home&&state.seen.has(id+'Inside'))||current;
        const symbol=home&&revealed?(houseIconUrls[id]?`<img class="map-house-icon" style="${houseUpsideDown(id)?'transform:rotate(180deg)':''}" src="${houseIconUrls[id]}" alt="${r.name}">`:`<span class="map-castle-icon" style="color:${ELF_HOME_COLORS[id]}">♜</span>`)+(current?'<span class="map-player-marker">◆</span>':''):revealed&&r.type.endsWith('Castle')?'<span class="map-castle-icon">♜</span>':current?'◆':'';
        const icons=mapDragonIcons(id),items=mapItemIcons(id),elves=mapElfIcons(id);
        const castleClass=['gold'].includes(id)?' castle-'+id:'';
        return `<span data-room="${id}" class="${current?'current':revealed?'':'unseen'}${castleClass}${revealed&&r.type==='maze'&&!home?' maze-room':''}${icons?' has-dragon':''}" title="${revealed?r.name:'Unexplored'}">${symbol}${icons?`<span class="dragon-icons">${icons}</span>`:''}${elves?`<span class="map-elf-icons">${elves}</span>`:''}${items?`<span class="map-item-icons">${items}</span>`:''}</span>`;
      })).join('')+(hints.hidden?'':'<b class="map-bat" id="mapBat" role="img" aria-label="Bat">w</b>');
    }
    const mazeMap=$('mazeMap'),mazeState=mapState;
    if(mazeMap.dataset.state!==mazeState){
      mazeMap.dataset.state=mazeState;
      mazeMap.innerHTML=mazeMapRooms.map(id=>{
        if(!id)return '<span class="empty" aria-hidden="true"></span>';
        const revealed=!hints.hidden||state.seen.has(id),current=state.room===id||dragonMapRoom[state.room]===id;
        const icons=mapDragonIcons(id),items=mapItemIcons(id),elves=mapElfIcons(id);
        return `<span data-room="${id}" class="${current?'current':revealed?'':'unseen'}${revealed&&rooms[id].type==='newMaze'?' maze-room':''}${icons?' has-dragon':''}" title="${revealed?rooms[id].name:'Unexplored'}">${id==='black'&&revealed?'<span class="map-castle-icon" style="color:#000">♜</span>':''}${current?'◆':''}${icons?`<span class="dragon-icons">${icons}</span>`:''}${elves?`<span class="map-elf-icons">${elves}</span>`:''}${items?`<span class="map-item-icons">${items}</span>`:''}</span>`;
      }).join('')+(hints.hidden?'':'<b class="map-bat" id="mazeMapBat" role="img" aria-label="Bat">w</b>');
    }
    const bat=state.bat,batRoom=dragonMapRoom[bat.room]||bat.room,batCell=grid.flat().indexOf(batRoom),batIcon=$('mapBat');
    if(!hints.hidden)drawMapElfIcons();
    if(batIcon)batIcon.style.display=batCell>=0?'grid':'none';
    if(batCell>=0&&batIcon&&map.clientWidth>0){
      const cellWidth=(map.clientWidth-3*(mapColumns-1))/mapColumns,cellHeight=cellWidth/1.25,mapHeight=cellHeight*grid.length+3*(grid.length-1);
      const x=(batCell%mapColumns)*(cellWidth+3)+(bat.x/W)*cellWidth,y=Math.floor(batCell/mapColumns)*(cellHeight+3)+(bat.y/H)*cellHeight;
      batIcon.style.left=Math.max(8,Math.min(map.clientWidth-8,x))+'px';
      batIcon.style.top=Math.max(10,Math.min(mapHeight-10,y))+'px';
      batIcon.title='Bat — '+(state.held==='bat'?'with you in ':'')+rooms[bat.room].name;
    }
    const mazeBatCell=mazeMapRooms.indexOf(batRoom),mazeBatIcon=$('mazeMapBat');
    if(mazeBatIcon)mazeBatIcon.style.display=mazeBatCell>=0?'grid':'none';
    if(mazeBatCell>=0&&mazeBatIcon&&mazeMap.clientWidth>0){
      const cellWidth=(mazeMap.clientWidth-12)/5,cellHeight=cellWidth/1.25;
      const cellX=(mazeBatCell%2)*(cellWidth+3),cellY=Math.floor(mazeBatCell/2)*(cellHeight+3);
      const x=cellX+(bat.x/W)*cellWidth,y=cellY+(bat.y/H)*cellHeight;
      mazeBatIcon.style.left=Math.max(cellX+6,Math.min(cellX+cellWidth-6,x))+'px';
      mazeBatIcon.style.top=Math.max(cellY+6,Math.min(cellY+cellHeight-6,y))+'px';
      mazeBatIcon.title='Bat — '+(state.held==='bat'?'with you in ':'')+rooms[bat.room].name;
    }
    if(!hints.hidden)refreshHints();
  }
  function frame(time){const dt=Math.min(.05,(time-last)/1000||0);last=time;update(dt);draw();requestAnimationFrame(frame);}
  function newQuest(){fadeToken++;clearTimeout(fadeTimer);transitionScreen.hidden=true;transitionScreen.classList.remove('fading');winSound.pause();winSound.currentTime=0;initial('gold');state.mode='playing';hideOverlay();refresh();canvas.focus();}
  function start(){
    if(state.mode!=='title')return;
    const token=++fadeToken;
    transitionScreen.getContext('2d').drawImage(canvas,0,0);
    transitionScreen.classList.remove('fading');transitionScreen.hidden=false;
    overlay.classList.add('transitioning');
    winSound.pause();winSound.currentTime=0;initial('gold');state.mode='playing';refresh();
    requestAnimationFrame(()=>{
      if(token!==fadeToken)return;
      transitionScreen.classList.add('fading');overlay.classList.add('fading');
      fadeTimer=setTimeout(()=>{if(token!==fadeToken)return;transitionScreen.hidden=true;transitionScreen.classList.remove('fading');hideOverlay();canvas.focus();},100);
    });
  }
  function pause(){if(state.mode==='playing'){state.mode='paused';showOverlay('QUEST PAUSED','The kingdom will wait until you return.','RESUME');}else if(state.mode==='paused'){state.mode='playing';hideOverlay();}refresh();}
  function togglePanels(){document.body.classList.toggle('playfield-only');}
  const keyDir={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  document.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('keydown',e=>{if(behaviorDialog.open)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(k==='Tab'){e.preventDefault();togglePanels();}else if(k==='Enter'&&state.mode==='lost'){e.preventDefault();newQuest();}else if(keyDir[k]){keys.add(keyDir[k]);e.preventDefault();}else if(k===' '&&state.mode!=='title'){useAction();e.preventDefault();}else if(k==='m'){magnet();}else if(k==='p'){pause();}else if(k==='r'){newQuest();}});
  window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyDir[k])keys.delete(keyDir[k]);});window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-dir]').forEach(button=>{const d=button.dataset.dir;button.addEventListener('pointerdown',e=>{keys.add(d);button.setPointerCapture(e.pointerId);e.preventDefault();});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(d));});
  for(const id of ['dropBtn','mobileDropBtn'])$(id).onclick=useAction;
  $('mobileDropBtn').addEventListener('touchstart',event=>{event.preventDefault();useAction();},{passive:false});
  for(const id of ['pauseBtn','mobilePauseBtn'])$(id).onclick=pause;
  for(const id of ['restartBtn','mobileRestartBtn'])$(id).onclick=newQuest;
  $('hardModeBtn').onclick=()=>start();$('overlayBtn').onclick=()=>state.mode==='paused'?pause():newQuest();
  hintsToggle.addEventListener('click',event=>{event.preventDefault();hints.hidden=!hints.hidden;hintsToggle.textContent=hints.hidden?'Show hints':'Hide hints';hintsToggle.setAttribute('aria-expanded',String(!hints.hidden));refresh();});
  emotionsToggle.onclick=event=>{event.preventDefault();emotionsVisible=!emotionsVisible;emotionsToggle.textContent=emotionsVisible?'Hide emotions':'Show emotions';emotionsToggle.setAttribute('aria-expanded',String(emotionsVisible));};
  behaviorToggle.onclick=event=>{event.preventDefault();keys.clear();behaviorDialog.showModal();syncFluteSound();};
  $('behaviorClose').onclick=()=>behaviorDialog.close();
  behaviorDialog.addEventListener('close',()=>{keys.clear();behaviorToggle.focus();syncFluteSound();});
  for(const id of ['map','mazeMap'])$(id).addEventListener('dblclick',event=>{
    const cell=event.target.closest('[data-room]');if(!cell||!$(id).contains(cell))return;
    event.preventDefault();teleportToRoom(cell.dataset.room);
  });
  document.body.classList.add('playfield-only');newQuest();requestAnimationFrame(frame);
})();
