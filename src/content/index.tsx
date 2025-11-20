import { isChannelAllowed, getStorageData } from '../utils/storage';
import { extractVideoId, convertShortsToWatch, getChannelIdFromPage } from '../utils/youtube';
import './style.css';

// CSSを確実に適用するための関数
const injectStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    /* メニュー項目を非表示 */
    /* ホームボタンを非表示 (href="/") */
    ytd-guide-entry-renderer a[href="/"] {
      pointer-events: none;
    }
    ytd-guide-entry-renderer:has(a[href="/"]) {
      display: none !important;
    }

    /* ショートボタンを非表示（title属性で判別） */
    ytd-guide-entry-renderer:has(a[title="ショート"]),
    ytd-guide-entry-renderer:has(a[title="Shorts"]) {
      display: none !important;
    }

    /* 登録チャンネルセクション全体を非表示 */
    ytd-guide-section-renderer:has(#sections > ytd-guide-collapsible-entry-renderer) {
      display: none !important;
    }

    /* リコメンド欄を非表示 */
    #related,
    #secondary {
      display: none !important;
    }

    /* プライマリコンテンツの幅を広げる */
    #primary {
      max-width: 100% !important;
    }

    /* ブロックメッセージのスタイル */
    .oshi-focus-blocked {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #0f0f0f;
      color: #fff;
      font-family: "Roboto", "Arial", sans-serif;
      text-align: center;
      padding: 20px;
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
  document.head.appendChild(style);
};

// ページがブロックされているかどうかのフラグ
let isPageBlocked = false;

// ブロックメッセージを表示
const showBlockedMessage = () => {
  if (isPageBlocked) return;
  
  isPageBlocked = true;
  document.body.innerHTML = `
    <div class="oshi-focus-blocked">
      <h1>🚫 このコンテンツは表示できません</h1>
      <p>許可されたチャンネルの動画のみ視聴できます</p>
      <button id="oshi-focus-settings">設定を開く</button>
    </div>
  `;

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
    
    if (channelId) {
      const allowed = await isChannelAllowed(channelId);
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

  // MutationObserverで動的に追加される要素も監視
  const observer = new MutationObserver(() => {
    const channelItems = document.querySelectorAll('ytd-guide-entry-renderer');

    channelItems.forEach((item) => {
      const link = item.querySelector('a');
      if (!link) return;

      const href = link.getAttribute('href') || '';

      // チャンネルリンクかチェック
      if (href.includes('/@') || href.includes('/channel/')) {
        const channelHandle = href.split('/@')[1]?.split('/')[0] ||
                             href.split('/channel/')[1]?.split('/')[0];

        if (channelHandle && !allowedChannelIds.includes(channelHandle)) {
          (item as HTMLElement).style.display = 'none';
        }
      }
    });
  });

  // document.bodyが存在する場合のみobserveを開始
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// ショートURLのリダイレクト
const handleShortsRedirect = () => {
  if (window.location.href.includes('/shorts/')) {
    const newUrl = convertShortsToWatch(window.location.href);
    if (newUrl !== window.location.href) {
      window.location.replace(newUrl);
    }
  }
};

// 初期化
const init = async () => {
  console.log('Oshi Focus For YouTube: Initialized');

  // CSSスタイルを注入
  injectStyles();

  // ショートのリダイレクト
  handleShortsRedirect();

  // 登録チャンネルのフィルタリング
  await filterSubscriptions();

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
      isPageBlocked = false;

      // ショートのリダイレクト
      handleShortsRedirect();

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
