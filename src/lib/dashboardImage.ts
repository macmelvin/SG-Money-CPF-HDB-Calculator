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
