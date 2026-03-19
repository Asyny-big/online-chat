const mongoose = require('mongoose');
const AiLog = require('../models/AiLog');

async function logAiAction({
  userId,
  action,
  success,
  duration,
  error = null,
  chatId = null,
  messageId = null,
  paramsFingerprint = null,
  stepIndex = null,
  planId = null,
  partial = false,
  responseText = null,
  resultData = null
}) {
  if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
    return null;
  }

  const normalizedAction = String(action || '').trim();
  if (!normalizedAction) {
    return null;
  }

  try {
    return await AiLog.create({
      userId,
      action: normalizedAction,
      chatId: mongoose.Types.ObjectId.isValid(String(chatId || '')) ? chatId : null,
      messageId: mongoose.Types.ObjectId.isValid(String(messageId || '')) ? messageId : null,
      paramsFingerprint: paramsFingerprint ? String(paramsFingerprint).slice(0, 500) : null,
      stepIndex: Number.isInteger(stepIndex) ? stepIndex : null,
      planId: planId ? String(planId).slice(0, 120) : null,
      partial: Boolean(partial),
      success: Boolean(success),
      duration: Math.max(Number(duration || 0), 0),
      error: error ? String(error).slice(0, 2000) : null,
      responseText: responseText ? String(responseText).slice(0, 4000) : null,
      resultData: resultData && typeof resultData === 'object' ? resultData : null
    });
  } catch (logError) {
    console.warn('[AI] log write failed:', logError?.message || logError);
    return null;
  }
}

async function loadLatestSuccessfulAiAction({
  userId,
  chatId = null,
  messageId = null,
  action,
  paramsFingerprint = null,
  stepIndex = null
}) {
  if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(String(messageId || ''))) {
    return null;
  }

  const normalizedAction = String(action || '').trim();
  if (!normalizedAction || !Number.isInteger(stepIndex)) {
    return null;
  }

  try {
    return await AiLog.findOne({
      userId,
      chatId: mongoose.Types.ObjectId.isValid(String(chatId || '')) ? chatId : null,
      messageId,
      action: normalizedAction,
      paramsFingerprint: paramsFingerprint ? String(paramsFingerprint).slice(0, 500) : null,
      stepIndex,
      success: true
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  } catch (error) {
    console.warn('[AI] log lookup failed:', error?.message || error);
    return null;
  }
}

module.exports = {
  logAiAction,
  loadLatestSuccessfulAiAction
};
