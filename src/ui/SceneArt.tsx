/**
 * Full-screen background artwork behind a page's real HTML controls: the portrait composition in portrait
 * orientation, the landscape one otherwise. Both are 1672×941 (or 941×1672); app.css relies on that ratio
 * to keep the characters uncropped and the controls clear of them.
 */
export function SceneArt({ landscape, portrait, alt }: { landscape: string; portrait: string; alt: string }) {
  return (
    <picture className="scene-art">
      <source media="(orientation: portrait)" srcSet={portrait} width={941} height={1672} />
      <img src={landscape} width={1672} height={941} alt={alt} decoding="async" />
    </picture>
  );
}
