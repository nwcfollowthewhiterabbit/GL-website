import { ShieldCheck } from "lucide-react";

type PaymentTrustMarksProps = { compact?: boolean };

export function PaymentTrustMarks({ compact = false }: PaymentTrustMarksProps) {
  return <div className={`payment-trust ${compact ? "payment-trust--compact" : ""}`}>
    <div className="payment-trust__copy">
      <ShieldCheck size={compact ? 18 : 22} />
      <div><strong>Request a quote online</strong><span>No online payment is taken. Green Leaf sales will confirm your quotation and payment arrangements directly.</span></div>
    </div>
  </div>;
}
