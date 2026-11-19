import {type ComponentType,useEffect,useMemo,useRef,useState} from 'react';
import type {Map} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import {Search,Sun,Moon,Heart,Compass,ArrowLeft,X,ArrowUpRight,MapPin,Check,ChevronRight,ChevronDown,TrainFront,Clock,Maximize2,Route as RouteIcon,LocateFixed,Stamp} from 'lucide-react';
import MapView from './MapView';
import PlacePhoto from './PlacePhoto';
import {TransportDetails} from './Transport';
import {climbLabels,distanceKm} from './recommend';
import type {Area,City,Place,Route,Records,Coord,XhsNote,XhsSpot,MetroStation} from './types';
import {categories,categoryColor,routeCategory,xhsCategoryMeta} from './categories';

const KEY='hk-wandering.records.v1';
const SHORT_CAT:Record<string,string>={
 城市街巷:'街巷',山海之间:'山海',小店闲逛:'小店',高楼与海港:'海港',离岛慢游:'离岛',历史建筑:'古迹',
 校园设施:'校园',吃喝探店:'吃喝',咖啡甜品:'咖啡',艺术看展:'看展',户外自然:'自然',机位与拍照:'机位',酒吧饮品:'酒吧',
};
const CITY_CONFIG:Record<City,{name:string;center:Coord;zoom:number;bounds:[number,number,number,number];suggestions:string[];transitLabel:string}>={
 hk:{
  name:'香港',
  center:[114.135,22.29],
  zoom:11.5,
  bounds:[113.83,22.17,114.4,22.57],
  suggestions:['长洲','大坑','西九','中环','大潭'],
  transitLabel:'港铁出口与离开点',
 },
 sz:{
  name:'深圳',
  center:[114.06,22.545],
  zoom:11.1,
  bounds:[113.86,22.47,114.62,22.67],
  suggestions:['蛇口','南头','华侨城','盐田','大鹏'],
  transitLabel:'地铁出口与离开点',
 },
};
const emptyRecords:Records={favorites:[],visits:{},completed:{},checkins:{}};
const DEFAULT_HIDDEN_SPOT_CATS=new Set(['超市','商场','校园设施','医院']);
const defaultSpotCatsFor=(spots:XhsSpot[],c:City)=>[...new Set(spots.filter(s=>s.city===c).map(s=>s.category))].filter(cat=>!DEFAULT_HIDDEN_SPOT_CATS.has(cat));

