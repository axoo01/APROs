/** Triggers a client-side file download. CSV gets a UTF-8 BOM so Excel reads accents correctly. */
export function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
  const bom = mimeType.startsWith('text/csv') ? '﻿' : '';
  const url = URL.createObjectURL(new Blob([bom + content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
