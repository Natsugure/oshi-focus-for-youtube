/**
 * サイドバーの登録チャンネルフィルタリング機能を管理するモジュール
 * - 許可チャンネルのみを表示
 * - MutationObserverによる動的監視
 * - サイドバーの開閉に対応
 */

import { getStorageData } from '../utils/storage';

// 表示する許可チャンネルの最大数
const TARGET_VISIBLE_COUNT = 7;

// デバウンス遅延時間
const DEBOUNCE_DELAY = 300;

// リセット遅延時間
const RESET_DELAY = 300;

// サイドバー開閉時の待機時間
const SIDEBAR_OPEN_DELAY = 100;

/**
 * 登録チャンネルのフィルタリングを管理するクラス
 */
export class SubscriptionFilterManager {
  private subscriptionFilterObserver: MutationObserver | null = null;
  private sidebarObserver: MutationObserver | null = null;
  private guideObserver: MutationObserver | null = null;
  private isApplyingFilter = false;
  private filterTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * 登録チャンネルセクションを見つける
   */
  private findSubscriptionsSection(): Element | null {
    const sections = document.querySelectorAll('ytd-guide-section-renderer');
    for (const section of sections) {
      const channelLink = section.querySelector('a[href="/feed/channels"]');
      if (channelLink) {
        return section;
      }
    }
    return null;
  }

  /**
   * すべてのチャンネルを表示状態に戻す
   */
  private resetFilter(): void {
    const subscriptionsSections = document.querySelectorAll('ytd-guide-section-renderer');
    subscriptionsSections.forEach((section) => {
      const allChannelItems = section.querySelectorAll('ytd-guide-entry-renderer');
      allChannelItems.forEach((item) => {
        (item as HTMLElement).style.display = '';
      });
    });
  }

  /**
   * すべてのObserverを停止
   */
  private stopAllObservers(): void {
    if (this.subscriptionFilterObserver) {
      this.subscriptionFilterObserver.disconnect();
      this.subscriptionFilterObserver = null;
    }
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
    }
    if (this.guideObserver) {
      this.guideObserver.disconnect();
      this.guideObserver = null;
    }
  }

  /**
   * フィルタを適用
   */
  private applyFilter(allowedChannelIds: string[]): void {
    // 既に実行中の場合はスキップ
    if (this.isApplyingFilter) return;
    this.isApplyingFilter = true;

    try {
      const subscriptionsSection = this.findSubscriptionsSection();
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
        this.isApplyingFilter = false;
      }, RESET_DELAY);
    }
  }

  /**
   * デバウンス付きのフィルタ実行
   */
  private debouncedApplyFilter(allowedChannelIds: string[]): void {
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
    this.filterTimeout = setTimeout(() => {
      this.applyFilter(allowedChannelIds);
    }, DEBOUNCE_DELAY);
  }

  /**
   * サイドバーの開閉を監視
   */
  private setupGuideObserver(allowedChannelIds: string[]): void {
    const guideRenderer = document.querySelector('ytd-app');
    if (!guideRenderer) return;

    this.guideObserver = new MutationObserver(() => {
      // サイドバーが開かれた時にフィルタを適用
      const guide = document.querySelector('tp-yt-app-drawer[opened]');
      if (guide) {
        // サイドバーが開かれた状態で少し待ってからフィルタを適用
        setTimeout(() => {
          this.debouncedApplyFilter(allowedChannelIds);
        }, SIDEBAR_OPEN_DELAY);
      }
    });

    this.guideObserver.observe(guideRenderer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['opened']
    });
  }

  /**
   * 登録チャンネルセクションが存在する場合のセットアップ
   */
  private setupExistingSection(
    subscriptionsSection: Element,
    allowedChannelIds: string[]
  ): void {
    // 初回実行
    this.applyFilter(allowedChannelIds);

    // サイドバーの開閉を監視
    this.setupGuideObserver(allowedChannelIds);

    // MutationObserverで動的に追加される要素も監視
    const collapsibleEntry = subscriptionsSection.querySelector('ytd-guide-collapsible-entry-renderer');
    if (collapsibleEntry) {
      const expandableItems = collapsibleEntry.querySelector('#expandable-items');
      if (expandableItems) {
        this.subscriptionFilterObserver = new MutationObserver(() => {
          this.debouncedApplyFilter(allowedChannelIds);
        });
        this.subscriptionFilterObserver.observe(expandableItems, {
          childList: true
        });
      }
    }
  }

  /**
   * サイドバーが追加されるのを待つ
   */
  private setupWaitingForSection(allowedChannelIds: string[]): void {
    const ytdApp = document.querySelector('ytd-app');
    if (!ytdApp) return;

    this.sidebarObserver = new MutationObserver(() => {
      const section = this.findSubscriptionsSection();
      if (section) {
        // サイドバーが見つかったらsidebarObserverを停止
        if (this.sidebarObserver) {
          this.sidebarObserver.disconnect();
          this.sidebarObserver = null;
        }

        // セットアップを実行
        this.setupExistingSection(section, allowedChannelIds);
      }
    });

    this.sidebarObserver.observe(ytdApp, {
      childList: true,
      subtree: true
    });
  }

  /**
   * フィルタリングを開始
   */
  async startFiltering(): Promise<void> {
    const data = await getStorageData();
    const allowedChannelIds = data.allowedChannels.map(ch => ch.id);

    // すべてのObserverを停止
    this.stopAllObservers();

    // フィルタ設定が無効、または許可リストが空の場合はすべて表示に戻す
    if (!data.settings.sideMenu.filterSubscriptionsByAllowedChannels || allowedChannelIds.length === 0) {
      this.resetFilter();
      return;
    }

    // 登録チャンネルセクションが存在するかチェック
    const subscriptionsSection = this.findSubscriptionsSection();

    if (subscriptionsSection) {
      this.setupExistingSection(subscriptionsSection, allowedChannelIds);
    } else {
      this.setupWaitingForSection(allowedChannelIds);
    }
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    this.stopAllObservers();

    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
      this.filterTimeout = null;
    }

    this.resetFilter();
  }
}

// シングルトンインスタンスをエクスポート
export const subscriptionFilterManager = new SubscriptionFilterManager();
