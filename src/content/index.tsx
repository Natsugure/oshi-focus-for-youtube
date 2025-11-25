import { isChannelAllowed, getStorageData, Settings, defaultSettings } from '../utils/storage';
import { extractVideoId, convertShortsToWatch, getChannelIdFromPage, getChannelHandleFromPage, getChannelInfoFromChannelPage } from '../utils/youtube';
import { blockManager } from './blocker';
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
      filterSubscriptions();
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

// 登録チャンネルのフィルタリング用の状態管理
let subscriptionFilterObserver: MutationObserver | null = null;
let isApplyingSubscriptionFilter = false;
let subscriptionFilterTimeout: ReturnType<typeof setTimeout> | null = null;
let guideObserver: MutationObserver | null = null;

// すべてのチャンネルを表示状態に戻す
const resetSubscriptionFilter = () => {
  // 登録チャンネルセクション全体を取得（ytd-guide-section-rendererで登録チャンネルを含むもの）
  const subscriptionsSections = document.querySelectorAll('ytd-guide-section-renderer');
  subscriptionsSections.forEach((section) => {
    const allChannelItems = section.querySelectorAll('ytd-guide-entry-renderer');
    allChannelItems.forEach((item) => {
      (item as HTMLElement).style.display = '';
    });
  });
};

// サイドバー監視用のObserver
let sidebarObserver: MutationObserver | null = null;

// 登録チャンネルセクションを見つける（登録チャンネルへのリンクを含むセクション）
const findSubscriptionsSection = (): Element | null => {
  // 登録チャンネルヘッダーを含むセクションを探す
  const sections = document.querySelectorAll('ytd-guide-section-renderer');
  for (const section of sections) {
    // 登録チャンネルへのリンク（/feed/channels）を含むセクションを探す
    const channelLink = section.querySelector('a[href="/feed/channels"]');
    if (channelLink) {
      return section;
    }
  }
  return null;
};

