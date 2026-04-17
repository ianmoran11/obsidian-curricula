export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function buildLessonFileName(title: string, existingNames: Set<string>): string {
  let base = slugify(title);
  if (!base) base = 'lesson';
  
  let name = base;
  let counter = 1;
  while (existingNames.has(name + '.md')) {
    counter++;
    name = `${base}-${counter}`;
  }
  
  existingNames.add(name + '.md');
  return name + '.md';
}

export function extractFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}