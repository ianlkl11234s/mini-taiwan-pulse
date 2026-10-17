/// <reference types="vite/client" />

/** package.json 的 version，由 vite.config.ts define 注入（見 docs/RELEASING.md）。 */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WASTE_MATCHED_TRAILS?: string;
  readonly VITE_IMAGERY_CDN_BASE?: string;
  readonly VITE_STATISTICS_CDN_BASE?: string;
  /** 本機測試身分（僅 DEV 生效）；需搭配 loopback gateway 的 PULSE_RESEARCH_TEST_IDENTITY=1 */
  readonly VITE_RESEARCH_TEST_IDENTITY?: string;
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
