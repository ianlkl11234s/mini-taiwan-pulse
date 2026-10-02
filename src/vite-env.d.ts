/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WASTE_MATCHED_TRAILS?: string;
  readonly VITE_IMAGERY_CDN_BASE?: string;
  readonly VITE_STATISTICS_CDN_BASE?: string;
  /** 本機免授權配對（僅 DEV 生效）；需搭配 gateway／MCP 的 PULSE_RESEARCH_DEV_AUTOPAIR=1 */
  readonly VITE_RESEARCH_DEV_AUTOPAIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vert" {
  const value: string;
  export default value;
}

declare module "*.frag" {
  const value: string;
  export default value;
}
