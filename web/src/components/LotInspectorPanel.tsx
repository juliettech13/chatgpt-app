import React from "react";

import type { Booking, ParkingLot } from "../types";
import { capitalize } from "../lib/format";

import "../css/lot-inspector-panel.css";

type LotInspectorPanelProps = {
  lot: ParkingLot;
  address: string;
  onClose: () => void;
  booking: Booking | null;
  isBooking: boolean;
  bannerMessage: string | null;
  bannerTone: "success" | "error";
  onBookLot: (lotId: string) => Promise<void>;
};

export function LotInspectorPanel({
  lot,
  address,
  onClose,
  booking,
  isBooking,
  bannerMessage,
  bannerTone,
  onBookLot
}: LotInspectorPanelProps) {
  const alreadyBookedLot = booking?.lotId === lot.id;
  const hasBookingForDate = booking != null;
  const isSoldOut = lot.availableSpots <= 0;
  const isButtonDisabled = isBooking || alreadyBookedLot || (hasBookingForDate && !alreadyBookedLot) || isSoldOut;
  const buttonLabel = alreadyBookedLot
    ? "Booked"
    : hasBookingForDate
      ? "Already booked for this day"
      : isSoldOut
        ? "Sold out"
        : isBooking
          ? "Booking..."
          : "Book this lot";
  const showSuccessBanner = alreadyBookedLot && bannerTone === "success" && Boolean(bannerMessage);
  const showErrorBanner = bannerTone === "error" && Boolean(bannerMessage);
  const showAlreadyBookedBanner = booking && !alreadyBookedLot;

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

      <div className="lot-inspector-panel__media">
        {lot.imageUrl ? (
          <img
            className="lot-inspector-panel__media-image"
            src={lot.imageUrl}
            alt={lot.name}
            loading="lazy"
          />
        ) : null}
      </div>

      <h3 className="lot-inspector-panel__title">{lot.name}</h3>
      <p className="lot-inspector-panel__address">{address}</p>

      <div className="lot-inspector-panel__chips">
        <span className="lot-inspector-panel__chip lot-inspector-panel__chip--standard">
          {capitalize(lot.type)}
        </span>
        <span className={`lot-inspector-panel__chip ${lot.attributes.covered ? "lot-inspector-panel__chip--covered" : "lot-inspector-panel__chip--uncovered"}`}>
          {lot.attributes.covered ? "Covered" : "Uncovered"}
        </span>
        <span className={`lot-inspector-panel__chip ${lot.attributes.accessible ? "lot-inspector-panel__chip--accessible" : "lot-inspector-panel__chip--standard"}`}>
          {lot.attributes.accessible ? "Accessible" : "Standard"}
        </span>
        {lot.attributes.ev_charging ? (
          <span className="lot-inspector-panel__chip lot-inspector-panel__chip--ev">
            EV
          </span>
        ) : null}
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

      {showSuccessBanner ? (
        <p className={`lot-inspector-panel__message lot-inspector-panel__message--${bannerTone}`}>
          {bannerMessage}
        </p>
      ) : null}

      {showAlreadyBookedBanner ? (
        <p className="lot-inspector-panel__message">
          You already booked {booking.lotName} for {booking.date}. Confirmation ID: {booking.confirmationId}.
        </p>
      ) : null}

      {showErrorBanner ? (
        <p className={`lot-inspector-panel__message lot-inspector-panel__message--${bannerTone}`}>
          {bannerMessage}
        </p>
      ) : null}

      <button
        type="button"
        className="lot-inspector-panel__book-btn"
        onClick={() => {
          void onBookLot(lot.id);
        }}
        disabled={isButtonDisabled}
      >
        {buttonLabel}
      </button>

      {lot.note ? <p className="lot-inspector-panel__note">{lot.note}</p> : null}
    </aside>
  );
}
