import React from "react";

import type { ParkingLot } from "../types";
import { capitalize } from "../lib/format";

import "../css/lot-inspector-panel.css";

type Props = {
  lot: ParkingLot;
  onBook: (lot: ParkingLot) => void;
  bookingMessage: string | null;
  address: string;
  onClose: () => void;
  isSubmittingBooking: boolean;
};

export function LotInspectorPanel({ lot, onBook, bookingMessage, address, onClose, isSubmittingBooking }: Props) {
  const mediaClass = lot.type === "garage" ? "lot-inspector-panel__media--garage" : "lot-inspector-panel__media--surface";

  return (
    <aside className="lot-inspector-panel" aria-label="Lot details inspector">
      <header className="lot-inspector-panel__topbar">
        <button
          type="button"
          className="lot-inspector-panel__close-btn"
          onClick={onClose}
          aria-label="Close details"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div className={`lot-inspector-panel__media ${mediaClass}`} />

      <h3 className="lot-inspector-panel__title">{lot.name}</h3>
      <p className="lot-inspector-panel__address">{address}</p>

      <div className="lot-inspector-panel__chips">
        <span>{capitalize(lot.type)}</span>
        <span>{lot.attributes.covered ? "Covered" : "Uncovered"}</span>
        <span>{lot.attributes.accessible ? "Accessible" : "Standard"}</span>
        {lot.attributes.ev_charging ? <span>EV</span> : null}
      </div>

      <dl className="lot-inspector-panel__list">
        <div>
          <dt>Type</dt>
          <dd>{capitalize(lot.type)}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>
            {lot.availableSpots} / {lot.capacity}
          </dd>
        </div>
        <div>
          <dt>Distance to HQ</dt>
          <dd>{lot.distanceToHQMiles} mi</dd>
        </div>
        <div>
          <dt>Covered</dt>
          <dd>{lot.attributes.covered ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Accessible</dt>
          <dd>{lot.attributes.accessible ? "Yes" : "No"}</dd>
        </div>
      </dl>

      {lot.note ? <p className="lot-inspector-panel__note">{lot.note}</p> : null}
      <button
        type="button"
        className="lot-inspector-panel__book-btn"
        onClick={() => onBook(lot)}
        disabled={isSubmittingBooking}
      >
        Mock book this lot
      </button>
      {bookingMessage ? <p className="lot-inspector-panel__message">{bookingMessage}</p> : null}
    </aside>
  );
}
