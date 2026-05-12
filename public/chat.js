// chat.js — GovBB NIS help chatbot dialog.
//
// Public API (attached to window):
//   wireHelpButton(triggerEl, opts)   — bind a click handler
//   openHelpDialog(opts)              — open the dialog directly
//
// opts:
//   { claim?, claimKey? }
//   When `claim` is present, the starter pills adapt to the claim and a
//   `context` payload is sent with each /api/chat call so the AI can speak
//   to the user's actual situation.

(function () {
  const STYLE_ID = "govbb-chat-styles";

  const STYLES = `
    html:has(dialog[open]) { overflow: hidden; }

    .resolve-dialog {
      border: 0;
      border-radius: var(--radius-sm);
      padding: 0;
      max-width: 36rem;
      width: calc(100% - 2rem);
      max-height: calc(100vh - 2rem);
      background: var(--color-background);
      color: var(--color-text);
      inset: 0;
      margin: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .resolve-dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
    .resolve-dialog__form {
      display: flex; flex-direction: column;
      min-height: 0; flex: 1 1 auto;
    }
    .resolve-dialog__header {
      padding: var(--spacing-s) var(--spacing-m);
      border-bottom: 1px solid var(--color-grey-00);
      display: flex; flex-direction: column;
      gap: var(--spacing-xxs); flex-shrink: 0;
    }
    .resolve-dialog__body {
      padding: var(--spacing-m);
      display: flex; flex-direction: column; gap: var(--spacing-s);
      overflow-y: auto; flex: 1 1 auto;
    }
    .resolve-dialog__footer {
      padding: var(--spacing-xs) var(--spacing-m);
      border-top: 1px solid var(--color-grey-00);
      display: flex; gap: var(--spacing-s);
      justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0;
    }

    .chat { display: flex; flex-direction: column; gap: var(--spacing-s); }
    .chat__messages { display: flex; flex-direction: column; gap: var(--spacing-xs); }
    .chat__msg {
      max-width: 85%;
      padding: var(--spacing-xs) var(--spacing-s);
      border-radius: var(--radius-sm);
      line-height: 1.45;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .chat__msg--bot { align-self: flex-start; background: var(--color-blue-10); color: var(--color-text); }
    .chat__msg--user { align-self: flex-end; background: var(--color-teal-10); color: var(--color-text); }
    .chat__msg--error {
      align-self: flex-start; background: var(--color-red-10);
      color: var(--color-error); border: 1px solid var(--color-red-00);
    }
    @keyframes chat-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .chat__msg { animation: chat-fade-in 0.25s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .chat__msg { animation: none; }
    }
    .chat__msg p { margin: 0 0 var(--spacing-xs) 0; }
    .chat__msg p:last-child { margin-bottom: 0; }
    .chat__msg ul, .chat__msg ol {
      margin: var(--spacing-xxs) 0;
      padding-left: var(--spacing-m);
    }
    .chat__msg li { margin-bottom: var(--spacing-xxs); }
    .chat__msg li:last-child { margin-bottom: 0; }
    .chat__msg h3, .chat__msg h4 {
      margin: var(--spacing-xs) 0 var(--spacing-xxs) 0;
      font-size: inherit;
      font-weight: var(--font-weight-bold);
    }
    .chat__msg h3:first-child, .chat__msg h4:first-child { margin-top: 0; }
    .chat__msg code {
      background: rgba(0, 0, 0, 0.06);
      padding: 0.1em 0.3em;
      border-radius: 0.2em;
      font-size: 0.95em;
    }
    .chat__msg a {
      color: var(--color-teal-00);
      text-decoration: underline;
    }
    .chat__typing {
      align-self: flex-start;
      display: inline-flex; gap: 4px; align-items: center;
      padding: var(--spacing-xs) var(--spacing-s);
      background: var(--color-blue-10);
      border-radius: var(--radius-sm);
    }
    .chat__typing-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-text-muted);
      animation: chat-bounce 1.4s infinite ease-in-out;
    }
    .chat__typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .chat__typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes chat-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%           { transform: translateY(-4px); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .chat__typing-dot { animation: none; opacity: 0.6; }
    }

    .chat__pills { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
    .chat__pill {
      font-family: inherit;
      font-size: var(--font-size-caption);
      font-weight: var(--font-weight-bold);
      background: var(--color-background);
      border: 1px solid var(--color-teal-00);
      color: var(--color-teal-00);
      padding: var(--spacing-xxs) var(--spacing-s);
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    .chat__pill:hover:not(:disabled) {
      background: var(--color-teal-00);
      color: var(--color-white-00);
    }
    .chat__pill:disabled { opacity: 0.5; cursor: not-allowed; }

    .chat__input-row {
      display: flex; gap: var(--spacing-xs); align-items: stretch;
    }
    .chat__input-row .govbb-input-wrapper { flex: 1 1 auto; }
    .chat__input-row .govbb-input-wrapper > input { padding: var(--spacing-xs) var(--spacing-s); }
    .chat__input-row .govbb-btn {
      padding: var(--spacing-xs) var(--spacing-s);
      font-size: var(--font-size-caption);
      line-height: 1.4;
    }
    .chat__disclaimer {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      font-style: italic;
      margin: 0;
    }

    .chat__header { padding-right: 3rem; }
    .chat__title {
      display: flex; flex-direction: column;
      gap: var(--spacing-xxs); min-width: 0;
    }
    .chat__close {
      position: absolute;
      top: var(--spacing-xs); right: var(--spacing-xs);
      z-index: 1;
      background: none; border: 0; cursor: pointer;
      font-size: 1.5rem; line-height: 1;
      width: 2rem; height: 2rem;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--color-text);
      border-radius: var(--radius-sm);
    }
    .chat__close:hover { background: var(--color-grey-00); }
    .chat__close:focus-visible {
      outline: 2px solid var(--color-teal-100);
      outline-offset: 2px;
    }
    .chat__footer {
      flex-direction: column;
      align-items: stretch;
      justify-content: stretch;
      gap: var(--spacing-xs);
    }
    .chat__footer .chat__input-row { width: 100%; }
  `;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = STYLES;
    document.head.appendChild(tag);
  }

  const HELP_PILLS_GENERAL = [
    "Am I eligible for an NIS benefit?",
    "How is my benefit calculated?",
    "How do waiting days work?",
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // Minimal markdown renderer. Escapes the input first, then applies inline
  // and block transforms. Handles bold, italic, inline code, http(s) links,
  // unordered/ordered lists, headings, and paragraph breaks. Not a full
  // CommonMark implementation — just the bits Claude tends to use.
  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Inline transforms.
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    // Italic: single * or _ not adjacent to another * / _
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Block-level pass.
    const lines = html.split("\n");
    const out = [];
    let para = [];
    let listType = null;

    function flushPara() {
      if (para.length) {
        out.push("<p>" + para.join("<br>") + "</p>");
        para = [];
      }
    }
    function closeList() {
      if (listType) {
        out.push("</" + listType + ">");
        listType = null;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) { flushPara(); closeList(); continue; }

      const h = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      if (h) {
        flushPara();
        closeList();
        const level = Math.min(6, h[1].length + 2);
        out.push("<h" + level + ">" + h[2] + "</h" + level + ">");
        continue;
      }
      const u = /^[-*]\s+(.+)$/.exec(trimmed);
      if (u) {
        flushPara();
        if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
        out.push("<li>" + u[1] + "</li>");
        continue;
      }
      const o = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (o) {
        flushPara();
        if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
        out.push("<li>" + o[1] + "</li>");
        continue;
      }

      closeList();
      para.push(trimmed);
    }
    flushPara();
    closeList();

    return out.join("\n");
  }

  function pillsForClaim(claim) {
    if (!claim) return HELP_PILLS_GENERAL.slice();

    const paid = claim.stages.every(function (s) { return s.status === "complete"; });
    const hasOutstanding = (claim.outstanding || []).some(function (i) { return !i.resolved; });

    if (paid) {
      return [
        "Why did I receive this amount?",
        "Can I claim again later?",
      ];
    }
    if (hasOutstanding) {
      return [
        "What do I need to do next?",
        "Why is my claim delayed?",
        "How was my amount calculated?",
      ];
    }
    return [
      "What does my current stage mean?",
      "When will I receive payment?",
      "How was my amount calculated?",
    ];
  }

  // Build a compact JSON-friendly claim context for the AI.
  // Uses claims.js helpers when available; falls back to local computation.
  function buildClaimContext(claim, claimKey) {
    if (!claim) return null;
    const stages = claim.stages || [];
    const stage =
      (typeof currentStage === "function" && currentStage(claim)) ||
      stages.find(function (s) { return s.status === "current"; }) ||
      stages[stages.length - 1];
    const paid = typeof isPaid === "function"
      ? isPaid(claim)
      : stages.every(function (s) { return s.status === "complete"; });
    const ref = typeof today === "function" ? today() : new Date();
    const delayDays = typeof totalDelayDays === "function" ? totalDelayDays(claim, ref) : 0;

    const ctx = {
      trackingNumber: claimKey || null,
      applicant: claim.applicant,
      benefit: claim.type,
      submitted: claim.submitted,
      currentStage: stage ? stage.name : null,
      paid: paid,
      daysBehindSchedule: delayDays,
      outstandingIssues: (claim.outstanding || []).map(function (i) {
        return { title: i.title, type: i.type, resolved: !!i.resolved };
      }),
    };

    if (claim.payout) {
      const meta = typeof payoutMeta === "function" ? payoutMeta(claim) : null;
      const weekly = typeof avgWeeklyEarnings === "function" ? avgWeeklyEarnings(claim.payout) : null;
      const weeklyBenefit = typeof payoutWeekly === "function" ? payoutWeekly(claim) : null;
      const total = typeof payoutTotal === "function" ? payoutTotal(claim) : null;
      ctx.payout = {
        quarterlyEarnings: claim.payout.quarterlyEarnings,
        averageWeeklyEarnings: weekly,
        rateLabel: meta ? meta.rateLabel : null,
        weeklyBenefit: weeklyBenefit,
        durationWeeks: claim.payout.durationWeeks,
        estimatedTotal: paid ? null : total,
        totalPaid: paid ? total : null,
      };
    }

    return ctx;
  }

  function openHelpDialog(opts) {
    injectStyles();
    opts = opts || {};
    const claim = opts.claim || null;
    const claimKey = opts.claimKey || null;
    const pills = pillsForClaim(claim);
    const context = buildClaimContext(claim, claimKey);

    const captionText = claimKey ? "Claim " + claimKey : "NIS help";

    const dialog = document.createElement("dialog");
    dialog.className = "resolve-dialog";
    dialog.setAttribute("aria-labelledby", "help-title");
    dialog.innerHTML =
      '<form class="resolve-dialog__form" id="chat-form">' +
      '  <header class="resolve-dialog__header chat__header">' +
      '    <div class="chat__title">' +
      '      <span class="govbb-text-caption" style="color: var(--color-text-muted);">' +
              escapeHtml(captionText) + "</span>" +
      '      <h2 class="govbb-text-h3" id="help-title">How may I help you?</h2>' +
      "    </div>" +
      '    <button type="button" class="chat__close" data-cancel aria-label="Close">&times;</button>' +
      "  </header>" +
      '  <div class="resolve-dialog__body chat">' +
      '    <div class="chat__messages" id="chat-messages" aria-live="polite" aria-atomic="false"></div>' +
      '    <div class="chat__pills" id="chat-pills"></div>' +
      "  </div>" +
      '  <footer class="resolve-dialog__footer chat__footer">' +
      '    <div class="chat__input-row">' +
      '      <div class="govbb-input-wrapper">' +
      '        <input class="govbb-input" type="text" id="chat-input" name="message" autocomplete="off"' +
      '          placeholder="Type your question..." aria-label="Type your question" />' +
      "      </div>" +
      '      <button type="submit" class="govbb-btn" id="chat-send">Send</button>' +
      "    </div>" +
      '    <p class="chat__disclaimer">Answers are based on information from nis.gov.bb. For your specific case, contact the NIS office.</p>' +
      "  </footer>" +
      "</form>";

    document.body.appendChild(dialog);

    const messagesEl = dialog.querySelector("#chat-messages");
    const pillsEl = dialog.querySelector("#chat-pills");
    const input = dialog.querySelector("#chat-input");
    const sendBtn = dialog.querySelector("#chat-send");
    const form = dialog.querySelector("#chat-form");
    const history = [];
    let busy = false;

    function addMessage(role, text, variant) {
      const div = document.createElement("div");
      div.className = "chat__msg chat__msg--" + (variant || role);
      if (role === "bot" && !variant) {
        // Bot replies are markdown; render as HTML.
        div.innerHTML = renderMarkdown(text);
      } else {
        // User input and errors are plain text.
        div.textContent = text;
      }
      messagesEl.appendChild(div);
      messagesEl.scrollIntoView({ block: "end" });
      return div;
    }

    function renderPills() {
      pillsEl.innerHTML = "";
      pills.forEach(function (label) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat__pill";
        btn.textContent = label;
        btn.addEventListener("click", function () { if (!busy) send(label); });
        pillsEl.appendChild(btn);
      });
    }

    function setBusy(value) {
      busy = value;
      input.disabled = value;
      sendBtn.disabled = value;
      pillsEl.querySelectorAll("button").forEach(function (b) { b.disabled = value; });
    }

    function showTyping() {
      const div = document.createElement("div");
      div.className = "chat__typing";
      div.id = "chat-typing";
      div.setAttribute("role", "status");
      div.setAttribute("aria-label", "Assistant is typing");
      div.innerHTML =
        '<span class="chat__typing-dot"></span>' +
        '<span class="chat__typing-dot"></span>' +
        '<span class="chat__typing-dot"></span>';
      messagesEl.appendChild(div);
      messagesEl.scrollIntoView({ block: "end" });
    }
    function hideTyping() {
      const el = messagesEl.querySelector("#chat-typing");
      if (el) el.remove();
    }

    async function send(userText) {
      addMessage("user", userText);
      pillsEl.hidden = true;
      input.value = "";
      setBusy(true);
      showTyping();
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: history, userMessage: userText, context: context }),
        });
        const data = await r.json().catch(function () { return null; });
        hideTyping();
        if (!r.ok || !data) {
          addMessage("error", "Sorry — I couldn't reach the assistant. " +
            ((data && data.error) || "Please try again."), "error");
          return;
        }
        if (data.type === "fallback") {
          addMessage("bot",
            "The AI assistant isn't configured yet. Set ANTHROPIC_API_KEY in a .env file and restart the server."
          );
          return;
        }
        const replyText = data.text || "I don't have an answer for that. Please contact the NIS office directly.";
        history.push({ role: "user", content: userText });
        history.push({ role: "assistant", content: replyText });
        addMessage("bot", replyText);
      } catch (err) {
        hideTyping();
        addMessage("error", "Network error: " + err.message, "error");
      } finally {
        setBusy(false);
        input.focus();
      }
    }

    renderPills();
    addMessage("bot", claim
      ? "Hi! I can answer questions about your " + claim.type.toLowerCase() +
        " claim, or anything else about NIS benefits. Pick a topic below or type your own."
      : "Hi! I can answer questions about NIS benefits based on nis.gov.bb. Pick a topic below or type your own.");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || busy) return;
      send(text);
    });

    dialog.querySelector("[data-cancel]").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () { dialog.remove(); });
    dialog.showModal();
    input.focus();
  }

  function wireHelpButton(trigger, opts) {
    if (!trigger) return;
    injectStyles();
    trigger.addEventListener("click", function () { openHelpDialog(opts || {}); });
  }

  injectStyles();
  window.openHelpDialog = openHelpDialog;
  window.wireHelpButton = wireHelpButton;
})();
