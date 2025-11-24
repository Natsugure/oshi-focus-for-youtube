import { isChannelAllowed, getStorageData, Settings, defaultSettings } from '../utils/storage';
import { extractVideoId, convertShortsToWatch, getChannelIdFromPage, getChannelHandleFromPage } from '../utils/youtube';
import './style.css';

// 現在の設定をキャッシュ
let currentSettings: Settings = defaultSettings;

// CSSを確実に適用するための関数
const injectStyles = async () => {
  const data = await getStorageData();
  currentSettings = data.settings;

  // 既存のスタイルを削除
  const existingStyle = document.getElementById('oshi-focus-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'oshi-focus-styles';
  style.textContent = generateStyles(currentSettings);
  document.head.appendChild(style);
};

// 設定変更を監視
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    currentSettings = { ...defaultSettings, ...changes.settings.newValue };
    // CSSを再注入
    const existingStyle = document.getElementById('oshi-focus-styles');
    if (existingStyle) {
      existingStyle.textContent = generateStyles(currentSettings);
    }
  }
});

// 設定に基づいてCSSを生成
const generateStyles = (settings: Settings): string => {
  let css = '';

  // サイドメニューの非表示設定
  if (settings.sideMenu.hideHome) {
    css += `
      ytd-guide-entry-renderer a[href="/"] { pointer-events: none; }
      ytd-guide-entry-renderer:has(a[href="/"]) { display: none !important; }
      ytd-mini-guide-entry-renderer:has(a[href="/"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideShorts) {
    css += `
      ytd-guide-entry-renderer:has(a[title="ショート"]),
      ytd-guide-entry-renderer:has(a[title="Shorts"]) { display: none !important; }
      ytd-mini-guide-entry-renderer:has(a[href="/shorts/"]),
      ytd-mini-guide-entry-renderer:has(a[aria-label="ショート"]),
      ytd-mini-guide-entry-renderer:has(a[aria-label="Shorts"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideSubscriptions) {
    css += `
      /* 登録チャンネルボタン（メインメニュー内） */
      ytd-guide-entry-renderer:has(a[href="/feed/subscriptions"]) { display: none !important; }
      /* 登録チャンネルセクション（チャンネルリストを含む折りたたみ式セクション） */
      ytd-guide-section-renderer:has(ytd-guide-collapsible-entry-renderer) { display: none !important; }
      /* ミニサイドバーの登録チャンネル */
      ytd-mini-guide-entry-renderer:has(a[href="/feed/subscriptions"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideExploreSection) {
    css += `
      /* 探索セクション全体を非表示（タイトルが表示されているセクション） */
      ytd-guide-section-renderer:has(h3:not([hidden]) #guide-section-title) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideMusic) {
    css += `
      ytd-guide-entry-renderer:has(a[href*="music.youtube.com"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[title="YouTube Music"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideYouSection) {
    css += `
      /* マイページセクション全体（履歴、再生リスト、後で見る等を含む） */
      ytd-guide-collapsible-section-entry-renderer:has(a[href="/feed/you"]) { display: none !important; }
      /* ミニサイドバーのマイページ */
      ytd-mini-guide-entry-renderer:has(a[href="/feed/you"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideRecommendations) {
    css += `
      #related, #secondary { display: none !important; }
      #primary { max-width: 100% !important; }
    `;
  }

  // ブロックメッセージのスタイル（常に必要）
  css += `
    .oshi-focus-blocked {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0f0f0f;
      color: #fff;
      font-family: "Roboto", "Arial", sans-serif;
      text-align: center;
      padding: 20px;
      z-index: 9999;
      box-sizing: border-box;
    }
    .oshi-focus-blocked h1 {
      font-size: 32px;
      margin-bottom: 16px;
      color: #ff0000;
    }
    .oshi-focus-blocked p {
      font-size: 18px;
      margin-bottom: 24px;
      color: #aaa;
    }
    .oshi-focus-blocked button {
      background: #ff0000;
      color: #fff;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .oshi-focus-blocked button:hover {
      background: #cc0000;
    }
  `;

  return css;
};

// ページがブロックされているかどうかのフラグ
let isPageBlocked = false;

// メディアキー・スペースキーのイベントハンドラ
const blockMediaKeyHandler = (e: KeyboardEvent) => {
  // スペースキー、メディアキー、矢印キーなどをブロック
  const blockedKeys = [
    ' ', 'Space',           // スペースキー（再生/一時停止）
    'k', 'K',               // YouTubeの再生/一時停止ショートカット
    'j', 'J', 'l', 'L',     // YouTubeの巻き戻し/早送り
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'm', 'M',               // ミュート
    'MediaPlayPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious'
  ];

  if (blockedKeys.includes(e.key) || blockedKeys.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
};

// 動画再生イベントを監視して強制停止するためのリスナー
const blockVideoPlayHandler = (e: Event) => {
  const video = e.target as HTMLVideoElement;
  video.pause();
};

// ブロックオーバーレイを削除
const removeBlockedOverlay = () => {
  const overlay = document.getElementById('oshi-focus-blocked-overlay');
  if (overlay) {
    overlay.remove();
    isPageBlocked = false;
    // キーボードイベントのブロックを解除
    document.removeEventListener('keydown', blockMediaKeyHandler, true);
    // 動画再生イベントのブロックを解除
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      video.removeEventListener('play', blockVideoPlayHandler, true);
    });
  }
};

// 動画を強制停止し、キーボード操作をブロック
const pauseAllVideos = () => {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.pause();
    // 再生が開始されたら即座に停止するリスナーを追加
    video.addEventListener('play', blockVideoPlayHandler, true);
  });
  // キーボードイベントをブロック（captureフェーズで捕捉）
  document.addEventListener('keydown', blockMediaKeyHandler, true);
};

// ブロックメッセージを表示（オーバーレイ形式）
const showBlockedMessage = () => {
  if (isPageBlocked) return;

  isPageBlocked = true;

  // 既存のオーバーレイがあれば削除
  removeBlockedOverlay();

  // 動画を停止
  pauseAllVideos();

  const overlay = document.createElement('div');
  overlay.id = 'oshi-focus-blocked-overlay';
  overlay.className = 'oshi-focus-blocked';
  overlay.innerHTML = `
    <h1>🚫 このコンテンツは表示できません</h1>
    <p>許可されたチャンネルの動画のみ視聴できます</p>
    <button id="oshi-focus-settings">設定を開く</button>
  `;

  document.body.appendChild(overlay);

  document.getElementById('oshi-focus-settings')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
};

// 動画ページのチェック
const checkVideoPage = async () => {
  const videoId = extractVideoId(window.location.href);
  if (!videoId) return;

  // チャンネルIDを取得するまで待機
  let attempts = 0;
  const maxAttempts = 20;

  const checkChannel = async () => {
    const channelId = getChannelIdFromPage();
    const channelHandle = getChannelHandleFromPage();

    if (channelId) {
      const allowed = await isChannelAllowed(channelId, channelHandle);
      if (!allowed) {
        showBlockedMessage();
      }
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(checkChannel, 500);
    }
  };

  await checkChannel();
};

// 登録チャンネルのフィルタリング
const filterSubscriptions = async () => {
  const data = await getStorageData();
  const allowedChannelIds = data.allowedChannels.map(ch => ch.id);

  // 許可リストが空の場合は何もしない（すべて表示）
  if (allowedChannelIds.length === 0) {
    return;
  }

  const TARGET_VISIBLE_COUNT = 7;

  let isApplyingFilter = false; // 再帰的な呼び出しを防ぐフラグ

  // チャンネルをフィルタリングし、表示チャンネルを繰り上げる関数
  const applyFilter = () => {
    // 既に実行中の場合はスキップ
    if (isApplyingFilter) return;
    isApplyingFilter = true;

    try {
      const subscriptionsSection = document.querySelector('ytd-guide-collapsible-entry-renderer');
      if (!subscriptionsSection) {
        return;
      }

      const expandableItems = subscriptionsSection.querySelector('#expandable-items');
      if (!expandableItems) {
        return;
      }

      const expanderItem = subscriptionsSection.querySelector('#expander-item');
      if (!expanderItem) {
        return;
      }

      // すべてのチャンネルを取得
      const allChannelItems = subscriptionsSection.querySelectorAll('ytd-guide-entry-renderer');

      // 許可チャンネルのみを抽出（非表示のものも含む）
      const allowedChannels: HTMLElement[] = [];
      const disallowedChannels: HTMLElement[] = [];

      allChannelItems.forEach((item) => {
        const link = item.querySelector('a');
        if (!link) {
          return;
        }

        const href = link.getAttribute('href') || '';

        // チャンネルリンクかチェック
        if (href.includes('/@') || href.includes('/channel/')) {
          const channelHandle = href.split('/@')[1]?.split('/')[0] ||
                               href.split('/channel/')[1]?.split('/')[0];

          if (channelHandle) {
            const htmlItem = item as HTMLElement;
            if (allowedChannelIds.includes(channelHandle)) {
              allowedChannels.push(htmlItem);
              // 表示
              htmlItem.style.display = '';
            } else {
              disallowedChannels.push(htmlItem);
              // 非表示
              htmlItem.style.display = 'none';
            }
          }
        }
      });

      // 許可チャンネルの最初のTARGET_VISIBLE_COUNT個をexpanderItemの前に移動
      const channelsToPromote = allowedChannels.slice(0, TARGET_VISIBLE_COUNT);

      // 次に、最初のTARGET_VISIBLE_COUNT個をexpanderItemの前に移動
      channelsToPromote.forEach((channel) => {
        // expanderItemの前に移動（すでにそこにあっても問題ない）
        subscriptionsSection.insertBefore(channel, expanderItem);
      });
    } finally {
      isApplyingFilter = false;
    }
  };

  // 初回実行
  applyFilter();

  // MutationObserverで動的に追加される要素も監視
  const observer = new MutationObserver(() => {
    applyFilter();
  });

  // document.bodyが存在する場合のみobserveを開始
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// ショート動画のブロックメッセージを表示（オーバーレイ形式）
const showShortsBlockedMessage = () => {
  if (isPageBlocked) return;

  isPageBlocked = true;

  // 既存のオーバーレイがあれば削除
  removeBlockedOverlay();

  // 動画を停止
  pauseAllVideos();

  const overlay = document.createElement('div');
  overlay.id = 'oshi-focus-blocked-overlay';
  overlay.className = 'oshi-focus-blocked';
  overlay.innerHTML = `
    <h1>🚫 ショート動画はブロックされています</h1>
    <p>ショート動画の再生は設定で無効にされています</p>
    <button id="oshi-focus-settings">設定を開く</button>
  `;

  document.body.appendChild(overlay);

  document.getElementById('oshi-focus-settings')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
};

// ショート動画の処理
const handleShorts = async () => {
  if (!window.location.href.includes('/shorts/')) {
    return;
  }

  console.log('[Oshi Focus] handleShorts: started at', Date.now());

  // チャンネル情報を取得するまで待機
  let attempts = 0;
  const maxAttempts = 20;
  const startTime = Date.now();

  const checkAndHandle = async (): Promise<void> => {
    const channelId = getChannelIdFromPage();
    const channelHandle = getChannelHandleFromPage();

    console.log('[Oshi Focus] handleShorts attempt', attempts, '- channelId:', channelId, 'channelHandle:', channelHandle, 'elapsed:', Date.now() - startTime, 'ms');

    // チャンネル情報（IDまたはハンドル）が取得できない場合はリトライ
    if (!channelId && !channelHandle && attempts < maxAttempts) {
      attempts++;
      return new Promise((resolve) => {
        setTimeout(async () => {
          await checkAndHandle();
          resolve();
        }, 100);
      });
    }

    // チャンネル情報が取得できた場合、許可チェック
    if (channelId || channelHandle) {
      const allowed = await isChannelAllowed(channelId || '', channelHandle);
      console.log('[Oshi Focus] Channel allowed:', allowed);
      if (allowed) {
        // 許可チャンネルの場合は通常動画形式にリダイレクト
        const newUrl = convertShortsToWatch(window.location.href);
        if (newUrl !== window.location.href) {
          console.log('[Oshi Focus] Redirecting to:', newUrl);
          window.location.replace(newUrl);
        }
        return;
      }
      // 許可されていないチャンネルの場合はブロック
      showBlockedMessage();
      return;
    }

    // 最大リトライ回数に達してもチャンネル情報が取得できない場合
    console.log('[Oshi Focus] Max attempts reached, applying fallback behavior');
    // 完全ブロックが有効な場合はブロックメッセージを表示
    if (currentSettings.blockShortsCompletely) {
      showShortsBlockedMessage();
      return;
    }

    // 通常動画への変換が有効な場合はリダイレクト
    if (currentSettings.convertShortsToNormal) {
      const newUrl = convertShortsToWatch(window.location.href);
      if (newUrl !== window.location.href) {
        window.location.replace(newUrl);
      }
    }
  };

  await checkAndHandle();
};

// ホームから登録チャンネルへのリダイレクト
const handleHomeRedirect = () => {
  // 設定が無効の場合はリダイレクトしない
  if (!currentSettings.redirectHomeToSubscriptions) {
    return;
  }

  // ホームページ（/または/?...）の場合のみリダイレクト
  const pathname = window.location.pathname;
  if (pathname === '/' || pathname === '') {
    window.location.replace('/feed/subscriptions');
  }
};

// 初期化
const init = async () => {
  console.log('Oshi Focus For YouTube: Initialized');

  // CSSスタイルを注入（設定の読み込みも行う）
  await injectStyles();

  // ホームから登録チャンネルへのリダイレクト
  handleHomeRedirect();

  // ショート動画の処理
  if (window.location.pathname.startsWith('/shorts/')) {
    await handleShorts();
  }

  // 登録チャンネルのフィルタリング
  try {
    await filterSubscriptions();
  } catch (error) {
    console.error('Oshi Focus: Error in filterSubscriptions:', error);
  }

  // 動画ページの場合はチェック
  if (window.location.pathname === '/watch') {
    await checkVideoPage();
  }
};

// URLの変更を監視
const setupUrlObserver = () => {
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      // ブロックオーバーレイを削除
      removeBlockedOverlay();

      // ホームから登録チャンネルへのリダイレクト
      handleHomeRedirect();

      // ショート動画の処理
      handleShorts();

      // 動画ページの場合はチェック
      if (window.location.pathname === '/watch') {
        checkVideoPage();
      }
    }
  });

  if (document.body) {
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// 現在のページからチャンネル情報を取得
const getCurrentChannelInfo = (): { id: string | null; name: string | null } => {
  const url = window.location.href;

  // チャンネルページの場合
  if (url.includes('/@') || url.includes('/channel/')) {
    const channelId = url.match(/@([^\/\?]+)/)?.[1] ||
                      url.match(/\/channel\/([^\/\?]+)/)?.[1] || null;
    // チャンネル名を取得
    const channelName = document.querySelector('yt-formatted-string.ytd-channel-name')?.textContent?.trim() ||
                        document.querySelector('#channel-name')?.textContent?.trim() || null;
    return { id: channelId, name: channelName };
  }

  // 動画ページの場合
  if (window.location.pathname === '/watch') {
    const channelId = getChannelIdFromPage();
    // チャンネル名を取得
    const channelName = document.querySelector('#owner #channel-name a')?.textContent?.trim() ||
                        document.querySelector('ytd-channel-name a')?.textContent?.trim() || null;
    return { id: channelId, name: channelName };
  }

  return { id: null, name: null };
};

// ポップアップからのメッセージを処理
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CHANNEL_INFO') {
    const info = getCurrentChannelInfo();
    sendResponse(info);
  }
  return true;
});

// ページロード時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupUrlObserver();
  });
} else {
  init();
  setupUrlObserver();
}
