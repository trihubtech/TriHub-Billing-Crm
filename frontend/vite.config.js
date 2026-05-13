import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/billing/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "TriHub Billing",
        short_name: "TriHub",

        theme_color: "#0d6efd",
        background_color: "#0f172a",

        display: "standalone",

        start_url: "/billing/",

        icons: [
          {
            src: "/billing/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/billing/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/(customers|products|vendors)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],

  server: {
    port: 5173,

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});