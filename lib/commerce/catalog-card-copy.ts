const headingMaximumLength = 28;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function comparable(value: string) {
  return clean(value)
    .toLocaleUpperCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function withoutLeadingSeparator(value: string) {
  return clean(value.replace(/^[\s,;:./\\-]+/, ""));
}

function removeLeading(value: string, prefix: string) {
  const cleanValue = clean(value);
  const cleanPrefix = clean(prefix);
  if (!cleanPrefix || !comparable(cleanValue).startsWith(comparable(cleanPrefix))) {
    return null;
  }
  return withoutLeadingSeparator(cleanValue.slice(cleanPrefix.length));
}

function headingFromName(name: string) {
  const cleanName = clean(name);
  if (cleanName.length <= headingMaximumLength) return cleanName;

  const compactHeading = cleanName.slice(0, headingMaximumLength);
  if (/[,;:\s]/.test(cleanName[headingMaximumLength])) {
    return compactHeading.replace(/[,;:\s]+$/, "");
  }

  const breakpoint = cleanName.lastIndexOf(" ", headingMaximumLength);
  return cleanName.slice(0, breakpoint > 0 ? breakpoint : headingMaximumLength).trim();
}

export function getCatalogCardCopy(name: string, description: string) {
  const fullName = clean(name);
  const heading = headingFromName(fullName);
  const nameContinuation = withoutLeadingSeparator(fullName.slice(heading.length));
  const descriptionContinuation = removeLeading(description, fullName);
  const descriptionFromHeading = removeLeading(description, heading);

  if (descriptionContinuation !== null) {
    return {
      continuation: [nameContinuation, descriptionContinuation].filter(Boolean).join(" "),
      heading
    };
  }

  if (descriptionFromHeading !== null) {
    return { continuation: descriptionFromHeading, heading };
  }

  return {
    continuation: [nameContinuation, clean(description)].filter(Boolean).join(" "),
    heading
  };
}
