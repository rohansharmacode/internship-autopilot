export function Flash({ msg }: { msg?: string | string[] }) {
  const text = Array.isArray(msg) ? msg[0] : msg;
  return text ? <div className="flash">{text}</div> : null;
}
