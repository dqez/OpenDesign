export type ColorToken = {
  name: string;
  hex: string;
  description?: string;
};

export type FontToken = {
  name: string;
  value: string;
};

export type TypographyToken = {
  name: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string | number;
};

export type DimensionToken = {
  name: string;
  value: number;
  unit: string;
  css: string;
};

export type DesignPreviewModel = {
  colors: ColorToken[];
  fonts: FontToken[];
  typography: TypographyToken[];
  spacing: DimensionToken[];
  radii: DimensionToken[];
};

type TokenLeaf = {
  $value?: unknown;
  value?: unknown;
  $description?: string;
  description?: string;
};

export function createDesignPreviewModel(tokens: unknown): DesignPreviewModel {
  return {
    colors: extractColors(tokens),
    fonts: extractFonts(tokens),
    typography: extractTypography(tokens),
    spacing: extractDimensions(path(tokens, ["spacing"])),
    radii: extractDimensions(path(tokens, ["radius"]), 48),
  };
}

export function extractColors(tree: unknown, prefix = ""): ColorToken[] {
  if (!isRecord(tree)) return [];

  return Object.entries(tree).flatMap(([key, raw]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (!isRecord(raw)) return [];

    const leaf = raw as TokenLeaf;
    const hex = colorHex(leaf.$value ?? leaf.value);
    if (hex) {
      return [
        {
          name,
          hex,
          description: leaf.$description ?? leaf.description,
        },
      ];
    }
    return extractColors(raw, name);
  });
}

export function extractDimensions(tree: unknown, maxValue?: number): DimensionToken[] {
  if (!isRecord(tree)) return [];

  return Object.entries(tree).flatMap(([key, raw]) => {
    if (!isRecord(raw)) return [];
    const leaf = raw as TokenLeaf;
    const dimension = dimensionValue(leaf.$value ?? leaf.value, maxValue);
    if (dimension) return [{ name: key, ...dimension }];
    return extractDimensions(raw, maxValue);
  });
}

function extractFonts(tokens: unknown): FontToken[] {
  const tree = path(tokens, ["typography", "font-family"]);
  if (!isRecord(tree)) return [];

  return Object.entries(tree).flatMap(([name, raw]) => {
    if (!isRecord(raw)) return [];
    const value = (raw as TokenLeaf).$value ?? (raw as TokenLeaf).value;
    return typeof value === "string" ? [{ name, value }] : [];
  });
}

function extractTypography(tokens: unknown): TypographyToken[] {
  const tree = path(tokens, ["typography", "style"]);
  if (!isRecord(tree)) return [];

  return Object.entries(tree).flatMap(([name, raw]) => {
    if (!isRecord(raw)) return [];
    const value = ((raw as TokenLeaf).$value ?? (raw as TokenLeaf).value) as unknown;
    if (!isRecord(value)) return [];
    return [
      {
        name,
        fontFamily: stringValue(value.fontFamily),
        fontSize: dimensionValue(value.fontSize)?.css,
        fontWeight: leafValue(value.fontWeight) as string | number | undefined,
        lineHeight: leafValue(value.lineHeight) as string | number | undefined,
      },
    ];
  });
}

function colorHex(value: unknown) {
  if (typeof value === "string" && /^#([0-9a-f]{3,8})$/i.test(value)) {
    return value;
  }
  if (isRecord(value) && typeof value.hex === "string") return value.hex;
  return null;
}

function dimensionValue(value: unknown, maxValue?: number) {
  const next = leafValue(value);
  if (!isRecord(next) || typeof next.value !== "number") return null;
  const unit = typeof next.unit === "string" ? next.unit : "px";
  const clamped = maxValue ? Math.min(next.value, maxValue) : next.value;
  return { value: clamped, unit, css: `${clamped}${unit}` };
}

function leafValue(value: unknown): unknown {
  if (isRecord(value) && "$value" in value) {
    return value.$value;
  }
  if (isRecord(value) && "value" in value && !("unit" in value)) {
    return value.value;
  }
  return value;
}

function stringValue(value: unknown) {
  const next = leafValue(value);
  return typeof next === "string" ? next : undefined;
}

function path(tree: unknown, keys: string[]) {
  return keys.reduce<unknown>(
    (current, key) => (isRecord(current) ? current[key] : undefined),
    tree,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
