// football-data.org's free tier covers exactly these 12 competitions,
// confirmed forever-free by the provider. Used to populate the competition
// selector in both the Live Fixtures (workspace import) and Live Fixture
// Maintenance (admin refresh) panels.
export const FREE_TIER_COMPETITIONS: Array<{ code: string; name: string }> = [
  { code: "PL", name: "Premier League (England)" },
  { code: "ELC", name: "Championship (England)" },
  { code: "PD", name: "La Liga (Spain)" },
  { code: "BL1", name: "Bundesliga (Germany)" },
  { code: "SA", name: "Serie A (Italy)" },
  { code: "FL1", name: "Ligue 1 (France)" },
  { code: "DED", name: "Eredivisie (Netherlands)" },
  { code: "PPL", name: "Primeira Liga (Portugal)" },
  { code: "BSA", name: "Série A (Brazil)" },
  { code: "CL", name: "UEFA Champions League" },
  { code: "EC", name: "European Championship" },
  { code: "WC", name: "FIFA World Cup" },
];
