"use client";

import { useFormStatus } from "react-dom";

/** A submit button that says what is happening while the server works. */
export function Submit({
  children,
  pending,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pending: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} name={name} value={value} disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
