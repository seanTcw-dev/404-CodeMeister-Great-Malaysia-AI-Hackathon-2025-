// Web Speech API voice input (Chrome/Edge)
// Non-invasive: wires into existing #user-input without altering core chat logic

(function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let interimBuffer = '';
  let finalBuffer = '';
  let lastResultTs = 0;
  let silenceTimer = null; // disabled in toggle mode
  const SILENCE_MS = 3000; // unused in toggle mode
  let submittedThisSession = false;
  let stopping = false;

  function $(id) { return document.getElementById(id); }

  function setUiState(active) {
    const startBtn = $('voice-start-btn');
    const stopBtn = $('voice-stop-btn');
    // Keep start button enabled to allow toggle stop on the same button
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = !active;
    if (startBtn) startBtn.classList.toggle('recording', !!active);
    if (stopBtn) stopBtn.classList.toggle('recording', !!active);
    // Visual mic dot indicator
    ensureMicStyles();
    const existingDot = document.querySelector('#voice-start-btn .mic-dot');
    if (startBtn) {
      if (active) {
        if (!existingDot) {
          const dot = document.createElement('span');
          dot.className = 'mic-dot';
          startBtn.appendChild(dot);
        }
      } else {
        if (existingDot) existingDot.remove();
      }
    }
  }

  function ensureRecognition(lang) {
    if (!SpeechRecognition) return null;
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang || (navigator.language || 'en-US');

      recognition.onstart = () => {
        isListening = true;
        setUiState(true);
        // Initialize buffers
        const userInput = $('user-input');
        finalBuffer = (userInput?.value || '').trim();
        interimBuffer = '';
        lastResultTs = Date.now();
        submittedThisSession = false;
        // In toggle mode, do not auto-stop; user will click to stop
      };

      recognition.onend = () => {
        isListening = false;
        stopping = false;
        setUiState(false);
        interimBuffer = '';
        finalBuffer = '';
        submittedThisSession = false;
        stopSilenceWatchdog();
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error:', e);
        isListening = false;
        setUiState(false);
      };

      // Disable auto stop on speech end in toggle mode
      recognition.onspeechend = null;

      recognition.onresult = (event) => {
        const userInput = $('user-input');
        const chatForm = $('chat-form');
        if (!userInput) return;
        lastResultTs = Date.now();
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const raw = res[0]?.transcript || '';
          if (!res.isFinal) {
            interimBuffer = raw;
            // Preview = committed finalBuffer + cleaned interim
            const preview = makePreviewText(finalBuffer, interimBuffer);
            userInput.value = preview;
            userInput.dispatchEvent(new Event('input'));
          } else {
            // Final result: clean transcript and append to existing content; do NOT auto-submit
            const cleaned = cleanTranscript(raw);
            finalBuffer = joinWithSpace(finalBuffer, cleaned);
            // Ensure we don't duplicate earlier preview content
            userInput.value = finalBuffer;
            userInput.dispatchEvent(new Event('input'));
            interimBuffer = '';
            // No auto-submit; user will manually press the Send button
          }
        }
      };
    }
    return recognition;
  }

  function start(lang) {
    const rec = ensureRecognition(lang);
    if (!rec) {
      alert('Your browser does not support Web Speech API. Please use Chrome or Edge.');
      return;
    }
    // Toggle: if already listening, stop; otherwise start
    if (isListening) {
      // Optimistic UI clear: remove recording styles immediately
      stopping = true;
      setUiState(false);
      stop();
      return;
    }
    // Prevent starting while a stop is in progress
    if (stopping) {
      console.warn('Recognition is stopping; please wait a moment.');
      return;
    }
    try {
      rec.lang = lang || rec.lang;
      rec.start();
    } catch (e) {
      console.warn('Recognition start error:', e);
    }
  }

  function stop() {
    if (!recognition) return;
    if (!isListening && !document.querySelector('#voice-start-btn.recording')) {
      // Already stopped and UI cleared
      return;
    }
    try {
      stopping = true;
      recognition.stop();
    } catch (e) {
      console.warn(e);
    }
    // Fallback: if onend doesn't fire, force UI reset (and abort engine)
    setTimeout(() => {
      if (stopping) {
        try { if (recognition && typeof recognition.abort === 'function') recognition.abort(); } catch (e) { console.warn(e); }
        isListening = false;
        stopping = false;
        setUiState(false);
      }
    }, 800);
  }

  // Wire buttons if present
  document.addEventListener('DOMContentLoaded', () => {
    const hasAPI = !!SpeechRecognition;
    const startBtn = $('voice-start-btn');
    const stopBtn = $('voice-stop-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => start(startBtn.dataset.lang || undefined));
      if (!hasAPI) startBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', stop);
      if (!hasAPI) stopBtn.disabled = true;
    }
  });

  // Utilities
  // Silence watchdog disabled for toggle mode
  function startSilenceWatchdog() {}
  function stopSilenceWatchdog() {}

  function joinWithSpace(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left) return right;
    if (!right) return left;
    return left + (left.endsWith(' ') ? '' : ' ') + right;
  }

  function makePreviewText(baseValue, interim) {
    const base = String(baseValue || '').replace(/\s+$/, '');
    const cleanedInterim = cleanTranscript(interim, { aggressive: false });
    return joinWithSpace(base, cleanedInterim);
  }

  function cleanTranscript(text, opts = { aggressive: true }) {
    let t = String(text || '');
    // Normalize whitespace
    t = t.replace(/\s+/g, ' ').trim();
    // Deduplicate immediate repeated words: "what what" -> "what"
    t = t.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
    // Reduce triple repeats inside sentence: word word word -> word
    t = t.replace(/(\b\w+\b)(?:\s+\1){2,}/gi, '$1');
    // Collapse repeated phrases (bi/tri-grams) appearing back-to-back
    t = t.replace(/\b(\w+\s+\w+)\b\s+\b\1\b/gi, '$1');
    t = t.replace(/\b(\w+\s+\w+\s+\w+)\b\s+\b\1\b/gi, '$1');
    // Common medical term normalizations (case-insensitive)
    t = t.replace(/\b(covi[dt]?|covi|covid|covet|coffee)\s*[- ]?\s*(?:19|nineteen)\b/gi, 'COVID-19');
    t = t.replace(/\bcorona\s*virus(?:\s*disease)?\s*[- ]?\s*19\b/gi, 'COVID-19');
    // Numbers spoken oddly: "one nine" after COVID -> keep as COVID-19 (handled above)
    // Cleanup stray punctuation duplicates
    t = t.replace(/[\!\?\.]\s*(?=[\!\?\.])/g, '');
    if (opts.aggressive) {
      // Collapse near-duplicate bigrams/trigrams like "what is what is"
      t = t.replace(/\b(what is|this is|it is)\b\s+\b\1\b/gi, '$1');
    }
    // Capitalize COVID-19 properly (already done) and general start capitalization
    t = t.replace(/^([a-z])/, (m, g1) => g1.toUpperCase());
    return t;
  }

  function ensureMicStyles() {
    if (document.getElementById('voice-mic-style')) return;
    const style = document.createElement('style');
    style.id = 'voice-mic-style';
    style.textContent = `
      #voice-start-btn.recording { position: relative; }
      #voice-start-btn .mic-dot {
        display: inline-block;
        width: 8px; height: 8px; margin-left: 6px;
        border-radius: 50%; background: #e53935;
        box-shadow: 0 0 0 0 rgba(229,57,53, 0.7);
        animation: micpulse 1.2s infinite;
        vertical-align: middle;
      }
      @keyframes micpulse {
        0% { box-shadow: 0 0 0 0 rgba(229,57,53, 0.7); }
        70% { box-shadow: 0 0 0 8px rgba(229,57,53, 0); }
        100% { box-shadow: 0 0 0 0 rgba(229,57,53, 0); }
      }
    `;
    document.head.appendChild(style);
  }
})();
