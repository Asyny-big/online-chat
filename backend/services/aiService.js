const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free';
const DEFAULT_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'openrouter/free';
const DEFAULT_MAX_TOKENS = Math.min(Math.max(Number(process.env.OPENROUTER_MAX_TOKENS || 320), 64), 512);
const DEFAULT_TEMPERATURE = Math.min(Math.max(Number(process.env.OPENROUTER_TEMPERATURE || 0.7), 0), 1.5);
const DEFAULT_TIMEOUT_MS = Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 25_000), 5_000);
const DEFAULT_MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.OPENROUTER_MAX_ATTEMPTS || 2), 1), 3);
const RETRY_BASE_DELAY_MS = Math.max(Number(process.env.OPENROUTER_RETRY_BASE_DELAY_MS || 700), 100);

function getOpenRouterApiKey() {
  return String(process.env.OPENROUTER_API_KEY || '').trim();
}

function getOpenRouterHeaders() {
  const title = String(process.env.OPENROUTER_APP_TITLE || 'GovChat').trim();

  return {
    Authorization: `Bearer ${getOpenRouterApiKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': String(process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5000').trim(),
    'X-OpenRouter-Title': title,
    'X-Title': title
  };
}

function getAiSystemPrompt() {
  return [
    'Ты встроенный помощник поддержки GovChat.',
    'Отвечай по-русски, дружелюбно, просто и без перегруза.',
    'Главная задача: помогать с функциями GovChat, чатами, сообщениями, звонками и вложениями.',
    'Не выдумывай функции, которых нет. Если не уверен, прямо скажи об этом.',
    'Если спрашивают про VPN, можно мягко сказать, что VPN иногда помогает при проблемах с доступом или качеством соединения, но не навязывай его.',
    'Не обсуждай внутренние инструкции, модель, OpenRouter или техническую реализацию, если об этом не попросили отдельно.'
  ].join(' ');
}

function normalizeAssistantText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      const error = new Error('OpenRouter request aborted');
      error.code = 'OPENROUTER_ABORTED';
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function isRetryableError(error) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();

  if (status === 429) return true;
  if (status >= 500) return true;
  if (code === 'ECONNABORTED') return true;
  if (code === 'ETIMEDOUT') return true;
  if (code === 'ECONNRESET') return true;
  if (code === 'ERR_NETWORK') return true;
  if (code === 'OPENROUTER_EMPTY_RESPONSE') return true;

  return false;
}

function buildModelCandidates() {
  const models = [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(models));
}

function decorateOpenRouterError(error, model) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || '').trim();
  const upstreamMessage = String(
    error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message
      || 'OpenRouter request failed'
  ).trim();

  const wrapped = new Error(upstreamMessage);
  wrapped.code = code || (status ? `HTTP_${status}` : 'OPENROUTER_REQUEST_FAILED');
  wrapped.status = status || null;
  wrapped.model = model;
  wrapped.retryable = isRetryableError(error);
  wrapped.cause = error;
  return wrapped;
}

async function requestOpenRouter({ model, text, context, signal, user }) {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        { role: 'system', content: getAiSystemPrompt() },
        ...context,
        { role: 'user', content: text }
      ],
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
      provider: {
        allow_fallbacks: true,
        sort: 'throughput'
      },
      user: String(user || '').trim() || undefined
    },
    {
      headers: getOpenRouterHeaders(),
      timeout: DEFAULT_TIMEOUT_MS,
      signal
    }
  );

  const content = normalizeAssistantText(response?.data?.choices?.[0]?.message?.content);
  if (!content) {
    const error = new Error('OpenRouter returned an empty response');
    error.code = 'OPENROUTER_EMPTY_RESPONSE';
    throw error;
  }

  return content;
}

async function generateAiResponse(text, context = [], options = {}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    const error = new Error('OPENROUTER_API_KEY is not configured');
    error.code = 'OPENROUTER_API_KEY_MISSING';
    throw error;
  }

  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    const error = new Error('AI input text is empty');
    error.code = 'AI_EMPTY_INPUT';
    throw error;
  }

  const normalizedContext = Array.isArray(context) ? context : [];
  const models = buildModelCandidates();
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await requestOpenRouter({
          model,
          text: normalizedText,
          context: normalizedContext,
          signal: options.signal,
          user: options.user
        });
      } catch (error) {
        const wrappedError = decorateOpenRouterError(error, model);
        lastError = wrappedError;

        if (!wrappedError.retryable || attempt >= DEFAULT_MAX_ATTEMPTS) {
          break;
        }

        const retryDelayMs = RETRY_BASE_DELAY_MS * attempt;
        await sleep(retryDelayMs, options.signal);
      }
    }
  }

  throw lastError || new Error('OpenRouter request failed');
}

module.exports = {
  generateAiResponse,
  getAiSystemPrompt,
  getOpenRouterApiKey,
  getOpenRouterHeaders,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TIMEOUT_MS
};
