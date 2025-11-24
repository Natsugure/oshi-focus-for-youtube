// URLからチャンネルIDを抽出
export const extractChannelId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/@([^\/\?]+)/,
    /youtube\.com\/channel\/([^\/\?]+)/,
    /youtube\.com\/c\/([^\/\?]+)/,
    /youtube\.com\/user\/([^\/\?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// 動画URLからビデオIDを抽出
export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// ショートURLを通常の動画URLに変換
export const convertShortsToWatch = (url: string): string => {
  const videoId = extractVideoId(url);
  if (!videoId) return url;

  if (url.includes('/shorts/')) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return url;
};

// ショート動画ページからチャンネル情報を取得（DOM要素から）
const getChannelInfoFromShortsPage = (): { channelId: string | null; channelHandle: string | null } => {
  // ショート動画ページのチャンネルリンクからハンドルを取得
  const channelLink = document.querySelector('ytd-channel-name a[href*="/@"]') as HTMLAnchorElement | null;
  if (channelLink) {
    const href = channelLink.getAttribute('href') || '';
    const handleMatch = href.match(/\/@([^\/\?]+)/);
    if (handleMatch) {
      console.log('[Oshi Focus] Found channel handle from DOM:', handleMatch[1]);
      return { channelId: null, channelHandle: handleMatch[1] };
    }
  }

  // 別のセレクタも試す（ショート動画プレイヤー内）
  const shortsChannelLink = document.querySelector('a.ytd-reel-player-header-renderer[href*="/@"]') as HTMLAnchorElement | null;
  if (shortsChannelLink) {
    const href = shortsChannelLink.getAttribute('href') || '';
    const handleMatch = href.match(/\/@([^\/\?]+)/);
    if (handleMatch) {
      console.log('[Oshi Focus] Found channel handle from shorts player:', handleMatch[1]);
      return { channelId: null, channelHandle: handleMatch[1] };
    }
  }

  // ytd-reel-video-renderer内のチャンネルリンク
  const reelChannelLink = document.querySelector('ytd-reel-video-renderer[is-active] a[href*="/@"]') as HTMLAnchorElement | null;
  if (reelChannelLink) {
    const href = reelChannelLink.getAttribute('href') || '';
    const handleMatch = href.match(/\/@([^\/\?]+)/);
    if (handleMatch) {
      console.log('[Oshi Focus] Found channel handle from reel renderer:', handleMatch[1]);
      return { channelId: null, channelHandle: handleMatch[1] };
    }
  }

  console.log('[Oshi Focus] No channel info found from DOM');
  return { channelId: null, channelHandle: null };
};

// 通常動画ページからチャンネル情報を取得（scriptタグから）
const getChannelInfoFromWatchPage = (): { channelId: string | null; channelHandle: string | null } => {
  const scripts = document.querySelectorAll('script');

  for (const script of scripts) {
    const content = script.textContent || '';
    if (content.includes('var ytInitialPlayerResponse =')) {
      // ytInitialPlayerResponseからchannelIdを取得
      const channelIdMatch = content.match(/"channelId":"(UC[^"]+)"/);
      const handleMatch = content.match(/"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/@([^"]+)"/);

      if (channelIdMatch || handleMatch) {
        console.log('[Oshi Focus] Found channel info from ytInitialPlayerResponse:', channelIdMatch?.[1], handleMatch?.[1]);
        return {
          channelId: channelIdMatch?.[1] || null,
          channelHandle: handleMatch?.[1] || null
        };
      }
    }
  }

  // DOM要素からも取得を試みる
  const ownerLink = document.querySelector('#owner a[href*="/@"]') as HTMLAnchorElement | null;
  if (ownerLink) {
    const href = ownerLink.getAttribute('href') || '';
    const handleMatch = href.match(/\/@([^\/\?]+)/);
    if (handleMatch) {
      console.log('[Oshi Focus] Found channel handle from watch page DOM:', handleMatch[1]);
      return { channelId: null, channelHandle: handleMatch[1] };
    }
  }

  console.log('[Oshi Focus] No channel info found from watch page');
  return { channelId: null, channelHandle: null };
};

// チャンネルIDをページ内のデータから取得
export const getChannelIdFromPage = (): string | null => {
  try {
    const isShorts = window.location.pathname.startsWith('/shorts/');
    const info = isShorts ? getChannelInfoFromShortsPage() : getChannelInfoFromWatchPage();
    return info.channelId;
  } catch (e) {
    console.error('Failed to extract channel ID:', e);
  }
  return null;
};

// チャンネルハンドル（@xxx形式）をページ内のデータから取得
export const getChannelHandleFromPage = (): string | null => {
  try {
    const isShorts = window.location.pathname.startsWith('/shorts/');
    const info = isShorts ? getChannelInfoFromShortsPage() : getChannelInfoFromWatchPage();
    return info.channelHandle;
  } catch (e) {
    console.error('Failed to extract channel handle:', e);
  }
  return null;
};
