/**
 * Formats data points into a frontend-ready Line Chart structure: [ [date, value] ].
 * 
 * @param {Array<Object>} points - Array of date/value objects
 * @returns {Array<Array>} Sorted Line chart array
 */
export function formatLineChart(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map(p => [p.date || p.day || '', Number(p.value || p.count || 0)])
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
}

/**
 * Formats data points into a frontend-ready Bar Chart structure: [ [label, count] ].
 * 
 * @param {Array<Object>} points - Array of label/count objects
 * @returns {Array<Array>} Sorted Bar chart array
 */
export function formatBarChart(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map(p => [String(p.label || p.category || ''), Number(p.count || 0)])
    .sort((a, b) => b[1] - a[1]);
}

/**
 * Formats data points into a frontend-ready Pie Chart structure: [ [category, percentage] ].
 * Calculates percentages dynamically based on the total sum.
 * 
 * @param {Array<Object>} points - Array of category/count objects
 * @returns {Array<Array>} Pie chart array with percentage values
 */
export function formatPieChart(points) {
  if (!Array.isArray(points)) return [];
  const total = points.reduce((sum, p) => sum + Number(p.count || 0), 0);
  return points.map(p => {
    const count = Number(p.count || 0);
    const pct = total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
    return [String(p.category || p.label || ''), pct];
  });
}

/**
 * Generates dates within a range to populate missing intervals for time-series charts.
 * 
 * @param {string|Date} start - Range start date
 * @param {string|Date} end - Range end date
 * @returns {Array<string>} Array of date strings (YYYY-MM-DD)
 */
export function generateDateSeries(start, end) {
  const dates = [];
  const curr = new Date(start);
  const last = new Date(end);
  while (curr <= last) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}
