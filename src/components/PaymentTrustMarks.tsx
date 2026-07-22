import { CreditCard, ShieldCheck } from "lucide-react";

type PaymentTrustMarksProps = {
  compact?: boolean;
};

export function PaymentTrustMarks({ compact = false }: PaymentTrustMarksProps) {
  return (
    <div className={`payment-trust ${compact ? "payment-trust--compact" : ""}`}>
      <div className="payment-trust__copy">
        <ShieldCheck size={compact ? 18 : 22} />
        <div>
          <strong>Secure checkout by Windcave</strong>
          <span>Card details are entered and stored only on Windcave's hosted payment page.</span>
        </div>
      </div>
      <div className="payment-brands" aria-label="Accepted cards: Visa, Mastercard and American Express">
        <span className="payment-brand payment-brand--visa">VISA</span>
        <span className="payment-brand payment-brand--mastercard"><CreditCard size={15} /> Mastercard</span>
        <span className="payment-brand payment-brand--amex">AMERICAN EXPRESS</span>
      </div>
    </div>
  );
}
