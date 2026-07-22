import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    var apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080";
    return {
        plugins: [react()],
        server: {
            proxy: {
                "/api": {
                    target: apiProxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
