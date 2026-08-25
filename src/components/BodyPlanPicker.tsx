import {BODY_PLAN_OPTIONS} from "../catalog";

export default function BodyPlanPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (bodyPlan: string) => void;
}) {
  return (
    <fieldset className="body-plan-picker">
      <legend><span>Founding anatomy</span><small>Choose the branch your lineage starts from.</small></legend>
      <div className="body-plan-root" aria-hidden="true"><i /> Common ancestor</div>
      <div className="body-plan-branches">
        {BODY_PLAN_OPTIONS.map((option) => (
          <label key={option.id} className={value === option.id ? "selected" : ""}>
            <input
              type="radio"
              name="body-plan"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <b className={`body-plan-glyph ${option.id}`} aria-hidden="true">{option.symbol}</b>
            <span><strong>{option.name}</strong><small>{option.summary}</small></span>
            <i aria-hidden="true">✓</i>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
