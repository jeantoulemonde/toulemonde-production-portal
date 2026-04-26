import { styles } from "../styles";
import { adminFieldLabel } from "../utils/formatters";
import Field from "./Field";

function AdminInput({ field, value, onChange, type = "text" }) {
  return (
    <Field label={adminFieldLabel(field)}>
      <input style={styles.input} type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export default AdminInput;
