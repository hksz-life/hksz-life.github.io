# 数据来源与复用范围

核对日期：2026-11-02。各地点精确来源见 `public/data/places.geojson`，路由请求见 `public/data/routes.json`，原始响应在 `data/raw/`。这些是静态网络资料，不是实地调查或实时开放数据。

## 产品参考

- [杭州慢游](https://github.com/HainaHuang729/hangzhou-slow-walk)：全屏地图、浅深主题、标记避让。独立实现，没有复制源代码。
- [Neihou](https://neihou.app/zh-Hans/)：把地点、徒步、交通放在地图上；标明公告快照不代表开放。仅研究体验，未抓取其数据库。
- [Walkin’HK](https://usecases.csdi.geodata.gov.hk/walkinhk/?frame=tools&lang=sc)：政府三维行人网络的步行可达性案例。未调用内部 API 或复制路网。
- [Anitabi](https://github.com/anitabi/anitabi-swift-app)：文化作品与地点关联。只保留带证实状态的 Story 模型，没有影视图片。

## 内容来源

| 片区 | 主要资料 |
| --- | --- |
| 浅水湾—赤柱 | [旅发局浅水湾](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-repulse-bay.html)、[城巴 260 资料](https://www.citybus.com.hk/en/uploadedPressRelease/21535_20250530_ENG.pdf) |
| 石澳 | [旅发局石澳泳滩](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-shek-o-beach.html)、[城巴 9](https://mobile.citybus.com.hk/nwp3/?f=1&ds=9&dsmode=1&l=1) |
| 坚尼地城 | [旅发局坚尼地城](https://www.discoverhongkong.com/eng/neighbourhoods/central-and-western-district/how-to-spend-your-day-in-kennedy-town.html) |
| 上环—西营盘、中环—半山 | [旅发局中西区](https://www.discoverhongkong.com/eng/neighbourhoods/central-and-western-district.html)、[古迹办上环文物径指南](https://www.amo.gov.hk/filemanager/amo/common/download-area/pamphlet/Sheung_Wan_Guide_Map_2019.pdf)；未复制原图或宣称本路线是官方文物径 |
| 湾仔 | [旅发局蓝屋](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-the-blue-house.html) |
| 深水埗 | [旅发局深水埗](https://www.discoverhongkong.com/eng/neighbourhoods/sham-shui-po.html) |
| 油麻地—佐敦—尖沙咀 | [旅发局油麻地戏院](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-yau-ma-tei-theatre.html)、OSM 地点与路网 |
| 长洲 | [旅发局长洲](https://www.discoverhongkong.com/eng/neighbourhoods/outlying-islands/cheung-chau-island-hopping.html)、[新渡轮](https://www.sunferry.com.hk/en/route-and-fare/timetable?route=central-to-cheung-chau) |
| 南丫岛 | [旅发局郊游](https://www.discoverhongkong.com/eng/outdoors/city-to-wild-in-minutes-hong-kongs-easy-escapes.html)、[港九小轮步行路线](https://hkkf.com.hk/en/lamma-island/lamma-island-hiking-trails-places-of-interest/) |
| 大澳 | [旅发局大澳](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-tai-o.html)、[新大屿山巴士 11](https://www.nlb.com.hk/en/route/13) |

地铁接驳参考 [港铁系统图](https://www.mtr.com.hk/en/customer/services/system_map.html)。车站坐标是 OSM 站点代表坐标，不承诺具体出口和无障碍通道。

## 地理数据

- `places.geojson` 及嵌入 `routes.json` 中标为 OSM 来源的衍生地理数据：© OpenStreetMap contributors，[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)。公开分发时保留此许可、署名和可下载地理数据。应用代码与旅游文章不是从 OSM 复制。
- [OpenFreeMap](https://openfreemap.org/) 提供矢量底图；前端永久保留署名。底图使用 OpenMapTiles schema。服务需要联网，无服务可用性保证。
- [FOSSGIS / OSRM](https://routing.openstreetmap.de/about.html) 提供 foot profile。开发阶段少量串行路线请求，间隔 >1 秒，原始响应缓存，前端不进行远程算路。遵守最多每秒一次、不得重度使用的政策。保留修正地图链接。
- [Nominatim 使用政策](https://operations.osmfoundation.org/policies/nominatim/)：仅用于本次少量固定地点研究；单线程、间隔 >1 秒、自定义 User-Agent、缓存。禁止用公共实例提供自动补全或高流量搜索；本应用搜索完全离线查本地 JSON。
- 地点只标代表点；片区 bounds 是围绕所选地点的编辑浏览范围，不是行政区划或声称精确的文化边界。

## 核实方法与边界

1. 先用旅游/政府/运营方资料确认地点、片区及接驳。
2. 用 OSM 查询地点并人工检查名称、对象类型、所属街区。修正了“赤柱村误当赤柱市场”“桥旁商户误当桥梁”的结果，原始响应保留。
3. foot 路由穿过所选地点，缓存完整几何、道路步骤、距离、模型时间、吸附偏移。核对方向、道路名称、几何连续性及 POI 顺序。
4. `npm run check:data` 检查地理范围、ID 引用、吸附偏移、折线点数、异常长线段及几何长度与返回距离误差；输出 `route-audit.json`。
5. 这些检查证明路线来自路网，不证明当天路权、施工、场馆开门、台阶条件。尤其大馆/扶梯段受开放时间与方向影响。未实地踏查或取得 GPS 实测。

游玩时长、各地点的停留区间与适宜时段是编辑建议。路网步行时间由服务模型估算；没有补充虚构票价、开放时间或公共交通耗时。雨天、无台阶、独行适宜等缺少证据的偏好不标记为满足。

不转载旅游网站照片、书页地图或未经授权的影视截图。


## 浅水湾—赤柱补充核实

已取得运输署 [Bus Route](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) 的公开 FeatureServer 数据，及 [巴士站次资料](https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json)。几何数据集元数据更新日 2026-09-25，本次获取日 2026-11-02。

- 线路 `ROUTE_ID=1526`、`ROUTE_SEQ=1`、`COMPANY_CODE=CTB`、`ROUTE_NAMEE=260`。
- 从站次 11（浅水湾泳滩，浅水湾道）到站次 22（赤柱村，赤柱村道）。不使用反向线，也不使用编号相同的特别班次 8590。
- 从官方 MultiLineString 选取原始成员索引 11–21，坐标保持不变；转换为单独 LineString features 以便样式渲染。逐段端点连续，上下车站点距道路中心线小于 15 米。没有用站点连线替代线路。
- 前后步行分别由 foot profile 查询并缓存 `route-repulse-transport-arrival.json` 与 `route-repulse-transport-departure.json`；步行约 1,737 米，模型时间向上取整 24 分钟。巴士线路段几何长约 4,641 米，不提供虚构巴士耗时。
- 浅水湾泳滩是代表点，距步行路网起点约 53 米，界面已注明；线路不绘制该代表点与路网之间的假连接。
- 政府数据按 [DATA.GOV.HK 使用条款](https://data.gov.hk/en/terms-and-conditions) 使用，保留 © 香港特别行政区政府 运输署 / DATA.GOV.HK 署名与产权归属。政府来源与 ODbL 数据在 feature 上区分；不将政府数据声称为 OSM 或自行许可。

## 维护

已核对内容以 `public/data/` 为交付版本。重新收集并不等于通过核实；不要把脚本返回状态当作实地审核。

1. 固定候选地点研究：`collect.py`，修正查询：`refine.py`。缓存原始结果，检查名称/对象类型/坐标。
2. `build-routes.py` 从缓存或少量新请求生成步行候选；人工核对沿途道路、访问条件。
3. `complete-transit.py` 使用缓存的运输署站点与线路几何补齐混合路线；官方数据更新后先核对站序和原始线段索引，再执行，不能盲目沿用索引。
4. 当前内容含手工编辑的交通说明、开放限制和来源字段；重建时审阅差异，保留这些核对结果。
5. `npm run check:data`、`npm run check:recommend`，再进行地图视觉核对。

运输署原始响应：`td-260.json`（从全港站表筛选的 260 记录）、`td-260-geometry.geojson`、`td-bus-layer.json`、`td-bus-metadata.json`。来源和 SHA-256 见 source-manifest。


## 地点游玩指南补充（2026-11-02）

42 个地点分别补充 `visitGuide`：停留区间、2 个主要看点、公共交通分步骤、交通及景点来源。25 个景点按各自内容给出编辑建议；17 个车站/码头/巴士站作为交通节点，不把候车、候船写成固定游玩时间。数据以实际 `kind` 字段为准。

交通从明确的枢纽出发（中环、筲箕湾、东涌、相应港铁站等），没有假设用户所在位置或虚构到达车程。末段依据已有地点、路网与街道位置给出步行方向，不当作新的导航折线。

新增具体参考：[PMQ 官方访客资料](https://www.pmq.org.hk/tourist-information/explore-pmq/)、[大馆官方访客指引](https://www.taikwun.hk/en/visit/visiting_information)、[港铁中环站街道图](https://www.mtr.com.hk/archive/en/services/maps/cen.pdf)、[政府西港城介绍](https://www.gohk.gov.hk/en/spots/spot_detail.php?spot=Western+Market)。只引用经核对的出口；其他地点保留站名和街道方向，不推测出口编号。

停留时间不是官方强制时长，也不含用餐、交通和演出。建筑、庙宇等对室内开放未知的部分使用外观参观或条件性说明。西港城只安排外观，不承诺进入商铺。

编辑源在 `data/editorial/place-guides.json`。重新生成基础地理数据后运行 `python3 scripts/enrich-places.py`，可重新应用指南而不改变坐标或路线几何。


### 交通起终点补充（2026-11-02）

- 运输署 JSON_BUS.json 原始记录节选：`data/raw/td-route-endpoints.geojson`。城巴 9 ROUTE_ID 1637（石澳）、新大屿山巴士 11 ROUTE_ID 1724（大澳）、城巴 260 ROUTE_ID 1526 方向 2 第 1 站（赤柱回程）。坐标、运营商链接与原始更新日保留，沿用政府开放数据条款。
- 港铁网络依据：https://www.mtr.com.hk/en/customer/services/system_map.html ，页面缓存 `data/raw/mtr-system-map.html`。新增上环、中环、油麻地、佐敦、尖沙咀坐标由 Nominatim 的 railway/station 对象取得（ODbL），排除同名巴士站，原始 JSON 留档。
- `route-*-transport*.json`：起终点连接后的完整 FOSSGIS OSRM foot 路由，保留逐段 legs、snap 偏移、几何及模型时间。图层每段保留 rawFile 与 requestUrl，可审计；不是实地 GPS 轨迹。


### 实景照片

见 [25 张照片的作者、授权与原图清单](PHOTOS.md)。使用 Wikimedia Commons API 保存逐文件 extmetadata；没有把搜索结果顺序当成地理核实，已剔除同名不同地点和无关建筑。图片定位沿用地点代表坐标。


### 新增五片区

西贡、沙田—城门河、观塘海滨、坪洲、梅窝的来源与边界见 [扩展记录](EXPANSION-FIVE.md)。

### 《香港散步學》十条路线核对与扩展（2026-11-16）

大坑、宝马山—北角、西半山、鸭脷洲—香港仔、牛池湾—新蒲岗、石硖尾、土瓜湾、沙田（大围至沥源长线）、将军澳、荃湾—深井的 KML 核对记录、OSM 独立坐标来源与 OSRM 路网边界见 [《香港散步學》扩展记录](STROLLOLOGY-TEN.md)。读者 Google My Maps 原始 KML 仅留存于 `data/raw/hk-strollology/` 供研究比对，未将 Google POI 坐标或底图直接用于前端发布。

### 优先及全部规划片区收官扩展与交通 / 照片机位核实（2026-11-16）

新增北角—鲗鱼涌（康文署鲗鱼涌公园及林边红屋资料）、尖沙咀—西九（西九文化区 M+、香港故宫文化博物馆及戏曲中心访客指引）、九龙城（康文署九龙寨城公园及古迹办宋王台刻石资料）、大埔（香港铁路博物馆及大埔海滨公园资料）、大潭（水务署大潭水务文物径资料）、东涌（古迹办东涌小炮台及东涌炮台资料）、黄大仙—钻石山（啬色园及南莲园池资料）。全线补齐港铁出口/巴士方向站位及沿途提前离开节点；所有原始文件 SHA-256 记录见 `docs/source-manifest.json`。

### 十五条新增主题路线与实景照片扩展（2026-11-16）

新增 4 大主题共 15 个片区与 15 条真实步行路线，全部独立取得 Nominatim OSM 对象坐标并通过 FOSSGIS OSRM `routed-foot` 步行路网验证：
- **港岛街区与山海**：跑马地（香港赛马博物馆与香港电车系统资料）、筲箕湾—阿公岩（香港抗战及海防博物馆资料）、铜锣湾—加路连山（旅发局铜锣湾社区资料）、太平山顶—卢吉道（旅发局山顶环回步行径及山顶缆车资料）。
- **九龙生活与海角**：鲤鱼门（旅发局鲤鱼门及运输署渡轮航线资料）、红磡—黄埔海滨（康文署及港铁观塘线资料）、荔枝角—美孚（饶宗颐文化馆及康文署荔枝角公园资料）、大角咀—渡船角（康文署及港铁东涌线资料）。
- **官方文物径与历史走廊**：元朗屏山文物径（古物古迹办事处官方文物径指南）、粉岭龙跃头文物径（古物古迹办事处官方文物径及九巴 78K 资料）、香港大学—般咸道（香港大学访客指引及香港医学博物馆官方资料）。
- **新界西与地质离岛**：荃湾中—三栋屋与南丰纱厂（三栋屋博物馆及南丰纱厂资料）、屯门—青山湾三圣邨（康文署屯门公园资料）、西贡桥咀洲（香港联合国教科文组织世界地质公园资料）、塔门（旅发局及运输署持牌渡轮资料）。

新增 35 张 Wikimedia Commons 实景照片，严格剔除误匹配的植物/非建筑画面并保留 CC BY / CC0 许可与作者署名，详单见 [照片来源清单](PHOTOS.md)。

### 再扩展 15 条主题路线（全站 62 片区 / 63 路线，2026-11-16）

新增四大类共 15 个片区与 15 条真实步行路线（独立采集 OSM Nominatim 代表点并与 FOSSGIS OSRM `routed-foot` 核对）：
- **港岛历史山谷与山脊**：金钟—中区文物线（茶具文物馆、康文署香港公园、古迹办中区文物径）、薄扶林村—伯大尼（香港演艺学院伯大尼校园及薄鳧林牧场）、香港仔水塘（渔护署香港仔郊野公园及水务法定古迹）、石澳龙脊（渔护署石澳郊野公园及城巴 9 资料）。
- **九龙花市与历史社区**：太子花墟—雀鸟花园（康文署园圃街雀鸟花园及旅发局旺角资料）、何文田—加多利山（旅发局及港铁资料）、长沙湾—李郑屋与苏屋邨（香港历史博物馆李郑屋汉墓馆资料）、启德跑道公园—邮轮码头（启德空中花园及邮轮码头公交资料）。
- **新界水塘与湿地古村**：城门水塘白千层（渔护署城门郊野公园资料）、元朗南生围（旅发局南生围指引）、粉岭鹿颈—谷埔（旅发局鹿颈谷埔路线指南）、上水河上乡—塱原湿地（塱原自然生态公园及古迹办居石侯公祠资料）。
- **特色主题离岛**：西贡盐田梓（旅发局盐田梓盐田与圣若瑟小堂指南）、马湾（运输署珀丽湾渡轮与海滨资料）、蒲台岛（旅发局蒲台岛及古迹办蒲台石刻资料）。

补充 31 张 Wikimedia Commons 实景照片，全站共 152 张实景照片（含 103 张 EXIF GPS 核实拍摄机位 ≤ 350 米），覆盖全部 63 条路线（无 0 照片路线）。

### 深圳双城扩展与 16 条路线核对（全站 78 片区 / 79 路线，2026-11-16）

新增 `city: "sz"` 深圳市 16 个片区与 16 条真实步行路线（独立采集 OSM Nominatim 简体中文地点坐标并经 FOSSGIS OSRM `routed-foot` 步行路网验证，吸附偏移 `<= 98.1 m`，最大折线间距 `<= 462 m`），原香港数据标注 `city: "hk"`：
- **南山海湾与创意社区**：蛇口—海上世界（海上世界文化艺术中心及深圳地铁 2 / 12 号线资料）、华侨城创意园（OCT-LOFT 创意园及深圳市公园管理资料）、深圳湾—人才公园（深圳市城市管理及公园中心、深圳地铁 9 / 2 / 11 号线资料）、南头古城—中山公园（南头古城公开访客资料及南山公园管理资料）。
- **福田与罗湖中心绿廊**：莲花山—笔架山廊桥（深圳市公园管理及深业上城廊桥公开资料）、园岭新村—八卦岭（福田区政务公开社区简介及深圳地铁 3 / 6 / 7 / 9 号线资料）、东门老街—思月书院（罗湖区政务文保与老街资料）、华强北—中心公园（福田区政务公开与中心公园资料）。
- **海滨栈道、水库绿道与山地**：盐田海滨栈道（盐田区政务海岸绿道与海滨公园资料）、梅林水库—梅林绿道（深圳市公园管理与水源水库绿道资料）、前海石—欢乐港湾（宝安区政务及前海石公园滨海廊道资料）、塘朗山—深云谷（塘朗山郊野公园与地铁 7 号线桃源村站资料）。
- **东海岸、古城与客家聚落**：大鹏所城—较场尾（大鹏新区政务所城遗址与公交 M471 / M457 接驳资料）、杨梅坑—鹿嘴海岸（大鹏新区政务东海岸及公交 M274 资料）、甘坑客家古镇（龙岗区政务古镇聚落与地铁 10 号线资料）、大芬油画村（龙岗区大芬美术馆与油画村公开资料）。

补充并逐一人工审计 26 张深圳景点 Wikimedia Commons 实景照片（剔除街道车辆、商城内部与不符地点），全站累计 **178 张实景照片**（含 **126 张** EXIF GPS 核实拍摄机位 ≤ 350 米），深圳 16 条路线与香港 63 条路线全部配有照片（详单见 [PHOTOS.md](PHOTOS.md)）。

### 深圳第二批 15 条路线扩展（全站 93 片区 / 94 路线，2026-11-16）

再次在 `city: "sz"` 下新增 **15 个片区、54 个地点（29 个交通节点与 25 个游览景点）、15 条步行路网核对路线**：香蜜公园—香蜜湖、大沙河生态长廊、西湾红树林—固戍海滨、宝安老城—新安公园、水围 1368—皇岗公园、洪湖公园—笋岗老仓、东湖公园—深圳水库、梧桐山南—仙桐体育公园、小梅沙—背仔角海滨、大梅沙—盐田海鲜街、光明虹桥公园—大顶岭、白石龙—深圳北站绿道、观澜古墟—观澜河、龙岗鹤湖新居—龙潭公园、坪山大万世居—中心公园（`maxSnapMeters <= 119.3 m`，`maxSegmentMeters <= 376.8 m`）。累计补充至 **194 张实景照片**（**137 张** EXIF GPS 核实机位），深圳 31 条路线与香港 63 条路线全部配有照片。
