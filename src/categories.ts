import {Footprints,Waves,Store,Building2,Ship,Landmark,UtensilsCrossed,Coffee,Palette,Trees,Wine,Compass,Camera,Bookmark,ShoppingCart,ShoppingBag,Hospital} from 'lucide-react';
export const categories=[
 {name:'城市街巷',color:'#b65343',darkColor:'#f18c77',icon:Footprints,description:'走老街、看社区，感受城市日常。'},
 {name:'山海之间',color:'#357b45',darkColor:'#8bd294',icon:Waves,description:'海岸、沙滩、村落与山间步道。'},
 {name:'小店闲逛',color:'#a86a13',darkColor:'#edbb61',icon:Store,description:'逛街铺、设计店与市集，不预设商户营业。'},
 {name:'高楼与海港',color:'#356cae',darkColor:'#8bb9f3',icon:Building2,description:'看维港与高楼天际线，不包含大厦内部参观。'},
 {name:'离岛慢游',color:'#007e89',darkColor:'#70d2d8',icon:Ship,description:'去岛屿与渔村放慢脚步，可乘渡轮或公交抵达。'},
 {name:'历史建筑',color:'#80559e',darkColor:'#c3a0e5',icon:Landmark,description:'看唐楼、庙宇、历史建筑及活化空间。'},
] as const;

export function categoryColor(name:string,dark=false):string {const c=categories.find(c=>c.name===name);return c?(dark?c.darkColor:c.color):(dark?'#75cabc':'#167a74');}
export function routeCategory(route:{categories:string[]},filter=''):string {return filter&&route.categories.includes(filter)?filter:route.categories[0]??'';}

export const xhsCategoryList=[
 {name:'吃喝探店',icon:UtensilsCrossed,color:'#c2591b',darkColor:'#f3a469',bg:'#fff5ea',darkBg:'#3e2718'},
 {name:'咖啡甜品',icon:Coffee,color:'#7d4e2d',darkColor:'#dfb089',bg:'#faf3eb',darkBg:'#37281e'},
 {name:'艺术看展',icon:Palette,color:'#754694',darkColor:'#c9a3e8',bg:'#f6f0fa',darkBg:'#332440'},
 {name:'户外自然',icon:Trees,color:'#2b7749',darkColor:'#8cd2a3',bg:'#edf7f0',darkBg:'#1c3927'},
 {name:'酒吧饮品',icon:Wine,color:'#a8365b',darkColor:'#ed99b3',bg:'#fdf0f4',darkBg:'#3e1e29'},
 {name:'旅行',icon:Compass,color:'#276898',darkColor:'#8cc0ea',bg:'#edf5fb',darkBg:'#1b3142'},
 {name:'机位与拍照',icon:Camera,color:'#0e7490',darkColor:'#67d4ec',bg:'#ecfafd',darkBg:'#16353e'},
 {name:'超市',icon:ShoppingCart,color:'#1f7a5c',darkColor:'#72d9b2',bg:'#edf8f3',darkBg:'#19372d'},
 {name:'商场',icon:ShoppingBag,color:'#c2416c',darkColor:'#f48fb1',bg:'#fdf0f5',darkBg:'#3e1e2b'},
 {name:'医院',icon:Hospital,color:'#c53030',darkColor:'#fc8181',bg:'#fef2f2',darkBg:'#3d1c1c'},
 {name:'校园设施',icon:Building2,color:'#3d5a80',darkColor:'#93b4db',bg:'#eef3f8',darkBg:'#1e2b3a'},
 {name:'待分类',icon:Bookmark,color:'#5c6770',darkColor:'#adb7bf',bg:'#f2f5f7',darkBg:'#283036'},
] as const;

export function xhsCategoryMeta(name:string,dark=false){
 const c=xhsCategoryList.find(x=>x.name===name)??xhsCategoryList[0];
 return {icon:c.icon,color:dark?c.darkColor:c.color,bg:dark?c.darkBg:c.bg};
}
