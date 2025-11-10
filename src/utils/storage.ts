// src/utils/storage.ts
export interface ExtensionSettings {
  allowedChannels: string[]; // チャンネルID（例: UC1234567890）
}

export const defaultSettings: ExtensionSettings = {
  allowedChannels: []
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || defaultSettings;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}

export function isAllowedChannel(channelId: string, settings: ExtensionSettings): boolean {
  if (settings.allowedChannels.length === 0) {
    return true; // 設定がない場合は全て許可
  }
  return settings.allowedChannels.includes(channelId);
}

// チャンネルIDを抽出する関数
export function extractChannelId(url: string): string | null {
  // URLからチャンネルIDを抽出
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// 動画URLからチャンネルIDを取得（ページ内のDOM要素から）
export function getChannelIdFromPage(): string | null {
  // チャンネルリンクを探す
  const channelLink = document.querySelector('a.yt-simple-endpoint.style-scope.yt-formatted-string[href*="/channel/"]') as HTMLAnchorElement;
  if (channelLink) {
    const match = channelLink.href.match(/\/channel\/(UC[\w-]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // メタタグから取得を試みる
  const channelIdMeta = document.querySelector('meta[itemprop="channelId"]') as HTMLMetaElement;
  if (channelIdMeta) {
    return channelIdMeta.content;
  }
  
  // ytInitialDataから取得を試みる
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    if (content.includes('ytInitialData')) {
      const match = content.match(/"channelId":"(UC[\w-]+)"/);
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}
