/**
 * ブロック機能を管理するモジュール
 * - オーバーレイ表示
 * - 動画の強制停止
 * - キーボード操作のブロック
 */

export type BlockReason = 'unauthorized-channel' | 'shorts-blocked';

interface BlockConfig {
  title: string;
  message: string;
}

const BLOCK_CONFIGS: Record<BlockReason, BlockConfig> = {
  'unauthorized-channel': {
    title: 'このコンテンツは表示できません',
    message: '許可されたチャンネルの動画のみ視聴できます'
  },
  'shorts-blocked': {
    title: 'ショート動画はブロックされています',
    message: 'ショート動画の再生は設定で無効にされています'
  }
};

// ブロック対象のキー一覧
const BLOCKED_KEYS = [
  ' ', 'Space',           // スペースキー（再生/一時停止）
  'k', 'K',               // YouTubeの再生/一時停止ショートカット
  'j', 'J', 'l', 'L',     // YouTubeの巻き戻し/早送り
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'm', 'M',               // ミュート
  'MediaPlayPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious'
];

/**
 * ブロック機能を管理するクラス
 */
export class BlockManager {
  private isBlocked = false;
  private overlayId = 'oshi-focus-blocked-overlay';
  private videoPlayHandler: (e: Event) => void;
  private keyDownHandler: (e: KeyboardEvent) => void;
  private trackedVideos = new Set<HTMLVideoElement>();

  constructor() {
    // イベントハンドラを初期化時にバインド
    this.videoPlayHandler = this.handleVideoPlay.bind(this);
    this.keyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * ブロック状態かどうかを返す
   */
  isPageBlocked(): boolean {
    return this.isBlocked;
  }

  /**
   * 動画再生を阻止するハンドラ
   */
  private handleVideoPlay(e: Event): void {
    // ブロック状態でない場合は何もしない
    if (!this.isBlocked) return;

    const video = e.target as HTMLVideoElement;
    video.pause();
  }

  /**
   * キーボード操作を阻止するハンドラ
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (BLOCKED_KEYS.includes(e.key) || BLOCKED_KEYS.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  /**
   * すべての動画を強制停止し、再生イベントをブロック
   */
  private pauseAllVideos(): void {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      const htmlVideo = video as HTMLVideoElement;
      htmlVideo.pause();

      // まだトラッキングされていない動画にのみリスナーを追加
      if (!this.trackedVideos.has(htmlVideo)) {
        htmlVideo.addEventListener('play', this.videoPlayHandler, true);
        this.trackedVideos.add(htmlVideo);
      }
    });
  }

  /**
   * 動画再生イベントのブロックを解除
   */
  private unpauseAllVideos(): void {
    // トラッキングされているすべての動画からリスナーを削除
    this.trackedVideos.forEach(video => {
      video.removeEventListener('play', this.videoPlayHandler, true);
    });
    this.trackedVideos.clear();
  }

  /**
   * キーボードイベントをブロック
   */
  private blockKeyboardEvents(): void {
    document.addEventListener('keydown', this.keyDownHandler, true);
  }

  /**
   * キーボードイベントのブロックを解除
   */
  private unblockKeyboardEvents(): void {
    document.removeEventListener('keydown', this.keyDownHandler, true);
  }

  /**
   * ブロックオーバーレイを作成
   */
  private createOverlay(config: BlockConfig): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = this.overlayId;
    overlay.className = 'oshi-focus-blocked';
    overlay.innerHTML = `
      <h1>🚫 ${config.title}</h1>
      <p>${config.message}</p>
      <button id="oshi-focus-settings">設定を開く</button>
    `;

    // 設定を開くボタンのイベントリスナー
    const button = overlay.querySelector('#oshi-focus-settings');
    button?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });

    return overlay;
  }

  /**
   * ブロックメッセージを表示
   */
  showBlockMessage(reason: BlockReason): void {
    if (this.isBlocked) return;

    const config = BLOCK_CONFIGS[reason];

    // 既存のオーバーレイがあれば削除（DOM要素のみ）
    const existingOverlay = document.getElementById(this.overlayId);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // ブロック状態を設定
    this.isBlocked = true;

    // 動画を停止
    this.pauseAllVideos();

    // キーボード操作をブロック
    this.blockKeyboardEvents();

    // オーバーレイを表示
    const overlay = this.createOverlay(config);
    document.body.appendChild(overlay);
  }

  /**
   * ブロックオーバーレイを削除
   */
  removeBlockOverlay(): void {
    const overlay = document.getElementById(this.overlayId);
    if (overlay) {
      overlay.remove();
    }

    if (this.isBlocked) {
      this.isBlocked = false;

      // キーボードイベントのブロックを解除
      this.unblockKeyboardEvents();

      // 動画再生イベントのブロックを解除
      this.unpauseAllVideos();
    }
  }

  /**
   * インスタンスをクリーンアップ
   */
  dispose(): void {
    this.removeBlockOverlay();
  }
}

// シングルトンインスタンスをエクスポート
export const blockManager = new BlockManager();
