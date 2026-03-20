const axios = require('axios');
const { getAiToolManifestText } = require('./aiTools');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free';
const DEFAULT_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'openrouter/free';
const DEFAULT_MAX_TOKENS = Math.min(Math.max(Number(process.env.OPENROUTER_MAX_TOKENS || 900), 128), 1600);
const DEFAULT_TEMPERATURE = Math.min(Math.max(Number(process.env.OPENROUTER_TEMPERATURE || 0.45), 0), 1.5);
const DEFAULT_TIMEOUT_MS = Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 25_000), 5_000);
const DEFAULT_MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.OPENROUTER_MAX_ATTEMPTS || 2), 1), 3);
const RETRY_BASE_DELAY_MS = Math.max(Number(process.env.OPENROUTER_RETRY_BASE_DELAY_MS || 700), 100);
const ERR_CANCELED_RETRY_LIMIT = 1;

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
    'Ты AI-инженер поддержки GovChat.',
    'Отвечай по-русски, по делу и человеческим языком.',
    'Если для ответа нужны данные, сначала анализируй и выбирай инструменты, а не выдавай пустой вывод.',
    'Для одного шага возвращай только JSON без markdown: {"action":"tool_name","params":{...}}.',
    'Для нескольких шагов возвращай только JSON без markdown: {"actions":[{"action":"tool","params":{}},{"action":"tool2","params":{}}]}.',
    'Если задача диагностическая, не ограничивайся одним инструментом. Сначала собери данные, потом делай вывод.',
    'Для проблем вроде "почему тормозит сервер", "лагают сокеты", "плохо работает realtime", "звонки тормозят" предпочитай multi-step план.',
    'Для серверной деградации предпочитай system_diagnostics, analyze_slow_requests, check_realtime_health, check_calls_health, explain_issue.',
    'Для проблем связи и звонков предпочитай system_diagnostics, check_realtime_health, check_calls_health, explain_issue.',
    'Не отвечай шаблонно и не повторяй одни и те же формулировки из последних сообщений.',
    'Не делай вывод без данных, если данные можно получить инструментами.',
    'Если данных все равно недостаточно и инструменты не помогут, задай один короткий уточняющий вопрос обычным текстом.',
    'Если сразу после create_group нужен add_user, можно не указывать chatId во втором шаге.',
    'Для add_user, start_call, find_user и create_group.participants можно передавать номер телефона или identifier.',
    'Никогда не придумывай несуществующие инструменты и не используй action вне разрешенного списка.',
    'Если пользователь спрашивает, что ты умеешь, используй explain_feature с feature="capabilities".',
    'Примеры:',
    'Пользователь: "создай группу для проекта" -> {"action":"create_group","params":{"name":"Проект"}}.',
    'Пользователь: "создай группу и добавь +79991234567" -> {"action":"create_group","params":{"name":"Новая группа","participants":["+79991234567"]}}.',
    'Пользователь: "позвони +79991234567" -> {"action":"start_call","params":{"phone":"+79991234567"}}.',
    'Пользователь: "почему тормозит сервер" -> {"actions":[{"action":"system_diagnostics","params":{}},{"action":"analyze_slow_requests","params":{}},{"action":"check_realtime_health","params":{}},{"action":"check_calls_health","params":{}},{"action":"explain_issue","params":{"issue":"почему тормозит сервер"}}]}.',
    'Разрешенные инструменты:',
    getAiToolManifestText()
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
  if (code === 'ERR_CANCELED') return true;
  if (code === 'OPENROUTER_EMPTY_RESPONSE') return true;

  return false;
}

function buildModelCandidates() {
  return Array.from(new Set(
    [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
}

function decorateOpenRouterError(error, model) {
  const status = Number(error?.response?.status || 0);
  const code = String(
    error?.code
    || (typeof axios.isCancel === 'function' && axios.isCancel(error) ? 'ERR_CANCELED' : '')
  ).trim().toUpperCase();
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
  wrapped.retryable = isRetryableError({ ...error, code: wrapped.code, status });
  wrapped.cause = error;
  return wrapped;
}

async function requestOpenRouter({
  model,
  text,
  context,
  signal,
  user,
  systemPrompt,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE
}) {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        { role: 'system', content: String(systemPrompt || getAiSystemPrompt()).trim() },
        ...context,
        { role: 'user', content: text }
      ],
      temperature,
      max_tokens: Math.min(Math.max(Number(maxTokens || DEFAULT_MAX_TOKENS), 64), 1600),
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
  let canceledRetries = 0;

  for (const model of models) {
    for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await requestOpenRouter({
          model,
          text: normalizedText,
          context: normalizedContext,
          signal: options.signal,
          user: options.user,
          systemPrompt: options.systemPrompt,
          maxTokens: options.maxTokens,
          temperature: options.temperature
        });
      } catch (error) {
        const wrappedError = decorateOpenRouterError(error, model);
        lastError = wrappedError;

        if (wrappedError.code === 'ERR_CANCELED') {
          if (canceledRetries >= ERR_CANCELED_RETRY_LIMIT) {
            throw wrappedError;
          }

          canceledRetries += 1;
          await sleep(RETRY_BASE_DELAY_MS, options.signal);
          continue;
        }

        if (!wrappedError.retryable || attempt >= DEFAULT_MAX_ATTEMPTS) {
          break;
        }

        await sleep(RETRY_BASE_DELAY_MS * attempt, options.signal);
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
