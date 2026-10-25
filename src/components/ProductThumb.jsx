const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

// A photo we took ourselves always wins over the one found online.
const thumbnailUrl = (product) => product?.custom_image_url || product?.image_url || null

export default function ProductThumb({ product, size = 56 }) {
  const src = thumbnailUrl(product)
  if (src) {
    return (
      <img
        className="thumb"
        src={src}
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
