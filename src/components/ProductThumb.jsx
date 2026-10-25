const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

export default function ProductThumb({ product, size = 56 }) {
  if (product?.image_url) {
    return (
      <img
        className="thumb"
        src={product.image_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <div className="thumb placeholder" style={{ width: size, height: size }} aria-hidden="true">
      {initials(product?.name)}
    </div>
  )
}
