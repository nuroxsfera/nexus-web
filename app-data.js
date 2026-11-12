const LS='atlantis_v2';
const defaultDB=()=>({
  onboarded:false,
  me:{name:'Вы',handle:'@you',bio:'Привет, я в Atlantis 🌊',visibility:'public',avatar:'https://i.pravatar.cc/300?u=me',cover:'https://picsum.photos/seed/mehero/1200/1600'},
  pendingAvatar:null,pendingCover:null,
  blocked:{},
  clips:[],pendingClipVideo:null,
  playlists:[],watchlists:[],activePlaylist:null,activeWatchlist:null,
  fitnessProfile:{},workouts:[],nutritionEntries:[],reports:[],
  organizations:[],activeOrganization:null,spaces:[],activeSpace:null,
  following:{},channelSub:{},cart:[],seenStories:{},
  stories:[
    {id:'add',type:'add',name:'Добавить'},
    {id:'s1',name:'Альфредо',avatar:'https://i.pravatar.cc/140?u=alfredo',profile:'alfredo',images:['https://picsum.photos/seed/st1/900/1600','https://picsum.photos/seed/st1b/900/1600']},
    {id:'s2',name:'Корсгард',avatar:'https://i.pravatar.cc/140?u=cors',profile:'marley',images:['https://picsum.photos/seed/st2/900/1600']},
    {id:'s3',name:'Эшлинн',avatar:'https://i.pravatar.cc/140?u=ash',profile:null,images:['https://picsum.photos/seed/st3/900/1600']},
    {id:'s4',name:'Адамс',avatar:'https://i.pravatar.cc/140?u=adams',profile:null,images:['https://picsum.photos/seed/st4/900/1600']}
  ],
  posts:[
    {id:'p1',author:'Марли Корсгард',authorKey:'marley',avatar:'https://i.pravatar.cc/64?u=marley',image:'https://picsum.photos/seed/atl1/900/700',likes:12100,comments:2,liked:false,saved:false,text:'Каждое большое достижение начинается с маленького шага. 🔥',commentList:[{user:'София',text:'Очень вовремя 💫'},{user:'Макс',text:'В точку'}]},
    {id:'p2',author:'София Беннетт',authorKey:'sofia',avatar:'https://i.pravatar.cc/64?u=sofia',image:'https://picsum.photos/seed/atl2/900/700',likes:18,comments:0,liked:false,saved:false,text:'Просто хороший день. Солнце и ничего лишнего.',commentList:[]},
    {id:'p3',author:'Альфредо',authorKey:'alfredo',avatar:'https://i.pravatar.cc/64?u=alfredo',image:'https://picsum.photos/seed/atl3/900/700',likes:890,comments:1,liked:false,saved:false,text:'Новый проект почти готов. Скоро покажу.',commentList:[{user:'Вы',text:'Жду!'}]}
  ],
  notifications:[
    {id:1,read:false,title:'Марли',body:'оценила ваш пост',time:'2м',avatar:'https://i.pravatar.cc/64?u=marley'},
    {id:2,read:false,title:'Альфредо',body:'подписался на вас',time:'15м',avatar:'https://i.pravatar.cc/64?u=alfredo'},
    {id:3,read:false,title:'Заказ #1042',body:'передан в доставку',time:'3ч',avatar:null}
  ],
  chats:[
    {id:'c1',name:'Марли Корсгард',avatar:'https://i.pravatar.cc/64?u=marley',last:'Увидимся на съёмке?',time:'12:40',unread:1,messages:[{me:false,text:'Привет! Как дела?'},{me:true,text:'Почти готово'},{me:false,text:'Увидимся на съёмке?'}]},
    {id:'c2',name:'Альфредо',avatar:'https://i.pravatar.cc/64?u=alfredo',last:'Ок, скину файлы',time:'Вчера',unread:1,messages:[{me:true,text:'Нужны исходники'},{me:false,text:'Ок, скину файлы'}]}
  ],
  channels:[
    {id:'ch1',name:'Design Daily',members:'12.4K',desc:'UI и дизайн каждый день.',cover:'https://picsum.photos/seed/chc1/800/400',avatar:'https://picsum.photos/seed/cha1/200/200',posts:[{title:'Системы отступов',text:'Ритм в интерфейсе.',image:'https://picsum.photos/seed/chp1/800/500',likes:342},{title:'Цвет и a11y',text:'Контраст обязателен.',image:'https://picsum.photos/seed/chp2/800/500',likes:189}]},
    {id:'ch2',name:'Atlantis Lab',members:'3.1K',desc:'Новости продукта.',cover:'https://picsum.photos/seed/chc2/800/400',avatar:'https://picsum.photos/seed/cha2/200/200',posts:[{title:'Новый профиль',text:'Immersive hero.',image:'https://picsum.photos/seed/chp3/800/500',likes:520}]}
  ],
  shops:[{id:'sh1',name:'Nord Studio',products:48,desc:'Объекты и ассеты.',items:[
    {id:'i1',name:'Poster Atlas',price:2400,image:'https://picsum.photos/seed/prod1/400/400',desc:'Постер 50×70, матовая бумага.'},
    {id:'i2',name:'UI Kit Night',price:3900,image:'https://picsum.photos/seed/prod2/400/400',desc:'Figma-kit, 120 компонентов.'},
    {id:'i3',name:'Type Sample',price:900,image:'https://picsum.photos/seed/prod3/400/400',desc:'Набор шрифтовых сэмплов.'},
    {id:'i4',name:'Desk Card',price:1200,image:'https://picsum.photos/seed/prod4/400/400',desc:'Металлическая карточка.'}
  ]}],
  profiles:{
    marley:{name:'Марли Корсгард',handle:'@marley',bio:'Фотограф и режиссёр.',hero:'https://picsum.photos/seed/marleyh/1200/1600',posts:42,followers:'24K',following:252},
    sofia:{name:'София Беннетт',handle:'@sofia',bio:'Дизайн и путешествия.',hero:'https://picsum.photos/seed/sofiah/1200/1600',posts:18,followers:'8.2K',following:190},
    alfredo:{name:'Альфредо',handle:'@alfredo',bio:'Product design.',hero:'https://picsum.photos/seed/alfh/1200/1600',posts:67,followers:'11K',following:340}
  },
  activeChat:null,activePost:null,activeChannel:null,activeShop:null,activeProduct:null,etab:'all',
  composeImgs:[],composeChannelId:null,pendingProductImage:null,editingProductId:null,editingChannelId:null,editingShopId:null,pendingChannelCover:null,storyIdx:0,storyUser:null,storyTimer:null
});

let DB;
try{DB=JSON.parse(localStorage.getItem(LS))||defaultDB()}catch(e){DB=defaultDB()}
const def=defaultDB();
for(const k of Object.keys(def)){if(DB[k]===undefined)DB[k]=def[k]}
function save(){try{const snapshot={...DB,storyTimer:null};if(window.NEXUS_HEALTH_VAULT?.hasVault()){snapshot.fitnessProfile={};snapshot.workouts=[];snapshot.nutritionEntries=[];snapshot.healthMeasurements=[];snapshot.healthVaultUnlocked=false}localStorage.setItem(LS,JSON.stringify(snapshot));if(window.NEXUS_HEALTH_VAULT?.isUnlocked())void window.NEXUS_HEALTH_VAULT.persist(DB).catch(e=>console.warn('Health vault save failed:',e?.message||e))}catch(e){}}
