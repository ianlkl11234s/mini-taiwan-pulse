# Facility Location Audit — 2026-06-20

- 總廠數（source_priority ≤ 4）：**581**
- 已比對：**495**  / 無 Google 結果：**86**
- ✓ Pass (<200m)：**51**
- ⚠ Review (200–1000m)：**17**
- ❌ Critical (>1000m)：**427**
- Google API calls：**661** (本次 0 + 快取 661)
- 預估成本：Places Text Search **$21.15** (@$32/1000) · 實際用 Geocoding API **$3.31** (@$5/1000，Places API 於此 GCP project 未啟用)

> ⚠️ = Google 回傳名稱與 SSOT 名稱無共通 2-char 子字串（低信心配對）

## ❌ Critical (diff > 1000m) — 427 廠

| facility_id | SSOT name | SSOT (lat,lng) | Google name | Google (lat,lng) | diff_m | Link |
|---|---|---|---|---|---:|---|
| t4-gem-wind-L100000922278 | 後龍風場 | (24.66810,120.82050) | 中國重慶市墊江縣龍風場 邮政编码: 408312 | (30.19040,107.48119) | 1451267 | [map](https://www.google.com/maps/search/?api=1&query=30.190396,107.481191&query_place_id=ChIJlWD_lGFvkjYRALaX7O4nzD4) |
| t4-gem-wind-L100000916946 | 旭風二號離岸風場 | (24.05890,119.92300) | 中國郑州市中原区楼东门1号CN 河南省 郑州市 中原区 航海路 邮政编码: 450006 ⚠️ | (34.72007,113.61729) | 1332805 | [map](https://www.google.com/maps/search/?api=1&query=34.72007,113.61729&query_place_id=ChIJ39kmIaFv1zURPoTtaqpywOQ) |
| t4-gem-wind-L100000916947 | 旭風三號離岸風場 | (24.06700,119.83620) | 中國郑州市中原区楼东门1号CN 河南省 郑州市 中原区 航海路 邮政编码: 450006 ⚠️ | (34.72007,113.61729) | 1328181 | [map](https://www.google.com/maps/search/?api=1&query=34.72007,113.61729&query_place_id=ChIJ39kmIaFv1zURPoTtaqpywOQ) |
| t4-gem-solar-L100001018553 | 屏南京沅鎢業太陽光電發電業籌設計畫(屋頂型) | (22.41260,120.58040) | 中國江蘇省南京市 | (32.05838,118.79647) | 1086905 | [map](https://www.google.com/maps/search/?api=1&query=32.0583799,118.79647&query_place_id=ChIJg82NZpuMtTURBhvfeQu2-48) |
| t4-gem-wind-L100000916910 | 豐友離岸風場 | (24.05400,120.15350) | 中國广东省深圳市坪山区 14, 金碧路14-2号 邮政编码: 518118 ⚠️ | (22.68952,114.33609) | 612809 | [map](https://www.google.com/maps/search/?api=1&query=22.68952,114.33609&query_place_id=ChIJb6WSzCBuBDQRTwjSMvGt99g) |
| t4-gem-海豐電廠 | 海豐電廠 | (23.77096,120.17727) | 中國廣東省汕尾市海豐縣 | (22.96657,115.32341) | 503431 | [map](https://www.google.com/maps/search/?api=1&query=22.9665699,115.32341&query_place_id=ChIJ97mRSrYSBTQRh4kHmrVpAyo) |
| t3-ipp-國光電廠 | 國光電廠 | (22.94726,120.25118) | 333台灣桃園市龜山區南上里南上里北油1區11號 ⚠️ | (25.04049,121.34401) | 257873 | [map](https://www.google.com/maps/search/?api=1&query=25.0404917,121.3440136&query_place_id=ChIJVVVVVSQeaDQR0oFR3p6dZFQ) |
| t4-gem-wind-L100000922283 | 東港風場 | (24.59140,120.72320) | 台灣屏東縣東港鎮 | (22.46288,120.47033) | 238081 | [map](https://www.google.com/maps/search/?api=1&query=22.4628783,120.4703258&query_place_id=ChIJ2-wGj7rhcTQRQ7tOpAos6sY) |
| t4-gem-wind-L100000900883 | 海龍離岸風場 | (24.03350,119.70850) | 10491台灣臺北市中山區力行里南京東路三段168號7 樓 ⚠️ | (25.05162,121.54178) | 217256 | [map](https://www.google.com/maps/search/?api=1&query=25.0516218,121.5417771&query_place_id=ChIJFwZkVCurQjQRp65gUgae_DM) |
| t4-gem-solar-L100001066383 | 昱昶能源第二期太陽光電發電廠(第一階段) | (23.68600,120.19300) | 10491台灣臺北市中山區復華里長春路328號 ⚠️ | (25.05448,121.54081) | 204426 | [map](https://www.google.com/maps/search/?api=1&query=25.054479,121.5408102&query_place_id=ChIJFRkZJq6rQjQR9tuGGK9NBTs) |
| t4-gem-solar-L100001018649 | 兆洋台船太陽能發電廠 | (22.54770,120.34210) | 369台灣苗栗縣卓蘭鎮內灣里369 ⚠️ | (24.29798,120.84440) | 201257 | [map](https://www.google.com/maps/search/?api=1&query=24.2979847,120.8444002&query_place_id=ChIJC3EhXqUDaTQRRAdF9VJGbWw) |
| t3-ipp-星元電廠 | 星元電廠 | (22.81127,120.23973) | 507台灣彰化縣線西鄉塭仔村慶安南二路2號 ⚠️ | (24.12815,120.42095) | 147592 | [map](https://www.google.com/maps/search/?api=1&query=24.1281484,120.4209471&query_place_id=ChIJ_yj5CAxEaTQRfGm-Z3QPvVk) |
| t3-ipp-星能電廠 | 星能電廠 | (22.81127,120.23973) | 507台灣彰化縣線西鄉線工南二路2號 ⚠️ | (24.12690,120.43071) | 147582 | [map](https://www.google.com/maps/search/?api=1&query=24.126898,120.4307108&query_place_id=ChIJQT53e_9DaTQRmVdG8QSkNpc) |
| t4-gem-長生電廠 | 長生電廠 | (24.12638,120.43105) | 338台灣桃園市蘆竹區濱海里濱海路一段199號 ⚠️ | (25.11625,121.25708) | 138155 | [map](https://www.google.com/maps/search/?api=1&query=25.116249,121.257084&query_place_id=ChIJuaKJMmGfQjQRGwGZz5bVFR8) |
| t4-gem-solar-L100000801445 | 台南市政府 512MW 光電場 | (23.97390,120.98200) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 118874 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024042 | 廷捷電力第3-1期太陽光電發電廠 | (23.24520,120.20230) | 832台灣高雄市林園區溪州里溪州二路276號 ⚠️ | (22.50997,120.40134) | 84258 | [map](https://www.google.com/maps/search/?api=1&query=22.5099728,120.401337&query_place_id=ChIJVyoot4odbjQRDnGE57SajWU) |
| t4-gem-solar-L100001024145 | 廷捷電力第1-3期太陽光電發電廠 | (23.21130,120.19700) | 832台灣高雄市林園區溪州里溪州二路276號 ⚠️ | (22.50997,120.40134) | 80746 | [map](https://www.google.com/maps/search/?api=1&query=22.5099728,120.401337&query_place_id=ChIJVyoot4odbjQRDnGE57SajWU) |
| t4-gem-solar-L100001024107 | 屏東縣 光電業者 2MW 光電場 | (21.95670,120.74080) | 台灣屏東縣 | (22.55198,120.54876) | 69079 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066532 | 屏東縣 光電業者 6MW 光電場 | (21.96530,120.74900) | 台灣屏東縣 | (22.55198,120.54876) | 68413 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024189 | 屏東縣 光電業者 2MW 光電場 | (21.98510,120.73710) | 台灣屏東縣 | (22.55198,120.54876) | 65946 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066384 | 屏東縣 光電業者 1MW 光電場 | (22.00530,120.72750) | 台灣屏東縣 | (22.55198,120.54876) | 63509 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066378 | 屏東縣 光電業者 1MW 光電場 | (22.01000,120.71280) | 台灣屏東縣 | (22.55198,120.54876) | 62584 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066363 | 屏東縣 光電業者 2MW 光電場 | (22.02030,120.71270) | 台灣屏東縣 | (22.55198,120.54876) | 61479 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024187 | 屏東縣 光電業者 2MW 光電場 | (22.03860,120.76650) | 台灣屏東縣 | (22.55198,120.54876) | 61323 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066522 | 屏東縣 光電業者 2MW 光電場 | (22.06030,120.72740) | 台灣屏東縣 | (22.55198,120.54876) | 57678 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-wind-L100000916938 | 台中豐妙浮動式風場 | (24.47930,120.30580) | 台灣臺中市 ⚠️ | (24.14774,120.67365) | 52428 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066397 | 屏東縣 光電業者 1MW 光電場 | (22.12630,120.74840) | 台灣屏東縣 | (22.55198,120.54876) | 51595 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024190 | 金江太陽光電發電廠 | (22.11920,120.71470) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 51059 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066468 | 臺南市 光電業者 1MW 光電場 | (22.88230,120.46820) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 50047 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808768 | 艾貴綠能田寮發電廠 | (23.28100,120.22200) | 823台灣高雄市田寮區 | (22.86335,120.40119) | 49928 | [map](https://www.google.com/maps/search/?api=1&query=22.8633474,120.4011911&query_place_id=ChIJfdkYGdpsbjQRgc1B8jZ2c5c) |
| t4-gem-solar-L100001024086 | 臺南市 光電業者 2MW 光電場 | (22.87970,120.44600) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 48828 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066493 | 昊軒一號太陽光電發電廠 | (23.39770,120.37550) | 台灣臺南市 ⚠️ | (22.99990,120.22688) | 46769 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001066392 | 澎湖縣 光電業者 1MW 光電場 | (23.55790,119.62190) | 883台灣澎湖縣七美鄉 | (23.20380,119.44151) | 43466 | [map](https://www.google.com/maps/search/?api=1&query=23.2038038,119.4415103&query_place_id=ChIJ____I8CnbTQRoJlblifT9cY) |
| t4-gem-wind-L100000901067 | 雲林離岸風場 | (23.59980,120.02830) | 台灣雲林縣 | (23.70920,120.43134) | 42815 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100000831062 | 屏東縣 Santi 42MW 光電場 | (22.19840,120.70420) | 台灣屏東縣 | (22.55198,120.54876) | 42440 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024130 | 臺南市 光電業者 1MW 光電場 | (22.86180,120.27660) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 42332 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024087 | 臺南市 光電業者 2MW 光電場 | (22.89440,120.35310) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 42149 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066420 | 屏東縣 光電業者 3MW 光電場 | (22.20140,120.69750) | 台灣屏東縣 | (22.55198,120.54876) | 41875 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024169 | 高雄市 光電業者 2MW 光電場 | (22.37750,120.59370) | 台灣高雄市 | (22.62728,120.30144) | 40900 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066445 | 高雄市 光電業者 1MW 光電場 | (22.38510,120.59110) | 台灣高雄市 | (22.62728,120.30144) | 40132 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066435 | 臺南市 光電業者 1MW 光電場 | (22.87350,120.21340) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 39539 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-wind-L100000900993 | 大彰化東南離岸風場 | (24.23060,120.02780) | 台灣彰化縣芳苑鄉 | (23.95531,120.27014) | 39270 | [map](https://www.google.com/maps/search/?api=1&query=23.955313,120.2701362&query_place_id=ChIJs-3gcxVTaTQRRIpLFFRMfbI) |
| t4-gem-solar-L100001024183 | 臺南市 光電業者 2MW 光電場 | (23.08370,120.49940) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 38974 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066523 | 高雄市 光電業者 1MW 光電場 | (22.39750,120.58520) | 台灣高雄市 | (22.62728,120.30144) | 38762 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100000808782 | 高雄市 Ysolar 99MW 光電場 | (22.38800,120.57330) | 台灣高雄市 | (22.62728,120.30144) | 38573 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066490 | 臺南市 光電業者 6MW 光電場 | (22.88430,120.21220) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 38334 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024194 | 花蓮縣 光電業者 2MW 光電場 | (23.67920,121.45600) | 台灣花蓮縣 | (23.98716,121.60157) | 37307 | [map](https://www.google.com/maps/search/?api=1&query=23.9871589,121.6015714&query_place_id=ChIJAxIodMGzaDQRcx386sY33lo) |
| t4-gem-solar-L100001066464 | 高雄市 光電業者 2MW 光電場 | (22.81900,120.59940) | 台灣高雄市 | (22.62728,120.30144) | 37262 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066389 | 臺南市 光電業者 2MW 光電場 | (22.90870,120.26380) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 36967 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024092 | 苗栗縣 光電業者 2MW 光電場 | (24.83950,121.01510) | 台灣苗栗縣 | (24.56016,120.82143) | 36710 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024075 | 高雄市 光電業者 2MW 光電場 | (22.42300,120.57920) | 台灣高雄市 | (22.62728,120.30144) | 36468 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066385 | 高雄市 光電業者 1MW 光電場 | (22.41560,120.57140) | 台灣高雄市 | (22.62728,120.30144) | 36372 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066497 | 花蓮縣 光電業者 2MW 光電場 | (23.68590,121.47000) | 台灣花蓮縣 | (23.98716,121.60157) | 36073 | [map](https://www.google.com/maps/search/?api=1&query=23.9871589,121.6015714&query_place_id=ChIJAxIodMGzaDQRcx386sY33lo) |
| t4-gem-solar-L100001066488 | 高雄市 光電業者 8MW 光電場 | (22.82240,120.57880) | 台灣高雄市 | (22.62728,120.30144) | 35777 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-wind-L100000900992 | 大彰化西南離岸風場 | (24.15180,119.99380) | 台灣彰化縣芳苑鄉 | (23.95531,120.27014) | 35562 | [map](https://www.google.com/maps/search/?api=1&query=23.955313,120.2701362&query_place_id=ChIJs-3gcxVTaTQRRIpLFFRMfbI) |
| t4-gem-solar-L100001066539 | 臺南市 光電業者 2MW 光電場 | (23.09240,120.46420) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 35293 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066426 | 高雄市 光電業者 1MW 光電場 | (22.81950,120.57190) | 台灣高雄市 | (22.62728,120.30144) | 35019 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066450 | 臺東縣 光電業者 1MW 光電場 | (23.08890,121.19930) | 台灣臺東縣 | (22.79724,121.07137) | 34976 | [map](https://www.google.com/maps/search/?api=1&query=22.7972447,121.0713702&query_place_id=ChIJAQQqpdK4bzQR__KzdeRxaM8) |
| t4-gem-solar-L100001024073 | 高雄市 光電業者 2MW 光電場 | (22.79440,120.58780) | 台灣高雄市 | (22.62728,120.30144) | 34758 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066366 | 臺南市 光電業者 1MW 光電場 | (22.95250,120.31570) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 34640 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808772 | 高雄市 Ysolar 40MW 光電場 | (22.45740,120.58130) | 台灣高雄市 | (22.62728,120.30144) | 34394 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-wind-L100000922287 | 彰元風場 | (23.94240,120.36350) | 640台灣雲林縣斗六市榴中里工業路122號 ⚠️ | (23.72274,120.59818) | 34152 | [map](https://www.google.com/maps/search/?api=1&query=23.722736,120.598179&query_place_id=ChIJb6E6Qj3JbjQRKMhBxyjgc0E) |
| t4-gem-solar-L100001024063 | 臺南市 光電業者 2MW 光電場 | (22.93240,120.24730) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 33943 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808773 | 高雄市 Ysolar 40MW 光電場 | (22.45730,120.57210) | 台灣高雄市 | (22.62728,120.30144) | 33614 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100000808781 | 高雄市 Ysolar 40MW 光電場 | (22.45840,120.57030) | 台灣高雄市 | (22.62728,120.30144) | 33392 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-wind-L100000900994 | 大彰化西北離岸風場 | (24.24940,120.22000) | 台灣彰化縣芳苑鄉 | (23.95531,120.27014) | 33095 | [map](https://www.google.com/maps/search/?api=1&query=23.955313,120.2701362&query_place_id=ChIJs-3gcxVTaTQRRIpLFFRMfbI) |
| t4-gem-solar-L100001066427 | 臺南市 光電業者 1MW 光電場 | (22.93710,120.22600) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 32863 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066476 | 雲林縣 光電業者 1MW 光電場 | (23.99540,120.36510) | 台灣雲林縣 | (23.70920,120.43134) | 32529 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066409 | 高雄市 光電業者 2MW 光電場 | (22.52150,120.59340) | 台灣高雄市 | (22.62728,120.30144) | 32202 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024138 | 苗栗縣 光電業者 2MW 光電場 | (24.83590,120.91840) | 台灣苗栗縣 | (24.56016,120.82143) | 32188 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100000831056 | 雲林縣 Star 178MW 光電場 | (23.55150,120.17160) | 台灣雲林縣 | (23.70920,120.43134) | 31743 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100000808771 | 高雄市 Chailease 26MW 光電場 | (22.45690,120.54800) | 台灣高雄市 | (22.62728,120.30144) | 31625 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066485 | 臺南市 光電業者 1MW 光電場 | (22.97260,120.29340) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 31588 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001018729 | 高雄市 光電業者 17MW 光電場 | (22.42570,120.51700) | 台灣高雄市 | (22.62728,120.30144) | 31506 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024176 | 高雄市 光電業者 1MW 光電場 | (22.53310,120.59040) | 台灣高雄市 | (22.62728,120.30144) | 31462 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066436 | 臺南市 光電業者 1MW 光電場 | (22.96680,120.27680) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 31424 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808779 | 高雄市 Ysolar 56MW 光電場 | (22.42500,120.51500) | 台灣高雄市 | (22.62728,120.30144) | 31418 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024209 | 高雄市 光電業者 2MW 光電場 | (22.76690,120.56720) | 台灣高雄市 | (22.62728,120.30144) | 31374 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100000831057 | 雲林縣 光電業者 5MW 光電場 | (23.56290,120.17160) | 台灣雲林縣 | (23.70920,120.43134) | 31060 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024089 | 臺南市 光電業者 7MW 光電場 | (22.96290,120.25720) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 31058 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066430 | 雲林縣 光電業者 2MW 光電場 | (23.57170,120.16720) | 台灣雲林縣 | (23.70920,120.43134) | 30947 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066415 | 高雄市 光電業者 2MW 光電場 | (22.79050,120.54330) | 台灣高雄市 | (22.62728,120.30144) | 30739 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024106 | 高雄市 光電業者 3MW 光電場 | (22.47110,120.54590) | 台灣高雄市 | (22.62728,120.30144) | 30526 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001018692 | 高雄市 INA 99MW 光電場 | (22.43550,120.51370) | 台灣高雄市 | (22.62728,120.30144) | 30496 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024043 | 雲林縣 光電業者 3MW 光電場 | (23.64210,120.14740) | 台灣雲林縣 | (23.70920,120.43134) | 29862 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024144 | 臺南市 光電業者 8MW 光電場 | (22.95730,120.18120) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 29857 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024173 | 高雄市 光電業者 1MW 光電場 | (22.42750,120.49550) | 台灣高雄市 | (22.62728,120.30144) | 29846 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066431 | 高雄市 光電業者 3MW 光電場 | (22.63800,120.59070) | 台灣高雄市 | (22.62728,120.30144) | 29712 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066428 | 高雄市 光電業者 4MW 光電場 | (22.45380,120.52070) | 台灣高雄市 | (22.62728,120.30144) | 29651 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024200 | 高雄市 光電業者 10MW 光電場 | (22.44630,120.51340) | 台灣高雄市 | (22.62728,120.30144) | 29646 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100000831053 | 雲林縣 光電業者 10MW 光電場 | (23.59600,120.16800) | 台灣雲林縣 | (23.70920,120.43134) | 29629 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066500 | 新竹縣 光電業者 1MW 光電場 | (25.07600,121.14990) | 台灣新竹縣 | (24.83872,121.01772) | 29558 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066405 | 高雄市 光電業者 2MW 光電場 | (22.53780,120.57220) | 台灣高雄市 | (22.62728,120.30144) | 29526 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024095 | 新竹縣 光電業者 5MW 光電場 | (25.01200,121.23920) | 台灣新竹縣 | (24.83872,121.01772) | 29496 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066529 | 新竹縣 光電業者 1MW 光電場 | (25.02330,121.22310) | 台灣新竹縣 | (24.83872,121.01772) | 29156 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024076 | 玉樹能源第一期 | (22.81240,120.56620) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 29013 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024177 | 高雄市 光電業者 3MW 光電場 | (22.56650,120.57410) | 台灣高雄市 | (22.62728,120.30144) | 28796 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-wind-L100000901065 | 台中風場 | (24.39270,120.58870) | 台灣臺中市 ⚠️ | (24.14774,120.67365) | 28567 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066458 | 高雄市 光電業者 2MW 光電場 | (22.64730,120.57870) | 台灣高雄市 | (22.62728,120.30144) | 28542 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024093 | 高雄市 光電業者 2MW 光電場 | (22.47490,120.52440) | 台灣高雄市 | (22.62728,120.30144) | 28484 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024035 | 臺南市 光電業者 4MW 光電場 | (23.07120,120.37300) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 28437 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001018625 | 玉樹能源第1-2期太陽光電發電廠 | (22.80710,120.55860) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 28386 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024141 | 臺南市 光電業者 2MW 光電場 | (23.02350,120.31990) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 28278 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808780 | 高雄市 Chailease 24MW 光電場 | (22.50280,120.54050) | 台灣高雄市 | (22.62728,120.30144) | 28181 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024142 | 臺南市 光電業者 2MW 光電場 | (23.04220,120.33880) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 27962 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066377 | 雲林縣 光電業者 2MW 光電場 | (23.57610,120.19980) | 台灣雲林縣 | (23.70920,120.43134) | 27844 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001047744 | 廣宇一期嘉義太陽能發電廠(第三階段)-僅涉及出流管制部分 | (23.42930,120.18340) | 600台灣嘉義市 | (23.48008,120.44911) | 27686 | [map](https://www.google.com/maps/search/?api=1&query=23.4800751,120.4491113&query_place_id=ChIJdQADvTGUbjQRbmls8YZnZjA) |
| t4-gem-solar-L100001066528 | 聚慶D/S太陽光電發電廠第一期 | (22.86530,120.22220) | 台灣高雄市 ⚠️ | (22.62728,120.30144) | 27686 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t3-ipp-新桃電廠 | 新桃電廠 | (25.02989,121.05931) | 306台灣新竹縣關西鎮台電新村66號 ⚠️ | (24.81536,121.19759) | 27632 | [map](https://www.google.com/maps/search/?api=1&query=24.8153621,121.197594&query_place_id=ChIJ1wb2kSA8aDQR2GQS14LSdAM) |
| t4-gem-solar-L100001024038 | 高雄市 光電業者 3MW 光電場 | (22.55530,120.55800) | 台灣高雄市 | (22.62728,120.30144) | 27529 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024045 | 雲林縣 光電業者 1MW 光電場 | (23.95120,120.37590) | 台灣雲林縣 | (23.70920,120.43134) | 27493 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100000831072 | 雲林縣 Vena 272MW 光電場 | (23.72120,120.16210) | 台灣雲林縣 | (23.70920,120.43134) | 27442 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024105 | 新竹縣 光電業者 4MW 光電場 | (25.04230,121.16690) | 台灣新竹縣 | (24.83872,121.01772) | 27178 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066448 | 高雄市 光電業者 1MW 光電場 | (22.66110,120.56320) | 台灣高雄市 | (22.62728,120.30144) | 27125 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066425 | 高雄市 光電業者 1MW 光電場 | (22.68650,120.55690) | 台灣高雄市 | (22.62728,120.30144) | 27029 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024178 | 高雄市 光電業者 2MW 光電場 | (22.64280,120.56150) | 台灣高雄市 | (22.62728,120.30144) | 26746 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024195 | 花蓮縣 光電業者 3MW 光電場 | (23.77010,121.48950) | 台灣花蓮縣 | (23.98716,121.60157) | 26691 | [map](https://www.google.com/maps/search/?api=1&query=23.9871589,121.6015714&query_place_id=ChIJAxIodMGzaDQRcx386sY33lo) |
| t4-gem-solar-L100001066459 | 高雄市 光電業者 5MW 光電場 | (22.73140,120.53030) | 台灣高雄市 | (22.62728,120.30144) | 26180 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066372 | 新竹縣 光電業者 2MW 光電場 | (25.05860,121.10930) | 台灣新竹縣 | (24.83872,121.01772) | 26134 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024219 | 嘉義縣 光電業者 2MW 光電場 | (23.53320,120.49440) | 台灣嘉義縣 | (23.45184,120.25546) | 25992 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024148 | 新竹縣 光電業者 3MW 光電場 | (25.03220,121.16210) | 台灣新竹縣 | (24.83872,121.01772) | 25976 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066492 | 花蓮縣 光電業者 2MW 光電場 | (23.78890,121.46810) | 台灣花蓮縣 | (23.98716,121.60157) | 25887 | [map](https://www.google.com/maps/search/?api=1&query=23.9871589,121.6015714&query_place_id=ChIJAxIodMGzaDQRcx386sY33lo) |
| t4-gem-solar-L100001066437 | 貝和電力第2-1期太陽光電發電廠(漁電共生屋頂型) | (23.23150,120.20120) | 台灣臺南市 ⚠️ | (22.99990,120.22688) | 25886 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001066429 | 高雄市 光電業者 3MW 光電場 | (22.52220,120.52540) | 台灣高雄市 | (22.62728,120.30144) | 25794 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024094 | 新竹縣 光電業者 4MW 光電場 | (25.03420,121.15450) | 台灣新竹縣 | (24.83872,121.01772) | 25742 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066517 | 高雄市 光電業者 1MW 光電場 | (22.65920,120.54980) | 台灣高雄市 | (22.62728,120.30144) | 25734 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066495 | 臺中市 光電業者 2MW 光電場 | (24.37650,120.70860) | 台灣臺中市 | (24.14774,120.67365) | 25683 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066452 | 高雄市 光電業者 2MW 光電場 | (22.52970,120.52770) | 台灣高雄市 | (22.62728,120.30144) | 25640 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t3-island-七美發電廠 | 七美發電廠 | (23.20500,119.67200) | 883台灣澎湖縣七美鄉南港村1之3號 | (23.19374,119.42217) | 25565 | [map](https://www.google.com/maps/search/?api=1&query=23.1937354,119.4221652&query_place_id=ChIJncfvIoanbTQRlG4qDV0jbCc) |
| t4-gem-solar-L100001024201 | 高雄市 光電業者 5MW 光電場 | (22.63000,120.55050) | 台灣高雄市 | (22.62728,120.30144) | 25565 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066506 | 彰化縣 光電業者 1MW 光電場 | (24.29400,120.53740) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 25436 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t4-gem-solar-L100001024175 | 高雄市 光電業者 2MW 光電場 | (22.46060,120.46520) | 台灣高雄市 | (22.62728,120.30144) | 25027 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066406 | 臺南市 光電業者 2MW 光電場 | (23.07850,120.33320) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 24756 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024165 | 雲林縣 光電業者 5MW 光電場 | (23.71440,120.18900) | 台灣雲林縣 | (23.70920,120.43134) | 24679 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024168 | 屏東縣 光電業者 1MW 光電場 | (22.33820,120.61240) | 台灣屏東縣 | (22.55198,120.54876) | 24654 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024155 | 嘉義縣 光電業者 2MW 光電場 | (23.50440,120.48840) | 台灣嘉義縣 | (23.45184,120.25546) | 24465 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100000808774 | 雲林縣 NEFIN 500MW 光電場 | (23.72470,120.19330) | 台灣雲林縣 | (23.70920,120.43134) | 24294 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024103 | 新竹縣 光電業者 2MW 光電場 | (24.90700,121.24580) | 台灣新竹縣 | (24.83872,121.01772) | 24229 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066369 | 嘉義縣 光電業者 3MW 光電場 | (23.50930,120.48120) | 台灣嘉義縣 | (23.45184,120.25546) | 23893 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066364 | 臺南市 光電業者 1MW 光電場 | (23.25500,120.38000) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 23726 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001018661 | 雲林縣 Maiora 48MW 光電場 | (23.87280,120.29580) | 台灣雲林縣 | (23.70920,120.43134) | 22827 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001018537 | 雲林縣 Power 32MW 光電場 | (23.78670,120.22400) | 台灣雲林縣 | (23.70920,120.43134) | 22794 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024060 | 高雄市 光電業者 1MW 光電場 | (22.75860,120.47180) | 台灣高雄市 | (22.62728,120.30144) | 22775 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066374 | 臺南市 光電業者 1MW 光電場 | (23.02180,120.16510) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 22568 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066537 | 臺南市 光電業者 1MW 光電場 | (23.12330,120.34100) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 22506 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066401 | 屏東縣 光電業者 2MW 光電場 | (22.36270,120.61830) | 台灣屏東縣 | (22.55198,120.54876) | 22227 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066399 | 臺南市 光電業者 6MW 光電場 | (23.27280,120.36080) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 22181 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t3-ipp-長生電廠 | 長生電廠 | (25.02989,121.05931) | 338台灣桃園市蘆竹區濱海里濱海路一段199號 ⚠️ | (25.11625,121.25708) | 22113 | [map](https://www.google.com/maps/search/?api=1&query=25.116249,121.257084&query_place_id=ChIJuaKJMmGfQjQRGwGZz5bVFR8) |
| t4-gem-solar-L100001066526 | 雲林縣 光電業者 1MW 光電場 | (23.74050,120.22130) | 台灣雲林縣 | (23.70920,120.43134) | 21663 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066462 | 雲林縣 光電業者 1MW 光電場 | (23.74850,120.22430) | 台灣雲林縣 | (23.70920,120.43134) | 21523 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066403 | 高雄市 光電業者 1MW 光電場 | (22.70560,120.49320) | 台灣高雄市 | (22.62728,120.30144) | 21518 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066494 | 臺南市 光電業者 4MW 光電場 | (23.04170,120.08130) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 21492 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808776 | 臺南市 Ysolar 50MW 光電場 | (23.17150,120.13580) | 台灣臺南市 | (22.99990,120.22688) | 21234 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001024198 | 雲林縣 光電業者 18MW 光電場 | (23.80820,120.25330) | 台灣雲林縣 | (23.70920,120.43134) | 21201 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024097 | 臺南市 光電業者 3MW 光電場 | (23.27000,120.35150) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 21184 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066527 | 寶興金榮太陽光電發電系統工程（第一期）-1 | (22.37320,120.61500) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 21012 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024179 | 高雄市 光電業者 3MW 光電場 | (22.72720,120.47500) | 台灣高雄市 | (22.62728,120.30144) | 20989 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066421 | 臺南市 光電業者 1MW 光電場 | (23.24640,120.35390) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 20957 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066381 | 嘉義縣 光電業者 2MW 光電場 | (23.33310,120.41450) | 台灣嘉義縣 | (23.45184,120.25546) | 20923 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066379 | 臺南市 光電業者 3MW 光電場 | (23.03860,120.14650) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 20652 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000808777 | 臺南市 Ysolar 50MW 光電場 | (23.16260,120.13290) | 台灣臺南市 | (22.99990,120.22688) | 20487 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001066541 | 臺中市 光電業者 2MW 光電場 | (24.32610,120.70240) | 台灣臺中市 | (24.14774,120.67365) | 20046 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066367 | 鴻工五號能源(第2-2期)太陽光電發電廠 | (23.09620,120.39420) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 20011 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001066370 | 高雄市 光電業者 2MW 光電場 | (22.80520,120.28590) | 台灣高雄市 | (22.62728,120.30144) | 19848 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024046 | 臺中市 光電業者 2MW 光電場 | (24.31690,120.73350) | 台灣臺中市 | (24.14774,120.67365) | 19765 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066417 | 雲林縣 光電業者 1MW 光電場 | (23.67110,120.24180) | 台灣雲林縣 | (23.70920,120.43134) | 19759 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066387 | 苗栗縣 光電業者 8MW 光電場 | (24.71530,120.91430) | 台灣苗栗縣 | (24.56016,120.82143) | 19639 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066414 | 屏東縣 光電業者 5MW 光電場 | (22.38690,120.61530) | 台灣屏東縣 | (22.55198,120.54876) | 19588 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066483 | 鴻羅五號能源(第1-1期)太陽光電發電廠 | (23.09870,120.38600) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 19465 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001066466 | 苗栗縣 光電業者 1MW 光電場 | (24.72210,120.89340) | 台灣苗栗縣 | (24.56016,120.82143) | 19421 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024034 | 嘉義縣 光電業者 3MW 光電場 | (23.43620,120.44460) | 台灣嘉義縣 | (23.45184,120.25546) | 19373 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066471 | 高雄市 光電業者 1MW 光電場 | (22.48530,120.41060) | 台灣高雄市 | (22.62728,120.30144) | 19362 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066472 | 高雄市 光電業者 1MW 光電場 | (22.48530,120.41060) | 台灣高雄市 | (22.62728,120.30144) | 19362 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066498 | 高雄市 光電業者 1MW 光電場 | (22.54580,120.46720) | 台灣高雄市 | (22.62728,120.30144) | 19280 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066524 | 屏東縣 光電業者 4MW 光電場 | (22.39230,120.62150) | 台灣屏東縣 | (22.55198,120.54876) | 19264 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066460 | 高雄市 光電業者 1MW 光電場 | (22.79630,120.33850) | 台灣高雄市 | (22.62728,120.30144) | 19175 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066439 | 臺中市 光電業者 2MW 光電場 | (24.31760,120.64350) | 台灣臺中市 | (24.14774,120.67365) | 19134 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-wind-L100001061628 | 蔚藍海苗栗離岸風場 | (24.73090,120.82080) | 台灣苗栗縣 | (24.56016,120.82143) | 18986 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066481 | 臺南市 光電業者 2MW 光電場 | (23.10480,120.28260) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 18967 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024062 | 臺南市 光電業者 1MW 光電場 | (23.22490,120.33460) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 18842 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001018722 | 屏東縣 INA 75MW 光電場 | (22.39070,120.60480) | 台灣屏東縣 | (22.55198,120.54876) | 18835 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066467 | 嘉義縣 光電業者 3MW 光電場 | (23.34320,120.39700) | 台灣嘉義縣 | (23.45184,120.25546) | 18830 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066505 | 鴻工五號能源(第1-1期)太陽光電發電廠 | (23.09500,120.38100) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 18811 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001066520 | 苗栗縣 光電業者 1MW 光電場 | (24.46580,120.66760) | 台灣苗栗縣 | (24.56016,120.82143) | 18770 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066442 | 寶興金榮太陽光電發電系統工程（第二期）-2 | (22.39390,120.60890) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 18632 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-wind-L100000916928 | 皇陽暨蔚藍海彰化離岸風場 | (24.04390,120.11470) | 台灣彰化縣芳苑鄉 | (23.95531,120.27014) | 18610 | [map](https://www.google.com/maps/search/?api=1&query=23.955313,120.2701362&query_place_id=ChIJs-3gcxVTaTQRRIpLFFRMfbI) |
| t4-gem-solar-L100001066362 | 高雄市 光電業者 3MW 光電場 | (22.79170,120.26860) | 台灣高雄市 | (22.62728,120.30144) | 18590 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-Sihuangziping_geothermal_power_plant | 四磺子坪地熱發電廠 | (25.19550,121.60230) | 台灣臺北 ⚠️ | (25.03297,121.56542) | 18450 | [map](https://www.google.com/maps/search/?api=1&query=25.0329694,121.5654177&query_place_id=ChIJmQrivHKsQjQR4MIK3c41aj8) |
| t4-gem-solar-L100001024064 | 臺南市 光電業者 16MW 光電場 | (23.09690,120.26540) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 18422 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066408 | 臺南市 光電業者 16MW 光電場 | (23.09690,120.26540) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 18422 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024180 | 恆伍第一期太陽光電發電廠 | (22.71250,120.58740) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 18285 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001061871 | 屏鵝公路太陽光電發電廠 | (22.12620,120.71290) | 台灣屏東縣屏鵝公路 | (22.27913,120.64904) | 18232 | [map](https://www.google.com/maps/search/?api=1&query=22.2791325,120.6490422&query_place_id=ChIJOw5dftPEcTQRby8a3Lk_Kww) |
| t4-gem-solar-L100001066433 | 東鋼風力東桃二太陽光電發電廠 | (25.06760,121.14080) | 台灣桃園市 ⚠️ | (24.99363,121.30098) | 18114 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001066432 | 苗栗縣 光電業者 5MW 光電場 | (24.67770,120.94470) | 台灣苗栗縣 | (24.56016,120.82143) | 18059 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066373 | 臺南市 光電業者 1MW 光電場 | (23.10060,120.26410) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 18021 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-wind-L100000900733 | 彰芳暨西島離岸風場 | (24.11150,120.20420) | 505台灣彰化縣鹿港鎮東石里鹿工路45號 ⚠️ | (24.07660,120.37735) | 18000 | [map](https://www.google.com/maps/search/?api=1&query=24.0765986,120.3773545&query_place_id=ChIJ_ya8Ha5FaTQRW84inJSv7LA) |
| t4-gem-solar-L100001024162 | 嘉義縣 光電業者 2MW 光電場 | (23.31820,120.35390) | 台灣嘉義縣 | (23.45184,120.25546) | 17938 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001018491 | 台康萬興四放太陽光電發電系統工程(水面型) | (23.91780,120.42390) | 台灣彰化縣 ⚠️ | (24.05180,120.51614) | 17601 | [map](https://www.google.com/maps/search/?api=1&query=24.0517963,120.5161352&query_place_id=ChIJdRR5tR5JaTQRJ380ulhL6NY) |
| t4-gem-solar-L100001024051 | 新竹縣 光電業者 9MW 光電場 | (24.88000,121.18570) | 台灣新竹縣 | (24.83872,121.01772) | 17558 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100000831071 | 臺南市 Ysolar 50MW 光電場 | (23.09250,120.08850) | 台灣臺南市 | (22.99990,120.22688) | 17507 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001066454 | 義暘(太源)第三期(第一階段)太陽能光電場 | (22.40130,120.59230) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 17341 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024055 | 臺南市 光電業者 1MW 光電場 | (23.08010,120.21380) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 17302 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024050 | 臺中市 光電業者 8MW 光電場 | (24.29540,120.72740) | 台灣臺中市 | (24.14774,120.67365) | 17301 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066400 | 臺中市 光電業者 1MW 光電場 | (24.23720,120.81200) | 台灣臺中市 | (24.14774,120.67365) | 17201 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066509 | 高雄市 光電業者 1MW 光電場 | (22.76520,120.37350) | 台灣高雄市 | (22.62728,120.30144) | 17025 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024143 | 臺南市 光電業者 7MW 光電場 | (23.10720,120.25740) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 17018 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066465 | 臺東縣 光電業者 1MW 光電場 | (22.94300,121.11880) | 台灣臺東縣 | (22.79724,121.07137) | 16920 | [map](https://www.google.com/maps/search/?api=1&query=22.7972447,121.0713702&query_place_id=ChIJAQQqpdK4bzQR__KzdeRxaM8) |
| t4-gem-solar-L100001066470 | 苗栗縣 光電業者 1MW 光電場 | (24.46050,120.69670) | 台灣苗栗縣 | (24.56016,120.82143) | 16794 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066511 | 苗栗縣 光電業者 1MW 光電場 | (24.49390,120.67430) | 台灣苗栗縣 | (24.56016,120.82143) | 16607 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066525 | 豐照能源和泰汽車一期太陽光電發電廠(屋頂型) | (24.92410,121.15540) | 台灣桃園市 ⚠️ | (24.99363,121.30098) | 16588 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001018548 | 天柱第三期(第一階段)太陽能電廠 | (23.12040,120.13450) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 16578 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001024061 | 臺南市 光電業者 4MW 光電場 | (23.22320,120.31200) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 16533 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066469 | 新北市 光電業者 1MW 光電場 | (25.02650,121.62500) | 台灣新北市 | (25.01698,121.46279) | 16379 | [map](https://www.google.com/maps/search/?api=1&query=25.0169826,121.4627868&query_place_id=ChIJX2S2sDhVXTQRwO0gZvoNqVo) |
| t4-gem-solar-L100001024057 | 高雄市 光電業者 3MW 光電場 | (22.77340,120.28650) | 台灣高雄市 | (22.62728,120.30144) | 16320 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066386 | 高雄市 光電業者 9MW 光電場 | (22.66860,120.45350) | 台灣高雄市 | (22.62728,120.30144) | 16267 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-wind-L100000901073 | 彰工風場 | (24.10630,120.39840) | 500台灣彰化縣彰化市和調里工校街1號 ⚠️ | (24.08258,120.55597) | 16211 | [map](https://www.google.com/maps/search/?api=1&query=24.0825769,120.5559702&query_place_id=ChIJ0VWHF-o4aTQR3yjCO_7Vm3U) |
| t4-gem-solar-L100000831070 | 天柱第一期(第二階段)太陽能電廠 | (23.11180,120.13040) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 16073 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001018476 | 嘉義縣 Formosa 20MW 光電場 | (23.32520,120.18230) | 台灣嘉義縣 | (23.45184,120.25546) | 15939 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100000808778 | 天柱第一期(第二階段)太陽能電廠 | (23.10710,120.12650) | 台灣臺南市東區大學里臺南 ⚠️ | (22.99948,120.22927) | 15931 | [map](https://www.google.com/maps/search/?api=1&query=22.9994761,120.2292723&query_place_id=ChIJK_I1UZN2bjQRnLZaGDT61Rw) |
| t4-gem-solar-L100001024120 | 新竹縣 光電業者 1MW 光電場 | (24.96770,121.08490) | 台灣新竹縣 | (24.83872,121.01772) | 15861 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066455 | 屏東縣 光電業者 1MW 光電場 | (22.42650,120.62030) | 台灣屏東縣 | (22.55198,120.54876) | 15770 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100000831063 | 彰化縣 光電業者 11MW 光電場 | (24.20880,120.49420) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 15256 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t4-gem-solar-L100001066380 | 桃園市 光電業者 1MW 光電場 | (25.02040,121.44890) | 台灣桃園市 | (24.99363,121.30098) | 15200 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100000801523 | 嘉義縣 Vena 70MW 光電場 | (23.33140,120.18540) | 台灣嘉義縣 | (23.45184,120.25546) | 15182 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066393 | 高雄市 光電業者 15MW 光電場 | (22.71490,120.41450) | 台灣高雄市 | (22.62728,120.30144) | 15149 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001061897 | 高雄市 光電業者 30MW 光電場 | (22.71420,120.41510) | 台灣高雄市 | (22.62728,120.30144) | 15147 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066449 | 屏東縣 光電業者 4MW 光電場 | (22.43240,120.61830) | 台灣屏東縣 | (22.55198,120.54876) | 15094 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024147 | 苗栗縣 光電業者 1MW 光電場 | (24.67490,120.89660) | 台灣苗栗縣 | (24.56016,120.82143) | 14850 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024052 | 雲林縣 光電業者 3MW 光電場 | (23.60780,120.33790) | 台灣雲林縣 | (23.70920,120.43134) | 14755 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066546 | 臺南市 光電業者 1MW 光電場 | (23.14200,120.26040) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 14512 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066422 | 桃園市 光電業者 2MW 光電場 | (24.98500,121.44080) | 台灣桃園市 | (24.99363,121.30098) | 14124 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001066382 | 苗栗縣 光電業者 1MW 光電場 | (24.49790,120.70220) | 台灣苗栗縣 | (24.56016,120.82143) | 13907 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024044 | 嘉義縣 光電業者 1MW 光電場 | (23.33110,120.22000) | 台灣嘉義縣 | (23.45184,120.25546) | 13905 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066368 | 嘉義縣 光電業者 2MW 光電場 | (23.40160,120.37960) | 台灣嘉義縣 | (23.45184,120.25546) | 13843 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024112 | 苗栗縣 光電業者 1MW 光電場 | (24.50350,120.70020) | 台灣苗栗縣 | (24.56016,120.82143) | 13787 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100000808769 | 天璣第四期(第一階段)太陽能電廠 | (22.42980,120.54170) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 13605 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024116 | 臺中市 光電業者 2MW 光電場 | (24.23450,120.58080) | 台灣臺中市 | (24.14774,120.67365) | 13482 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001024213 | 嘉義縣 光電業者 6MW 光電場 | (23.33680,120.29620) | 台灣嘉義縣 | (23.45184,120.25546) | 13451 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066391 | 雲林縣 光電業者 1MW 光電場 | (23.81790,120.48860) | 台灣雲林縣 | (23.70920,120.43134) | 13418 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066521 | 向陽多元義竹2-6期溫室科技養殖結合太陽光電發電廠 | (23.34510,120.19440) | 台灣嘉義縣 ⚠️ | (23.45184,120.25546) | 13406 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066533 | 高雄市 光電業者 1MW 光電場 | (22.61060,120.42920) | 台灣高雄市 | (22.62728,120.30144) | 13245 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066395 | 屏東縣 光電業者 1MW 光電場 | (22.45040,120.61200) | 台灣屏東縣 | (22.55198,120.54876) | 13030 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066424 | 嘉義縣 光電業者 3MW 光電場 | (23.39020,120.36340) | 台灣嘉義縣 | (23.45184,120.25546) | 12972 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024066 | 新北市 光電業者 3MW 光電場 | (25.00880,121.59110) | 台灣新北市 | (25.01698,121.46279) | 12962 | [map](https://www.google.com/maps/search/?api=1&query=25.0169826,121.4627868&query_place_id=ChIJX2S2sDhVXTQRwO0gZvoNqVo) |
| t4-gem-solar-L100001066457 | 桃園市 光電業者 1MW 光電場 | (25.10820,121.27730) | 台灣桃園市 | (24.99363,121.30098) | 12961 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001066487 | 雲林縣 光電業者 1MW 光電場 | (23.60120,120.47630) | 台灣雲林縣 | (23.70920,120.43134) | 12853 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066410 | 嘉義縣 光電業者 1MW 光電場 | (23.38510,120.15440) | 台灣嘉義縣 | (23.45184,120.25546) | 12705 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024113 | 苗栗縣 光電業者 1MW 光電場 | (24.51170,120.70920) | 台灣苗栗縣 | (24.56016,120.82143) | 12566 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001047739 | 熲明彰濱廠房屋頂第三期太陽光電發電廠」(屋頂型) | (24.12750,120.42580) | 台灣彰化縣 ⚠️ | (24.05180,120.51614) | 12448 | [map](https://www.google.com/maps/search/?api=1&query=24.0517963,120.5161352&query_place_id=ChIJdRR5tR5JaTQRJ380ulhL6NY) |
| t4-gem-solar-L100001024172 | 瑤光第一期太陽能電廠(第二階段) | (22.44100,120.55680) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 12368 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001024151 | 旭信電力宜蘭廠 | (24.64130,121.83990) | 台灣宜蘭縣 | (24.70211,121.73775) | 12339 | [map](https://www.google.com/maps/search/?api=1&query=24.7021073,121.7377502&query_place_id=ChIJWy8jaz3gZzQRrAfTE55Su88) |
| t4-gem-solar-L100001066365 | 嘉義縣 光電業者 1MW 光電場 | (23.36060,120.18680) | 台灣嘉義縣 | (23.45184,120.25546) | 12330 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100000808783 | 瑤光第二期太陽能電廠 | (22.44180,120.54890) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 12251 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066531 | 臺南市 光電業者 2MW 光電場 | (23.25560,120.26370) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 12107 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066499 | 臺中市 光電業者 1MW 光電場 | (24.14600,120.55490) | 台灣臺中市 | (24.14774,120.67365) | 12050 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066461 | 臺南市 光電業者 9MW 光電場 | (23.11600,120.14760) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 12045 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024084 | 新竹縣 光電業者 2MW 光電場 | (24.94610,121.00970) | 台灣新竹縣 | (24.83872,121.01772) | 11967 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100000808775 | 天璣第五期太陽能電廠 | (22.44500,120.54120) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 11921 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066510 | 桃園市 光電業者 1MW 光電場 | (25.09990,121.31560) | 台灣桃園市 | (24.99363,121.30098) | 11908 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001066444 | 苗栗縣 光電業者 3MW 光電場 | (24.55380,120.70620) | 台灣苗栗縣 | (24.56016,120.82143) | 11675 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066482 | 桃園市 光電業者 2MW 光電場 | (25.02330,121.41130) | 台灣桃園市 | (24.99363,121.30098) | 11596 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001066434 | 桃園市 光電業者 1MW 光電場 | (25.00830,121.41380) | 台灣桃園市 | (24.99363,121.30098) | 11486 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001047729 | 嘉義縣 Elapath 150MW 光電場 | (23.37350,120.18290) | 台灣嘉義縣 | (23.45184,120.25546) | 11433 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024101 | 嘉義縣 光電業者 5MW 光電場 | (23.35030,120.26950) | 台灣嘉義縣 | (23.45184,120.25546) | 11382 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024208 | 屏東縣 光電業者 3MW 光電場 | (22.46520,120.60700) | 台灣屏東縣 | (22.55198,120.54876) | 11353 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066489 | 新竹縣 光電業者 2MW 光電場 | (24.93190,121.06260) | 台灣新竹縣 | (24.83872,121.01772) | 11307 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066361 | 高雄市 光電業者 2MW 光電場 | (22.53030,120.33420) | 台灣高雄市 | (22.62728,120.30144) | 11296 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024184 | 雲林縣 光電業者 3MW 光電場 | (23.61080,120.45680) | 台灣雲林縣 | (23.70920,120.43134) | 11245 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100000808767 | 嘉義縣 GreenRock 115MW 光電場 | (23.37760,120.18370) | 台灣嘉義縣 | (23.45184,120.25546) | 11035 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024133 | 新竹縣 光電業者 2MW 光電場 | (24.93760,121.00870) | 台灣新竹縣 | (24.83872,121.01772) | 11032 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024149 | 凱勤能源第三期太陽光電發電廠(屋頂型) | (25.01420,121.24710) | 333台灣桃园市龟山区大岗里大湖路408巷26號 ⚠️ | (25.04858,121.34911) | 10966 | [map](https://www.google.com/maps/search/?api=1&query=25.0485844,121.349114&query_place_id=ChIJSUqXcgChQjQRMOt-nsktJU8) |
| t4-gem-solar-L100001066540 | 苗栗縣 光電業者 1MW 光電場 | (24.60270,120.91670) | 台灣苗栗縣 | (24.56016,120.82143) | 10732 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-wind-L100000922280 | 苗栗大鵬風場 | (24.60860,120.73060) | 台灣苗栗縣 | (24.56016,120.82143) | 10647 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066477 | 臺南市 光電業者 8MW 光電場 | (23.28800,120.22740) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 10600 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024134 | 新竹縣 光電業者 1MW 光電場 | (24.93230,121.03680) | 台灣新竹縣 | (24.83872,121.01772) | 10582 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024146 | 苗栗縣 光電業者 2MW 光電場 | (24.64740,120.86240) | 台灣苗栗縣 | (24.56016,120.82143) | 10548 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024039 | 新竹縣 光電業者 2MW 光電場 | (24.93000,120.98990) | 台灣新竹縣 | (24.83872,121.01772) | 10531 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024132 | 新竹縣 光電業者 2MW 光電場 | (24.93120,121.00120) | 台灣新竹縣 | (24.83872,121.01772) | 10417 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100000831067 | 臺南市 Santi 160MW 光電場 | (23.14440,120.09700) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 10417 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024124 | 苗栗縣 光電業者 2MW 光電場 | (24.65040,120.83650) | 台灣苗栗縣 | (24.56016,120.82143) | 10149 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024150 | 新竹縣 光電業者 1MW 光電場 | (24.92990,121.02060) | 台灣新竹縣 | (24.83872,121.01772) | 10143 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024160 | 臺南市 光電業者 5MW 光電場 | (23.20650,120.24700) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 10087 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001018557 | 嘉義縣 Aquastar 119MW 光電場 | (23.36430,120.23060) | 台灣嘉義縣 | (23.45184,120.25546) | 10059 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-wind-L100000901060 | 彰濱風場 | (24.15440,120.42700) | 505台灣彰化縣鹿港鎮東石里鹿工路45號 ⚠️ | (24.07660,120.37735) | 10011 | [map](https://www.google.com/maps/search/?api=1&query=24.0765986,120.3773545&query_place_id=ChIJ_ya8Ha5FaTQRW84inJSv7LA) |
| t4-gem-solar-L100001024214 | 臺南市 光電業者 2MW 光電場 | (23.13570,120.13880) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 9920 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066515 | 雲林縣 光電業者 1MW 光電場 | (23.62000,120.43280) | 台灣雲林縣 | (23.70920,120.43134) | 9920 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001024135 | 新竹縣 光電業者 2MW 光電場 | (24.92330,121.04640) | 台灣新竹縣 | (24.83872,121.01772) | 9839 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024058 | 新竹縣 光電業者 2MW 光電場 | (24.92530,121.01330) | 台灣新竹縣 | (24.83872,121.01772) | 9637 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066441 | 臺中市 光電業者 2MW 光電場 | (24.22220,120.62540) | 台灣臺中市 | (24.14774,120.67365) | 9618 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001024126 | 苗栗縣 光電業者 1MW 光電場 | (24.55970,120.72670) | 台灣苗栗縣 | (24.56016,120.82143) | 9580 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066440 | 新竹縣 光電業者 2MW 光電場 | (24.91930,121.05030) | 台灣新竹縣 | (24.83872,121.01772) | 9543 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066394 | 臺中市 光電業者 2MW 光電場 | (24.19710,120.59680) | 台灣臺中市 | (24.14774,120.67365) | 9534 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001066504 | 東鋼風力東高太陽光電發電廠 | (22.56220,120.36110) | 台灣高雄市 ⚠️ | (22.62728,120.30144) | 9481 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001024104 | 桃園市 光電業者 2MW 光電場 | (25.04680,121.37320) | 台灣桃園市 | (24.99363,121.30098) | 9376 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001024099 | 臺南市 光電業者 3MW 光電場 | (23.18810,120.23150) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 9232 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024125 | 苗栗縣 光電業者 1MW 光電場 | (24.64260,120.82280) | 台灣苗栗縣 | (24.56016,120.82143) | 9168 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066446 | 臺南市 光電業者 1MW 光電場 | (23.28250,120.21050) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 8935 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-立霧水力 | 立霧水力電廠 | (24.17700,121.58350) | 971台灣花蓮縣新城鄉新城村新城路25號 ⚠️ | (24.12801,121.65267) | 8884 | [map](https://www.google.com/maps/search/?api=1&query=24.1280113,121.6526668&query_place_id=ChIJOUjsKOwpZjQRxs6zBTtWmGo) |
| t4-gem-solar-L100001024096 | 臺中市 光電業者 6MW 光電場 | (24.15680,120.58670) | 台灣臺中市 | (24.14774,120.67365) | 8879 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100000831059 | 方登澎湖太陽光電發電設備系統工程(第一期) | (23.57120,119.66630) | 台灣澎湖縣 | (23.57119,119.57932) | 8865 | [map](https://www.google.com/maps/search/?api=1&query=23.5711899,119.5793157&query_place_id=ChIJXcTEPjdRbDQRI7DPZYYs6Lg) |
| t4-gem-solar-L100001024108 | 臺中市 光電業者 17MW 光電場 | (24.20740,120.61600) | 台灣臺中市 | (24.14774,120.67365) | 8844 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001018464 | 臺中市 光電業者 24MW 光電場 | (24.20460,120.61340) | 台灣臺中市 | (24.14774,120.67365) | 8794 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100001024136 | 新竹縣 光電業者 2MW 光電場 | (24.91690,121.03010) | 台灣新竹縣 | (24.83872,121.01772) | 8782 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024137 | 新竹縣 光電業者 1MW 光電場 | (24.89540,121.07620) | 台灣新竹縣 | (24.83872,121.01772) | 8633 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024193 | 苗栗縣 光電業者 2MW 光電場 | (24.51430,120.75270) | 台灣苗栗縣 | (24.56016,120.82143) | 8622 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001024072 | 雲林縣 光電業者 2MW 光電場 | (23.78330,120.44920) | 台灣雲林縣 | (23.70920,120.43134) | 8437 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066376 | 桃園市 光電業者 1MW 光電場 | (24.91940,121.28490) | 台灣桃園市 | (24.99363,121.30098) | 8411 | [map](https://www.google.com/maps/search/?api=1&query=24.9936281,121.3009798&query_place_id=ChIJP4bazg49aDQRakg6WFJP5FQ) |
| t4-gem-solar-L100001024158 | 鳳山淨水廠北清水池太陽光電發電廠 | (22.54630,120.39030) | 830台灣高雄市鳳山區 | (22.61136,120.34932) | 8369 | [map](https://www.google.com/maps/search/?api=1&query=22.6113591,120.3493158&query_place_id=ChIJL2cK5E8bbjQRRo1rQ25e2l0) |
| t4-gem-solar-L100000831069 | 臺南市 光電業者 10MW 光電場 | (23.16400,120.10400) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 8201 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-台塑石化麥寮汽電 | 台塑石化麥寮汽電共生廠 | (23.80877,120.21189) | 638台灣雲林縣麥寮鄉麥津村麥寮鄉 | (23.74857,120.25635) | 8080 | [map](https://www.google.com/maps/search/?api=1&query=23.7485672,120.2563528&query_place_id=ChIJqwPRB1OvbjQRxE6-ez7rCg8) |
| t4-gem-solar-L100001066503 | 高雄市 光電業者 1MW 光電場 | (22.63870,120.37910) | 台灣高雄市 | (22.62728,120.30144) | 8071 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066534 | 臺南市 光電業者 3MW 光電場 | (23.29680,120.15060) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 8062 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001047747 | 臺南市 Nanxu 53MW 光電場 | (23.16050,120.12170) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 7669 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-wind-L100000901075 | 澎湖風場 | (23.58380,119.65270) | 台灣澎湖縣 | (23.57119,119.57932) | 7609 | [map](https://www.google.com/maps/search/?api=1&query=23.5711899,119.5793157&query_place_id=ChIJXcTEPjdRbDQRI7DPZYYs6Lg) |
| t4-gem-solar-L100001066360 | 雲林縣 光電業者 2MW 光電場 | (23.74790,120.49210) | 台灣雲林縣 | (23.70920,120.43134) | 7535 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001066447 | 苗栗縣 光電業者 9MW 光電場 | (24.62200,120.85170) | 台灣苗栗縣 | (24.56016,120.82143) | 7527 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-wind-L100000916949 | 雲林麥寮風場 | (23.81340,120.26870) | 638台灣雲林縣麥寮鄉麥津村麥寮鄉 | (23.74857,120.25635) | 7318 | [map](https://www.google.com/maps/search/?api=1&query=23.7485672,120.2563528&query_place_id=ChIJqwPRB1OvbjQRxE6-ez7rCg8) |
| t4-gem-solar-L100001066508 | 嘉義縣 光電業者 2MW 光電場 | (23.46010,120.32620) | 台灣嘉義縣 | (23.45184,120.25546) | 7274 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001024065 | 新竹縣 光電業者 2MW 光電場 | (24.90340,121.01000) | 台灣新竹縣 | (24.83872,121.01772) | 7234 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024102 | 新竹縣 光電業者 3MW 光電場 | (24.88950,120.97810) | 台灣新竹縣 | (24.83872,121.01772) | 6918 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066519 | 臺南市 光電業者 2MW 光電場 | (23.27520,120.11140) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 6911 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066407 | 臺南市 光電業者 8MW 光電場 | (23.26830,120.19660) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 6812 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-wind-L100000916925 | 新竹香山風場 | (24.73740,120.88360) | 台灣新竹市香山區 | (24.77982,120.93026) | 6667 | [map](https://www.google.com/maps/search/?api=1&query=24.7798216,120.9302603&query_place_id=ChIJ1fT05-pKaDQR0lvkLIM8VGo) |
| t4-gem-solar-L100001024197 | 宜蘭縣 光電業者 2MW 光電場 | (24.71340,121.67420) | 台灣宜蘭縣 | (24.70211,121.73775) | 6541 | [map](https://www.google.com/maps/search/?api=1&query=24.7021073,121.7377502&query_place_id=ChIJWy8jaz3gZzQRrAfTE55Su88) |
| t4-gem-solar-L100001024205 | 台東縣台東市大豐段542地號設置太陽能發電設備標租案 | (22.71240,121.10490) | 950台灣臺東縣臺東市文化里正氣路292號 | (22.75482,121.14903) | 6538 | [map](https://www.google.com/maps/search/?api=1&query=22.7548247,121.1490346&query_place_id=ChIJDfq8F_u5bzQRn8p5_dHTsb4) |
| t4-gem-solar-L100001066404 | 台南七股丞紗漁電共生案 | (23.17170,120.13050) | 724台灣臺南市七股區 | (23.11952,120.10118) | 6531 | [map](https://www.google.com/maps/search/?api=1&query=23.1195166,120.1011836&query_place_id=ChIJx41NYQXXbTQRkxL3t5elpl8) |
| t4-gem-solar-L100001024067 | 新竹縣 光電業者 2MW 光電場 | (24.89300,120.99380) | 台灣新竹縣 | (24.83872,121.01772) | 6500 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001024041 | 苗栗縣 光電業者 2MW 光電場 | (24.61810,120.82600) | 台灣苗栗縣 | (24.56016,120.82143) | 6459 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-彰化發電廠 | 彰化發電廠 | (24.09293,120.56079) | 台灣彰化縣 | (24.05180,120.51614) | 6440 | [map](https://www.google.com/maps/search/?api=1&query=24.0517963,120.5161352&query_place_id=ChIJdRR5tR5JaTQRJ380ulhL6NY) |
| t4-gem-solar-L100001024131 | 新竹縣 光電業者 2MW 光電場 | (24.89550,121.02970) | 台灣新竹縣 | (24.83872,121.01772) | 6428 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t3-ipp-森霸電廠 | 森霸電廠 | (22.94726,120.25118) | 台灣臺南市 ⚠️ | (22.99990,120.22688) | 6361 | [map](https://www.google.com/maps/search/?api=1&query=22.9998999,120.2268758&query_place_id=ChIJE_4_lcx8bjQRTnbcpapMf9Q) |
| t4-gem-solar-L100001018614 | 乾耀台南官田區太陽光電發電廠 | (23.22240,120.30130) | 720台灣臺南市官田區 | (23.19488,120.35508) | 6291 | [map](https://www.google.com/maps/search/?api=1&query=23.1948768,120.3550808&query_place_id=ChIJmdAaxrtibjQRkO-o3PfkVHc) |
| t4-gem-solar-L100001066413 | 嘉義縣 光電業者 2MW 光電場 | (23.44010,120.31550) | 台灣嘉義縣 | (23.45184,120.25546) | 6262 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-solar-L100001066396 | 雲林縣 光電業者 2MW 光電場 | (23.68070,120.48410) | 台灣雲林縣 | (23.70920,120.43134) | 6238 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-solar-L100001018644 | 大創綠能彌海段第一期太陽光電發電系統工程 | (22.77330,120.24300) | 820台灣高雄市岡山區後紅里中山南路308號 ⚠️ | (22.78694,120.29999) | 6036 | [map](https://www.google.com/maps/search/?api=1&query=22.7869374,120.2999914&query_place_id=ChIJ2eorGAAPbjQR7mU3psl3BwM) |
| t4-gem-solar-L100001024185 | 雲林縣 光電業者 3MW 光電場 | (23.72590,120.48680) | 台灣雲林縣 | (23.70920,120.43134) | 5944 | [map](https://www.google.com/maps/search/?api=1&query=23.7092033,120.4313373&query_place_id=ChIJQfPHcye6bjQRlSrRA3zE5Ho) |
| t4-gem-Lutsao_Refuse_power_station | 鹿草資源回收廠 | (23.44856,120.27959) | 611台灣嘉義縣鹿草鄉鹿草村鹿環南路466號 | (23.40778,120.31463) | 5775 | [map](https://www.google.com/maps/search/?api=1&query=23.4077822,120.314633&query_place_id=ChIJsyk73IebbjQRDdE6UCRSrrU) |
| t4-gem-solar-L100001024098 | 新竹縣 光電業者 2MW 光電場 | (24.89050,121.01550) | 台灣新竹縣 | (24.83872,121.01772) | 5762 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-solar-L100001066544 | 高雄市 光電業者 2MW 光電場 | (22.67360,120.27810) | 台灣高雄市 | (22.62728,120.30144) | 5680 | [map](https://www.google.com/maps/search/?api=1&query=22.6272784,120.3014353&query_place_id=ChIJG3R6elFDbjQRNypzVEqiJkg) |
| t4-gem-solar-L100001066463 | 臺中市 光電業者 1MW 光電場 | (24.19380,120.65160) | 台灣臺中市 | (24.14774,120.67365) | 5589 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-solar-L100000831052 | 泰陽義竹1-1期溫室科技養殖結合太陽光電發電廠 | (23.36760,120.19980) | 624台灣嘉義縣義竹鄉仁里村義竹378-1號 | (23.33606,120.24138) | 5506 | [map](https://www.google.com/maps/search/?api=1&query=23.3360584,120.2413781&query_place_id=ChIJpyvXxvKDbjQRMtT2ho_PB_g) |
| t4-gem-solar-L100001066412 | 臺南市 光電業者 1MW 光電場 | (23.17550,120.14690) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 5436 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001066451 | 禾迅一號台南鹽水太陽光電發電系統工程 | (23.31070,120.23400) | 737台灣臺南市鹽水區 | (23.26223,120.23973) | 5421 | [map](https://www.google.com/maps/search/?api=1&query=23.2622306,120.2397336&query_place_id=ChIJiQmTg06BbjQRRtlnZ1V7rZc) |
| t4-gem-solar-L100001024117 | 臺南市 光電業者 4MW 光電場 | (23.24950,120.19560) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 5419 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000831047 | 臺南市 光電業者 8MW 光電場 | (23.23210,120.09920) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 5284 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024122 | 彰化縣 光電業者 2MW 光電場 | (24.06000,120.40800) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 5255 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t1-gov-曾文發電廠 | 曾文發電廠 | (23.20345,120.51639) | 71544台灣臺南市楠西區密枝里133號 ⚠️ | (23.24786,120.53363) | 5244 | [map](https://www.google.com/maps/search/?api=1&query=23.2478645,120.5336294&query_place_id=ChIJwSJfAwD1bjQRCxt6AUctuR8) |
| t4-gem-solar-L100001024218 | 銧昊第一期太陽能電廠 | (22.51150,120.57380) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 5184 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100000801439 | 心忠學甲第一型太陽電廠 | (23.24200,120.21900) | 726台灣臺南市學甲區 | (23.25538,120.17048) | 5176 | [map](https://www.google.com/maps/search/?api=1&query=23.2553798,120.1704766&query_place_id=ChIJIT10R22AbjQRml6Ucy-hgzc) |
| t4-gem-solar-L100001066538 | 屏東縣內埔鄉建興段太陽光電發電業 | (22.66150,120.56950) | 912台灣屏東縣內埔鄉內埔 | (22.61513,120.56632) | 5166 | [map](https://www.google.com/maps/search/?api=1&query=22.6151342,120.5663201&query_place_id=ChIJlazIaPsibjQRTtUM1rjhZtg) |
| t4-gem-solar-L100001024163 | 嘉義縣 光電業者 5MW 光電場 | (23.43460,120.30170) | 台灣嘉義縣 | (23.45184,120.25546) | 5092 | [map](https://www.google.com/maps/search/?api=1&query=23.4518428,120.2554615&query_place_id=ChIJUaq7v1frbjQRNXYqVp3u5Zc) |
| t4-gem-新港電廠 | 新港電廠 | (23.51856,120.37488) | 616台灣嘉義縣新港鄉大興村新港 | (23.55645,120.34784) | 5035 | [map](https://www.google.com/maps/search/?api=1&query=23.5564505,120.3478401&query_place_id=ChIJ6TlelFO9bjQRQjngl6S2lZE) |
| t4-gem-solar-L100001066496 | 屏東鹽埔太陽光電發電廠 | (22.74420,120.51430) | 907台灣屏東縣鹽埔鄉 | (22.74368,120.56245) | 4938 | [map](https://www.google.com/maps/search/?api=1&query=22.7436807,120.5624474&query_place_id=ChIJ1W7g7Hw-bjQR6k7Or4_bV7w) |
| t4-gem-solar-L100001066402 | 吉瑞_斗六1號太陽光電發電廠 | (23.72540,120.58300) | 640台灣雲林縣斗六市嘉東里斗六 | (23.70648,120.53973) | 4882 | [map](https://www.google.com/maps/search/?api=1&query=23.7064789,120.5397258&query_place_id=ChIJmRA0WhPIbjQR22u4bnnjk6U) |
| t4-gem-solar-L100001024121 | 臺南市 光電業者 1MW 光電場 | (23.23800,120.10620) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 4748 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024059 | 臺中市 光電業者 1MW 光電場 | (24.10730,120.65880) | 台灣臺中市 | (24.14774,120.67365) | 4742 | [map](https://www.google.com/maps/search/?api=1&query=24.1477358,120.6736482&query_place_id=ChIJ7yJ5-d8XaTQRf0SmfuQ-Uoc) |
| t4-gem-wind-L100000922289 | 四湖（科威）風場 | (23.64940,120.14900) | 台灣雲林縣四湖鄉 | (23.63708,120.19357) | 4742 | [map](https://www.google.com/maps/search/?api=1&query=23.6370834,120.1935663&query_place_id=ChIJPcmjgR-hbjQRo8N032qmxhY) |
| t3-island-中屯風力發電廠 | 中屯風力發電廠 | (23.64800,119.60800) | Chuton Island, Baisha Township, Penghu County, 台灣 884 ⚠️ | (23.60778,119.59861) | 4574 | [map](https://www.google.com/maps/search/?api=1&query=23.6077778,119.5986111&query_place_id=ChIJh6MQF0xbbDQRb7P3RDI3WKA) |
| t4-gem-solar-L100001024127 | 太陽光電(PV)第二期計畫「七股(Ⅱ)太陽光電新建工程」 | (23.09680,120.13760) | 724台灣臺南市七股區 | (23.11952,120.10118) | 4500 | [map](https://www.google.com/maps/search/?api=1&query=23.1195166,120.1011836&query_place_id=ChIJx41NYQXXbTQRkxL3t5elpl8) |
| t4-gem-solar-L100001047742 | 臺南市七股區下山子寮段下排太陽光電發電系統工程（第一期） | (23.13640,120.09800) | 724台灣臺南市七股區628號 | (23.12399,120.13965) | 4477 | [map](https://www.google.com/maps/search/?api=1&query=23.12399,120.139648&query_place_id=ChIJlQfNMADXbTQRInV4Fq45u_4) |
| t4-gem-林口廠汽電 | 林口廠汽電 | (25.04614,121.41338) | 台灣新北市林口區 | (25.07901,121.38814) | 4452 | [map](https://www.google.com/maps/search/?api=1&query=25.0790108,121.3881378&query_place_id=ChIJVTnwI0qhQjQRSx-QpDlctCo) |
| t3-nuclear-核一 | 核一廠 | (25.25236,121.59009) | 253台灣新北市石門區乾華里 ⚠️ | (25.29068,121.59104) | 4262 | [map](https://www.google.com/maps/search/?api=1&query=25.2906793,121.5910411&query_place_id=ChIJITYfpAi1QjQR6fVJAoG0Iqs) |
| t4-gem-wind-L100000922284 | 竹南風場 | (24.67690,120.83730) | 350台灣苗栗縣竹南鎮Unnamed Road | (24.70923,120.81507) | 4239 | [map](https://www.google.com/maps/search/?api=1&query=24.709231,120.8150695&query_place_id=ChIJK4Q_MsizaTQRFNrqm3iMqX4) |
| t4-gem-solar-L100001018549 | 臺南市七股區下山子寮段上排太陽光電發電系統工程（第一期） | (23.14310,120.10420) | 724台灣臺南市七股區628號 | (23.12399,120.13965) | 4202 | [map](https://www.google.com/maps/search/?api=1&query=23.12399,120.139648&query_place_id=ChIJlQfNMADXbTQRInV4Fq45u_4) |
| t4-gem-solar-L100000831050 | 彰化縣大城鄉太陽光電發電廠 | (23.85800,120.27020) | 台灣彰化縣大城鄉 | (23.84836,120.30895) | 4084 | [map](https://www.google.com/maps/search/?api=1&query=23.8483614,120.3089541&query_place_id=ChIJEbf766etbjQR4pQI3GVi9j4) |
| t4-gem-solar-L100001024212 | 五結鄉舊掩埋場太陽光電發電廠 | (24.66280,121.83340) | 台灣宜蘭縣五結鄉 | (24.68876,121.80501) | 4070 | [map](https://www.google.com/maps/search/?api=1&query=24.6887633,121.8050125&query_place_id=ChIJKVEgTuHlZzQRhrjH31nIFhk) |
| t1-gov-高屏發電廠 | 高屏發電廠 | (22.88538,120.55094) | 843台灣高雄市美濃區獅山里竹門20號 ⚠️ | (22.86939,120.58639) | 4044 | [map](https://www.google.com/maps/search/?api=1&query=22.8693949,120.5863945&query_place_id=ChIJQ-hQDxJBbjQRF3WLWEi_fyk) |
| t4-gem-wind-L100000916940 | 台中港風場 | (24.30440,120.54410) | 台灣台中港 | (24.28873,120.50848) | 4009 | [map](https://www.google.com/maps/search/?api=1&query=24.28873395704358,120.5084770458559&query_place_id=ChIJW3RvrFhraTQRcvVZF2-dPZ4) |
| t4-gem-solar-L100001024166 | 速力綠能芳苑發電廠-第一機組 | (23.92360,120.32580) | 台灣彰化縣芳苑鄉 | (23.94559,120.35508) | 3852 | [map](https://www.google.com/maps/search/?api=1&query=23.9455949,120.3550808&query_place_id=ChIJ7fOG5fJNaTQRAvo9Sjgb78o) |
| t4-gem-solar-L100001018530 | 臺南市 Chenya 55MW 光電場 | (23.24830,120.17630) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 3772 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100000831054 | 屏東枋寮第一期太陽光電發電廠 | (22.41620,120.61470) | 台灣屏東縣枋寮鄉 | (22.39607,120.58547) | 3747 | [map](https://www.google.com/maps/search/?api=1&query=22.3960688,120.5854674&query_place_id=ChIJr9p1l5becTQRg2ejXaVVQ0I) |
| t4-gem-solar-L100001024100 | 臺南市 光電業者 1MW 光電場 | (23.19580,120.16910) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 3711 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-苗栗石化汽電 | 苗栗石化廠汽電 | (24.59324,120.81792) | 台灣苗栗縣 | (24.56016,120.82143) | 3695 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100001066513 | 臺南市 光電業者 2MW 光電場 | (23.25490,120.16020) | 725台灣臺南市將軍區巷埔里53-10號 | (23.22430,120.15021) | 3553 | [map](https://www.google.com/maps/search/?api=1&query=23.224297,120.150207&query_place_id=ChIJt5DjMwDVbTQR8ttyH6iYwTs) |
| t4-gem-solar-L100001024159 | 「高雄市楠梓污水下水道系統建設計畫案」之附屬事業計… | (22.72410,120.26280) | 811台灣高雄市楠梓區翠屏里益群路70號 | (22.72513,120.29703) | 3513 | [map](https://www.google.com/maps/search/?api=1&query=22.7251265,120.2970316&query_place_id=ChIJhfYfChQPbjQRzdCT_0tabTE) |
| t4-gem-solar-L100001066473 | 天權第三期(第一階段)太陽能電廠 | (22.58340,120.54780) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 3496 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100000831051 | 嘉義縣義竹鄉（西後寮段、龍蛟潭段龍蛟 小段）及布袋… | (23.38420,120.21430) | 624台灣嘉義縣義竹鄉 | (23.35301,120.21665) | 3476 | [map](https://www.google.com/maps/search/?api=1&query=23.3530108,120.2166519&query_place_id=ChIJ__R397yDbjQRTSNhKH5hWOE) |
| t4-gem-solar-L100001066491 | 台南市北門區太陽光電發電廠第一期 | (23.25620,120.11640) | 台灣臺南市北門區 | (23.28660,120.12429) | 3475 | [map](https://www.google.com/maps/search/?api=1&query=23.2866026,120.1242853&query_place_id=ChIJA-Hbpe0qbDQR_J9Ux-VBsSE) |
| t4-gem-solar-L100001024071 | 新竹縣 光電業者 1MW 光電場 | (24.86660,121.00290) | 台灣新竹縣 | (24.83872,121.01772) | 3442 | [map](https://www.google.com/maps/search/?api=1&query=24.8387226,121.0177246&query_place_id=ChIJ1U9noSxBaDQRyR8fDl8UYUA) |
| t4-gem-wind-L100000922293 | 彰濱（台泥）風場 | (24.12580,120.42610) | 台灣彰化縣鹿港鎮海埔里彰濱產業園區 | (24.10041,120.40695) | 3428 | [map](https://www.google.com/maps/search/?api=1&query=24.1004083,120.4069537&query_place_id=ChIJW2mjQsdFaTQRNdNjgiu3wIE) |
| t4-gem-Jinshan_Acmepoint_geothermal_power_plant | 金山 Acmepoint 地熱發電廠 | (25.21578,121.60357) | 台灣新北市金山區 | (25.22236,121.63678) | 3420 | [map](https://www.google.com/maps/search/?api=1&query=25.2223616,121.6367773&query_place_id=ChIJIWMpPl2zQjQR4X9_x7mYhks) |
| t4-gem-Houli_Incineration_power_station | 后里垃圾焚化廠 | (24.28759,120.69828) | 421台灣臺中市后里區 | (24.30888,120.72237) | 3401 | [map](https://www.google.com/maps/search/?api=1&query=24.3088765,120.7223705&query_place_id=ChIJeYLZBAYQaTQRKrxdN5V5IDo) |
| t3-island-西莒發電廠 | 西莒發電廠 | (25.97400,119.94200) | 莒光 ⚠️ | (25.96048,119.97233) | 3384 | [map](https://www.google.com/maps/search/?api=1&query=25.9604777,119.9723303&query_place_id=ChIJD88BvbKcQTQRprhN0O1-SV0) |
| t4-gem-solar-L100001047745 | 台南市北門區太陽光電發電廠第一期 | (23.25680,120.11960) | 台灣臺南市北門區 | (23.28660,120.12429) | 3348 | [map](https://www.google.com/maps/search/?api=1&query=23.2866026,120.1242853&query_place_id=ChIJA-Hbpe0qbDQR_J9Ux-VBsSE) |
| t4-gem-solar-L100001024128 | 正新雲林斗六三廠地面型3540.46kWp太陽光電發電廠 | (23.73950,120.54570) | 640台灣雲林縣斗六市正心里正心路1號 | (23.71471,120.52737) | 3328 | [map](https://www.google.com/maps/search/?api=1&query=23.7147143,120.5273692&query_place_id=ChIJF_n6_ifIbjQRrZPrJK_ZlYw) |
| t4-gem-solar-L100000800883 | 嘉義縣義竹鄉（西後寮段、龍蛟潭段龍蛟小段）及布袋鎮… | (23.38030,120.21690) | 624台灣嘉義縣義竹鄉 | (23.35301,120.21665) | 3035 | [map](https://www.google.com/maps/search/?api=1&query=23.3530108,120.2166519&query_place_id=ChIJ__R397yDbjQRTSNhKH5hWOE) |
| t4-gem-solar-L100001066512 | 臺鐵潮州機廠屋頂型太陽光電系統 | (22.52810,120.53840) | 台灣屏東縣 ⚠️ | (22.55198,120.54876) | 2860 | [map](https://www.google.com/maps/search/?api=1&query=22.5519759,120.5487597&query_place_id=ChIJgSJ04U7ZcTQRVYOms5RRIe0) |
| t4-gem-solar-L100001066535 | 苗栗縣 光電業者 2MW 光電場 | (24.58170,120.80600) | 台灣苗栗縣 | (24.56016,120.82143) | 2858 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100000831055 | 生豐一期兆豐農場地面型太陽光電發電廠 | (23.79290,121.48970) | 975台灣花蓮縣鳳林鎮林榮里永福街20號 ⚠️ | (23.80184,121.46353) | 2842 | [map](https://www.google.com/maps/search/?api=1&query=23.8018408,121.4635288&query_place_id=ChIJk-Kfuu6vaDQRBXQ_rxiJ5wk) |
| t4-gem-solar-L100001066542 | 達屏綠能一期屏東枋寮地面型太陽光電發電廠 | (22.38920,120.56460) | 940台灣屏東縣枋寮鄉枋寮 | (22.40927,120.57784) | 2614 | [map](https://www.google.com/maps/search/?api=1&query=22.4092726,120.5778438&query_place_id=ChIJza19rozecTQRupe5uK9zKdo) |
| t4-gem-solar-L100001066502 | 台中捷運北屯機廠太陽光電發電設備 | (24.19030,120.70990) | 406台灣臺中市北屯區 | (24.18152,120.68610) | 2604 | [map](https://www.google.com/maps/search/?api=1&query=24.1815237,120.6861019&query_place_id=ChIJNVraxTYYaTQRfxhvM1N18W0) |
| t3-nuclear-核二 | 核二廠 | (25.20320,121.68515) | 207台灣新北市萬里區野柳里八斗60號 ⚠️ | (25.20636,121.65959) | 2595 | [map](https://www.google.com/maps/search/?api=1&query=25.2063645,121.659595&query_place_id=ChIJjSNw2I9MXTQRFD2eULQBGeE) |
| t4-gem-solar-L100000831066 | 新和將軍區太陽光電發電廠 | (23.19500,120.12380) | 台灣臺南市將軍區 | (23.20549,120.10118) | 2589 | [map](https://www.google.com/maps/search/?api=1&query=23.2054945,120.1011836&query_place_id=ChIJLxspUKjVbTQR-6WO7Js34tA) |
| t4-gem-solar-L100001024119 | 苗栗縣 光電業者 2MW 光電場 | (24.57510,120.80180) | 台灣苗栗縣 | (24.56016,120.82143) | 2588 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t4-gem-solar-L100000831049 | 彰化縣 United 192MW 光電場 | (24.10900,120.42010) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 2578 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t4-gem-solar-L100000831058 | 永宙一期口湖段太陽光電系統發電計畫(第二階段) | (23.59700,120.17400) | 653台灣雲林縣口湖鄉崙中村口湖 | (23.61783,120.16309) | 2570 | [map](https://www.google.com/maps/search/?api=1&query=23.6178327,120.1630864&query_place_id=ChIJzxNrvnagbjQROicU1S_GZKI) |
| t4-gem-solar-L100001061924 | 達屏綠能一期屏東枋寮地面型太陽光電發電廠 | (22.39150,120.56280) | 940台灣屏東縣枋寮鄉枋寮 | (22.40927,120.57784) | 2509 | [map](https://www.google.com/maps/search/?api=1&query=22.4092726,120.5778438&query_place_id=ChIJza19rozecTQRupe5uK9zKdo) |
| t4-gem-solar-L100001024171 | 屏東林邊鎮安太陽光電發電廠－第二期(第二階段) | (22.43770,120.50470) | 927台灣屏東縣林邊鄉鎮安村鎮安 | (22.45874,120.50185) | 2358 | [map](https://www.google.com/maps/search/?api=1&query=22.458742,120.501847&query_place_id=ChIJWyOZAUPgcTQRp746NFNT5hI) |
| t3-island-虎井發電廠 | 虎井發電廠 | (23.50500,119.54400) | Table Island, Magong City, Penghu County, 台灣 880 ⚠️ | (23.49056,119.52778) | 2306 | [map](https://www.google.com/maps/search/?api=1&query=23.4905556,119.5277778&query_place_id=ChIJTRsPNjlRbDQRd96jwxFCgoU) |
| t4-gem-solar-L100001024110 | 苗栗縣 光電業者 1MW 光電場 | (24.57920,120.82950) | 台灣苗栗縣 | (24.56016,120.82143) | 2269 | [map](https://www.google.com/maps/search/?api=1&query=24.560159,120.8214265&query_place_id=ChIJk9NaC4pUaDQRG4hgT-5vqMw) |
| t1-gov-卓蘭發電廠 | 卓蘭發電廠 | (24.35429,120.90156) | 369台灣苗栗縣卓蘭鎮 | (24.34982,120.88123) | 2119 | [map](https://www.google.com/maps/search/?api=1&query=24.3498188,120.8812283&query_place_id=ChIJrX2OS2wCaTQRQ91XhrDOTZw) |
| t4-gem-solar-L100001061893 | 彰化縣 光電業者 120MW 光電場 | (24.09460,120.41070) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 2022 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t1-gov-興達發電廠 | 興達發電廠 | (22.83862,120.20259) | 828台灣高雄市永安區鹽田里興達路6號 | (22.85649,120.20045) | 2000 | [map](https://www.google.com/maps/search/?api=1&query=22.8564943,120.2004541&query_place_id=ChIJZ_uCW_wKbjQRlp6Dhg6vW2M) |
| t4-gem-solar-L100001018618 | 嘉義縣布袋鎮貴舍2滯洪池水面浮力式太陽光電發電場設置計畫 | (23.41500,120.22670) | 625台灣嘉義縣布袋鎮貴舍里貴舍 | (23.42604,120.21169) | 1963 | [map](https://www.google.com/maps/search/?api=1&query=23.426039,120.211687&query_place_id=ChIJ-bfKMdycbjQR27BD4pVGAx8) |
| t1-gov-協和電廠－珠山分廠 | 協和電廠－珠山分廠 | (26.14778,119.93792) | 連江縣 ⚠️ | (26.16024,119.95167) | 1951 | [map](https://www.google.com/maps/search/?api=1&query=26.160243,119.9516652&query_place_id=ChIJ2aunYmllQTQRntXu6lNDlCU) |
| t4-gem-solar-L100001018597 | 北門玉港一號太陽光電發電廠 | (23.26380,120.12640) | 727台灣臺南市北門區玉港里 | (23.26891,120.14450) | 1934 | [map](https://www.google.com/maps/search/?api=1&query=23.2689137,120.144496&query_place_id=ChIJqylvlbkqbDQRLEqhFi2OY-k) |
| t4-gem-台南九崴南科電廠 | 台南九崴南科電廠 | (23.09414,120.26502) | 744台灣臺南市新市區豐華里南科三路22號 | (23.10127,120.28222) | 1929 | [map](https://www.google.com/maps/search/?api=1&query=23.1012681,120.2822156&query_place_id=ChIJrd8RLaF7bjQRFqhHZLmQ3mY) |
| t4-gem-solar-L100001066418 | 臺南市第一期北門太陽光電發電廠 | (23.27540,120.13870) | 台灣臺南市北門區 | (23.28660,120.12429) | 1929 | [map](https://www.google.com/maps/search/?api=1&query=23.2866026,120.1242853&query_place_id=ChIJA-Hbpe0qbDQR_J9Ux-VBsSE) |
| t4-gem-solar-L100000831064 | 臺南市第一期北門太陽光電發電廠 | (23.27640,120.13930) | 台灣臺南市北門區 | (23.28660,120.12429) | 1908 | [map](https://www.google.com/maps/search/?api=1&query=23.2866026,120.1242853&query_place_id=ChIJA-Hbpe0qbDQR_J9Ux-VBsSE) |
| t4-gem-樹林電廠 | 樹林電廠 | (24.97343,121.40440) | 台灣新北市樹林區 | (24.98156,121.41986) | 1801 | [map](https://www.google.com/maps/search/?api=1&query=24.9815605,121.4198606&query_place_id=ChIJExKsKKsdaDQRX7Z5j6Nt_ug) |
| t4-gem-Kanding_Incineration_power_station | 崁頂資源回收廠 | (22.49981,120.49782) | 924台灣屏東縣崁頂鄉 | (22.51584,120.49912) | 1787 | [map](https://www.google.com/maps/search/?api=1&query=22.5158427,120.4991209&query_place_id=ChIJObDMmLsfbjQRnu5574b1DKw) |
| t4-gem-solar-L100001066423 | 漢寶電業第一型太陽能電廠(屋頂型) | (24.01830,120.37270) | 528台灣彰化縣芳苑鄉漢寶村漢寶 | (24.00627,120.38435) | 1786 | [map](https://www.google.com/maps/search/?api=1&query=24.006269,120.384349&query_place_id=ChIJT8MX1lZOaTQRMEoWl2detVA) |
| t4-gem-wind-L100000922282 | 澎湖龍門風場 | (23.56090,119.69030) | 885台灣澎湖縣湖西鄉58-2號 | (23.56430,119.67320) | 1783 | [map](https://www.google.com/maps/search/?api=1&query=23.5643,119.6732&query_place_id=ChIJ_____8xFbDQRKmKcj9j4WQA) |
| t3-island-東引大我發電廠 | 東引大我發電廠 | (26.36800,120.49200) | 東引鄉 | (26.37667,120.50667) | 1750 | [map](https://www.google.com/maps/search/?api=1&query=26.376667,120.506667&query_place_id=ChIJYfaIQd7sQzQRSldjfIOnyXU) |
| t4-gem-solar-L100000831065 | 臺南市第一期北門太陽光電發電廠 | (23.27670,120.13760) | 台灣臺南市北門區 | (23.28660,120.12429) | 1750 | [map](https://www.google.com/maps/search/?api=1&query=23.2866026,120.1242853&query_place_id=ChIJA-Hbpe0qbDQR_J9Ux-VBsSE) |
| t3-island-東莒發電廠 | 東莒發電廠 | (25.96500,119.98700) | 91號 ⚠️ | (25.95757,119.97162) | 1745 | [map](https://www.google.com/maps/search/?api=1&query=25.9575662,119.9716237&query_place_id=ChIJUV1oD62cQTQRFZPe0txrhRg) |
| t4-gem-solar-L100001066516 | 吉瑞_斗六二號 | (23.71230,120.57520) | 640台灣雲林縣斗六市榴中里石榴路133號640 | (23.72454,120.58535) | 1709 | [map](https://www.google.com/maps/search/?api=1&query=23.7245375,120.5853493&query_place_id=ChIJKzyD_g_JbjQRdsdBwrq7v1w) |
| t1-gov-大觀發電廠 | 大觀發電廠 | (23.83917,120.86833) | 553台灣南投縣水里鄉明潭巷73號 ⚠️ | (23.85443,120.86962) | 1702 | [map](https://www.google.com/maps/search/?api=1&query=23.854427,120.869621&query_place_id=ChIJW1V4LCMqaTQRRKJ7BkoAKt8) |
| t4-gem-solar-L100001018538 | 臺南市七股區三股子段及三和段太陽光電發電系統工程(B區) | (23.11210,120.11570) | 724台灣臺南市七股區 | (23.11952,120.10118) | 1698 | [map](https://www.google.com/maps/search/?api=1&query=23.1195166,120.1011836&query_place_id=ChIJx41NYQXXbTQRkxL3t5elpl8) |
| t3-nuclear-核三 | 核三廠 | (21.96843,120.76373) | 946台灣屏東縣恆春鎮南灣里南灣路387號 ⚠️ | (21.95814,120.75177) | 1682 | [map](https://www.google.com/maps/search/?api=1&query=21.9581404,120.7517691&query_place_id=ChIJwWk5e1GwcTQRD3VxKFpf0Es) |
| t4-gem-solar-L100000831048 | 新塭南、北側滯洪池水域型太陽光電發電業 | (23.32040,120.16900) | 625台灣嘉義縣布袋鎮新民里新塭 | (23.32985,120.15915) | 1455 | [map](https://www.google.com/maps/search/?api=1&query=23.329851,120.159149&query_place_id=ChIJMRQNKf6BbjQRUGXnSIdQNlE) |
| t4-gem-solar-L100001066479 | 屏東縣東港鎮三西和滯洪池水面浮力式太陽光電發電廠設置計畫 | (22.47090,120.48240) | 928台灣屏東縣東港鎮興和里三西和 | (22.48345,120.48251) | 1396 | [map](https://www.google.com/maps/search/?api=1&query=22.483454,120.482507&query_place_id=ChIJ8eNMNy3gcTQRnKTbZVjNr-I) |
| t4-gem-solar-L100001024123 | 嵩旺高雄彌陀太陽光電發電廠 | (22.77520,120.25450) | 台灣高雄市彌陀區 | (22.78322,120.24550) | 1283 | [map](https://www.google.com/maps/search/?api=1&query=22.7832231,120.2455033&query_place_id=ChIJ-erS9jkJbjQRvaiAITrzlf8) |
| t4-gem-solar-L100001024164 | 彰化縣大城鄉永堯一期太陽光電發電廠 | (23.88320,120.29250) | 527台灣彰化縣大城鄉西港村中央路78號 | (23.87193,120.29331) | 1256 | [map](https://www.google.com/maps/search/?api=1&query=23.8719323,120.2933108&query_place_id=ChIJjaZ7gyGtbjQR5s6C5LjkWEM) |
| t4-gem-solar-L100000831060 | 臺南市七股區三股子段及三和段太陽光電發電系統工程(C區) | (23.11540,120.11230) | 724台灣臺南市七股區 | (23.11952,120.10118) | 1226 | [map](https://www.google.com/maps/search/?api=1&query=23.1195166,120.1011836&query_place_id=ChIJx41NYQXXbTQRkxL3t5elpl8) |
| t4-gem-solar-L100001024154 | 後龍水尾滯洪池水面型太陽光電系統 | (24.62420,120.75820) | 356台灣苗栗縣後龍鎮水尾里水尾 | (24.63366,120.76340) | 1176 | [map](https://www.google.com/maps/search/?api=1&query=24.633658,120.763397&query_place_id=ChIJ7cNbK0quaTQRqAfANWaEH0M) |
| t4-gem-solar-L100001066484 | 中鈁湖西太陽光電發電系統工程(第一階段)(地面型) | (23.56760,119.65790) | 台灣澎湖縣湖西鄉 | (23.57737,119.66151) | 1147 | [map](https://www.google.com/maps/search/?api=1&query=23.5773682,119.6615055&query_place_id=ChIJ7VhTZkREbDQRZHkpcVmudoA) |

## ⚠ Review (200–1000m) — 17 廠

| facility_id | SSOT name | SSOT (lat,lng) | Google name | Google (lat,lng) | diff_m | Link |
|---|---|---|---|---|---:|---|
| t4-gem-solar-L100001018634 | 烏山頭水庫水面型太陽光電發電系統 | (23.19180,120.37750) | 720台灣臺南市官田區八田路三段香榭巷65號 ⚠️ | (23.19712,120.37000) | 969 | [map](https://www.google.com/maps/search/?api=1&query=23.1971231,120.3699962&query_place_id=ChIJ34L9L5libjQRKx_lnccOK0A) |
| t4-gem-solar-L100000800874 | 崙尾東二號電廠 | (24.11690,120.42570) | 505台灣彰化縣鹿港鎮山崙里 ⚠️ | (24.11855,120.41678) | 924 | [map](https://www.google.com/maps/search/?api=1&query=24.1185541,120.4167801&query_place_id=ChIJPdRWuzBFaTQRYIdVl9h9W2M) |
| t4-gem-仁武電廠 | 仁武電廠 | (22.70164,120.33505) | 814台灣高雄市仁武區 | (22.70580,120.34236) | 881 | [map](https://www.google.com/maps/search/?api=1&query=22.7057951,120.3423604&query_place_id=ChIJ7S6uNhEQbjQRs-XflSl9j84) |
| t4-gem-solar-L100000800875 | 彰化縣 Taiwan 100MW 光電場 | (24.09970,120.38980) | 505台灣彰化縣鹿港鎮 | (24.10574,120.39495) | 851 | [map](https://www.google.com/maps/search/?api=1&query=24.1057364,120.3949481&query_place_id=ChIJ4-jbKVdEaTQR9H3JNejjyTQ) |
| t1-gov-萬大發電廠 | 萬大發電廠 | (23.97340,121.12792) | 546台灣南投縣仁愛鄉親愛村大安路1號號 ⚠️ | (23.97662,121.13486) | 792 | [map](https://www.google.com/maps/search/?api=1&query=23.9766229,121.1348629&query_place_id=ChIJj9v2iYfDaDQRHmijIOcAui4) |
| t4-gem-solar-L100001024174 | 屏東林邊鎮安太陽光電發電廠-第一期 | (22.45270,120.50570) | 927台灣屏東縣林邊鄉鎮安村鎮安 | (22.45874,120.50185) | 780 | [map](https://www.google.com/maps/search/?api=1&query=22.458742,120.501847&query_place_id=ChIJWyOZAUPgcTQRp746NFNT5hI) |
| t4-gem-solar-L100001066514 | 彰化縣大城鄉永堯一期太陽光電發電廠 | (23.87760,120.28950) | 527台灣彰化縣大城鄉西港村中央路78號 | (23.87193,120.29331) | 740 | [map](https://www.google.com/maps/search/?api=1&query=23.8719323,120.2933108&query_place_id=ChIJjaZ7gyGtbjQR5s6C5LjkWEM) |
| t1-gov-石門發電廠 | 石門發電廠 | (24.82051,121.24235) | 325台灣桃园市龍潭區大平里二坪路 ⚠️ | (24.81409,121.24292) | 715 | [map](https://www.google.com/maps/search/?api=1&query=24.8140941,121.2429224&query_place_id=ChIJhXdWnfk9aDQRU3PbnPxpB00) |
| t3-island-北竿軍魂發電廠 | 北竿軍魂發電廠 | (26.22100,120.00400) | 北竿鄉 | (26.22458,119.99826) | 697 | [map](https://www.google.com/maps/search/?api=1&query=26.2245753,119.9982607&query_place_id=ChIJlTak3BRlQTQR1Mmb4Xtp-RA) |
| t3-ipp-和平電廠 | 和平電廠 | (24.31072,121.74819) | 972台灣花蓮縣秀林鄉和平村和平208之83號 | (24.30542,121.74825) | 589 | [map](https://www.google.com/maps/search/?api=1&query=24.305422,121.7482533&query_place_id=ChIJzU82rqDTZzQRoC-NCcWT9Vw) |
| t1-gov-尖山發電廠 | 尖山發電廠 | (23.56868,119.66440) | 885台灣澎湖縣湖西鄉尖山發電廠 | (23.56504,119.66062) | 559 | [map](https://www.google.com/maps/search/?api=1&query=23.565038,119.660621&query_place_id=ChIJgbrCbq1FbDQRtcj8LDWqir8) |
| t3-nuclear-核四 | 核四廠（龍門） | (25.03940,121.92070) | 228台灣新北市貢寮區仁里里仁里里研海街62號 ⚠️ | (25.03864,121.92467) | 409 | [map](https://www.google.com/maps/search/?api=1&query=25.0386421,121.9246683&query_place_id=ChIJXxBF2excXTQRoJE_j47Bwkc) |
| t4-gem-solar-L100000831061 | 日運七股太陽光電發電系統工程(第一期)(地面型) | (23.12290,120.10040) | 724台灣臺南市七股區 | (23.11952,120.10118) | 385 | [map](https://www.google.com/maps/search/?api=1&query=23.1195166,120.1011836&query_place_id=ChIJx41NYQXXbTQRkxL3t5elpl8) |
| t4-gem-solar-L100001024081 | 玖炬三峽碳中和樂園太陽光電發電廠 | (24.89840,121.33350) | 237台灣新北市三峽區二鬮里中正路三段262號 | (24.89788,121.33727) | 384 | [map](https://www.google.com/maps/search/?api=1&query=24.8978799,121.337268&query_place_id=ChIJfapth_IZaDQRWsCfqbvz-9M) |
| t4-gem-國光電廠 | 國光電廠 | (25.04275,121.34213) | 333台灣桃園市龜山區南上里南上里北油1區11號 ⚠️ | (25.04049,121.34401) | 315 | [map](https://www.google.com/maps/search/?api=1&query=25.0404917,121.3440136&query_place_id=ChIJVVVVVSQeaDQR0oFR3p6dZFQ) |
| t4-gem-solar-L100001066474 | 台北自來水長興淨水場太陽光電系統 | (25.01560,121.54930) | 106台灣臺北市大安區學府里長興街131號 | (25.01423,121.54780) | 215 | [map](https://www.google.com/maps/search/?api=1&query=25.0142343,121.5477962&query_place_id=ChIJv2DWTTuqQjQRYKea671Qu1A) |
| t3-island-望安發電廠 | 望安發電廠 | (23.35800,119.50500) | 882台灣澎湖縣望安鄉東安村4-1號 | (23.35875,119.50680) | 202 | [map](https://www.google.com/maps/search/?api=1&query=23.3587549,119.5068037&query_place_id=ChIJ3bwtIWSrbTQRbvqaQcSQFuc) |

## ✓ Pass (<200m) — 51 廠 (略)

## 🛑 無 Google 結果 — 86 廠

| facility_id | name | county | reason |
|---|---|---|---|
| t4-gem-solar-L100000801444 | 台電 152MW 光電場 |  | no_results |
| t4-gem-solar-L100001024077 | 海上光電 3MW 光電場 |  | no_results |
| t4-gem-solar-L100001024079 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001024167 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001024182 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001024188 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001024192 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001024202 | 海上光電 3MW 光電場 |  | no_results |
| t4-gem-solar-L100001024203 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001024210 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001024211 | 海上光電 15MW 光電場 |  | no_results |
| t4-gem-solar-L100001066371 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066375 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066388 | 海上光電 4MW 光電場 |  | no_results |
| t4-gem-solar-L100001066390 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066398 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066411 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066419 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066438 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066443 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066453 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066456 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066478 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066480 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066486 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066501 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066518 | 海上光電 1MW 光電場 |  | no_results |
| t4-gem-solar-L100001066530 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066536 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066543 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-solar-L100001066545 | 海上光電 2MW 光電場 |  | no_results |
| t4-gem-wind-L100000900849 | 台電離岸風場 |  | no_results |
| t4-gem-wind-L100000901006 | 渚峰離岸風場 |  | no_results |
| t4-gem-wind-L100000901044 | 彰旺風場 |  | no_results |
| t4-gem-wind-L100000901058 | 新豐風場 |  | no_results |
| t4-gem-wind-L100000901062 | 觀音風場 |  | no_results |
| t4-gem-wind-L100000901063 | 麗威風場 |  | no_results |
| t4-gem-wind-L100000901066 | 同元風場 |  | no_results |
| t4-gem-wind-L100000901070 | 中能離岸風場 |  | no_results |
| t4-gem-wind-L100000901074 | 大潭風場 |  | no_results |
| t4-gem-wind-L100000901076 | 星元風場 |  | no_results |
| t4-gem-wind-L100000901077 | 四湖風場 |  | no_results |
| t4-gem-wind-L100000916902 | 渚汀浮動式離岸風場 |  | no_results |
| t4-gem-wind-L100000916903 | 創威風場 |  | no_results |
| t4-gem-wind-L100000916905 | 達天友德離岸風場 |  | no_results |
| t4-gem-wind-L100000916912 | 海能風電 Formosa 2 |  | no_results |
| t4-gem-wind-L100000916913 | 海能風電 Formosa 3 |  | no_results |
| t4-gem-wind-L100000916914 | 海能風電 Formosa 4 |  | no_results |
| t4-gem-wind-L100000916915 | 海能風電 Formosa 5 |  | no_results |
| t4-gem-wind-L100000916919 | 觀園風場 |  | no_results |
| t4-gem-wind-L100000916926 | 新元風場 |  | no_results |
| t4-gem-wind-L100000916935 | 雷峰離岸風場 |  | no_results |
| t4-gem-wind-L100000916942 | 九月風浮動式風場 |  | no_results |
| t4-gem-wind-L100000916943 | 沃能離岸風場 |  | no_results |
| t4-gem-wind-L100000916944 | 新峰離岸風場 |  | no_results |
| t4-gem-wind-L100000916945 | 旭風一號離岸風場 |  | no_results |
| t4-gem-wind-L100000916951 | 彰豐離岸風場 |  | no_results |
| t4-gem-wind-L100000922279 | 竹町離岸風場 |  | no_results |
| t4-gem-wind-L100000922281 | 王功風場 |  | no_results |
| t4-gem-wind-L100000922285 | 安威大甲風場 |  | no_results |
| t4-gem-wind-L100000922286 | 北苑風場 |  | no_results |
| t4-gem-wind-L100000922290 | 口湖風場 |  | no_results |
| t4-gem-wind-L100000922291 | 禾原風場 |  | no_results |
| t4-gem-wind-L100000922295 | 富翰風場 |  | no_results |
| t4-gem-wind-L100001018861 | 海光離岸風場 Formosa 6 |  | no_results |
| t4-gem-wind-L100001018898 | 寒星風場 |  | no_results |
| t4-gem-wind-L100001047790 | 銳力 1 浮動式離岸風場 |  | no_results |
| t4-gem-wind-L100001047791 | 皇鵬離岸風場 |  | no_results |
| t4-gem-wind-L100001061833 | 第三階段第三期離岸風電競標 |  | no_results |
| t4-gem-中嘉電廠 | 中嘉電廠 |  | no_results |
| t4-gem-中鋼電廠 | 中鋼電廠 |  | no_results |
| t4-gem-久堂廠汽電 | 久堂廠汽電 |  | no_results |
| t4-gem-健山電廠 | 健山電廠 |  | no_results |
| t4-gem-台塑石化第四汽電 | 台塑石化第四汽電共生廠 |  | no_results |
| t4-gem-后里廠汽電 | 后里廠汽電 |  | no_results |
| t4-gem-和平電廠 | 和平電廠 |  | no_results |
| t4-gem-嘉惠三號 | 嘉惠三號電廠 |  | no_results |
| t4-gem-嘉義廠汽電 | 嘉義廠汽電 |  | no_results |
| t4-gem-大發廠汽電 | 大發廠汽電 |  | no_results |
| t4-gem-奇美電廠 | 奇美電廠 |  | no_results |
| t4-gem-官田廠汽電 | 官田廠汽電 |  | no_results |
| t4-gem-新宇煤汽電 | 新宇汽電共生 |  | no_results |
| t4-gem-林園廠汽電 | 林園廠汽電 |  | no_results |
| t4-gem-碧海水力 | 碧海水力電廠 |  | no_results |
| t4-gem-金山電廠 | 金信電廠 |  | no_results |
| t4-gem-龍德電廠 | 龍德電廠 |  | no_results |
