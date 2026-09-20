'use strict';

const API_BASE = 'https://collectionapi.metmuseum.org/public/collection';
const RESULT_COUNT = 6;
const SEARCH_LIMIT = 36;
// Visitor labels map to a few plain search terms, not a taxonomy of Met tags.
const OBJECT_TYPES = {
  paintings: { label: 'Paintings', terms: ['painting'], medium: 'Paintings' },
  prints: { label: 'Prints & Drawings', terms: ['print', 'drawing'], medium: 'Prints|Drawings' },
  photography: { label: 'Photography', terms: ['photograph'], medium: 'Photographs' },
  sculpture: { label: 'Sculpture', terms: ['sculpture'], medium: 'Sculpture' },
  textiles: { label: 'Textiles & Fashion', terms: ['textile', 'dress', 'costume'], medium: 'Textiles|Costume' },
  ceramics: { label: 'Ceramics', terms: ['ceramic', 'vase', 'pottery'], medium: 'Ceramics' },
  decorative: { label: 'Decorative Objects', terms: ['decorative arts', 'furniture', 'vessel'], medium: '' },
  jewelry: { label: 'Jewelry', terms: ['jewelry', 'necklace', 'brooch'], medium: '' }
};
const THEMES = {
  nature: { label: 'Nature & Landscapes', terms: ['landscape', 'nature'] },
  people: { label: 'People & Portraits', terms: ['portrait', 'people'] },
  architecture: { label: 'Architecture & Places', terms: ['architecture', 'buildings'] },
  pattern: { label: 'Pattern & Ornament', terms: ['pattern', 'ornament'] },
  myth: { label: 'Myth & Stories', terms: ['mythology', 'myth'] }
};
// Hard type checks use object metadata, never the search query or artwork title.
const TYPE_TERMS = {
  paintings: ['painting', 'oil painting', 'watercolor', 'watercolour', 'gouache', 'tempera'],
  prints: ['print', 'drawing', 'engraving', 'etching', 'lithograph', 'lithography', 'woodcut', 'woodblock print'],
  photography: ['photograph', 'photography', 'photographic print', 'gelatin silver print', 'albumen silver print', 'daguerreotype'],
  sculpture: ['sculpture', 'statue', 'statuette', 'bust', 'relief', 'sculptural', 'figure', 'figurine'],
  textiles: ['textile', 'costume', 'dress', 'garment', 'fabric', 'tapestry', 'embroidery', 'lace', 'robe', 'tunic', 'shawl', 'kimono', 'coat', 'woven', 'weaving'],
  ceramics: ['ceramic', 'pottery', 'porcelain', 'earthenware', 'stoneware', 'terracotta', 'faience'],
  decorative: ['decorative arts', 'furniture', 'vessel', 'furnishing', 'chair', 'table', 'cabinet', 'mirror', 'clock'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'bracelet', 'brooch', 'pendant', 'ring', 'earring']
};
const THEME_SIGNALS = {
  nature: ['landscape', 'nature', 'tree', 'mountain', 'river'],
  plants: ['flower', 'plant', 'floral', 'blossom', 'garden'],
  animals: ['animal', 'bird', 'fish', 'horse', 'cat', 'dog', 'lion', 'deer'],
  people: ['portrait', 'people', 'man', 'woman', 'child'],
  everyday: ['daily life', 'interior', 'domestic', 'cooking', 'kitchen', 'work', 'market', 'game', 'family'],
  architecture: ['architecture', 'architectural', 'building', 'temple', 'house', 'city'],
  pattern: ['pattern', 'ornament', 'ornamental', 'decoration'],
  fashion: ['fashion', 'costume', 'jewelry', 'dress', 'adornment'],
  myth: ['myth', 'mythology', 'mythological', 'god', 'goddess', 'legend']
};
function hasMetadataTerm(value, term) {
  // Word boundaries prevent errors such as treating "string" as a jewelry "ring".
  const words = normalizeMetadata(value).replace(/[^a-z0-9]+/g, ' ');
  return new RegExp(`(?:^| )${term}(?:s|es)?(?: |$)`).test(words);
}
function getTypeMatches(artwork, selectedTypes) {
  const matches = [];
  const name = normalizeMetadata(artwork.objectName);
  for (const type of selectedTypes) {
    // These small objects are not visitor-facing sculpture, even if a broad
    // classification contains Sculpture or a medium mentions sculptural relief.
    if (type === 'sculpture' && ['scarab', 'scaraboid', 'amulet', 'seal', 'stamp', 'coin', 'ring', 'bead', 'photograph', 'painting', 'drawing', 'print'].some(term => hasMetadataTerm(name, term))) continue;
    if (type === 'textiles' && ['armor', 'weapon', 'sword', 'helmet', 'shield'].some(term => hasMetadataTerm(name, term) || hasMetadataTerm(artwork.classification, term))) continue;
    if (type === 'prints' && ['photograph', 'photography'].some(term => hasMetadataTerm(name, term) || hasMetadataTerm(artwork.classification, term))) continue;
    // "Cabinet Card" is a photographic object, not decorative furniture.
    if (type === 'decorative' && ['photograph', 'photography', 'cabinet card'].some(term => hasMetadataTerm(name, term) || hasMetadataTerm(artwork.classification, term))) continue;
    // A drawing is not made a painting simply by a broad departmental classification.
    if (type === 'paintings' && ['drawing', 'print', 'photograph', 'engraving', 'etching'].some(term => hasMetadataTerm(name, term))) continue;
    for (const field of ['objectName', 'classification', 'medium']) {
      const term = TYPE_TERMS[type].find(term => hasMetadataTerm(artwork[field], term));
      if (term) { matches.push({ type: OBJECT_TYPES[type].label, field, term, value: artwork[field] }); break; }
    }
  }
  return matches; // Multiple selected types are OR, not AND.
}
function getThemeMatches(artwork, selectedThemes) {
  const tags = Array.isArray(artwork.tags) ? artwork.tags.map(tag => tag?.term).filter(Boolean) : [];
  const values = [artwork.title, artwork.objectName, artwork.classification, ...tags];
  return selectedThemes.filter(id => THEME_SIGNALS[id].some(term => values.some(value => hasMetadataTerm(value, term))));
}
function getTitleFamily(artwork) {
  return normalizeMetadata(artwork.title).replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|a|an|of|with)\b/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
}
function selectVariedCandidates(candidates) {
  // Stronger real theme evidence first; randomized ties retain exploratory variety.
  const ranked = shuffle(candidates).sort((a, b) => b.themeMatches.length - a.themeMatches.length);
  const chosen = [];
  const remaining = [];
  for (const candidate of ranked) {
    const art = candidate.artwork;
    const family = getTitleFamily(art);
    const sameFamily = chosen.some(c => family && getTitleFamily(c.artwork) === family);
    const sameKind = chosen.filter(c => normalizeMetadata(c.artwork.objectName) === normalizeMetadata(art.objectName) && normalizeMetadata(c.artwork.classification) === normalizeMetadata(art.classification)).length;
    if (sameFamily || sameKind >= 2) remaining.push(candidate);
    else chosen.push(candidate);
  }
  // Diversity is a preference: only valid, deduplicated types enter either list.
  return [...chosen, ...remaining].slice(0, RESULT_COUNT);
}
function shuffle(items) {
  const mixed = [...items];
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  return mixed;
}
function preferenceLabels() {
  return [...state.types.map(id => OBJECT_TYPES[id].label), ...state.themes.map(id => THEMES[id].label)];
}
function getPreferenceSearches() {
  const searches = [];
  if (state.themes.length) {
    for (const themeID of state.themes) {
      const terms = THEMES[themeID].terms;
      if (state.types.length) {
        for (const typeID of state.types) {
          const type = OBJECT_TYPES[typeID];
          const term = shuffle(terms)[0];
          // Medium filters give themes a meaningful object-type constraint.
          // For broad categories without a reliable filter, use a short paired query.
          searches.push({ query: type.medium ? term : `${shuffle(type.terms)[0]} ${term}`, medium: type.medium });
        }
      } else {
        terms.slice(0, 2).forEach(query => searches.push({ query, medium: '' }));
      }
    }
  } else {
    for (const id of state.types) {
      const type = OBJECT_TYPES[id];
      shuffle(type.terms).slice(0, 2).forEach(query => searches.push({ query, medium: type.medium }));
    }
  }
  return searches.filter((item, i) => searches.findIndex(other => other.query === item.query && other.medium === item.medium) === i).slice(0, 6);
}
const objectCache = new Map();
const shownObjects = new Map();
let generationNumber = 0;
const main = document.querySelector('main');
let requestController = null;
let searchVersion = 0;
let state = { types: [], themes: [], results: [], loading: false, explored: false, selectedID: null, seed: null, error: '' };

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const textValue = value => typeof value === 'string' ? value.trim() : '';
function announce(message) { document.querySelector('#announcer').textContent = message; }

