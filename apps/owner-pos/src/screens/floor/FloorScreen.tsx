import { Badge, Button, Card, EmptyState } from "../../components.js";
import type { Checkin, Session } from "../../api.js";
import { timeAgo } from "./floorUtils.js";

export function FloorSessionBar({
  session,
  status,
  now,
  apiOffline,
  onStartDay,
  onRequestEndDay,
}: {
  session: Session | null;
  status: string;
  now: Date;
  apiOffline: boolean;
  onStartDay: () => void;
  onRequestEndDay: () => void;
}) {
  return (
    <header className="floor-topbar">
      <div className="floor-topbar__title">
        <p className="eyebrow">Owner POS</p>
        <h1 className="floor-title">Salon Floor</h1>
      </div>
      <div className="floor-topbar__meta">
        <span className="floor-clock">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <Badge variant={apiOffline ? "danger" : session ? "success" : "warning"}>
          {apiOffline ? "Offline" : status}
        </Badge>
        {session ? (
          <>
            <span className="floor-session-time">
              Open {new Date(session.openedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
            <Button size="sm" variant="ghost" onClick={onRequestEndDay}>
              End Day
            </Button>
          </>
        ) : (
          <Button size="md" onClick={onStartDay}>
            Start Day
          </Button>
        )}
      </div>
    </header>
  );
}

export function NoSessionFloorState({
  apiOffline,
  onStartDay,
}: {
  apiOffline: boolean;
  onStartDay: () => void;
}) {
  return (
    <Card padding="lg" className="floor-start-card">
      <EmptyState
        icon="Open"
        title={apiOffline ? "Local API offline" : "Start the day"}
        description={
          apiOffline
            ? "The Floor page only shows live session data. Start the local API before opening the floor."
            : "Open a salon session to load workers, the waiting queue, and checkout-ready customers."
        }
        action={
          apiOffline ? null : (
            <Button size="lg" onClick={onStartDay}>
              Start Day
            </Button>
          )
        }
      />
    </Card>
  );
}

export function ReadyCheckoutRail({
  checkins,
  onStartSale,
  onStartManualTicket,
}: {
  checkins: Checkin[];
  onStartSale: (checkinId: string) => void;
  onStartManualTicket: () => void;
}) {
  return (
    <Card padding="lg" className="floor-panel floor-panel--checkout">
      <div className="card__header">
        <div>
          <p className="eyebrow">Tickets</p>
          <h2 className="card__title">Ready for Checkout</h2>
        </div>
        <Badge variant="success">{checkins.length}</Badge>
      </div>
      <button type="button" className="manual-ticket-button" onClick={onStartManualTicket}>
        <strong>+ Manual Ticket</strong>
        <small>Add a walk-in sale without a check-in</small>
      </button>
      {checkins.length === 0 ? (
        <EmptyState icon="Sale" title="None ready" description="Completed turns appear here for checkout, or use Manual Ticket for an immediate sale." />
      ) : (
        <div className="floor-checkout-list">
          {checkins.map((checkin) => (
            <div key={checkin.id} className="floor-checkout-item">
              <div>
                <strong>{checkin.customer?.name ?? "Walk-in"}</strong>
                <small>{timeAgo(checkin.checkedInAt)}</small>
              </div>
              <Button size="sm" onClick={() => onStartSale(checkin.id)}>
                Start Sale
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

