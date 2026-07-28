const sectionDataModules = import.meta.glob("./**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

// Cada landing tiene su propia carpeta de data (ej: base/, autos-velocidad/),
// así que el path recibido ya trae ese prefijo: data="autos-velocidad/planes.json".
const normalizeSectionDataPath = (dataPath: string) => {
  let normalizedPath = dataPath.trim();

  if (!normalizedPath) {
    return "";
  }

  normalizedPath = normalizedPath
    .replace(/^@\//, "")
    .replace(/^\/?src\//, "")
    .replace(/^data\//, "")
    .replace(/^\.\//, "");

  const withExtension = normalizedPath.endsWith(".json")
    ? normalizedPath
    : `${normalizedPath}.json`;

  return `./${withExtension}`;
};

export const resolveSectionData = <T>(dataPath: string | undefined, fallbackData: T) => {
  if (!dataPath) {
    return fallbackData;
  }

  const normalizedPath = normalizeSectionDataPath(dataPath);
  const resolvedData = sectionDataModules[normalizedPath];

  if (!resolvedData) {
    return fallbackData;
  }

  return resolvedData as T;
};
