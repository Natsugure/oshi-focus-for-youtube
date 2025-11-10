// src/background.ts
import { getSettings, extractChannelId, isAllowedChannel } from './utils/storage';

// 拡張機能のインストール時
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Focus Extension installed');
});

// タブの更新を監視
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // メインフレームのみ処理
  if (details.frameId !== 0) return;
  
  const url = details.url;
  
  // YouTubeのURLかチェック
  if (!url.includes('youtube.com')) return;
  
  // 動画ページかチェック
  if (url.includes('/watch')) {
    // 設定を取得
    const settings = await getSettings();
    
    // 許可チャンネルが設定されている場合のみチェック
    if (settings.allowedChannels.length > 0) {
      // チャンネルIDをURLから抽出できない場合は、
      // content scriptで判定させる
      console.log('Video page detected, will check in content script');
    }
  }
}, {
  url: [{ hostSuffix: 'youtube.com' }]
});

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_CHANNEL') {
    getSettings().then(settings => {
      const allowed = isAllowedChannel(message.channelId, settings);
      sendResponse({ allowed });
    });
    return true; // 非同期レスポンスを示す
  }
  
  if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => {
      sendResponse(settings);
    });
    return true;
  }
});
