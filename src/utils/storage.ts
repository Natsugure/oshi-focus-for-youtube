export interface AllowedChannel {
  id: string;
  name: string;
}

export interface SideMenuSettings {
  hideHome: boolean;
  hideShorts: boolean;
  hideSubscriptions: boolean;
  hideExploreSection: boolean;
  hideMusic: boolean;
  hideYouSection: boolean;
  hideRecommendations: boolean;
}

export interface Settings {
  convertShortsToNormal: boolean;
  blockShortsCompletely: boolean;
  redirectHomeToSubscriptions: boolean;
  sideMenu: SideMenuSettings;
}

export interface StorageData {
  allowedChannels: AllowedChannel[];
  settings: Settings;
}

export const defaultSettings: Settings = {
  convertShortsToNormal: true,
  blockShortsCompletely: false,
  redirectHomeToSubscriptions: true,
  sideMenu: {
    hideHome: true,
    hideShorts: true,
    hideSubscriptions: false,
    hideExploreSection: true,
    hideMusic: true,
    hideYouSection: true,
    hideRecommendations: true,
  },
};

export const getStorageData = async (): Promise<StorageData> => {
  const result = await chrome.storage.sync.get(['allowedChannels', 'settings']);
  return {
    allowedChannels: result.allowedChannels || [],
    settings: { ...defaultSettings, ...result.settings },
  };
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  await chrome.storage.sync.set({ settings });
};

export const saveAllowedChannels = async (channels: AllowedChannel[]): Promise<void> => {
  await chrome.storage.sync.set({ allowedChannels: channels });
};

export const isChannelAllowed = async (channelId: string): Promise<boolean> => {
  const data = await getStorageData();
  // 許可リストが空の場合はすべてのチャンネルを許可
  if (data.allowedChannels.length === 0) {
    return true;
  }
  return data.allowedChannels.some(channel => channel.id === channelId);
};
