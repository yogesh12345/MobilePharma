import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
} from "react";
import API from "../services/api";
import { createPortal } from "react-dom";

interface AutoCompleteItem {
  id: number | string;
  label1: string;
  label2?: string;
  label3?: string;
  label4?: string;
  label5?: string;
  PaymentMode?: string;
  paymentMode?: string;
}

interface GenericAutoCompleteProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSelect: (item: AutoCompleteItem) => void;
  suppressOpen?: boolean;
  endpoint: string;
  listWidth?: string;
  myplacehoder?: string;
  mode?: "live" | "onCondition";
  setMode?: (val: "live" | "onCondition") => void;
  topLabel?: string;
  minChars?: number;
  minWords?: number;
  className?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties; // NEW
  /** Hide only the topLabel when input has content */
  hideTopLabelWhenFilled?: boolean;
  alwaysShowTopLabel?: boolean;
  /** Dropdown rendered as a portal to avoid table reflow */
  renderInPortal?: boolean;
  /** z-index for portalized menu (if not provided, it will be computed) */
  portalZIndex?: number;
  deferFetchUntilFocus?: boolean;
  disabled?: boolean;
  allowRowArrowNavigationWhenClosed?: boolean;
  /** Which secondary labels to show (default: label2-4) */
  secondaryLabels?: Array<"label2" | "label3" | "label4">;
  /** Whether to show label5 (default: true) */
  showLabel5?: boolean;
  /** Hide the floating label block completely when the table/header already provides context */
  hideFloatingLabel?: boolean;
  /** Enables typo-tolerant local ranking and a broader fallback fetch */
  enableFuzzyMatching?: boolean;
  /** First-word prefix length used for fallback fetches when typo matching is enabled */
  fuzzyFallbackPrefixLength?: number;
}

const normalizeSearchValue = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const extractSearchTokens = (value: string) =>
  normalizeSearchValue(value).split(/\s+/).filter(Boolean);

const dedupeAutoCompleteItems = (items: AutoCompleteItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id ?? item.label1 ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const toPhoneticish = (value: string) =>
  normalizeSearchValue(value)
    .replace(/\s+/g, "")
    .replace(/ph/g, "f")
    .replace(/ght/g, "t")
    .replace(/tion/g, "shun")
    .replace(/q/g, "k")
    .replace(/[zs]/g, "s")
    .replace(/[gj]/g, "g")
    .replace(/[iy]/g, "i");

const toLooseMedicineKey = (value: string) =>
  toPhoneticish(value)
    .replace(/[eiou]/g, "a")
    .replace(/[gj]/g, "g")
    .replace(/[zs]/g, "s")
    .replace(/[iy]/g, "i")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/k/g, "g");

const toConsonantSkeleton = (value: string) => {
  const normalized = toPhoneticish(value);
  if (!normalized) return "";
  const [first = "", ...rest] = normalized.split("");
  return `${first}${rest.join("").replace(/[aeiou]/g, "")}`;
};

const levenshteinDistance = (a: string, b: string, maxDistance = 3) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    let rowMin = current[0];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      const value = Math.min(
        previous[j + 1] + 1,
        current[j] + 1,
        previous[j] + cost,
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[b.length];
};

