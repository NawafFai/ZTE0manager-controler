import { describe, expect, it } from 'vitest';
import { parseJavaScript } from './parser';

describe('parseJavaScript', () => {
  const sample = `
    function lockCell(pci, earfcn) {
      var d = { goformId: "LTE_LOCK_CELL_SET", lte_pci_lock: pci, lte_earfcn_lock: earfcn };
      return postData(d);
    }
    function readInfo() {
      return getData("goform_get_cmd_process?cmd=lte_pci,nr5g_pci,network_type&multi_data=1");
    }
    var bands = ["nr5g_action_band", "wan_nr5g_band_lock"];
  `;

  const commands = parseJavaScript([{ file: 'service.js', content: sample }]);
  const byId = (id: string, method: string) =>
    commands.find((c) => c.id === id && c.method === method);

  it('extracts goformId POST actions', () => {
    expect(byId('LTE_LOCK_CELL_SET', 'POST')).toBeDefined();
  });

  it('extracts cmd= GET commands, splitting multi reads', () => {
    expect(byId('lte_pci', 'GET')).toBeDefined();
    expect(byId('nr5g_pci', 'GET')).toBeDefined();
    expect(byId('network_type', 'GET')).toBeDefined();
  });

  it('flags interesting band/cell string literals as candidates', () => {
    expect(byId('nr5g_action_band', 'GET')).toBeDefined();
    expect(byId('wan_nr5g_band_lock', 'GET')).toBeDefined();
  });

  it('classifies discovered commands and records provenance', () => {
    const cmd = byId('LTE_LOCK_CELL_SET', 'POST')!;
    expect(cmd.category).toBe('lte');
    expect(cmd.foundIn).toContain('service.js');
    expect(cmd.source).toBe('discovered');
  });
});
