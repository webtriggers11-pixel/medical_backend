/**
 * Shared pagination helpers for list endpoints.
 *
 * Pagination is OPTIONAL and backward compatible: when neither `page` nor
 * `limit` is supplied the caller gets the full array (used by dropdowns /
 * selects). When either is supplied the caller gets a `{ items, meta }`
 * envelope with skip/take applied.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Raw page/limit straight off the query string (strings) or already-parsed numbers. */
export interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/** Normalises raw query params into safe numbers + Prisma skip/take. */
export function resolvePagination(input?: PaginationInput) {
  const wants =
    !!input && (input.page !== undefined || input.limit !== undefined);
  const page = Math.max(1, Math.floor(Number(input?.page)) || 1);
  const limitRaw = Math.floor(Number(input?.limit)) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw));
  return { wants, page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
