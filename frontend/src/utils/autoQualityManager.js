export const QUALITY_TIER_ORDER = ['ultra', 'high', 'medium', 'low'];

export const QUALITY_PROFILES = {
  p2pCamera: {
    name: 'p2pCamera',
    degradeAfter: 2,
    recoverAfter: 4,
    cooldownMs: 4500,
    tiers: {
      ultra: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_500_000, publishQuality: 'high' },
      high: { width: 1920, height: 1080, frameRate: 24, maxBitrate: 3_200_000, publishQuality: 'high' },
      medium: { width: 1280, height: 720, frameRate: 24, maxBitrate: 1_900_000, publishQuality: 'medium' },
      low: { width: 854, height: 480, frameRate: 20, maxBitrate: 900_000, publishQuality: 'low' },
    },
  },
  p2pScreen: {
    name: 'p2pScreen',
    degradeAfter: 2,
    recoverAfter: 4,
    cooldownMs: 5000,
    tiers: {
      ultra: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 5_000_000, publishQuality: 'high' },
      high: { width: 1920, height: 1080, frameRate: 24, maxBitrate: 3_800_000, publishQuality: 'high' },
      medium: { width: 1280, height: 720, frameRate: 18, maxBitrate: 2_200_000, publishQuality: 'medium' },
      low: { width: 960, height: 540, frameRate: 12, maxBitrate: 1_200_000, publishQuality: 'low' },
    },
  },
  livekitCamera: {
    name: 'livekitCamera',
    degradeAfter: 2,
    recoverAfter: 4,
    cooldownMs: 4500,
    tiers: {
      ultra: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 3_000_000, publishQuality: 'high' },
      high: { width: 1920, height: 1080, frameRate: 24, maxBitrate: 2_200_000, publishQuality: 'high' },
      medium: { width: 1280, height: 720, frameRate: 24, maxBitrate: 1_500_000, publishQuality: 'medium' },
      low: { width: 854, height: 480, frameRate: 20, maxBitrate: 800_000, publishQuality: 'low' },
    },
  },
  livekitScreen: {
    name: 'livekitScreen',
    degradeAfter: 2,
    recoverAfter: 4,
    cooldownMs: 5000,
    tiers: {
      ultra: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 5_000_000, publishQuality: 'high' },
      high: { width: 1920, height: 1080, frameRate: 24, maxBitrate: 3_500_000, publishQuality: 'high' },
      medium: { width: 1280, height: 720, frameRate: 15, maxBitrate: 2_200_000, publishQuality: 'medium' },
      low: { width: 960, height: 540, frameRate: 10, maxBitrate: 1_200_000, publishQuality: 'low' },
    },
  },
};

function clampTierIndex(index) {
  return Math.min(Math.max(index, 0), QUALITY_TIER_ORDER.length - 1);
}

function getTierIndex(tier) {
  const index = QUALITY_TIER_ORDER.indexOf(tier);
  return index >= 0 ? index : 1;
}

export function getQualityTierConfig(profile, tier) {
  const resolvedTier = QUALITY_TIER_ORDER.includes(tier) ? tier : 'high';
  return profile?.tiers?.[resolvedTier] || profile?.tiers?.high || null;
}

export function buildVideoConstraintsForTier(config, extra = {}) {
  if (!config) return extra;
  return {
    width: { ideal: config.width, max: config.width },
    height: { ideal: config.height, max: config.height },
    frameRate: { ideal: config.frameRate, max: config.frameRate },
    ...extra,
  };
}

function getPacketLoss(sample) {
  const packetLoss = Number(sample?.packetLoss || 0);
  if (!Number.isFinite(packetLoss) || packetLoss < 0) return 0;
  return packetLoss;
}

function getAvailableOutgoingBitrate(sample) {
  const bitrate = Number(sample?.availableOutgoingBitrate || 0);
  if (!Number.isFinite(bitrate) || bitrate < 0) return 0;
  return bitrate;
}

function canPromote(sample, candidateConfig) {
  if (!candidateConfig) return false;
  const bitrate = getAvailableOutgoingBitrate(sample);
  const packetLoss = getPacketLoss(sample);
  const reason = String(sample?.qualityLimitationReason || 'none').toLowerCase();

  if (reason === 'cpu') return false;
  if (packetLoss > 0.03) return false;
  if (!bitrate) return packetLoss === 0;

  return bitrate >= candidateConfig.maxBitrate * 1.25;
}

function isCpuLimited(sample, currentConfig) {
  const reason = String(sample?.qualityLimitationReason || 'none').toLowerCase();
  if (reason === 'cpu') return true;

  const frameRate = Number(sample?.frameRate || 0);
  const bitrate = getAvailableOutgoingBitrate(sample);
  if (!frameRate || !currentConfig) return false;

  return frameRate < Math.max(18, currentConfig.frameRate * 0.72) && (!bitrate || bitrate >= currentConfig.maxBitrate * 0.85);
}

