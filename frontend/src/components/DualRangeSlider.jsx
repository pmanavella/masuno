export function DualRangeSlider({ min, max, valueMin, valueMax, onChangeMin, onChangeMax }) {
  const percentMin = ((valueMin - min) / (max - min)) * 100;
  const percentMax = ((valueMax - min) / (max - min)) * 100;

  function handleMinChange(e) {
    onChangeMin(Math.min(Number(e.target.value), valueMax));
  }

  function handleMaxChange(e) {
    onChangeMax(Math.max(Number(e.target.value), valueMin));
  }

  return (
    <div className="range-slider">
      <div className="range-track">
        <div className="range-fill" style={{ left: `${percentMin}%`, width: `${percentMax - percentMin}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={valueMin}
        onChange={handleMinChange}
        className="range-input"
        aria-label="Edad mínima"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMax}
        onChange={handleMaxChange}
        className="range-input"
        aria-label="Edad máxima"
      />
    </div>
  );
}
