const DEFAULT_SONG_TITLES = [
  "夜曲 - 周杰伦",
  "交换余生 - 林俊杰",
  "我怀念的 - 孙燕姿",
  "突然好想你 - 五月天",
  "富士山下 - 陈奕迅",
  "我们的歌 - 王力宏",
  "爱，很简单 - 陶喆",
  "认错 - 许嵩",
  "认真的雪 - 薛之谦",
  "晴天 - 周杰伦",
  "裹着心的光 - 林俊杰",
  "遇见 - 孙燕姿",
  "你不是真正的快乐 - 五月天",
  "浮夸 - 陈奕迅",
  "依然爱你 - 王力宏",
  "小镇姑娘 - 陶喆",
  "如果当时 - 许嵩",
  "黄色枫叶 - 薛之谦",
  "半岛铁盒 - 周杰伦",
  "她说 - 林俊杰",
  "开始懂了 - 孙燕姿",
  "温柔 - 五月天",
  "淘汰 - 陈奕迅",
  "大城小爱 - 王力宏",
  "就是爱你 - 陶喆",
  "天龙八部之宿敌 - 许嵩",
  "绅士 - 薛之谦",
  "枫 - 周杰伦",
  "背对背拥抱 - 林俊杰",
  "原来你什么都不想要 - 孙燕姿",
  "我不愿让你一个人 - 五月天",
  "红玫瑰 - 陈奕迅",
  "爱的就是你 - 王力宏",
  "爱我还是他 - 陶喆",
  "半城烟沙 - 许嵩",
  "为了遇见你 - 薛之谦",
  "一路向北 - 周杰伦",
  "一千年以后 - 林俊杰",
  "我不难过 - 孙燕姿",
  "因为你所以我 - 五月天",
  "你的背包 - 陈奕迅",
  "你不知道的事 - 王力宏",
  "黑色柳丁 - 陶喆",
  "千百度 - 许嵩",
  "你过的好吗 - 薛之谦",
  "以父之名 - 周杰伦",
  "我还想她 - 林俊杰",
  "克卜勒 - 孙燕姿",
  "最重要的小事 - 五月天",
  "孤独患者 - 陈奕迅",
  "唯一 - 王力宏",
  "找自己 - 陶喆",
  "有何不可 - 许嵩",
  "我知道你都知道 - 薛之谦",
  "花海 - 周杰伦",
  "曹操 - 林俊杰",
  "半句再见 - 孙燕姿",
  "知足 - 五月天",
  "阴天快乐 - 陈奕迅",
  "改变自己 - 王力宏",
  "灰色头像 - 许嵩",
  "我好像在哪见过你 - 薛之谦",
  "说好的幸福呢 - 周杰伦",
  "关键词 - 林俊杰",
  "我也很想他 - 孙燕姿",
  "倔强 - 五月天",
  "十年 - 陈奕迅",
  "需要人陪 - 王力宏",
  "清明雨上 - 许嵩",
  "下雨了 - 薛之谦",
  "搁浅 - 周杰伦",
  "修炼爱情 - 林俊杰",
  "当冬夜渐暖 - 孙燕姿",
  "后来的我们 - 五月天",
  "不要说话 - 陈奕迅",
  "庐州月 - 许嵩",
  "深深爱过你（今生）- 薛之谦",
  "给我一首歌的时间 - 周杰伦",
  "江南 - 林俊杰",
  "不是真的爱我 - 孙燕姿",
  "可以了 - 陈奕迅",
  "多余的解释 - 许嵩",
  "等我回家 - 薛之谦",
  "蒲公英的约定 - 周杰伦",
  "可惜没如果 - 林俊杰",
  "星座书上 - 许嵩",
  "有没有 - 薛之谦",
  "七里香 - 周杰伦",
  "那些你很冒险的梦 - 林俊杰",
  "幻听 - 许嵩",
  "方圆几里 - 薛之谦",
  "烟花易冷 - 周杰伦",
  "城府 - 许嵩",
  "你还要我怎样 - 薛之谦",
  "最长的电影 - 周杰伦",
  "彩虹 - 周杰伦",
  "明明就 - 周杰伦",
  "算什么男人 - 周杰伦",
  "不能说的秘密 - 周杰伦",
  "借口 - 周杰伦"
];

globalThis.DEFAULT_PLAYLIST = {
  id: "default-music",
  name: "默认音乐歌单",
  description: "100 首华语歌曲组成的默认测试歌单。",
  items: DEFAULT_SONG_TITLES.map((title, index) => ({
    bvid: "BV1h14y1d78n",
    page: index + 1,
    title
  }))
};

(() => {
  const PLAYLISTS_KEY = "playlists";
  const LEGACY_STORAGE_KEY = "defaultPlaylist";
  const PLAY_MODES_KEY = "playlistPlayModes";
  const LEGACY_PLAY_MODE_KEY = "playlistPlayMode";
  const MAX_ITEMS = 100;
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
      name: String(value.name || fallback?.name || "未命名歌单").slice(0, 80),
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
    if (!normalized) throw new Error("无效的歌单");

    const playlists = await getPlaylists();
    const index = playlists.findIndex((item) => item.id === normalized.id);
    if (index === -1) playlists.push(normalized);
    else playlists[index] = normalized;
    await savePlaylists(playlists);
    return normalized;
  }

  async function addPlaylist(name) {
    const normalizedName = String(name || "").trim().slice(0, 80);
    if (!normalizedName) throw new Error("歌单名称不能为空");

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
