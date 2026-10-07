(() => {
  'use strict';
  const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
  const titleCursorCtx=document.getElementById('titleCursor').getContext('2d');
  const $=id=>document.getElementById(id);
  const W=960,H=640, SPEED=313.5, SWALLOWED_SPEED=49.875, BOUNCE_SECONDS=.12, BOUNCE_DISTANCE=6, CASTLE_Y=100, CASTLE_H=380, CASTLE_SHIFT=CASTLE_Y-60, VICTORY_MESSAGE_DELAY=2;
  const BRIDGE_SCALE=1.3, BRIDGE_WIDTH=162, BRIDGE_HEIGHT=144, BRIDGE_HOLD_DISTANCE=Math.round(52*BRIDGE_SCALE);
  const MAZE_BRIDGE_X=340,MAZE_BRIDGE_Y=427,MAZE_BRIDGE_WIDTH=BRIDGE_WIDTH,MAZE_BRIDGE_HEIGHT=BRIDGE_HEIGHT,MAZE_BRIDGE_LEG_OFFSET=Math.round(MAZE_BRIDGE_WIDTH*65/180);
  const GAP_WIDTH=BRIDGE_WIDTH, GAP_HEIGHT=BRIDGE_HEIGHT, GAP_X=(W-GAP_WIDTH)/2, GAP_Y=322.5-GAP_HEIGHT/2, BRIDGE_Y=322.5;
  const ENTRY_WALL=40,ENTRY_TOP=40,ENTRY_BOTTOM=600,ENTRY_OPEN_LEFT=386,ENTRY_OPEN_RIGHT=574;
  const TREE_SCALE=.8,TREE_PARTS=[[-12,-58,24,24],[-35,-34,70,24],[-12,-10,24,22],[-55,12,110,24],[-12,36,24,24]];
  const BLACK_APPROACH_TREES=[{x:275,y:315},{x:600,y:470}];
  const BLACK_APPROACH_WALLS=[{x:180,y:100,w:50,h:145},{x:685,y:115,w:145,h:45},{x:150,y:465,w:150,h:45},{x:700,y:425,w:50,h:125}];
  const chompSound=new Audio('assets/chomp.mp3');
  const dragonDeathSound=new Audio('assets/slay.mp3');
  const playerDeathSound=new Audio('assets/death.mp3');
  const pickupSound=new Audio('assets/pick-up.mp3');
  const dropSound=new Audio('assets/drop.mp3');
  const winSound=new Audio('assets/win-good.mp3');
  const artwork=new Image(),sprites={},spriteUrls={bat:'bat_down.png'},dragonIconUrls={};let castleMask=null;
  sprites.batUp=new Image();sprites.batDown=new Image();
  sprites.batUp.onload=sprites.batDown.onload=()=>{if(state)refresh();};
  sprites.batUp.src='bat_up.png';sprites.batDown.src='bat_down.png';
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
    sprites.whiteCastle=cut(165,0,163,149,null,[255,255,255]);
    sprites.whiteCastleOpen=cut(165,0,163,149,null,[255,255,255],true);
    sprites.blackCastle=cut(165,0,163,149,null,[0,0,0]);
    sprites.blackCastleOpen=cut(165,0,163,149,null,[0,0,0],true);
    for(const [name,x] of [['Yorgle',2],['Grundle',56],['Rhindle',110]]){
      sprites[name+'Pursue']=cut(x,56,16,44);
      sprites[name+'Attack']=cut(x+18,56,16,44);
      sprites[name+'Dead']=cut(x+36,56,16,44);
      dragonIconUrls[name]={alive:sprites[name+'Pursue'].toDataURL(),dead:sprites[name+'Dead'].toDataURL()};
    }
    for(const pose of ['Pursue','Attack','Dead']){
      const source=sprites['Rhindle'+pose],piece=document.createElement('canvas');
      piece.width=source.width;piece.height=source.height;
      const brush=piece.getContext('2d');brush.drawImage(source,0,0);
      const pixels=brush.getImageData(0,0,piece.width,piece.height);
      for(let i=0;i<pixels.data.length;i+=4){
        if(pixels.data[i+3]===0)continue;
        const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
        if(r<45&&g<45&&b<45)continue;
        pixels.data[i]=122;pixels.data[i+1]=41;pixels.data[i+2]=123;
      }
      brush.putImageData(pixels,0,0);sprites['Vesper'+pose]=piece;
    }
    dragonIconUrls.Vesper={alive:sprites.VesperPursue.toDataURL(),dead:sprites.VesperDead.toDataURL()};
    sprites.goldKey=cut(153,128,16,6);
    sprites.whiteKey=cut(153,128,16,6,null,[236,236,236]);
    sprites.blackKey=cut(153,128,16,6,null,[0,0,0]);
    sprites.sword=cut(153,153,16,10,'yellow');
    sprites.bridge=cut(82,152,70,51,'purple');sprites.bridge2=sprites.bridge;
    sprites.chalice=cut(153,183,16,18);
    for(const id of ['goldKey','whiteKey','blackKey','sword','bridge','bridge2','chalice'])spriteUrls[id]=sprites[id].toDataURL();
    if(state)refresh();
  };
  artwork.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWkAAADSCAIAAAAHY6YbAAAABGdBTUEAALGPC/xhBQAAD4tJREFUeNrtnTGu7LgRRd+6HBkOBs6cOJwleB/OZwWO6QUYcDSR4XjWMXsYG/MBu6dFXt4qUhLFPhfEx/tPokTxdZ1mkSXWV0EIobi+6AKEEOxACMEOdIJ++un31fKU8+m3xPmtkwc7v8KO7//5/X9Lq8K3o69l/Mz/t+ZX/e9n5/x1qRxs2zXPAjtgB+xYlB1pZMAO2PFgdmg7938fvcKbIYl//6dX1rxa3duh488tQlWvfLRqUfft59c2v1WvXrD1INgA7IAdE9hR/dc5JL7qxaVa50xsknM+NgA7dvBZRs432VH99vYNtYoMYa7ChgV6NEemsAMbgB2wI8+OLkeEC1B1WFo+yNFncdyKBDVa7ek2GxuAHfuwwzkzNFf6oDnOp9wLdtBvsGMHez5pNAE76LfHsCPHgvUJsr1gB+yAHQh20G8PjA3LMcJnR2thwlmG6DoFvtewctwq7KDfYEfHaKORl12+wA7YATtOjA1rRXy1ip4lDVGjFZop1l9by7dFhn50YzpgB+yAHc9ghxPxWSJRniUeEnpNjBY2ADs29Flu1PXs0J4R7IAdsOMZ7Gj5LMLXaPkvwvXwX3jbb/QBO+i3aaZaPkD7DR+m28BqhX5bv9++AAfsgB30G+xA2AD9BjsQNkC/PYgduk16gfZvf/9TtXw7+q+//K5avh39wx//XS3fjv7w3Y/V8ja9+qZvR//6jz9XC+zABug32AE7sAH6DXbADmwAdkztt1+Cgh2wA3bQb7ADdmAD9BvsgB3YAOyAHbADdsAO2AE7YAfsgB1pdiDYATtgB+xAsIN+gx0IdtBvsANhA7ADdiDYATtgB4IdsAN2hNhxXN0czIGSk3PZ1jkjTcrVTd9x4u2il4IdsOOUcYe/ze+N7Li97ngGhkRFZ2dm2AE7VmGHQEnraHXz4aol6A2HxXXE73Utsa2xeDpxVHfR4GN2O8FsA+yAHfeMO3R6pG5mg5ZFtb4/u+kRSnvvcpEkQbc81CR9QsuM048ZOuo4m7ADdtzAjpYBOynXprMjbfPdbJUj7DjjMaPsYNwBO66RxY7W2FjkRhFuQmIwX8VW9ZrmwP7tRrp5euyTcDqcx3SOOm3ABmDHFew48TYkOsAGYAfsQLADdtBvsAN2wA76DXYgbIB++2R2jIRdMrGCDdBvz2PHLLuFHdgA/Tax376CyrDjban1bYEzEQDqH6o2WiwMt5rkr1bCDtgBO+awww++7AaVVs8vMiZKx2WKVpV4bCXsgB2w4052aHseZ0eVIIP0QU+xAcpTfZZSCxVthWyWXnB3Md5M02GpYlJD+1kQBHbAjivYgWAHBXbADgQ7YMeq7FhzWutVr6mn1tRrgivYQYEdsAN2UGAHBNmIIFgX7IAdsAN2UJZnhxO0czx6ZajPMbG2QxCn1lw6aEYcjzq1YAcFdsAO2EHZhR3RkOHrA41f7d8nSLTWLGr4BInWgh0U2AE7YAflOexwmuJT4PWcWexwrN2nwOs5s9jhWLtPgddzYAcFdsAO2EHZa++fuY0brxX1NaL2P14r6mtE7X+8FuyAHbADdsAOytP2HIw2bhZxRnyZuXOr42u6UQrMIg7sgB2wA3bADsoz9zqOzo/6tWbFkkXnR/1as2LJovOjfi3YQYEdsAN2UD6JHa2jI+zIeS7RoyPsyHku0aMj7KjWxbpgB+yAHbCDsiQ7/GixuTOsvv/iR4vNnWH1/Rc/WmzuDKvwX7Au2AE7YAfsoCzGjpEm+uePdMdIhJh//kg02kiEmH9+IhoN64IdsAN2wA7KMuwYaaJfy3nX7ozIdL+W867dGZHpfi3nXTvmSmEH7IAdsIPynHfh/Nit6IONRH/5dBghzkj0l0+HEeKk38fHumAH7IAdsIOyGDuiMeM5dozMj0ZjxnPsGJkfjcaM59iRmIvFumAH7IAdsIMCO4yOWI0dx7usxg72KIQFsAN2wA7Y8Ux2+Hsg38UOfw/ku9jh74EMOyiwA3bADsocdhzTIPjJECpm/9u6uUt95T4i0Q/ZeOS7b8+52LDxyHffnnOxYXMj32HHE8cdr0YOO2AH7KAk2aFR8par6e3n6jlnvQuX+6iNvzU38j5bLsZs/C7XZFc4iRew40HjjuO/Rzq0/ntECeyAHbDjE9lRPfNSdhw/OrkP3NwztYWfV2tWrsnzak3nBex4HDuOLsw9PgvsgB2wY5s12pEp1cBcadSzGHls52qODY+stvrejePvRGc0c/OjelWYuVLY0ZpMhR2wA3bAjlVjw/yMCiOPF83bEJ3jHPc4onkbonOc4x5HLm8D7IAdsAN2wA7YMTrNkfZrhvY6HnnUkY4biS6PsiPn9YxEl0fZQWwY7GgtzcIO2AE7YMdvpj+PQaVvv9cQEeu1/jzridOwaANhveuwoxUA1g0nbVHAjEmFHQh27MOOlsG3wklD1IAdCHZs67No/6XqiVSjTl/PFy/awQ4EOz53jXZ6nBjsQLCD+I4xdiQ2JhIDm3ODYbM7oJhPlGj8+FZOpbY7Q3U+XN9oSktgB+wIjzt8s+wuAp3b7pSFmE+UvvJcduQuDjtgxxLs6JqT3q1IL0c7C8tiENSa+6n+bC56twZW3VmlxKK66JAWO46z6H5LcjTBerdkx5Svlv64o7tQ7OxW5CwjmbcL3Td0cTE13aqeaHz3ItpnmdgS2MG44zp2dH2WxG5F3WgWZ0olwQ7ngiPs8KnRndFwqBFqCezYaY22+k3j+BCDL+l/hexHuAl65Cz8iNZovDQiZ02fpTuSF4veuv3VS6UX1UM+S5cafktgxwaxYdHvFXNY8IA12rPnU517XTOnu8QIE3Z8HjtyLsXS7Dh7R6O77kV8B+Uun6XIiFIx8/jIcQeCHZR95koRgh2wYz47Mi/qzsheF73LspMOsIMCO4oft34eO3L8AivPZYee1XK0x/Mux45o4KNYgi2/XWd1FiNbex9Vr6Nng0JJbsAH7HjE84a+htPvZA2NO0KBj91aiShSP/+dGUwp6gKOndjh/ww7JrMjEfiYi7w0LXyEHcK1mRt5CTtgx2XsMN9patmX71Vkxh2JwEdnbVlfxxndtB5P391xuIAIPsuzxh3dvQIFKM2Rwfy5UgQ7YMdS7DB3Ho16FbAD4bNs7rOU9iamZeB1KtiBYMc+7FhNsAPhs8COS9iRC44gjAJ2wA7YATtgBz4L7ChD4ZWwA3bAjhvZMbI7N+xAeQrgs+zEjusJMsFn0X8S/8+GYAfs6MZ36E059TadsAPlP/evZ+KzbMCO4r0CsqjPAjtgB+y4bM/BEnyhFHYg185bdMBn+QR2FJnY4HSfxe/0r6Awb9gBO3aO71iTHaN5aO7blNC5+LJgxWeBHRY79DyoJki0Vs78btnu9Dx2XOmdwg7Y8YnsKEZmGieXdWnnsiu9zYeKzINXPUHvk1iMPRMn+no/H4TPAjsms6P1cXc8l1NnSf3p5S4FtP2XbGLt3EZn6ZvCDtgRHeF+HDucEYHz+1Y/RjdQcagxnus7+if/2dDrmfgs2487rovvWHm1VWyt3Bo7HB0HcY5wf/T1S3BLle4e0SWbgBp27M0OEVFqHnJc7A3ZccvyR+nlhVlKmg74LDuxQ4+yy0CWgiQ7Llgr3ZIvsAN2XBkb5kz2RdmR+MDDDoTP8jx2FJlgQKQB0DnYYkNy2IFgB2u0o3Olz2XHBVmwctdZp69yYb74LLCDccdk2x5Pow07YAfsuMjCE0tQRSaLK3I51szd7aTRrhLHDFf1R92+5ezKDnyWG9jxiNHB3CWoUGRnOsetHzmWi16DHbADdsR8hPElKHNtXFcPEcpJ3O00xoysF2G+THijT2RHsVenhGeh6+qNITUXdPxrNWDUf8UOdiDYgRCCHQgh2IEQQrDjc7X+LD2CHXc0el46rB+++zFUzn60We2BHQh2JGnyseyAGgh2/AYNej+eblBWa1USdiC0OTuqRHiDy7FKN1nWTuzYKWYRwY7r2FG8vdRhB+xA+CydgMu3oNIqQfBZEPqIccf06rADIdgBOyAIgh13azV2RK8DOxDsgB1X3Bch2AE7EIIdsCN739xunQjBDtgBOxDsgB2R+47vFY4Q7IAdeXZ8IaR3zAYT27BDMyJKEIYnSH8w+HzAjt5HxM51fAFucre4JgfgsbfTVzZzA5n3mps1EXZszo6Rc9LsuP6r7xpwRJM8l17Gr9DtQv+9gOmwA3YEfBa96UErO5/IQaNHRtUrdHMDtq4s8jxVMwG2Gla8zR+KkZhe59wQ3e6zQ787qjtBVIEdsGOUHc43oXOCGLSHvmz1lc08Xt3RVgsiTuofp+taFxEg7ja41bxWmwMXBxOwIz3uyLGjeOmsTHZ002U6XPDZ8VarO7VUvZrGmQkCx7y7GBJjyS7lYQfscGfvop9m//vZH8uYTn40fWeaHWa/5UYN4+wIjZLMKrADduTZ0f3yrE46tOYyur63tm1RS+PAvH50AGWmLtXG6Q8QooM4PaPU7V7YATtWj+8gumRBwQ7YATvQhD8NfyHYgfUi2AE7YAeCHbDj3r1/dJT0vYipv5o10JJQDGj0xcLru0gsA8EO2PFgdkwMEj/jgtMD3u9ix0l3hx0bsuOXXzXrTB3gULxl2uOZpR3oqUO8uuxwlh6LF8MejZLqPm+RMa+6Pa3rdx/n2KuwA3bcz46R97X8QCkR+tXyWcZfJOsmITSrHK23++ZLa7yQ68CTPBfYATti7Ai9VfF2fuKjr2cT/FDIUMN8duggdD8KNsqO6uBO3xd2wI7b2JGIsIy++um/Tj7Oju4zmsmPnfmX6ewIvYMHO2BHjB2aC845DjtK/MWqYgdoaxJdPN8hqug5COctGHN3AtEh3fmOwv4dsOMudjxL05dgEte5fXe1a3oYduzDjiMdWppuLRuzI7FOsXdYHeyAHR9tAAh2wA7YgWAH7NiIHX4WmIkzC6G9iC/wmLYENOzYlh2aIKt9rKPs6OyCdzc7LsAN7FidEauxI9qeiewIRUCX2oppt+7bffUCZ3XHQL0LWfVBSm9D49IOWnNaa6ZQgR2wY8X25KjR+jJPhHsnwsASwV0hz+XYvO6VrY1/7fi09FgJdsCOB7PDj7zWYeansqPILTy77GidVoxN2FuNFCH2sAN2fNC4wzdyP4PJXHZ0v+dDYfLRLeOdN2hhB+z4IHaUeGKxaPR0aE6heHug+7Mz4qGKtwm7P9+BzwI7lmvP9Wu00/fyWdZaHndx2AE7NmfHynYCOGDHJ/osn/axRrADbT5QR7AD7fwRQagq2IEQGvh2oQsQQrADIQQ7EEKwAyEEOxBCqPwHLCwuGT4f/xcAAAAASUVORK5CYII=';
  const grid=[
    ['west','catacombs','gold','road','blueGate'],
    ['white','stone','crossroads','blueMaze','blueVault'],
    ['redTrail','redRuins','south','greyApproach','blackApproach'],
    [null,null,null,null,'black']
  ];
  const mazeMapRooms=['mazeTL','mazeTR','mazeML','mazeMR',null,'mazeBR'];
  const dragonMapRoom={goldInside:'gold',whiteInside:'white',redDungeon:'white',blackInside:'black',greyDungeon:'black'};
  const rooms={
    entry:{name:'THE ENTRY ROOM',type:'entry'},
    west:{name:'WESTERN MEADOW',type:'field'},catacombs:{name:'THE CATACOMBS',type:'dark'},gold:{name:'GOLDEN CASTLE',type:'goldCastle'},road:{name:'OLD KINGDOM ROAD',type:'field'},blueGate:{name:'BLUE LABYRINTH GATE',type:'maze'},
    white:{name:'WHITE CASTLE',type:'whiteCastle'},stone:{name:'STONE PASSAGE',type:'field'},crossroads:{name:'THE CROSSROADS',type:'field'},blueMaze:{name:'BLUE LABYRINTH',type:'maze'},blueVault:{name:'BLUE VAULT',type:'maze'},
    redTrail:{name:'RED TRAIL',type:'field'},redRuins:{name:'RED RUINS',type:'maze'},south:{name:'SOUTHERN WILDS',type:'field'},greyApproach:{name:'GREY APPROACH',type:'dark'},blackApproach:{name:'BLACK CASTLE APPROACH',type:'field'},black:{name:'BLACK CASTLE',type:'blackCastle'},
    whiteInside:{name:'WHITE CASTLE HALL',type:'whiteInside'},redDungeon:{name:'WHITE DUNGEON',type:'redDungeon'},blackInside:{name:'BLACK CASTLE HALL',type:'blackInside'},greyDungeon:{name:'GREY DUNGEON',type:'greyDungeon'},goldInside:{name:'GOLDEN CASTLE HALL',type:'goldInside'},
    mazeTL:{name:'WESTERN MAZE · UPPER GALLERY',type:'newMaze'},mazeTR:{name:'WESTERN MAZE · UPPER CROSSING',type:'newMaze'},
    mazeML:{name:'WESTERN MAZE · LOWER GALLERY',type:'newMaze'},mazeMR:{name:'WESTERN MAZE · LOWER CROSSING',type:'newMaze'},
    mazeBR:{name:'WESTERN MAZE · INNER CHAMBER',type:'newMaze'}
  };
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
  addMazePortal('Z','west','up',480,'mazeML','down',480,190);
  addMazePortal('G','mazeTR','up',480,'black','down',480,190);
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
  for(const [label,col] of [['T',8.5],['U',12.5],['V',19.5],['W',26.5],['X',30.5]])addMazePortal(label,'mazeMR','down',mazeX(col),'mazeBR','up');
  for(const [label,y] of [['1',upperMazeSide],['2',middleMazeSide],['3',lowerMazeSide]])addMazePortal(label,'mazeML','right',y,'mazeMR','left');
  function mazePortal(room,edge,at){return mazePortals.find(p=>p.from===room&&p.edge===edge&&Math.abs(p.at-at)<p.width/2);}
  function mazeEntry(p){return {x:p.entryEdge==='left'?30:p.entryEdge==='right'?W-30:p.entryAt,y:p.entryEdge==='up'?(mazeTiles[p.to]?30:55):p.entryEdge==='down'?(mazeTiles[p.to]?H-30:H-55):p.entryAt};}
  function mazeDoor(p){return {to:p.to,exit:{x:p.edge==='left'?35:p.edge==='right'?W-35:p.at,y:p.edge==='up'?35:p.edge==='down'?H-35:p.at},entry:mazeEntry(p)};}
  function mazeFloor(room,x,y){if(bridgeCovers(room,x,y))return true;const col=Math.max(0,Math.min(MAZE_COLS-1,Math.floor(x/MAZE_CELL_W))),row=Math.max(0,Math.min(MAZE_ROWS-1,Math.floor(y/MAZE_CELL_H)));return mazeTiles[room][row][col];}
  function mazeBlocked(room,x,y){
    if(x<-40||x>W+40||y<-40||y>H+40)return true;
    for(const sx of [-9,9])for(const sy of [-9,9])if(!mazeFloor(room,x+sx,y+sy))return true;
    return x<0&&!mazePortal(room,'left',y)||x>W&&!mazePortal(room,'right',y)||y<0&&!mazePortal(room,'up',x)||y>H&&!mazePortal(room,'down',x);
  }
  const itemInfo={whiteKey:['White key','⚿','#ffffff'],goldKey:['Gold key','⚿','#f6cc61'],blackKey:['Black key','⚿','#a9a8c9'],bridge:['Bridge','||','#d9b576'],bridge2:['Bridge','||','#d9b576'],sword:['Sword','⚔','#d9e8ef'],magnet:['Magnet','∩','#080808'],chalice:['Enchanted chalice','♛','#f7d86a'],bat:['Bat','✦','#dce0d0']};
  const itemStarts={whiteKey:['blueVault',730,320],goldKey:['catacombs',700,220],blackKey:['redDungeon',480,155],bridge:['redTrail',670,430],bridge2:['placed',MAZE_BRIDGE_X,MAZE_BRIDGE_Y],sword:['goldInside',250,330],magnet:['road',700,440],chalice:['greyDungeon',680,260]};
  const dragonStarts=[['Yorgle','#e7c859','blueMaze',850,320,105],['Grundle','#7ac475','white',730,320,88],['Rhindle','#e97568','greyDungeon',480,55,133],['Vesper','#7A297B','redTrail',925,320,165,true]];
  const dir={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  let state,keys=new Set(),last=0,moveDelay=0,noticeTimer=0,batTimer=0,magnetPulse=0;
  const overlay=$('overlay'),transitionScreen=$('transitionScreen'),hints=$('hints'),hintsToggle=$('hintsToggle');
  let fadeTimer=0,fadeToken=0;
  function createDragon([name,color,room,x,y,speed,stalker]){return {name,color,room,x,y,speed,stalker:!!stalker,dead:false,biting:false,biteTimer:0,follow:[],escape:null,path:[],pathTimer:0};}
  function randomWildsTrees(){return [[135,285,125,195],[675,825,125,195],[135,285,445,515],[675,825,445,515]].map(([minX,maxX,minY,maxY])=>({x:Math.round(minX+Math.random()*(maxX-minX)),y:Math.round(minY+Math.random()*(maxY-minY))}));}
  function roomTrees(room){return room==='south'?state.trees:room==='blackApproach'?BLACK_APPROACH_TREES:[];}
  function initial(room='entry'){
    const batRooms=grid.flat().filter(Boolean),batRoom=batRooms[Math.floor(Math.random()*batRooms.length)];
    state={room,player:{x:480,y:room==='entry'?470:530,face:'up',contact:'',bounce:{x:0,y:0,time:BOUNCE_SECONDS}},held:null,heldSide:'up',pickupDelay:0,items:Object.fromEntries(Object.entries(itemStarts).map(([id,[itemRoom,x,y]])=>[id,{room:itemRoom,x,y}])),gates:{gold:false,white:false,black:false},gateLatched:{gold:false,white:false,black:false},gateLift:{gold:0,white:0,black:0},bridgePlaced:false,dungeonBridgeId:null,mazeBridgeId:'bridge2',dragons:dragonStarts.filter(([name])=>name!=='Vesper').map(createDragon),gameTime:0,bat:{room:batRoom,x:70+Math.random()*(W-140),y:70+Math.random()*(H-140),vx:.8,vy:.6,carrying:null,carryingDragon:null,pickupCooldown:0,sightCooldown:1,chaseTimer:0},seen:new Set(room==='entry'?[]:['gold']),swallowedBy:null,winTimer:0,mode:'title',message:'Find the chalice. Bring it home.'};
    state.trees=randomWildsTrees();
    keys.clear();moveDelay=0;batTimer=0;magnetPulse=0;refresh();
  }
  function say(t){state.message=t;noticeTimer=4;refresh();}
  function showOverlay(title,description,button){$('overlayTitle').textContent=title;$('overlayText').textContent=description;$('overlayBtn').textContent=button;overlay.classList.toggle('game-over',state.mode==='lost');overlay.classList.toggle('title',state.mode==='title');overlay.hidden=false;}
  function hideOverlay(){overlay.hidden=true;overlay.classList.remove('game-over','title','fading','transitioning');}
  function sideTouched(p,item){const dx=item.x-p.x,dy=item.y-p.y;if(Math.abs(dx)<1&&Math.abs(dy)<1)return p.face;return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
  function heldPosition(distance=35){const p=state.player,d=dir[state.heldSide];return {x:p.x+d.x*distance,y:p.y+d.y*distance};}
  function hasCarriedItem(id){return state.held===id||state.held==='bat'&&state.bat.carrying===id;}
  function isBridge(id){return id==='bridge'||id==='bridge2';}
  function bridgeDimensions(){return {width:BRIDGE_WIDTH,height:BRIDGE_HEIGHT};}
  function touchesLooseItem(id,item,p){return isBridge(id)?Math.abs(item.x-p.x)<BRIDGE_WIDTH/2+15&&Math.abs(item.y-p.y)<BRIDGE_HEIGHT/2+15:Math.hypot(item.x-p.x,item.y-p.y)<32;}
  function carriedBridgeId(){return isBridge(state.held)?state.held:state.held==='bat'&&isBridge(state.bat.carrying)?state.bat.carrying:null;}
  function isChalice(id){return id==='chalice';}
  function batCarriedPosition(id){
    const b=state.bat;
    if(state.held==='bat'){syncHeldBat();const side=dir[state.heldSide],distance=isBridge(id)?BRIDGE_HOLD_DISTANCE:35;return {room:b.room,x:b.x+side.x*distance,y:b.y+side.y*distance};}
    return {room:b.room,x:b.x,y:b.y+(isBridge(id)?Math.round(55*BRIDGE_SCALE):39)};
  }
  function itemPosition(id){
    if(state.held===id)return {room:state.room,...heldPosition(isBridge(id)?BRIDGE_HOLD_DISTANCE:35)};
    if(state.bat.carrying===id)return batCarriedPosition(id);
    return state.items[id];
  }
  function bridgePosition(id){
    if(id===state.mazeBridgeId)return {room:'mazeTR',x:MAZE_BRIDGE_X,y:MAZE_BRIDGE_Y};
    if(id===state.dungeonBridgeId&&state.bridgePlaced)return {room:'redDungeon',x:W/2,y:BRIDGE_Y};
    return itemPosition(id);
  }
  function bridgeCovers(room,x,y){return ['bridge','bridge2'].some(id=>{const pos=bridgePosition(id);return pos.room===room&&Math.abs(x-pos.x)<=BRIDGE_WIDTH/2&&Math.abs(y-pos.y)<=BRIDGE_HEIGHT/2;});}
  function syncHeldBat(){const pos=heldPosition(),b=state.bat;b.room=state.room;b.x=Math.max(25,Math.min(W-25,pos.x));b.y=Math.max(25,Math.min(H-25,pos.y));}
  function enter(room,x,y,usedDoor=null){
    const from=state.room,door=usedDoor||dragonDoor(from,room);
    if(from===room+'Inside'&&Object.hasOwn(state.gateLatched,room)&&hasCarriedItem(room+'Key'))state.gateLatched[room]=state.heldSide==='down';
    if(door)for(const d of state.dragons){
      if(d.dead)continue;
      if(d.room===from){if(!hasCarriedItem('sword')&&!d.escape)d.follow=[door];d.path=[];d.pathTimer=0;d.biting=false;}
      else if(d.follow.length&&d.follow[d.follow.length-1].to===from)d.follow.push(door);
    }
    state.room=room;state.player.x=x;state.player.y=y;state.player.contact='';state.player.bounce.time=BOUNCE_SECONDS;if(state.held==='bat')syncHeldBat();state.seen.add(room);moveDelay=.32;refresh();
  }
  function currentGrid(room=state.room){for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(grid[y][x]===room)return [x,y];return null;}
  function visibleExits(room=state.room){
    const pos=currentGrid(room);
    if(pos){const [x,y]=pos;return {left:!!grid[y][x-1],right:!!grid[y][x+1],up:!!grid[y-1]?.[x]||room==='west',down:!!grid[y+1]?.[x]||room==='black'};}
    return {left:false,right:false,up:room==='whiteInside'||room==='blackInside',down:room.endsWith('Inside')||room==='redDungeon'||room==='greyDungeon'};
  }
  function neighbor(room,d){if(room==='west'&&d.y<0)return 'mazeML';if(room==='black'&&d.y>0)return 'mazeTR';const pos=currentGrid(room);if(!pos)return room;const n=grid[pos[1]+d.y]?.[pos[0]+d.x];return n||room;}
  function dragonDoor(from,to){
    const maze=mazePortals.find(p=>p.from===from&&p.to===to);
    if(maze)return mazeDoor(maze);
    const a=grid.flat().indexOf(from),b=grid.flat().indexOf(to);
    if(a>=0&&b>=0){
      if(Math.floor(a/5)===Math.floor(b/5)&&b-a===1)return {to,exit:{x:925,y:320},entry:{x:35,y:320}};
      if(Math.floor(a/5)===Math.floor(b/5)&&b-a===-1)return {to,exit:{x:35,y:320},entry:{x:925,y:320}};
      if(b-a===5)return {to,exit:{x:480,y:585},entry:{x:480,y:55}};
      if(b-a===-5)return {to,exit:{x:480,y:55},entry:{x:480,y:585}};
    }
    for(const castle of ['gold','white','black']){
      if(from===castle&&to===castle+'Inside')return {to,exit:{x:480,y:465+CASTLE_SHIFT},entry:{x:480,y:525}};
      if(from===castle+'Inside'&&to===castle)return {to,exit:{x:480,y:585},entry:{x:480,y:510+CASTLE_SHIFT}};
    }
    for(const [inside,dungeon] of [['whiteInside','redDungeon'],['blackInside','greyDungeon']]){
      if(from===inside&&to===dungeon)return {to,exit:{x:480,y:55},entry:{x:480,y:555}};
      if(from===dungeon&&to===inside)return {to,exit:{x:480,y:585},entry:{x:480,y:110}};
    }
    return null;
  }
  function roomWalls(room){const type=rooms[room].type;
    if(room==='blackApproach')return BLACK_APPROACH_WALLS;
    if(type==='redDungeon')return [{x:0,y:GAP_Y,w:GAP_X,h:GAP_HEIGHT},{x:GAP_X+GAP_WIDTH,y:GAP_Y,w:W-GAP_X-GAP_WIDTH,h:GAP_HEIGHT},...(!state.bridgePlaced?[{x:GAP_X,y:GAP_Y,w:GAP_WIDTH,h:GAP_HEIGHT}]:[])];
    if(type==='maze'||type==='greyDungeon')return [{x:185,y:90,w:50,h:160},{x:665,y:390,w:50,h:160},{x:155,y:445,w:160,h:45},{x:635,y:145,w:165,h:45},{x:390,y:115,w:45,h:100},{x:515,y:435,w:45,h:95}];
    if(type==='dark')return [{x:220,y:100,w:48,h:150},{x:680,y:380,w:48,h:155},{x:240,y:460,w:150,h:45},{x:600,y:140,w:130,h:45}];
    if(type.endsWith('Inside'))return [{x:135,y:160,w:160,h:50},{x:665,y:160,w:160,h:50},{x:135,y:410,w:150,h:45},{x:675,y:410,w:150,h:45}];
    return [];
  }
  function castleBlocked(x,y,r){
    if(x+r<=281||x-r>=696||y+r<=CASTLE_Y||y-r>=CASTLE_Y+CASTLE_H)return false;
    if(!castleMask)return true;
    const left=Math.max(0,Math.floor((x-r-281)*163/415)),right=Math.min(162,Math.floor((x+r-281)*163/415));
    const top=Math.max(0,Math.floor((y-r-CASTLE_Y)*149/CASTLE_H)),bottom=Math.min(148,Math.floor((y+r-CASTLE_Y)*149/CASTLE_H));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++)if(castleMask[(row*163+col)*4+3])return true;
    return false;
  }
  function blocked(room,x,y){const r=15;if(mazeTiles[room])return mazeBlocked(room,x,y);if(room==='entry')return x<ENTRY_WALL+r||x>W-ENTRY_WALL-r||y<ENTRY_TOP+r||y>H-r||y>ENTRY_BOTTOM-r&&(x<ENTRY_OPEN_LEFT+r||x>ENTRY_OPEN_RIGHT-r);const exits=visibleExits(room),castle=rooms[room].type.endsWith('Castle'),topEdge=55;if(x<55&&!(exits.left&&y>245&&y<395))return true;if(x>W-55&&!(exits.right&&y>245&&y<395))return true;if(y<topEdge&&!(exits.up&&x>370&&x<590))return true;if(y>H-55&&!(exits.down&&x>370&&x<590))return true;if(roomTrees(room).some(tree=>TREE_PARTS.some(([tx,ty,w,h])=>x+r>tree.x+tx*TREE_SCALE&&x-r<tree.x+(tx+w)*TREE_SCALE&&y+r>tree.y+ty*TREE_SCALE&&y-r<tree.y+(ty+h)*TREE_SCALE)))return true;if(castle&&castleBlocked(x,y,r))return true;return roomWalls(room).some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h)&&!bridgeCovers(room,x,y);}
  function clearDragonRoute(room,ax,ay,bx,by){
    const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/10);
    for(let i=1;i<=steps;i++)if(blocked(room,ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps))return false;
    return true;
  }
  function findDragonRoute(dragon,player){
    const columns=31,rows=20,spacing=30,total=columns*rows,walkable=new Uint8Array(total);
    const point=index=>({x:30+(index%columns)*spacing,y:30+Math.floor(index/columns)*spacing});
    const open=index=>{if(!walkable[index]){const pos=point(index);walkable[index]=blocked(dragon.room,pos.x,pos.y)?2:1;}return walkable[index]===1;};
    let start=-1,goal=-1,startDistance=90*90,goalDistance=90*90;
    for(let i=0;i<total;i++){
      if(!open(i))continue;
      const pos=point(i),fromDragon=(pos.x-dragon.x)**2+(pos.y-dragon.y)**2,fromPlayer=(pos.x-player.x)**2+(pos.y-player.y)**2;
      if(fromDragon<startDistance&&clearDragonRoute(dragon.room,dragon.x,dragon.y,pos.x,pos.y)){start=i;startDistance=fromDragon;}
      if(fromPlayer<goalDistance&&clearDragonRoute(dragon.room,pos.x,pos.y,player.x,player.y)){goal=i;goalDistance=fromPlayer;}
    }
    if(start<0||goal<0)return [];
    const previous=new Int16Array(total),queue=[start];previous.fill(-1);previous[start]=start;
    for(let head=0;head<queue.length&&previous[goal]<0;head++){
      const here=queue[head],x=here%columns,y=Math.floor(here/columns),origin=point(here);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||nx>=columns||ny<0||ny>=rows)continue;
        const next=ny*columns+nx;if(previous[next]>=0||!open(next))continue;
        const destination=point(next);if(!clearDragonRoute(dragon.room,origin.x,origin.y,destination.x,destination.y))continue;
        previous[next]=here;queue.push(next);
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
  function movePlayer(dt){if(state.mode!=='playing'&&state.mode!=='title')return;let dx=0,dy=0;for(const key of keys){const d=dir[key];if(d){dx+=d.x;dy+=d.y;state.player.face=key;}}if(!dx&&!dy){state.player.contact='';return;}const len=Math.hypot(dx,dy);dx=dx/len*SPEED*dt;dy=dy/len*SPEED*dt;const p=state.player;
    const hitX=dx!==0&&blocked(state.room,p.x+dx,p.y);if(!hitX)p.x+=dx;
    const hitY=dy!==0&&blocked(state.room,p.x,p.y+dy);if(!hitY)p.y+=dy;
    bounceOnContact(p,hitX,hitY,dx,dy);
    if(state.mode==='title'||moveDelay>0)return;
    if(p.x<-14||p.x>W+14||p.y<-14||p.y>H+14){
      if(mazeTiles[state.room]){const edge=p.x<0?'left':p.x>W?'right':p.y<0?'up':'down',portal=mazePortal(state.room,edge,edge==='left'||edge==='right'?p.y:p.x);if(portal){const door=mazeDoor(portal);enter(door.to,door.entry.x,door.entry.y,door);return;}}
      if(state.room==='west'&&p.y<0||state.room==='black'&&p.y>H){const portal=mazePortal(state.room,state.room==='west'?'up':'down',p.x);if(portal){const door=mazeDoor(portal);enter(door.to,door.entry.x,door.entry.y,door);return;}}
      if(state.room==='whiteInside'&&p.y>H){enter('white',480,510+CASTLE_SHIFT);return;}
      if(state.room==='blackInside'&&p.y>H){enter('black',480,510+CASTLE_SHIFT);return;}
      if(state.room==='goldInside'&&p.y>H){enter('gold',480,510+CASTLE_SHIFT);return;}
      if(state.room==='redDungeon'&&p.y>H){enter('whiteInside',480,110);return;}
      if(state.room==='greyDungeon'&&p.y>H){enter('blackInside',480,110);return;}
      if(state.room==='whiteInside'&&p.y<0){enter('redDungeon',480,555);return;}
      if(state.room==='blackInside'&&p.y<0){enter('greyDungeon',480,555);return;}
      const g=currentGrid();if(g){let d=null;if(p.x<0&&p.y>245&&p.y<395)d=dir.left;else if(p.x>W&&p.y>245&&p.y<395)d=dir.right;else if(p.y<0&&p.x>370&&p.x<590)d=dir.up;else if(p.y>H&&p.x>370&&p.x<590)d=dir.down;if(d){const next=neighbor(state.room,d);if(next!==state.room){enter(next,d.x<0?925:d.x>0?35:p.x,d.y<0?605:d.y>0?35:p.y);return;}}}
      p.x=Math.max(18,Math.min(W-18,p.x));p.y=Math.max(18,Math.min(H-18,p.y));
    }
  }
  function moveSwallowed(dt){
    const dragon=state.dragons.find(d=>d.name===state.swallowedBy),p=state.player;if(!dragon)return;
    let dx=0,dy=0;for(const key of keys){const direction=dir[key];if(direction){dx+=direction.x;dy+=direction.y;p.face=key;}}
    if(!dx&&!dy){p.contact='';return;}
    const length=Math.hypot(dx,dy);dx=dx/length*SWALLOWED_SPEED*dt;dy=dy/length*SWALLOWED_SPEED*dt;
    const hitX=p.x+dx<dragon.x-4||p.x+dx>dragon.x+4;
    const hitY=p.y+dy<dragon.y+11||p.y+dy>dragon.y+19;
    p.x=Math.max(dragon.x-4,Math.min(dragon.x+4,p.x+dx));
    p.y=Math.max(dragon.y+11,Math.min(dragon.y+19,p.y+dy));
    bounceOnContact(p,hitX,hitY,dx,dy);
    if(state.held==='bat'){syncHeldBat();syncCarriedDragon();}
  }
  function keyTouchesGate(castle){
    const pos=itemPosition(castle+'Key');
    return pos.room===castle&&pos.x+17>=464&&pos.x-17<=500&&pos.y+7>=356+CASTLE_SHIFT&&pos.y-7<=438+CASTLE_SHIFT;
  }
  function keyKeepsGateOpen(castle){
    if(state.gateLatched[castle])return true;
    const pos=itemPosition(castle+'Key');
    if(pos.room===castle+'Inside')return true;
    if(pos.room!==castle)return false;
    return pos.x+17>=464&&pos.x-17<=500&&pos.y-7<=438+CASTLE_SHIFT;
  }
  function gateCheck(){
    for(const castle of ['gold','white','black']){
      const open=keyKeepsGateOpen(castle);
      if(open!==state.gates[castle]){state.gates[castle]=open;if(state.room===castle)say(castle.toUpperCase()+(open?' GATE OPENED':' GATE CLOSED'));}
    }
    if(moveDelay>0)return;
    const castle={gold:'gold',white:'white',black:'black'}[state.room];if(!castle)return;
    const p=state.player;if(!keys.has('up')||Math.abs(p.x-480)>30||p.y<445+CASTLE_SHIFT||p.y>470+CASTLE_SHIFT)return;
    if(!state.gates[castle]){if(noticeTimer<=0)say('The '+castle+' gate needs its matching key.');return;}
    if(state.gateLift[castle]<1)return;
    if(castle==='gold'&&hasCarriedItem('chalice')){beginVictory();return;}
    enter(castle+'Inside',480,525);
  }
  function placedBridgeLegContact(){
    if(!state.bridgePlaced||state.room!=='redDungeon')return null;
    const p=state.player,above=p.y>=GAP_Y-30&&p.y<=GAP_Y-15,below=p.y>=GAP_Y+GAP_HEIGHT+15&&p.y<=GAP_Y+GAP_HEIGHT+30;
    if(!above&&!below)return null;
    const {width}=bridgeDimensions(state.dungeonBridgeId);
    for(const x of [W/2-width/3,W/2+width/3])if(Math.abs(p.x-x)<=22)return {x,above};
    return null;
  }
  function nearMazeBridgeLeg(){
    if(state.room!=='mazeTR'||!state.mazeBridgeId)return false;
    const p=state.player,top=MAZE_BRIDGE_Y-MAZE_BRIDGE_HEIGHT/2,bottom=MAZE_BRIDGE_Y+MAZE_BRIDGE_HEIGHT/2;
    const touchesLeg=[MAZE_BRIDGE_X-MAZE_BRIDGE_LEG_OFFSET,MAZE_BRIDGE_X+MAZE_BRIDGE_LEG_OFFSET].some(x=>Math.abs(p.x-x)<=22);
    return touchesLeg&&(Math.abs(p.y-top)<=25||Math.abs(p.y-bottom)<=25);
  }
  function pickup(placedOnly=false){
    if(state.pickupDelay>0)return;
    const p=state.player;
    for(const [id,item] of Object.entries(state.items)){
      const placedBridge=id===state.dungeonBridgeId&&state.bridgePlaced,placedMazeBridge=id===state.mazeBridgeId;
      if(placedBridge){if(!placedOnly||!placedBridgeLegContact())continue;}
      else if(placedMazeBridge){if(!placedOnly||!nearMazeBridgeLeg())continue;}
      else if(placedOnly||item.room!==state.room||!touchesLooseItem(id,item,p))continue;
      const previous=state.held,nextSide=sideTouched(p,item);
      if(previous==='bat'){
        syncHeldBat();state.bat.pickupCooldown=.5;batTimer=1;
      }else if(previous){
        const pos=placedBridge||placedMazeBridge?{x:p.x,y:p.y}:heldPosition(isBridge(previous)?BRIDGE_HOLD_DISTANCE:35);
        state.items[previous]={room:state.room,x:Math.max(35,Math.min(925,pos.x)),y:Math.max(35,Math.min(605,pos.y))};
      }
      if(placedBridge){state.bridgePlaced=false;state.dungeonBridgeId=null;}
      if(placedMazeBridge)state.mazeBridgeId=null;
      state.heldSide=nextSide;state.held=id;item.room='held';
      if(previous==='bat')syncCarriedDragon();
      if(previous)state.pickupDelay=.45;
      playPickup();say(previous?'Swapped '+itemInfo[previous][0]+' for '+itemInfo[id][0]+'.':'Picked up '+itemInfo[id][0]+'.');
      break;
    }
  }
  function drop(){if(state.mode!=='playing'||!state.held)return;const id=state.held,pos=heldPosition(isBridge(id)?BRIDGE_HOLD_DISTANCE:35),x=Math.max(35,Math.min(925,pos.x)),y=Math.max(35,Math.min(605,pos.y));if(id==='bat'){state.bat.room=state.room;state.bat.x=x;state.bat.y=y;batTimer=1;state.bat.pickupCooldown=.5;}else state.items[id]={room:state.room,x,y};state.held=null;state.pickupDelay=.55;playDrop();say('Dropped '+itemInfo[id][0]+'.');refresh();}
  function nearBridgeGap(){const p=state.player;return state.room==='redDungeon'&&Math.abs(p.x-480)<=115&&Math.abs(p.y-350)<=130;}
  function nearMazeBridgeSite(){const p=state.player;return state.room==='mazeTR'&&Math.abs(p.x-MAZE_BRIDGE_X)<=110&&(Math.abs(p.y-(MAZE_BRIDGE_Y-MAZE_BRIDGE_HEIGHT/2))<=65||Math.abs(p.y-(MAZE_BRIDGE_Y+MAZE_BRIDGE_HEIGHT/2))<=65);}
  function placeBridge(){const id=carriedBridgeId();if(state.mode!=='playing'||!id||!nearBridgeGap()||state.bridgePlaced)return;state.bridgePlaced=true;state.dungeonBridgeId=id;if(state.held==='bat')state.bat.carrying=null;else state.held=null;state.items[id]={room:'placed',x:W/2,y:BRIDGE_Y};state.pickupDelay=.55;playDrop();say('The bridge spans the dungeon gap. Press Space by a leg to pick it up.');refresh();}
  function placeMazeBridge(){const id=carriedBridgeId();if(state.mode!=='playing'||!id||!nearMazeBridgeSite()||state.mazeBridgeId)return;state.mazeBridgeId=id;if(state.held==='bat')state.bat.carrying=null;else state.held=null;state.items[id]={room:'placed',x:MAZE_BRIDGE_X,y:MAZE_BRIDGE_Y};state.pickupDelay=.55;playDrop();say('The bridge spans the maze wall. Press Space by a leg to pick it up.');refresh();}
  function useAction(){if(state.mode==='lost'){if(state.held==='bat'){syncHeldBat();state.held=null;syncCarriedDragon();playDrop();refresh();}return;}if(state.mode!=='playing')return;if(state.bridgePlaced&&placedBridgeLegContact()||state.mazeBridgeId&&nearMazeBridgeLeg()){pickup(true);return;}if(carriedBridgeId()&&nearBridgeGap()&&!state.bridgePlaced)placeBridge();else if(carriedBridgeId()&&nearMazeBridgeSite()&&!state.mazeBridgeId)placeMazeBridge();else drop();}
  function magnet(){if(state.mode!=='playing')return;if(!hasCarriedItem('magnet')){say('You need to carry the magnet.');return;}if(!Object.entries(state.items).some(([id,item])=>id!=='magnet'&&item.room===state.room)){say('No loose object is nearby.');return;}magnetPulse=2;say('The magnet pulls loose objects faster.');}
  function magnetPosition(){
    const pos=itemPosition('magnet');return rooms[pos.room]?pos:null;
  }
  function updateMagnet(dt){
    const target=magnetPosition();
    const speed=magnetPulse>0?160:80;magnetPulse=Math.max(0,magnetPulse-dt);
    for(const [id,item] of Object.entries(state.items)){
      if(id==='magnet')continue;
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
  function playDragonDeath(){dragonDeathSound.currentTime=0;dragonDeathSound.play().catch(()=>{});}
  function playPlayerDeath(){playerDeathSound.currentTime=0;playerDeathSound.play().catch(()=>{});}
  function playPickup(){pickupSound.currentTime=0;pickupSound.play().catch(()=>{});}
  function playDrop(){dropSound.currentTime=0;dropSound.play().catch(()=>{});}
  function moveDragonToward(d,target,dt,fear=false){
    if(fear){d.path=[];d.pathTimer=0;}
    else if(clearDragonRoute(d.room,d.x,d.y,target.x,target.y)){d.path=[];d.pathTimer=0;}
    else{
      d.pathTimer-=dt;
      if(d.pathTimer<=0){d.path=findDragonRoute(d,target);d.pathTimer=.35;}
      let waypoint=null;
      for(let i=d.path.length-1;i>=0;i--)if(clearDragonRoute(d.room,d.x,d.y,d.path[i].x,d.path[i].y)){waypoint=d.path[i];d.path=d.path.slice(i);break;}
      if(!waypoint)return;
      target=waypoint;
    }
    const distance=Math.hypot(target.x-d.x,target.y-d.y)||1;let vx=(target.x-d.x)/distance,vy=(target.y-d.y)/distance;if(fear){vx=-vx;vy=-vy;}
    const nx=Math.max(26,Math.min(934,d.x+vx*d.speed*dt)),ny=Math.max(26,Math.min(614,d.y+vy*d.speed*dt));if(!blocked(d.room,nx,d.y))d.x=nx;if(!blocked(d.room,d.x,ny))d.y=ny;
    slayDragonIfSword(d);
  }
  function slayDragonIfSword(d){
    const sword=itemPosition('sword');
    if(d.dead||sword.room!==d.room||Math.hypot(sword.x-d.x,sword.y-d.y)>=38)return false;
    d.dead=true;d.biting=false;d.escape=null;d.follow=[];playDragonDeath();say(d.name+' was slain by the sword.');return true;
  }
  function connectedRooms(room){return [...new Set([...Object.values(dir).map(direction=>neighbor(room,direction)).filter(other=>other!==room),...mazePortals.filter(p=>p.from===room).map(p=>p.to)])];}
  function dragonDoors(from,to){const portals=mazePortals.filter(p=>p.from===from&&p.to===to);return portals.length?portals.map(mazeDoor):[dragonDoor(from,to)].filter(Boolean);}
  function dragonEscapeDoor(d,player){
    const destinations=connectedRooms(d.room);
    for(const castle of ['gold','white','black']){
      if(d.room===castle&&state.gates[castle]&&state.gateLift[castle]>=1)destinations.push(castle+'Inside');
      if(d.room===castle+'Inside')destinations.push(castle);
    }
    if(d.room==='whiteInside')destinations.push('redDungeon');
    if(d.room==='blackInside')destinations.push('greyDungeon');
    if(d.room==='redDungeon')destinations.push('whiteInside');
    if(d.room==='greyDungeon')destinations.push('blackInside');
    let best=null,bestScore=-Infinity;
    for(const room of destinations)for(const door of dragonDoors(d.room,room)){
      if(!clearDragonRoute(d.room,d.x,d.y,door.exit.x,door.exit.y)&&!findDragonRoute(d,door.exit).length)continue;
      const score=Math.hypot(door.exit.x-player.x,door.exit.y-player.y)-.2*Math.hypot(door.exit.x-d.x,door.exit.y-d.y);
      if(score>bestScore){best=door;bestScore=score;}
    }
    return best;
  }
  function stalkerDoor(d,target){
    const queue=[{room:d.room,x:d.x,y:d.y,firstDoor:null}],seen=new Set([`${d.room}:${Math.round(d.x)},${Math.round(d.y)}`]);
    for(let i=0;i<queue.length;i++){
      const {room,x,y,firstDoor}=queue[i],next=connectedRooms(room);
      for(const castle of ['gold','white','black']){
        if(room===castle&&state.gates[castle]&&state.gateLift[castle]>=1)next.push(castle+'Inside');
        if(room===castle+'Inside')next.push(castle);
      }
      if(room==='whiteInside')next.push('redDungeon');
      if(room==='redDungeon')next.push('whiteInside');
      if(room==='blackInside')next.push('greyDungeon');
      if(room==='greyDungeon')next.push('blackInside');
      for(const other of new Set(next))for(const door of dragonDoors(room,other)){
        const key=`${other}:${Math.round(door.entry.x)},${Math.round(door.entry.y)}`;
        if(seen.has(key))continue;
        if(!clearDragonRoute(room,x,y,door.exit.x,door.exit.y)&&!findDragonRoute({room,x,y},door.exit).length)continue;
        if(other===target)return firstDoor||door;
        seen.add(key);queue.push({room:other,x:door.entry.x,y:door.entry.y,firstDoor:firstDoor||door});
      }
    }
    return null;
  }
  function updateDragons(dt){
    for(const d of state.dragons){
      if(d.dead||slayDragonIfSword(d))continue;
      if(d.name===state.bat.carryingDragon){d.biting=false;d.follow=[];d.escape=null;continue;}
      if(d.room!==state.room){
        d.biting=false;
        if(d.escape){const door=d.escape;moveDragonToward(d,door.exit,dt);if(d.dead)continue;if(Math.hypot(d.x-door.exit.x,d.y-door.exit.y)<24){d.room=door.to;d.x=door.entry.x;d.y=door.entry.y;d.escape=null;d.follow=[];d.path=[];d.pathTimer=0;}continue;}
        if(d.stalker){
          d.stalkerRouteTimer=(d.stalkerRouteTimer||0)-dt;
          if(d.stalkerRouteTimer<=0||d.stalkerRouteRoom!==d.room||d.stalkerRouteTarget!==state.room){d.stalkerRoute=stalkerDoor(d,state.room);d.stalkerRouteRoom=d.room;d.stalkerRouteTarget=state.room;d.stalkerRouteTimer=.75;}
          const door=d.stalkerRoute;
          d.follow=[];
          if(door){moveDragonToward(d,door.exit,dt);if(d.dead)continue;if(Math.hypot(d.x-door.exit.x,d.y-door.exit.y)<24){d.room=door.to;d.x=door.entry.x;d.y=door.entry.y;d.path=[];d.pathTimer=0;d.stalkerRouteTimer=0;}}
          continue;
        }
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
    const next=neighbor(room,d);if(next!==room)return next;
    const row=grid.findIndex(r=>r.includes(room));if(row<0)return room;
    const col=grid[row].indexOf(room);
    return grid[(row+d.y+grid.length)%grid.length][(col+d.x+grid[row].length)%grid[row].length]||room;
  }
  function moveBatAcrossWorld(b){
    if(mazeTiles[b.room]){
      const edge=b.x<0?'left':b.x>W?'right':b.y<0?'up':b.y>H?'down':null;
      if(edge){const portal=mazePortal(b.room,edge,edge==='left'||edge==='right'?b.y:b.x);
        if(portal){const entry=mazeEntry(portal);b.room=portal.to;b.x=entry.x;b.y=entry.y;b.chaseTimer=0;return;}
        if(edge==='left'||edge==='right'){b.x=Math.max(0,Math.min(W,b.x));b.vx*=-1;}else{b.y=Math.max(0,Math.min(H,b.y));b.vy*=-1;}
      }
      return;
    }
    if(b.x<0){const next=batNeighbor(b.room,dir.left);if(next!==b.room){b.room=next;b.x+=W;b.chaseTimer=0;}else{b.x=-b.x;b.vx=Math.abs(b.vx);}}
    else if(b.x>W){const next=batNeighbor(b.room,dir.right);if(next!==b.room){b.room=next;b.x-=W;b.chaseTimer=0;}else{b.x=2*W-b.x;b.vx=-Math.abs(b.vx);}}
    if(b.y<0){const next=batNeighbor(b.room,dir.up);if(next!==b.room){b.room=next;b.y+=H;b.chaseTimer=0;}else{b.y=-b.y;b.vy=Math.abs(b.vy);}}
    else if(b.y>H){const next=batNeighbor(b.room,dir.down);if(next!==b.room){b.room=next;b.y-=H;b.chaseTimer=0;}else{b.y=2*H-b.y;b.vy=-Math.abs(b.vy);}}
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
        const castle={goldKey:'gold',whiteKey:'white',blackKey:'black'}[id];if(item.room!==b.room||(castle&&keyTouchesGate(castle)))continue;
        const distance=Math.hypot(item.x-b.x,item.y-b.y);if(distance<best){nearest=item;best=distance;}
      }
      for(const d of state.dragons){if(d.room!==b.room)continue;const distance=Math.hypot(d.x-b.x,d.y-b.y);if(distance<best){nearest=d;best=distance;}}
      if(nearest&&best>0){const dx=nearest.x-b.x,dy=nearest.y-b.y;vx=dx/best;vy=dy/best;if(Math.abs(dx)>20)b.vx=Math.sign(dx)*.8;if(Math.abs(dy)>20)b.vy=Math.sign(dy)*.6;}
    }
    b.x+=vx*280*dt;b.y+=vy*280*dt;moveBatAcrossWorld(b);syncCarriedDragon();
    if(playerActive&&b.room===state.room&&!state.held&&state.pickupDelay<=0&&batTimer<=0&&Math.hypot(p.x-b.x,p.y-b.y)<36){
      state.heldSide=sideTouched(p,b);state.held='bat';b.chaseTimer=0;batTimer=.8;syncHeldBat();syncCarriedDragon();playPickup();say('Picked up the bat.');return;
    }
    if(playerActive&&b.room===state.room&&state.held&&batTimer<=0&&Math.hypot(p.x-b.x,p.y-b.y)<36){
      const offered=state.held,received=b.carrying;state.heldSide=sideTouched(p,b);
      b.carryingDragon=null;
      state.items[offered].room='bat';b.carrying=offered;state.held=received;
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
      const castle={goldKey:'gold',whiteKey:'white',blackKey:'black'}[id];if(castle&&keyTouchesGate(castle))continue;
      if(item.room!==b.room||Math.hypot(item.x-b.x,item.y-b.y)>=40)continue;
      if(b.carrying)state.items[b.carrying]={room:b.room,x:b.x,y:b.y};
      item.room='bat';b.carrying=id;b.pickupCooldown=1.5;
      if(b.room===state.room)say('The bat carried off '+itemInfo[id][0]+'.');
      break;
    }
  }
  function beginVictory(){
    if(state.heldSide==='down')enter('goldInside',480,525);
    startVictory();
  }
  function startVictory(){state.mode='winning';state.winTimer=0;state.message='The chalice has returned to the Golden Castle!';winSound.currentTime=0;winSound.play().catch(()=>{});refresh();}
  function finishVictory(){state.mode='won';showOverlay('THE CHALICE RETURNS','The Golden Castle is safe. You crossed the kingdom, outwitted its creatures, and restored the enchanted treasure.','PLAY AGAIN');refresh();}
  function updateVesper(dt){state.gameTime+=dt;if(state.gameTime>=60&&!state.dragons.some(d=>d.name==='Vesper'))state.dragons.push(createDragon(dragonStarts.find(([name])=>name==='Vesper')));}
  function update(dt){if(state.mode==='title'){state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);movePlayer(dt);const button=$('hardModeBtn').getBoundingClientRect(),screen=canvas.getBoundingClientRect(),p=state.player,px=screen.left+p.x*screen.width/W,py=screen.top+p.y*screen.height/H;if(px>=button.left&&px<=button.right&&py>=button.top&&py<=button.bottom)start();return;}if(state.mode==='winning'){state.winTimer+=dt;const duration=Number.isFinite(winSound.duration)&&winSound.duration>0?winSound.duration:4;if(state.winTimer>=Math.max(3,duration)+VICTORY_MESSAGE_DELAY&&(winSound.ended||winSound.paused))finishVictory();return;}if(state.mode==='lost'){state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);moveSwallowed(dt);updateBat(dt);refresh();return;}if(state.mode!=='playing')return;updateVesper(dt);state.player.bounce.time=Math.min(BOUNCE_SECONDS,state.player.bounce.time+dt);moveDelay=Math.max(0,moveDelay-dt);noticeTimer=Math.max(0,noticeTimer-dt);state.pickupDelay=Math.max(0,state.pickupDelay-dt);for(const castle of ['gold','white','black'])state.gateLift[castle]=Math.max(0,Math.min(1,state.gateLift[castle]+(state.gates[castle]?1:-1)*dt/.8));movePlayer(dt);gateCheck();if(state.mode!=='playing')return;updateMagnet(dt);pickup();updateDragons(dt);if(state.mode!=='playing')return;updateBat(dt);refresh();}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function label(t,x,y,size=20,color='#f5e8bc',align='left'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(t,x,y);ctx.textAlign='left';}
  function drawItem(id,x,y){const info=itemInfo[id];if(!info)return;ctx.save();ctx.translate(x,y);if(isChalice(id)){const hue=((state.mode==='winning'?state.winTimer:performance.now()/1000)*300)%360;ctx.filter=`hue-rotate(${hue}deg) saturate(2) brightness(1.25)`;ctx.shadowColor=`hsl(${hue} 100% 70%)`;ctx.shadowBlur=14;}if(sprites[id]){ctx.imageSmoothingEnabled=false;if(id==='sword')ctx.drawImage(sprites.sword,-18,-11,36,22);else if(isBridge(id)){const {width,height}=bridgeDimensions(id);ctx.drawImage(sprites.bridge,-width/2,-height/2,width,height);}else if(isChalice(id))ctx.drawImage(sprites.chalice,-15,-17,30,34);else ctx.drawImage(sprites[id],-17,-7,34,14);}else label(info[1],0,id==='magnet'?20:10,id==='magnet'?56:isBridge(id)?Math.round(28*BRIDGE_SCALE):28,info[2],'center');ctx.restore();}
  function drawDragon(d){const sprite=sprites[d.name+(d.dead?'Dead':d.biting?'Attack':'Pursue')];if(sprite){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,Math.round(d.x-20),Math.round(d.y-50),40,100);return;}ctx.save();ctx.translate(Math.round(d.x),Math.round(d.y));rect(-24,-13,48,26,d.color);rect(12,-25,17,20,d.color);rect(-22,11,14,15,d.color);rect(4,11,14,15,d.color);rect(-34,-8,13,10,d.color);rect(20,-18,5,5,'#1a2524');rect(27,-3,13,5,'#fff2cb');ctx.restore();}
  function drawCastle(color,gateOpen,type){
    const castle=type.slice(0,-6),lift=state.gateLift[castle],gateVisible=gateOpen||lift>0;
    const gateX=281+72*415/163,gateY=CASTLE_Y+116*CASTLE_H/149,gateW=14*415/163,gateH=32*CASTLE_H/149,gateTravel=gateH-14;
    const celebrating=type==='goldCastle'&&state.mode==='winning',hue=(state.winTimer*300)%360;
    if(celebrating)color=`hsl(${hue} 85% 65%)`;
    if(sprites[type]){
      ctx.imageSmoothingEnabled=false;ctx.save();
      if(celebrating){ctx.filter=`hue-rotate(${hue}deg) saturate(2) brightness(1.25)`;ctx.shadowColor=`hsl(${hue} 100% 70%)`;ctx.shadowBlur=28;}
      ctx.drawImage(sprites[gateVisible?type+'Open':type],281,CASTLE_Y,415,CASTLE_H);ctx.restore();
      if(gateVisible){ctx.save();ctx.beginPath();ctx.rect(gateX,gateY,gateW,gateH);ctx.clip();ctx.drawImage(sprites[type],72,116,14,32,gateX,gateY-gateTravel*lift,gateW,gateH);ctx.restore();}
    }else{
      rect(285,118+CASTLE_SHIFT,390,330,'#132626');rect(300,125+CASTLE_SHIFT,360,300,color);rect(300,90+CASTLE_SHIFT,75,70,color);rect(442,90+CASTLE_SHIFT,75,70,color);rect(585,90+CASTLE_SHIFT,75,70,color);
      for(let x of [310,340,452,482,595,625])rect(x,77+CASTLE_SHIFT,19,20,color);
      for(let x of [350,565]){rect(x,220+CASTLE_SHIFT,44,56,'#1a302f');rect(x+10,233+CASTLE_SHIFT,24,33,'#8d9a78');}
      rect(425,245+CASTLE_SHIFT,110,172,gateVisible?'#182d2a':'#292328');rect(442,252+CASTLE_SHIFT,76,165,gateVisible?'#273d35':'#564731');
      if(gateVisible){ctx.save();ctx.beginPath();ctx.rect(gateX,gateY,gateW,gateH);ctx.clip();for(let x=gateX+3;x<gateX+gateW-3;x+=9)rect(x,gateY-gateTravel*lift,4,gateH,'#111d1c');for(let y=gateY+3;y<gateY+gateH;y+=12)rect(gateX,y-gateTravel*lift,gateW,4,'#111d1c');ctx.restore();}
    }
    if(celebrating)for(let i=0;i<16;i++){const x=305+(i*79)%355,y=75+(i*137)%310,size=5+(i%3)*3;rect(x,y,size,size,`hsl(${(hue+i*35)%360} 100% 75%)`);}
  }
  function usesBlueGateStyle(roomId){return roomId==='blueGate'||roomId==='blueVault';}
  function wallColor(roomId){const type=rooms[roomId].type;const castleColor={goldCastle:'#d2d240',goldInside:'#d2d240',whiteCastle:'#ffffff',whiteInside:'#ffffff',blackCastle:'#000000',blackInside:'#000000'}[type];return roomId==='entry'?'#FD41FF':usesBlueGateStyle(roomId)?'#8f8b8f':castleColor||(type==='newMaze'?'#505cc0':type==='redDungeon'?'#ad596f':type==='maze'?'#718b95':type==='dark'||type==='greyDungeon'?'#777386':'#ad596f');}
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
  function drawDoorFrame(exits,type){const wall=state.room==='west'?'#84B468':wallColor(state.room),topHeight=40;const side=(x,open)=>{rect(x,topHeight,40,open?250-topHeight:600-topHeight,wall);if(open)rect(x,390,40,210,wall);};ctx.save();if(type==='goldCastle'&&state.mode==='winning')ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;rect(0,0,exits.up?390:W,topHeight,wall);if(exits.up)rect(570,0,W-570,topHeight,wall);rect(0,H-40,exits.down?390:W,40,wall);if(exits.down)rect(570,H-40,W-570,40,wall);side(0,exits.left);side(W-40,exits.right);ctx.restore();}
  function drawTitleRoom(){const wall=wallColor('entry');rect(0,0,W,H,'#8F8B8F');rect(0,0,W,ENTRY_TOP,wall);rect(0,ENTRY_TOP,ENTRY_WALL,H-ENTRY_TOP,wall);rect(W-ENTRY_WALL,ENTRY_TOP,ENTRY_WALL,H-ENTRY_TOP,wall);rect(ENTRY_WALL,ENTRY_BOTTOM,ENTRY_OPEN_LEFT-ENTRY_WALL,H-ENTRY_BOTTOM,wall);rect(ENTRY_OPEN_RIGHT,ENTRY_BOTTOM,W-ENTRY_OPEN_RIGHT-ENTRY_WALL,H-ENTRY_BOTTOM,wall);const p=state.player,bump=BOUNCE_DISTANCE*Math.sin(Math.PI*p.bounce.time/BOUNCE_SECONDS);titleCursorCtx.clearRect(0,0,W,H);titleCursorCtx.fillStyle=wall;titleCursorCtx.fillRect(Math.round(p.x-10.53+p.bounce.x*bump),Math.round(p.y-10.53+p.bounce.y*bump),Math.round(21.06),Math.round(21.06));}
  function draw(){if(state.mode==='title'){drawTitleRoom();return;}const room=rooms[state.room],type=room.type;ctx.clearRect(0,0,W,H);rect(0,0,W,H,'#8f8b8f');
    if(usesBlueGateStyle(state.room)){const x=state.player.x,y=state.player.y;ctx.save();ctx.shadowColor='#E5BC00';ctx.shadowBlur=18;rect(x-54,y-54,108,108,'#E5BC00');ctx.restore();}
    const exits=visibleExits();
    if(type==='newMaze'){drawNewMaze(state.room);if(state.room==='mazeTR'&&state.mazeBridgeId&&sprites.bridge){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprites.bridge,MAZE_BRIDGE_X-MAZE_BRIDGE_WIDTH/2,MAZE_BRIDGE_Y-MAZE_BRIDGE_HEIGHT/2,MAZE_BRIDGE_WIDTH,MAZE_BRIDGE_HEIGHT);}}
    else for(const w of roomWalls(state.room)){if(usesBlueGateStyle(state.room)){rect(w.x,w.y,w.w,w.h,'#8f8b8f');continue;}rect(w.x+5,w.y+5,w.w,w.h,'#132528');rect(w.x,w.y,w.w,w.h,type==='redDungeon'?'#8a5045':'#7b8e79');for(let j=w.x+12;j<w.x+w.w-12;j+=36)rect(j,w.y+7,24,5,'#abc09b');}
    if(type.endsWith('Castle'))drawCastle(type==='goldCastle'?'#c5a45c':type==='whiteCastle'?'#bac4bd':'#555666',state.gates[type.slice(0,-6)],type);
    const celebratingInside=type==='goldInside'&&state.mode==='winning';
    if(celebratingInside){ctx.save();ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;}
    if(type.endsWith('Inside')){rect(345,160,270,280,type==='goldInside'?'#9b8350':'#696c65');rect(365,180,230,240,'#38423f');rect(415,255,130,78,type==='goldInside'?'#e5c66f':'#9ba69b');if(type!=='goldInside')label(type==='whiteInside'?'WHITE DUNGEON ↑':'GREY DUNGEON ↑',480,113,19,'#f3d697','center');}
    if(type==='redDungeon'){rect(GAP_X,GAP_Y,GAP_WIDTH,GAP_HEIGHT,state.bridgePlaced?'#c39b68':'#111e2b');if(state.bridgePlaced){if(sprites.bridge){const {width,height}=bridgeDimensions(state.dungeonBridgeId);ctx.imageSmoothingEnabled=false;ctx.drawImage(sprites.bridge,(W-width)/2,BRIDGE_Y-height/2,width,height);}else for(let y=GAP_Y+7;y<GAP_Y+GAP_HEIGHT;y+=15)rect(GAP_X+7,y,GAP_WIDTH-14,5,'#67523c');}label('BRIDGE GAP',W/2,GAP_Y-15,16,'#efd3a0','center');}
    if(type==='greyDungeon'){rect(560,80,300,240,'#343d41');label('THE CHALICE IS NEAR',665,98,15,'#d8ccaf','center');}
    if(type!=='newMaze')drawDoorFrame(exits,type);
    if(state.room==='west')rect(76,0,10,H,'#000000');
    if(state.room==='blackApproach')rect(W-76-10,0,10,H,'#000000');
    for(const {x,y} of roomTrees(state.room))drawTree(x,y);
    if(celebratingInside){for(let i=0;i<16;i++){const x=305+(i*79)%355,y=75+(i*137)%310,size=5+(i%3)*3;rect(x,y,size,size,`hsl(${(state.winTimer*300+i*35)%360} 100% 75%)`);}ctx.restore();}
    for(const [id,item] of Object.entries(state.items))if(item.room===state.room)drawItem(id,item.x,item.y+(item.floating?Math.sin(performance.now()/200+item.x/50)*3:0));
    for(const d of state.dragons)if(d.room===state.room&&d.name===state.bat.carryingDragon)drawDragon(d);
    const b=state.bat;if(b.room===state.room){const up=Math.floor(performance.now()/180)%2===0,sprite=sprites[up?'batUp':'batDown'];if(sprite.complete&&sprite.naturalWidth){ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,Math.round(b.x-20),Math.round(b.y-27.5),40,55);}else{ctx.save();ctx.translate(b.x,b.y);rect(-25,-7,18,13,'#111821');rect(7,-7,18,13,'#111821');rect(-8,-12,16,22,'#111821');ctx.restore();}if(b.carrying){const carried=batCarriedPosition(b.carrying);drawItem(b.carrying,carried.x,carried.y);}}
    for(const d of state.dragons)if(d.room===state.room&&d.name!==state.bat.carryingDragon)drawDragon(d);
    const p=state.player,playerSize=21.06,bump=(state.swallowedBy?2:BOUNCE_DISTANCE)*Math.sin(Math.PI*p.bounce.time/BOUNCE_SECONDS),px=p.x+p.bounce.x*bump,py=p.y+p.bounce.y*bump;ctx.save();if(state.mode==='winning'&&(state.room==='gold'||state.room==='goldInside'))ctx.filter=`hue-rotate(${(state.winTimer*300)%360}deg) saturate(2) brightness(1.25)`;ctx.fillStyle=wallColor(state.room);ctx.fillRect(px-playerSize/2,py-playerSize/2,playerSize,playerSize);ctx.restore();if(state.held&&state.held!=='bat'){const offset=isBridge(state.held)?BRIDGE_HOLD_DISTANCE:35,side=dir[state.heldSide];drawItem(state.held,px+side.x*offset,py+side.y*offset);}
    if(state.mode==='paused'){rect(0,0,W,H,'#0b1418aa');label('PAUSED',480,330,52,'#f5d691','center');}
  }
  function mapItemRoom(id,item){
    const room=state.held===id?state.room:state.bat.carrying===id?state.bat.room:id===state.dungeonBridgeId&&state.bridgePlaced?'redDungeon':id===state.mazeBridgeId?'mazeTR':item.room;
    return dragonMapRoom[room]||room;
  }
  function mapDragonIcons(room){
    if(hints.hidden)return '';
    return state.dragons.filter(d=>(dragonMapRoom[d.room]||d.room)===room).map(d=>{
      const title=d.name+' — '+rooms[d.room].name+(d.dead?' (slain)':''),src=dragonIconUrls[d.name]?.[d.dead?'dead':'alive'];
      return src?`<img class="dragon-icon${d.dead?' dead':''}" src="${src}" alt="${title}" title="${title}">`:`<b class="dragon-icon-fallback" style="color:${d.color}" title="${title}">◆</b>`;
    }).join('');
  }
  function mapItemIcons(room){
    if(hints.hidden)return '';
    return Object.entries(state.items).filter(([itemId,item])=>mapItemRoom(itemId,item)===room).map(([itemId])=>{
      const treasure=itemId==='magnet'||isChalice(itemId),symbol=isChalice(itemId)?'\u265B\uFE0E':itemInfo[itemId][1];
      return `<span class="map-item-icon${treasure?' map-item-treasure':''}${isChalice(itemId)?' map-item-chalice':''}${itemId.endsWith('Key')?' map-item-key':''}${itemId==='blackKey'?' map-item-black-key':''}${isBridge(itemId)?' map-item-bridge':''}"${itemId==='blackKey'?'':` style="color:${treasure?itemInfo.bridge[2]:itemInfo[itemId][2]}"`} title="${itemInfo[itemId][0]}" aria-label="${itemInfo[itemId][0]}">${symbol}</span>`;
    }).join('');
  }
  function refreshHints(){
    for(const id of ['goldKey','whiteKey','blackKey','sword','magnet','bridge','bridge2','chalice']){
      const item=state.items[id];let location;
      if(state.held===id)location='With you in '+rooms[state.room].name;
      else if(state.bat.carrying===id)location='With the bat in '+rooms[state.bat.room].name;
      else if(id===state.dungeonBridgeId&&state.bridgePlaced)location=rooms.redDungeon.name+' (placed)';
      else if(id===state.mazeBridgeId)location=rooms.mazeTR.name+' (placed)';
      else location=rooms[item.room]?.name||'Unknown location';
      const node=$('hint'+id[0].toUpperCase()+id.slice(1));if(node.textContent!==location)node.textContent=location;
    }
  }
  function refresh(){
    if(!state)return;
    $('roomName').textContent=rooms[state.room].name;
    $('message').textContent=state.message;
    $('itemName').textContent=state.held?itemInfo[state.held][0]:'Nothing';
    const icon=$('itemIcon'),id=state.held||'',sprite=spriteUrls[id],iconState=id+(sprite?'sprite':'text');
    if(icon.dataset.sprite!==iconState){icon.dataset.sprite=iconState;icon.textContent=sprite?'':id?itemInfo[id][1]:'□';icon.style.backgroundImage=sprite?`url("${sprite}")`:'';icon.style.backgroundColor=id==='blackKey'||id==='magnet'||id==='bat'?'#b9b7aa':'transparent';icon.style.color=id?itemInfo[id][2]:'#f4e4be';icon.style.fontSize=id==='magnet'?'36px':'';icon.style.width=id==='magnet'?'54px':'';icon.style.height=id==='magnet'?'54px':'';}
    $('pauseBtn').textContent=state.mode==='paused'?'RESUME':'PAUSE';
    $('dropBtn').textContent=state.bridgePlaced&&placedBridgeLegContact()||state.mazeBridgeId&&nearMazeBridgeLeg()?'PICK UP BRIDGE':carriedBridgeId()&&(nearBridgeGap()&&!state.bridgePlaced||nearMazeBridgeSite()&&!state.mazeBridgeId)?'PLACE BRIDGE':'DROP';
    const map=$('map'),mapState=[state.room,hints.hidden,!!dragonIconUrls.Yorgle,[...state.seen].join(','),...state.dragons.map(d=>d.room+':'+d.dead),...Object.entries(state.items).map(([id,item])=>id+':'+mapItemRoom(id,item))].join('|');
    if(map.dataset.state!==mapState){
      map.dataset.state=mapState;
      map.innerHTML=grid.flatMap(row=>row.map(id=>{
        if(!id)return '<span class="empty" aria-hidden="true"></span>';
        const r=rooms[id],revealed=!hints.hidden||state.seen.has(id),symbol=revealed&&r.type.endsWith('Castle')?'<span class="map-castle-icon">♜</span>':id===state.room?'◆':'';
        const icons=mapDragonIcons(id),items=mapItemIcons(id);
        const castleClass=['gold','white','black'].includes(id)?' castle-'+id:'';
        return `<span class="${id===state.room?'current':revealed?'':'unseen'}${castleClass}${revealed&&r.type==='maze'?' maze-room':''}${icons?' has-dragon':''}" title="${revealed?r.name:'Unexplored'}">${symbol}${icons?`<span class="dragon-icons">${icons}</span>`:''}${items?`<span class="map-item-icons">${items}</span>`:''}</span>`;
      })).join('')+(hints.hidden?'':'<b class="map-bat" id="mapBat" role="img" aria-label="Bat">w</b>');
    }
    const mazeMap=$('mazeMap'),mazeState=mapState;
    if(mazeMap.dataset.state!==mazeState){
      mazeMap.dataset.state=mazeState;
      mazeMap.innerHTML=mazeMapRooms.map(id=>{
        if(!id)return '<span class="empty" aria-hidden="true"></span>';
        const revealed=!hints.hidden||state.seen.has(id),current=state.room===id;
        const icons=mapDragonIcons(id),items=mapItemIcons(id);
        return `<span class="${current?'current':revealed?'':'unseen'}${revealed?' maze-room':''}${icons?' has-dragon':''}" title="${revealed?rooms[id].name:'Unexplored'}">${current?'◆':''}${icons?`<span class="dragon-icons">${icons}</span>`:''}${items?`<span class="map-item-icons">${items}</span>`:''}</span>`;
      }).join('')+(hints.hidden?'':'<b class="map-bat" id="mazeMapBat" role="img" aria-label="Bat">w</b>');
    }
    const bat=state.bat,batRoom=dragonMapRoom[bat.room]||bat.room,batCell=grid.flat().indexOf(batRoom),batIcon=$('mapBat');
    if(batIcon)batIcon.style.display=batCell>=0?'grid':'none';
    if(batCell>=0&&batIcon&&map.clientWidth>0){
      const cellWidth=(map.clientWidth-12)/5,cellHeight=cellWidth/1.25,mapHeight=cellHeight*grid.length+3*(grid.length-1);
      const x=(batCell%5)*(cellWidth+3)+(bat.x/W)*cellWidth,y=Math.floor(batCell/5)*(cellHeight+3)+(bat.y/H)*cellHeight;
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
  function titleScreen(){fadeToken++;clearTimeout(fadeTimer);transitionScreen.hidden=true;transitionScreen.classList.remove('fading');overlay.classList.remove('fading','transitioning');winSound.pause();winSound.currentTime=0;initial();showOverlay('CHALICE QUEST','Explore the kingdom, open its castles, and carry the chalice home to the Golden Castle. Beware the dragons and the thieving bat. Press Tab for help.','');refresh();$('hardModeBtn').focus();}
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
  window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(k==='Tab'){e.preventDefault();togglePanels();}else if(k==='Enter'&&state.mode==='lost'){e.preventDefault();titleScreen();}else if(keyDir[k]){keys.add(keyDir[k]);e.preventDefault();}else if(k===' '&&state.mode!=='title'){useAction();e.preventDefault();}else if(k==='m'){magnet();}else if(k==='p'){pause();}else if(k==='r'){titleScreen();}});
  window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyDir[k])keys.delete(keyDir[k]);});window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-dir]').forEach(button=>{const d=button.dataset.dir;button.addEventListener('pointerdown',e=>{keys.add(d);button.setPointerCapture(e.pointerId);e.preventDefault();});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(d));});
  $('dropBtn').onclick=useAction;$('magnetBtn').onclick=magnet;$('pauseBtn').onclick=pause;$('restartBtn').onclick=titleScreen;$('hardModeBtn').onclick=start;$('overlayBtn').onclick=()=>state.mode==='paused'?pause():titleScreen();
  hintsToggle.addEventListener('click',event=>{event.preventDefault();hints.hidden=!hints.hidden;hintsToggle.textContent=hints.hidden?'Show hints':'Hide hints';hintsToggle.setAttribute('aria-expanded',String(!hints.hidden));refresh();});
  document.body.classList.add('playfield-only');titleScreen();requestAnimationFrame(frame);
})();
