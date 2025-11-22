import { useState, useEffect } from 'react';
import { AllowedChannel, getStorageData, saveAllowedChannels } from '../utils/storage';
import { extractChannelId } from '../utils/youtube';
import './popup.css';

interface CurrentChannelInfo {
  id: string | null;
  name: string | null;
}

const openOptionsPage = () => {
  chrome.runtime.openOptionsPage();
};

export const Popup: React.FC = () => {
  const [channels, setChannels] = useState<AllowedChannel[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');
  const [currentChannel, setCurrentChannel] = useState<CurrentChannelInfo | null>(null);
  const [isCurrentChannelAdded, setIsCurrentChannelAdded] = useState(false);

  useEffect(() => {
    loadChannels();
    loadCurrentChannelInfo();
  }, []);

  // チャンネルリストが更新されたら、現在のチャンネルが追加済みかチェック
  useEffect(() => {
    if (currentChannel?.id) {
      setIsCurrentChannelAdded(channels.some(ch => ch.id === currentChannel.id));
    }
  }, [channels, currentChannel]);

  const loadChannels = async () => {
    const data = await getStorageData();
    setChannels(data.allowedChannels);
  };

  const loadCurrentChannelInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url?.includes('youtube.com')) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CHANNEL_INFO' });
        if (response && (response.id || response.name)) {
          setCurrentChannel(response);
        }
      }
    } catch {
      // コンテンツスクリプトが読み込まれていない場合など
      setCurrentChannel(null);
    }
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

    // URLからチャンネルIDを抽出、または直接IDとして使用
    let channelId = extractChannelId(channelInput);
    if (!channelId) {
      // URLでない場合は、入力値をそのままIDとして使用
      channelId = channelInput.trim();
    }

    // 既に登録済みかチェック
    if (channels.some(ch => ch.id === channelId)) {
      setError('このチャンネルは既に登録されています');
      return;
    }

    const newChannel: AllowedChannel = {
      id: channelId,
      name: nameInput.trim()
    };

    const updatedChannels = [...channels, newChannel];
    await saveAllowedChannels(updatedChannels);
    setChannels(updatedChannels);
    setChannelInput('');
    setNameInput('');
  };

  const addCurrentChannel = async () => {
    if (!currentChannel?.id || !currentChannel?.name) return;

    // 既に登録済みかチェック
    if (channels.some(ch => ch.id === currentChannel.id)) {
      return;
    }

    const newChannel: AllowedChannel = {
      id: currentChannel.id,
      name: currentChannel.name
    };

    const updatedChannels = [...channels, newChannel];
    await saveAllowedChannels(updatedChannels);
    setChannels(updatedChannels);
  };

  const removeChannel = async (channelId: string) => {
    const updatedChannels = channels.filter(ch => ch.id !== channelId);
    await saveAllowedChannels(updatedChannels);
    setChannels(updatedChannels);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addChannel();
    }
  };

  const canAddCurrentChannel = currentChannel?.id && currentChannel?.name && !isCurrentChannelAdded;

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Oshi Focus</h1>
        <p>許可するチャンネルを管理</p>
      </header>

      <div className="popup-content">
        {currentChannel && (
          <div className="current-channel-section">
            <h2>表示中のチャンネル</h2>
            {currentChannel.id && currentChannel.name ? (
              <div className="current-channel-info">
                <div className="channel-details">
                  <div className="channel-name">{currentChannel.name}</div>
                  <div className="channel-id">@{currentChannel.id}</div>
                </div>
                <button
                  className={`add-current-button ${isCurrentChannelAdded ? 'added' : ''}`}
                  onClick={addCurrentChannel}
                  disabled={!canAddCurrentChannel}
                >
                  {isCurrentChannelAdded ? '追加済み' : '許可リストに追加'}
                </button>
              </div>
            ) : (
              <p className="no-channel-hint">チャンネル情報を取得できません</p>
            )}
          </div>
        )}

        <div className="input-section">
          <h2>手動で追加</h2>
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

        <div className="channels-section">
          <h2>許可リスト ({channels.length})</h2>
          {channels.length === 0 ? (
            <div className="empty-state">
              <p>チャンネルが登録されていません</p>
              <p className="empty-hint">上記フォームからチャンネルを追加してください</p>
            </div>
          ) : (
            <div className="channels-list">
              {channels.map((channel) => (
                <div key={channel.id} className="channel-item">
                  <div className="channel-info">
                    <div className="channel-name">{channel.name}</div>
                    <div className="channel-id">{channel.id}</div>
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
        </div>
      </div>

      <footer className="popup-footer">
        <button className="settings-button" onClick={openOptionsPage}>
          設定を開く
        </button>
      </footer>
    </div>
  );
};