// 登録チャンネルのフィルタリング
const filterSubscriptions = async () => {
  const data = await getStorageData();
  const allowedChannelIds = data.allowedChannels.map(ch => ch.id);

  // すべてのObserverを停止するヘルパー関数
  const stopAllObservers = () => {
    if (subscriptionFilterObserver) {
      subscriptionFilterObserver.disconnect();
      subscriptionFilterObserver = null;
    }
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }
    if (guideObserver) {
      guideObserver.disconnect();
      guideObserver = null;
    }
  };

  // フィルタ設定が無効、または許可リストが空の場合はすべて表示に戻す
  if (!data.settings.sideMenu.filterSubscriptionsByAllowedChannels || allowedChannelIds.length === 0) {
    resetSubscriptionFilter();
    stopAllObservers();
    return;
  }

  const TARGET_VISIBLE_COUNT = 7;

  // チャンネルをフィルタリングし、表示チャンネルを繰り上げる関数
  const applyFilter = () => {
    // 既に実行中の場合はスキップ
    if (isApplyingSubscriptionFilter) return;
    isApplyingSubscriptionFilter = true;

    try {
      const subscriptionsSection = findSubscriptionsSection();
      if (!subscriptionsSection) {
        return;
      }

      // #items内の要素を取得
      const itemsContainer = subscriptionsSection.querySelector('#items');
      if (!itemsContainer) {
        return;
      }

      // 「もっと見る」ボタン（ytd-guide-collapsible-entry-renderer）を取得
      const collapsibleEntry = itemsContainer.querySelector('ytd-guide-collapsible-entry-renderer');

      // すべてのチャンネルを取得（#items直下とcollapsible内の両方）
      const allChannelItems = itemsContainer.querySelectorAll('ytd-guide-entry-renderer');

      // 許可チャンネルのみを抽出（非表示のものも含む）
      const allowedChannels: HTMLElement[] = [];

      allChannelItems.forEach((item) => {
        const link = item.querySelector('a');
        if (!link) return;

        const href = link.getAttribute('href') || '';

        // チャンネルリンクかチェック（/@xxxまたは/channel/xxx形式）
        // ただし、特殊なリンク（/feed/channels, もっと見る, 折りたたむ）は除外
        if ((href.includes('/@') || href.includes('/channel/')) && !href.includes('/feed/')) {
          const channelHandle = href.split('/@')[1]?.split('/')[0] ||
                               href.split('/channel/')[1]?.split('/')[0];

          if (channelHandle) {
            const htmlItem = item as HTMLElement;
            // allowedChannelIdsには@なしで保存されているはず
            // ただし念のため、@付きでも@なしでもマッチするようにする
            const handleWithoutAt = channelHandle.startsWith('@') ? channelHandle.substring(1) : channelHandle;
            const isAllowed = allowedChannelIds.some(id => {
              const idWithoutAt = id.startsWith('@') ? id.substring(1) : id;
              return idWithoutAt === handleWithoutAt;
            });

            if (isAllowed) {
              allowedChannels.push(htmlItem);
              htmlItem.style.display = '';
            } else {
              htmlItem.style.display = 'none';
            }
          }
        }
      });

      // 許可チャンネルの最初のTARGET_VISIBLE_COUNT個をcollapsibleEntryの前に移動
      if (collapsibleEntry) {
        const channelsToPromote = allowedChannels.slice(0, TARGET_VISIBLE_COUNT);
        channelsToPromote.forEach((channel) => {
          itemsContainer.insertBefore(channel, collapsibleEntry);
        });
      }
    } finally {
      // 少し遅延してフラグをリセット（DOM変更による再トリガーを防ぐ）
      setTimeout(() => {
        isApplyingSubscriptionFilter = false;
      }, 300);
    }
  };

  // デバウンス付きのフィルタ実行
  const debouncedApplyFilter = () => {
    if (subscriptionFilterTimeout) {
      clearTimeout(subscriptionFilterTimeout);
    }
    subscriptionFilterTimeout = setTimeout(() => {
      applyFilter();
    }, 300);
  };

  // 既存のObserverを停止
  stopAllObservers();

  // サイドバー（ytd-guide-renderer）の開閉を監視する関数
  const setupGuideObserver = () => {
    const guideRenderer = document.querySelector('ytd-app');
    if (!guideRenderer) return;

    guideObserver = new MutationObserver(() => {
      // サイドバーが開かれた時にフィルタを適用
      const guide = document.querySelector('tp-yt-app-drawer[opened]');
      if (guide) {
        // サイドバーが開かれた状態で少し待ってからフィルタを適用
        setTimeout(() => {
          debouncedApplyFilter();
        }, 100);
      }
    });

    guideObserver.observe(guideRenderer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['opened']
    });
  };

  // 登録チャンネルセクションが存在するかチェック
  const subscriptionsSection = findSubscriptionsSection();

  if (subscriptionsSection) {
    // 初回実行
    applyFilter();

    // サイドバーの開閉を監視
    setupGuideObserver();

    // MutationObserverで動的に追加される要素も監視
    const collapsibleEntry = subscriptionsSection.querySelector('ytd-guide-collapsible-entry-renderer');
    if (collapsibleEntry) {
      const expandableItems = collapsibleEntry.querySelector('#expandable-items');
      if (expandableItems) {
        subscriptionFilterObserver = new MutationObserver(() => {
          debouncedApplyFilter();
        });
        subscriptionFilterObserver.observe(expandableItems, {
          childList: true
        });
      }
    }
  } else {
    // サイドバーがまだ存在しない場合、ytd-appを監視してサイドバーが追加されるのを待つ
    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
      sidebarObserver = new MutationObserver(() => {
        const section = findSubscriptionsSection();
        if (section) {
          // サイドバーが見つかったらsidebarObserverを停止
          if (sidebarObserver) {
            sidebarObserver.disconnect();
            sidebarObserver = null;
          }

          // 初回実行
          applyFilter();

          // サイドバーの開閉を監視
          setupGuideObserver();

          // #expandable-itemsのみを監視
          const collapsibleEntry = section.querySelector('ytd-guide-collapsible-entry-renderer');
          if (collapsibleEntry) {
            const expandableItems = collapsibleEntry.querySelector('#expandable-items');
            if (expandableItems) {
              subscriptionFilterObserver = new MutationObserver(() => {
                debouncedApplyFilter();
              });
              subscriptionFilterObserver.observe(expandableItems, {
                childList: true
              });
            }
          }
        }
      });
      sidebarObserver.observe(ytdApp, {
        childList: true,
        subtree: true
      });
    }
  }
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
