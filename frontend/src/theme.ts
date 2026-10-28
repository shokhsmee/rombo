import {
  Badge,
  Button,
  createTheme,
  Input,
  Modal,
  NumberInput,
  Paper,
  Select,
  Textarea,
  TextInput,
  type MantineColorsTuple,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";

// Deep "ink" blue — the only accent. Everything else is neutral.
const ink: MantineColorsTuple = [
  "#eef3f8", "#dce5ef", "#b5c8dd", "#8aa9ca", "#6790ba",
  "#507fb0", "#4377ab", "#346596", "#2b5987", "#1d4c78",
];

export const theme = createTheme({
  primaryColor: "ink",
  primaryShade: 8,
  colors: { ink },
  fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, monospace",
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px", xl: "10px" },
  fontSizes: { xs: "12px", sm: "13px", md: "14px", lg: "16px", xl: "18px" },
  spacing: { xs: "6px", sm: "10px", md: "14px", lg: "20px", xl: "28px" },
  headings: {
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "20px", lineHeight: "28px" },
      h2: { fontSize: "15px", lineHeight: "22px" },
      h3: { fontSize: "13px", lineHeight: "20px" },
    },
  },
  components: {
    Button: Button.extend({ defaultProps: { size: "sm" } }),
    TextInput: TextInput.extend({ defaultProps: { size: "sm" } }),
    Textarea: Textarea.extend({ defaultProps: { size: "sm", autosize: true, minRows: 2 } }),
    Select: Select.extend({ defaultProps: { size: "sm", allowDeselect: false, comboboxProps: { shadow: "md" } } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: "sm", thousandSeparator: " " } }),
    DateInput: DateInput.extend({ defaultProps: { size: "sm", valueFormat: "DD.MM.YYYY", clearable: true } }),
    Input: Input.extend({ defaultProps: { size: "sm" } }),
    Badge: Badge.extend({ defaultProps: { radius: "sm", variant: "light", tt: "none", fw: 500 } }),
    Paper: Paper.extend({ defaultProps: { withBorder: true, radius: "md", shadow: "none" } }),
    Modal: Modal.extend({ defaultProps: { radius: "md", centered: true, overlayProps: { backgroundOpacity: 0.35 } } }),
  },
});
