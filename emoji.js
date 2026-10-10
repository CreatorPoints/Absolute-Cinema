/**
 * Absolute Cinema - Slack Emoji Parser
 * Translates :emoji_code: into Unicode emojis and custom Hack Club Slack emojis.
 */

(function () {
  // 1. Instant fallback dictionary for instant render without network delay
  const coreEmojis = {
    "fire-anim": "assets/emojis/fire-anim.gif",
    "hackclub": "assets/emojis/hackclub.png",
    "orpheus": "assets/emojis/orpheus.png",
    "siren": "🚨",
    "rotating_light": "🚨",
    "fire": "🔥",
    "skull": "💀",
    "clapper": "🎬",
    "movie_camera": "🎥",
    "film_strip": "🎞️",
    "tada": "🎉",
    "sparkles": "✨",
    "rocket": "🚀",
    "eyes": "👀",
    "heart": "❤️",
    "star": "⭐",
    "100": "💯",
    "wave": "👋",
    "boom": "💥",
    "zap": "⚡",
    "check": "✅",
    "x": "❌",
    "+1": "👍",
    "-1": "👎",
    "tv": "📺",
    "art": "🎨",
    "popcorn": "🍿",
    "ticket": "🎫",
    "smile": "😄",
    "joy": "😂",
    "thinking_face": "🤔",
    "thinking": "🤔",
    "construction": "🚧",
    "anichips": "🪙",
    "chips": "🪙"
  };

  // Full dictionary merged dynamically
  let emojiDict = { ...coreEmojis };
  let isReady = false;

  // Inject default emoji styles if not already present
  function injectStyles() {
    if (document.getElementById("slack-emoji-styles")) return;
    const style = document.createElement("style");
    style.id = "slack-emoji-styles";
    style.textContent = `
      .slack-emoji {
        display: inline-block;
        height: 1.25em;
        width: 1.25em;
        vertical-align: -0.22em;
        object-fit: contain;
        margin: 0 0.05em;
      }
    `;
    document.head.appendChild(style);
  }

  // Resolve emoji code
  function resolveEmoji(code) {
    const key = code.toLowerCase();
    let val = emojiDict[key];
    if (!val) return null;

    // Resolve Slack alias (e.g. "alias:fire")
    while (typeof val === "string" && val.startsWith("alias:")) {
      const target = val.slice(6).toLowerCase();
      val = emojiDict[target];
      if (!val) return null;
    }

    const isImage =
      typeof val === "string" &&
      (val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("assets/") ||
        val.startsWith("/assets/") ||
        val.startsWith("./assets/") ||
        /\.(png|gif|jpg|jpeg|webp|svg)(\?.*)?$/i.test(val));

    if (isImage) {
      return `<img class="slack-emoji" src="${val}" alt=":${code}:" title=":${code}:" loading="lazy">`;
    }
    return val;
  }

  // HTML String replacer
  function parseSlackEmojis(text) {
    if (!text || typeof text !== "string") return text;
    return text.replace(/:([a-zA-Z0-9_\-+]+):/g, (match, code) => {
      const resolved = resolveEmoji(code);
      return resolved !== null ? resolved : match;
    });
  }

  // Parse text nodes inside a DOM element safely without disrupting HTML tags/listeners
  function renderEmojisInElement(root) {
    if (!root || !root.ownerDocument) return;

    const ignoreTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.includes(":")) {
          return NodeFilter.FILTER_REJECT;
        }
        let parent = node.parentElement;
        while (parent && parent !== root) {
          if (ignoreTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          parent = parent.parentElement;
        }
        if (parent && ignoreTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodesToReplace = [];
    while (walker.nextNode()) {
      nodesToReplace.push(walker.currentNode);
    }

    nodesToReplace.forEach((textNode) => {
      const original = textNode.nodeValue;
      if (!/:([a-zA-Z0-9_\-+]+):/.test(original)) return;

      const replaced = parseSlackEmojis(original);
      if (replaced !== original) {
        const span = document.createElement("span");
        span.className = "slack-emoji-rendered";
        span.innerHTML = replaced;
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(span, textNode);
        }
      }
    });
  }

  function renderDocument() {
    if (document.body) {
      renderEmojisInElement(document.body);
    }
  }

  // Observe dynamically added DOM nodes (e.g. film cards, API updates)
  function initObserver() {
    if (!document.body || window.__slackEmojiObserverInit) return;
    window.__slackEmojiObserverInit = true;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const addedNode of m.addedNodes) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            if (!addedNode.classList.contains("slack-emoji-rendered")) {
              renderEmojisInElement(addedNode);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Load the comprehensive 1,900+ standard Slack emoji database
  async function loadStandardEmojis() {
    try {
      const candidates = [
        "assets/emojis/slack-emojis.json",
        "/assets/emojis/slack-emojis.json",
        "./assets/emojis/slack-emojis.json"
      ];
      for (const path of candidates) {
        try {
          const res = await fetch(path);
          if (res.ok) {
            const data = await res.json();
            emojiDict = { ...data, ...emojiDict };
            renderDocument();
            break;
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Could not load local slack-emojis.json:", e);
    }
  }

  // Fetch live custom emojis from backend if connected to Slack workspace
  async function loadHackClubCustomEmojis() {
    // Check localStorage cache first (1 hour cache)
    const cacheKey = "hc_slack_custom_emojis";
    const cacheTimeKey = "hc_slack_custom_emojis_time";
    const cached = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    if (cached && cachedTime && Date.now() - parseInt(cachedTime, 10) < 3600000) {
      try {
        const parsed = JSON.parse(cached);
        emojiDict = { ...emojiDict, ...parsed };
        renderDocument();
      } catch (_) {}
    }

    try {
      const res = await fetch("https://absolute-cinema-manager.hackclub.app/api/emojis");
      if (res.ok) {
        const customData = await res.json();
        if (customData && typeof customData === "object") {
          emojiDict = { ...emojiDict, ...customData };
          try {
            localStorage.setItem(cacheKey, JSON.stringify(customData));
            localStorage.setItem(cacheTimeKey, Date.now().toString());
          } catch (_) {}
          renderDocument();
        }
      }
    } catch (_) {}
  }

  // Initialize
  function init() {
    injectStyles();
    renderDocument();
    initObserver();
    loadStandardEmojis();
    loadHackClubCustomEmojis();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose globally
  window.parseSlackEmojis = parseSlackEmojis;
  window.renderSlackEmojis = renderEmojisInElement;
  window.registerSlackEmoji = function (code, value) {
    emojiDict[code.toLowerCase()] = value;
    renderDocument();
  };
})();
