import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Viewer from '../Viewer';
import { useAuth } from '../hooks/useAuth';
import { generateVariantName, saveFileWithDialog } from '../utils/helpers';
import { CONFIGURATOR_CONFIG, isConfigured } from './config';
import {
  loadProducts,
  loadReleaseInputs,
  runConfiguration,
  fetchProductThumbnailUrl,
  evaluateRules,
  downloadOutputTypes,
  representationsForType,
  typeNeedsRepresentation,
  generateDownload,
  describeApiError,
} from './configuratorService';
import { pid, pname, relId, relNumber, isDefaultRelease } from './labels';
import { setConfigureFocus } from './mode';
import ProductGallery from './ProductGallery';
import ConfiguratorForm from './ConfiguratorForm';
import DownloadPanel from './DownloadPanel';
import ModeToggle from './ModeToggle';
import DebugPanel from './DebugPanel';
import './configurator.css';

const { branding } = CONFIGURATOR_CONFIG;

/**
 * Identifies the configuration the viewer's model was built from, so downloads
 * are only offered while the form still matches it.
 *
 * Read-only parameters are excluded because the rules recompute them: adopting
 * an engine-computed Family_Type_Name would otherwise change the signature and
 * retire a perfectly good variant's downloads without the user touching a thing.
 */
const configSignature = (values, inputs) =>
  JSON.stringify(
    (inputs || [])
      .filter((p) => !p.readOnly)
      .map((p) => {
        const key = p.name || p.key;
        return [key, values[key]];
      })
  );

/**
 * Whether to mount the raw-API inspector (see DebugPanel).
 *
 * Off by default — it is a debugging aid, not part of the configurator. Turn it
 * on for a session with `?debug=1`, or persistently in the console with
 * `localStorage.setItem('cfg_debug', '1')`. Development builds only, so it can
 * never appear in the template a customer ships.
 */
const showDebugPanel =
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).has('debug') ||
    localStorage.getItem('cfg_debug') === '1');

/** Apply the placeholder branding as CSS variables (see configurator.css). */
function useBranding() {
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--brand-primary', branding.primaryColor);
    root.setProperty('--brand-accent', branding.accentColor);
    root.setProperty('--brand-bg', branding.backgroundColor);
  }, []);
}

function Header({ onLogout, showLogout, showModeToggle = true }) {
  return (
    <header className="cfg-header">
      <div className="cfg-brand">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.companyName} className="cfg-logo" />
        ) : (
          <span className="cfg-logo-badge">{(branding.companyName || '?').charAt(0)}</span>
        )}
        <span className="cfg-brand-name">{branding.companyName}</span>
        <span className="cfg-brand-sep">/</span>
        <span className="cfg-brand-title">{branding.productTitle}</span>
      </div>
      <div className="cfg-header-right">
        {showModeToggle && <ModeToggle />}
        {showLogout && <button className="cfg-signout" onClick={onLogout}>Sign out</button>}
      </div>
    </header>
  );
}

/**
 * Do two access descriptors point at the same project + folder?
 *
 * Module scope on purpose: it is used inside an effect, and defining it in the
 * component body would give it a new identity every render and force it into
 * that effect's dependency array.
 */
const sameAccess = (a, b) =>
  a === b || (!!a && !!b && a.projectId === b.projectId && a.folderUrn === b.folderUrn);

/**
 * @param {object} props
 * @param {boolean} [props.embedded] - rendered inside the demo app, which already
 *   provides the menu bar, auth and the project/folder pickers. Hides this
 *   component's own header and auth gate.
 * @param {string} [props.projectId] - overrides ACC_PROJECT_ID from .env
 * @param {string} [props.folderUrn] - overrides ACC_FOLDER_URN from .env
 */