function getNetworkPressure(sample, currentConfig) {
  const bitrate = getAvailableOutgoingBitrate(sample);
  const packetLoss = getPacketLoss(sample);
  const reason = String(sample?.qualityLimitationReason || 'none').toLowerCase();

  const bandwidthLimited = reason === 'bandwidth';
  const lowBitrate = bitrate > 0 && currentConfig ? bitrate < currentConfig.maxBitrate * 0.85 : false;
  const severeBitrateDrop = bitrate > 0 && currentConfig ? bitrate < currentConfig.maxBitrate * 0.6 : false;
  const packetLossBad = packetLoss >= 0.08;
  const packetLossSevere = packetLoss >= 0.12;

  return {
    limited: bandwidthLimited || lowBitrate || packetLossBad,
    severe: severeBitrateDrop || packetLossSevere,
  };
}

function findNextTierIndex(profile, currentIndex, cause) {
  if (currentIndex >= QUALITY_TIER_ORDER.length - 1) return currentIndex;
  if (cause !== 'cpu') return currentIndex + 1;

  const currentConfig = getQualityTierConfig(profile, QUALITY_TIER_ORDER[currentIndex]);
  for (let index = currentIndex + 1; index < QUALITY_TIER_ORDER.length; index += 1) {
    const candidate = getQualityTierConfig(profile, QUALITY_TIER_ORDER[index]);
    if (!candidate) continue;
    if (candidate.width === currentConfig?.width && candidate.height === currentConfig?.height) {
      return index;
    }
  }
  return currentIndex + 1;
}

export function createAutoQualityManager({ profile, initialTier = 'high' }) {
  let currentIndex = clampTierIndex(getTierIndex(initialTier));
  let stableSamples = 0;
  let constrainedSamples = 0;
  let lastChangeAt = 0;
  let lastReason = 'startup';

  const getSnapshot = () => {
    const tier = QUALITY_TIER_ORDER[currentIndex];
    return {
      tier,
      config: getQualityTierConfig(profile, tier),
      reason: lastReason,
    };
  };

  return {
    getSnapshot,
    reset(nextTier = initialTier) {
      currentIndex = clampTierIndex(getTierIndex(nextTier));
      stableSamples = 0;
      constrainedSamples = 0;
      lastChangeAt = 0;
      lastReason = 'reset';
      return getSnapshot();
    },
    update(sample) {
      const now = Number(sample?.timestamp || Date.now());
      const tier = QUALITY_TIER_ORDER[currentIndex];
      const currentConfig = getQualityTierConfig(profile, tier);
      const cpuLimited = isCpuLimited(sample, currentConfig);
      const network = getNetworkPressure(sample, currentConfig);
      const limited = cpuLimited || network.limited;

      if (limited) {
        constrainedSamples += network.severe ? 2 : 1;
        stableSamples = 0;
      } else {
        constrainedSamples = 0;
        stableSamples += 1;
      }

      const cooldownMs = Number(profile?.cooldownMs || 4500);
      const canChange = now - lastChangeAt >= cooldownMs;
      if (canChange && constrainedSamples >= Number(profile?.degradeAfter || 2)) {
        const nextIndex = findNextTierIndex(profile, currentIndex, cpuLimited ? 'cpu' : 'network');
        if (nextIndex !== currentIndex) {
          currentIndex = clampTierIndex(nextIndex);
          lastChangeAt = now;
          lastReason = cpuLimited ? 'cpu-downshift' : 'network-downshift';
          constrainedSamples = 0;
          stableSamples = 0;
          const nextTier = QUALITY_TIER_ORDER[currentIndex];
          return {
            ...getSnapshot(),
            changed: true,
            previousTier: tier,
            nextTier,
          };
        }
      }

      if (canChange && stableSamples >= Number(profile?.recoverAfter || 4) && currentIndex > 0) {
        const candidateTier = QUALITY_TIER_ORDER[currentIndex - 1];
        const candidateConfig = getQualityTierConfig(profile, candidateTier);
        if (canPromote(sample, candidateConfig)) {
          currentIndex = clampTierIndex(currentIndex - 1);
          lastChangeAt = now;
          lastReason = 'network-recovery';
          stableSamples = 0;
          constrainedSamples = 0;
          return {
            ...getSnapshot(),
            changed: true,
            previousTier: tier,
            nextTier: QUALITY_TIER_ORDER[currentIndex],
          };
        }
      }

      return {
        ...getSnapshot(),
        changed: false,
        previousTier: tier,
        nextTier: tier,
      };
    },
  };
}
