// Adapt persisted CA sessions to the reference explorers. No browser storage.
export function explorerState(session) {
  if (!session)
    return { selected: [], answers: {}, completed: false, result: null };
  const answers = Object.fromEntries(
    session.answers
      .filter((row) => row.option_codes.length === 1)
      .map((row) => [row.question_code, Number(row.option_codes[0])]),
  );
  const firstMissing = session.questions.findIndex((q) => !(q.code in answers));
  return {
    selected: session.selected_islands || [],
    answers,
    completed: session.status === "completed",
    completedAt: session.completed_at || null,
    result: session.exploration_result || null,
    questions: session.questions,
    index: firstMissing < 0 ? 0 : firstMissing,
  };
}

export function sameSelection(left, right) {
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

export function resumableSession(rows, purpose, selected) {
  return (
    rows.find(
      (row) =>
        row.purpose === purpose &&
        ["draft", "ready", "completed"].includes(row.status) &&
        (purpose !== "interest" ||
          selected === undefined ||
          sameSelection(row.selected_islands || [], selected)),
    ) || null
  );
}

// A new attempt opened from history must keep its own refreshable address.
export function continuedExplorerHash(hash, purpose, sessionId) {
  const expected = purpose === "interest" ? "interest" : "talents";
  const [route, record] = hash.replace(/^#/, "").split("/");
  if (route !== expected || !record || !sessionId) return hash;
  return `#${expected}/${encodeURIComponent(sessionId)}`;
}
