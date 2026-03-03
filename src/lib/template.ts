export function renderTemplate(
  template: Record<string, unknown>,
  vars: { date?: string; batch_number?: number; job_index?: number }
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const date = vars.date ?? new Date().toISOString().slice(0, 10);
  const batch_number = vars.batch_number ?? 1;
  const job_index = vars.job_index ?? 0;

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === "string") {
      result[key] = value
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{batch_number\}\}/g, String(batch_number))
        .replace(/\{\{job_index\}\}/g, String(job_index));
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = renderTemplate(value as Record<string, unknown>, { date, batch_number, job_index });
    } else {
      result[key] = value;
    }
  }
  return result;
}
