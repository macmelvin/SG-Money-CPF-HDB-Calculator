// Renders an off-screen DOM node to a PNG and triggers a download — used for the
// "Download Dashboard" feature. html2canvas is dynamically imported so its ~200KB
// doesn't bloat the initial bundle for people who never use this feature; everything
// runs client-side, nothing is uploaded anywhere.

export async function downloadNodeAsImage(node: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    backgroundColor: "#faf8f5",
    scale: 2,
    useCORS: true,
  });

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not generate the dashboard image.");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