function readRecords():{value:Records;error:string}{
 try{
  const s=localStorage.getItem(KEY);
  if(!s)return {value:emptyRecords,error:''};
  const v=JSON.parse(s);
  if(!Array.isArray(v.favorites)||!v.favorites.every((x:unknown)=>typeof x==='string')||!v.visits||!v.completed||typeof v.visits!=='object'||typeof v.completed!=='object')throw Error();
  const strMap=(x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,string>:{};
  return {value:{favorites:v.favorites,visits:v.visits,completed:v.completed,checkins:strMap(v.checkins)},error:''};
 }catch{
  return {value:emptyRecords,error:'本地记录无法读取；本次改动暂不覆盖原记录。'};
 }
}

function stayLabel(p:Place){
 return p.visitGuide.kind==='transport'?'交通接驳':`${p.visitGuide.minutes[0]}–${p.visitGuide.minutes[1]} 分钟`;
}

const initial=readRecords();

export default function App(){
 const todayStr=useMemo(()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),[]);
 const [city,setCity]=useState<City>('hk');
 const [data,setData]=useState<{areas:Area[];places:Place[];routes:Route[];xhsSpots:XhsSpot[];xhsNotes:XhsNote[];metroData:FeatureCollection|null}|null>(null);
 const [error,setError]=useState('');
 const [dark,setDark]=useState(false);
 const [query,setQuery]=useState('');
 const [view,setView]=useState<'route'|'place'|'saved'|'xhs'|'metro'|null>(null);
 const [areaId,setAreaId]=useState('');
 const [routeId,setRouteId]=useState('');
 const [placeId,setPlaceId]=useState('');
 const [xhsId,setXhsId]=useState('');
 const [xhsNoteId,setXhsNoteId]=useState('');
 const [selectedMetro,setSelectedMetro]=useState<MetroStation|null>(null);
 const [bubbleSpot,setBubbleSpot]=useState<XhsSpot|null>(null);
 const [bubbleExpanded,setBubbleExpanded]=useState(false);
 const [showRoutes,setShowRoutes]=useState(false);
 const [showMetro,setShowMetro]=useState(false);
 const [showPlaces,setShowPlaces]=useState(true);
 const [routeCats,setRouteCats]=useState<string[]|null>(null);
 const [metroLines,setMetroLines]=useState<string[]|null>(null);
 const [spotCats,setSpotCats]=useState<string[]|null>(null);
 const [openMenu,setOpenMenu]=useState<'routes'|'metro'|'places'|null>(null);
 const [savedTab,setSavedTab]=useState<'fav'|'done'>('fav');
 const [records,setRecords]=useState<Records>(initial.value);
 const [notice,setNotice]=useState(initial.error);
 const map=useRef<Map|null>(null);
 const layerRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{
  let active=true;
  Promise.all(['areas.json','places.geojson','routes.json','xhs-spots.json','xhs-unlocated.json','metro.geojson'].map(f=>fetch(`${import.meta.env.BASE_URL}data/${f}`).then(r=>{
   if(!r.ok){
    if(f.startsWith('xhs-'))return [];
    if(f==='metro.geojson')return null;
    throw Error(f);
   }
   return r.json();
  }))).then(([areas,places,routes,xhsSpots,xhsNotes,metroData])=>{
   if(active){
    const spots:XhsSpot[]=Array.isArray(xhsSpots)?xhsSpots:[];
    setSpotCats(defaultSpotCatsFor(spots,city));
    setData({areas,places:places.features.map((f:{properties:Place})=>f.properties),routes,xhsSpots:spots,xhsNotes:Array.isArray(xhsNotes)?xhsNotes:[],metroData:metroData&&metroData.type==='FeatureCollection'?metroData:null});
   }
  }).catch(()=>{if(active)setError('内容未能加载，请刷新重试。');});
  return()=>{active=false;};
 },[]);

 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
 useEffect(()=>{document.querySelector('.panel-content')?.scrollTo(0,0);},[view,areaId,routeId,placeId,xhsId,xhsNoteId]);
 useEffect(()=>{if(notice!=='已保存在这台设备')return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{
  if(!openMenu&&!bubbleSpot)return;
  const onDown=(e:PointerEvent)=>{if(openMenu&&!layerRef.current?.contains(e.target as Node))setOpenMenu(null);};
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpenMenu(null);setBubbleSpot(null);setBubbleExpanded(false);}};
  window.addEventListener('pointerdown',onDown);
  window.addEventListener('keydown',onKey);
  return()=>{window.removeEventListener('pointerdown',onDown);window.removeEventListener('keydown',onKey);};
 },[openMenu,bubbleSpot]);

 const cfg=CITY_CONFIG[city];
 const areas=data?.areas??[],places=data?.places??[],routes=data?.routes??[],xhsSpots=data?.xhsSpots??[],xhsNotes=data?.xhsNotes??[];
 const cityAreas=useMemo(()=>areas.filter(a=>(a.city??'hk')===city),[areas,city]);
 const cityRoutes=useMemo(()=>routes.filter(r=>(r.city??'hk')===city),[routes,city]);
 const cityPlaces=useMemo(()=>places.filter(p=>(p.city??'hk')===city),[places,city]);
 const cityXhs=useMemo(()=>xhsSpots.filter(s=>s.city===city),[xhsSpots,city]);

 const route=routes.find(r=>r.id===routeId),area=areas.find(a=>a.id===(route?.areaId??areaId)),place=places.find(p=>p.id===placeId),selectedXhs=xhsSpots.find(s=>s.id===xhsId),selectedXhsNote=xhsNotes.find(n=>n.id===xhsNoteId);
 const activeRoute=view==='route'||view==='place'?route:undefined;
 const areaRoutes=useMemo(()=>route?cityRoutes.filter(r=>r.areaId===route.areaId):[],[cityRoutes,route]);

 function save(next:Records){
  setRecords(next);
  if(initial.error){setNotice(initial.error);return;}
  try{localStorage.setItem(KEY,JSON.stringify(next));setNotice('已保存在这台设备');}
  catch{setNotice('浏览器无法保存，记录仅在当前页面有效。');}
 }
 function favorite(id:string){
  save({...records,favorites:records.favorites.includes(id)?records.favorites.filter(i=>i!==id):[...records.favorites,id]});
 }
 function toggleCheckin(id:string){
  const next={...(records.checkins??{})};
  if(next[id])delete next[id];
  else next[id]=todayStr;
  save({...records,checkins:next});
 }
 function toggleDone(r:Route){
  const completed={...records.completed};
  const visits={...records.visits};
  if(completed[r.id]){
   delete completed[r.id];
   if(!routes.some(x=>x.areaId===r.areaId&&x.id!==r.id&&completed[x.id]))delete visits[r.areaId];
  }else{
   completed[r.id]=todayStr;
   visits[r.areaId]=todayStr;
  }
  save({...records,completed,visits});
 }
 function fly(coord:Coord,zoom=15){
  const mobile=window.innerWidth<700;
  map.current?.flyTo({center:coord,zoom,offset:mobile?[0,-window.innerHeight*.16]:[195,0],duration:700,essential:false});
 }
 function fit(a:Area){
  map.current?.fitBounds(a.bounds,{padding:window.innerWidth<700?{top:140,bottom:window.innerHeight*.48,left:40,right:40}:{top:90,bottom:80,left:430,right:80},maxZoom:15,duration:700});
 }
 function close(){
  setView(null);setAreaId('');setPlaceId('');setRouteId('');setXhsId('');setXhsNoteId('');setSelectedMetro(null);setBubbleSpot(null);setBubbleExpanded(false);
 }
 function switchCity(next:City){
  if(next===city)return;
  setCity(next);setQuery('');setMetroLines(null);setSpotCats(data?defaultSpotCatsFor(data.xhsSpots,next):null);setOpenMenu(null);
  close();
  map.current?.fitBounds(CITY_CONFIG[next].bounds,{padding:60,duration:850});
 }
 function selectRoute(r:Route){
  const target=r.city??'hk';
  if(target!==city)setCity(target);
  setAreaId(r.areaId);setRouteId(r.id);setPlaceId('');setXhsId('');setXhsNoteId('');setSelectedMetro(null);setBubbleSpot(null);
  setShowRoutes(true);setQuery('');setView('route');
  const a=areas.find(x=>x.id===r.areaId);
  if(a)fit(a);
 }
 function selectArea(a:Area){
  const first=routes.find(r=>r.areaId===a.id);
  if(first){selectRoute(first);return;}
  fit(a);
 }
 function selectPlace(p:Place,fromRoute=false){
  const target=p.city??'hk';
  if(target!==city)setCity(target);
  if(!fromRoute)setRouteId('');
  setAreaId('');setPlaceId(p.id);setXhsId('');setXhsNoteId('');setSelectedMetro(null);setBubbleSpot(null);
  setShowPlaces(true);
  setQuery('');setView('place');fly(p.coordinates);
 }
 function focusXhs(s:XhsSpot,zoom=15.5){
  const pts=s.geometry?.features.flatMap(f=>f.geometry.coordinates)??[];
  if(pts.length>1){
   const lons=pts.map(c=>c[0]),lats=pts.map(c=>c[1]);
   map.current?.fitBounds([[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]],{padding:{top:190,bottom:80,left:60,right:60},maxZoom:16.8,duration:700});
  }else map.current?.flyTo({center:s.coordinates,zoom,offset:[0,95],duration:650,essential:false});
 }
 function previewXhs(s:XhsSpot){
  setView(null);setAreaId('');setPlaceId('');setRouteId('');setXhsId('');setXhsNoteId('');setSelectedMetro(null);
  setBubbleSpot(s);setBubbleExpanded(false);
  const z=map.current?.getZoom()??11.5;
  map.current?.easeTo({center:s.coordinates,zoom:Math.max(z,13.5),offset:[0,65],duration:450,essential:false});
 }
 function selectXhs(s:XhsSpot){
  if(s.city!==city){setCity(s.city);setSpotCats(data?defaultSpotCatsFor(data.xhsSpots,s.city):null);}
  setView(null);setAreaId('');setRouteId('');setPlaceId('');setXhsId('');setXhsNoteId('');setSelectedMetro(null);
  setBubbleSpot(s);setBubbleExpanded(true);
  setShowPlaces(true);setQuery('');focusXhs(s,15.5);
 }
 function selectXhsNote(n:XhsNote){
  if(n.city!==city)setCity(n.city);
  setAreaId('');setRouteId('');setPlaceId('');setXhsId('');setXhsNoteId(n.id);setSelectedMetro(null);setBubbleSpot(null);
  setQuery('');setView('xhs');
 }
 function selectMetroStation(s:MetroStation){
  if(s.city!==city){setCity(s.city);setMetroLines(null);}
  else if(metroLines?.length===0)setMetroLines(null);
  setAreaId('');setRouteId('');setPlaceId('');setXhsId('');setXhsNoteId('');setSelectedMetro(s);setBubbleSpot(null);
  setShowMetro(true);setQuery('');setView('metro');fly(s.coordinates,Math.max(map.current?.getZoom()??14,14.2));
 }

 const itemLabel=(id:string)=>places.find(p=>p.id===id)?.nameZh??routes.find(r=>r.id===id)?.title??xhsSpots.find(s=>s.id===id)?.name??xhsNotes.find(n=>n.id===id)?.title??'';
 const favButton=(id:string)=>{
  const saved=records.favorites.includes(id);
  const label=itemLabel(id);
  return (
   <button className={`action-pill ${saved?'is-saved':''}`} onClick={()=>favorite(id)} aria-label={`${saved?'取消收藏':'收藏'}${label}`}>
    <Heart size={14} fill={saved?'currentColor':'none'}/><span>{saved?'已收藏':'收藏'}</span>
   </button>
  );
 };
 const placeActions=(id:string)=>{
  const label=itemLabel(id);
  const checked=!!records.checkins?.[id];
  return (
   <>
    {favButton(id)}
    <button className={`action-pill ${checked?'is-checkin':''}`} aria-pressed={checked} aria-label={`${checked?'取消打卡':'打卡'}${label}`} onClick={()=>toggleCheckin(id)}>
     <Stamp size={14}/><span>{checked?'已打卡':'打卡'}</span>
    </button>
   </>
  );
 };

 const routeRow=(r:Route,meta?:string)=>{
  const climb=r.climbLevel??'moderate';
  const visitLabel=r.visitMinutes<=120?'2 小时':r.visitMinutes<=300?'半天':'一天';
  const color=categoryColor(routeCategory(r,''),dark);
  return (
   <button className="list-row clean-row" key={r.id} onClick={()=>selectRoute(r)}>
    <i className="row-dot" style={{background:color}}/>
    <span className="row-body">
     <strong>{r.title}{records.completed[r.id]?' · 已走过':''}</strong>
     <small>{((r.distance??0)/1000).toFixed(1)} km · 步行 {r.walkingMinutes??0} 分钟 · {meta||climbLabels[climb]}</small>
    </span>
    <span className="row-end">
     <em>{visitLabel}</em>
     <ChevronRight size={14}/>
    </span>
   </button>
  );
 };

 const qLower=query.trim().toLowerCase();
 const searchResults=qLower?[
  ...routes.map(r=>({id:r.id,city:r.city??'hk' as City,name:r.title,en:(areas.find(a=>a.id===r.areaId)?.nameEn??'')+' '+r.categories.join(' '),type:'route' as const,obj:r})),
  ...places.map(p=>({id:p.id,city:p.city??'hk' as City,name:p.nameZh,en:p.nameEn??'',type:'place' as const,obj:p})),
  ...xhsSpots.map(s=>({id:s.id,city:s.city,name:s.name,en:s.category+' '+s.address,type:'xhs' as const,obj:s})),
  ...xhsNotes.map(n=>({id:n.id,city:n.city,name:n.title,en:n.category+' '+n.hints.join(' '),type:'xhsNote' as const,obj:n})),
 ].filter(x=>(x.name+x.en).toLowerCase().includes(qLower)).sort((a,b)=>Number(b.city===city)-Number(a.city===city)).slice(0,10):[];

 const xhsCats=useMemo(()=>{
  const m:Record<string,number>={};
  for(const s of cityXhs)m[s.category]=(m[s.category]??0)+1;
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
 },[cityXhs]);

 const cityMetroLines=useMemo(()=>{
  const seen=new Set<string>();
  const out:{name:string;color:string}[]=[];
  for(const f of data?.metroData?.features??[]){
   const pr=f.properties;
   if(!pr||pr.kind!=='line'||pr.city!==city)continue;
   const name=String(pr.name??'');
   if(!name||seen.has(name))continue;
   seen.add(name);
   out.push({name,color:String(pr.color??'#167a74')});
  }
  return out;
 },[data?.metroData,city]);
 const allRouteCatNames=useMemo(()=>categories.map(c=>c.name as string),[]);
 const allMetroLineNames=useMemo(()=>cityMetroLines.map(l=>l.name),[cityMetroLines]);
 const allSpotCatNames=useMemo(()=>xhsCats.map(([c])=>c),[xhsCats]);
 const activeRouteCats=useMemo(()=>routeCats===null?allRouteCatNames:routeCats,[routeCats,allRouteCatNames]);
 const activeMetroLines=useMemo(()=>metroLines===null?allMetroLineNames:metroLines,[metroLines,allMetroLineNames]);
 const activeSpotCats=useMemo(()=>spotCats===null?allSpotCatNames:spotCats,[spotCats,allSpotCatNames]);
 const showRoutesEffective=showRoutes&&activeRouteCats.length>0;
 const showMetroEffective=showMetro&&activeMetroLines.length>0;
 const showPlacesEffective=showPlaces&&activeSpotCats.length>0;
 const mapXhsSpots=useMemo(()=>{
  if(spotCats===null)return cityXhs;
  return cityXhs.filter(s=>spotCats.includes(s.category)||s.id===bubbleSpot?.id);
 },[cityXhs,spotCats,bubbleSpot?.id]);
 function toggleLayerCat(name:string,allNames:string[],visible:boolean,selected:string[]|null,setSelected:(v:string[]|null)=>void,setVisible:(v:boolean)=>void){
  if(!visible){setSelected([name]);setVisible(true);return;}
  const cur=selected===null?allNames:selected;
  const next=cur.includes(name)?cur.filter(x=>x!==name):[...cur,name];
  setSelected(next.length===allNames.length?null:next);
  setVisible(next.length>0);
 }
 const routeBtnLabel=!showRoutesEffective||routeCats===null?'线路':routeCats.length===1?`线路 · ${SHORT_CAT[routeCats[0]]??routeCats[0].slice(0,2)}`:`线路 · ${routeCats.length}`;
 const metroBtnLabel=!showMetroEffective||metroLines===null?'地铁':metroLines.length===1?`地铁 · ${metroLines[0]}`:`地铁 · ${metroLines.length}`;
 const placeBtnLabel=!showPlacesEffective||spotCats===null?'地点':spotCats.length===1?`地点 · ${SHORT_CAT[spotCats[0]]??spotCats[0].slice(0,2)}`:`地点 · ${spotCats.length}`;
 const layerControls:{key:'routes'|'metro'|'places';label:string;allLabel:string;caretAria:string;menuAria:string;icon:ComponentType<{size?:number}>;visible:boolean;effective:boolean;selected:string[]|null;allNames:string[];activeNames:string[];setVisible:(v:boolean)=>void;setSelected:(v:string[]|null)=>void;items:{name:string;color:string;icon:ComponentType<{size?:number}>}[]}[]=[
  {key:'routes',label:routeBtnLabel,allLabel:'全部线路',caretAria:'细分线路类别',menuAria:'线路类别细分',icon:RouteIcon,visible:showRoutes,effective:showRoutesEffective,selected:routeCats,allNames:allRouteCatNames,activeNames:activeRouteCats,setVisible:setShowRoutes,setSelected:setRouteCats,items:categories.map(({name,icon})=>({name,color:categoryColor(name,dark),icon}))},
  {key:'metro',label:metroBtnLabel,allLabel:'全部地铁',caretAria:'细分地铁线路',menuAria:'地铁线路细分',icon:TrainFront,visible:showMetro,effective:showMetroEffective,selected:metroLines,allNames:allMetroLineNames,activeNames:activeMetroLines,setVisible:setShowMetro,setSelected:setMetroLines,items:cityMetroLines.map(({name,color})=>({name,color,icon:TrainFront}))},
  {key:'places',label:placeBtnLabel,allLabel:'全部地点',caretAria:'细分地点类别',menuAria:'地点类别细分',icon:MapPin,visible:showPlaces,effective:showPlacesEffective,selected:spotCats,allNames:allSpotCatNames,activeNames:activeSpotCats,setVisible:setShowPlaces,setSelected:setSpotCats,items:xhsCats.map(([c])=>{const xm=xhsCategoryMeta(c,dark);return {name:c,color:xm.color,icon:xm.icon};})},
 ];

 const favItems=useMemo(()=>{
  const list:{id:string;kind:'route'|'place'|'xhs';city:City;title:string;cat:string;sub:string;obj:Route|Place|XhsSpot|XhsNote;isNote?:boolean}[]=[];
  for(const r of routes)if(records.favorites.includes(r.id))list.push({id:r.id,kind:'route',city:r.city??'hk',title:r.title,cat:r.categories[0]??'路线',sub:`路线 · ${((r.distance??0)/1000).toFixed(1)} km`,obj:r});
  for(const p of places)if(records.favorites.includes(p.id))list.push({id:p.id,kind:'place',city:p.city??'hk',title:p.nameZh,cat:p.categories[0]??'地点',sub:`地点 · ${stayLabel(p)}`,obj:p});
  for(const s of xhsSpots)if(records.favorites.includes(s.id))list.push({id:s.id,kind:'xhs',city:s.city,title:s.name,cat:s.category,sub:s.category,obj:s});
  for(const n of xhsNotes)if(records.favorites.includes(n.id))list.push({id:n.id,kind:'xhs',city:n.city,title:n.title,cat:n.category,sub:`待定位 · ${n.category}`,obj:n,isNote:true});
  return list;
 },[routes,places,xhsSpots,xhsNotes,records.favorites]);
 const completedRoutes=useMemo(()=>routes.filter(r=>records.completed[r.id]),[routes,records.completed]);
 const spotFootprints=useMemo(()=>{
  const list:{id:string;kind:'place'|'xhs';city:City;title:string;cat:string;sub:string;obj:Place|XhsSpot|XhsNote;isNote?:boolean}[]=[];
  const tag=(id:string)=>records.checkins?.[id]?`打卡 ${records.checkins[id]}`:'';
  for(const p of places){const sub=tag(p.id);if(sub)list.push({id:p.id,kind:'place',city:p.city??'hk',title:p.nameZh,cat:p.categories[0]??'地点',sub,obj:p});}
  for(const s of xhsSpots){const sub=tag(s.id);if(sub)list.push({id:s.id,kind:'xhs',city:s.city,title:s.name,cat:s.category,sub,obj:s});}
  for(const n of xhsNotes){const sub=tag(n.id);if(sub)list.push({id:n.id,kind:'xhs',city:n.city,title:n.title,cat:n.category,sub,obj:n,isNote:true});}
  return list;
 },[places,xhsSpots,xhsNotes,records.checkins]);
 const footprintCount=completedRoutes.length+spotFootprints.length;

 const nearbyRoutes=bubbleSpot?cityRoutes.map(r=>{const a=areas.find(x=>x.id===r.areaId);return a?{r,km:distanceKm(bubbleSpot.coordinates,a.coordinates)}:null;}).filter((x):x is {r:Route;km:number}=>!!x).sort((a,b)=>a.km-b.km).slice(0,2):[];
 const metroNearbyRoutes=selectedMetro?cityRoutes.map(r=>{const a=areas.find(x=>x.id===r.areaId);return a?{r,km:distanceKm(selectedMetro.coordinates,a.coordinates)}:null;}).filter((x):x is {r:Route;km:number}=>!!x).sort((a,b)=>a.km-b.km).slice(0,4):[];
 const metroNearbySpots=selectedMetro?cityXhs.map(s=>({s,km:distanceKm(selectedMetro.coordinates,s.coordinates)})).sort((a,b)=>a.km-b.km).slice(0,5):[];

 const spotBubble=bubbleSpot?(()=>{
  const bm=xhsCategoryMeta(bubbleSpot.category,dark);
  const BIcon=bm.icon;
  const saved=records.favorites.includes(bubbleSpot.id);
  const checked=!!records.checkins?.[bubbleSpot.id];
  const navUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bubbleSpot.name+(bubbleSpot.city==='sz'?' 深圳':' 香港'))}`;
  return (
   <div className={`spot-bubble ${bubbleExpanded?'is-expanded':''}`} role="dialog" aria-label={bubbleSpot.name} onClick={e=>e.stopPropagation()}>
    <div className="spot-bubble-head">
     <span className="spot-bubble-cat" style={{color:bm.color}}><BIcon size={12}/><span>{bubbleSpot.category}</span></span>
     <button className="spot-bubble-close" aria-label="关闭气泡" onClick={()=>{setBubbleSpot(null);setBubbleExpanded(false);}}><X size={13}/></button>
    </div>
    <h2 className="spot-bubble-title">{bubbleSpot.name}</h2>
    {bubbleExpanded?(
     <>
      {(bubbleSpot.address||bubbleSpot.hours)&&(
       <div className="spot-bubble-meta">
        {bubbleSpot.address&&<p><MapPin size={12}/><span>{bubbleSpot.address}</span></p>}
        {bubbleSpot.hours&&<p><Clock size={12}/><span>{bubbleSpot.hours}</span></p>}
       </div>
      )}
      <div className="spot-bubble-actions">
       <button className={`spot-bubble-btn ${saved?'is-saved':''}`} aria-pressed={saved} onClick={()=>favorite(bubbleSpot.id)}>
        <Heart size={12} fill={saved?'currentColor':'none'}/><span>{saved?'已收藏':'收藏'}</span>
       </button>
       <button className={`spot-bubble-btn ${checked?'is-checkin':''}`} aria-pressed={checked} onClick={()=>toggleCheckin(bubbleSpot.id)}>
        <Stamp size={12}/><span>{checked?'已打卡':'打卡'}</span>
       </button>
       <a className="spot-bubble-btn" href={navUrl} target="_blank" rel="noreferrer">
        <ArrowUpRight size={12}/><span>导航</span>
       </a>
      </div>
      {nearbyRoutes.length>0&&(
       <div className="spot-bubble-routes">
        <div className="spot-bubble-routes-title">顺路路线</div>
        <div className="spot-bubble-routes-list">
         {nearbyRoutes.map(({r,km})=>(
          <button key={r.id} className="spot-bubble-route-row" onClick={()=>selectRoute(r)}>
           <i className="row-dot" style={{background:categoryColor(routeCategory(r,''),dark)}}/>
           <span className="row-body">
            <strong>{r.title}</strong>
            <small>{((r.distance??0)/1000).toFixed(1)} km · 距 {km.toFixed(1)} km</small>
           </span>
           <ChevronRight size={13}/>
          </button>
         ))}
        </div>
       </div>
      )}
     </>
    ):(
     <>
      {(bubbleSpot.address||bubbleSpot.hours)&&<p className="spot-bubble-sub">{bubbleSpot.address||bubbleSpot.hours}</p>}
      <div className="spot-bubble-actions">
       <button className={`spot-bubble-btn ${saved?'is-saved':''}`} aria-pressed={saved} onClick={()=>favorite(bubbleSpot.id)}>
        <Heart size={12} fill={saved?'currentColor':'none'}/><span>{saved?'已收藏':'收藏'}</span>
       </button>
       <button className={`spot-bubble-btn ${checked?'is-checkin':''}`} aria-pressed={checked} onClick={()=>toggleCheckin(bubbleSpot.id)}>
        <Stamp size={12}/><span>{checked?'已打卡':'打卡'}</span>
       </button>
       <a className="spot-bubble-btn" href={navUrl} target="_blank" rel="noreferrer">
        <ArrowUpRight size={12}/><span>导航</span>
       </a>
       <button className="spot-bubble-btn is-detail" onClick={()=>{setBubbleExpanded(true);focusXhs(bubbleSpot,Math.max(map.current?.getZoom()??14,14.5));}}>
        <span>详情</span><ChevronRight size={12}/>
       </button>
      </div>
     </>
    )}
   </div>
  );
 })():null;

 if(error)return <main className="load-error"><h1>港深生活指南</h1><p>{error}</p><button onClick={()=>window.location.reload()}>重新加载</button></main>;
 if(!data)return <main className="load-error"><Compass/><p>正在打开港深生活指南…</p></main>;

 return (
  <main className="app">
   <MapView
    cityName={cfg.name}
    routes={cityRoutes}
    onRoute={selectRoute}
    dark={dark}
    areas={cityAreas}
    places={cityPlaces}
    category=""
    activeArea={undefined}
    selectedPlace={place}
    route={activeRoute}
    panel={!!view}
    visits={records.visits}
    onArea={selectArea}
    onPlace={p=>selectPlace(p,!!activeRoute)}
    onReady={m=>{map.current=m;}}
    xhsSpots={mapXhsSpots}
    showXhs={!!bubbleSpot&&bubbleExpanded}
    selectedXhs={bubbleSpot??undefined}
    onXhs={previewXhs}
    favorites={records.favorites}
    showRoutes={showRoutesEffective}
    routeCats={routeCats}
    showPlaces={showPlacesEffective}
    showMetro={showMetroEffective}
    metroLines={metroLines}
    metroData={data.metroData}
    selectedMetro={selectedMetro}
    onMetroStation={selectMetroStation}
    bubbleCoord={bubbleSpot?.coordinates}
    bubble={spotBubble}
    onMapClick={()=>{setBubbleSpot(null);setBubbleExpanded(false);}}
   />

   <header className="topbar">
    <div className="city-switch" role="group" aria-label="选择漫游城市">
     {(['hk','sz'] as const).map(c=>(
      <button key={c} className={city===c?'active':''} aria-pressed={city===c} onClick={()=>switchCity(c)}>{CITY_CONFIG[c].name}</button>
     ))}
    </div>
    <div className="search-wrap">
     <Search size={14}/>
     <input aria-label="搜索路线、地点或去处" maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索…"/>
     {query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><X size={13}/></button>}
     {query&&(
      <div className="search-results">
       {searchResults.length?searchResults.map(x=>(
        <button key={x.type+x.id} onClick={()=>x.type==='route'?selectRoute(x.obj as Route):x.type==='place'?selectPlace(x.obj as Place):x.type==='xhs'?selectXhs(x.obj as XhsSpot):selectXhsNote(x.obj as XhsNote)}>
         <MapPin size={15}/>
         <span>{x.name}<small>{x.city==='sz'?'深圳':'香港'} · {x.type==='route'?'路线':x.type==='xhs'?'去处':x.type==='xhsNote'?'灵感':'地点'}</small></span>
         <ChevronRight size={14}/>
        </button>
       )):(
        <div className="search-empty">
         <p>无匹配结果，可试试：</p>
         <div className="search-suggestions">{cfg.suggestions.map(k=><button key={k} className="chip" onClick={()=>setQuery(k)}>{k}</button>)}</div>
        </div>
       )}
      </div>
     )}
    </div>
    <div className="topbar-tools">
     <button className={`icon-button ${view==='saved'?'active':''}`} aria-label="收藏与足迹" title="收藏与足迹" aria-pressed={view==='saved'} onClick={()=>{if(view==='saved')close();else{close();setView('saved');}}}><Heart size={15} fill={view==='saved'?'currentColor':'none'}/></button>
     <button className="icon-button" aria-label={`查看${cfg.name}全域`} title={`查看${cfg.name}全域`} onClick={()=>{close();map.current?.fitBounds(cfg.bounds,{padding:60,duration:800});}}><LocateFixed size={15}/></button>
     <button className="icon-button" aria-label={dark?'切换浅色地图':'切换深色地图'} title={dark?'浅色底图':'深色底图'} onClick={()=>setDark(!dark)}>{dark?<Sun size={15}/>:<Moon size={15}/>}</button>
    </div>
   </header>

   <div className="layer-bar" ref={layerRef} role="group" aria-label="地图显示开关">
    <div className="layer-track">
     {layerControls.map(({key,label,allLabel,caretAria,menuAria,icon:MainIcon,visible,effective,selected,allNames,activeNames,setVisible,setSelected,items})=>(
      <div className={`layer-split ${effective?'active':''}`} key={key}>
       <button className="layer-main" aria-pressed={effective} onClick={()=>{if(effective)setVisible(false);else{if(selected?.length===0)setSelected(null);setVisible(true);}}}><MainIcon size={13}/><span>{label}</span></button>
       <button className={`layer-caret ${openMenu===key?'open':''}`} aria-label={caretAria} aria-expanded={openMenu===key} onClick={()=>setOpenMenu(m=>m===key?null:key)}><ChevronDown size={12}/></button>
       {openMenu===key&&(
        <div className="layer-menu" role="menu" aria-label={menuAria}>
         <button className={`layer-all-btn ${effective&&selected===null?'on':''}`} role="menuitemcheckbox" aria-checked={effective&&selected===null} onClick={()=>{if(effective&&selected===null)setVisible(false);else{setSelected(null);setVisible(true);}}}>
          <span className="layer-orb" style={effective&&selected===null?{color:'var(--accent)'}:undefined}><MainIcon size={12}/></span><span>{allLabel}</span>
         </button>
         <div className="layer-sep"/>
         <div className="layer-grid">
          {items.map(({name,color,icon:ItemIcon})=>{
           const on=visible&&activeNames.includes(name);
           return (
            <button className={`layer-chip-btn ${on?'on':''}`} key={name} style={on?{color}:undefined} role="menuitemcheckbox" aria-checked={on} onClick={()=>toggleLayerCat(name,allNames,visible,selected,setSelected,setVisible)}>
             <span className="layer-orb"><ItemIcon size={12}/></span><span>{name}</span>
            </button>
           );
          })}
         </div>
        </div>
       )}
      </div>
     ))}
    </div>
   </div>

   {view&&(
    <aside className={`panel panel-${view}`} aria-label="漫游面板">
     <div className="panel-handle"/>
     <div className="panel-top">
      {view==='saved'?(
       <span className="panel-title">收藏与足迹</span>
      ):view==='place'&&route?(
       <button className="back-button" onClick={()=>{setPlaceId('');setView('route');}}><ArrowLeft size={14}/><span>返回路线</span></button>
      ):(
       <span className="panel-detail-label">{{route:'路线详情',place:'站点详情',metro:'地铁站点',xhs:'去处详情'}[view]}</span>
      )}
      <div className="panel-top-right">
       {view==='place'&&route&&<span className="panel-detail-label">站点详情</span>}
       <button className="panel-close" aria-label="关闭面板" title="关闭" onClick={close}><X size={15}/></button>
      </div>
     </div>

     <div className="panel-content">
      {view==='route'&&route&&(()=>{
       const climb=route.climbLevel??'moderate';
       const visitLabel=route.visitMinutes<=120?'约 2 小时':route.visitMinutes<=300?'约半天':'约一天';
       const primaryCat=routeCategory(route,'');
       const catColor=categoryColor(primaryCat,dark);
       return (
        <>
         {areaRoutes.length>1&&(
          <div className="panel-tabs sub-tabs">
           {areaRoutes.map(r=>(
            <button key={r.id} className={r.id===route.id?'active':''} onClick={()=>selectRoute(r)}>{r.title}</button>
           ))}
          </div>
         )}
         {primaryCat&&<span className="detail-badge" style={{color:catColor}}><i style={{background:catColor}}/>{primaryCat}</span>}
         <h1>{route.title}</h1>
         <p className="lead">{route.description}</p>
         <div className="stat-strip">
          <div><strong>{route.distance===null?'—':`${(route.distance/1000).toFixed(1)} km`}</strong><span>步行 {route.walkingMinutes??0} 分</span></div>
          <div><strong>{visitLabel}</strong><span>建议游玩</span></div>
          <div><strong>{climbLabels[climb]}</strong><span>坡度难度</span></div>
         </div>
         <div className="detail-actions">
          {favButton(route.id)}
          <button className={`action-pill ${records.completed[route.id]?'is-done':''}`} onClick={()=>toggleDone(route)}>
           <Check size={14}/><span>{records.completed[route.id]?'已走过':'标记走过'}</span>
          </button>
          {area&&<button className="action-pill" onClick={()=>fit(area)}><Maximize2 size={13}/><span>全域</span></button>}
         </div>
         <h2 className="section-label">沿途 {route.placeIds.length} 站</h2>
         <ol className="route-stops clean-stops">
          {route.placeIds.map((id,i)=>{
           const p=places.find(x=>x.id===id);
           if(!p)return null;
           const node=route.transportNodes.find(n=>n.stopIndex===i&&n.exitOrStop);
           return (
            <li key={`${id}-${i}`}>
             <button onClick={()=>selectPlace(p,true)}>
              <span className="stop-number">{i+1}</span>
              <span className="stop-title"><strong>{p.nameZh}</strong></span>
              <small className="stop-side-meta">{node?.exitOrStop||stayLabel(p)}</small>
              <ChevronRight size={14}/>
             </button>
            </li>
           );
          })}
         </ol>
         <details className="transit-drawer">
          <summary>交通指引与注意事项</summary>
          <div className="transit-drawer-body">
           <p>{route.transport}</p>
           {route.climbNote&&<p className="muted">{route.climbNote}</p>}
           {route.busDistance&&<p className="info-card">城巴 260 · 巴士段约 {(route.busDistance/1000).toFixed(1)} km（浅水湾泳滩站 → 赤柱村站）</p>}
           <p className="muted">{route.notes}</p>
           <TransportDetails route={route} places={places} onPlace={p=>selectPlace(p,true)}/>
          </div>
         </details>
        </>
       );
      })()}

      {view==='place'&&place&&(
       <>
        <span className="detail-badge"><MapPin size={11}/>{stayLabel(place)}</span>
        <h1>{place.nameZh}</h1>
        {place.nameEn&&<p className="detail-sub">{place.nameEn}</p>}
        <PlacePhoto key={place.id} place={place} onLocate={c=>fly(c??place.coordinates,16)} routePosition={route?`第 ${route.placeIds.indexOf(place.id)+1} / ${route.placeIds.length} 站`:undefined}/>
        <p className="lead">{place.description}</p>
        <div className="detail-actions">
         {placeActions(place.id)}
         <a className="action-pill" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameZh+(place.city==='sz'?' 深圳':' 香港'))}`} target="_blank" rel="noreferrer"><ArrowUpRight size={14}/><span>导航</span></a>
        </div>
        <h2 className="section-label">看点</h2>
        <ul className="sight-highlights">{place.visitGuide.highlights.map(item=><li key={item}>{item}</li>)}</ul>
       </>
      )}

      {view==='saved'&&(()=>{
       const spotRow=(x:{id:string;kind:'route'|'place'|'xhs';city:City;title:string;cat:string;sub:string;obj:Route|Place|XhsSpot|XhsNote;isNote?:boolean})=>{
        const xm=x.kind==='xhs'?xhsCategoryMeta(x.cat,dark):null;
        const ItemIcon=xm?xm.icon:MapPin;
        return (
         <button className="list-row clean-row" key={x.id} onClick={()=>x.kind==='place'?selectPlace(x.obj as Place):x.isNote?selectXhsNote(x.obj as XhsNote):selectXhs(x.obj as XhsSpot)}>
          <span className="spot-icon" style={{color:xm?.color??'var(--accent)'}}><ItemIcon size={15}/></span>
          <span className="row-body"><strong>{x.title}</strong><small>{x.city==='sz'?'深圳':'香港'} · {x.sub}</small></span>
          <span className="row-end"><ChevronRight size={14}/></span>
         </button>
        );
       };
       return (
        <>
         <div className="panel-tabs sub-tabs">
          <button className={savedTab==='fav'?'active':''} onClick={()=>setSavedTab('fav')}>收藏 · {favItems.length}</button>
          <button className={savedTab==='done'?'active':''} onClick={()=>setSavedTab('done')}>足迹 · {footprintCount}</button>
         </div>
         <div className="clean-list">
          {savedTab==='fav'?(
           favItems.length?favItems.map(x=>x.kind==='route'?routeRow(x.obj as Route):spotRow(x)):<p className="empty">暂无收藏，浏览路线或去处时可点击收藏。</p>
          ):(
           footprintCount?(
            <>
             {completedRoutes.map(r=>routeRow(r,`走过 ${records.completed[r.id]}`))}
             {spotFootprints.map(spotRow)}
            </>
           ):<p className="empty">暂无足迹，在路线或地点页点击「标记走过」「打卡」即可记录。</p>
          )}
         </div>
        </>
       );
      })()}

      {view==='metro'&&selectedMetro&&(
       <>
        <span className="detail-badge" style={{color:selectedMetro.color}}><TrainFront size={12}/>{selectedMetro.city==='sz'?'深圳地铁':'香港港铁'}{selectedMetro.interchange?' · 换乘':''}</span>
        <h1>{selectedMetro.name}站</h1>
        <p className="detail-sub">{selectedMetro.lineLabel}</p>
        <h2 className="section-label">附近路线</h2>
        <div className="clean-list">{metroNearbyRoutes.map(({r,km})=>routeRow(r,`距 ${km.toFixed(1)} km`))}</div>
        {metroNearbySpots.length>0&&(
         <>
          <h2 className="section-label">附近去处</h2>
          <div className="clean-list">
           {metroNearbySpots.map(({s,km})=>{
            const sm=xhsCategoryMeta(s.category,dark);
            const SIcon=sm.icon;
            return (
             <button className="list-row clean-row" key={s.id} onClick={()=>selectXhs(s)}>
              <span className="spot-icon" style={{color:sm.color}}><SIcon size={15}/></span>
              <span className="row-body"><strong>{s.name}</strong><small>{s.category}</small></span>
              <span className="row-end"><em>{km<1?`${Math.round(km*1000)}m`:`${km.toFixed(1)}km`}</em><ChevronRight size={14}/></span>
             </button>
            );
           })}
          </div>
         </>
        )}
       </>
      )}

      {view==='xhs'&&selectedXhsNote&&(()=>{
       const nm=xhsCategoryMeta(selectedXhsNote.category,dark);
       const NIcon=nm.icon;
       return (
        <>
         <span className="detail-badge" style={{color:nm.color}}><NIcon size={12}/>{selectedXhsNote.category} · 待定位</span>
         <h1>{selectedXhsNote.title}</h1>
         {selectedXhsNote.hints.length>0&&<p className="detail-addr"><MapPin size={13}/><span>{selectedXhsNote.hints.join(' · ')}</span></p>}
         <div className="detail-actions">
          {placeActions(selectedXhsNote.id)}
         </div>
        </>
       );
      })()}
     </div>
    </aside>
   )}

   {(showRoutesEffective||showMetroEffective)&&(
    <div className="map-legend legend" aria-label="地图图例">
     {showRoutesEffective&&<><i className="walk-line" style={activeRoute?{borderColor:categoryColor(routeCategory(activeRoute,''),dark)}:undefined}/><span>步行</span>
     <i className="bus-line" style={activeRoute?.busDistance?{borderColor:categoryColor(routeCategory(activeRoute,''),dark)}:undefined}/><span>{activeRoute?.busDistance?'城巴 260':'巴士'}</span>
     <i className="ferry-line"/><span>渡轮</span></>}
     {showMetroEffective&&<><i className="metro-swatch"/><span>地铁</span></>}
    </div>
   )}

   {notice&&(
    <div className="toast" role="status">
     <span>{notice}</span>
     <button aria-label="关闭提示" onClick={()=>setNotice('')}><X size={15}/></button>
    </div>
   )}
  </main>
 );
}
