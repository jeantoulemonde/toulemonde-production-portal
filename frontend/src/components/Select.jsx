import { styles } from "../styles";

function Select({ value, onChange, options }) {
  return (
    <select style={styles.input} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => {
        const normalized = typeof option === "object" && option !== null
          ? option
          : { value: option, label: option || "Sélectionner" };
        return (
          <option key={`${normalized.value}-${normalized.label}`} value={normalized.value}>
            {normalized.label || "Sélectionner"}
          </option>
        );
      })}
    </select>
  );
}

export default Select;
