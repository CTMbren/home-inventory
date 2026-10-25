export default function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="One less" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label="One more" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}