export default function ConfiguratorApp({ embedded = false, projectId, folderUrn } = {}) {
  useBranding();
  const { isAuthenticated, loading: authLoading, error: authError, handleLogin, handleLogout } = useAuth();

  const [view, setView] = useState('gallery'); // 'gallery' | 'configure'

  // Counts entries into the configure view. Everything that must be fresh per
  // entry keys on THIS, not on the release id: re-entering the same product
  // leaves selectedReleaseId unchanged, so effects keyed on it never re-run and
  // the view opens with no inputs reloaded and no preview. Monotonic, so a stale
  // async run can always tell it has been superseded.
  const entryRef = useRef(0);
  const [entryId, setEntryId] = useState(0);

  const [products, setProducts] = useState(null); // null = not loaded
  // Which folder the products in state actually came from. Set together with
  // `products`, and checked before anything fetches per-product data — see the
  // thumbnail effect for why the two must be kept in step.
  const [productsAccess, setProductsAccess] = useState(null);
  const [productsError, setProductsError] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [cardRelease, setCardRelease] = useState({}); // productId -> releaseId (gallery selection)

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [release, setRelease] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [inputsLoading, setInputsLoading] = useState(false);
  const [inputsError, setInputsError] = useState(null);

  const [values, setValues] = useState({});
  const [variantName, setVariantName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [genError, setGenError] = useState(null);
  const [svfUrl, setSvfUrl] = useState(null);
  // Set when the API refuses to generate the preview for a variant that was
  // otherwise created fine — a message in the viewer pane, not a failed run.
  const [previewUnavailable, setPreviewUnavailable] = useState(null); // the output type
  const [previewError, setPreviewError] = useState(null);             // why the API said no

  // The variant currently shown in the viewer, plus a snapshot of the form values
  // it was built from. Downloads are generated from THIS variant, so they're only
  // offered while the form still matches it.
  const [activeConfig, setActiveConfig] = useState(null); // { variantId, variantName, sig }
  const [dlType, setDlType] = useState('');
  const [dlRep, setDlRep] = useState('');
  const [dlBusy, setDlBusy] = useState(false);
  const [dlStatus, setDlStatus] = useState('');
  const [dlError, setDlError] = useState(null);

  // Validation rules for the selected release (same rules the demo app enforces).
  const [rulesKey, setRulesKey] = useState(null);
  const [validationCode, setValidationCode] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({}); // inputName -> { error, updatedValue }
  const [validating, setValidating] = useState(false);
  // Per-parameter state as resolved by the rules engine, keyed by name. This is
  // what makes conditional visibility work — see evaluateRules.
  const [evaluated, setEvaluated] = useState({});

  // Verbatim API payloads, shown by the dev-only DebugPanel. Parsed state hides
  // what the API actually said, which is the first thing you need when a field
  // renders wrongly.
  const [rawRules, setRawRules] = useState(null);
  const [rulesError, setRulesError] = useState(null);
  const [evaluateRaw, setEvaluateRaw] = useState(undefined);
  const [evaluateSent, setEvaluateSent] = useState(undefined);
  const [layoutKey, setLayoutKey] = useState(null);
  const [rawLayout, setRawLayout] = useState(null);
  const [layoutError, setLayoutError] = useState(null);

  // Which entry we've already auto-previewed, so entering a product renders its
  // defaults once instead of on every re-render.
  const autoRanFor = useRef(null);
  // Never start a second run while one is in flight.
  const inFlight = useRef(false);
  // False until the user edits the name, after which we stop regenerating it.
  const nameEdited = useRef(false);
  // The most recent evaluation, readable synchronously. handleConfigure needs it
  // right after the gate runs, when the `evaluated` state has not landed yet.
  const latestEvaluated = useRef({});
  // Which entry the inputs currently in state belong to. A ref, because it has to
  // be readable in the same commit it changes: `inputsLoading` is state, so on the
  // render where a new product is picked it is still false, and an auto-preview
  // keyed on it fired with the PREVIOUS product's inputs against the NEW product's
  // release. The API rejected exactly that: "Variant input is not an input of
  // Product".
  const loadedEntry = useRef(null);

  // When embedded, the demo app's pickers drive which folder we read; standalone
  // falls back to .env inside the service layer.
  const access = useMemo(
    () => (projectId && folderUrn ? { projectId, folderUrn } : null),
    [projectId, folderUrn]
  );
  const hasAccess = embedded ? Boolean(projectId && folderUrn) : isConfigured();

  const token = typeof window !== 'undefined' ? localStorage.getItem('aps_access_token') : null;
  const selectedProduct = products && products.find((p) => pid(p) === selectedProductId);

  // 1. Load products for the configured folder once authenticated.
  useEffect(() => {
    // Drop the previous folder's cards first. The fetch takes a moment, and
    // leaving them up means the gallery shows another folder's products as if
    // they were this one's — briefly, but long enough to click one. null is the
    // not-loaded state, so this renders "Loading products…" instead.
    setProducts(null);
    setProductsAccess(null);
    setThumbs({});
    setCardRelease({});
    setProductsError(null);

    if ((!embedded && !isAuthenticated) || !hasAccess) return undefined;

    // Bail out LOUDLY when there's no token. Returning quietly here leaves
    // `products` at null, and null is the not-loaded state that renders
    // "Loading products…" — so a missing token used to look like a fetch that
    // never finished, with nothing on screen or in the console to say why.
    // (The token used to disappear on its own: a failed profile call deleted
    // it. That is fixed in useAuth, but the state still has to be honest.)
    if (!token) {
      setProductsError('Not signed in, or the session expired. Sign in again to load products.');
      return undefined;
    }

    let cancelled = false;
    loadProducts(token, access)
      .then((ps) => {
        if (cancelled) return;
        // Set together and never apart: these two are a pair.
        setProducts(ps);
        setProductsAccess(access);
        const cr = {};
        ps.forEach((p) => {
          const rels = p.releases || [];
          cr[pid(p)] = relId(p.defaultRelease) || (rels[0] && relId(rels[0])) || '';
        });
        setCardRelease(cr);
      })
      .catch((err) => !cancelled && setProductsError(err.message));
    return () => { cancelled = true; };
  }, [isAuthenticated, token, access, hasAccess, embedded]);

  // 2. Fetch thumbnails (blob object URLs) once products are known.
  useEffect(() => {
    if (!products || !token) return;

    // Only fetch when the products in state actually belong to the current
    // folder. Changing folder updates `access` first; on that commit `products`
    // still holds the PREVIOUS folder's list, because the effect above has only
    // just queued `setProducts(null)`. Without this guard, every visible card
    // asked for its thumbnail under the new folder's accessId — products that do
    // not exist there — and the API answered 404 for each one. Harmless-looking
    // (the URLs are discarded) but it filled the console with red on every
    // folder change and made a real 404 impossible to spot.
    if (!sameAccess(productsAccess, access)) return;
    let cancelled = false;
    const created = [];
    (async () => {
      const entries = await Promise.all(
        products.map(async (p) => {
          const url = await fetchProductThumbnailUrl(token, pid(p), access);
          if (url) created.push(url);
          return [pid(p), url];
        })
      );
      if (!cancelled) setThumbs(Object.fromEntries(entries.filter(([, u]) => u)));
    })();
    return () => { cancelled = true; created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [products, productsAccess, token, access]);

  // 3. When a release is chosen for configuring, load its inputs and seed the form.
  useEffect(() => {
    // Synchronously mark the inputs in state as belonging to no entry. Anything
    // that runs later in THIS commit — the auto-preview below — must not act on
    // them until the load below replaces them.
    loadedEntry.current = null;
    if (!token || !selectedReleaseId) { setInputs([]); setRelease(null); return; }
    let cancelled = false;
    setInputsLoading(true);
    setInputsError(null);
    setFieldErrors({});
    setEvaluated({});
    setRawRules(null);
    setRulesError(null);
    setRawLayout(null);
    setLayoutError(null);
    setLayoutKey(null);
    setEvaluateRaw(undefined);
    setEvaluateSent(undefined);
    nameEdited.current = false;
    loadReleaseInputs(token, selectedReleaseId, access)
      .then(({ release: rel, inputs: ins, rulesKey: rk, validationCode: vc, rawRules: rr, rulesError: re_,
                layoutKey: lk, rawLayout: rl, layoutError: le }) => {
        if (cancelled) return;
        loadedEntry.current = entryId;   // these inputs describe THIS release
        setRelease(rel);
        setInputs(ins);
        setRulesKey(rk);
        setValidationCode(vc);
        setRawRules(rr);
        setRulesError(re_);
        setLayoutKey(lk);
        setRawLayout(rl);
        setLayoutError(le);
        const initial = {};
        ins.forEach((p) => {
          const key = p.name || p.key;
          if (p.defaultValue !== undefined) initial[key] = p.defaultValue;
        });
        setValues(initial);
        setVariantName(generateVariantName(selectedProduct, initial, ins));
        setDlType('');
        setDlRep('');
      })
      .catch((err) => !cancelled && setInputsError(err.message))
      .finally(() => !cancelled && setInputsLoading(false));
    return () => { cancelled = true; };
    // entryId, so re-entering the same release still reseeds the form to its
    // defaults and clears the name/download/validation state below.
  }, [token, selectedReleaseId, entryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editing a field clears its stale error and, unless the user has taken over the
  // name, regenerates the auto-name from the new values (matches CreateVariantForm).
  const handleFieldChange = useCallback(
    (key, value) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        if (!nameEdited.current) {
          setVariantName(generateVariantName(selectedProduct, next, inputs));
        }
        return next;
      });
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [selectedProduct, inputs]
  );

  const backToGallery = useCallback(() => {
    setView('gallery');
    setSvfUrl(null);
    setPreviewUnavailable(null);
    setPreviewError(null);
    setActiveConfig(null);
  }, []);

  // Which release is being configured, for the menu-bar breadcrumb and the
  // release chip. Computed here rather than at render because the focus effect
  // below publishes it to the menu bar.
  const selectedReleaseIndex = (selectedProduct?.releases || []).findIndex((r) => relId(r) === selectedReleaseId);
  const selectedRelease = (selectedProduct?.releases || [])[selectedReleaseIndex];

  // Hand the demo app's menu bar everything it needs to become the
  // configurator's own chrome while the full-page configure view is open:
  // the product identity, and the way back out. Restored on exit/unmount.
  useEffect(() => {
    if (!embedded) return undefined;
    if (view !== 'configure') {
      setConfigureFocus(false);
      return undefined;
    }
    setConfigureFocus(true, {
      productName: pname(selectedProduct),
      releaseNumber: selectedRelease ? relNumber(selectedRelease, selectedReleaseIndex) : null,
      isDefaultRelease: selectedRelease ? isDefaultRelease(selectedRelease, selectedProduct) : false,
      onBack: backToGallery,
    });
    return () => setConfigureFocus(false);
  }, [embedded, view, selectedProduct, selectedRelease, selectedReleaseIndex, backToGallery]);

  const handleVariantNameChange = useCallback((name) => {
    nameEdited.current = true; // stop auto-generating once they've typed their own
    setVariantName(name);
  }, []);

  /**
   * Validate the whole form against the release rules. Called on field blur,
   * whenever a value settles, and before Configure — the rules are cross-field
   * (changing Width can invalidate Depth, or hide Infill_Color), so validating
   * a single field in isolation would miss that.
   */
  const runValidation = useCallback(async () => {
    if (!token || !rulesKey || !inputs.length) return true;
    setValidating(true);
    try {
      const { valid, errorsByInput, evaluated, updates, raw, sent } = await evaluateRules(token, {
        rulesKey,
        inputs,
        formValues: values,
      });
      setFieldErrors(errorsByInput);
      setEvaluated(evaluated);
      latestEvaluated.current = evaluated;
      setEvaluateRaw(raw);
      setEvaluateSent(sent);

      // Adopt corrections the engine made to values the user owns — an
      // off-increment number, say. Read-only parameters are deliberately NOT
      // touched here: Informed Design owns those, and they arrive with the
      // result of Configure. Writing a predicted value in the meantime would
      // just be this client guessing ahead of the source of truth.
      const adopted = {};
      Object.entries(updates).forEach(([name, updatedValue]) => {
        const isReadOnly =
          evaluated[name]?.readOnly ??
          inputs.find((p) => (p.name || p.key) === name)?.readOnly;
        if (!isReadOnly) adopted[name] = updatedValue;
      });
      if (Object.keys(adopted).length) {
        setValues((prev) => {
          const next = { ...prev, ...adopted };
          return Object.keys(adopted).some((k) => prev[k] !== next[k]) ? next : prev;
        });
      }
      return valid;
    } catch (err) {
      // A failing rules service must not block configuring — the demo app treats
      // an unreachable evaluator as "no opinion" rather than invalid.
      console.warn('[configurator] rules evaluation failed:', err);
      return true;
    } finally {
      setValidating(false);
    }
  }, [token, rulesKey, inputs, values]);


  // Validation runs on COMMITTED changes only — a blur, a dropdown selection, a
  // spinner press. Never per keystroke: typing "1000" would otherwise be
  // evaluated as 1, then 10, then 100, rejecting each as below the minimum
  // before the user had finished the number.
  //
  // It still cannot be called straight from a change handler, because a
  // parameter's visibility depends on the OTHER parameters and the handler
  // closes over the pre-change values. So a commit bumps this counter and the
  // effect below runs afterwards, when `values` is current.
  const [validateTick, setValidateTick] = useState(0);
  const requestValidation = useCallback(() => setValidateTick((t) => t + 1), []);

  const runValidationRef = useRef(runValidation);
  useEffect(() => { runValidationRef.current = runValidation; });

  useEffect(() => {
    if (validateTick === 0) return;
    runValidationRef.current();
  }, [validateTick]);

  const startConfigure = (productId, releaseId) => {
    setSelectedProductId(productId);
    setSelectedReleaseId(releaseId);
    setSvfUrl(null);
    setPreviewUnavailable(null);
    setPreviewError(null);
    setGenError(null);
    setActiveConfig(null);
    setDlError(null);
    // A run left over from a previous entry can no longer complete into this one
    // (handleConfigure discards superseded results), so it must not block this
    // entry's preview.
    inFlight.current = false;
    entryRef.current += 1;
    setEntryId(entryRef.current);
    setView('configure');
  };

  /**
   * Create a variant from the current values, generate its SVF, and load it.
   *
   * Validation gates all of it: the release's rules run first, and nothing is
   * created — no variant, no SVF, no download options — unless they pass.
   *
   * The rules also run on blur for immediate per-field feedback, but that result
   * is not trusted here; the values can change after the last blur, so this
   * re-checks against exactly what is about to be sent.
   */
  const handleConfigure = useCallback(async () => {
    // Both of these used to return silently, so a click that hit one of them
    // looked like a dead button — no spinner, no message, nothing in the UI to
    // distinguish it from a request that had been sent. Say why instead.
    if (!token || !release || !selectedReleaseId) {
      const missing = [
        !token && 'no access token (try signing in again)',
        !release && 'the release has not finished loading',
        !selectedReleaseId && 'no release selected',
      ].filter(Boolean).join('; ');
      console.warn('[configurator] Configure ignored — not ready', {
        hasToken: Boolean(token), hasRelease: Boolean(release), selectedReleaseId,
      });
      setGenError(`Can't configure yet: ${missing}.`);
      return;
    }
    if (inFlight.current) {
      console.warn('[configurator] Configure ignored — a run is already in flight');
      setGenError('Still building the previous configuration — one moment.');
      return;
    }

    // Generating takes seconds, and the user can go back and enter another
    // product meanwhile. Results from that older entry belong to a product no
    // longer on screen — showing them would put the wrong model in the viewer
    // and offer downloads for the wrong variant, so they're dropped.
    const myEntry = entryRef.current;
    const isCurrent = () => entryRef.current === myEntry;

    inFlight.current = true;
    setGenerating(true);
    setGenError(null);
    setGenStatus('Checking values…');
    try {
      // The gate. Nothing below this line runs unless the release's rules
      // accept the current values.
      const valid = await runValidation();
      if (!isCurrent()) return;
      if (!valid) {
        setGenError('Some values are not allowed by this release — see the highlighted fields.');
        return;
      }

      setGenStatus('Creating variant…');
      const { svfUrl: url, variantId, variantName: usedName, outputId,
              previewUnavailable: noPreview, previewError: noPreviewWhy } =
        await runConfiguration(
          token,
          { product: selectedProduct, releaseId: selectedReleaseId, release, inputs, formValues: values, variantName, access },
          (status) => isCurrent() && setGenStatus(status)
        );
      if (!isCurrent()) return;
      console.log('[configurator] configured', { variantId, outputId, url, noPreview });
      setSvfUrl(url || null);
      setPreviewUnavailable(noPreview || null);
      setPreviewError(noPreviewWhy || null);

      // The configuration is now built, so the rules' computed values describe
      // something real — show them. They come from the evaluation the gate just
      // ran, which used exactly the values this variant was created from.
      const computed = {};
      Object.entries(latestEvaluated.current || {}).forEach(([name, s]) => {
        if (s.readOnly && s.value !== undefined) computed[name] = s.value;
      });
      if (Object.keys(computed).length) setValues((prev) => ({ ...prev, ...computed }));

      // Mark this configuration active so its downloads become available.
      setActiveConfig({ variantId, variantName: usedName, sig: configSignature(values, inputs) });
      setDlError(null);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('[configurator] configure failed:', err, err.details);
      setGenError(describeApiError(err));
    } finally {
      // A newer entry owns these now — clearing them would cancel its spinner.
      if (isCurrent()) {
        inFlight.current = false;
        setGenerating(false);
        setGenStatus('');
      }
    }
  }, [token, release, selectedReleaseId, selectedProduct, inputs, values, variantName, access, runValidation]);

  /**
   * "Active" = the variant we hold was built from exactly these form values, so
   * the offered downloads will match what the form says. Any edit invalidates it
   * until Configure is pressed again.
   *
   * Deliberately not gated on `svfUrl`: a release that publishes no SVF still
   * produces a real variant, and its downloads are the whole point of the run.
   */
  const isActive =
    Boolean(activeConfig) &&
    (Boolean(svfUrl) || Boolean(previewUnavailable)) &&
    activeConfig.sig === configSignature(values, inputs);

  const dlTypes = useMemo(() => (release ? downloadOutputTypes(release) : []), [release]);
  const dlReps = useMemo(
    () => (release && dlType ? representationsForType(release, dlType) : []),
    [release, dlType]
  );

  // Changing type invalidates the chosen representation (they're type-specific).
  const handleTypeChange = useCallback((type) => {
    setDlType(type);
    setDlError(null);
    const reps = release && type ? representationsForType(release, type) : [];
    // Preselect when there's only one real choice, so the button is usable at once.
    setDlRep(reps.length === 1 ? reps[0] : '');
  }, [release]);

  const handleDownload = useCallback(async () => {
    if (!token || !activeConfig || !dlType || dlBusy) return;
    const needsRep = typeNeedsRepresentation(dlType);
    if (needsRep && !dlRep) return;

    setDlBusy(true);
    setDlStatus('Requesting…');
    setDlError(null);
    try {
      const { blob, fileName } = await generateDownload(
        token,
        {
          variantId: activeConfig.variantId,
          variantName: activeConfig.variantName,
          release,
          type: dlType,
          representation: needsRep ? dlRep : null,
          access,
        },
        setDlStatus
      );
      await saveFileWithDialog(blob, fileName);
    } catch (err) {
      console.error(`[configurator] download failed (${dlType}${dlRep ? '/' + dlRep : ''}):`, err, err.details);
      setDlError(describeApiError(err));
    } finally {
      setDlBusy(false);
      setDlStatus('');
    }
  }, [token, activeConfig, dlType, dlRep, dlBusy, release, access]);

  // Preview the release's DEFAULT configuration as soon as its inputs load, so the
  // viewer shows the model matching the values already on screen. Runs once per
  // release entry; after this, previewing is driven by the Configure button.
  useEffect(() => {
    if (!release || !selectedReleaseId || inputsLoading) return;
    // The inputs in state must belong to THIS entry. Without this the preview
    // could fire mid-switch and post the previous product's inputs against the
    // new product's release.
    if (loadedEntry.current !== entryId) return;
    if (autoRanFor.current === entryId) return;
    autoRanFor.current = entryId;
    handleConfigure();
  }, [release, selectedReleaseId, inputsLoading, entryId, handleConfigure]);

  // --- Not configured yet -------------------------------------------------
  // Embedded: the demo app's pickers supply this, so prompt to pick a folder
  // rather than telling the user to edit .env.
  if (embedded && !hasAccess) {
    return (
      <div className="cfg-embedded">
        <p className="cfg-empty cfg-center">Select an account, project and folder to configure products.</p>
      </div>
    );
  }

  if (!embedded && !isConfigured()) {
    return (
      <div className="cfg-root">
        <Header showLogout={false} />
        <div className="cfg-notice">
          <h2>Almost there</h2>
          <p>Set your project and folder in <code>frontend/.env</code>
            (<code>ACC_PROJECT_ID</code>, <code>ACC_FOLDER_URN</code>).</p>
          <p>See <code>SINGLE_PAGE_CONFIGURATOR.md</code> for where to find those IDs.</p>
        </div>
      </div>
    );
  }

  // --- Signed out ---------------------------------------------------------
  // Embedded mode never shows this: the demo app already gated on auth.
  if (!embedded && !isAuthenticated) {
    return (
      <div className="cfg-root">
        <Header showLogout={false} />
        <div className="cfg-login">
          <h1>{branding.productTitle}</h1>
          <p>Sign in with your Autodesk account to browse products.</p>
          <button className="cfg-submit cfg-login-btn" onClick={handleLogin} disabled={authLoading}>
            {authLoading ? 'Signing in…' : 'Sign in with Autodesk'}
          </button>
          {authError && <p className="cfg-error">{authError}</p>}
        </div>
      </div>
    );
  }

  // --- Gallery ------------------------------------------------------------
  if (view === 'gallery') {
    return (
      <div className={embedded ? 'cfg-root cfg-embedded' : 'cfg-root'}>
        {!embedded && <Header showLogout onLogout={handleLogout} />}
        <div className="cfg-gallery-wrap">
          {!products && !productsError && <p className="cfg-empty cfg-center">Loading products…</p>}
          {productsError && <p className="cfg-error cfg-center">{productsError}</p>}
          {products && products.length === 0 && <p className="cfg-empty cfg-center">No products in this folder.</p>}
          {products && products.length > 0 && (
            <ProductGallery
              products={products}
              thumbs={thumbs}
              cardRelease={cardRelease}
              onReleaseChange={(id, rid) => setCardRelease((prev) => ({ ...prev, [id]: rid }))}
              onConfigure={startConfigure}
            />
          )}
        </div>
      </div>
    );
  }

  // --- Configurator (left form + right viewer) ----------------------------
  // Embedded, the configure view breaks out of the products panel and takes the
  // whole window: squeezing a form + 3D viewer into that column wastes the space
  // the viewer needs.
  //
  // The product name, release chip and the way back all live in the menu bar
  // when embedded — the panel is the only column that needs its vertical space,
  // and a heading that never changes while you're in here does not earn a band
  // of it. Standalone keeps them in the panel: that header is the customer's
  // own and is not ours to fill.
  return (
    <div className={`cfg-root${embedded ? ' cfg-fullpage' : ''}`}>
      {/* Embedded, the demo app's menu bar above already carries the branding
          and the breadcrumb — a second header would duplicate it. */}
      {!embedded && <Header showLogout onLogout={handleLogout} />}

      <div className="cfg-body">
        <aside className="cfg-panel">
          {/* Embedded, the menu bar's breadcrumb carries both the identity and
              the way back, so the panel starts straight at the form. */}
          {!embedded && (
            <>
              {/* Back and the release chip share one row so neither costs its
                  own band of vertical space. */}
              <div className="cfg-panel-top">
                <button className="cfg-back" onClick={backToGallery}>
                  <span aria-hidden="true">←</span> Products
                </button>
                {selectedRelease && (
                  <span className="cfg-release-chip">
                    Release {relNumber(selectedRelease, selectedReleaseIndex)}
                    {isDefaultRelease(selectedRelease, selectedProduct) && (
                      <span className="cfg-release-default" title="Default release"> ★</span>
                    )}
                  </span>
                )}
              </div>

              <div className="cfg-panel-head">
                <h1 className="cfg-product-name">{pname(selectedProduct)}</h1>
              </div>
            </>
          )}

          {inputsLoading && <p className="cfg-empty">Loading inputs…</p>}
          {inputsError && <p className="cfg-error">{inputsError}</p>}
          {!inputsLoading && !inputsError && (
            <ConfiguratorForm
              inputs={inputs}
              values={values}
              onChange={handleFieldChange}
              onBlurValidate={requestValidation}
              validationCode={validationCode}
              evaluated={evaluated}
              fieldErrors={fieldErrors}
              validating={validating}
              variantName={variantName}
              onVariantNameChange={handleVariantNameChange}
              onSubmit={handleConfigure}
              generating={generating}
              error={genError}
              downloadEnabled={isActive}
              downloadPanel={
                <DownloadPanel
                  types={dlTypes}
                  representations={dlReps}
                  selectedType={dlType}
                  selectedRepresentation={dlRep}
                  onTypeChange={handleTypeChange}
                  onRepresentationChange={setDlRep}
                  onDownload={handleDownload}
                  busy={dlBusy}
                  statusText={dlStatus}
                  error={dlError}
                />
              }
            />
          )}

        </aside>

        <main className="cfg-viewer">

          {svfUrl ? (
            // Deliberately NOT keyed on svfUrl. Remounting made Autodesk's
            // Initializer callback fire before React re-attached the container
            // ref, so Viewer bailed with "viewerContainer.current is null" and
            // never loaded the new model. Its own effect already re-runs on an
            // svfUrl change, which reloads in the still-mounted container.
            <Viewer svfUrl={svfUrl} token={token} autoFit />
          ) : previewUnavailable && !generating ? (
            // The variant built; the API just wouldn't generate a preview for
            // it. Say so — and say why — rather than leaving "Preparing
            // preview…" up forever over a configuration that actually exists.
            <div className="cfg-viewer-placeholder">
              <p>No {previewUnavailable} preview could be generated for this release.</p>
              <p className="cfg-viewer-note">The configuration was created — downloads are available.</p>
              {previewError && <p className="cfg-viewer-note">{previewError}</p>}
            </div>
          ) : (
            <div className="cfg-viewer-placeholder">
              <p>{generating ? (genStatus || 'Generating…') : 'Preparing preview…'}</p>
            </div>
          )}

          {/* While a new variant is building, the model on screen is the PREVIOUS
              one. Without this the wait looks like a no-op. */}
          {svfUrl && generating && (
            <div className="cfg-viewer-busy">
              <span className="cfg-spinner" aria-hidden="true" />
              <span>{genStatus || 'Generating…'}</span>
            </div>
          )}
        </main>
      </div>

      {showDebugPanel && (
        <DebugPanel
          rulesKey={rulesKey}
          rawRules={rawRules}
          rulesError={rulesError}
          evaluateRaw={evaluateRaw}
          evaluateSent={evaluateSent}
          layoutKey={layoutKey}
          rawLayout={rawLayout}
          layoutError={layoutError}
          release={release}
        />
      )}
    </div>
  );
}
