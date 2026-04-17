export function buildBreadcrumb(courseTitle: string, moduleTitle: string, lessonTitle: string): string {
  return `[[Course Index]] > [[${moduleTitle}]]\n`;
}

export function buildPrevNext(
  prevLesson: { title: string; filePath: string } | null,
  nextLesson: { title: string; filePath: string } | null,
  courseIndexPath: string
): string {
  const parts: string[] = ['---'];
  parts.push('\n**Navigation:**\n');
  
  if (prevLesson) {
    parts.push(`- Previous: [[${prevLesson.title}|${prevLesson.title}]]\n`);
  }
  
  if (nextLesson) {
    parts.push(`- Next: [[${nextLesson.title}|${nextLesson.title}]]\n`);
  } else {
    parts.push(`- Next: [[Course Index]]\n`);
  }
  
  return parts.join('');
}