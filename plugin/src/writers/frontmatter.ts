export function buildFrontmatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      if (value.includes(':') || value.includes('"') || value.includes("'") || value.includes('\n')) {
        lines.push(`${key}: "${escapeYamlString(value)}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (value === null) {
      lines.push(`${key}: null`);
    } else if (value === undefined) {
      // skip
    } else {
      lines.push(`${key}: "${String(value)}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function escapeYamlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}