import { api } from './api';
import { kvGet, kvSet, productCount, saveProducts } from './db';

/**
 * Downloads the product list into SQLite: the full list the first time (or
 * for another business), then only changes since the last download.
 */
export async function refreshProducts(baseUrl: string, token: string, businessKey: string) {
  const [since, savedBusiness, count] = await Promise.all([
    kvGet('productsSince'),
    kvGet('productsBusiness'),
    productCount(),
  ]);
  const full = !since || savedBusiness !== businessKey || count === 0;
  const res = await api.products(baseUrl, token, full ? null : since);
  await saveProducts(res.products ?? [], full);
  if (res.serverTime) await kvSet('productsSince', res.serverTime);
  await kvSet('productsBusiness', businessKey);
  await kvSet('productsAt', new Date().toISOString());
  return { full, received: res.products?.length ?? 0, total: await productCount() };
}
