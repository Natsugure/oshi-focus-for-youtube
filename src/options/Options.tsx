import { useState, useEffect } from 'react';
import {
  getStorageData,
  saveSettings,
  saveAllowedChannels,
  Settings,
  AllowedChannel,
  defaultSettings,
} from '../utils/storage';
import { extractChannelId } from '../utils/youtube';

const Options = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [channels, setChannels] = useState<AllowedChannel[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getStorageData();
    setSettings(data.settings);
    setChannels(data.allowedChannels);
  };

  const handleSettingChange = async (
    key: keyof Settings,
    value: boolean | Settings['sideMenu']
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSavedMessage();
  };

  const handleSideMenuChange = async (
    key: keyof Settings['sideMenu'],
    value: boolean
  ) => {
    const newSideMenu = { ...settings.sideMenu, [key]: value };
    const newSettings = { ...settings, sideMenu: newSideMenu };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSavedMessage();
  };

  const showSavedMessage = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addChannel = async () => {
    setError('');

    if (!channelInput.trim()) {
      setError('チャンネルURL/IDを入力してください');
      return;
    }
    if (!nameInput.trim()) {
      setError('チャンネル名を入力してください');
      return;
    }

    let channelId = extractChannelId(channelInput);
    if (!channelId) {
      channelId = channelInput.trim();
    }

    if (channels.some((ch) => ch.id === channelId)) {
      setError('このチャンネルは既に登録されています');
      return;
    }

    const newChannel: AllowedChannel = {
      id: channelId,
      name: nameInput.trim(),
    };

    const updatedChannels = [...channels, newChannel];
    await saveAllowedChannels(updatedChannels);
    setChannels(updatedChannels);
    setChannelInput('');
    setNameInput('');
    showSavedMessage();
  };

  const removeChannel = async (id: string) => {
    const updatedChannels = channels.filter((ch) => ch.id !== id);
    await saveAllowedChannels(updatedChannels);
    setChannels(updatedChannels);
    showSavedMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addChannel();
    }
  };

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>Oshi Focus 設定</h1>
        <p>YouTubeの表示をカスタマイズ</p>
        {saved && <div className="saved-indicator">保存しました</div>}
      </header>

      <main className="options-content">
        <section className="settings-section">
          <h2>ホーム画面</h2>
          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">ホームを登録チャンネルにリダイレクト</span>
                <span className="setting-description">
                  ホーム画面にアクセスすると登録チャンネルページにリダイレクトします
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.redirectHomeToSubscriptions}
                onChange={(e) =>
                  handleSettingChange('redirectHomeToSubscriptions', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>ショート動画</h2>
          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">通常形式で再生</span>
                <span className="setting-description">
                  ショート動画ページにアクセスすると通常の動画形式にリダイレクトします
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.convertShortsToNormal}
                onChange={(e) =>
                  handleSettingChange('convertShortsToNormal', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">完全にブロック</span>
                <span className="setting-description">
                  ショート動画の再生を完全にブロックします（通常形式での再生より優先）
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.blockShortsCompletely}
                onChange={(e) =>
                  handleSettingChange('blockShortsCompletely', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>動画再生</h2>
          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">おすすめ動画（関連動画）を非表示</span>
                <span className="setting-description">
                  動画再生ページの右側に表示される関連動画を非表示にします
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideRecommendations}
                onChange={(e) =>
                  handleSideMenuChange('hideRecommendations', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>サイドメニュー</h2>
          <p className="section-description">
            非表示にする項目を選択してください
          </p>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">ホーム</span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideHome}
                onChange={(e) =>
                  handleSideMenuChange('hideHome', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">ショート</span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideShorts}
                onChange={(e) =>
                  handleSideMenuChange('hideShorts', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">登録チャンネル</span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideSubscriptions}
                onChange={(e) =>
                  handleSideMenuChange('hideSubscriptions', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item" style={{ paddingLeft: '20px' }}>
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">登録チャンネルを許可リストでフィルタ</span>
                <span className="setting-description">
                  許可チャンネルのみをサイドメニューの登録チャンネル一覧に表示します
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.filterSubscriptionsByAllowedChannels}
                disabled={settings.sideMenu.hideSubscriptions}
                onChange={(e) =>
                  handleSideMenuChange('filterSubscriptionsByAllowedChannels', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">探索</span>
                <span className="setting-description">
                  音楽・ゲーム・スポーツなどのセクション
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideExploreSection}
                onChange={(e) =>
                  handleSideMenuChange('hideExploreSection', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">YouTubeの他のサービス</span>
                <span className="setting-description">
                  YouTube Music、YouTube TVなど
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideOtherYouTubeServices}
                onChange={(e) =>
                  handleSideMenuChange('hideOtherYouTubeServices', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">自分（履歴・後で見るなど）</span>
              </span>
              <input
                type="checkbox"
                checked={settings.sideMenu.hideYouSection}
                onChange={(e) =>
                  handleSideMenuChange('hideYouSection', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>許可チャンネル</h2>
          <p className="section-description">
            これらのチャンネルの動画のみ視聴できます
          </p>

          <div className="setting-item">
            <label className="toggle-label">
              <span className="setting-text">
                <span className="setting-name">許可チャンネル以外の再生をブロック</span>
                <span className="setting-description">
                  オン時は許可チャンネルのみ視聴可能。オフ時はすべてのチャンネルを視聴可能
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.blockNonAllowedChannels}
                onChange={(e) =>
                  handleSettingChange('blockNonAllowedChannels', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="input-section">
            <div className="input-group">
              <label>チャンネルURL / ID</label>
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="https://www.youtube.com/@channel"
              />
            </div>

            <div className="input-group">
              <label>チャンネル名</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="チャンネル名を入力"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button className="add-button" onClick={addChannel}>
              チャンネルを追加
            </button>
          </div>

          {channels.length === 0 ? (
            <div className="empty-state">
              <p>許可チャンネルがありません</p>
              <p className="empty-hint">
                チャンネルを追加すると、そのチャンネルの動画のみ視聴できます
              </p>
            </div>
          ) : (
            <div className="channels-list">
              {channels.map((channel) => (
                <div key={channel.id} className="channel-item">
                  <div className="channel-info">
                    <div className="channel-name">{channel.name}</div>
                    <div className="channel-id">@{channel.id}</div>
                  </div>
                  <button
                    className="remove-button"
                    onClick={() => removeChannel(channel.id)}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Options;
