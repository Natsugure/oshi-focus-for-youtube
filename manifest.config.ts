import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Oshi Focus For YouTube',
  version: '1.0.0',
  description: '特定のチャンネルに集中できるYouTube拡張機能',

  permissions: [
    'storage',
    'activeTab'
  ],

  host_permissions: [
    'https://www.youtube.com/*'
  ],

  action: {
    default_popup: 'index.html',
    default_icon: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png'
    }
  },

  options_ui: {
    page: 'options.html',
    open_in_tab: true
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },

  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['src/content/index.tsx'],
      run_at: 'document_start'
    }
  ],

  icons: {
    '16': 'icon16.png',
    '48': 'icon48.png',
    '128': 'icon128.png'
  }
})