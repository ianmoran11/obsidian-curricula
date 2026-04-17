export function buildMoc(moduleTitle: string, lessons: { title: string; filePath: string }[]): string {
  const lines: string[] = [
    `# ${moduleTitle}`,
    '',
    `This module contains ${lessons.length} lessons.`,
    '',
    '## Lessons',
    '',
  ];

  for (const lesson of lessons) {
    const fileName = lesson.filePath.split('/').pop()?.replace('.md', '') || lesson.title;
    lines.push(`- [[${fileName}|${lesson.title}]]`);
  }

  lines.push('');
  return lines.join('\n');
}

export function buildCourseIndex(
  courseTitle: string,
  modules: { title: string; mocPath: string; lessonCount: number }[]
): string {
  const lines: string[] = [
    `# ${courseTitle}`,
    '',
    `This course contains ${modules.length} modules.`,
    '',
    '## Modules',
    '',
  ];

  for (const mod of modules) {
    const fileName = mod.mocPath.split('/').pop()?.replace('.md', '') || mod.title;
    lines.push(`- [[${fileName}|${mod.title}]] (${mod.lessonCount} lessons)`);
  }

  lines.push('');
  return lines.join('\n');
}