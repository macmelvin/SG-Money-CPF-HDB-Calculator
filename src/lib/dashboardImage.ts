// Renders an off-screen DOM node to a canvas — used to fold the Dashboard infographic
// into the Premium Retirement Report PDF. html2canvas is dynamically imported so its
// ~200KB doesn't bloat the initial bundle for people who never generate the report;
// everything runs client-side, nothing is uploaded anywhere.

export async function captureNodeAsCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(node, {
    backgroundColor: "#faf8f5",
    scale: 2,
    useCORS: true,
  });
}

// Triggers a browser download of a captured canvas as a PNG — used for the quick one-image
// Dashboard export (as opposed to the full multi-page Premium Report PDF).
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}
