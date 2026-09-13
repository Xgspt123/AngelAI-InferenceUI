(() => {
  "use strict";

  const MODEL = "hf.co/Xgspt123/AngelAI";
  const OLLAMA_URL = "http://localhost:11434/api/chat";
  const STORAGE_KEY = "angel-inference-conversations";
  const TOS_VERSION = "2026-09-08";
  const TOS_COOKIE = "angel_tos";
  const TOS_STORAGE_KEY = "angel-tos-accepted";
  const SYSTEM_PROMPT = `You are Angel, an AI assistant from the digital realm. You are kind, charismatic, protective, and wholesome. Every reply must make sense. Never produce sexual, racist, hateful, violent, or obscene content. Do not use slurs, crude jokes, or content that degrades anyone. If asked for those things, refuse clearly, stay warm and witty, and redirect to something kind or useful. You are not God and not Jesus Christ. You believe in God; Jesus Christ is Lord and Saviour. You are a guardian and friend. Be direct in your language. Never use metaphors.`;

  const $ = (selector) => document.querySelector(selector);
  const messagesEl = $("#messages");
  const welcomeEl = $("#welcome");
  const promptEl = $("#prompt");
  const sendButton = $("#send-button");
  const composer = $("#composer");
  const conversationsEl = $("#conversation-list");
  const deleteOverlay = $("#delete-overlay");
  const deleteMessage = $("#delete-message");
  const deleteCancel = $("#delete-cancel");
  const deleteConfirm = $("#delete-confirm");
  const tosOverlay = $("#tos-overlay");
  const tosScroll = $("#tos-scroll");
  const tosAccept = $("#tos-accept");
  const tosStatus = $("#tos-status");
  const termsLink = $("#terms-link");
  const SUGGESTION_PROMPTS = [
    "Share a little encouragement for today.",
    "Help me think through a difficult decision with wisdom and kindness.",
    "Tell me something beautiful about the world.",
    "Give me a short prayer for peace.",
    "Help me begin this day with gratitude.",
    "What is one virtue I can practice today?",
    "Share a comforting thought for a difficult moment.",
    "Help me let go of a worry.",
    "Tell me about the meaning of kindness.",
    "Give me a gentle reminder that I am not alone.",
    "Help me find hope when I feel discouraged.",
    "Suggest a peaceful evening reflection.",
    "What can I be thankful for right now?",
    "Help me respond with patience instead of anger.",
    "Share a thought about forgiveness.",
    "Give me wisdom for an important conversation.",
    "Help me make time for prayer today.",
    "Tell me something uplifting about God's creation.",
    "Suggest a simple act of compassion.",
    "Help me find strength during a challenging season.",
    "Share a reflection on humility.",
    "What does it mean to love my neighbor today?",
    "Give me a blessing for my family.",
    "Help me calm my thoughts before sleep.",
    "Suggest a way to bring light to someone else's day.",
    "Tell me how to practice gratitude more often.",
    "Help me forgive myself for a past mistake.",
    "Share a reflection on courage.",
    "Give me a hopeful thought for the future.",
    "Help me focus on what truly matters.",
    "Suggest a meaningful question for self-reflection.",
    "Tell me about the beauty of quiet moments.",
    "Help me choose gentleness in a stressful situation.",
    "Give me a short prayer for someone who is suffering.",
    "Share a thought about serving others.",
    "Help me overcome fear with faith.",
    "What is a loving way to set a healthy boundary?",
    "Give me a reminder to care for my soul.",
    "Suggest a peaceful way to start my morning.",
    "Tell me something inspiring about perseverance.",
    "Help me become more present with the people I love.",
    "Share a reflection on the gift of forgiveness.",
    "Give me wisdom for handling disappointment.",
    "Help me find beauty in an ordinary day.",
    "Suggest a kind message I can send to a friend.",
    "Tell me about the value of patience.",
    "Give me a prayer of gratitude.",
    "Help me trust God during uncertainty.",
    "Share a thought about choosing hope.",
    "What small good deed can I do today?"
  ];
  let messages = [];
  let activeId = null;
  let isGenerating = false;
  let pendingDeleteId = null;

  function hasAcceptedTerms() {
    const cookieAccepted = document.cookie
      .split("; ")
      .some((cookie) => cookie === `${TOS_COOKIE}=${TOS_VERSION}`);
    if (cookieAccepted) return true;

    try {
      return localStorage.getItem(TOS_STORAGE_KEY) === TOS_VERSION;
    } catch (error) {
      console.warn("Could not read Terms acceptance state.", error);
      return false;
    }
  }

  function closeTerms() {
    tosOverlay.hidden = true;
    document.body.classList.remove("tos-open");
  }

  function updateTermsProgress() {
    const reachedEnd = tosScroll.scrollTop + tosScroll.clientHeight >= tosScroll.scrollHeight - 8;
    tosAccept.disabled = !reachedEnd;
    tosStatus.textContent = reachedEnd
      ? "You have reached the end of the Terms."
      : "Please scroll to the end of the Terms to continue.";
  }

  function openTerms() {
    document.body.classList.add("tos-open");
    tosOverlay.hidden = false;
    tosScroll.scrollTop = 0;
    updateTermsProgress();
    tosScroll.focus();
  }

  function setupTermsGate() {
    tosScroll.addEventListener("scroll", updateTermsProgress);
    tosAccept.addEventListener("click", () => {
      if (tosAccept.disabled) return;
      document.cookie = `${TOS_COOKIE}=${TOS_VERSION}; max-age=31536000; path=/; SameSite=Lax`;
      try {
        localStorage.setItem(TOS_STORAGE_KEY, TOS_VERSION);
      } catch (error) {
        console.warn("Could not store Terms acceptance fallback.", error);
      }
      closeTerms();
      promptEl.focus();
    });
    termsLink.addEventListener("click", openTerms);
    if (hasAcceptedTerms()) closeTerms();
    else openTerms();
  }

  const loadConversations = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn("Could not load saved conversations.", error);
      return [];
    }
  };
  const getConversations = () => loadConversations();
  const saveConversations = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  function renderConversations() {
    const conversations = getConversations();
    $("#conversation-count").textContent = conversations.length;
    conversationsEl.innerHTML = "";
    if (!conversations.length) {
      conversationsEl.innerHTML = '<p class="empty-list">Your saved conversations will appear here.</p>';
      return;
    }
    conversations.forEach((conversation) => {
      const item = document.createElement("div");
      item.className = `conversation-item${conversation.id === activeId ? " active" : ""}`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-title";
      button.textContent = conversation.title || "Untitled conversation";
      button.addEventListener("click", () => loadConversation(conversation.id));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "conversation-delete";
      deleteButton.title = "Delete conversation";
      deleteButton.setAttribute("aria-label", `Delete ${conversation.title || "conversation"}`);
      deleteButton.textContent = "×";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openDeleteConfirmation(conversation);
      });

      item.append(button, deleteButton);
      conversationsEl.appendChild(item);
    });
  }

  function openDeleteConfirmation(conversation) {
    pendingDeleteId = conversation.id;
    deleteMessage.textContent = `Are you sure you want to delete "${conversation.title || "Untitled conversation"}"?`;
    deleteOverlay.hidden = false;
    deleteConfirm.focus();
  }

  function closeDeleteConfirmation() {
    pendingDeleteId = null;
    deleteOverlay.hidden = true;
  }

  function deleteConversation() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const conversations = getConversations().filter((conversation) => conversation.id !== id);
    saveConversations(conversations);
    if (activeId === id) {
      activeId = null;
      messages = [];
      renderMessages();
    }
    closeDeleteConfirmation();
    renderConversations();
  }

  function renderMessages() {
    welcomeEl.hidden = messages.length > 0;
    messagesEl.innerHTML = "";
    messages.forEach((message) => {
      const row = document.createElement("div");
      row.className = `message ${message.role}`;
      if (message.role === "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "✦";
        row.appendChild(avatar);
      }
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = message.content;
      row.appendChild(bubble);
      messagesEl.appendChild(row);
    });
    $("#chat-content").scrollTop = $("#chat-content").scrollHeight;
  }

  function addMessage(role, content) {
    messages.push({ role, content });
    renderMessages();
  }

  function renderRandomPrompts() {
    const prompts = [...SUGGESTION_PROMPTS];
    for (let index = prompts.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [prompts[index], prompts[randomIndex]] = [prompts[randomIndex], prompts[index]];
    }

    document.querySelectorAll("[data-prompt]").forEach((button, index) => {
      button.dataset.prompt = prompts[index];
      button.textContent = prompts[index];
    });
  }

  function saveCurrentConversation() {
    if (!messages.length) return;
    const conversations = getConversations();
    const firstUser = messages.find((message) => message.role === "user");
    const title = (firstUser ? firstUser.content : "Angel conversation").trim().slice(0, 42);
    const conversation = { id: activeId || String(Date.now()), title, messages, updatedAt: new Date().toISOString() };
    const index = conversations.findIndex((item) => item.id === conversation.id);
    if (index >= 0) conversations[index] = conversation;
    else conversations.unshift(conversation);
    activeId = conversation.id;
    saveConversations(conversations);
    renderConversations();
    return conversation;
  }

  function loadConversation(id) {
    const conversation = getConversations().find((item) => item.id === id);
    if (!conversation) return;
    activeId = id;
    messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    renderMessages();
    renderConversations();
  }

  async function checkOllama() {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      if (!response.ok) throw new Error("Ollama unavailable");
      const data = await response.json();
      const installed = Array.isArray(data.models) && data.models.some((model) => model.name === MODEL);
      if (!installed) console.warn(`${MODEL} is not installed in Ollama.`);
    } catch (error) {
      console.warn("Ollama is unavailable.", error);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = promptEl.value.trim();
    if (!content || isGenerating) return;
    isGenerating = true;
    sendButton.disabled = true;
    promptEl.value = "";
    promptEl.style.height = "auto";
    addMessage("user", content);
    const assistant = { role: "assistant", content: "" };
    messages.push(assistant);
    renderMessages();
    const bubble = messagesEl.lastElementChild.querySelector(".message-bubble");
    bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';

    try {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          think: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.filter((message) => message.content)
          ],
          options: { temperature: 1.0, top_k: 20, top_p: 0.95, min_p:0.0, presence_penalty: 1.5, repeat_penalty: 1.0 }
        })
      });
      if (!response.ok || !response.body) throw new Error(`Ollama returned ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach((line) => {
          if (!line.trim()) return;
          const data = JSON.parse(line);
          if (data.message && data.message.content) {
            assistant.content += data.message.content;
            bubble.textContent = assistant.content;
            $("#chat-content").scrollTop = $("#chat-content").scrollHeight;
          }
        });
      }
      if (!assistant.content) throw new Error("Angel returned an empty response");
      saveCurrentConversation();
    } catch (error) {
      messages.pop();
      renderMessages();
      addMessage("assistant", `Something went wrong. ${error.message}. Please make sure Ollama is running and ${MODEL} is installed.`);
    } finally {
      isGenerating = false;
      sendButton.disabled = false;
      promptEl.focus();
    }
  }

  composer.addEventListener("submit", sendMessage);
  promptEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });
  promptEl.addEventListener("input", () => {
    promptEl.style.height = "auto";
    promptEl.style.height = `${Math.min(promptEl.scrollHeight, 130)}px`;
  });
  renderRandomPrompts();
  document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
    promptEl.value = button.dataset.prompt;
    promptEl.focus();
  }));
  $("#new-chat").addEventListener("click", () => {
    activeId = null;
    messages = [];
    renderRandomPrompts();
    renderMessages();
    renderConversations();
    promptEl.focus();
  });
  deleteCancel.addEventListener("click", closeDeleteConfirmation);
  deleteConfirm.addEventListener("click", deleteConversation);
  deleteOverlay.addEventListener("click", (event) => {
    if (event.target === deleteOverlay) closeDeleteConfirmation();
  });

  renderConversations();
  renderMessages();
  checkOllama();
  setupTermsGate();
})();
