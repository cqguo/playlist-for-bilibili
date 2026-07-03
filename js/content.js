(() => {
  const HOST_ID = "bili-playlist-shadow-host";
  const NATIVE_LIST_STYLE_ID = "bili-playlist-hide-native-lists";
  const PLAY_MODES_STORAGE_KEY = "playlistPlayModes";
  const LEGACY_PLAY_MODE_STORAGE_KEY = "playlistPlayMode";
  const MAX_ITEMS = 2000;
  let host = null;
  let shadow = null;
  let nativeHeader = null;
  let originalHeaderChildren = [];
  let pageObserver = null;
  let boundVideo = null;
  let lastResetVideo = null;
  let lastResetKey = "";
  let savedPlayMode = "loop";
  let currentPlaylistId = "default-music";
  const PLAY_MODES = new Set(["sequence", "loop", "single", "shuffle"]);

  function decodePlaylist(value) {
    if (!value) return [];
    try {
      const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(padded), (character) =>
        character.charCodeAt(0)
      );
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && /^BV[\w]+$/i.test(item.bvid))
        .slice(0, MAX_ITEMS)
        .map((item) => ({
          bvid: item.bvid,
          page:
            Number.isInteger(Number(item.page)) && Number(item.page) > 0
              ? Number(item.page)
              : undefined,
          title: String(item.title || item.bvid).slice(0, 120)
        }));
    } catch {
      return [];
    }
  }

  function getState() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get("bili_playlist") !== "1") return null;

    const items = decodePlaylist(params.get("list"));
    if (!items.length) return null;

    const currentBvid = location.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
    const currentPage = Number(new URL(location.href).searchParams.get("p") || 1);
    const matchedIndex = items.findIndex(
      (item) =>
        item.bvid.toLowerCase() === currentBvid?.toLowerCase() &&
        (item.page || 1) === currentPage
    );

    return {
      id:
        params.get("playlist_id") ||
        params.get("playlist_name") ||
        "default-music",
      name: params.get("playlist_name") || "我的播放列表",
      items,
      index: matchedIndex >= 0 ? matchedIndex : 0,
      mode: savedPlayMode,
      params
    };
  }

  function buildUrl(state, index) {
    const params = new URLSearchParams(state.params);
    params.set("playlist_id", state.id);
    params.set("index", String(index));
    params.set("play_mode", state.mode);
    const item = state.items[index];
    const query = item.page ? `?p=${item.page}` : "";
    return `https://www.bilibili.com/video/${item.bvid}/${query}#${params.toString()}`;
  }

  async function loadSavedPlayMode() {
    const params = new URLSearchParams(location.hash.slice(1));
    const fragmentMode = params.get("play_mode");
    currentPlaylistId =
      params.get("playlist_id") ||
      params.get("playlist_name") ||
      "default-music";
    try {
      const stored = await chrome.storage.local.get([
        PLAY_MODES_STORAGE_KEY,
        LEGACY_PLAY_MODE_STORAGE_KEY
      ]);
      const modes = stored[PLAY_MODES_STORAGE_KEY] || {};
      if (PLAY_MODES.has(modes[currentPlaylistId])) {
        savedPlayMode = modes[currentPlaylistId];
        return;
      }
      if (PLAY_MODES.has(stored[LEGACY_PLAY_MODE_STORAGE_KEY])) {
        savedPlayMode = stored[LEGACY_PLAY_MODE_STORAGE_KEY];
      } else {
        savedPlayMode = PLAY_MODES.has(fragmentMode) ? fragmentMode : "loop";
      }
    } catch {
      savedPlayMode = PLAY_MODES.has(fragmentMode) ? fragmentMode : "loop";
    }

    try {
      const stored = await chrome.storage.local.get(PLAY_MODES_STORAGE_KEY);
      const modes = { ...(stored[PLAY_MODES_STORAGE_KEY] || {}) };
      modes[currentPlaylistId] = savedPlayMode;
      await chrome.storage.local.set({ [PLAY_MODES_STORAGE_KEY]: modes });
    } catch {
      // Storage may be unavailable on an invalidated extension context.
    }
  }

  async function savePlayMode(mode) {
    savedPlayMode = PLAY_MODES.has(mode) ? mode : "loop";
    try {
      const stored = await chrome.storage.local.get(PLAY_MODES_STORAGE_KEY);
      const modes = { ...(stored[PLAY_MODES_STORAGE_KEY] || {}) };
      modes[currentPlaylistId] = savedPlayMode;
      await chrome.storage.local.set({ [PLAY_MODES_STORAGE_KEY]: modes });
    } catch {
      // Keep the in-memory mode active for the current page.
    }
  }

  function setNativeListsHidden(hidden) {
    const existing = document.getElementById(NATIVE_LIST_STYLE_ID);
    if (!hidden) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const style = document.createElement("style");
    style.id = NATIVE_LIST_STYLE_ID;
    style.textContent = `
      #app .right-container .video-pod,
      #app .right-container .video-sections-content-list,
      #app .right-container .video-card-ad-small,
      #app .right-container .next-play,
      #app .right-container .bui-collapse-header + .bui-collapse-body,
      #app .right-container .bui-collapse-header ~ .bui-collapse-body {
        display: none !important;
      }
      #app .right-container .bui-collapse-header {
        display: block !important;
        height: auto !important;
        max-height: none !important;
        padding: 0 !important;
        overflow: visible !important;
      }
    `;
    document.head.append(style);
  }

  function findNativeHeader() {
    return (
      document.querySelector("#app .right-container .bui-collapse-header") ||
      document.querySelector(
        ".video-container-v1 .right-container .bui-collapse-header"
      ) ||
      document.querySelector(".right-container .bui-collapse-header")
    );
  }

  function createHost() {
    nativeHeader = findNativeHeader();
    if (!nativeHeader) return false;

    originalHeaderChildren = [...nativeHeader.childNodes];
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.display = "block";
    host.style.width = "100%";
    host.style.padding = "0";
    nativeHeader.replaceChildren(host);

    shadow = host.attachShadow({ mode: "open" });
    shadow.addEventListener("click", (event) => event.stopPropagation());
    const style = document.createElement("style");
    style.textContent = `
      :host, *, *::before, *::after { box-sizing: border-box; }
      :host { display: block; width: 100%; }
      .panel {
        width: 100%;
        overflow: hidden;
        color: #18191c;
        background: #f6f7f8;
        border: 1px solid #e3e5e7;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 66px;
        padding: 13px 15px;
        background: #fff;
        border-bottom: 1px solid #e3e5e7;
      }
      .heading { min-width: 0; }
      h2 {
        margin: 0 0 4px;
        overflow: hidden;
        font-size: 16px;
        line-height: 22px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      header p {
        margin: 0;
        color: #9499a0;
        font-size: 12px;
      }
      select {
        flex: 0 0 auto;
        height: 30px;
        padding: 0 8px;
        color: #61666d;
        font-size: 12px;
        background: #f6f7f8;
        border: 1px solid #e3e5e7;
        border-radius: 6px;
        cursor: pointer;
        outline: none;
      }
      select:hover, select:focus { border-color: #00aeec; }
      .list {
        max-height: 360px;
        padding: 6px;
        overflow: auto;
        scrollbar-width: thin;
      }
      a {
        display: flex;
        align-items: center;
        gap: 11px;
        min-height: 58px;
        padding: 8px 9px;
        color: inherit;
        text-decoration: none;
        border-radius: 6px;
      }
      a:hover { background: #e3e5e7; }
      a.active { background: #dff6fd; }
      .order {
        display: grid;
        flex: 0 0 32px;
        height: 32px;
        color: #61666d;
        font-size: 11px;
        place-items: center;
        background: #fff;
        border-radius: 7px;
      }
      a.active .order {
        color: #fff;
        background: #00aeec;
      }
      .info {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
      }
      strong, small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      strong {
        font-size: 13px;
        font-weight: 500;
        line-height: 19px;
      }
      small {
        margin-top: 3px;
        color: #9499a0;
        font-size: 11px;
        line-height: 16px;
      }
      a:hover strong, a.active strong { color: #00aeec; }
    `;
    shadow.append(style);
    return true;
  }

  function renderPanel(state) {
    if (!host?.isConnected) {
      host = null;
      shadow = null;
      if (!createHost()) return false;
    }
    shadow.querySelector(".panel")?.remove();

    const panel = document.createElement("section");
    panel.className = "panel";

    const header = document.createElement("header");
    const heading = document.createElement("div");
    heading.className = "heading";
    const title = document.createElement("h2");
    title.textContent = state.name;
    const count = document.createElement("p");
    count.textContent = `${state.index + 1} / ${state.items.length} 个视频`;
    heading.append(title, count);

    const modeSelect = document.createElement("select");
    modeSelect.setAttribute("aria-label", "播放模式");
    const modes = [
      ["sequence", "顺序播放"],
      ["loop", "列表循环"],
      ["single", "单曲循环"],
      ["shuffle", "随机播放"]
    ];
    for (const [value, label] of modes) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === state.mode;
      modeSelect.append(option);
    }
    modeSelect.addEventListener("change", async () => {
      await savePlayMode(modeSelect.value);
      const params = new URLSearchParams(location.hash.slice(1));
      params.set("play_mode", savedPlayMode);
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}#${params.toString()}`
      );
      render();
    });

    header.append(heading, modeSelect);

    const list = document.createElement("div");
    list.className = "list";

    state.items.forEach((item, index) => {
      const link = document.createElement("a");
      link.href = buildUrl(state, index);
      if (index === state.index) link.className = "active";

      const order = document.createElement("span");
      order.className = "order";
      order.textContent = index === state.index ? "▶" : String(index + 1).padStart(2, "0");

      const info = document.createElement("span");
      info.className = "info";
      const titleText = document.createElement("strong");
      titleText.textContent = item.title;
      const bvid = document.createElement("small");
      bvid.textContent =
        index === state.index ? `${item.bvid} · 正在播放` : item.bvid;

      info.append(titleText, bvid);
      link.append(order, info);
      list.append(link);
    });

    panel.append(header, list);
    shadow.append(panel);
    return true;
  }

  function getNextIndex(state) {
    if (state.mode === "single") return state.index;
    if (state.mode === "sequence") {
      return state.index < state.items.length - 1 ? state.index + 1 : null;
    }
    if (state.mode === "shuffle") {
      if (state.items.length <= 1) return state.index;
      let next = state.index;
      while (next === state.index) {
        next = Math.floor(Math.random() * state.items.length);
      }
      return next;
    }
    return (state.index + 1) % state.items.length;
  }

  function resetCurrentVideoToStart(video) {
    const state = getState();
    if (!state) return;

    const item = state.items[state.index];
    const key = `${item.bvid.toLowerCase()}:${item.page || 1}`;
    if (video === lastResetVideo && key === lastResetKey) return;

    lastResetVideo = video;
    lastResetKey = key;

    const reset = () => {
      if (
        video !== lastResetVideo ||
        key !== lastResetKey ||
        !video.isConnected
      ) {
        return;
      }
      try {
        if (video.currentTime > 0.05) video.currentTime = 0;
      } catch {
        // The media metadata is not available yet.
      }
    };

    video.addEventListener("loadedmetadata", reset, {
      once: true,
      capture: true
    });
    video.addEventListener("play", reset, { once: true, capture: true });
    video.addEventListener("playing", reset, { once: true, capture: true });
    reset();
  }

  function attachPlayerListener() {
    const video = document.querySelector("video");
    if (!video) return;

    resetCurrentVideoToStart(video);
    if (video === boundVideo) return;

    boundVideo = video;
    video.addEventListener(
      "ended",
      (event) => {
        event.stopImmediatePropagation();
        const state = getState();
        if (!state) return;
        const nextIndex = getNextIndex(state);
        if (nextIndex === null) return;
        location.assign(buildUrl(state, nextIndex));
      },
      { capture: true }
    );
  }

  function restoreNativeHeader() {
    if (nativeHeader?.isConnected && nativeHeader.contains(host)) {
      nativeHeader.replaceChildren(...originalHeaderChildren);
    }
    host = null;
    shadow = null;
    nativeHeader = null;
    originalHeaderChildren = [];
  }

  function cleanNativeTitle(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^\s*(?:正在播放|播放中)\s*/i, "")
      .trim()
      .slice(0, 120);
  }

  function titleFromListItem(item) {
    if (!item) return "";

    const titleElement = item.matches?.(
      ".title-txt, .video-episode-card__info-title, .part"
    )
      ? item
      : item.querySelector?.(
          ".title-txt, .video-episode-card__info-title, .part, [class~='title']"
        );
    const elementTitle = cleanNativeTitle(
      titleElement?.getAttribute("title") ||
        titleElement?.getAttribute("aria-label") ||
        titleElement?.textContent
    );
    if (elementTitle) return elementTitle;

    return cleanNativeTitle(
      item.getAttribute?.("title") || item.getAttribute?.("aria-label")
    );
  }

  function getNativeListItemTitle() {
    const containers = [
      ...document.querySelectorAll(
        ".video-pod, .playlist-container, .video-sections-content-list, " +
          ".base-video-sections-v1, #multi_page"
      )
    ];
    if (!containers.length) return "";

    const activeSelectors = [
      ".video-pod__item.active",
      ".simple-base-item.active",
      ".video-episode-card__info-playing",
      ".video-episode-card.active",
      ".cur-list .part.on",
      ".cur-list .part.active",
      "li.on",
      "[aria-current='true']"
    ];
    for (const container of containers) {
      for (const selector of activeSelectors) {
        const title = titleFromListItem(container.querySelector(selector));
        if (title) return title;
      }
    }

    const currentBvid = location.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
    const currentPage = new URL(location.href).searchParams.get("p") || "1";
    if (!currentBvid) return "";

    for (const container of containers) {
      for (const link of container.querySelectorAll('a[href*="/video/"]')) {
        try {
          const url = new URL(link.href, location.href);
          const bvid = url.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
          const page = url.searchParams.get("p") || "1";
          if (
            bvid?.toLowerCase() !== currentBvid.toLowerCase() ||
            page !== currentPage
          ) {
            continue;
          }

          const item = link.closest(
            "li, .video-pod__item, .simple-base-item, " +
              ".video-episode-card, [class*='item']"
          );
          const title = titleFromListItem(item) || titleFromListItem(link);
          if (title) return title;
        } catch {
          // Ignore malformed links injected by the page.
        }
      }
    }

    return "";
  }

  function normalizeBatchItems(items) {
    const normalized = [];
    const seen = new Set();
    for (const item of items) {
      if (!item || !/^BV[\w]+$/i.test(item.bvid)) continue;
      const page =
        Number.isInteger(Number(item.page)) && Number(item.page) > 0
          ? Number(item.page)
          : undefined;
      const key = `${item.bvid.toLowerCase()}:${page || 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        bvid: item.bvid,
        page,
        title: cleanNativeTitle(item.title) || item.bvid
      });
      if (normalized.length >= MAX_ITEMS) break;
    }
    return normalized;
  }

  function getBatchItemsFromDocument() {
    const items = [];
    const containers = document.querySelectorAll(
      ".video-pod, .playlist-container, .video-sections-content-list, " +
        ".base-video-sections-v1, #multi_page"
    );
    for (const container of containers) {
      for (const link of container.querySelectorAll('a[href*="/video/"]')) {
        try {
          const url = new URL(link.href, location.href);
          const bvid = url.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
          if (!bvid) continue;
          const item = link.closest(
            "li, .video-pod__item, .simple-base-item, " +
              ".video-episode-card, [class*='item']"
          );
          items.push({
            bvid,
            page: Number(url.searchParams.get("p") || 1),
            title: titleFromListItem(item) || titleFromListItem(link)
          });
        } catch {
          // Ignore malformed links injected by the page.
        }
      }
    }
    return normalizeBatchItems(items);
  }

  function getEpisodeItems(episode) {
    const bvid = episode?.bvid || episode?.arc?.bvid;
    if (!bvid) return [];
    const episodeTitle = cleanNativeTitle(
      episode.title || episode.arc?.title || episode.long_title
    );
    const pages = Array.isArray(episode.pages) ? episode.pages : [];
    if (!pages.length) {
      return [{ bvid, title: episodeTitle || bvid }];
    }
    return pages.map((page, index) => {
      const partTitle = cleanNativeTitle(page.part);
      return {
        bvid,
        page: Number(page.page) || index + 1,
        title:
          pages.length > 1 && episodeTitle && partTitle !== episodeTitle
            ? `${episodeTitle} · ${partTitle}`
            : episodeTitle || partTitle || bvid
      };
    });
  }

  async function getBatchItems() {
    const currentBvid = location.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
    if (!currentBvid) return [];

    try {
      const response = await fetch(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(currentBvid)}`,
        { credentials: "same-origin" }
      );
      if (response.ok) {
        const payload = await response.json();
        const data = payload?.data;
        const sections = Array.isArray(data?.ugc_season?.sections)
          ? data.ugc_season.sections
          : [];
        const currentSection = sections.find((section) =>
          section.episodes?.some(
            (episode) =>
              (episode.bvid || episode.arc?.bvid)?.toLowerCase() ===
              currentBvid.toLowerCase()
          )
        );
        const collectionItems = currentSection?.episodes?.flatMap(getEpisodeItems);
        if (collectionItems?.length > 1) {
          return normalizeBatchItems(collectionItems);
        }

        const pageItems = (Array.isArray(data?.pages) ? data.pages : []).map(
          (page, index) => ({
            bvid: data.bvid || currentBvid,
            page: Number(page.page) || index + 1,
            title: page.part
          })
        );
        if (pageItems.length > 1) return normalizeBatchItems(pageItems);
      }
    } catch {
      // Fall back to the list already rendered by Bilibili.
    }

    return getBatchItemsFromDocument();
  }

  function render() {
    const state = getState();
    setNativeListsHidden(Boolean(state));
    if (!state) {
      restoreNativeHeader();
      return;
    }

    renderPanel(state);
    attachPlayerListener();
  }

  async function start() {
    await loadSavedPlayMode();
    render();
    pageObserver = new MutationObserver(() => {
      if (!getState()) return;
      attachPlayerListener();
      if (!host?.isConnected) render();
    });
    pageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  async function handleLocationChange() {
    await loadSavedPlayMode();
    render();
  }

  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("popstate", handleLocationChange);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const change = changes[PLAY_MODES_STORAGE_KEY];
    const nextMode = change?.newValue?.[currentPlaylistId];
    if (areaName !== "local" || !PLAY_MODES.has(nextMode)) return;
    if (savedPlayMode === nextMode) return;
    savedPlayMode = nextMode;
    render();
  });
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === "get-current-video-title") {
      sendResponse({ title: getNativeListItemTitle() });
      return;
    }
    if (request?.type === "get-current-video-context") {
      getBatchItems()
        .then((items) => {
          sendResponse({ title: getNativeListItemTitle(), items });
        })
        .catch(() => {
          sendResponse({ title: getNativeListItemTitle(), items: [] });
        });
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
