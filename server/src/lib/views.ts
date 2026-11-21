/** Views that count toward analytics: some active reading time, not flagged as a bot. */
export const countedViewFilter = { totalDurationMs: { $gt: 0 }, isBot: { $ne: true } } as const;
