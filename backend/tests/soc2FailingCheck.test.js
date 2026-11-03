// SOC 2 CC8.1 evidence (SCRUM-95): this test fails on purpose to show that a
// failing required check blocks the merge. The PR that adds it is never merged.
test("required check fails on purpose", () => {
    expect(true).toBe(false);
});
