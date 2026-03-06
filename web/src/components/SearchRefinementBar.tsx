import React, { useMemo, useRef } from "react";

import "../css/search-refinement-bar.css";

export type RefinementState = {
  date: string;
  requireCovered: boolean;
  requireAccessible: boolean;
  requireEv: boolean;
};

type SearchRefinementBarProps = {
  value: RefinementState;
  isSearching: boolean;
  onChange: (nextValue: RefinementState) => Promise<void>;
  onReset: () => Promise<void>;
};

export function SearchRefinementBar({
  value,
  isSearching,
  onChange,
  onReset
}: SearchRefinementBarProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const formattedDate = useMemo(() => {
    const parsedDate = new Date(`${value.date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return value.date;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    }).format(parsedDate);
  }, [value.date]);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <section className="search-refinement-bar" aria-label="Parking search filters">
      <div
        className="search-refinement-bar__field"
        aria-label="Date filter"
        role="button"
        tabIndex={isSearching ? -1 : 0}
        onClick={() => {
          if (isSearching) return;
          openDatePicker();
        }}
        onKeyDown={(event) => {
          if (isSearching) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDatePicker();
          }
        }}
      >
        <span className="search-refinement-bar__date-display" aria-hidden="true">
          {formattedDate}
        </span>
        <input
          ref={dateInputRef}
          className="search-refinement-bar__native-date-input"
          type="date"
          aria-label="Date"
          value={value.date}
          disabled={isSearching}
          onChange={(event) => {
            void onChange({ ...value, date: event.target.value });
          }}
          onKeyDown={(event) => {
            event.preventDefault();
          }}
        />
        <span className="search-refinement-bar__date-picker-btn" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 2v3M17 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className="search-refinement-bar__toggles" role="group" aria-label="Parking feature filters">
        <button
          type="button"
          className={`search-refinement-bar__toggle ${value.requireCovered ? "search-refinement-bar__toggle--active search-refinement-bar__toggle--covered" : ""}`}
          disabled={isSearching}
          onClick={() => {
            void onChange({ ...value, requireCovered: !value.requireCovered });
          }}
          aria-pressed={value.requireCovered}
        >
          Covered
        </button>
        <button
          type="button"
          className={`search-refinement-bar__toggle ${value.requireEv ? "search-refinement-bar__toggle--active search-refinement-bar__toggle--ev" : ""}`}
          disabled={isSearching}
          onClick={() => {
            void onChange({ ...value, requireEv: !value.requireEv });
          }}
          aria-pressed={value.requireEv}
        >
          EV
        </button>
        <button
          type="button"
          className={`search-refinement-bar__toggle ${value.requireAccessible ? "search-refinement-bar__toggle--active search-refinement-bar__toggle--accessible" : ""}`}
          disabled={isSearching}
          onClick={() => {
            void onChange({ ...value, requireAccessible: !value.requireAccessible });
          }}
          aria-pressed={value.requireAccessible}
        >
          Accessible
        </button>
      </div>

      <div className="search-refinement-bar__actions">
        <button
          type="button"
          className="search-refinement-bar__secondary-btn"
          disabled={isSearching}
          onClick={() => {
            void onReset();
          }}
        >
          Reset
        </button>
        <span className="search-refinement-bar__status" aria-live="polite">
          {isSearching ? "Updating..." : ""}
        </span>
      </div>
    </section>
  );
}
