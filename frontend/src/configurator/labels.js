// Small accessors that tolerate the Informed Design API's varying key names.
export const pid = (p) => p && (p.id || p.productId);
export const pname = (p) => (p && (p.name || p.productName)) || pid(p);
export const relId = (r) => r && (r.id || r.releaseId);

/** Strip the "b." prefix so ids from different endpoints compare equal. */
const normalizeId = (id) => {
  if (!id) return '';
  const s = String(id);
  return s.startsWith('b.') ? s.substring(2) : s;
};

/**
 * The human-facing release NUMBER (1, 2, 3…) — not the GUID. Falls back to the
 * 1-based position when the API omits it. Mirrors ProductsTab.js.
 */
export const relNumber = (r, idx = 0) =>
  (r && (r.number || r.releaseNumber || r.release_number)) || idx + 1;

/** Which release id the product considers its default, across key spellings. */
export const defaultReleaseIdOf = (p) => {
  if (!p) return null;
  const dr = p.defaultRelease;
  return (
    p.foundDefaultReleaseId ||
    (dr && typeof dr === 'object' ? relId(dr) : null) ||
    (typeof dr === 'string' ? dr : null) ||
    p.defaultReleaseId ||
    p.default_release_id ||
    p.default_release ||
    null
  );
};

/** True when this release is the product's default (by id, or its own flag). */
export const isDefaultRelease = (r, p) => {
  if (!r) return false;
  if (r.isDefault === true || r.default === true) return true;
  const defId = defaultReleaseIdOf(p);
  if (!defId) return false;
  return normalizeId(relId(r)) === normalizeId(defId) || String(relId(r)) === String(defId);
};

/**
 * Option label for a release: the number, with a star marking the default —
 * same convention as the full demo app ("3 ★").
 */
export const relLabel = (r, p, idx = 0) => {
  const num = relNumber(r, idx);
  return isDefaultRelease(r, p) ? `${num} ★` : String(num);
};
