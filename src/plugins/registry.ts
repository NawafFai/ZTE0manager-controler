import type { DeviceInfo } from '@/types';
import { AUTH_STRATEGIES, classicZteAuth } from '@/api/auth';
import { genericPlugin } from './generic';
import { MODEL_PLUGINS } from './models';
import type { ResolvedRouter, RouterPlugin } from './types';

/**
 * Plugin registry + detection. Detection is pure and deterministic: given a
 * DeviceInfo, pick the most specific matching plugin, else the generic one.
 */

const ALL_PLUGINS: readonly RouterPlugin[] = [...MODEL_PLUGINS, genericPlugin];

export function allPlugins(): readonly RouterPlugin[] {
  return ALL_PLUGINS;
}

function pluginMatches(plugin: RouterPlugin, device: DeviceInfo): boolean {
  if (plugin.matches?.(device)) return true;
  const model = (device.model ?? '').toUpperCase();
  const hw = (device.hardwareVersion ?? '').toUpperCase();
  return plugin.models.some((m) => {
    const needle = m.toUpperCase();
    return model.startsWith(needle) || hw.startsWith(needle);
  });
}

export function detectPlugin(device: DeviceInfo): RouterPlugin {
  // Prefer the most specific match (longest matched model string wins), so
  // "MC801A1" resolves to the mc801a plugin rather than a broader one.
  const candidates = MODEL_PLUGINS.filter((p) => pluginMatches(p, device));
  if (candidates.length === 0) return genericPlugin;
  return candidates.sort((a, b) => longestModel(b) - longestModel(a))[0]!;
}

function longestModel(plugin: RouterPlugin): number {
  return plugin.models.reduce((max, m) => Math.max(max, m.length), 0);
}

export function resolveRouter(device: DeviceInfo): ResolvedRouter {
  const plugin = detectPlugin(device);
  const authStrategy =
    (plugin.authStrategyId && AUTH_STRATEGIES[plugin.authStrategyId]) || classicZteAuth;
  return {
    plugin,
    authStrategy,
    capabilities: plugin.capabilities(device),
  };
}
