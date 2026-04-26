import { styles } from "../styles";

function PageContainer({ children, as: Component = "div", style, ...props }) {
  return (
    <Component style={{ ...styles.pageContainer, ...(style || {}) }} {...props}>
      {children}
    </Component>
  );
}

export default PageContainer;
