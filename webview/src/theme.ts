import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from "@mantine/core";

/**
 * Referências aos tokens CSS (`tokens.css`), alinhados ao tema do IDE via --vscode-*.
 */
export const cappyPalette = {
  bgBase: "var(--bg-base)",
  bgSurface: "var(--bg-surface)",
  bgSunken: "var(--bg-sunken)",
  bgHover: "var(--bg-hover)",
  bgAccent: "var(--bg-accent)",
  borderSubtle: "var(--border-subtle)",
  borderSurface: "var(--border-surface)",
  borderFocus: "var(--border-focus)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textAccent: "var(--text-accent)",
  /** Botões / logo — cores do tema, não roxo */
  accentFill: "var(--accent-fill)",
  accentFillHover: "var(--accent-fill-hover)",
  greenMid: "var(--green-mid)",
  amber: "var(--amber)",
  redSoft: "var(--red-soft)",
  redBg: "var(--red-bg)",
  toolBorder: "var(--tool-border)",
} as const;

/**
 * Escala de fallback para o primário Mantine (azul neutro). O CSS em `mantine-bridge.css`
 * sobrescreve com `var(--text-accent)` / `--accent-fill` do IDE.
 */
const ideAccent: MantineColorsTuple = [
  "#e8f4fc",
  "#d0e8f8",
  "#a8d4f0",
  "#7fc0e8",
  "#5aacde",
  "#3794cc",
  "#2a7aaa",
  "#1e6088",
  "#154666",
  "#0d2c44",
];

/**
 * Escala cinza para variantes `dark.*` do Mantine.
 */
const cappyDarkScale: MantineColorsTuple = [
  "#f1f2f4",
  "#d8d9e0",
  "#b8bac4",
  "#909296",
  "#6c6f78",
  "#4a4d55",
  "#2f3139",
  "#25262c",
  "#1c1d22",
  "#14151a",
];

/**
 * Variáveis Mantine ligadas aos tokens semânticos (tema do IDE).
 */
export const cappyCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    "--mantine-color-body": "var(--bg-base)",
    "--mantine-color-text": "var(--text-primary)",
    "--mantine-color-bright": "var(--text-primary)",
    "--mantine-color-dimmed": "var(--text-secondary)",
    "--mantine-color-default": "var(--bg-surface)",
    "--mantine-color-default-hover": "var(--bg-hover)",
    "--mantine-color-default-border": "var(--border-surface)",
    "--mantine-color-default-color": "var(--text-primary)",
    "--mantine-color-anchor": "var(--text-accent)",
  },
});

const themeOverride: MantineThemeOverride = {
  primaryColor: "ideAccent",
  colors: {
    ideAccent,
    dark: cappyDarkScale,
  },
  defaultRadius: "md",
  fontFamily: "var(--font-ui)",
  headings: {
    fontFamily: "var(--font-ui)",
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "1.25rem", lineHeight: "1.35" },
      h2: { fontSize: "1rem", lineHeight: "1.4" },
      h3: { fontSize: "0.75rem", lineHeight: "1.35" },
    },
  },
  components: {
    Paper: {
      defaultProps: {
        radius: "md",
        withBorder: true,
        shadow: "none",
      },
      styles: {
        root: {
          backgroundColor: "var(--bg-sunken)",
          borderColor: "var(--border-surface)",
        },
      },
    },
    Button: {
      defaultProps: {
        size: "sm",
      },
    },
    ActionIcon: {
      defaultProps: {
        size: "md",
        variant: "subtle",
        color: "ideAccent",
      },
    },
    TextInput: {
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
    },
    Textarea: {
      defaultProps: {
        size: "sm",
        variant: "filled",
        autosize: true,
        minRows: 3,
      },
    },
    Select: {
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
    },
    NumberInput: {
      defaultProps: {
        size: "sm",
        variant: "filled",
      },
    },
    Badge: {
      defaultProps: {
        size: "sm",
        variant: "light",
      },
    },
    Progress: {
      defaultProps: {
        size: "sm",
        radius: "xl",
      },
    },
    SegmentedControl: {
      defaultProps: {
        size: "xs",
        radius: "md",
        color: "ideAccent",
      },
    },
    Code: {
      defaultProps: {
        block: true,
      },
      styles: {
        root: {
          backgroundColor: "var(--bg-sunken)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-surface)",
        },
      },
    },
    ScrollArea: {
      defaultProps: {
        scrollbarSize: 8,
        offsetScrollbars: true,
      },
    },
  },
};

/**
 * Tema Mantine da UI Cappy (sempre usado com `defaultColorScheme="dark"`).
 */
export const cappyMantineTheme = createTheme(themeOverride);
