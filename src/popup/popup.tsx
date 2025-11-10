import React, { useState, useEffect } from 'react'
import { getSettings } from '../utils/storage'

function Popup() {
  const [channelCount, setChannelCount] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await getSettings()
      setChannelCount(settings.allowedChannels.length)
      setIsActive(settings.allowedChannels.length > 0)
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error)
    } finally {
      setLoading(false)
    }
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  if (loading) {
    return (
      <div className="popup-container">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <h1>Oshi Focus</h1>
      
      <div className={`status ${isActive ? 'active' : 'inactive'}`}>
        <span>{isActive ? '有効' : '設定が必要です'}</span>
      </div>
      
      <p>
        許可チャンネル数: <span className="channel-count">{channelCount}</span>
      </p>
      
      <button onClick={openOptions} className="btn-primary">
        設定を開く
      </button>
      
      <p className="help-text">
        設定ページで許可するチャンネルを指定してください。
      </p>
    </div>
  )
}

export default Popup