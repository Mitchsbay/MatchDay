export function gateBadge(status: "passed" | "blocked" | "review") {
  if (status === "passed") return <span className="badge good">✓ Passed</span>;
  if (status === "blocked") return <span className="badge warn">! Blocked from strong tip</span>;
  return <span className="badge bad">! Review required</span>;
}

export function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function outcomeLabel(outcome: string) {
  if (outcome === "home") return "Home win";
  if (outcome === "away") return "Away win";
  if (outcome === "draw") return "Draw";
  if (outcome === "review") return "Review / no tip";
  return "Pending";
}

export function accuracyBadge(
  isCorrect: boolean | null,
  isSettled: boolean,
  isTipPublished: boolean,
) {
  if (!isSettled) return <span className="badge warn">Pending result</span>;
  if (!isTipPublished) return <span className="badge warn">Review / no tip</span>;
  if (isCorrect) return <span className="badge good">Correct</span>;
  return <span className="badge bad">Missed</span>;
}
