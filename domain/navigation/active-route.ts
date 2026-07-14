export function findActiveNavigationHref(pathname: string, hrefs: readonly string[]): string | null {
  const matches = hrefs.filter((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );

  return matches.sort((left, right) => right.length - left.length)[0] ?? null;
}
