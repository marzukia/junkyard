import { ColorPicker, Popover, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useCallback, useEffect, useState } from "react";
import { normalizeHex } from "../lib/color";

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorInput({ label, value, onChange }: ColorInputProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [textValue, setTextValue] = useState(value);

  // Sync when external value changes (e.g. from picker)
  useEffect(() => {
    setTextValue(value);
  }, [value]);

  const handleTextChange = useCallback(
    (raw: string) => {
      setTextValue(raw);
      const normalized = normalizeHex(raw);
      if (normalized) onChange(normalized);
    },
    [onChange]
  );

  const handlePickerChange = useCallback(
    (hex: string) => {
      onChange(hex);
    },
    [onChange]
  );

  return (
    <div className="color-input-wrapper">
      <label className="color-input-label" htmlFor={`color-input-${label}`}>
        {label}
      </label>
      <div className="color-input-row">
        <Popover
          opened={opened}
          onClose={close}
          position="bottom-start"
          shadow="xs"
          withArrow={false}
        >
          <Popover.Target>
            <button
              type="button"
              className="color-swatch-button"
              style={{ backgroundColor: value }}
              onClick={toggle}
              aria-label={`Pick ${label} color, current: ${value}`}
            />
          </Popover.Target>
          <Popover.Dropdown>
            <ColorPicker
              format="hex"
              value={value}
              onChange={handlePickerChange}
              onChangeEnd={() => close()}
            />
          </Popover.Dropdown>
        </Popover>
        <TextInput
          id={`color-input-${label}`}
          value={textValue}
          onChange={(e) => handleTextChange(e.currentTarget.value)}
          aria-label={`${label} hex value`}
          className="color-hex-input"
          spellCheck={false}
          maxLength={7}
        />
      </div>
    </div>
  );
}
