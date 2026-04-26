import { styles } from "../styles";

function Select({ value, onChange, options }) {
  return (
    <select style={styles.input} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option || "Sélectionner"}
        </option>
      ))}
    </select>
  );
}

export default Select;
