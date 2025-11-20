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

// チャンネルIDをチャンネルハンドルから取得(ページ内のデータから)
export const getChannelIdFromPage = (): string | null => {
  // ytInitialDataからチャンネルIDを取得
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.includes('ytInitialData')) {
        const match = content.match(/"channelId":"([^"]+)"/);
        if (match) return match[1];
      }
    }
  } catch (e) {
    console.error('Failed to extract channel ID:', e);
  }

  return null;
};
