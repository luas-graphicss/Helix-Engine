import 'server-only';
import { FigureLightbox } from '../components/figure-lightbox';
import { publicImageSize } from './image-size';
interface DocsFigureProps {
    readonly src: string;
    readonly alt: string;
    readonly caption?: string;
}
export async function DocsFigure({ src, alt, caption }: DocsFigureProps) {
    const size = await publicImageSize(src);
    return (<figure className="docs-figure">
      <FigureLightbox src={src} alt={alt}>
        
        <img src={src} alt={alt} width={size?.width} height={size?.height} loading="lazy" decoding="async"/>
      </FigureLightbox>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>);
}
