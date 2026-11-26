import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.co.meenaagencies.pharmasys",
  appName: "PharmaSys Mobile",
  webDir: "dist",
  server: {
    hostname: "mobile.meenaagencies.co.in",
    androidScheme: "https",
  },
};

export default config;
