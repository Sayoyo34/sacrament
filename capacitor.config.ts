import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // App Store Connect に一度アップロードすると変えられない。決まったらここと Xcode の Bundle Identifier を揃える
  appId: 'com.ofusetecho.app',
  appName: 'おふせ手帖',
  webDir: 'dist',
  ios: {
    // セーフエリアはCSS（env(safe-area-inset-*)）で取るので、WebView側では余白を足さない
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
  plugins: {
    StatusBar: {
      // 白背景なので文字は黒
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
}

export default config
