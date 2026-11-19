import {type ReactNode,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Map,NavigationControl,ScaleControl,setWorkerUrl,type DataDrivenPropertyValueSpecification,type GeoJSONSource,type MapLayerMouseEvent} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Camera,MapPin} from 'lucide-react';
import {TransportIcon,roleLabels} from './Transport';
import {categoryColor,routeCategory,xhsCategoryList,xhsCategoryMeta} from './categories';
import {mapStyle} from './style';
import type {Area,Place,Route,Coord,XhsSpot,MetroStation} from './types';
setWorkerUrl(workerUrl);
interface Props {cityName?:string;dark:boolean;routes:Route[];onRoute:(r:Route)=>void;areas:Area[];places:Place[];category:string;activeArea?:Area;selectedPlace?:Place;route?:Route;panel:boolean;visits:Record<string,string>;onArea:(a:Area)=>void;onPlace:(p:Place)=>void;onReady:(m:Map)=>void;location?:Coord;xhsSpots?:XhsSpot[];showXhs?:boolean;selectedXhs?:XhsSpot;onXhs?:(s:XhsSpot)=>void;favorites?:string[];showRoutes?:boolean;routeCats?:string[]|null;showPlaces?:boolean;showMetro?:boolean;metroLines?:string[]|null;metroData?:FeatureCollection|null;selectedMetro?:MetroStation|null;onMetroStation?:(s:MetroStation)=>void;bubbleCoord?:Coord;bubble?:ReactNode;onMapClick?:()=>void}

const SPOT_ICON_PATHS:Record<string,string[]>={
 吃喝探店:['M6 3v6a3 3 0 0 0 6 0V3','M9 3v18','M17 3v18','M17 3c2.5 2 2.5 6 0 8'],
 咖啡甜品:['M5 9h10v6a4.5 4.5 0 0 1-9 0V9z','M15 10.5h2a2 2 0 0 1 0 4h-2','M4 20h12'],
 艺术看展:['M4 5h16v14H4z','M6.5 16l4-4 3 3 2-2 3.5 3','M9 9.5a.8.8 0 1 0 0 .01'],
 户外自然:['M3 18l5.5-9.5 4 6.5 3-4.5L21 18z'],
 酒吧饮品:['M6 4h12l-6 7.5V19','M8.5 19h7'],
 旅行:['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z','M15.5 8.5l-2 4.5-4.5 2 2-4.5z'],
 机位与拍照:['M4 8h3l2-2h6l2 2h3v10H4z','M12 10a3 3 0 1 0 0 6 3 3 0 1 0 0-6z'],
 超市:['M6 6h15l-1.5 7.5H8z','M3 4h2l2.5 11.5h10.5','M9.5 19a1 1 0 1 0 0 2 1 1 0 1 0 0-2z','M17.5 19a1 1 0 1 0 0 2 1 1 0 1 0 0-2z'],
 商场:['M6 8h12l-1 12H7L6 8z','M9 8V6a3 3 0 0 1 6 0v2'],
 医院:['M9 4h6v5h5v6h-5v5H9v-5H4V9h5z'],
 校园设施:['M5 20V8l7-4 7 4v12','M9.5 20v-4.5h5V20','M9.5 10.5h1','M13.5 10.5h1'],
 待分类:['M7 4h10v16l-5-3.2L7 20z'],
};

function drawSpotBadge(fill:string,stroke:string,iconColor:string,paths:string[],halo='#ffffff'){
 const size=56,c=document.createElement('canvas');
 c.width=size;c.height=size;
 const ctx=c.getContext('2d');
 if(!ctx)return null;
 const cx=size/2,cy=size/2,r=21;
 ctx.save();
 ctx.shadowColor='rgba(16,36,40,0.22)';
 ctx.shadowBlur=4;
 ctx.shadowOffsetY=1.5;
 ctx.beginPath();
 ctx.arc(cx,cy,r,0,Math.PI*2);
 ctx.fillStyle=halo;
 ctx.fill();
 ctx.restore();
 ctx.beginPath();
 ctx.arc(cx,cy,r-1.5,0,Math.PI*2);
 ctx.fillStyle=fill;
 ctx.fill();
 ctx.lineWidth=2.6;
 ctx.strokeStyle=stroke;
 ctx.stroke();
 ctx.save();
 const s=0.88;
 ctx.translate(cx-12*s,cy-12*s);
 ctx.scale(s,s);
 ctx.strokeStyle=iconColor;
 ctx.lineWidth=2.1;
 ctx.lineCap='round';
 ctx.lineJoin='round';
 for(const d of paths)ctx.stroke(new Path2D(d));
 ctx.restore();
 return ctx.getImageData(0,0,size,size);
}

