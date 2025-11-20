export interface AllowedChannel {
  id: string;
  name: string;
}

export interface StorageData {
  allowedChannels: AllowedChannel[];
}

export const getStorageData = async (): Promise<StorageData> => {
  const result = await chrome.storage.sync.get(['allowedChannels']);
  return {
    allowedChannels: result.allowedChannels || []
  };
};

export const saveAllowedChannels = async (channels: AllowedChannel[]): Promise<void> => {
  await chrome.storage.sync.set({ allowedChannels: channels });
};

export const isChannelAllowed = async (channelId: string): Promise<boolean> => {
  const data = await getStorageData();
  return data.allowedChannels.some(channel => channel.id === channelId);
};
