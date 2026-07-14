import type { ApiCategory } from '@/types';

/**
 * Heuristic classification of a discovered command into a functional category.
 * Ordered most-specific → least; the first keyword group that matches wins.
 * This is how automatically-discovered commands get grouped without any
 * hardcoded per-command mapping.
 */
const RULES: Array<{ category: ApiCategory; patterns: RegExp[] }> = [
  { category: 'nr5g', patterns: [/nr5?g/i, /\bnr_/i, /\bnr\b/i, /5g/i, /\bn\d{1,3}\b/] },
  { category: 'lte', patterns: [/lte/i, /earfcn/i, /\benb\b/i, /\bpci\b/i, /\bband_lock\b/i] },
  {
    category: 'signal',
    patterns: [/rsrp/i, /rsrq/i, /sinr/i, /rssi/i, /\bcqi\b/i, /signal/i, /\bmcs\b/i],
  },
  { category: 'wifi', patterns: [/wifi/i, /wlan/i, /ssid/i, /wps/i] },
  { category: 'firewall', patterns: [/firewall/i, /\bacl\b/i, /portmap/i, /dmz/i, /\bnat\b/i] },
  { category: 'vpn', patterns: [/vpn/i, /ipsec/i, /pptp/i, /l2tp/i, /wireguard/i] },
  { category: 'sms', patterns: [/\bsms\b/i, /message/i, /\bmms\b/i] },
  { category: 'sim', patterns: [/\bsim\b/i, /\bpin\b/i, /\bpuk\b/i, /\bimsi\b/i, /iccid/i] },
  { category: 'voip', patterns: [/voip/i, /\bsip\b/i, /voice/i, /telephon/i] },
  { category: 'thermal', patterns: [/thermal/i, /temperatur/i, /\bfan\b/i] },
  {
    category: 'diagnostics',
    patterns: [/diag/i, /\bping\b/i, /trace/i, /\blog(info|s)?\b/i, /debug/i],
  },
  { category: 'factory', patterns: [/factory/i, /restore/i, /reset/i, /\bnv\b/i] },
  { category: 'engineering', patterns: [/\badb\b/i, /engineer/i, /telnet/i, /\bat_?cmd\b/i] },
  { category: 'auth', patterns: [/login/i, /logout/i, /passw/i, /\bauth\b/i, /\brd\b/i, /\bad\b/i] },
  {
    category: 'network',
    patterns: [/network/i, /\bwan\b/i, /\bapn\b/i, /connect/i, /\bppp\b/i, /bearer/i, /\bmtu\b/i],
  },
  { category: 'device', patterns: [/version/i, /hardware/i, /\bimei\b/i, /model/i, /device/i] },
];

export function classifyCommand(id: string): ApiCategory {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(id))) return rule.category;
  }
  return 'experimental';
}
