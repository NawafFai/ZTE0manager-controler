import { Card, Field, MetricTile, StatTile, Spinner } from '@/components/ui/primitives';
import { useDeviceInfo, useTelemetry, useWan, useRadioSnapshot } from '@/hooks';
import { formatUptime, orDash } from '@/utils/format';

const MODE_LABEL: Record<string, string> = {
  ENDC: '5G NSA (EN-DC)',
  NR_NSA: '5G NSA',
  NR_SA: '5G SA',
  LTE: 'LTE',
  NO_SERVICE: 'No service',
  UNKNOWN: 'Unknown',
};

export function Dashboard() {
  const device = useDeviceInfo();
  const telemetry = useTelemetry();
  const wan = useWan();
  const radio = useRadioSnapshot(2_000);

  const snap = radio.data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Connection"
          value={snap ? MODE_LABEL[snap.mode] ?? snap.mode : '—'}
          hint={snap?.caActive ? 'Carrier aggregation active' : undefined}
        />
        <StatTile label="Operator" value={orDash(snap?.operator)} hint={
          snap ? `${orDash(snap.mcc)}/${orDash(snap.mnc)}` : undefined
        } />
        <StatTile label="Uptime" value={formatUptime(telemetry.data?.uptimeSeconds ?? null)} />
        <StatTile
          label="Temperature"
          value={telemetry.data?.temperatureC != null ? `${telemetry.data.temperatureC} °C` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Device" className="lg:col-span-1">
          {device.isLoading ? (
            <Spinner label="Reading identity…" />
          ) : (
            <div>
              <Field label="Model" value={orDash(device.data?.model)} />
              <Field label="Firmware" value={orDash(device.data?.firmware)} />
              <Field label="Hardware" value={orDash(device.data?.hardwareVersion)} />
              <Field label="IMEI" value={orDash(device.data?.imei)} />
              <Field label="ICCID" value={orDash(device.data?.iccid)} />
              <Field label="MSISDN" value={orDash(device.data?.msisdn)} />
            </div>
          )}
        </Card>

        <Card title="WAN" className="lg:col-span-1">
          <Field label="IPv4" value={orDash(wan.data?.ipv4)} />
          <Field label="IPv6" value={orDash(wan.data?.ipv6)} />
          <Field label="PPP" value={orDash(wan.data?.pppStatus)} />
          <Field label="Signal bars" value={orDash(snap?.signalBars)} />
        </Card>

        <Card title="Serving cell" className="lg:col-span-1">
          <Field label="LTE band" value={orDash(snap?.lte.band)} />
          <Field label="LTE PCI" value={orDash(snap?.lte.pci)} />
          <Field label="LTE EARFCN" value={orDash(snap?.lte.earfcn)} />
          <Field label="Cell ID / eNB" value={`${orDash(snap?.lte.cellId)} / ${orDash(snap?.lte.enbId)}`} />
          <Field label="NR band" value={orDash(snap?.nr.band)} />
          <Field label="NR PCI" value={orDash(snap?.nr.pci)} />
          <Field label="NR ARFCN" value={orDash(snap?.nr.arfcn)} />
        </Card>
      </div>

      <Card title="Signal quality">
        {!snap ? (
          <Spinner label="Reading radio…" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <MetricTile label="LTE RSRP" metric={snap.lte.rsrp} />
            <MetricTile label="LTE RSRQ" metric={snap.lte.rsrq} />
            <MetricTile label="LTE SINR" metric={snap.lte.sinr} />
            <MetricTile label="NR RSRP" metric={snap.nr.rsrp} />
            <MetricTile label="NR RSRQ" metric={snap.nr.rsrq} />
            <MetricTile label="NR SINR" metric={snap.nr.sinr} />
          </div>
        )}
      </Card>
    </div>
  );
}
