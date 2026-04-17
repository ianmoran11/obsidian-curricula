function toWikiTarget(filePath: string): string {
  return filePath.replace(/\.md$/i, '');
}

export function buildBreadcrumb(courseIndexPath: string, modulePath: string, moduleTitle: string): string {
  return `[[${toWikiTarget(courseIndexPath)}|Course Index]] > [[${toWikiTarget(modulePath)}|${moduleTitle}]]\n`;
}

export function buildPrevNext(
  prevLesson: { title: string; filePath: string } | null,
  nextLesson: { title: string; filePath: string } | null,
  courseIndexPath: string
): string {
  const parts: string[] = ['---'];
  parts.push('\n**Navigation:**\n');
  
  if (prevLesson) {
    parts.push(`- Previous: [[${toWikiTarget(prevLesson.filePath)}|${prevLesson.title}]]\n`);
  }
  
  if (nextLesson) {
    parts.push(`- Next: [[${toWikiTarget(nextLesson.filePath)}|${nextLesson.title}]]\n`);
  } else {
    parts.push(`- Next: [[${toWikiTarget(courseIndexPath)}|Course Index]]\n`);
  }
  
  return parts.join('');
}
