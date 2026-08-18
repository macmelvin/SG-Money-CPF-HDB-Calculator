// A floating "chat with us" shortcut shown on each calculator page. Uses
// WhatsApp's own brand color (not the site's theme color) since a
// recognizable green bubble is the whole point — people know what it means
// at a glance, the same way they would on any other website.
//
// The number is Melvin's own WhatsApp — this is a direct line for visitors
// with questions, not a lead-gen form, so no data is captured or stored;
// tapping it just opens a normal WhatsApp chat.
import { trackEvent } from "../lib/analytics";

const WHATSAPP_NUMBER = "6588877041"; // +65 8887 7041, in wa.me format (no + or spaces)

export function WhatsAppButton({ topic }: { topic: string }) {
  const message = `Hi, I have a question about the ${topic}.`;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-fab"
      aria-label={`Chat on WhatsApp about the ${topic}`}
      onClick={() => trackEvent("whatsapp_clicked", { calculator: topic })}
    >
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16.004 3C9.377 3 4 8.373 4 15c0 2.386.7 4.61 1.91 6.48L4 29l7.72-1.87A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.818a9.77 9.77 0 0 1-4.98-1.363l-.357-.212-4.58 1.11 1.223-4.462-.233-.366A9.77 9.77 0 0 1 5.818 15c0-5.626 4.56-10.182 10.186-10.182 5.625 0 10.178 4.556 10.178 10.182 0 5.625-4.553 10.182-10.178 10.182Zm5.59-7.63c-.306-.153-1.81-.893-2.09-.995-.28-.102-.484-.153-.687.153-.204.306-.79.995-.968 1.2-.178.204-.357.23-.663.077-.306-.153-1.293-.477-2.463-1.52-.91-.812-1.525-1.815-1.703-2.121-.178-.306-.019-.472.134-.624.138-.137.306-.357.459-.535.153-.178.204-.306.306-.51.102-.204.05-.383-.026-.535-.077-.153-.687-1.656-.942-2.27-.248-.596-.5-.515-.687-.524l-.586-.01c-.204 0-.535.076-.815.383-.28.306-1.068 1.044-1.068 2.547s1.094 2.955 1.246 3.16c.153.204 2.153 3.286 5.216 4.608.729.315 1.297.503 1.741.643.732.233 1.398.2 1.925.121.587-.088 1.81-.74 2.065-1.454.255-.714.255-1.326.178-1.454-.076-.128-.28-.204-.586-.357Z"
        />
      </svg>
    </a>
  );
}
