module.exports = {
  expo: {
    name: "Saarang Practice Hub",
    slug: "saarang-practice-hub",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      backgroundColor: "#0d0d0d",
      resizeMode: "contain"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "org.saarang.practicehub"
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#0d0d0d"
      },
      package: "org.saarang.practicehub"
    },
    web: {
      bundler: "metro"
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#e8c872",
          sounds: []
        }
      ]
    ],
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8001"
    }
  }
};
