import React, { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../utils/storage'

function Options() {
  const [channels, setChannels] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    const settings = await getSettings()
    setChannels(settings.allowedChannels)
  }

  const addChannel = async () => {
    let channelId = inputValue.trim()
    
    if (!channelId) {
      showStatus('チャンネルIDを入力してください', 'error')
      return
    }

    // URLの場合、IDを抽出
    if (channelId.includes('youtube.com')) {
      const match = channelId.match(/\/channel\/(UC[\w-]+)|\/(@[\w-]+)/)
      if (match) {
        channelId = match[1] || match[2]
      } else {
        showStatus('有効なチャンネルURLではありません', 'error')
        return
      }
    }

    // バリデーション
    if (!channelId.startsWith('UC') && !channelId.startsWith('@')) {
      showStatus('チャンネルIDは「UC」で始まるか、「@」で始まるハンドルである必要があります', 'error')
      return
    }

    // 重複チェック
    if (channels.includes(channelId)) {
      showStatus('このチャンネルは既に登録されています', 'error')
      return
    }

    // 追加
    const newChannels = [...channels, channelId]
    await saveSettings({ allowedChannels: newChannels })
    setChannels(newChannels)
    setInputValue('')
    showStatus('チャンネルを追加しました', 'success')
  }

  const removeChannel = async (index: number) => {
    const newChannels = channels.filter((_, i) => i !== index)
    await saveSettings({ allowedChannels: newChannels })
    setChannels(newChannels)
    showStatus('チャンネルを削除しました', 'success')
  }

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatusMessage(message)
    setStatusType(type)
    setTimeout(() => {
      setStatusMessage('')
      setStatusType('')
    }, 3000)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addChannel()
    }
  }

  return (
    <div className="options-container">
      <div className="container">
        <h1>Oshi Focus for YouTube</h1>
        <p className="subtitle">許可するチャンネルを設定してください</p>
        
        <div className="section">
          <h2>チャンネルを追加</h2>
          <div className="input-group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="チャンネルID（例: UC1234567890）またはハンドル（@example）"
            />
            <button onClick={addChannel}>追加</button>
          </div>
          <div className="help-text">
            <strong>チャンネルIDの取得方法:</strong><br />
            1. YouTubeでチャンネルページを開く<br />
            2. URLから「/channel/UC...」または「/@ハンドル名」の部分をコピー<br />
            3. 上の入力欄に貼り付けて「追加」をクリック
          </div>
        </div>
        
        <div className="section">
          <h2>許可されたチャンネル一覧</h2>
          {channels.length === 0 ? (
            <p className="empty-state">チャンネルが登録されていません</p>
          ) : (
            <ul className="channel-list">
              {channels.map((channel, index) => (
                <li key={index} className="channel-item">
                  <span className="channel-id">{channel}</span>
                  <button 
                    className="btn-remove" 
                    onClick={() => removeChannel(index)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {statusMessage && (
          <div className={`status-message ${statusType}`}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export default Options