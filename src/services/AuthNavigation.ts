/** Only supported internal return destinations may be carried through authentication. */
export const authDestination = (redirect?: string): string => redirect === 'checkout' ? '/checkout' : '/account';
export const authReturnSearch = (redirect?: string): Record<string, string> => redirect === 'checkout' ? { redirect: 'checkout' } : {};

/** Never persist email authentication material in local navigation history. */
export function safePreviousUrl(pathname: string, search = ''): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\u0000-\u001f]/.test(pathname)) return '/';
  const query = new URLSearchParams(search);
  for (const key of [...query.keys()]) {
    if (/token|code|secret|password|confirmation_url|error_description/i.test(key)) query.delete(key);
  }
  const clean = query.toString();
  return pathname + (clean ? `?${clean}` : '');
}
