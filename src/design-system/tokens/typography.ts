export const typography = {
  caption: { fontSize: 11, fontWeight: '500' as const },
  bodySmall: { fontSize: 13, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '700' as const },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
  title: { fontSize: 20, fontWeight: '700' as const },
  header: { fontSize: 24, fontWeight: '800' as const },
} as const;

export type TypographyType = keyof typeof typography;
