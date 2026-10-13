/** The match score as a coloured tile: green for strong matches, violet for decent ones. */
export function Score({ value }: { value?: number }) {
  const tier = value === undefined ? "" : value >= 60 ? "high" : value >= 35 ? "mid" : "";
  return (
    <span className={`score ${tier}`} title="How well this matches your profile, out of 100">
      {value ?? "–"}
      <small>match</small>
    </span>
  );
}
