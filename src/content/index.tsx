import { isChannelAllowed, getStorageData, Settings, defaultSettings } from '../utils/storage';
import { extractVideoId, convertShortsToWatch, getChannelIdFromPage, getChannelHandleFromPage, getChannelInfoFromChannelPage } from '../utils/youtube';
import { blockManager } from './blocker';
import { subscriptionFilterManager } from './subscriptionFilter';
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
  if (areaName === 'sync') {
    if (changes.settings) {
      currentSettings = { ...defaultSettings, ...changes.settings.newValue };
      // CSSを再注入
      const existingStyle = document.getElementById('oshi-focus-styles');
      if (existingStyle) {
        existingStyle.textContent = generateStyles(currentSettings);
      }
    }
    // 設定または許可チャンネルが変更された場合、フィルタリングを再実行
    if (changes.settings || changes.allowedChannels) {
      subscriptionFilterManager.startFiltering();
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
      /* 登録チャンネルセクション全体（collapsible-section-entry-rendererと個別チャンネルを含む） */
      ytd-guide-section-renderer:has(ytd-guide-collapsible-section-entry-renderer) { display: none !important; }
      /* ミニサイドバーの登録チャンネル */
      ytd-mini-guide-entry-renderer:has(a[href="/feed/subscriptions"]) { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideExploreSection) {
    css += `
      /* 探索セクション全体を非表示（タイトルが表示されているセクション） */
      /* ただし、外部リンク（YouTubeの他のサービス）を含むアイテムは除外 */
      ytd-guide-section-renderer:has(h3:not([hidden]) #guide-section-title):not(:has(a[href*="music.youtube.com"])):not(:has(a[href*="tv.youtube.com"])):not(:has(a[href*="studio.youtube.com"])) { display: none !important; }
      /* 探索セクション内の個別項目（トレンド、音楽、ゲームなど）で外部リンクでないものを非表示 */
      ytd-guide-section-renderer:has(h3:not([hidden]) #guide-section-title) ytd-guide-entry-renderer:has(a[href^="/feed/"]):not(:has(a[href="/feed/subscriptions"])):not(:has(a[href="/feed/you"])) { display: none !important; }
      ytd-guide-section-renderer:has(h3:not([hidden]) #guide-section-title) ytd-guide-entry-renderer:has(a[href^="/channel/"]) { display: none !important; }
      /* 探索セクションのタイトルを非表示（項目が全て非表示の場合のため） */
      ytd-guide-section-renderer:has(h3:not([hidden]) #guide-section-title) h3 { display: none !important; }
    `;
  }

  if (settings.sideMenu.hideOtherYouTubeServices) {
    css += `
      /* YouTubeの他のサービスを非表示（YouTube Music、YouTube TVなど） */
      /* 外部リンクや特定のサービスへのリンクを対象 */
      ytd-guide-entry-renderer:has(a[href*="music.youtube.com"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[href*="tv.youtube.com"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[href*="studio.youtube.com"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[href*="youtubei.googleapis.com"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[href*="youtubekids.com"]) { display: none !important; }
      /* タイトルベースでも非表示（多言語対応） */
      ytd-guide-entry-renderer:has(a[title*="Music"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[title*="TV"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[title*="Studio"]) { display: none !important; }
      ytd-guide-entry-renderer:has(a[title*="Kids"]) { display: none !important; }
      /* YouTubeの他のサービスセクションのヘッダーを非表示 */
      /* このセクションは外部リンクを含むセクション */
      ytd-guide-section-renderer:has(a[href*="music.youtube.com"]) h3,
      ytd-guide-section-renderer:has(a[href*="tv.youtube.com"]) h3,
      ytd-guide-section-renderer:has(a[href*="studio.youtube.com"]) h3,
      ytd-guide-section-renderer:has(a[href*="youtubekids.com"]) h3 { display: none !important; }
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

// 動画ページのチェック
const checkVideoPage = async () => {
  const initialUrl = window.location.href;
  const videoId = extractVideoId(initialUrl);
  if (!videoId) return;

  // チャンネル情報を取得するまで待機
  let attempts = 0;
  const maxAttempts = 20;

  const checkChannel = async (): Promise<void> => {
    // URLが変わった場合は処理を中断
    if (window.location.href !== initialUrl) {
      return;
    }

    const channelId = getChannelIdFromPage();
    const channelHandle = getChannelHandleFromPage();

    // チャンネル情報（IDまたはハンドル）が取得できた場合、許可チェック
    if (channelId || channelHandle) {
      // 再度URLを確認（非同期処理中に変わっている可能性）
      if (window.location.href !== initialUrl) {
        return;
      }

      const allowed = await isChannelAllowed(channelId || '', channelHandle);

      // 許可チェック後もURLを確認
      if (window.location.href !== initialUrl) {
        return;
      }

      if (!allowed) {
        blockManager.showBlockMessage('unauthorized-channel');
      }
      return;
    }

    // チャンネル情報が取得できない場合はリトライ
    if (attempts < maxAttempts) {
      attempts++;
      return new Promise((resolve) => {
        setTimeout(async () => {
          await checkChannel();
          resolve();
        }, 500);
      });
    }

    // 最大リトライ回数に達してもチャンネル情報が取得できない場合
  };

  await checkChannel();
};


// ショート動画の処理
const handleShorts = async () => {
  const initialUrl = window.location.href;
  if (!initialUrl.includes('/shorts/')) {
    return;
  }

  // チャンネル情報を取得するまで待機
  let attempts = 0;
  const maxAttempts = 20;

  const checkAndHandle = async (): Promise<void> => {
    // URLが変わった場合は処理を中断
    if (window.location.href !== initialUrl) {
      return;
    }

    const channelId = getChannelIdFromPage();
    const channelHandle = getChannelHandleFromPage();

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
      // URLを再確認
      if (window.location.href !== initialUrl) {
        return;
      }

      const allowed = await isChannelAllowed(channelId || '', channelHandle);

      // 許可チェック後もURLを確認
      if (window.location.href !== initialUrl) {
        return;
      }

      if (allowed) {
        // 許可チャンネルの場合は通常動画形式にリダイレクト
        const newUrl = convertShortsToWatch(window.location.href);
        if (newUrl !== window.location.href) {
          window.location.replace(newUrl);
        }
        return;
      }
      // 許可されていないチャンネルの場合はブロック
      blockManager.showBlockMessage('unauthorized-channel');
      return;
    }

    // 最大リトライ回数に達してもチャンネル情報が取得できない場合
    // URLを再確認
    if (window.location.href !== initialUrl) {
      return;
    }

    // 完全ブロックが有効な場合はブロックメッセージを表示
    if (currentSettings.blockShortsCompletely) {
      blockManager.showBlockMessage('shorts-blocked');
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
    await subscriptionFilterManager.startFiltering();
  } catch (error) {
    console.error('Oshi Focus: Error in subscriptionFilterManager:', error);
  }

  // 動画ページの場合はチェック
  if (window.location.pathname === '/watch') {
    await checkVideoPage();
  }
};

// URLの変更を監視
const setupUrlObserver = () => {
  let lastUrl = window.location.href;
  let navigationTimeout: ReturnType<typeof setTimeout> | null = null;

  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;

    // URLが変更された場合（パスまたはクエリパラメータ）
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      // URL変更時は常にブロックオーバーレイを削除
      blockManager.removeBlockOverlay();

      // 前回のタイマーをクリア
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }

      // ホームから登録チャンネルへのリダイレクト（即座に実行）
      handleHomeRedirect();

      // ページ遷移後、DOMが更新されるまで待機してからチェック
      navigationTimeout = setTimeout(() => {
        // ショート動画の処理
        if (window.location.pathname.startsWith('/shorts/')) {
          handleShorts();
        }

        // 動画ページの場合はチェック
        if (window.location.pathname === '/watch') {
          checkVideoPage();
        }
      }, 1000); // 1000msの遅延を追加
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
    const info = getChannelInfoFromChannelPage();
    return { id: info.handle, name: info.name };
  }

  // 動画ページの場合
  if (window.location.pathname === '/watch') {
    // @handle形式を優先、なければchannelIdを使用
    const channelHandle = getChannelHandleFromPage();
    const channelId = channelHandle || getChannelIdFromPage();

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
