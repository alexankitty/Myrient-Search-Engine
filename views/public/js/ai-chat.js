// AI Chat functionality
class AIChat {
  constructor() {
    this.modal = document.getElementById('aiChatModal');
    this.button = document.getElementById('aiChatButton');
    this.closeBtn = document.getElementById('aiChatClose');
    this.messagesContainer = document.getElementById('aiChatMessages');
    this.input = document.getElementById('aiChatInput');
    this.sendBtn = document.getElementById('aiChatSend');
    this.emptyState = document.getElementById('aiChatEmptyState');

    this.isOpen = false;
    this.isTyping = false;
    this.hasMessages = false;

    // Initialize translations
    this.translations = window.aiChatTranslations || {
      typing_indicator: 'AI is thinking',
      error: {
        network: 'Unable to connect to the AI service. Please check your internet connection and try again.',
        generic: 'Sorry, I\'m having trouble connecting right now. Please try again later.'
      }
    };

    this.initializeEventListeners();
    this.adjustInputHeight();
    this.configureMarkdown();
  }

  configureMarkdown() {
    // Configure marked.js options for security and rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true, // GitHub Flavored Markdown
        sanitize: false, // We'll handle sanitization manually if needed
        smartypants: true, // Use smart quotes
        xhtml: false,
        headerIds: false, // Disable header IDs for security
        mangle: false // Don't mangle email addresses
      });

      // Custom renderer for better styling
      const renderer = new marked.Renderer();

      // Custom code rendering
      renderer.code = function(code, language) {
        const validLang = language && language.match(/^[a-zA-Z0-9_+-]*$/);
        const langClass = validLang ? ` class="language-${language}"` : '';
        const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<pre><code${langClass}>${escapedCode}</code></pre>`;
      };

      // Custom link rendering with security
      renderer.link = function(href, title, text) {
        const escapedHref = href.replace(/"/g, '&quot;');
        const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
        return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
      };

      // Custom list item rendering for task lists
      renderer.listitem = function(text) {
        // Check if this is a task list item
        const taskListMatch = text.match(/^<p>\s*\[([ xX])\]\s*(.*)<\/p>$/);
        if (taskListMatch) {
          const checked = taskListMatch[1] !== ' ' ? 'checked' : '';
          const content = taskListMatch[2];
          return `<li class="task-list-item"><input type="checkbox" disabled ${checked}> ${content}</li>`;
        }
        // Regular task list without <p> wrapper
        const simpleTaskMatch = text.match(/^\[([ xX])\]\s*(.*)$/);
        if (simpleTaskMatch) {
          const checked = simpleTaskMatch[1] !== ' ' ? 'checked' : '';
          const content = simpleTaskMatch[2];
          return `<li class="task-list-item"><input type="checkbox" disabled ${checked}> ${content}</li>`;
        }
        return `<li>${text}</li>`;
      };

      marked.use({ renderer });
    }
  }

  initializeEventListeners() {
    // Toggle modal
    this.button.addEventListener('click', () => this.toggleModal());
    this.closeBtn.addEventListener('click', () => this.closeModal());

    // Send message
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Handle input events
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

        this.input.addEventListener('input', () => this.adjustInputHeight());

    // Handle suggestion pills
    this.initializeSuggestionPills();

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.modal.contains(e.target) && !this.button.contains(e.target)) {
        if (this.isOpen) {
          this.closeModal();
        }
      }
    });
  }

  toggleModal() {
    if (this.isOpen) {
      this.closeModal();
    } else {
      this.openModal();
    }
  }

  openModal() {
    this.modal.classList.add('show');
    this.isOpen = true;
    // Focus input when modal opens
    setTimeout(() => this.input.focus(), 100);
  }

  closeModal() {
    this.modal.classList.remove('show');
    this.isOpen = false;
  }

  adjustInputHeight() {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 80) + 'px';
  }

  initializeSuggestionPills() {
    const suggestionPills = document.querySelectorAll('.ai-suggestion-pill');
    suggestionPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const suggestion = pill.getAttribute('data-suggestion');
        if (suggestion) {
          this.input.value = suggestion;
          this.adjustInputHeight();
          this.sendMessage();
        }
      });
    });
  }

  hideEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
      this.hasMessages = true;
    }
  }

    async sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.isTyping) return;

    // Hide empty state on first message
    if (!this.hasMessages) {
      this.hideEmptyState();
    }

    // Add user message
    this.addMessage(message, 'user');
    this.input.value = '';
    this.adjustInputHeight();

    // Disable send button and show typing indicator
    this.setSending(true);
    this.showTypingIndicator();

    try {
      // Send to backend
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Remove typing indicator and add AI response
      this.hideTypingIndicator();
      this.addMessage(data.response, 'ai');

    } catch (error) {
      console.error('AI Chat Error:', error);
      this.hideTypingIndicator();

      let errorMessage = error.message;

      // Handle different types of errors
      if (error.message.includes('Failed to fetch')) {
        errorMessage = this.translations.error.network;
      } else if (!error.message.includes('HTTP error')) {
        // Use backend error message if available, otherwise use generic message
        errorMessage = error.message || this.translations.error.generic;
      }

      this.addMessage(errorMessage, 'ai');
    } finally {
      this.setSending(false);
    }
  }

  addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chat-message ${sender}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
      <div class="ai-message-bubble ${sender}">${this.formatMessage(content)}</div>
      <small class="ai-message-time">${time}</small>
    `;

    this.messagesContainer.appendChild(messageDiv);
  }

  formatMessage(message) {
    // Use marked.js for full markdown parsing if available
    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(message);
      } catch (error) {
        console.warn('Markdown parsing error:', error);
        // Fallback to basic formatting
        return this.formatMessageBasic(message);
      }
    } else {
      // Fallback to basic formatting if marked.js not available
      return this.formatMessageBasic(message);
    }
  }

  formatMessageBasic(message) {
    // Basic formatting fallback
    return message
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  showTypingIndicator() {
    if (this.isTyping) return;

    this.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-chat-message ai';
    typingDiv.id = 'typingIndicator';

    typingDiv.innerHTML = `
      <div class="ai-typing-indicator">
        <span>${this.translations.typing_indicator}</span>
        <div class="ai-typing-dots">
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(typingDiv);
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  setSending(sending) {
    this.sendBtn.disabled = sending;
    this.input.disabled = sending;
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 100);
  }
}

// Initialize AI Chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if AI chat elements exist
  if (document.getElementById('aiChatModal')) {
    new AIChat();
  }
});
