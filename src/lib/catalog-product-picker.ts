import { PRODUCTS } from '../data/products';
import { Product } from '../types';

export interface PickedProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface CatalogMappingResult {
  primaryProductId: string;
  primaryProductName: string;
  primaryCategory: string;
  orderNote: string;
  totalAmount: number;
  currency: string;
  items: Array<{
    productId: string;
    productTitle: string;
    price: number;
    quantity: number;
    category: string;
    downloadUrl: string;
  }>;
  orderTags: Record<string, string>;
}

export function pickCatalogProduct(amountInput: number | string): PickedProduct {
  const numericAmount = Number(amountInput) || 550;
  const matched = PRODUCTS.find(p => Math.abs(p.price - numericAmount) < 5) || PRODUCTS[0];
  return {
    id: matched?.id || 'linknest-pro',
    name: matched?.title || 'LinkNest Pro — Bio Link & Digital Store',
    price: matched?.price || numericAmount,
    quantity: 1,
    size: 'Standard',
    color: 'Default',
  };
}

export function getActiveWebsiteCatalog(catalog: Product[] = PRODUCTS): Product[] {
  return catalog.filter(p => p.status !== 'archived');
}

export function mapExternalAmountToCatalogProduct(
  amount: number | string,
  preferredProductId?: string,
  catalog: Product[] = PRODUCTS
): CatalogMappingResult {
  const numericAmount = Number(amount);
  
  // Strict list of allowed price points
  const ALLOWED_PRICES = new Set([599, 799, 1100, 1400, 1699, 1999, 5500, 7500, 5599, 7599]);
  
  if (!ALLOWED_PRICES.has(numericAmount)) {
    throw new Error(`Invalid price point: ₹${numericAmount}. Only standard catalog prices are allowed.`);
  }

  let matched = catalog.find(p => p.id === preferredProductId || p.slug === preferredProductId);
  if (!matched) {
    // Find the closest product in the catalog to this price point for display/mock purposes
    matched = catalog
      .filter(p => p.status === 'active')
      .sort((a, b) => Math.abs(a.price - numericAmount) - Math.abs(b.price - numericAmount))[0];
    
    if (!matched) {
      matched = catalog[0];
    }
  }
  const price = numericAmount; // Use the actual amount the customer is paying
  return {
    primaryProductId: matched.id,
    primaryProductName: matched.title,
    primaryCategory: matched.categoryLabel || matched.category || 'templates',
    orderNote: `Booyahstudio digital product: ${matched.title}`,
    totalAmount: price,
    currency: 'INR',
    items: [
      {
        productId: matched.id,
        productTitle: matched.title,
        price,
        quantity: 1,
        category: matched.categoryLabel || matched.category || 'templates',
        downloadUrl: `/api/downloads/${matched.id}`,
      },
    ],
    orderTags: {
      product_id: matched.id,
      store: 'Booyahstudio',
    },
  };
}

export function validateInternalCartItems(items: any[], catalog: Product[] = PRODUCTS): CatalogMappingResult {
  const list = Array.isArray(items) && items.length > 0 ? items : [{ productId: catalog[0]?.id || 'linknest-pro', quantity: 1 }];
  let totalAmount = 0;
  const mappedItems: any[] = [];
  let primaryId = '';
  let primaryName = '';
  let primaryCategory = '';

  for (const item of list) {
    const rawId = item.productId || item.product?.id || item.id;
    const found = catalog.find(p => p.id === rawId || p.slug === rawId) || catalog[0];
    const qty = Number(item.quantity) || 1;
    const price = found.price || 550;
    totalAmount += price * qty;
    if (!primaryId) {
      primaryId = found.id;
      primaryName = found.title;
      primaryCategory = found.categoryLabel || found.category || 'templates';
    }
    mappedItems.push({
      productId: found.id,
      productTitle: found.title,
      price,
      quantity: qty,
      category: found.categoryLabel || found.category || 'templates',
      downloadUrl: `/api/downloads/${found.id}`,
    });
  }

  return {
    primaryProductId: primaryId || 'linknest-pro',
    primaryProductName: primaryName || 'LinkNest Pro — Bio Link & Digital Store',
    primaryCategory: primaryCategory || 'templates',
    orderNote: `Booyahstudio order: ${primaryName}`,
    totalAmount: Math.max(1, totalAmount),
    currency: 'INR',
    items: mappedItems,
    orderTags: {
      primary_product_id: primaryId || 'linknest-pro',
      store: 'Booyahstudio',
    },
  };
}
