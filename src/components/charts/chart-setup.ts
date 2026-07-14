import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

/** Register only the Chart.js pieces we use, keeping the bundle lean. */
let registered = false;
export function ensureChartsRegistered(): void {
  if (registered) return;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
  );
  registered = true;
}
