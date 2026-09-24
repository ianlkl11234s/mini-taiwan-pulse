import config from "__MINI_ROOT__/vite.config.ts";
process.env.PULSE_RESEARCH_GATEWAY_ORIGIN ??= "http://127.0.0.1:8794";
process.env.PULSE_RESEARCH_ANALYTICS_ROOT ??= "__ANALYTICS_ROOT__";
export default {...config, root:"__MINI_ROOT__", envDir:"__WORKSPACE_ROOT__", publicDir:"__WORKSPACE_ROOT__/public", cacheDir:"__RUNTIME_ROOT__/vite-cache"};
