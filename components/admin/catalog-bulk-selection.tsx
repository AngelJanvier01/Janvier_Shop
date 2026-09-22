"use client";

import { useEffect, useRef, useState } from "react";

type CatalogBulkSelectionProps = {
  formId: string;
  totalOnPage: number;
};

function productCheckboxes(formId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][form="${formId}"][name="productIds"]`
    )
  );
}

export function CatalogBulkSelection({ formId, totalOnPage }: CatalogBulkSelectionProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkboxes = productCheckboxes(formId);
    const updateCount = () => {
      const nextCount = checkboxes.filter((checkbox) => checkbox.checked).length;
      setSelectedCount(nextCount);
      if (selectAllRef.current) {
        selectAllRef.current.indeterminate =
          nextCount > 0 && nextCount < checkboxes.length;
      }
    };

    checkboxes.forEach((checkbox) => checkbox.addEventListener("change", updateCount));
    updateCount();
    return () => {
      checkboxes.forEach((checkbox) =>
        checkbox.removeEventListener("change", updateCount)
      );
    };
  }, [formId]);

  function toggleAll(checked: boolean) {
    const checkboxes = productCheckboxes(formId);
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
    });
    setSelectedCount(checked ? checkboxes.length : 0);
    if (selectAllRef.current) selectAllRef.current.indeterminate = false;
  }

  return (
    <div className="catalogBulkSelection">
      <label>
        <input
          checked={totalOnPage > 0 && selectedCount === totalOnPage}
          onChange={(event) => toggleAll(event.target.checked)}
          ref={selectAllRef}
          type="checkbox"
        />
        <span>SELECCIONAR TODA ESTA PÁGINA</span>
      </label>
      <output aria-live="polite">
        <strong>{selectedCount}</strong>{" "}
        {selectedCount === 1 ? "PRODUCTO SELECCIONADO" : "PRODUCTOS SELECCIONADOS"}
      </output>
    </div>
  );
}
