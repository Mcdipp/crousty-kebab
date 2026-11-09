import type { CroustyProduct, ParticipationChoice } from './models';

export interface ProductInfo {
  id: CroustyProduct;
  name: string;
  description: string;
  image: string;
  spicy: boolean;
  sweet: boolean;
}

export const CROUSTY_PRODUCTS: readonly ProductInfo[] = [
  {
    id: 'NATURE',
    name: 'Crousty Nature',
    description: 'Le classique : poulet pané ultra croustillant, sans fioritures.',
    image: 'images/crousty-nature.svg',
    spicy: false,
    sweet: false,
  },
  {
    id: 'PIQUANT',
    name: 'Crousty Piquant',
    description: 'Une panure relevée au piment pour ceux qui aiment quand ça pique.',
    image: 'images/crousty-piquant.svg',
    spicy: true,
    sweet: false,
  },
  {
    id: 'SUCRE',
    name: 'Crousty Sucré',
    description: 'Nappé d’une sauce sucrée caramélisée, façon miel-soja.',
    image: 'images/crousty-sucre.svg',
    spicy: false,
    sweet: true,
  },
  {
    id: 'SUCRE_PIQUANT',
    name: 'Crousty Sucré Piquant',
    description: 'Le meilleur des deux mondes : sucré, épicé, addictif.',
    image: 'images/crousty-sucre-piquant.svg',
    spicy: true,
    sweet: true,
  },
] as const;

export const productName = (id: CroustyProduct): string =>
  CROUSTY_PRODUCTS.find((p) => p.id === id)?.name ?? id;

export const CHOICE_LABEL: Record<ParticipationChoice, string> = {
  TACOS: 'Tacos',
  KEBAB: 'Kebab',
};
