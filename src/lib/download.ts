// Saving a file without a network request. The CSP has connect-src 'none', so
// nothing here may fetch: the text becomes a Blob behind an object URL, and a
// top-level <a download> saves it. A download is not a fetch, so neither
// connect-src nor any other directive needs `blob:`, and the CSP stays as it is.

/** Saves `text` as `fileName` through the browser's download, with no network request. */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  // In the document, at the top level: older browsers ignore a click on a detached anchor.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // On the next task, not now: revoking synchronously can cancel the download
  // before the browser has read the Blob.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