async function fetchJSON(url, signal) {
  // A timeout also handles a connection that never finishes responding.
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error(`Met API returned HTTP ${response.status}`);
  return response.json();
}
async function searchMet(query, signal, stats, medium = '') {
  const parameters = new URLSearchParams({ q: query, hasImages: 'true', offset: '0', limit: '1' });
  if (medium) parameters.set('medium', medium);
  // Rabbit holes search the field that supplied the signal, then still validate
  // each fetched record. Initial preference searches are unchanged.
  if (stats.seed && getSpecificTags(stats.seed).some(term => normalizeMetadata(term) === normalizeMetadata(query))) parameters.set('tags', 'true');
  else if (stats.seed && getSpecificConcepts(stats.seed).includes(query)) parameters.set('title', 'true');
  stats.searchRequests++;
  const search = { query, medium, offset: 0, limit: 0, total: null };
  stats.searches.push(search);
  console.log('[Met search] Request:', `${API_BASE}/v1.1/search?${parameters}`);
  const countResponse = await fetchJSON(`${API_BASE}/v1.1/search?${parameters}`, signal);
  console.log('[Met search] Count response:', countResponse);
  const accessibleCount = Math.min(Math.max(0, Number(countResponse.total) || 0), 10000);
  search.total = countResponse.total;
  if (!accessibleCount) return countResponse;
  const limit = Math.min(SEARCH_LIMIT, accessibleCount);
  const offset = Math.floor(Math.random() * (accessibleCount - limit + 1));
  parameters.set('offset', String(offset));
  parameters.set('limit', String(limit));
  search.offset = offset;
  search.limit = limit;
  stats.searchRequests++;
  console.log('[Met search] Random window:', { query, medium, accessibleCount, offset, limit });
  console.log('[Met search] Request:', `${API_BASE}/v1.1/search?${parameters}`);
  const response = await fetchJSON(`${API_BASE}/v1.1/search?${parameters}`, signal);
  console.log('[Met search] Raw response:', response);
  return response;
}
async function fetchObject(objectID, signal, stats) {
  if (objectCache.has(objectID)) { stats.objectSuccesses++; return objectCache.get(objectID); }
  stats.objectRequests++;
  const artwork = await fetchJSON(`${API_BASE}/v1/objects/${objectID}`, signal);
  objectCache.set(objectID, artwork);
  stats.objectSuccesses++;
  console.log('[Met object] Raw response:', artwork);
  return artwork;
}
function getImageURL(artwork) {
  const url = textValue(artwork.primaryImageSmall) || textValue(artwork.primaryImage);
  return /^https?:\/\//i.test(url) ? url : '';
}
// These comparisons can also be reused when assembling recommendations.
function normalizeMetadata(value) {
  return textValue(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
}
function getArtworkImageURLs(artwork) {
  return [artwork.primaryImage, artwork.primaryImageSmall].map(textValue).filter(Boolean);
}
function getArtworkMetadataKey(artwork) {
  const title = normalizeMetadata(artwork.title);
  let artist = normalizeMetadata(artwork.artistDisplayName);
  // Treat missing and explicitly unknown artists alike; retain named artists.
  if (['unknown', 'unknown artist', 'unidentified artist', 'anonymous'].includes(artist)) artist = '';
  // Dates may be missing or differ between records of the same work.
  return title ? JSON.stringify([title, artist]) : '';
}
function getDuplicateReason(candidate, acceptedArtworks) {
  const imageURLs = getArtworkImageURLs(candidate);
  const metadataKey = getArtworkMetadataKey(candidate);
  for (const artwork of acceptedArtworks) {
    if (String(artwork.objectID) === String(candidate.objectID)) return 'duplicate ID';
    if (getArtworkImageURLs(artwork).some(url => imageURLs.includes(url))) return 'duplicate image';
    if (metadataKey && metadataKey === getArtworkMetadataKey(artwork)) return 'duplicate title/artist';
  }
  return '';
}
function isDuplicateArtwork(candidate, acceptedArtworks) {
  return Boolean(getDuplicateReason(candidate, acceptedArtworks));
}
function rejectCandidate(stats, objectID, reason) {
  stats.rejected.push({ objectID, reason });
  console.log('[Discovery] Rejected candidate:', { generation: stats.generation, objectID, reason });
}
function imageLoads(url, signal) {
  // Nonempty URLs can still be broken. Check decoding before displaying a card.
  return new Promise(resolve => {
    const image = new Image();
    let timer;
    function finish(usable) {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      image.onload = image.onerror = null;
      if (!usable) image.src = '';
      resolve(usable);
    }
    const cancel = () => finish(false);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    timer = setTimeout(() => finish(false), 10000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel(); else image.src = url;
  });
}
async function fetchObjects(candidates, signal, stats, valid = [], attemptLimit = SEARCH_LIMIT) {
  for (const candidate of candidates) {
    const { id } = candidate;
    if (signal.aborted) throw new DOMException('Search canceled', 'AbortError');
    if (stats.seenIDs.has(String(id))) { rejectCandidate(stats, id, 'duplicate ID'); continue; }
    if (stats.detailAttempts >= attemptLimit || valid.filter(c => !c.previouslyShown).length >= (stats.resultCount || RESULT_COUNT)) break;
    stats.seenIDs.add(String(id));
    stats.detailAttempts++;
    try {
      const artwork = await fetchObject(id, signal, stats);
      const typeMatches = getTypeMatches(artwork, stats.selectedTypes);
      if (stats.selectedTypes.length && !typeMatches.length) {
        rejectCandidate(stats, id, 'incompatible object type');
        console.log('[Discovery] Type rejected:', { objectID: id, objectName: artwork.objectName, classification: artwork.classification, medium: artwork.medium });
        continue;
      }
      const duplicate = getDuplicateReason(artwork, [...(stats.seed ? [stats.seed] : []), ...valid.map(c => c.artwork)]);
      if (duplicate) { rejectCandidate(stats, id, duplicate); continue; }
      const connectionReason = stats.seed ? getConnectionLabel(stats.seed, artwork) : '';
      if (stats.seed && !connectionReason) { rejectCandidate(stats, id, 'no verified metadata connection'); continue; }
      const image = getImageURL(artwork);
      if (!image) { rejectCandidate(stats, id, 'missing image'); continue; }
      if (!await imageLoads(image, signal)) { rejectCandidate(stats, id, 'image failed to load'); continue; }
      const previouslyShown = Boolean(getDuplicateReason(artwork, [...shownObjects.values()]));
      valid.push({ artwork, connectionReason, typeMatches, themeMatches: getThemeMatches(artwork, stats.selectedThemes), source: candidate.source, previouslyShown });
      console.log('[Discovery] Accepted:', { generation: stats.generation, objectID: id, previouslyShown });
    } catch (error) {
      if (signal.aborted) throw error;
      stats.failures++;
      rejectCandidate(stats, id, 'object request failed');
      stats.apiErrors.push({ objectID: id, message: error.message });
      console.warn('[Discovery] API error:', { generation: stats.generation, objectID: id, message: error.message });
    }
  }
  return valid;
}
async function collectCandidateIDs(searches, signal, stats) {
  const pools = [];
  for (const { query, medium } of searches) {
    if (signal.aborted) throw new DOMException('Search canceled', 'AbortError');
    try {
      const response = await searchMet(query, signal, stats, medium);
      stats.searchSuccesses = (stats.searchSuccesses || 0) + 1;
      const ids = Array.isArray(response.objectIDs) ? response.objectIDs : [];
      const search = stats.searches[stats.searches.length - 1];
      console.log('[Discovery] Sampled IDs:', { query, medium, ids });
      pools.push(shuffle(ids).map(id => ({ id, source: { query, medium, offset: search.offset } })));
    } catch (error) {
      if (signal.aborted) throw error;
      stats.failures++;
      stats.apiErrors.push({ query, message: error.message });
      console.warn('[Discovery] API error:', { generation: stats.generation, query, message: error.message });
    }
  }
  const candidates = [];
  for (let i = 0; i < SEARCH_LIMIT; i++) {
    for (const pool of shuffle(pools)) if (i < pool.length) candidates.push(pool[i]);
  }
  return candidates;
}
async function getPreferenceObjects(searches, signal, stats) {
  const valid = [];
  let nextSearches = searches;
  // Spread the existing 60-attempt budget across up to four random windows.
  // A sparse window does not end a generation while budget remains.
  for (let round = 0; round < 4 && stats.detailAttempts < 60; round++) {
    const candidates = await collectCandidateIDs(nextSearches, signal, stats);
    await fetchObjects(candidates, signal, stats, valid, Math.min(60, stats.detailAttempts + (round === 0 ? 24 : 12)));
    if (valid.filter(c => !c.previouslyShown).length >= RESULT_COUNT) break;
    // Do not hammer an endpoint when every search in this window failed.
    if (!candidates.length && stats.searches.slice(-nextSearches.length).every(s => s.total === null)) break;
    nextSearches = stats.selectedTypes.length ? stats.selectedTypes.map(id => {
      const type = OBJECT_TYPES[id];
      return { query: type.terms[round % type.terms.length], medium: type.medium };
    }) : searches.slice(0, 2);
  }
  // Previously shown works are a soft exclusion, never a reason to fail.
  // Recheck their type and image before using up to six as a fallback.
  for (const artwork of [...shownObjects.values()].slice(-12).reverse()) {
    if (valid.length >= RESULT_COUNT) break;
    if (signal.aborted) throw new DOMException('Search canceled', 'AbortError');
    const typeMatches = getTypeMatches(artwork, stats.selectedTypes);
    if (stats.selectedTypes.length && !typeMatches.length) continue;
    if (getDuplicateReason(artwork, valid.map(c => c.artwork))) continue;
    if (!await imageLoads(getImageURL(artwork), signal)) continue;
    valid.push({ artwork, typeMatches, themeMatches: getThemeMatches(artwork, stats.selectedThemes), previouslyShown: true, source: { query: 'Previously shown (fallback)' } });
    stats.reusedPrevious++;
    console.log('[Discovery] Reused valid previous object:', { generation: stats.generation, objectID: artwork.objectID });
  }
  const fresh = selectVariedCandidates(valid.filter(c => !c.previouslyShown));
  const previous = selectVariedCandidates(valid.filter(c => c.previouslyShown));
  const selected = [...fresh, ...previous].slice(0, RESULT_COUNT);
  stats.accepted = valid.length;
  stats.finalCount = selected.length;
  stats.selection = selected.map(candidate => ({ objectID: candidate.artwork.objectID, typeMatches: candidate.typeMatches, themeMatches: candidate.themeMatches.map(id => THEMES[id].label), source: candidate.source, previouslyShown: candidate.previouslyShown }));
  return selected.map(candidate => candidate.artwork);
}
// Small conservative vocabularies identify concrete concepts/materials, not broad
// art categories. Unrecognized metadata never causes us to weaken validation.
const THREAD_CONCEPTS = ['earring', 'necklace', 'pendant', 'bracelet', 'brooch', 'jewelry', 'jewellery', 'horse', 'vase', 'flower', 'bird', 'cat', 'dog', 'lion', 'fish', 'tree', 'bowl', 'cup', 'teapot', 'bottle', 'chair', 'mirror', 'kimono', 'tapestry', 'portrait', 'dress', 'armor', 'landscape'];
const THREAD_MATERIALS = ['terracotta', 'bronze', 'silk', 'porcelain', 'gold', 'silver', 'ivory', 'jade', 'marble', 'alabaster', 'earthenware', 'stoneware', 'faience', 'velvet', 'wood', 'glass'];
const GENERIC_THREAD_TAGS = new Set(['men', 'man', 'women', 'woman', 'people', 'person', 'persons', 'male', 'female', 'boy', 'boys', 'girl', 'girls', 'adult', 'adults', 'figure', 'figures', 'child', 'children', 'human', 'humans']);
function getSpecificTags(artwork) {
  const broad = ['unknown', 'unidentified', 'other', 'miscellaneous', 'object', 'objects', 'art', 'drawing', 'drawings', 'painting', 'paintings', 'print', 'prints', 'sculpture', 'sculptures', 'decorative arts', 'design', 'designs', 'ornament', 'ornaments', 'architecture', 'photograph', 'photographs', 'textile', 'textiles'];
  return (Array.isArray(artwork.tags) ? artwork.tags : []).map(tag => textValue(tag?.term)).filter(term => term && !broad.includes(normalizeMetadata(term)) && !GENERIC_THREAD_TAGS.has(normalizeMetadata(term)));
}
function getSpecificConcepts(artwork) {
  return THREAD_CONCEPTS.filter(term => [artwork.title, artwork.objectName, artwork.classification, ...getSpecificTags(artwork)].some(value => hasMetadataTerm(value, term)));
}
function getSpecificMaterials(artwork) {
  // Only the medium field proves physical material; "gold" in a drawing's
  // title describes its subject, not what the drawing is made of.
  return THREAD_MATERIALS.filter(term => hasMetadataTerm(artwork.medium, term));
}
function getRelatedSignals(artwork) {
  // Prefer tags naming a concrete object concept over incidental details.
  const tags = shuffle(getSpecificTags(artwork)).sort((a, b) => Number(THREAD_CONCEPTS.some(term => hasMetadataTerm(b, term))) - Number(THREAD_CONCEPTS.some(term => hasMetadataTerm(a, term))));
  const values = [...tags, ...getSpecificConcepts(artwork), ...getSpecificMaterials(artwork)];
  return values.filter((value, i, all) => all.findIndex(other => normalizeMetadata(other) === normalizeMetadata(value)) === i).slice(0, 2);
}
function getConnectionLabel(seed, artwork) {
  const sharedTag = getSpecificTags(seed).find(term => getSpecificTags(artwork).some(other => normalizeMetadata(term) === normalizeMetadata(other)));
  let reason = sharedTag ? `Shared theme: ${sharedTag}` : '';
  // Compare complete field values, never title keywords or material substrings.
  // Broad object categories and placeholders cannot qualify on their own.
  const generic = new Set(['unknown', 'unidentified', 'unspecified', 'other', 'miscellaneous', 'n/a', 'object', 'objects', 'art', 'artwork', 'drawing', 'drawings', 'painting', 'paintings', 'print', 'prints', 'sculpture', 'sculptures', 'decorative arts', 'photograph', 'photographs', 'textile', 'textiles', 'mixed media']);
  for (const [field, label] of [['objectName', 'Shared object name'], ['classification', 'Shared classification'], ['medium', 'Shared medium']]) {
    const value = normalizeMetadata(seed[field]);
    if (!reason && value && !generic.has(value) && !GENERIC_THREAD_TAGS.has(value) && value === normalizeMetadata(artwork[field])) reason = `${label}: ${textValue(seed[field])}`;
  }
  // Culture supports a verified connection; it never substitutes for one.
  const culture = normalizeMetadata(seed.culture);
  if (reason && culture && !generic.has(culture) && culture === normalizeMetadata(artwork.culture)) reason += ` · Shared culture: ${textValue(seed.culture)}`;
  return reason;
}
async function getRelatedObjects(seed, signal, stats) {
  const valid = [];
  const signals = getRelatedSignals(seed);
  stats.signals = signals;
  // No onboarding type or theme constraints apply here. Try each signal on its own,
  // then one more random window if necessary; at most 36 detailed records total.
  for (let round = 0; signals.length && round < 3 && stats.detailAttempts < 36; round++) {
    const query = signals[round % signals.length];
    const candidates = await collectCandidateIDs([{ query, medium: '' }], signal, stats);
    await fetchObjects(candidates, signal, stats, valid, Math.min(36, stats.detailAttempts + 12));
    if (valid.filter(candidate => !candidate.previouslyShown).length >= 4) break;
    if (!candidates.length && stats.searches.at(-1)?.total === null) break;
  }
  // Prefer fresh objects, but a previously viewed matching candidate is still valid.
  return [...selectVariedCandidates(valid.filter(c => !c.previouslyShown)), ...selectVariedCandidates(valid.filter(c => c.previouslyShown))].slice(0, 4).map(c => ({ ...c.artwork, connectionReason: c.connectionReason }));
}
function artworkCards(artworks, seed = null) {
  if (seed) artworks = artworks.map(artwork => ({ ...artwork, connectionReason: getConnectionLabel(seed, artwork) })).filter(artwork => artwork.connectionReason);
  return `<div class="collection-sheet search-grid">${artworks.map(artwork => {
    const title = textValue(artwork.title) || 'Untitled';
    const artist = textValue(artwork.artistDisplayName) || 'Unknown artist';
    const date = textValue(artwork.objectDate);
    const connection = seed ? artwork.connectionReason : '';
    return `<article class="collected" data-object-id="${escapeHTML(artwork.objectID)}"><button class="artwork-choice" data-select-artwork="${escapeHTML(artwork.objectID)}"><img src="${escapeHTML(getImageURL(artwork))}" alt="${escapeHTML(title)}"><h3>${escapeHTML(title)}</h3><p>${escapeHTML(artist)}${date ? `<br>${escapeHTML(date)}` : ''}</p>${connection ? `<p class="meta">${escapeHTML(connection)}</p>` : ''}<span class="choice-label">${seed ? 'Follow this →' : 'This caught my eye →'}</span></button></article>`;
  }).join('')}</div>`;
}
function displaySearchResults(artworks) {
  return `<section class="search-results" aria-labelledby="results-heading"><h2 id="results-heading" tabindex="-1">Start here.</h2>
    <p class="lede">A few objects to begin exploring. Choose one that catches your eye.</p>
    <p class="meta">Your interests: ${preferenceLabels().map(escapeHTML).join(' · ')}</p>
    ${artworkCards(artworks)}</section>`;
}
function displayThread() {
  const seed = state.seed;
  const details = [seed.artistDisplayName, seed.objectDate].map(textValue).filter(Boolean);
  const types = [...new Set([seed.objectName, seed.classification].map(textValue).filter(Boolean))];
  return `<section aria-labelledby="thread-heading"><h1 id="thread-heading" tabindex="-1">Follow this thread.</h1>
    <div class="object-layout" data-seed-id="${escapeHTML(seed.objectID)}"><div class="object-stage"><img src="${escapeHTML(getImageURL(seed))}" alt="${escapeHTML(textValue(seed.title) || 'Untitled')}"></div>
    <div class="object-info"><h2>${escapeHTML(textValue(seed.title) || 'Untitled')}</h2>${details.length ? `<p class="meta">${details.map(escapeHTML).join(' · ')}</p>` : ''}${textValue(seed.medium) ? `<p class="medium">${escapeHTML(seed.medium)}</p>` : ''}${types.length ? `<p class="meta">${types.map(escapeHTML).join(' · ')}</p>` : ''}</div></div>
    <section class="search-results" aria-labelledby="related-heading"><h2 id="related-heading">${!state.loading && !state.results.length && !state.error ? 'End of this thread.' : 'Keep following.'}</h2>
    ${state.loading ? '<p role="status" aria-busy="true">Finding connections in The Met collection…</p>' : state.results.length ? artworkCards(state.results, seed) : state.error ? `<p role="status">${escapeHTML(state.error)}</p><button class="secondary" data-retry>Try again →</button>` : `<p role="status">We couldn't find another strong connection from this object.</p><button class="secondary" data-change-interests>Change interests →</button>`}</section></section>`;
}
async function selectArtwork(seed) {
  requestController?.abort();
  const version = ++searchVersion;
  requestController = new AbortController();
  const signal = requestController.signal;
  state = { ...state, seed, selectedID: seed.objectID, results: [], loading: true, explored: true, error: '' };
  const stats = { generation: ++generationNumber, seed, resultCount: 4, selectedTypes: [], selectedThemes: [], seenIDs: new Set([String(seed.objectID)]), detailAttempts: 0, searches: [], searchRequests: 0, objectRequests: 0, objectSuccesses: 0, failures: 0, rejected: [], apiErrors: [] };
  console.log('[Thread] Selected raw object:', seed);
  render();
  document.querySelector('#thread-heading')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  announce('Finding connections from your selected object.');
  try {
    const objects = await getRelatedObjects(seed, signal, stats);
    if (version !== searchVersion) return;
    state.results = objects;
    objects.forEach(artwork => shownObjects.set(artwork.objectID, artwork));
    // Empty/filtered successful responses end a thread; only failed retrieval is an API error.
    if (!objects.length && stats.failures && !stats.objectSuccesses && (!stats.searchSuccesses || (stats.detailAttempts > 0 && stats.rejected.filter(item => item.reason === 'object request failed').length === stats.detailAttempts))) state.error = "We couldn't reach The Met collection right now. Please try again.";
  } catch (error) {
    if (version !== searchVersion) return;
    state.error = 'Something went wrong finding connections. Please try again.';
    console.warn('[Thread] Generation error:', error);
  } finally {
    if (version === searchVersion) {
      state.loading = false;
      console.log('[Thread] Run report:', JSON.stringify({ generation: stats.generation, seedID: seed.objectID, seedTitle: seed.title, seedMetadata: { tags: seed.tags, objectName: seed.objectName, classification: seed.classification, medium: seed.medium, culture: seed.culture }, rejectedCount: stats.rejected.length, signals: stats.signals, searches: stats.searches, requests: stats.searchRequests + stats.objectRequests, detailAttempts: stats.detailAttempts, relatedIDs: state.results.map(a => a.objectID), connections: state.results.map(a => ({ objectID: a.objectID, title: a.title, reason: a.connectionReason, tags: a.tags, objectName: a.objectName, classification: a.classification, medium: a.medium, culture: a.culture })), apiErrors: stats.apiErrors }));
      render();
      announce(state.error || `${state.results.length} connections from ${textValue(seed.title) || 'this object'}.`);
    }
  }
}
function preferenceGroup(legend, help, group, options, selected, maximum) {
  return `<fieldset class="preference-group"><legend>${legend}</legend><p class="meta">${help} <span>Up to ${maximum}.</span></p><div class="preference-options">${Object.entries(options).map(([id, option]) => `<button type="button" class="preference-chip" data-group="${group}" data-preference="${id}" aria-pressed="${selected.includes(id)}" ${!selected.includes(id) && selected.length >= maximum ? 'disabled' : ''}>${escapeHTML(option.label)}</button>`).join('')}</div></fieldset>`;
}
function render() {
  if (state.seed) { main.innerHTML = displayThread(); return; }
  const choosing = !state.loading && !state.explored;
  main.innerHTML = choosing ? `<section class="opening"><div class="opening-copy"><span class="eyebrow">The Metropolitan Museum of Art</span><h1>Your museum<br>assistant.</h1><p class="lede">Explore The Met through the things you notice.</p><p class="concept-note">An independent collection explorer.<br>Not affiliated with The Metropolitan Museum of Art.</p></div><figure class="opening-art"><img src="assets/artworks/437881.jpg" alt="Young Woman with a Water Pitcher by Johannes Vermeer" fetchpriority="high"><figcaption class="caption">Johannes Vermeer · <i>Young Woman with a Water Pitcher</i>, ca. 1662<br>The Met, Open Access · Detail</figcaption></figure></section>
    <form id="preferences-form" class="preferences-form">
    ${preferenceGroup('What kinds of things catch your eye?', "Choose the kinds of objects you'd like to explore.", 'types', OBJECT_TYPES, state.types, 2)}
    ${preferenceGroup('What are you drawn to?', 'Pick a few themes that interest you.', 'themes', THEMES, state.themes, 3)}
    <p class="caption">Answer either question, or both.</p><button class="primary" type="submit" ${!state.types.length && !state.themes.length ? 'disabled' : ''}>Explore the collection →</button></form>`
    : state.loading ? '<section class="loading" aria-busy="true" role="status"><span class="eyebrow">A visit of your own</span><h1>Gathering a few places to begin…</h1><p class="lede">Looking through The Met collection.</p></section>'
    : state.results.length ? displaySearchResults(state.results) : `<section class="empty"><h1>Another way in.</h1><p>${escapeHTML(state.error || 'We couldn’t find usable images for this mix. Try again, or change your interests.')}</p><button class="secondary" data-retry>Try again →</button></section>`;
  if (state.results.length && state.error) main.insertAdjacentHTML('beforeend', `<p class="field-error" role="status">${escapeHTML(state.error)}</p>`);
}
async function explorePreferences() {
  if (state.loading) return;
  if (!state.types.length && !state.themes.length) { announce('Choose at least one interest.'); return; }
  requestController?.abort();
  const version = ++searchVersion;
  requestController = new AbortController();
  const signal = requestController.signal;
  state = { ...state, results: [], selectedID: null, seed: null, loading: true, explored: false, error: '' };
  const searches = getPreferenceSearches();
  const stats = { generation: ++generationNumber, objectSuccesses: 0, apiErrors: [], reusedPrevious: 0, selectedTypes: [...state.types], selectedThemes: [...state.themes], seenIDs: new Set(), detailAttempts: 0, preferences: preferenceLabels(), mappedTerms: [...state.types.map(id => OBJECT_TYPES[id].terms), ...state.themes.map(id => THEMES[id].terms)], searches: [], searchRequests: 0, objectRequests: 0, failures: 0, rejected: [] };
  console.log('[Discovery] Generation started:', stats.generation);
  console.log('[Discovery] Preferences and mapped terms:', stats.preferences, stats.mappedTerms);
  console.log('[Discovery] Planned searches:', searches);
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  announce('Gathering objects for your interests.');
  try {
    const objects = await getPreferenceObjects(searches, signal, stats);
    if (version !== searchVersion) return;
    state.results = objects;
    objects.forEach(artwork => shownObjects.set(artwork.objectID, artwork));
    if (!objects.length && stats.failures && stats.objectSuccesses === 0) state.error = "We couldn't reach The Met collection right now. Please try again.";
  } catch (error) {
    if (version !== searchVersion) return;
    state.error = 'Something went wrong preparing these objects. Please try again.';
    console.warn('[Discovery] Generation error:', { generation: stats.generation, message: error.message });
  } finally {
    if (version === searchVersion) {
      state.loading = false;
      state.explored = true;
      console.log('[Discovery] Generation summary:', JSON.stringify({ generation: stats.generation, requests: stats.searchRequests + stats.objectRequests, detailAttempts: stats.detailAttempts, fetchedRecords: stats.objectSuccesses, accepted: stats.accepted || 0, rejected: stats.rejected.length, reusedPrevious: stats.reusedPrevious, finalCount: state.results.length, apiErrors: stats.apiErrors }));
      console.log('[Discovery] Displayed raw objects:', state.results);
      console.log('[Discovery] Run report:', JSON.stringify({ ...stats, displayed: state.results.map(({ objectID, title, artistDisplayName, objectName, classification, medium, department }) => ({ objectID, title, artistDisplayName, objectName, classification, medium, department })) }));
      render();
      document.querySelector('#results-heading')?.focus({ preventScroll: true });
      announce(state.error || `${state.results.length} objects to begin exploring.`);
    }
  }
}
document.addEventListener('submit', event => {
  if (!event.target.matches('#preferences-form')) return;
  event.preventDefault();
  explorePreferences();
});
document.addEventListener('click', event => {
  const chip = event.target.closest('[data-preference]');
  if (chip && !chip.disabled) {
    const { group, preference } = chip.dataset;
    const selected = state[group];
    const maximum = group === 'types' ? 2 : 3;
    if (selected.includes(preference)) state[group] = selected.filter(id => id !== preference);
    else if (selected.length < maximum) selected.push(preference);
    render();
    document.querySelector(`[data-preference="${preference}"]`)?.focus({ preventScroll: true });
  }
  const choice = event.target.closest('[data-select-artwork]');
  if (choice) {
    const object = state.results.find(artwork => String(artwork.objectID) === choice.dataset.selectArtwork);
    if (object) selectArtwork(object);
  }
  if (event.target.closest('[data-retry]')) {
    if (state.seed) selectArtwork(state.seed); else explorePreferences();
  }
});
main.addEventListener('error', event => {
  const card = event.target.closest('.search-grid .collected');
  if (card) {
    state.results = state.results.filter(artwork => String(artwork.objectID) !== card.dataset.objectId);
    state.error = 'An image became unavailable. Change your interests to explore again.';
    render();
    announce(state.error);
  }
}, true);
document.querySelector('#restart').addEventListener('click', () => {
  requestController?.abort();
  searchVersion++;
  state = { ...state, results: [], selectedID: null, seed: null, loading: false, explored: false, error: '' };
  render();
  document.querySelector('[data-preference]')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  announce('Change your interests. Your previous selections are kept.');
});
render();
