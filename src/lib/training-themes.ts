export const trainingThemeOptions = [
  "Pasninger",
  "Ballkontroll og teknikk",
  "Skudd",
  "Angrep",
  "Forsvar",
  "Kontringer",
  "Kamptrening",
  "Kondisjon",
  "Styrke",
  "Keepertrening",
  "Lek og samspill",
  "Annet",
] as const;

export type TrainingTheme = (typeof trainingThemeOptions)[number];

export const trainingThemeValues = new Set<string>(trainingThemeOptions);
