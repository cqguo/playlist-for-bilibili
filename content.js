(() => {
  const HOST_ID = "bili-playlist-shadow-host";
  const NATIVE_LIST_STYLE_ID = "bili-playlist-hide-native-lists";
  const MAX_ITEMS = 100;
  let host = null;
  let shadow = null;
  let positionFrame = 0;
  let pageObserver = null;
  let resizeObserver = null;
  let boundVideo = null;
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
      name: params.get("playlist_name") || "我的播放列表",
      items,
      index: matchedIndex >= 0 ? matchedIndex : 0,
      mode: PLAY_MODES.has(params.get("play_mode"))
        ? params.get("play_mode")
        : "loop",
      params
    };
  }

  function buildUrl(state, index) {
    const params = new URLSearchParams(state.params);
    params.set("index", String(index));
    const item = state.items[index];
    const query = item.page ? `?p=${item.page}` : "";
    return `https://www.bilibili.com/video/${item.bvid}/${query}#${params.toString()}`;
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
      #app .right-container .playlist-container,
      #app .right-container .video-sections-content-list,
      #app .right-container .recommend-list-v1,
      #app .right-container .rec-list {
        display: none !important;
      }
    `;
    document.head.append(style);
  }

  function findLayout() {
    const right =
      document.querySelector("#app .right-container") ||
      document.querySelector(".video-container-v1 .right-container") ||
      document.querySelector(".right-container");
    if (!right) return null;

    const anchor =
      right.querySelector("#danmukuBox") ||
      right.querySelector(".danmaku-box") ||
      right.querySelector(".up-panel-container");
    if (!anchor) return null;

    return { right, anchor };
  }

  function createHost() {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.zIndex = "20";
    host.style.margin = "0";
    host.style.padding = "0";
    host.style.pointerEvents = "auto";
    document.body.append(host);

    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host, *, *::before, *::after { box-sizing: border-box; }
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
  }

  function renderPanel(state) {
    if (!host) createHost();
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
    modeSelect.addEventListener("change", () => {
      const params = new URLSearchParams(location.hash.slice(1));
      params.set("play_mode", modeSelect.value);
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}#${params.toString()}`
      );
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

  function attachPlayerListener() {
    const video = document.querySelector("video");
    if (!video || video === boundVideo) return;

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

  function positionHost() {
    positionFrame = 0;
    if (!host) return;

    const layout = findLayout();
    if (!layout) {
      host.style.display = "none";
      return;
    }

    const rightRect = layout.right.getBoundingClientRect();
    const anchorRect = layout.anchor.getBoundingClientRect();
    const top = layout.anchor.classList.contains("up-panel-container")
      ? anchorRect.bottom + 12
      : anchorRect.top;

    host.style.display = "block";
    host.style.left = `${Math.round(rightRect.left)}px`;
    host.style.top = `${Math.round(top)}px`;
    host.style.width = `${Math.round(rightRect.width)}px`;

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(layout.right);
    resizeObserver.observe(layout.anchor);
  }

  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(positionHost);
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

  function render() {
    const state = getState();
    setNativeListsHidden(Boolean(state));
    if (!state) {
      resizeObserver?.disconnect();
      host?.remove();
      host = null;
      shadow = null;
      return;
    }

    renderPanel(state);
    attachPlayerListener();
    schedulePosition();
  }

  function start() {
    render();
    pageObserver = new MutationObserver(() => {
      if (getState()) attachPlayerListener();
      schedulePosition();
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("scroll", schedulePosition, { passive: true });
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type !== "get-current-video-title") return;
    sendResponse({ title: getNativeListItemTitle() });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
