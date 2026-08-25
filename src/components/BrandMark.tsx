export default function BrandMark({small = false}: {small?: boolean}) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true">
      <i className="brand-orbit orbit-one" />
      <i className="brand-orbit orbit-two" />
      <i className="brand-cell cell-one" />
      <i className="brand-cell cell-two" />
      <i className="brand-cell cell-three" />
    </span>
  );
}
