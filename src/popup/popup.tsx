import React, { useState, useEffect } from 'react';
import { AllowedChannel, getStorageData, saveAllowedChannels } from '../utils/storage';
import { extractChannelId } from '../utils/youtube';
import './popup.css';

export const Popup: React.FC = () => {
  const [channels, setChannels] = useState<AllowedChannel[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    const data = await getStorageData();
    setChannels(data.allowedChannels);
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

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>🎯 Oshi Focus</h1>
        <p>許可するチャンネルを管理</p>
      </header>

      <div className="popup-content">
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
            ➕ チャンネルを追加
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
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="popup-footer">
        <p>💡 ヒント: チャンネルページのURLをコピーして貼り付けてください</p>
      </footer>
    </div>
  );
};
