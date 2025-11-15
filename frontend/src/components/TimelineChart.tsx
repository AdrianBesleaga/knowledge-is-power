import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TimelineEntry, Prediction } from '../types/timeline';
import './TimelineChart.css';

interface TimelineChartProps {
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  valueLabel: string;
}

export const TimelineChart = ({
  pastEntries,
  presentEntry,
  predictions,
  valueLabel,
}: TimelineChartProps) => {
  // Prepare data for chart
  const chartData: Array<{
    date: string;
    historicalValue: number | null;
    predictionValue: number | null;
    type: 'historical' | 'present' | 'prediction';
  }> = [];

  // Add past entries
  pastEntries.forEach((entry) => {
    const date = new Date(entry.date);
    chartData.push({
      date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      historicalValue: entry.value,
      predictionValue: null,
      type: 'historical',
    });
  });

  // Add present
  const presentDate = new Date(presentEntry.date);
  chartData.push({
    date: presentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
    historicalValue: presentEntry.value,
    predictionValue: null,
    type: 'present',
  });

  // Add predictions (use average of scenarios if available)
  predictions.forEach((prediction) => {
    const scenariosWithValues = prediction.scenarios.filter((s) => s.predictedValue !== undefined);
    if (scenariosWithValues.length > 0) {
      const avgValue =
        scenariosWithValues.reduce((sum, s) => sum + (s.predictedValue || 0), 0) /
        scenariosWithValues.length;

      chartData.push({
        date: prediction.timeline,
        historicalValue: null,
        predictionValue: avgValue,
        type: 'prediction',
      });
    }
  });

  return (
    <div className="timeline-chart">
      <h4>Value Over Time: {valueLabel}</h4>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            angle={-45} 
            textAnchor="end" 
            height={100}
            interval={0}
          />
          <YAxis label={{ value: valueLabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="historicalValue"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Historical & Present"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="predictionValue"
            stroke="#82ca9d"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4 }}
            name="Predictions"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

