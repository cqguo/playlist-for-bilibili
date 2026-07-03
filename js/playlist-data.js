globalThis.DEFAULT_PLAYLIST = {
  id: "default-music",
  name: "默认播放列表",
  description: "默认创建的空播放列表。",
  items: []
};

(() => {
  const PLAYLISTS_KEY = "playlists";
  const LEGACY_STORAGE_KEY = "defaultPlaylist";
  const PLAY_MODES_KEY = "playlistPlayModes";
  const LEGACY_PLAY_MODE_KEY = "playlistPlayMode";
  const MAX_ITEMS = 500;
  const PLAY_MODES = new Set(["sequence", "loop", "single", "shuffle"]);

  function cloneDefaultPlaylist() {
    return {
      ...globalThis.DEFAULT_PLAYLIST,
      items: globalThis.DEFAULT_PLAYLIST.items.map((item) => ({ ...item }))
    };
  }

  function createPlaylistId() {
    return `playlist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePlaylist(value, fallback = null) {
    if (!value || !Array.isArray(value.items)) {
      return fallback ? {
        ...fallback,
        items: fallback.items.map((item) => ({ ...item }))
      } : null;
    }

    const storedItems = value.items
      .filter((item) => item && /^BV[\w]+$/i.test(item.bvid))
      .map((item) => ({
        bvid: item.bvid,
        page:
          Number.isInteger(Number(item.page)) && Number(item.page) > 0
            ? Number(item.page)
            : undefined,
        title: String(item.title || item.bvid).slice(0, 120)
      }));
    const normalizedItems = [];
    const seen = new Set();
    for (const item of storedItems) {
      const key = `${item.bvid.toLowerCase()}:${item.page || 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedItems.push(item);
      if (normalizedItems.length >= MAX_ITEMS) break;
    }

    return {
      id: String(value.id || fallback?.id || createPlaylistId()).slice(0, 100),
      name: String(value.name || fallback?.name || "未命名播放列表").slice(0, 80),
      description: String(value.description || fallback?.description || "").slice(0, 200),
      items: normalizedItems
    };
  }

  function normalizePlaylists(values) {
    if (!Array.isArray(values)) return [];

    const playlists = [];
    const seenIds = new Set();
    for (const value of values) {
      const playlist = normalizePlaylist(value);
      if (!playlist) continue;
      if (seenIds.has(playlist.id)) playlist.id = createPlaylistId();
      seenIds.add(playlist.id);
      playlists.push(playlist);
    }
    return playlists;
  }

  let memoryPlaylists = [cloneDefaultPlaylist()];

  async function getPlaylists() {
    if (!globalThis.chrome?.storage?.local) {
      return normalizePlaylists(memoryPlaylists);
    }

    const stored = await chrome.storage.local.get([PLAYLISTS_KEY, LEGACY_STORAGE_KEY]);
    if (Array.isArray(stored[PLAYLISTS_KEY])) {
      return normalizePlaylists(stored[PLAYLISTS_KEY]);
    }
    if (stored[LEGACY_STORAGE_KEY]) {
      return [normalizePlaylist(stored[LEGACY_STORAGE_KEY], cloneDefaultPlaylist())];
    }
    return [cloneDefaultPlaylist()];
  }

  async function savePlaylists(playlists) {
    const normalized = normalizePlaylists(playlists);
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.set({ [PLAYLISTS_KEY]: normalized });
    } else {
      memoryPlaylists = normalized;
    }
    return normalized;
  }

  async function getPlaylist(playlistId) {
    const playlists = await getPlaylists();
    return playlists.find((playlist) => playlist.id === playlistId) || playlists[0] || null;
  }

  async function savePlaylist(playlist) {
    const normalized = normalizePlaylist(playlist);
    if (!normalized) throw new Error("无效的播放列表");

    const playlists = await getPlaylists();
    const index = playlists.findIndex((item) => item.id === normalized.id);
    if (index === -1) playlists.push(normalized);
    else playlists[index] = normalized;
    await savePlaylists(playlists);
    return normalized;
  }

  async function addPlaylist(name) {
    const normalizedName = String(name || "").trim().slice(0, 80);
    if (!normalizedName) throw new Error("播放列表名称不能为空");

    const playlists = await getPlaylists();
    const playlist = {
      id: createPlaylistId(),
      name: normalizedName,
      description: "",
      items: []
    };
    playlists.push(playlist);
    await savePlaylists(playlists);
    return { playlist, playlists };
  }

  async function deletePlaylist(playlistId) {
    const playlists = await getPlaylists();
    const nextPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);
    if (nextPlaylists.length === playlists.length) {
      return { deleted: false, playlists };
    }
    await savePlaylists(nextPlaylists);
    return { deleted: true, playlists: nextPlaylists };
  }

  async function addVideo(video, playlistId) {
    const playlist = await getPlaylist(playlistId);
    if (!playlist || (playlistId && playlist.id !== playlistId)) {
      return { status: "no_playlist", playlist: null };
    }
    const existingItem = playlist.items.find(
      (item) =>
        item.bvid.toLowerCase() === video.bvid.toLowerCase() &&
        (item.page || 1) === (video.page || 1)
    );
    if (existingItem) {
      const title = String(video.title || video.bvid).slice(0, 120);
      if (existingItem.title !== title) {
        existingItem.title = title;
        await savePlaylist(playlist);
        return { status: "updated", playlist };
      }
      return { status: "exists", playlist };
    }
    if (playlist.items.length >= MAX_ITEMS) return { status: "full", playlist };

    playlist.items.push({
      bvid: video.bvid,
      page: video.page,
      title: String(video.title || video.bvid).slice(0, 120)
    });
    await savePlaylist(playlist);
    return { status: "added", playlist };
  }

  async function getPlayMode(playlistId = "default-music") {
    if (!globalThis.chrome?.storage?.local) return "loop";
    const stored = await chrome.storage.local.get([
      PLAY_MODES_KEY,
      LEGACY_PLAY_MODE_KEY
    ]);
    const modes = stored[PLAY_MODES_KEY] || {};
    if (PLAY_MODES.has(modes[playlistId])) return modes[playlistId];
    return PLAY_MODES.has(stored[LEGACY_PLAY_MODE_KEY])
      ? stored[LEGACY_PLAY_MODE_KEY]
      : "loop";
  }

  async function savePlayMode(mode, playlistId = "default-music") {
    const normalized = PLAY_MODES.has(mode) ? mode : "loop";
    if (globalThis.chrome?.storage?.local) {
      const stored = await chrome.storage.local.get(PLAY_MODES_KEY);
      const modes = { ...(stored[PLAY_MODES_KEY] || {}) };
      modes[playlistId] = normalized;
      await chrome.storage.local.set({ [PLAY_MODES_KEY]: modes });
    }
    return normalized;
  }

  globalThis.PlaylistStore = {
    getPlaylists,
    savePlaylists,
    getPlaylist,
    savePlaylist,
    addPlaylist,
    deletePlaylist,
    addVideo,
    getPlayMode,
    savePlayMode
  };
})();