const scoreCandidateAgainstToken = (candidate: string, token: string) => {
  if (!candidate || !token) return 0;
  if (candidate.startsWith(token)) return 240;
  if (candidate.includes(token)) return 200;

  const phoneticCandidate = toPhoneticish(candidate);
  const phoneticToken = toPhoneticish(token);
  if (phoneticCandidate.startsWith(phoneticToken)) return 180;
  if (phoneticCandidate.includes(phoneticToken)) return 150;

  const looseCandidate = toLooseMedicineKey(candidate);
  const looseToken = toLooseMedicineKey(token);
  if (looseCandidate.startsWith(looseToken)) return 170;
  if (looseCandidate.includes(looseToken)) return 145;

  const skeletonCandidate = toConsonantSkeleton(candidate);
  const skeletonToken = toConsonantSkeleton(token);
  if (
    skeletonToken.length >= 3 &&
    skeletonCandidate.startsWith(skeletonToken)
  ) {
    return 135;
  }

  const candidatePrefix = phoneticCandidate.slice(
    0,
    Math.min(phoneticCandidate.length, phoneticToken.length + 1),
  );
  const maxDistance = phoneticToken.length >= 6 ? 2 : 1;
  const distance = levenshteinDistance(
    phoneticToken,
    candidatePrefix,
    maxDistance,
  );
  if (distance <= maxDistance) {
    return 120 - distance * 25;
  }

  const looseCandidatePrefix = looseCandidate.slice(
    0,
    Math.min(looseCandidate.length, looseToken.length + 1),
  );
  const looseDistance = levenshteinDistance(
    looseToken,
    looseCandidatePrefix,
    maxDistance,
  );
  if (looseDistance <= maxDistance) {
    return 110 - looseDistance * 20;
  }

  return 0;
};

const scorePrimaryMedicineName = (value: string, query: string) => {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedValue || !normalizedQuery) return 0;

  const firstWord = normalizedValue.split(/\s+/).filter(Boolean)[0] || "";
  if (!firstWord) return 0;

  const phoneticFirstWord = toPhoneticish(firstWord);
  const phoneticQuery = toPhoneticish(normalizedQuery);
  const looseFirstWord = toLooseMedicineKey(firstWord);
  const looseQuery = toLooseMedicineKey(normalizedQuery);

  let score = 0;

  if (firstWord.startsWith(normalizedQuery)) score = Math.max(score, 360);
  if (phoneticFirstWord.startsWith(phoneticQuery)) score = Math.max(score, 320);
  if (looseFirstWord.startsWith(looseQuery)) score = Math.max(score, 300);

  const prefixLength = Math.min(
    Math.max(normalizedQuery.length + 1, 4),
    firstWord.length,
  );
  const firstWordPrefix = firstWord.slice(0, prefixLength);
  const phoneticPrefix = phoneticFirstWord.slice(
    0,
    Math.min(Math.max(phoneticQuery.length + 1, 4), phoneticFirstWord.length),
  );
  const loosePrefix = looseFirstWord.slice(
    0,
    Math.min(Math.max(looseQuery.length + 1, 4), looseFirstWord.length),
  );
  const maxDistance = normalizedQuery.length >= 6 ? 2 : 1;

  const directDistance = levenshteinDistance(
    normalizedQuery,
    firstWordPrefix,
    maxDistance,
  );
  if (directDistance <= maxDistance) {
    score = Math.max(score, 280 - directDistance * 35);
  }

  const phoneticDistance = levenshteinDistance(
    phoneticQuery,
    phoneticPrefix,
    maxDistance,
  );
  if (phoneticDistance <= maxDistance) {
    score = Math.max(score, 255 - phoneticDistance * 30);
  }

  const looseDistance = levenshteinDistance(
    looseQuery,
    loosePrefix,
    maxDistance,
  );
  if (looseDistance <= maxDistance) {
    score = Math.max(score, 235 - looseDistance * 25);
  }

  return score;
};

const buildFirstWordVariants = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/([\s,-;]+)/);
  const firstWordIndex = parts.findIndex((part) => /[a-z0-9]/i.test(part));
  if (firstWordIndex < 0) return [];

  const firstWord = parts[firstWordIndex];
  const lower = firstWord.toLowerCase();
  const variants = new Set<string>();

  if (!lower.startsWith("y")) variants.add(`y${firstWord}`);
  if (!lower.startsWith("i")) variants.add(`i${firstWord}`);
  if (!lower.startsWith("u")) variants.add(`u${firstWord}`);

  if (firstWord.length > 1) {
    variants.add(firstWord.slice(1));
  }

  return Array.from(variants)
    .map((variant) => {
      const copy = [...parts];
      copy[firstWordIndex] = variant;
      return copy.join("").trim();
    })
    .filter(
      (variant) =>
        variant.length > 0 && variant.toLowerCase() !== trimmed.toLowerCase(),
    );
};

