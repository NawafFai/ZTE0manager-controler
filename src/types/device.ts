/** Device identity + host telemetry shown on the dashboard. */

export interface DeviceInfo {
  model: string | null;
  firmware: string | null;
  hardwareVersion: string | null;
  waInnerVersion: string | null;
  imei: string | null;
  imsi: string | null;
  iccid: string | null;
  msisdn: string | null;
}

export interface HostTelemetry {
  uptimeSeconds: number | null;
  temperatureC: number | null;
  cpuPercent: number | null;
  ramPercent: number | null;
}

export interface WanInfo {
  ipv4: string | null;
  ipv6: string | null;
  pppStatus: string | null;
  connectionUptimeSeconds: number | null;
}