function ensureSpotImages(m:Map,dark:boolean){
 const suffix=dark?'d':'l';
 const halo=dark?'#152e32':'#ffffff';
 for(const c of xhsCategoryList){
  const fill=dark?c.darkBg:c.bg,color=dark?c.darkColor:c.color;
  const paths=SPOT_ICON_PATHS[c.name]??SPOT_ICON_PATHS.吃喝探店;
  const id=`spot-${c.name}-${suffix}`;
  if(!m.hasImage(id)){
   const img=drawSpotBadge(fill,color,color,paths,halo);
   if(img)m.addImage(id,img,{pixelRatio:2});
  }
  const selId=`spot-sel-${c.name}-${suffix}`;
  if(!m.hasImage(selId)){
   const img=drawSpotBadge(color,halo,'#fffef8',paths,halo);
   if(img)m.addImage(selId,img,{pixelRatio:2});
  }
 }
}

function createArrowImage(){
 const size=24,c=document.createElement('canvas');
 c.width=size;c.height=size;
 const ctx=c.getContext('2d');
 if(!ctx)return null;
 ctx.translate(size/2,size/2);
 ctx.beginPath();
 ctx.moveTo(-4,-5);
 ctx.lineTo(4,0);
 ctx.lineTo(-4,5);
 ctx.lineJoin='round';
 ctx.lineCap='round';
 ctx.lineWidth=4.2;
 ctx.strokeStyle='#152e32';
 ctx.stroke();
 ctx.lineWidth=2.2;
 ctx.strokeStyle='#fffef8';
 ctx.stroke();
 return ctx.getImageData(0,0,size,size);
}