const computeItemMatchScore = (item: AutoCompleteItem, query: string) => {
  const tokens = extractSearchTokens(query);
  if (!tokens.length) return 0;

  const rawFields = [
    item.label1,
    item.label2,
    item.label3,
    item.label4,
    item.label5,
  ].filter(Boolean);
  const fields = rawFields.map((value) => normalizeSearchValue(String(value)));

  let total = scorePrimaryMedicineName(String(item.label1 || ""), query);
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      const fieldTokens = field.split(/\s+/).filter(Boolean);
      best = Math.max(best, scoreCandidateAgainstToken(field, token));
      for (const fieldToken of fieldTokens) {
        best = Math.max(best, scoreCandidateAgainstToken(fieldToken, token));
      }
    }
    if (best <= 0) return 0;
    total += best;
  }

  const primaryLabel = normalizeSearchValue(String(item.label1 || ""));
  if (primaryLabel && primaryLabel === normalizeSearchValue(query)) {
    total += 500;
  } else if (primaryLabel && primaryLabel.includes(normalizeSearchValue(query))) {
    total += 120;
  }

  return total;
};

const GenericAutoComplete = React.forwardRef<
  HTMLInputElement,
  GenericAutoCompleteProps
>(
  (
    {
      searchQuery,
      setSearchQuery,
      myplacehoder,
      suppressOpen = false,
      onSelect,
      endpoint,
      listWidth = "w-full",
      mode = "live",
      setMode,
      topLabel = "Search Entry",
      minChars = 3,
      minWords = 2,
      className,
      inputClassName,
      inputStyle,
      hideTopLabelWhenFilled = true,
      alwaysShowTopLabel = true,
      renderInPortal = true,
      portalZIndex,
      deferFetchUntilFocus,
      disabled = false,
      allowRowArrowNavigationWhenClosed = false,
      secondaryLabels = ["label2", "label3", "label4"],
      showLabel5 = true,
      hideFloatingLabel = false,
      enableFuzzyMatching,
      fuzzyFallbackPrefixLength = 4,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const [hasInteracted, setHasInteracted] = useState(false);
    // Data / UI state
    const [items, setItems] = useState<AutoCompleteItem[]>([]);
    const [allItems, setAllItems] = useState<AutoCompleteItem[]>([]);
    const [lastQuery, setLastQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const menuContainerRef = useRef<HTMLDivElement | null>(null);

    // Portal positioning
    const [menuRect, setMenuRect] = useState<{
      left: number;
      top: number;
      width: number;
    } | null>(null);
    const menuOpen = !disabled && showDropdown && items.length > 0;

    // Compute z-index for menu & overlays
    const [computedPortalZ, setComputedPortalZ] = useState<number | undefined>(
      portalZIndex
    );
    const fuzzyMatchingEnabled =
      enableFuzzyMatching ?? endpoint.startsWith("/item/autocomplete");

    // Pull z-index from (1) explicit prop, (2) tailwind className z-[N]/z-N, (3) computed style, else default
    useEffect(() => {
      if (portalZIndex != null) {
        setComputedPortalZ(portalZIndex);
        return;
      }
      const getZFromClassName = (cls?: string): number | null => {
        if (!cls) return null;
        const m1 = cls.match(/z-\[(\d+)\]/); // z-[1400]
        if (m1) return parseInt(m1[1], 10);
        const m2 = cls.match(/\bz-(\d+)\b/); // z-50
        if (m2) return parseInt(m2[1], 10);
        return null;
      };
      const fromClass = getZFromClassName(className);
      if (fromClass != null) {
        setComputedPortalZ(fromClass + 1);
        return;
      }
      const el = inputRef.current;
      if (el) {
        const zi = Number(window.getComputedStyle(el).zIndex);
        if (!Number.isNaN(zi)) {
          setComputedPortalZ(zi + 1);
          return;
        }
      }
      setComputedPortalZ(1001);
    }, [portalZIndex, className]);

    // Position portalized menu
    useLayoutEffect(() => {
      if (!renderInPortal || !menuOpen) {
        setMenuRect(null);
        return;
      }
      const update = () => {
        const r = inputRef.current?.getBoundingClientRect();
        if (r) setMenuRect({ left: r.left, top: r.bottom, width: r.width });
      };
      update();
      const opts: AddEventListenerOptions = { capture: true, passive: true };
      window.addEventListener("scroll", update, opts);
      window.addEventListener("resize", update, opts);
      return () => {
        window.removeEventListener("scroll", update, opts as any);
        window.removeEventListener("resize", update, opts as any);
      };
    }, [renderInPortal, menuOpen]);

    // Fetch / filter items
    useEffect(() => {
      // reset when empty or after a selection
      if (searchQuery.trim() === "" || isSelected) {
        setItems([]);
        setHighlightedIndex(-1);
        setAllItems([]);
        setLastQuery("");
        return;
      }
      if (deferFetchUntilFocus && !hasInteracted) return;
      const cleanedQuery = searchQuery.trim().toLowerCase();
      const cleanedLast = lastQuery.trim().toLowerCase();
      const isFresh =
        cleanedLast === "" || !cleanedQuery.startsWith(cleanedLast);
      const wordCount = cleanedQuery.split(/[\s-]+/).filter(Boolean).length;

      let shouldFetch = false;
      if (mode === "live" && cleanedQuery.length >= minChars && isFresh) {
        shouldFetch = true;
      } else if (
        mode === "onCondition" &&
        wordCount >= minWords &&
        (allItems.length === 0 || !cleanedQuery.startsWith(cleanedLast))
      ) {
        shouldFetch = true;
      }

      if (shouldFetch) {
        const t = setTimeout(() => {
          void fetchItems();
        }, 300);
        return () => clearTimeout(t);
      } else if (allItems.length > 0) {
        filterLocally(searchQuery);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, mode, isSelected, deferFetchUntilFocus, hasInteracted]);

    // Keep highlighted item in view
    useEffect(() => {
      if (highlightedIndex < 0) return;
      const el = menuContainerRef.current?.querySelector<HTMLDivElement>(
        `[data-idx="${highlightedIndex}"]`
      );
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [highlightedIndex]);

    const rankItems = (list: AutoCompleteItem[], q: string) =>
      [...list]
        .map((item, index) => ({
          item,
          index,
          score: fuzzyMatchingEnabled ? computeItemMatchScore(item, q) : 0,
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.index - b.index;
        })
        .map((entry) => entry.item);

    const buildFuzzyFallbackQuery = (q: string, prefixLength: number) => {
      const pieces = q
        .trim()
        .split(/([\s,-;]+)/)
        .filter((part) => part.length > 0);
      let firstWordShortened = false;
      return pieces
        .map((part) => {
          if (firstWordShortened || !/[a-z0-9]/i.test(part)) return part;
          firstWordShortened = true;
          return part.slice(0, Math.min(prefixLength, part.length));
        })
        .join("");
    };

    const fetchItemsFromQuery = async (queryText: string) => {
      const sep = endpoint.includes("?") ? "&" : "?";
      const url = `${endpoint}${sep}query=${encodeURIComponent(queryText)}`;
      const res = await API.get(url);
      const list = res.data?.items;
      return Array.isArray(list) ? (list as AutoCompleteItem[]) : [];
    };

    const fetchItems = async (
      queryOverride?: string,
      fallbackStage = 0
    ) => {
      try {
        setLoading(true);
        const currentQuery = queryOverride ?? searchQuery;
        const valid = await fetchItemsFromQuery(currentQuery);

        let merged = valid;
        if (
          fuzzyMatchingEnabled &&
          fallbackStage === 0 &&
          searchQuery.trim().length >= minChars
        ) {
          const variantQueries = buildFirstWordVariants(searchQuery).slice(0, 4);
          if (variantQueries.length > 0) {
            const variantResults = await Promise.all(
              variantQueries.map(async (variantQuery) => {
                try {
                  return await fetchItemsFromQuery(variantQuery);
                } catch {
                  return [];
                }
              }),
            );
            merged = dedupeAutoCompleteItems([valid, ...variantResults].flat());
          }
        }

        if (fuzzyMatchingEnabled && valid.length === 0) {
          const prefixCandidates = Array.from(
            new Set([fuzzyFallbackPrefixLength, 1].filter((n) => n > 0))
          );
          const nextPrefixLength = prefixCandidates[fallbackStage];
          if (
            nextPrefixLength &&
            currentQuery.trim().length > nextPrefixLength
          ) {
            const fallbackQuery = buildFuzzyFallbackQuery(
              searchQuery,
              nextPrefixLength
            );
            if (
              fallbackQuery.trim() &&
              fallbackQuery.trim().toLowerCase() !==
                currentQuery.trim().toLowerCase()
            ) {
              await fetchItems(fallbackQuery, fallbackStage + 1);
              return;
            }
          }
        }

        const ranked = rankItems(merged, searchQuery);
        const filtered =
          fuzzyMatchingEnabled && searchQuery.trim()
            ? ranked.filter((item) => computeItemMatchScore(item, searchQuery) > 0)
            : ranked;
        setAllItems(ranked);
        setItems(filtered);
        setLastQuery(searchQuery);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Fetch error:", err);
        setAllItems([]);
        setItems([]);
        setHighlightedIndex(-1);
      } finally {
        setLoading(false);
      }
    };

    const filterLocally = (q: string) => {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const filtered = allItems.filter((item) => {
        if (fuzzyMatchingEnabled) {
          return computeItemMatchScore(item, q) > 0;
        }
        return words.every((w) =>
          [item.label1, item.label2, item.label3, item.label4, item.label5]
            .filter(Boolean)
            .some((lbl) => lbl && lbl.toLowerCase().includes(w))
        );
      });
      const ranked = fuzzyMatchingEnabled ? rankItems(filtered, q) : filtered;
      setItems(ranked);
      setHighlightedIndex(ranked.length > 0 ? 0 : -1);
    };

    const handleSelect = (item: AutoCompleteItem) => {
      setSearchQuery(item.label1);
      setIsSelected(true);
      setItems([]);
      setShowDropdown(false);
      onSelect(item);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " " && searchQuery.trim().length === 0) {
        e.preventDefault();
        e.stopPropagation();
        setMode?.(mode === "live" ? "onCondition" : "live");
        return;
      }
      if (e.key === "ArrowDown") {
        if (allowRowArrowNavigationWhenClosed && !menuOpen) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(true);
        setHighlightedIndex((prev) =>
          Math.min((prev < 0 ? -1 : prev) + 1, items.length - 1)
        );
        return;
      }
      if (e.key === "ArrowUp") {
        if (allowRowArrowNavigationWhenClosed && !menuOpen) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(true);
        setHighlightedIndex((prev) => Math.max((prev <= 0 ? 0 : prev) - 1, 0));
        return;
      }
      if (e.key === "Backspace") {
        const input = e.currentTarget;
        const isAllSelected =
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length;
        if (isAllSelected || searchQuery.trim() === "") {
          setHighlightedIndex(-1);
          setSearchQuery("");
          setIsSelected(false);
          setItems([]);
          return;
        }
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setSearchQuery("");
        setItems([]);
        setIsSelected(false);
        setHighlightedIndex(-1);
        return;
      }
      if (e.key === "Enter") {
        if (mode === "onCondition" && items.length === 0) {
          const wc = searchQuery
            .trim()
            .split(/[\s-]+/)
            .filter(Boolean).length;
          if (wc >= minWords) {
            e.preventDefault();
            e.stopPropagation();
            void fetchItems();
            return;
          }
        }
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          handleSelect(items[highlightedIndex]);
        }
      }
    };

    const inputHasValue = searchQuery.trim().length > 0;
    const showTopLabel =
      alwaysShowTopLabel || (hideTopLabelWhenFilled ? !inputHasValue : true);
    const baseInputClass = "p-2 border border-gray-300 rounded w-full";
    // Dropdown element (transparent look like GenericAutoComplete1)
    const dropdown = (
      <div
        ref={menuContainerRef}
        className={`${
          renderInPortal ? "" : `absolute left-0 top-full mt-1 ${listWidth}`
        } opacity-90 bg-blue-300 rounded-md backdrop-blur-sm max-h-60 overflow-y-auto shadow-2xl border`}
        style={
          renderInPortal
            ? {
                position: "fixed",
                left: menuRect?.left,
                top: menuRect?.top,
                width: menuRect?.width,
                zIndex: computedPortalZ,
              }
            : { zIndex: computedPortalZ }
        }
        onMouseDown={(e) => e.preventDefault()}
      >
        {items.map((item, index) => {
          const isHighlighted = highlightedIndex === index;
          const textColor = isHighlighted ? "text-white" : "text-gray-800";
          return (
            <div
              key={item.id}
              data-idx={index}
              onClick={() => handleSelect(item)}
              className={`p-2 cursor-pointer transition-colors ${
                isHighlighted
                  ? "bg-blue-500 text-white"
                  : "hover:bg-gray-100 even:bg-white odd:bg-gray-50"
              }`}
            >
              <div className="font-medium">{item.label1}</div>
              <div className={`${textColor} break-words`}>
                {secondaryLabels
                  .map((key) => item[key])
                  .filter(Boolean)
                  .map((line, idx) => (
                    <div
                      key={idx}
                      className={`${
                        idx === 0 ? "text-sm" : "text-xs"
                      } ${textColor}`}
                    >
                      {line}
                    </div>
                  ))}
                {showLabel5 && item.label5 && (
                  <div className={`text-xs ${textColor}`}>{item.label5}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

    return (
      <div className="relative w-full">
        <div className="floating-label-group">
          <input
            ref={inputRef}
            type="text"
            data-generic-autocomplete-input="true"
            data-generic-autocomplete-open={menuOpen ? "true" : "false"}
            value={searchQuery}
            disabled={disabled}
            onFocus={() => {
              if (disabled) return;
              setHasInteracted(true);
              if (suppressOpen) {
                setShowDropdown(false);
              } else {
                setShowDropdown(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onChange={(e) => {
              if (disabled) return;
              const v = e.target.value;
              setHasInteracted(true);
              setSearchQuery(v);
              setIsSelected(false);
              if (v.trim() === "") {
                setItems([]);
                setHighlightedIndex(-1);
                setShowDropdown(false);
                return;
              }
              setShowDropdown(true);
              if (mode === "onCondition" && allItems.length > 0) {
                const wc = v
                  .trim()
                  .split(/[\s-]+/)
                  .filter(Boolean).length;
                if (wc >= minWords) filterLocally(v);
              }
            }}
            // onKeyDown={handleKeyDown}
            onKeyDown={(e) => {
              if (disabled) {
                e.preventDefault();
                return;
              }
              setHasInteracted(true);
              handleKeyDown(e);
              // ...existing onKeyDown body...
            }}
            placeholder={myplacehoder ?? "Search..."}
            // className={className ?? "p-2 border border-gray-300 rounded w-full"}
            className={`${baseInputClass} ${inputClassName ?? ""} ${
              disabled ? "bg-gray-200 cursor-not-allowed opacity-70" : ""
            }`}
            style={inputStyle}
          />
          {!hideFloatingLabel ? (
            <label className="floating-label" style={{ zIndex: computedPortalZ }}>
              {showTopLabel && (
                <>
                  <span>{topLabel} </span>
                  <span className="ml-1">
                    [
                    <span className="font-bold">
                      {mode === "live" ? " Live " : " Enter key "}
                    </span>
                    ]
                  </span>
                </>
              )}
            </label>
          ) : null}
        </div>

        {loading && (
          <div
            className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-md opacity-90 backdrop-blur-sm w-full p-2 flex items-center gap-2 text-sm text-gray-600"
            style={{ zIndex: computedPortalZ }}
          >
            <svg
              className="animate-spin h-4 w-4 text-blue-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Loading...
          </div>
        )}

        {menuOpen &&
          (renderInPortal ? createPortal(dropdown, document.body) : dropdown)}
      </div>
    );
  }
);

export default GenericAutoComplete;
