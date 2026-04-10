import { Image } from "@mantine/core";

import cappyLogoPng from "../assets/cappy-logo.png";

interface CappyLogoProps {
  /** Largura em px; a altura é 80% deste valor (logo menos alto no header). */
  size?: number;
}

/**
 * Logo Cappy (`extension/media/icon.png`) via `Image` do Mantine — radius e `fit` alinhados ao design system.
 */
export function CappyLogo({ size = 36 }: CappyLogoProps): JSX.Element {
  const height = Math.round(size * 0.8);
  return (
    <Image
      src={cappyLogoPng}
      alt=""
      w={size}
      h={height}
      radius="md"
      fit="contain"
      flex="0 0 auto"
      decoding="async"
    />
  );
}
