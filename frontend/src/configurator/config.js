/**
 * ============================================================================
 *  SINGLE-PAGE CONFIGURATOR — configuration
 * ============================================================================
 *  You should NOT need to edit this file. All values come from environment
 *  variables in `frontend/.env` (copy `frontend/.env.example` to get started),
 *  where you use SIMPLE names with NO prefix (e.g. ACC_PROJECT_ID).
 *
 *  The launcher `scripts/with-config-env.js` mirrors each of those to a
 *  REACT_APP_<NAME> copy at start time (that's the only way Create React App
 *  exposes them to the browser), which is why this file reads REACT_APP_*.
 *  `npm run dev` watches `.env` and restarts the frontend when you save it.
 * ============================================================================
 */
const env = process.env;

export const CONFIGURATOR_CONFIG = {
  // --- Where the products live (hard-coded; no project/folder pickers) ---
  // Note: the account/hub id is NOT needed — every Informed Design call keys off
  // accessId = projectId|folderUrn with accessType=ACC.
  projectId: env.REACT_APP_ACC_PROJECT_ID || '', // ACC project id ("b." prefix ok)
  folderUrn: env.REACT_APP_ACC_FOLDER_URN || '', // Folder URN, e.g. "urn:adsk.wipprod:fs.folder:co.XXXX"

  // Product and release are chosen in the product gallery, not configured here.

  // Output format to generate and preview. SVF renders in the Autodesk Viewer.
  outputType: env.REACT_APP_OUTPUT_TYPE || 'SVF',

  // --- Placeholder branding — override in .env ---
  branding: {
    companyName: env.REACT_APP_YOUR_BRAND_NAME || 'Your Company',
    productTitle: env.REACT_APP_YOUR_BRAND_TITLE || 'Product Configurator',
    // Placeholder logo: a local file in frontend/public/ (NOT a URL). Replace
    // logo-placeholder.svg with your own, or point this at another public/ file.
    logoUrl: env.REACT_APP_YOUR_BRAND_LOGO || '/logo-placeholder.svg',
    primaryColor: env.REACT_APP_YOUR_BRAND_PRIMARY || '#0696d7',
    accentColor: env.REACT_APP_YOUR_BRAND_ACCENT || '#1a1a1a',
    backgroundColor: env.REACT_APP_YOUR_BRAND_BG || '#f4f5f7',
  },
};

/** True once the required IDs (project + folder) have been provided in .env. */
export const isConfigured = () =>
  [CONFIGURATOR_CONFIG.projectId, CONFIGURATOR_CONFIG.folderUrn]
    .every((v) => typeof v === 'string' && v.trim().length > 0);
