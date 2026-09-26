import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export interface SelectFieldOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string = string> {
  id: string;
  name: string;
  value: T | "";
  options: ReadonlyArray<SelectFieldOption<T>>;
  onValueChange: (value: T) => void;
  placeholder?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  dataAutofocus?: boolean;
}

export function SelectField<T extends string = string>({
  id,
  name,
  value,
  options,
  onValueChange,
  placeholder = "Selecione",
  ariaDescribedBy,
  ariaInvalid,
  dataAutofocus,
}: SelectFieldProps<T>) {
  return (
    <SelectPrimitive.Root
      name={name}
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as T)}
    >
      <SelectPrimitive.Trigger
        id={id}
        className="ui-select-trigger"
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        data-autofocus={dataAutofocus ? "true" : undefined}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" size={15} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="ui-select-content"
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="ui-select-scroll-button">
            <ChevronUp aria-hidden="true" size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="ui-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                className="ui-select-item"
                value={option.value}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ui-select-item__indicator">
                  <Check aria-hidden="true" size={14} strokeWidth={2.25} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="ui-select-scroll-button">
            <ChevronDown aria-hidden="true" size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
