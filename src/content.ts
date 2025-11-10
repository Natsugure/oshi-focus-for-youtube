// src/content.ts
import { getSettings, getChannelIdFromPage, isAllowedChannel } from './utils/storage';

let settings: any = null;

// 設定を読み込み
async function loadSettings() {
  settings = await getSettings();
}

// 初期化
loadSettings();

// 設定の変更を監視
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = changes.settings.newValue;
    applyRestrictions();
  }
});

// ショート動画を通常動画として開く
function convertShortsToRegular() {
  if (window.location.pathname.startsWith('/shorts/')) {
    const videoId = window.location.pathname.split('/shorts/')[1].split('?')[0];
    window.location.href = `https://www.youtube.com/watch?v=${videoId}`;
  }
}

// メニュー項目を非表示にする
function hideMenuItems() {
  const selectors = [
    // ホーム
    'a[href="/"]',
    'a[title="ホーム"]',
    'a[title="Home"]',
    'ytd-guide-entry-renderer:has(a[href="/"])',
    
    // ショート
    'a[href="/shorts"]',
    'a[title="ショート"]',
    'a[title="Shorts"]',
    'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
    
    // 探索
    'a[href="/explore"]',
    'a[title="探索"]',
    'a[title="Explore"]',
    'ytd-guide-entry-renderer:has(a[href="/explore"])',
    
    // 追加で非表示にしたい項目
    '#chips', // チップス（カテゴリ）
    'ytd-rich-shelf-renderer' // おすすめのシェルフ
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  });
}

// リコメンド欄を非表示にする
function hideRecommendations() {
  const selectors = [
    '#related', // 関連動画
    '#secondary', // サイドバー全体
    'ytd-watch-next-secondary-results-renderer',
    'ytd-compact-video-renderer', // コンパクト動画レンダラー
    '#items.ytd-watch-next-secondary-results-renderer'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  });
}

// 登録チャンネルページで許可されていないチャンネルを非表示
function filterSubscriptionChannels() {
  if (!settings || settings.allowedChannels.length === 0) return;
  
  // 登録チャンネルページかチェック
  if (!window.location.pathname.includes('/feed/subscriptions')) return;
  
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  
  videoElements.forEach(async (videoEl) => {
    // チャンネル名やリンクからチャンネルIDを取得
    const channelLink = videoEl.querySelector('a.yt-simple-endpoint[href*="/channel/"], a.yt-simple-endpoint[href*="/@"]') as HTMLAnchorElement;
    
    if (channelLink) {
      const href = channelLink.href;
      let channelId = '';
      
      // チャンネルIDを抽出
      const channelMatch = href.match(/\/channel\/(UC[\w-]+)/);
      if (channelMatch) {
        channelId = channelMatch[1];
      } else {
        // @ハンドルの場合、チャンネルIDの取得は困難
        // とりあえずハンドル名を使用
        const handleMatch = href.match(/\/@([\w-]+)/);
        if (handleMatch) {
          channelId = handleMatch[1];
        }
      }
      
      // 許可されていない場合は非表示
      if (channelId && !isAllowedChannel(channelId, settings)) {
        (videoEl as HTMLElement).style.display = 'none';
      }
    }
  });
}

// 動画再生ページで許可されていないチャンネルをブロック
async function blockUnallowedVideo() {
  if (!settings || settings.allowedChannels.length === 0) return;
  
  // 動画ページかチェック
  if (!window.location.pathname.includes('/watch')) return;
  
  // チャンネルIDを取得
  const channelId = getChannelIdFromPage();
  
  if (channelId && !isAllowedChannel(channelId, settings)) {
    // 動画をブロック
    const videoContainer = document.querySelector('#player');
    if (videoContainer) {
      videoContainer.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background-color: #0f0f0f;
          color: white;
          font-size: 24px;
          text-align: center;
          padding: 40px;
        ">
          <div>
            <h2>この動画は制限されています</h2>
            <p style="font-size: 16px; margin-top: 20px;">
              許可されたチャンネルの動画のみ視聴できます。<br>
              設定を変更するには、拡張機能のオプションページを開いてください。
            </p>
          </div>
        </div>
      `;
    }
    
    // タイトルなども非表示
    const title = document.querySelector('h1.ytd-watch-metadata');
    if (title) {
      (title as HTMLElement).textContent = '制限されたコンテンツ';
    }
  }
}

// すべての制限を適用
function applyRestrictions() {
  hideMenuItems();
  hideRecommendations();
  filterSubscriptionChannels();
  blockUnallowedVideo();
  convertShortsToRegular();
}

// DOMの変更を監視
const observer = new MutationObserver(() => {
  applyRestrictions();
});

// ページ読み込み時
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  applyRestrictions();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    applyRestrictions();
  });
}

// URLの変更を監視（SPA対応）
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      applyRestrictions();
    }, 500);
  }
}).observe(document, { subtree: true, childList: true });

// 初回実行
applyRestrictions();