export default function MapView(p:Props){
 const container=useRef<HTMLDivElement>(null),markersRef=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null);
 const [,render]=useState(0);
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const latest=useRef(p);latest.current=p;
 const appliedTheme=useRef(p.dark);

 const syncDOMMarkers=()=>{
  const m=map.current,root=markersRef.current;
  if(!m||!root)return;
  for(const el of root.children as HTMLCollectionOf<HTMLElement>){
   const lng=Number(el.dataset.lng),lat=Number(el.dataset.lat);
   if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
   const pt=m.project([lng,lat]);
   const x=Math.round(pt.x),y=Math.round(pt.y);
   if(el.dataset.anchor==='bubble'){el.style.transform=`translate3d(${x}px,${y}px,0)`;continue;}
   const ay=el.dataset.anchor==='bottom'?'-100%':el.dataset.anchor==='cam'?'-135%':'-50%';
   el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,${ay})`;
  }
 };

 useEffect(()=>{
  if(!container.current)return;
  let disposed=false;let m:Map;
  try{m=new Map({container:container.current,style:mapStyle(latest.current.dark),center:[114.135,22.29],zoom:11.5,minZoom:8,maxZoom:19,attributionControl:{compact:true}});}catch{setFailed(true);return;}
  map.current=m;latest.current.onReady(m);
  m.addControl(new NavigationControl({visualizePitch:true}),'bottom-right');
  m.addControl(new ScaleControl({maxWidth:100}),'bottom-left');
  const update=()=>{if(!disposed)render(v=>v+1);};
  m.on('move',syncDOMMarkers);
  m.on('resize',syncDOMMarkers);
  m.on('moveend',update);
  m.on('load',()=>{if(!disposed){setLoaded(true);setFailed(false);update();syncDOMMarkers();}});
  m.on('error',()=>{if(!disposed)setFailed(true);});
  m.on('idle',()=>{if(!disposed&&m.areTilesLoaded()){setLoaded(true);setFailed(false);}});
  const timeout=setTimeout(()=>{if(!disposed&&!m.loaded())setFailed(true);},18000);
  return()=>{disposed=true;clearTimeout(timeout);m.off('move',syncDOMMarkers);m.off('resize',syncDOMMarkers);m.off('moveend',update);m.remove();map.current=null;};
 },[retry]);

 useEffect(()=>{const m=map.current;if(!m||appliedTheme.current===p.dark)return;appliedTheme.current=p.dark;m.setStyle(mapStyle(p.dark));const onStyle=()=>{render(x=>x+1);syncDOMMarkers();};m.once('style.load',onStyle);return()=>{m.off('style.load',onStyle);};},[p.dark]);

 useEffect(()=>{
  const m=map.current;if(!m)return;
  const draw=()=>{
   const showR=p.showRoutes!==false;
   const vis=showR?'visible':'none';
   const focused=p.route?.id??(p.selectedPlace?p.routes.find(r=>r.placeIds.includes(p.selectedPlace!.id))?.id:undefined);
   const visible=p.routes.filter(r=>(r.status==='network-checked'||r.id===focused)&&(!p.activeArea||r.areaId===p.activeArea.id)&&(!p.category||r.categories.includes(p.category))&&(!p.routeCats||r.id===focused||r.categories.some(c=>p.routeCats!.includes(c))));
   const features=visible.sort((a,b)=>Number(a.id===focused)-Number(b.id===focused)).flatMap(r=>{
    const matchCat=p.category||(p.routeCats?.length?r.categories.find(c=>p.routeCats!.includes(c)):'')||'';
    return r.geometry.features.map(f=>({...f,properties:{...f.properties,routeId:r.id,color:categoryColor(routeCategory(r,matchCat),p.dark),selected:r.id===focused,dimmed:!!focused&&r.id!==focused}}));
   });
   const data={type:'FeatureCollection' as const,features};
   if(!m.hasImage('route-arrow')){
    const img=createArrowImage();
    if(img)m.addImage('route-arrow',img);
   }
   const routeLayerIds=['route-halo','route-walk','route-bus','route-ferry','route-metro','route-arrows','route-hit'] as const;
   if(m.getSource('walk-route')){
    (m.getSource('walk-route') as GeoJSONSource).setData(data);
    for(const lid of routeLayerIds)if(m.getLayer(lid))m.setLayoutProperty(lid,'visibility',vis);
    for(const mode of ['walk','bus','ferry','metro'])if(m.getLayer(`route-${mode}`))m.setPaintProperty(`route-${mode}`,'line-color',['get','color']);
    if(m.getLayer('route-halo'))m.setPaintProperty('route-halo','line-color',p.dark?'#152e32':'#fffef8');
    return;
   }
   m.addSource('walk-route',{type:'geojson',data,attribution:'路线：<a href="https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson">© 香港特区政府 运输署 / DATA.GOV.HK</a>'});
   m.addLayer({id:'route-halo',type:'line',source:'walk-route',layout:{'line-cap':'round','line-join':'round',visibility:vis},paint:{'line-color':p.dark?'#152e32':'#fffef8','line-width':['case',['get','selected'],9,6],'line-opacity':['case',['get','dimmed'],0.25,0.8]}});
   for(const [mode,dash] of [['walk',null],['bus',[3,2]],['ferry',[1,2]],['metro',[4,1,1,1]]] as const){
    m.addLayer({id:`route-${mode}`,type:'line',source:'walk-route',filter:['==',['get','mode'],mode],layout:{'line-cap':'round','line-join':'round',visibility:vis},paint:{'line-color':['get','color'],'line-width':['case',['get','selected'],5,3.5],'line-opacity':['case',['get','dimmed'],0.22,['get','selected'],1,0.75],...(dash?{'line-dasharray':[...dash]}:{})}});
   }
   m.addLayer({id:'route-arrows',type:'symbol',source:'walk-route',filter:['==',['get','selected'],true],layout:{'symbol-placement':'line','symbol-spacing':90,'icon-image':'route-arrow','icon-size':0.85,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'map',visibility:vis},paint:{'icon-opacity':0.95}});
   m.addLayer({id:'route-hit',type:'line',source:'walk-route',layout:{visibility:vis},paint:{'line-color':'#167a74','line-width':24,'line-opacity':0}});
  };
  const pick=(e:MapLayerMouseEvent)=>{
   const topLayers=['xhs-spot-sel-dot','xhs-spot-dot','metro-station-dot','metro-station-label'].filter(id=>!!m.getLayer(id));
   if(topLayers.length&&m.queryRenderedFeatures(e.point,{layers:topLayers}).length)return;
   const features=e.features??[];const feature=features.find(f=>f.properties.selected)??features[0];const route=latest.current.routes.find(r=>r.id===feature?.properties.routeId);if(route)latest.current.onRoute(route);
  };
  const enter=()=>{m.getCanvas().style.cursor='pointer';};const leave=()=>{m.getCanvas().style.cursor='';};
  if(m.getSource('walk-route')||m.isStyleLoaded())draw();m.on('style.load',draw);m.on('click','route-hit',pick);m.on('mouseenter','route-hit',enter);m.on('mouseleave','route-hit',leave);
  return()=>{m.off('style.load',draw);m.off('click','route-hit',pick);m.off('mouseenter','route-hit',enter);m.off('mouseleave','route-hit',leave);};
 },[p.route,p.routes,p.category,p.activeArea,p.selectedPlace,p.showRoutes,p.routeCats,p.dark,loaded,retry]);

 useEffect(()=>{
  const m=map.current;if(!m)return;
  const drawTrail=()=>{
   const showTrail=(p.showRoutes!==false)&&(p.showXhs||!!p.selectedXhs);
   const list=showTrail?(p.xhsSpots??[]).filter(s=>!!s.geometry):[];
   const features=list.flatMap(s=>{
    const sel=s.id===p.selectedXhs?.id;
    const meta=xhsCategoryMeta(s.category,p.dark);
    return (s.geometry?.features??[]).map(f=>({...f,properties:{...f.properties,color:meta.color,selected:sel,dimmed:!!p.selectedXhs&&!sel}}));
   });
   const data={type:'FeatureCollection' as const,features};
   if(m.getSource('xhs-trail')){
    (m.getSource('xhs-trail') as GeoJSONSource).setData(data);
    if(m.getLayer('xhs-trail-halo'))m.setPaintProperty('xhs-trail-halo','line-color',p.dark?'#152e32':'#fffef8');
    return;
   }
   m.addSource('xhs-trail',{type:'geojson',data});
   m.addLayer({id:'xhs-trail-halo',type:'line',source:'xhs-trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':p.dark?'#152e32':'#fffef8','line-width':['case',['get','selected'],9,5.5],'line-opacity':['case',['get','dimmed'],0.25,0.88]}});
   m.addLayer({id:'xhs-trail-line',type:'line',source:'xhs-trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['case',['get','selected'],5,3],'line-opacity':['case',['get','dimmed'],0.3,1],'line-dasharray':[2.5,1.5]}});
   m.addLayer({id:'xhs-trail-arrows',type:'symbol',source:'xhs-trail',filter:['==',['get','selected'],true],layout:{'symbol-placement':'line','symbol-spacing':80,'icon-image':'route-arrow','icon-size':0.85,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'map'},paint:{'icon-opacity':0.95}});
  };
  if(m.getSource('xhs-trail')||m.isStyleLoaded())drawTrail();m.on('style.load',drawTrail);
  return()=>{m.off('style.load',drawTrail);};
 },[p.xhsSpots,p.selectedXhs,p.showXhs,p.showRoutes,p.dark,loaded,retry]);

 useEffect(()=>{
  const m=map.current;if(!m)return;
  const layerIds=['xhs-spot-dot','xhs-spot-sel-dot'] as const;
  const drawSpots=()=>{
   ensureSpotImages(m,p.dark);
   const vis=p.showPlaces!==false?'visible':'none';
   const suffix=p.dark?'d':'l';
   const halo=p.dark?'#12262a':'#fffef8';
   const labelColor=p.dark?'#e3efef':'#1b3539';
   const favSet=new Set(p.favorites??[]);
   const features=(p.xhsSpots??[]).map(s=>{
    const sel=s.id===p.selectedXhs?.id;
    const isFav=favSet.has(s.id);
    const catOk=SPOT_ICON_PATHS[s.category]?s.category:'待分类';
    const prio=sel?0:isFav?1:s.category==='艺术看展'||s.category==='户外自然'?2:s.category==='咖啡甜品'||s.category==='机位与拍照'||s.category==='酒吧饮品'?3:s.category==='校园设施'?5:4;
    return {
     type:'Feature' as const,
     geometry:{type:'Point' as const,coordinates:s.coordinates},
     properties:{id:s.id,name:s.name,shortName:s.name.length>12?s.name.slice(0,12)+'…':s.name,selected:sel,priority:prio,icon:sel?`spot-sel-${catOk}-${suffix}`:`spot-${catOk}-${suffix}`}
    };
   });
   const data={type:'FeatureCollection' as const,features};
   const textField:DataDrivenPropertyValueSpecification<string>=p.showXhs?['get','shortName']:['step',['zoom'],'',13,['get','shortName']];
   if(m.getSource('xhs-spots')){
    (m.getSource('xhs-spots') as GeoJSONSource).setData(data);
    for(const lid of layerIds){
     if(m.getLayer(lid)){
      m.setLayoutProperty(lid,'visibility',vis);
      m.setPaintProperty(lid,'text-color',labelColor);
      m.setPaintProperty(lid,'text-halo-color',halo);
     }
    }
    if(m.getLayer('xhs-spot-dot'))m.setLayoutProperty('xhs-spot-dot','text-field',textField);
    return;
   }
   m.addSource('xhs-spots',{type:'geojson',data});
   m.addLayer({
    id:'xhs-spot-dot',type:'symbol',source:'xhs-spots',
    filter:['!=',['get','selected'],true],
    layout:{visibility:vis,'icon-image':['get','icon'],'icon-size':['interpolate',['linear'],['zoom'],10.5,0.82,13,0.94,16,1.05],'icon-allow-overlap':false,'icon-padding':3,'text-field':textField,'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,1.28],'text-anchor':'top','text-optional':true,'symbol-sort-key':['get','priority']},
    paint:{'text-color':labelColor,'text-halo-color':halo,'text-halo-width':2}
   });
   m.addLayer({
    id:'xhs-spot-sel-dot',type:'symbol',source:'xhs-spots',
    filter:['==',['get','selected'],true],
    layout:{visibility:vis,'icon-image':['get','icon'],'icon-size':1.08,'icon-allow-overlap':true,'icon-ignore-placement':true,'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-offset':[0,1.38],'text-anchor':'top','text-allow-overlap':true,'text-ignore-placement':true},
    paint:{'text-color':labelColor,'text-halo-color':halo,'text-halo-width':2.2}
   });
  };
  const pickSpot=(e:MapLayerMouseEvent)=>{
   const f=e.features?.[0];if(!f)return;
   const id=String(f.properties?.id??'');
   const spot=(latest.current.xhsSpots??[]).find(x=>x.id===id);
   if(spot)latest.current.onXhs?.(spot);
  };
  const enterSpot=()=>{m.getCanvas().style.cursor='pointer';};
  const leaveSpot=()=>{m.getCanvas().style.cursor='';};
  if(m.getSource('xhs-spots')||m.isStyleLoaded())drawSpots();
  m.on('style.load',drawSpots);
  for(const lid of layerIds){
   m.on('click',lid,pickSpot);m.on('mouseenter',lid,enterSpot);m.on('mouseleave',lid,leaveSpot);
  }
  return()=>{
   m.off('style.load',drawSpots);
   for(const lid of layerIds){
    m.off('click',lid,pickSpot);m.off('mouseenter',lid,enterSpot);m.off('mouseleave',lid,leaveSpot);
   }
  };
 },[p.xhsSpots,p.selectedXhs,p.showXhs,p.showPlaces,p.favorites,p.dark,loaded,retry]);

 const onMetroRef=useRef(p.onMetroStation);
 onMetroRef.current=p.onMetroStation;
 useEffect(()=>{
  const m=map.current,metroData=p.metroData;if(!m||!metroData)return;
  const layerIds=['metro-casing','metro-line','metro-station-dot','metro-station-label'] as const;
  const drawMetro=()=>{
   const vis=p.showMetro?'visible':'none';
   const halo=p.dark?'#12262a':'#fffef8';
   const labelColor=p.dark?'#e3efef':'#1b3539';
   const lines=p.metroLines;
   const filteredMetroData:FeatureCollection=lines==null?metroData:{
    type:'FeatureCollection',
    features:metroData.features.filter(f=>{
     const pr=f.properties??{};
     if(pr.kind==='line')return lines.includes(String(pr.name??''));
     if(pr.kind==='station')return String(pr.lineLabel??'').split(' / ').some(ln=>lines.includes(ln));
     return false;
    }),
   };
   const src=m.getSource('metro') as GeoJSONSource|undefined;
   if(src){
    src.setData(filteredMetroData);
    for(const id of layerIds)if(m.getLayer(id))m.setLayoutProperty(id,'visibility',vis);
    if(m.getLayer('metro-casing'))m.setPaintProperty('metro-casing','line-color',halo);
    if(m.getLayer('metro-station-dot'))m.setPaintProperty('metro-station-dot','circle-stroke-color',['case',['get','interchange'],labelColor,['get','color']]);
    if(m.getLayer('metro-station-label')){
     m.setPaintProperty('metro-station-label','text-color',labelColor);
     m.setPaintProperty('metro-station-label','text-halo-color',halo);
    }
    return;
   }
   m.addSource('metro',{type:'geojson',data:filteredMetroData});
   const beforeId=m.getLayer('route-halo')?'route-halo':undefined;
   m.addLayer({id:'metro-casing',type:'line',source:'metro',filter:['==',['get','kind'],'line'],layout:{'line-cap':'round','line-join':'round',visibility:vis},paint:{'line-color':halo,'line-width':['interpolate',['linear'],['zoom'],10,2.8,13,4.2,16,5.5],'line-opacity':0.85}},beforeId);
   m.addLayer({id:'metro-line',type:'line',source:'metro',filter:['==',['get','kind'],'line'],layout:{'line-cap':'round','line-join':'round',visibility:vis},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],10,1.5,13,2.5,16,3.4],'line-opacity':0.82}},beforeId);
   m.addLayer({id:'metro-station-dot',type:'circle',source:'metro',filter:['==',['get','kind'],'station'],minzoom:10.5,layout:{visibility:vis},paint:{'circle-radius':['interpolate',['linear'],['zoom'],10.5,['case',['get','interchange'],3.6,2.6],13,['case',['get','interchange'],5.2,3.8],16,['case',['get','interchange'],7,5.2]],'circle-color':'#ffffff','circle-stroke-width':['case',['get','interchange'],2.2,1.8],'circle-stroke-color':['case',['get','interchange'],labelColor,['get','color']],'circle-opacity':0.98}},beforeId);
   m.addLayer({id:'metro-station-label',type:'symbol',source:'metro',filter:['==',['get','kind'],'station'],minzoom:11.8,layout:{visibility:vis,'symbol-sort-key':['case',['get','interchange'],0,1],'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],11.8,10.5,14,12,16,13.5],'text-offset':[0,0.85],'text-anchor':'top','text-optional':true},paint:{'text-color':labelColor,'text-halo-color':halo,'text-halo-width':1.8}});
  };
  const pickStation=(e:MapLayerMouseEvent)=>{
   const f=e.features?.[0];if(!f||!onMetroRef.current)return;
   const pr=f.properties??{};
   const coords=(f.geometry&&f.geometry.type==='Point'?f.geometry.coordinates:[e.lngLat.lng,e.lngLat.lat]) as Coord;
   onMetroRef.current({name:String(pr.name??''),city:pr.city==='sz'?'sz':'hk',color:String(pr.color??'#167a74'),interchange:Boolean(pr.interchange),lineLabel:String(pr.lineLabel??''),coordinates:coords});
  };
  const enterStation=()=>{m.getCanvas().style.cursor='pointer';};
  const leaveStation=()=>{m.getCanvas().style.cursor='';};
  if(m.getSource('metro')||m.isStyleLoaded())drawMetro();
  m.on('style.load',drawMetro);
  for(const lid of ['metro-station-dot','metro-station-label'] as const){
   m.on('click',lid,pickStation);m.on('mouseenter',lid,enterStation);m.on('mouseleave',lid,leaveStation);
  }
  return()=>{
   m.off('style.load',drawMetro);
   for(const lid of ['metro-station-dot','metro-station-label'] as const){
    m.off('click',lid,pickStation);m.off('mouseenter',lid,enterStation);m.off('mouseleave',lid,leaveStation);
   }
  };
 },[p.metroData,p.showMetro,p.metroLines,p.dark,loaded,retry]);

 const onMapClickRef=useRef(p.onMapClick);
 onMapClickRef.current=p.onMapClick;
 useEffect(()=>{
  const m=map.current;if(!m)return;
  const onBgClick=(e:MapLayerMouseEvent)=>{
   if(!onMapClickRef.current)return;
   const hitLayers=['xhs-spot-sel-dot','xhs-spot-dot','metro-station-dot','metro-station-label','route-hit'].filter(id=>!!m.getLayer(id));
   if(hitLayers.length&&m.queryRenderedFeatures(e.point,{layers:hitLayers}).length)return;
   onMapClickRef.current();
  };
  m.on('click',onBgClick);
  return()=>{m.off('click',onBgClick);};
 },[loaded,retry]);

 const m=map.current;
 const transport=p.route?.transportNodes??[];
 const stopIndicesByPlace:Record<string,number[]>={};
 (p.route?.placeIds??[]).forEach((id,idx)=>{(stopIndicesByPlace[id]??=[]).push(idx+1);});
 const shown=transport.filter((n,i)=>transport.findIndex(t=>t.placeId===n.placeId)===i).map(n=>{
  const place=p.places.find(x=>x.id===n.placeId);if(!place)return null;
  const roles=transport.filter(t=>t.placeId===n.placeId).map(t=>t.role);
  const isStart=roles.includes('start'),isEnd=roles.includes('end');
  const label=isStart&&isEnd?'起 · 终':roleLabels[n.role];
  const orderText=(stopIndicesByPlace[n.placeId]??[]).join('/');
  const kind=isStart&&isEnd?'is-loop':isStart?'is-start':isEnd?'is-end':'';
  return {node:n,place,label,orderText,endpoint:isStart||isEnd,kind};
 }).filter(n=>n!==null);

 const transportIds=new Set(shown.map(n=>n.place.id));
 const sightStops=(p.route?.placeIds??[]).filter((id,i,arr)=>arr.indexOf(id)===i&&!transportIds.has(id)).map(id=>{
  const place=p.places.find(x=>x.id===id);
  return place?{place,orderText:(stopIndicesByPlace[id]??[]).join('/')}:null;
 }).filter(x=>x!==null);

 const showSpots=p.showPlaces!==false;
 const camCoord=showSpots&&p.selectedPlace?.photo?.locationKind==='camera-verified'?p.selectedPlace.photo.cameraCoordinates:undefined;

 useLayoutEffect(syncDOMMarkers);

 const posStyle=(c:Coord,ay='-50%')=>{
  if(!m)return undefined;
  const pt=m.project(c);
  const x=Math.round(pt.x),y=Math.round(pt.y);
  if(ay==='bubble')return {transform:`translate3d(${x}px,${y}px,0)`};
  return {transform:`translate3d(${x}px,${y}px,0) translate(-50%,${ay})`};
 };

 return <>
  <div className="map-canvas" ref={container} aria-label={`${p.cityName??'香港'}互动地图`}/>
  <div className="map-markers" ref={markersRef} aria-label="路线交通节点与编号站点">
   {m&&showSpots&&sightStops.filter(s=>s.place.id!==p.selectedPlace?.id).map(({place,orderText})=>(
    <button key={`stop-${place.id}`} className="stop-pin" data-lng={place.coordinates[0]} data-lat={place.coordinates[1]} style={posStyle(place.coordinates)} title={`第 ${orderText} 站 · ${place.nameZh}`} aria-label={`第 ${orderText} 站：${place.nameZh}`} onClick={()=>p.onPlace(place)}>
     <b>{orderText}</b>
    </button>
   ))}
   {m&&showSpots&&shown.filter(n=>n.place.id!==p.selectedPlace?.id).map(({node,place,label,orderText,endpoint,kind})=>(
    <button key={place.id} className={`transport-marker ${endpoint?'endpoint':''} ${kind}`} data-lng={place.coordinates[0]} data-lat={place.coordinates[1]} style={posStyle(place.coordinates)} title={`第 ${orderText} 站 · ${label} · ${place.nameZh} · ${node.service}`} aria-label={`第 ${orderText} 站 ${label}：${place.nameZh}，${node.service}`} onClick={()=>p.onPlace(place)}>
     <span className="tm-orb"><TransportIcon mode={node.mode}/></span>
     <b>{label}</b>
    </button>
   ))}
   {m&&showSpots&&p.selectedPlace&&(
    <button className="selected-place-pin" data-lng={p.selectedPlace.coordinates[0]} data-lat={p.selectedPlace.coordinates[1]} data-anchor="bottom" style={posStyle(p.selectedPlace.coordinates,'-100%')} onClick={()=>p.onPlace(p.selectedPlace!)} aria-label={`当前地点：${p.selectedPlace.nameZh}`}>
     <MapPin size={17}/>
     <span>{stopIndicesByPlace[p.selectedPlace.id]?.length?`${stopIndicesByPlace[p.selectedPlace.id].join('/')}. `:''}{p.selectedPlace.nameZh}</span>
    </button>
   )}
   {m&&camCoord&&(
    <button className="camera-pin" data-lng={camCoord[0]} data-lat={camCoord[1]} data-anchor="cam" style={posStyle(camCoord,'-135%')} title={`已核实拍摄机位（距景点约 ${p.selectedPlace?.photo?.cameraDistanceMeters??0} 米）`} aria-label="已核实拍摄机位" onClick={()=>m.flyTo({center:camCoord,zoom:Math.max(m.getZoom(),16.5),duration:500})}>
     <Camera size={13}/>
     <span>机位</span>
    </button>
   )}
   {m&&p.location&&<i className="location-dot" data-lng={p.location[0]} data-lat={p.location[1]} style={posStyle(p.location)}/>}
   {m&&p.showMetro&&p.selectedMetro&&<i className="selected-metro-pin" data-lng={p.selectedMetro.coordinates[0]} data-lat={p.selectedMetro.coordinates[1]} style={{...posStyle(p.selectedMetro.coordinates),borderColor:p.selectedMetro.color}}/>}
   {m&&p.bubbleCoord&&p.bubble&&(
    <div className="spot-bubble-anchor" data-lng={p.bubbleCoord[0]} data-lat={p.bubbleCoord[1]} data-anchor="bubble" style={posStyle(p.bubbleCoord,'bubble')}>
     {p.bubble}
    </div>
   )}
  </div>
  {(!loaded||failed)&&<div className="map-status" role="status">{failed?<>地图资源未完整加载 <button onClick={()=>{setFailed(false);setLoaded(false);setRetry(x=>x+1);}}>重试地图</button></>:`正在展开${p.cityName??'香港'}地图…`}</div>}
 </>;
}
