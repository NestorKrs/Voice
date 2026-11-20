// Only plain text files are read. Returns the reason to show, or null when the
// name is fine. The name is logged, never the file content.
export function textFileRejection(name) {
  const n = (name == null ? '' : String(name)).toLowerCase();
  if (n.endsWith('.txt') || n.endsWith('.md')) return null;
  return 'Cannot load ' + (name == null ? '' : String(name)) + ': Voice reads only .txt and .md files.';
}
