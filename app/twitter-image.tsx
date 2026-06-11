/**
 * Twitter card image. Twitter accepts the same dimensions as Open Graph for
 * `summary_large_image` cards, so we delegate to the OG image to avoid
 * maintaining two near-identical components.
 */
export { default, alt, size, contentType, runtime } from "./opengraph-image";
