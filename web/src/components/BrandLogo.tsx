import { Logo } from '../brand/Logo';

/** Rung logo: mark + wordmark, or the mark alone when space is tight. Inherits color. */
export function BrandLogo({ collapsed, size = 28 }: { collapsed?: boolean; size?: number }) {
  return <Logo variant={collapsed ? 'mark' : 'full'} size={size} />;
}
