import { BadgeCheck, DatabaseZap, Truck } from "lucide-react";

export function ValueStrip() {
  return (
    <section className="shell value-strip" aria-label="Green Leaf service advantages">
      <div>
        <Truck />
        <span>Free Nadi delivery</span>
      </div>
      <div>
        <DatabaseZap />
        <span>ERPNext live stock</span>
      </div>
      <div>
        <BadgeCheck />
        <span>30-day trade terms</span>
      </div>
    </section>
  );
}
