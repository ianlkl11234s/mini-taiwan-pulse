import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed TDX road-traffic camera positions; this is separate from police crime-prevention CCTV. */
export const cctvFixedPointAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-tdx-road-cctv-fixed-20260524", label: "TDX 路況攝影機固定站位",
  description: "TDX 國道、省道、市區路況 CCTV 三個端點合併的 6,129 個固定站位 Point。只查站位與道路描述，不讀或保證即時影像 URL 是否可用；與桃園警政 CCTV 4,840 點屬不同來源及用途。",
  sourceUrl: "/geo/cctv.geojson", expectedSha256: "aaa461000f16837a03d81fb67133f6503a7f0bc04cf5c8604f5021e725c145aa",
  expectedSourceRows: 6129, expectedSelectedRows: 6129, fullSource: true, selection: {}, layerRefs: ["cctv"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "CCTVID", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "RoadName", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "RoadDirection", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "交通部 TDX（高公局、公路局及各縣市道路管理機關）",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）",
  precision: "TDX 來源 WGS84 路況攝影機 Point；不是拍攝範圍、路口安全、視線遮蔽或車流統計。",
  coverageDescription: "2026-05-24 固定處理版 6,129 個唯一 CCTVID Point；處理 manifest 2026-07-07 不是當前設備或影像可用性時間。對照的警政 cctv_poi 是不同 4,840 點來源，不能混算。",
  sourceLineage: "TDX /v2/Road/Traffic/CCTV/{Freeway,Highway,City} -> analytics cctv_20260524.geojson -> Mini /geo/cctv.geojson，後兩者 SHA aaa461000f16837a03d81fb67133f6503a7f0bc04cf5c8604f5021e725c145aa 完全相同；reader 不暴露 VideoStreamURL/VideoImageURL。",
});
